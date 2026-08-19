// Industrial Ops — the only thing in the project that makes a sound (Phase A3).
//
// Two cues, synthesised on the fly with Web Audio. No mp3/wav/ogg, no CDN, no
// asset loading, no new dependency — so there is nothing to preload, nothing to
// 404, and nothing to license.
//
//   ALERT   one short tone.
//   DANGER  a lower-then-higher double pulse, clearly not the same sound.
//
// The distinction has to survive not looking at the screen; it carries no other
// meaning. The exact frequencies are an implementation detail and live in TONES
// so they exist in exactly one place.
//
// State honesty is the hard requirement here. A browser may refuse to start
// audio until the operator interacts with the page, and may suspend a running
// context later for reasons entirely outside this app (OS output change, tab
// lifecycle, policy). READY is therefore claimed only for a context observed to
// be `running`, and a `statechange` listener keeps that true even when nothing
// in our code asked for the change.
//
// This module is import-safe in Node: nothing touches window/AudioContext at
// module scope, only inside functions.

export const TONES = {
  alert: {
    peakGain: 0.16,
    pulses: [{ freqHz: 880, startMs: 0, durationMs: 160 }],
  },
  danger: {
    peakGain: 0.26,
    pulses: [
      { freqHz: 740, startMs: 0, durationMs: 130 },
      { freqHz: 1175, startMs: 210, durationMs: 170 },
    ],
  },
}

// Short ramps instead of hard starts/stops: a square-edged gain change is an
// audible click, which reads as a fault rather than a cue.
export const ENVELOPE = { attackMs: 8, releaseMs: 55 }

const STATE = {
  UNINITIALIZED: 'uninitialized',
  SUSPENDED: 'suspended',
  RUNNING: 'running',
  CLOSED: 'closed',
  UNSUPPORTED: 'unsupported',
  ERROR: 'error',
}

let ctx = null
let masterGain = null
let state = STATE.UNINITIALIZED
let stateListener = null
const listeners = new Set()
const liveNodes = new Set()

// Internal counters. They always exist — the engine is allowed to know what it
// has played. What is NOT allowed is exposing them as a product API (see below).
const stats = { alertCues: 0, dangerCues: 0, contexts: 0 }

/**
 * QA instrumentation is a development affordance, not a feature.
 *
 * In dev/test the counters are mirrored onto window so Playwright can prove that
 * exactly one cue fired — a screenshot cannot show sound. In a production build
 * `import.meta.env.DEV` is statically false, the mirror is never written, and
 * `window.__IO2_AUDIO_STATS__` does not exist at all. It is not created empty:
 * shipping a debug global that happens to have no readers is still shipping a
 * debug global.
 */
function mirrorStats() {
  // Order matters twice over. The window guard comes first so Node, which has no
  // import.meta.env at all, returns before touching it. The env test is then
  // written inline rather than behind a helper so Vite can fold it to a constant
  // false in a production build and drop everything below it — the global is
  // absent from the shipped bundle, not merely disabled in it.
  if (typeof window === 'undefined') return
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') return

  window.__IO2_AUDIO_STATS__ = {
    alertCues: stats.alertCues,
    dangerCues: stats.dangerCues,
    contexts: stats.contexts,
    activeNodes: liveNodes.size,
    engineState: state,
  }
}

function setState(next) {
  if (state === next) {
    mirrorStats()
    return
  }
  state = next
  mirrorStats()
  for (const fn of listeners) {
    try {
      fn(state)
    } catch {
      // A broken subscriber must not take the audio engine down with it.
    }
  }
}

function stateFromContext() {
  if (!ctx) return STATE.UNINITIALIZED
  if (ctx.state === 'running') return STATE.RUNNING
  if (ctx.state === 'closed') return STATE.CLOSED
  return STATE.SUSPENDED
}

function AudioContextCtor() {
  if (typeof window === 'undefined') return null
  return window.AudioContext || window.webkitAudioContext || null
}

/**
 * Create the one AudioContext for this page, once.
 *
 * Idempotent by design: React StrictMode mounts, cleans up and mounts again, and
 * navigating away from OPS and back must not accumulate contexts. `contexts`
 * counts real constructions, which is exactly the assertion the tests make.
 */
export function initAudioEngine() {
  if (ctx) return state
  if (state === STATE.UNSUPPORTED) return state

  const Ctor = AudioContextCtor()
  if (!Ctor) {
    setState(STATE.UNSUPPORTED)
    return state
  }

  try {
    ctx = new Ctor()
    stats.contexts += 1
    masterGain = ctx.createGain()
    masterGain.gain.value = 1
    masterGain.connect(ctx.destination)

    // Registered once, on the context itself — not per hook instance. Remounting
    // OPS therefore cannot pile up listeners.
    stateListener = () => setState(stateFromContext())
    if (typeof ctx.addEventListener === 'function') {
      ctx.addEventListener('statechange', stateListener)
    } else {
      ctx.onstatechange = stateListener
    }

    setState(stateFromContext())
  } catch {
    ctx = null
    masterGain = null
    setState(STATE.ERROR)
  }
  return state
}

export function getEngineState() {
  return state
}

export function getAudioStats() {
  return {
    alertCues: stats.alertCues,
    dangerCues: stats.dangerCues,
    contexts: stats.contexts,
    activeNodes: liveNodes.size,
    engineState: state,
  }
}

/** Subscribe to engine-state changes. Returns the unsubscribe function. */
export function subscribeEngineState(fn) {
  if (typeof fn !== 'function') return () => {}
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Ask the browser to start audio. Only meaningful from a user gesture.
 *
 * Never rejects and never reports success it has not observed: the return value
 * is whether the context is actually running afterwards.
 */
export async function resumeAudio() {
  initAudioEngine()
  if (!ctx) return false
  try {
    if (ctx.state !== 'running') await ctx.resume()
  } catch {
    // Autoplay policy refusing is a normal outcome, not an exception to shout
    // about. The state below reports the truth either way.
  }
  setState(stateFromContext())
  return state === STATE.RUNNING
}

function playCue(tone) {
  // BLOCKED or ERROR simply drops the cue. There is deliberately no queue: a
  // sound that arrives after the operator has already dealt with the alert is
  // noise, not awareness.
  if (!ctx || state !== STATE.RUNNING || !masterGain) return false

  const now = ctx.currentTime
  const attack = ENVELOPE.attackMs / 1000
  const release = ENVELOPE.releaseMs / 1000

  for (const pulse of tone.pulses) {
    const start = now + pulse.startMs / 1000
    const end = start + pulse.durationMs / 1000

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(pulse.freqHz, start)

    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(tone.peakGain, start + attack)
    gain.gain.setValueAtTime(tone.peakGain, Math.max(start + attack, end - release))
    gain.gain.linearRampToValueAtTime(0, end)

    osc.connect(gain)
    gain.connect(masterGain)

    const node = { osc, gain }
    liveNodes.add(node)
    osc.onended = () => {
      liveNodes.delete(node)
      try {
        osc.disconnect()
        gain.disconnect()
      } catch {
        // Already torn down.
      }
      mirrorStats()
    }

    // Pulses are scheduled on the audio clock, not with setTimeout: there are no
    // JS timers to leak, and the second pulse cannot drift or outlive the page.
    osc.start(start)
    osc.stop(end + 0.01)
  }

  mirrorStats()
  return true
}

export function playAlertCue() {
  const played = playCue(TONES.alert)
  if (played) {
    stats.alertCues += 1
    mirrorStats()
  }
  return played
}

export function playDangerCue() {
  const played = playCue(TONES.danger)
  if (played) {
    stats.dangerCues += 1
    mirrorStats()
  }
  return played
}

/**
 * Silence everything already sounding, immediately.
 *
 * Used when the operator mutes mid-cue and when the tab goes hidden — where the
 * rule is no audio output at all, not merely no new audio.
 */
export function stopAllCues() {
  if (!ctx) return
  const now = ctx.currentTime
  for (const node of Array.from(liveNodes)) {
    try {
      node.gain.gain.cancelScheduledValues(now)
      node.gain.gain.setValueAtTime(node.gain.gain.value, now)
      node.gain.gain.linearRampToValueAtTime(0, now + 0.02)
      node.osc.stop(now + 0.03)
    } catch {
      liveNodes.delete(node)
    }
  }
  mirrorStats()
}

/**
 * Tear the engine down completely. For tests and teardown only.
 *
 * The hook never calls this: closing the context on every unmount would mean
 * StrictMode's mount/cleanup/mount cycle destroys the context it is about to
 * need, and leaving OPS briefly would cost a fresh context each time. The
 * singleton stays, passive, with no cues and no subscribers.
 */
export function disposeAudioEngine() {
  stopAllCues()
  listeners.clear()
  if (ctx) {
    try {
      if (stateListener && typeof ctx.removeEventListener === 'function') {
        ctx.removeEventListener('statechange', stateListener)
      } else {
        ctx.onstatechange = null
      }
      ctx.close()
    } catch {
      // Already closed.
    }
  }
  ctx = null
  masterGain = null
  stateListener = null
  liveNodes.clear()
  state = STATE.UNINITIALIZED
  mirrorStats()
}
