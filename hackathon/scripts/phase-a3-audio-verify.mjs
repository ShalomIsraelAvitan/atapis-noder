// Phase A3 - Operational sound alerts & global mute verification.
//
// Three layers, same shape as the A1/A2 suites:
//   A. static source checks   (no audio assets, no Notification API, no debug
//                              global in product code, control accessibility,
//                              strip child count, height budget untouched)
//   B. logic checks           (the cue planner and the preference store, imported
//                              directly and run in Node — this is where the ~50
//                              detection rules live)
//   C. browser checks         (playwright against a running dev server, which
//                              serves the app inside React StrictMode)
//
// A screenshot cannot prove a sound. Layer C therefore reads the engine's own
// cue counters, which the engine mirrors onto window ONLY in dev/test builds.
// Nobody here asserts "I heard it".
//
// Live scenarios mock the four backend endpoints so a genuinely new alert can be
// made to appear on demand: this machine has no camera and no radar, and the
// demo fixture is deliberately static.
//
// Usage: node scripts/phase-a3-audio-verify.mjs [baseUrl]
//        needs backend :5000 (login) and Vite (default http://localhost:5174)

import { chromium } from 'playwright'
import { readFile, readdir } from 'node:fs/promises'
import { execSync, spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CUE, CUE_SEVERITY_RANK, createAudioBook, planAudioCues, soundDisplayState,
} from '../src/concepts/industrial-ops/audioCuePlanner.js'
import {
  AUDIO_PREF_KEY, AUDIO_PREF_SCHEMA_VERSION,
  createDefaultAudioPrefs, loadAudioPrefs, saveAudioPrefs, serializeAudioPrefs,
} from '../src/concepts/industrial-ops/audioPrefs.js'
import { TONES, ENVELOPE, getAudioStats, getEngineState } from '../src/concepts/industrial-ops/operationalSoundEngine.js'
import {
  LIFECYCLE, SEVERITY, buildFingerprint, reduceAlerts, createInitialAlertState,
  applyLifecycleAction,
} from '../src/concepts/industrial-ops/alerts.js'
import { demoAlerts } from '../src/concepts/industrial-ops/demoAlerts.js'
import { LIVE_AREAS } from '../src/concepts/industrial-ops/areas.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const T0 = 1_800_000_000_000

let failed = 0
let passed = 0
const check = (ok, label, detail = '') => {
  if (ok) passed += 1; else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`)
}
const section = (n) => console.log(`\n=== ${n} ===`)
const read = (p) => readFile(path.join(root, p), 'utf-8')

const IO = 'src/concepts/industrial-ops'

// ============================================================================
section('A - static source checks')

const planner = await read(`${IO}/audioCuePlanner.js`)
const engine = await read(`${IO}/operationalSoundEngine.js`)
const hook = await read(`${IO}/useOperationalAudio.js`)
const control = await read(`${IO}/components/SoundControl.jsx`)
const prefs = await read(`${IO}/audioPrefs.js`)
const dashboard = await read(`${IO}/views/IndustrialDashboard.jsx`)
const shell = await read(`${IO}/IndustrialShell.jsx`)
const css = await read(`${IO}/industrial.css`)
const alertList = await read(`${IO}/components/AlertList.jsx`)
// Phase A3.1.1 moved the operator's controls into the alerts panel; this is the
// component that renders them now.
const bar = await read(`${IO}/components/SelectedAlertActions.jsx`)

const audioSources = { planner, engine, hook, control, prefs }
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// --- no external audio, no new dependency ----------------------------------
{
  const all = Object.values(audioSources).join('\n')
  check(!/\.(mp3|wav|ogg|m4a|aac)\b/i.test(all), 'A01 - no external audio asset is referenced')
  check(!/new Audio\s*\(/.test(all) && !/<audio/i.test(all + dashboard),
    'A02 - no HTMLAudioElement anywhere in the audio layer')
  check(!/from '(?!\.|react)/.test(stripComments(planner + prefs)),
    'A03 - the pure layer pulls in no third-party package')
  const imports = [...stripComments(hook + engine).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
  check(imports.every((spec) => spec === 'react' || spec.startsWith('.')),
    'A04 - the engine and hook add no audio library', imports.join(','))
}

// --- no Notification API ----------------------------------------------------
{
  const all = stripComments(Object.values(audioSources).join('\n') + dashboard)
  check(!/Notification\s*\.\s*requestPermission|new Notification\s*\(/.test(all),
    'A05 - the browser Notification API is never touched')
}

// --- Web Audio is confined to the engine ------------------------------------
{
  const outsideEngine = stripComments(planner + hook + control + prefs + dashboard)
  check(!/AudioContext|createOscillator|OscillatorNode|createGain/.test(outsideEngine),
    'A06 - Web Audio primitives exist only inside operationalSoundEngine.js')
  check(/createOscillator/.test(engine) && /createGain/.test(engine),
    'A07 - the engine really does synthesise its own tones')
  check(!/setInterval|setTimeout/.test(stripComments(engine)),
    'A08 - the engine schedules on the audio clock, not on JS timers')
}

// --- centralised tone constants --------------------------------------------
{
  check(/export const TONES/.test(engine) && /export const ENVELOPE/.test(engine),
    'A09 - tone and envelope constants are exported from one place')
  check(!/\b(440|880|1175|740)\b/.test(stripComments(hook + control + planner)),
    'A10 - no frequency literal leaks into the hook, control or planner')
  check(TONES.alert.pulses.length === 1 && TONES.danger.pulses.length === 2,
    'A11 - ALERT is a single cue and DANGER is a distinct double cue',
    `${TONES.alert.pulses.length} vs ${TONES.danger.pulses.length} pulses`)
  check(TONES.danger.peakGain > TONES.alert.peakGain &&
    TONES.danger.pulses[1].freqHz !== TONES.alert.pulses[0].freqHz,
    'A12 - the two cues differ in strength and in pitch, not only in length')
  check(ENVELOPE.attackMs > 0 && ENVELOPE.releaseMs > 0,
    'A13 - both cues are ramped, so neither starts or ends on a click')
}

// --- QA instrumentation is not a product API --------------------------------
{
  check(/import\.meta\.env/.test(engine) && /__IO2_AUDIO_STATS__/.test(engine),
    'A14 - the stats mirror exists and is env-guarded')
  const guard = engine.slice(engine.indexOf('function mirrorStats'), engine.indexOf('function setState'))
  check(/import\.meta\.env\.DEV/.test(guard) && /MODE !== 'test'/.test(guard),
    'A15 - the guard admits dev and test only, and is written so a build can fold it')
  const product = stripComments(planner + hook + control + prefs + dashboard + alertList + bar)
  check(!/__IO2_AUDIO_STATS__/.test(product),
    'A16 - no product module reads or writes the QA global')
  const engineNoComments = stripComments(engine)
  const reads = engineNoComments.split('__IO2_AUDIO_STATS__').length - 1
  const writes = (engineNoComments.match(/window\.__IO2_AUDIO_STATS__\s*=/g) || []).length
  check(reads === writes && writes >= 1,
    'A17 - even the engine only ever writes the mirror, never reads it back', `${writes} writes / ${reads} mentions`)
}

// --- audio is output only ---------------------------------------------------
{
  check(!/from '\.\/alerts\.js'|from '\.\/alertSelectors\.js'|from '\.\/alertStorage\.js'|operatorLog/.test(hook),
    'A18 - the audio hook imports no alert engine, selector, storage or log module')
  check(!/setFilters|selectAlert|selectArea|acknowledge|startReview|resolve\(|reopen\(/.test(stripComments(hook)),
    'A19 - the audio hook calls no operational action')
  check(!/Date\.now\(\)|Math\.random\(\)/.test(stripComments(planner)),
    'A20 - the planner invents neither a clock nor an identity')
  check(/alert\.id/.test(planner) && !/alert\.message|indexOf\(alert\)/.test(planner),
    'A21 - identity is A0\'s alert.id and nothing else')
}

// --- no reminder, no loop, no volume, no test tone ---------------------------
{
  const all = stripComments(Object.values(audioSources).join('\n'))
  check(!/setInterval/.test(all), 'A22 - nothing repeats on a timer: there is no reminder cadence')
  check(!/\bloop\s*=\s*true|\.loop\b/.test(all), 'A23 - no looping source exists')
  check(!/type="range"|volume/i.test(control + css.slice(css.indexOf('.io2-sound'))),
    'A24 - there is no volume control')
  check(!/TEST|preview/i.test(stripComments(control)), 'A25 - there is no test-sound affordance')
}

// --- the control itself ------------------------------------------------------
{
  check(/<button/.test(control) && /type="button"/.test(control),
    'A26 - the control is a real button')
  check(/aria-pressed=/.test(control), 'A27 - it exposes aria-pressed')
  check(/aria-label=/.test(control) && /title=/.test(control),
    'A28 - it carries both an accessible name and a tooltip')
  const soundCss = css.slice(css.indexOf('.io2-sound {'))
  check(/\.io2-sound:focus-visible/.test(soundCss), 'A29 - it has a visible focus ring')
  check(/io2-sound-val/.test(control) && /READY|MUTED|BLOCKED|ERROR/.test(control),
    'A30 - every state is carried by text, not by colour alone')
  const he = ['פעיל', 'מושתק', 'חסום', 'שגיאה'].every((w) => control.includes(w))
  check(he, 'A31 - all four states are localised')
}

// --- placement: inside the mode cluster, no thirteenth strip child -----------
{
  const modeStart = dashboard.indexOf('<div className="io2-strip-mode">')
  const modeEnd = dashboard.indexOf('</div>', dashboard.indexOf('<DemoModeBadge'))
  const controlAt = dashboard.indexOf('<SoundControl')
  check(controlAt > modeStart && controlAt < modeEnd,
    'A32 - the control renders inside .io2-strip-mode, not as a new strip child')
  const cells = (dashboard.match(/<StatusStripCell/g) || []).length
  check(cells === 11, 'A33 - the strip still has its eleven readout cells', String(cells))
  check(!/SoundControl/.test(shell), 'A34 - IndustrialShell.jsx is untouched by the audio layer')
  const dialogs = await read(`${IO}/components/AlertActionDialogs.jsx`)
  check(!/SoundControl|useOperationalAudio/.test(dialogs + alertList + bar),
    'A35 - sound is not mixed into a workflow dialog, a row or the action bar')
}

// --- the audio hook is fed the full list ------------------------------------
{
  const call = dashboard.slice(dashboard.indexOf('useOperationalAudio({'), dashboard.indexOf('const [logMode'))
  check(/alerts:\s*cc\.alerts/.test(call) && !/visibleAlerts/.test(call),
    'A36 - audio receives cc.alerts, never the filtered view')
  check(/documentVisible:\s*cc\.documentVisible/.test(call),
    'A37 - audio is gated on the existing visibility signal')
}

// --- storage schema ----------------------------------------------------------
{
  check(AUDIO_PREF_KEY === 'industrial-ops-audio-v1', 'A38 - the approved storage key is used', AUDIO_PREF_KEY)
  const shape = Object.keys(serializeAudioPrefs({ muted: true })).sort().join(',')
  check(shape === 'muted,v', 'A39 - only the version and the preference are serialised', shape)
  const prefsCode = stripComments(prefs)
  check(/localStorage/.test(prefsCode) && !/sessionStorage/.test(prefsCode),
    'A40 - the preference is a localStorage preference, not session state')
  const otherFiles = stripComments(planner + engine + hook + control + dashboard)
  check(!/industrial-ops-audio-v1/.test(otherFiles),
    'A41 - the key exists in exactly one module')
}

// --- the height budget is untouched -----------------------------------------
{
  // A3 asserted that adding the sound control did not disturb the A2 action
  // bar's 44-60px range. Phase A3.1.1 moved those controls into the alerts
  // panel as a fixed-height region, so the same assertion — audio changed no
  // operator-control geometry — is made against the region that holds them now.
  const abBlock = css.slice(css.indexOf('.io2-sel-actions {'), css.indexOf('.io2-sel-identity'))
  const fixed = Number((abBlock.match(/\bheight:\s*(\d+)px/) || [])[1])
  check(fixed >= 44 && /overflow:\s*hidden/.test(abBlock),
    'A42 - the operator-action region keeps one fixed, clipped height', `${fixed}px`)
  const soundCss = css.slice(css.indexOf('.io2-sound {'), css.indexOf('.io2-strip--alert'))
  const sizes = [...soundCss.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  check(sizes.length === 1 && sizes[0] >= 10.5,
    'A43 - the control adds exactly one type size, at or above 10.5px', sizes.join('/'))
  check(/io2-strip-label/.test(control),
    'A43b - and its micro-label reuses the strip label class instead of a second size')
  check(!/transform:\s*scale|zoom:/.test(soundCss), 'A44 - no scale and no zoom')
}

// ============================================================================
section('B - logic: the cue planner')

const A = (id, severity, active = true) => ({ id, severity, active })
const plan = (book, alerts, mode = 'live') => planAudioCues(book, alerts, { mode })

// --- initialisation is silent ------------------------------------------------
{
  const live = [A('a#1', 'danger'), A('b#1', 'alert'), A('c#1', 'info')]
  const first = plan(createAudioBook(), live)
  check(first.cue === null, 'B01 - a first live population is silent')

  const demoFixture = demoAlerts(T0)
  check(plan(createAudioBook(), demoFixture, 'demo').cue === null,
    'B02 - the demo fixture seed is silent', `${demoFixture.length} alerts`)
  check(demoFixture.some((a) => a.severity === SEVERITY.DANGER),
    'B03 - and that fixture really does contain a DANGER')

  // A restored session is just alerts that are present on the first pass.
  const restored = demoFixture.map((a) => ({ ...a, lifecycle: LIFECYCLE.ACKNOWLEDGED }))
  check(plan(createAudioBook(), restored, 'demo').cue === null,
    'B04 - a restored session is silent')
  check(plan(first.nextBook, live).cue === null, 'B05 - the very next poll is silent too')

  // A reload cannot be simulated other than by starting from a fresh book —
  // which is exactly what a reload does, because the book is never persisted.
  check(!/localStorage|sessionStorage/.test(planner),
    'B06 - the book is memory-only, so a reload always re-baselines')
}

// --- mode boundaries ---------------------------------------------------------
{
  const liveBook = plan(createAudioBook(), [A('x#1', 'danger')]).nextBook
  check(plan(liveBook, [A('y#1', 'danger')], 'demo').cue === null,
    'B07 - Live -> Demo establishes a new silent baseline')
  const demoBook = plan(createAudioBook(), [A('d#1', 'danger')], 'demo').nextBook
  check(plan(demoBook, [A('e#1', 'danger')], 'live').cue === null,
    'B08 - Demo -> Live establishes a new silent baseline')

  // The collision case: the same id string in both modes must not cross-silence.
  const demoSeen = plan(createAudioBook(), [A('same#1', 'danger')], 'demo').nextBook
  const afterFlip = plan(demoSeen, [A('same#1', 'danger')], 'live')
  check(afterFlip.cue === null, 'B09 - the flip itself is silent even on a shared id')
  const next = plan(afterFlip.nextBook, [A('same#1', 'danger'), A('other#1', 'danger')], 'live')
  check(next.cue === CUE.DANGER, 'B10 - and the live session still hears its own new alert')
  check(afterFlip.nextBook.mode === 'live', 'B11 - the book records the mode it describes')
}

// --- ALERT ------------------------------------------------------------------
{
  let book = plan(createAudioBook(), [A('a#1', 'alert')]).nextBook
  let r = plan(book, [A('a#1', 'alert'), A('b#1', 'alert')])
  check(r.cue === CUE.ALERT, 'B12 - a new ALERT owes one alert cue')
  book = r.nextBook
  check(plan(book, [A('a#1', 'alert'), A('b#1', 'alert')]).cue === null,
    'B13 - the same alert on the next poll owes nothing')
  check(plan(book, [A('b#1', 'alert'), A('a#1', 'alert')]).cue === null,
    'B14 - and re-ordering the list is not an event')
  check(plan(book, []).cue === null, 'B15 - an emptied list is not an event')
  check(plan(book, [A('a#1', 'alert'), A('b#1', 'alert'), A('c#1', 'info')]).cue === null,
    'B16 - a new INFO never sounds')
  check(plan(book, [A('a#1', 'alert'), A('b#1', 'alert'), A('d#1', 'alert', false)]).cue === null,
    'B17 - a new alert whose condition is already cleared does not sound')
  const wasAlreadyThere = { id: 'e#1', severity: 'danger', active: true, observedFromSessionStart: true }
  check(plan(book, [A('a#1', 'alert'), A('b#1', 'alert'), wasAlreadyThere]).cue === null,
    'B17b - an alert A0 marks as already-there when observation began never sounds')
  check(plan(book, [A('a#1', 'alert'), A('b#1', 'alert'), { ...wasAlreadyThere, observedFromSessionStart: false }]).cue === CUE.DANGER,
    'B17c - and the very same alert does sound when it genuinely arrived under watch')
}

// --- DANGER -----------------------------------------------------------------
{
  const book = plan(createAudioBook(), [A('a#1', 'alert')]).nextBook
  check(plan(book, [A('a#1', 'alert'), A('n#1', 'danger')]).cue === CUE.DANGER,
    'B18 - a new DANGER owes one danger cue')
  const after = plan(book, [A('a#1', 'alert'), A('n#1', 'danger')]).nextBook
  check(plan(after, [A('a#1', 'alert'), A('n#1', 'danger')]).cue === null,
    'B19 - the same danger on the next poll owes nothing')
  check(plan(book, [A('n#1', 'danger'), A('n#2', 'danger'), A('n#3', 'danger')]).cue === CUE.DANGER,
    'B20 - three new dangers in one update are one cue, not three')
  check(plan(book, [A('n#1', 'danger'), A('m#1', 'alert')]).cue === CUE.DANGER,
    'B21 - DANGER outranks ALERT inside the same update')
  check(plan(book, [A('m#1', 'alert'), A('n#1', 'danger')]).cue === CUE.DANGER,
    'B22 - and the outcome does not depend on list order')
  check(plan(book, [A('p#1', 'alert'), A('q#1', 'alert'), A('r#1', 'alert')]).cue === CUE.ALERT,
    'B23 - several new alerts in one update are one alert cue')
}

// --- escalation and downgrade ------------------------------------------------
{
  let book = plan(createAudioBook(), [A('k#1', 'info')]).nextBook
  let r = plan(book, [A('k#1', 'alert')])
  check(r.cue === CUE.ALERT, 'B24 - INFO rising to ALERT on the same id sounds once')
  r = plan(r.nextBook, [A('k#1', 'danger')])
  check(r.cue === CUE.DANGER, 'B25 - ALERT rising to DANGER on the same id sounds once')
  const escalated = r.nextBook
  check(plan(escalated, [A('k#1', 'danger')]).cue === null, 'B26 - DANGER -> DANGER is silent')
  const downgraded = plan(escalated, [A('k#1', 'alert')])
  check(downgraded.cue === null, 'B27 - DANGER -> ALERT is not an event')
  check(plan(downgraded.nextBook, [A('k#1', 'danger')]).cue === null,
    'B28 - and flapping back up does not chirp, because the high-water mark is kept')
}

// --- what the engine actually does with severity ----------------------------
{
  // The defensive branch above exists because the real engine never patches
  // severity in place. This proves that claim rather than assuming it.
  const snapshot = (mode) => ({
    mode,
    risks: { fused: mode === 'DANGER' ? 88 : 50 },
    tracks: [],
    radar: { enabled: true, connected: true, lastUpdateMs: 100, targets: [] },
    cameras: { webcam: { connected: true }, dahua: { connected: false } },
  })
  let state = createInitialAlertState()
  state = reduceAlerts(state, snapshot('ALERT'), { now: T0, areas: LIVE_AREAS, isFirstSnapshot: true })
  const alertId = state.alerts[0]?.id
  state = reduceAlerts(state, snapshot('DANGER'), { now: T0 + 1000, areas: LIVE_AREAS })
  const dangerAlert = state.alerts.find((a) => a.severity === SEVERITY.DANGER)
  check(Boolean(alertId) && Boolean(dangerAlert) && dangerAlert.id !== alertId,
    'B29 - a real SAFE->ALERT->DANGER escalation arrives as a NEW id, not a patched one',
    `${alertId} -> ${dangerAlert?.id}`)
  const book = plan(createAudioBook(), [A(alertId, 'alert')]).nextBook
  check(plan(book, state.alerts.map((a) => A(a.id, a.severity, a.active))).cue === CUE.DANGER,
    'B30 - and the planner hears that escalation through the new-id path')
}

// --- lifecycle actions are silent -------------------------------------------
{
  const fixture = demoAlerts(T0)
  let state = { ...createInitialAlertState(), alerts: fixture }
  const book = plan(createAudioBook(), state.alerts, 'demo').nextBook
  const target = state.alerts.find((a) => a.lifecycle === LIFECYCLE.NEW)
  const op = { id: 7, name: 'Operator 7' }

  state = applyLifecycleAction(state, target.id, 'acknowledge', { now: T0 + 10, operator: op })
  check(plan(book, state.alerts, 'demo').cue === null, 'B31 - Acknowledge is silent')
  state = applyLifecycleAction(state, target.id, 'review', { now: T0 + 20, operator: op })
  check(plan(book, state.alerts, 'demo').cue === null, 'B32 - Start Review is silent')
  state = applyLifecycleAction(state, target.id, 'resolve', {
    now: T0 + 30, operator: op, reason: 'false_alarm', note: '',
  })
  check(plan(book, state.alerts, 'demo').cue === null, 'B33 - Resolve is silent')
  state = applyLifecycleAction(state, target.id, 'reopen', { now: T0 + 40, operator: op })
  check(plan(book, state.alerts, 'demo').cue === null, 'B34 - Reopen is silent')
  const reopened = state.alerts.find((a) => a.id === target.id)
  check(reopened.id === target.id, 'B35 - because none of them changes the identity')
}

// --- condition changes -------------------------------------------------------
{
  const book = plan(createAudioBook(), [A('c#1', 'danger', true)]).nextBook
  check(plan(book, [A('c#1', 'danger', false)]).cue === null,
    'B36 - active -> cleared is silent: there is no all-clear sound')
  const cleared = plan(book, [A('c#1', 'danger', false)]).nextBook
  check(plan(cleared, [A('c#1', 'danger', true)]).cue === null,
    'B37 - a reactivation that keeps A0\'s id stays silent')
  check(plan(cleared, [A('c#2', 'danger', true)]).cue === CUE.DANGER,
    'B38 - a new instance id, which is A0\'s verdict on a genuinely new event, sounds once')
}

// --- reactivation, through the real engine ----------------------------------
{
  const withTrack = (state) => ({
    mode: 'SAFE',
    risks: { fused: 0 },
    tracks: state ? [{ id: 3, state, hasWeapon: false }] : [],
    radar: { enabled: true, connected: true, lastUpdateMs: 100, targets: [] },
    cameras: { webcam: { connected: true }, dahua: { connected: false } },
  })
  const opts = (now, first = false) => ({ now, areas: LIVE_AREAS, isFirstSnapshot: first })
  let s = reduceAlerts(createInitialAlertState(), withTrack('running'), opts(T0, true))
  const firstId = s.alerts[0].id
  s = reduceAlerts(s, withTrack(null), opts(T0 + 1000))
  s = reduceAlerts(s, withTrack('running'), opts(T0 + 5000))
  check(s.alerts[0].id === firstId,
    'B39 - inside A0\'s 15s window the returning alert keeps its id')
  let s2 = reduceAlerts(createInitialAlertState(), withTrack('running'), opts(T0, true))
  s2 = reduceAlerts(s2, withTrack(null), opts(T0 + 1000))
  s2 = reduceAlerts(s2, withTrack('running'), opts(T0 + 60000))
  check(s2.alerts.some((a) => a.id !== firstId),
    'B40 - beyond it, A0 opens a new instance id')
  check(!/REACTIVATION_WINDOW_MS|15000/.test(planner),
    'B41 - A3 consumes that verdict and never redefines the window')
}

// --- bookkeeping hygiene -----------------------------------------------------
{
  const many = Array.from({ length: 250 }, (_, i) => A(`p#${i}`, 'info'))
  const book = plan(createAudioBook(), many).nextBook
  check(book.entries.size === 250, 'B42 - the book describes exactly the list it saw')
  const shrunk = plan(book, many.slice(0, 5)).nextBook
  check(shrunk.entries.size === 5,
    'B43 - and it shrinks with the list, so pruning cannot leak memory')
  check(plan(shrunk, many.slice(0, 5)).cue === null, 'B44 - a shrunken book is still accurate')
  // An id the engine dropped and later rebuilt is, by the engine's own reckoning,
  // a new NEW-lifecycle instance — so it is allowed to sound again.
  const recycled = plan(shrunk, [...many.slice(0, 5), A('p#200', 'danger')])
  check(recycled.cue === CUE.DANGER, 'B45 - a pruned-then-returning id is heard again')
  check(plan(book, [null, undefined, { severity: 'danger' }, A('ok#1', 'danger')]).cue === CUE.DANGER,
    'B46 - malformed entries are skipped rather than crashing the pass')
}

// --- rank table --------------------------------------------------------------
{
  check(CUE_SEVERITY_RANK.danger > CUE_SEVERITY_RANK.alert &&
    CUE_SEVERITY_RANK.alert > CUE_SEVERITY_RANK.info,
    'B47 - the audible ranking matches the severity ranking')
  check(Object.keys(CUE_SEVERITY_RANK).every((k) => k === k.toLowerCase()),
    'B48 - and it is keyed the way alerts.js writes severity')
  const unknown = plan(plan(createAudioBook(), []).nextBook, [A('u#1', 'catastrophic')])
  check(unknown.cue === null, 'B49 - an unrecognised severity is treated as INFO, never as louder')
}

// ============================================================================
section('B - logic: sound state and the preference store')

{
  check(soundDisplayState({ muted: true, engineState: 'running' }) === 'MUTED',
    'B50 - muted wins over a running context')
  check(soundDisplayState({ muted: true, engineState: 'suspended' }) === 'MUTED',
    'B51 - muted wins over a suspended one too')
  check(soundDisplayState({ muted: false, engineState: 'running' }) === 'READY',
    'B52 - READY is claimed only for a running context')
  check(soundDisplayState({ muted: false, engineState: 'suspended' }) === 'BLOCKED',
    'B53 - a suspended context reads BLOCKED')
  check(soundDisplayState({ muted: false, engineState: 'uninitialized' }) === 'BLOCKED',
    'B54 - so does one that has not started')
  check(soundDisplayState({ muted: false, engineState: 'unsupported' }) === 'ERROR',
    'B55 - no Web Audio reads ERROR')
  check(soundDisplayState({ muted: false, engineState: 'closed' }) === 'ERROR',
    'B56 - a closed context reads ERROR')
  check(soundDisplayState({ muted: false, engineState: 'error' }) === 'ERROR',
    'B57 - and so does a failed one')
  check(soundDisplayState({}) === 'BLOCKED',
    'B58 - the safe default is BLOCKED, never READY')
}

{
  const makeStorage = () => {
    const map = new Map()
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      _map: map,
    }
  }

  const storage = makeStorage()
  check(loadAudioPrefs({ storage }).muted === false, 'B59 - an empty storage reads unmuted')
  check(saveAudioPrefs({ muted: true }, { storage }) === true, 'B60 - the preference saves')
  check(loadAudioPrefs({ storage }).muted === true, 'B61 - and round-trips')
  check(storage._map.get(AUDIO_PREF_KEY) === JSON.stringify({ v: 1, muted: true }),
    'B62 - the stored payload is exactly the version and the preference',
    storage._map.get(AUDIO_PREF_KEY))

  const corrupt = makeStorage()
  corrupt.setItem(AUDIO_PREF_KEY, '{not json')
  check(loadAudioPrefs({ storage: corrupt }).muted === false, 'B63 - corrupt JSON reads as the default')
  corrupt.setItem(AUDIO_PREF_KEY, JSON.stringify({ v: 99, muted: true }))
  check(loadAudioPrefs({ storage: corrupt }).muted === false, 'B64 - a foreign schema version is discarded')
  corrupt.setItem(AUDIO_PREF_KEY, JSON.stringify({ v: 1, muted: 'true' }))
  check(loadAudioPrefs({ storage: corrupt }).muted === false, 'B65 - a non-boolean preference is discarded')
  corrupt.setItem(AUDIO_PREF_KEY, JSON.stringify({ v: 1 }))
  check(loadAudioPrefs({ storage: corrupt }).muted === false, 'B66 - a missing preference is discarded')

  const hostile = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  }
  check(loadAudioPrefs({ storage: hostile }).muted === false, 'B67 - a blocked storage never throws on read')
  check(saveAudioPrefs({ muted: true }, { storage: hostile }) === false,
    'B68 - and reports honestly that the write did not land')

  const written = serializeAudioPrefs({ muted: false })
  check(!('alerts' in written) && !('ids' in written) && !('permission' in written),
    'B69 - no alert id, history or permission state is ever stored')
  check(AUDIO_PREF_SCHEMA_VERSION === 1 && createDefaultAudioPrefs().muted === false,
    'B70 - the schema is versioned and the default is unmuted')
}

// --- the engine is safe to import without a DOM -----------------------------
{
  check(getEngineState() === 'uninitialized',
    'B71 - importing the engine in Node touches no browser API', getEngineState())
  const stats = getAudioStats()
  check(stats.contexts === 0 && stats.alertCues === 0 && stats.dangerCues === 0,
    'B72 - and constructs no AudioContext at module scope')
  check(typeof globalThis.__IO2_AUDIO_STATS__ === 'undefined',
    'B73 - outside a Vite build the QA mirror is not created at all')
}

// ============================================================================
section('C - browser checks')

const parsed = JSON.parse(await read('python/data/users.json'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()

// The mocked backend. `phase` is mutated from Node between polls, so a genuinely
// new alert can be made to appear at a chosen moment.
function makeBackend() {
  const state = { mode: 'SAFE', tracks: [], fused: 0 }
  const handler = async (route) => {
    const url = new URL(route.request().url())
    const body = (obj) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(obj),
    })
    if (url.pathname === '/status') {
      return body({
        mode: state.mode,
        status: 'active',
        has_person: state.tracks.length > 0,
        person_count: state.tracks.length,
        has_weapon: false,
        weapon_type: null,
        camera_risk: state.fused,
        radar_risk: 0,
        fused_risk: state.fused,
        max_risk: state.fused,
        tracks: state.tracks,
        last_update: Date.now() / 1000,
      })
    }
    if (url.pathname === '/api/radar/live') {
      return body({
        enabled: true, radar_connected: true, radar_status: 'OK',
        last_update_ms: 80, targets: [], targets_count: 0,
        max_radar_risk: 0, confidence: 0, provider: 'mock-test',
      })
    }
    if (url.pathname === '/api/cameras/status') {
      return body({
        webcam: { connected: true, status: 'active' },
        dahua: { connected: false, status: 'reconnecting' },
      })
    }
    if (url.pathname === '/api/arduino-messages') return body({ messages: [] })
    return route.continue()
  }
  return { state, handler }
}

async function freshPage({ width = 1920, height = 1080, lang = 'en', mocked = false, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(String(e)))
  if (init) await ctx.addInitScript(init)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', admin.username)
  await page.fill('#password', admin.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
  await page.evaluate((l) => localStorage.setItem('atapis-concepts-lang', l), lang)

  let backend = null
  if (mocked) {
    backend = makeBackend()
    // Registered after login so the auth calls above reach the real backend.
    await ctx.route(/\/\/[^/]*:5000\//, backend.handler)
  }
  page.backend = backend
  page.ctx = ctx
  page.ops = async (qs = '?demo=1&phase=approach') => {
    await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
  }
  return page
}

const stats = (page) => page.evaluate(() => window.__IO2_AUDIO_STATS__ || null)
const soundState = (page) => page.$eval('.io2-sound', (e) => e.dataset.io2SoundState).catch(() => null)
/** Click the control until the engine reports a running context (the gesture). */
async function enableSound(page) {
  await page.click('.io2-sound')
  await page.waitForTimeout(500)
  return soundState(page)
}
/** Wait for a cue count to reach `n`, or time out and return what it actually is. */
async function waitForCues(page, key, n, timeout = 6000) {
  const deadline = Date.now() + timeout
  let last = null
  while (Date.now() < deadline) {
    last = await stats(page)
    if (last && last[key] >= n) return last
    await page.waitForTimeout(120)
  }
  return last
}

// --- C1 initialisation is silent in the browser ------------------------------
{
  const page = await freshPage()
  await page.ops()
  const s = await stats(page)
  check(Boolean(s), 'C01 - the dev build exposes the QA counters', JSON.stringify(s))
  check(s && s.alertCues === 0 && s.dangerCues === 0,
    'C02 - opening Demo, with its DANGER fixture, plays nothing')
  check(s && s.contexts === 1, 'C03 - exactly one AudioContext exists after mount under StrictMode',
    `contexts=${s?.contexts}`)
  check((await soundState(page)) === 'BLOCKED',
    'C04 - before any gesture the control says BLOCKED, not READY')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const afterReload = await stats(page)
  check(afterReload && afterReload.alertCues === 0 && afterReload.dangerCues === 0,
    'C05 - a reload with the same alerts on screen is silent')
  check(page.errors.length === 0, 'C06 - no page error', page.errors.join('|'))
  await page.ctx.close()
}

// --- C2 the honest state machine --------------------------------------------
{
  const page = await freshPage()
  await page.ops()
  const before = await stats(page)
  check(before.engineState === 'suspended' || before.engineState === 'running',
    'C07 - the engine reports a real AudioContext state', before.engineState)
  const state = await enableSound(page)
  const after = await stats(page)
  check(state === 'READY' && after.engineState === 'running',
    'C08 - the click is a user gesture and READY follows a verified running context', `${state}/${after.engineState}`)
  check(after.alertCues === 0 && after.dangerCues === 0,
    'C09 - enabling sound does not itself play an alert')

  // The honesty invariant, asserted rather than assumed.
  const honest = await page.evaluate(() => {
    const el = document.querySelector('.io2-sound')
    const s = window.__IO2_AUDIO_STATS__
    return el.dataset.io2SoundState !== 'READY' || s.engineState === 'running'
  })
  check(honest, 'C10 - READY is never displayed while the context is not running')

  await page.click('.io2-sound')
  await page.waitForTimeout(300)
  check((await soundState(page)) === 'MUTED', 'C11 - clicking a ready control mutes it')
  check(await page.$eval('.io2-sound', (e) => e.getAttribute('aria-pressed')) === 'true',
    'C12 - and aria-pressed reports it')
  const stored = await page.evaluate(() => localStorage.getItem('industrial-ops-audio-v1'))
  check(stored === JSON.stringify({ v: 1, muted: true }),
    'C13 - the preference is persisted exactly', String(stored))

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  check((await soundState(page)) === 'MUTED', 'C14 - and it survives a reload')
  await page.ctx.close()
}

// --- C3 a genuinely new live ALERT and DANGER --------------------------------
{
  const page = await freshPage({ mocked: true })
  await page.ops('')
  await enableSound(page)
  const baseline = await stats(page)
  check(baseline.alertCues === 0 && baseline.dangerCues === 0,
    'C15 - the live baseline is silent even though alerts already exist')

  page.backend.state.mode = 'ALERT'
  page.backend.state.fused = 50
  let s = await waitForCues(page, 'alertCues', 1)
  check(s.alertCues === 1 && s.dangerCues === 0,
    'C16 - a new ALERT plays exactly one alert cue', JSON.stringify(s))

  await page.waitForTimeout(2500)
  s = await stats(page)
  check(s.alertCues === 1,
    'C17 - and polling the same alert for another two seconds adds nothing', `alertCues=${s.alertCues}`)

  page.backend.state.mode = 'DANGER'
  page.backend.state.fused = 88
  s = await waitForCues(page, 'dangerCues', 1)
  check(s.dangerCues === 1 && s.alertCues === 1,
    'C18 - the escalation plays one danger cue and no second alert cue', JSON.stringify(s))

  // A filter is a viewing choice and must not silence anything.
  await page.click('.io2-filter-tab >> nth=4').catch(() => {})
  await page.waitForTimeout(400)
  page.backend.state.tracks = [{ id: 9, state: 'running', risk: 40, speed: 30 }]
  s = await waitForCues(page, 'alertCues', 2)
  check(s.alertCues === 2, 'C19 - an alert hidden by the current filter still sounds', JSON.stringify(s))
  check(page.errors.length === 0, 'C20 - no page error across the live scenario', page.errors.join('|'))
  await page.ctx.close()
}

// --- C4 batching -------------------------------------------------------------
{
  const page = await freshPage({ mocked: true })
  await page.ops('')
  await enableSound(page)
  // Mode DANGER and two behaviour tracks arrive in the same poll.
  page.backend.state.mode = 'DANGER'
  page.backend.state.fused = 90
  page.backend.state.tracks = [
    { id: 1, state: 'running', risk: 40, speed: 30 },
    { id: 2, state: 'loitering', risk: 35, speed: 2 },
  ]
  const s = await waitForCues(page, 'dangerCues', 1)
  await page.waitForTimeout(1500)
  const final = await stats(page)
  check(final.dangerCues === 1, 'C21 - a mixed batch plays exactly one danger cue', JSON.stringify(final))
  check(final.alertCues === 0,
    'C22 - and no alert cue at all, because DANGER outranks the batch', `alertCues=${final.alertCues}`)
  check(s.dangerCues === 1, 'C23 - there is no queue draining afterwards')
  await page.ctx.close()
}

// --- C5 mute suppresses, and unmuting replays nothing ------------------------
{
  const page = await freshPage({ mocked: true })
  await page.ops('')
  await enableSound(page)
  await page.click('.io2-sound')
  await page.waitForTimeout(300)
  check((await soundState(page)) === 'MUTED', 'C24 - muted before the event')

  page.backend.state.mode = 'DANGER'
  page.backend.state.fused = 88
  await page.waitForTimeout(3000)
  const muted = await stats(page)
  check(muted.dangerCues === 0 && muted.alertCues === 0,
    'C25 - a new DANGER while muted plays nothing', JSON.stringify(muted))
  const rowVisible = await page.$$eval('[data-io2-alert-row]', (n) => n.length)
  check(rowVisible > 0, 'C26 - but the alert itself is on screen: muting hides nothing', String(rowVisible))

  await page.click('.io2-sound')
  await page.waitForTimeout(1500)
  const unmuted = await stats(page)
  check(unmuted.dangerCues === 0,
    'C27 - unmuting does not replay what was missed', JSON.stringify(unmuted))
  check((await soundState(page)) === 'READY', 'C28 - and the control returns to READY')

  page.backend.state.tracks = [{ id: 4, state: 'approaching', risk: 44, speed: 20 }]
  const after = await waitForCues(page, 'alertCues', 1)
  check(after.alertCues === 1, 'C29 - the next genuinely new alert is heard', JSON.stringify(after))
  await page.ctx.close()
}

// --- C6 a hidden tab makes no sound, and stops the one it is making ----------
{
  const page = await freshPage({ mocked: true })
  await page.ops('')
  await enableSound(page)

  page.backend.state.mode = 'DANGER'
  page.backend.state.fused = 88

  const observed = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    let sawActive = 0
    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      const s = window.__IO2_AUDIO_STATS__
      if (s && s.dangerCues >= 1) {
        sawActive = Math.max(sawActive, s.activeNodes)
        if (s.activeNodes > 0) break
      }
      await wait(25)
    }
    const beforeHide = window.__IO2_AUDIO_STATS__.activeNodes
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    await wait(250)
    return { sawActive, beforeHide, afterHide: window.__IO2_AUDIO_STATS__.activeNodes }
  })
  check(observed.beforeHide > 0, 'C30 - a danger cue really was sounding', `activeNodes=${observed.beforeHide}`)
  check(observed.afterHide === 0,
    'C31 - switching to a hidden tab stops the cue that had already started', `activeNodes=${observed.afterHide}`)

  const beforeHiddenAlert = await stats(page)
  page.backend.state.tracks = [{ id: 11, state: 'running', risk: 40, speed: 30 }]
  await page.waitForTimeout(3000)
  const whileHidden = await stats(page)
  check(whileHidden.alertCues === beforeHiddenAlert.alertCues,
    'C32 - an alert arriving while hidden plays nothing', JSON.stringify(whileHidden))

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(2000)
  const backVisible = await stats(page)
  check(backVisible.alertCues === beforeHiddenAlert.alertCues &&
    backVisible.dangerCues === whileHidden.dangerCues,
    'C33 - returning to the tab replays no backlog', JSON.stringify(backVisible))

  page.backend.state.tracks = [
    { id: 11, state: 'running', risk: 40, speed: 30 },
    { id: 12, state: 'loitering', risk: 35, speed: 1 },
  ]
  const after = await waitForCues(page, 'alertCues', backVisible.alertCues + 1)
  check(after.alertCues === backVisible.alertCues + 1,
    'C34 - and an alert arriving after the return is heard once', JSON.stringify(after))
  await page.ctx.close()
}

// --- C7 leaving and re-entering OPS ------------------------------------------
{
  const page = await freshPage({ mocked: true })
  await page.ops('')
  await enableSound(page)
  page.backend.state.mode = 'ALERT'
  page.backend.state.fused = 50
  const heard = await waitForCues(page, 'alertCues', 1)
  check(heard.alertCues === 1, 'C35 - a cue was heard while OPS was mounted')

  // In-app navigation, not a reload: the module keeps its state.
  await page.click('.io2-rail-nav a[href*="/history"]')
  await page.waitForTimeout(1200)
  const left = await stats(page)
  check(left.activeNodes === 0, 'C36 - leaving OPS leaves nothing sounding', `activeNodes=${left.activeNodes}`)

  page.backend.state.mode = 'DANGER'
  page.backend.state.fused = 92
  page.backend.state.tracks = [{ id: 21, state: 'running', risk: 40, speed: 30 }]
  await page.waitForTimeout(3000)
  const outside = await stats(page)
  check(outside.dangerCues === left.dangerCues && outside.alertCues === left.alertCues,
    'C37 - data arriving while OPS is unmounted plays nothing', JSON.stringify(outside))

  await page.click('.io2-rail-nav a[href*="dashboard"]')
  await page.waitForTimeout(2500)
  const back = await stats(page)
  check(back.contexts === 1, 'C38 - returning to OPS reuses the one AudioContext', `contexts=${back.contexts}`)
  check(back.dangerCues === outside.dangerCues && back.alertCues === outside.alertCues,
    'C39 - and the alerts already on screen are a silent baseline, not a backlog', JSON.stringify(back))

  page.backend.state.tracks = [
    { id: 21, state: 'running', risk: 40, speed: 30 },
    { id: 22, state: 'loitering', risk: 35, speed: 1 },
  ]
  const next = await waitForCues(page, 'alertCues', back.alertCues + 1)
  check(next.alertCues === back.alertCues + 1,
    'C40 - the next genuinely new alert is heard exactly once', JSON.stringify(next))

  for (let i = 0; i < 3; i += 1) {
    await page.click('.io2-rail-nav a[href*="/history"]')
    await page.waitForTimeout(500)
    await page.click('.io2-rail-nav a[href*="dashboard"]')
    await page.waitForTimeout(900)
  }
  const churned = await stats(page)
  check(churned.contexts === 1,
    'C41 - three more round trips still create no second context', `contexts=${churned.contexts}`)
  check(churned.alertCues === next.alertCues && churned.dangerCues === next.dangerCues,
    'C42 - and navigating never plays or duplicates a cue', JSON.stringify(churned))
  check(churned.activeNodes === 0, 'C43 - with no oscillator left running')
  check(page.errors.length === 0, 'C44 - no page error across the navigation churn', page.errors.join('|'))
  await page.ctx.close()
}

// --- C8 a DANGER during a resolve dialog --------------------------------------
{
  const page = await freshPage({ mocked: true })
  await page.ops('')
  await enableSound(page)
  page.backend.state.mode = 'ALERT'
  page.backend.state.fused = 50
  await waitForCues(page, 'alertCues', 1)

  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(400)
  const selectedBefore = await page.$eval('.io2-ab-id', (e) => e.textContent.trim()).catch(() => null)
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  await page.fill('.io2-dialog-note', 'operator still typing')
  const before = await stats(page)

  page.backend.state.mode = 'DANGER'
  page.backend.state.fused = 91
  const during = await waitForCues(page, 'dangerCues', before.dangerCues + 1)
  check(during.dangerCues === before.dangerCues + 1,
    'C45 - a new DANGER during a dialog plays one danger cue', JSON.stringify(during))
  check(await page.isVisible('dialog'), 'C46 - the dialog stays open')
  check(await page.$eval('.io2-dialog-note', (e) => e.value) === 'operator still typing',
    'C47 - the half-written note is untouched')
  const selectedAfter = await page.$eval('.io2-ab-id', (e) => e.textContent.trim()).catch(() => null)
  check(selectedAfter === selectedBefore, 'C48 - the selection does not move', `${selectedBefore} -> ${selectedAfter}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check(!(await page.isVisible('dialog')), 'C49 - and Escape still closes it cleanly')
  await page.ctx.close()
}

// --- C9 sound changes nothing operational ------------------------------------
{
  const page = await freshPage({ mocked: true })
  await page.ops('')
  // LAST RX is a live data-age counter and ticks on its own, so the comparison
  // is scoped to the risk readouts, which are what "sound changes nothing" means.
  const snapshotOf = () => page.evaluate(() => ({
    strip: [...document.querySelectorAll('.io2-strip-cell')]
      .filter((c) => /RISK/.test(c.querySelector('.io2-strip-label')?.textContent || ''))
      .map((c) => c.querySelector('.io2-strip-value')?.textContent.trim())
      .join('|'),
    counts: [...document.querySelectorAll('.io2-filter-tab')].map((e) => e.textContent.trim()).join('|'),
    selected: document.querySelector('.io2-ab-id')?.textContent.trim() || null,
    logRows: document.querySelectorAll('.io2-log-scroll .dm-alert').length,
    rows: document.querySelectorAll('[data-io2-alert-row]').length,
  }))
  await page.click('[data-io2-alert-row] >> nth=0').catch(() => {})
  await page.waitForTimeout(400)
  const before = await snapshotOf()
  await enableSound(page)
  await page.click('.io2-sound')
  await page.waitForTimeout(600)
  await page.click('.io2-sound')
  await page.waitForTimeout(600)
  const after = await snapshotOf()
  check(before.strip === after.strip, 'C50 - toggling sound changes no risk figure')
  check(before.counts === after.counts, 'C51 - and no lifecycle count')
  check(before.selected === after.selected, 'C52 - and not the selection')
  check(before.rows === after.rows, 'C53 - and not the alert list')
  check(before.logRows === after.logRows, 'C54 - and writes nothing to the session log')
  const logText = await page.$eval('.io2-log-scroll', (e) => e.textContent).catch(() => '')
  check(!/MUTE|SOUND|AUDIO/i.test(logText), 'C55 - no mute event appears in the operational log')
  await page.ctx.close()
}

// --- C10 no Web Audio at all --------------------------------------------------
{
  const page = await freshPage({
    init: () => {
      delete window.AudioContext
      delete window.webkitAudioContext
    },
  })
  await page.ops()
  check((await soundState(page)) === 'ERROR',
    'C56 - a browser without Web Audio reports ERROR, honestly')
  const rows = await page.$$eval('[data-io2-alert-row]', (n) => n.length)
  check(rows > 0, 'C57 - and the console still works: alerts render as usual', String(rows))
  await page.click('.io2-sound')
  await page.waitForTimeout(500)
  check((await soundState(page)) === 'ERROR', 'C58 - clicking it does not fake a recovery')
  check(page.errors.length === 0, 'C59 - and nothing throws', page.errors.join('|'))
  await page.ctx.close()
}

// --- C11 layout and accessibility ---------------------------------------------
for (const [w, h] of [[1920, 1080], [1366, 768]]) {
  const page = await freshPage({ width: w, height: h, lang: 'he' })
  await page.ops()
  const m = await page.evaluate(() => {
    const strip = document.querySelector('.io2-strip')
    const btn = document.querySelector('.io2-sound')
    const barEl = document.querySelector('.io2-sel-actions')
    const rows = [...document.querySelectorAll('[data-io2-alert-row]')]
    const scroll = document.querySelector('.io2-alerts-scroll')
    let visible = 0
    if (scroll) {
      const top = scroll.getBoundingClientRect().top
      const bottom = top + scroll.clientHeight
      visible = rows.filter((r) => {
        const b = r.getBoundingClientRect()
        return b.top >= top - 1 && b.bottom <= bottom + 1
      }).length
    }
    const feed = document.querySelector('.io2-vf-body')
    return {
      children: strip.children.length,
      soundInMode: Boolean(document.querySelector('.io2-strip-mode .io2-sound')),
      barHeight: barEl ? Math.round(barEl.getBoundingClientRect().height) : null,
      hOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      visible,
      feedHeight: feed ? Math.round(feed.getBoundingClientRect().height) : null,
      btnFont: btn ? getComputedStyle(btn).fontSize : null,
    }
  })
  const tag = `${w}x${h}`
  check(m.children === 12, `C60 - ${tag}: the strip still has exactly twelve children`, String(m.children))
  check(m.soundInMode, `C61 - ${tag}: the control lives inside the mode cluster`)
  check(m.barHeight >= 44, `C62 - ${tag}: the operator-action region holds its height`, `${m.barHeight}px`)
  check(m.hOverflow === 0, `C63 - ${tag}: no horizontal overflow`, `${m.hOverflow}px`)
  // Re-based by Phase A3.1.1 (§27): the alerts panel narrowed from 4/12 to 3/12
  // so the feed could have its width back, and the rows wrap rather than shrink.
  // The floor is 3 at both resolutions; there is no ceiling, because more legible
  // rows was never the thing anyone needed protecting from.
  check(m.visible >= 3,
    `C64 - ${tag}: at least three alerts stay visible`, `${m.visible}`)
  check(parseFloat(m.btnFont) >= 10.5, `C65 - ${tag}: the control uses readable type`, m.btnFont)

  // Reachable by keyboard, with a real focus ring.
  const kb = await page.evaluate(() => {
    const btn = document.querySelector('.io2-sound')
    btn.focus()
    return {
      focused: document.activeElement === btn,
      outline: getComputedStyle(btn, ':focus-visible').outlineWidth,
      name: btn.getAttribute('aria-label'),
    }
  })
  check(kb.focused, `C66 - ${tag}: the control takes keyboard focus`)
  check(Boolean(kb.name && kb.name.length > 3), `C67 - ${tag}: it has an accessible name`, kb.name)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  check(['READY', 'MUTED', 'BLOCKED', 'ERROR'].includes(await soundState(page)),
    `C68 - ${tag}: Enter operates it`)
  await page.ctx.close()
}

// --- C12 dialogs and the menu still add no document height -------------------
{
  const page = await freshPage()
  await page.ops()
  const h0 = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(300)
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(500)
  const h1 = await page.evaluate(() => document.documentElement.scrollHeight)
  check(h1 === h0, 'C69 - an open dialog still adds no document height', `${h0} -> ${h1}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Selecting a row is itself allowed to change the page height (the decision
  // block re-renders), so the menu is measured against an already-selected row.
  await page.click('[data-io2-alert-row] >> nth=1')
  await page.waitForTimeout(400)
  const hSelected = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.click('[data-io2-alert-row] >> nth=1', { button: 'right' })
  await page.waitForTimeout(400)
  const h2 = await page.evaluate(() => document.documentElement.scrollHeight)
  check(h2 === hSelected, 'C70 - and neither does the context menu', `${hSelected} -> ${h2}`)
  await page.keyboard.press('Escape')
  await page.ctx.close()
}

// ============================================================================
section('D - production build: the QA global must not ship')

{
  // The counters are a development affordance. A production bundle must not
  // contain them at all — not an empty object, not a disabled one.
  execSync('npm run build', { cwd: root, stdio: 'ignore' })
  const assets = path.join(root, 'dist', 'assets')
  const files = (await readdir(assets)).filter((f) => f.endsWith('.js'))
  let hits = []
  for (const file of files) {
    const src = await readFile(path.join(assets, file), 'utf-8')
    if (src.includes('__IO2_AUDIO_STATS__')) hits.push(file)
  }
  check(files.length > 0 && hits.length === 0,
    'D01 - the built bundle contains no reference to the QA global at all',
    hits.length ? hits.join(',') : `${files.length} chunks scanned`)

  const preview = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--port', '4173', '--strictPort'],
    { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' })

  const previewBase = 'http://localhost:4173'
  let up = false
  for (let i = 0; i < 40 && !up; i += 1) {
    try {
      const res = await fetch(previewBase)
      up = res.ok
    } catch { await new Promise((r) => setTimeout(r, 500)) }
  }
  check(up, 'D02 - the production preview server is serving the built app')

  if (up) {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${previewBase}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#username', admin.username)
    await page.fill('#password', admin.password)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
      page.click('button[type="submit"]'),
    ])
    await page.goto(`${previewBase}/concepts/industrial/dashboard?demo=1&phase=approach`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)

    const prod = await page.evaluate(() => ({
      statsType: typeof window.__IO2_AUDIO_STATS__,
      hasControl: Boolean(document.querySelector('.io2-sound')),
      state: document.querySelector('.io2-sound')?.dataset.io2SoundState || null,
      stripChildren: document.querySelector('.io2-strip')?.children.length ?? null,
    }))
    check(prod.hasControl, 'D03 - the sound control renders in the production build', String(prod.state))
    check(prod.statsType === 'undefined',
      'D04 - and window.__IO2_AUDIO_STATS__ does not exist there', prod.statsType)
    check(prod.stripChildren === 12, 'D05 - the production strip has the same twelve children',
      String(prod.stripChildren))
    await page.click('.io2-sound')
    await page.waitForTimeout(500)
    const afterClick = await page.evaluate(() => ({
      statsType: typeof window.__IO2_AUDIO_STATS__,
      state: document.querySelector('.io2-sound')?.dataset.io2SoundState,
    }))
    check(afterClick.state === 'READY',
      'D06 - the control still works there without any instrumentation', String(afterClick.state))
    check(afterClick.statsType === 'undefined',
      'D07 - and using it does not conjure the global into existence', afterClick.statsType)
    check(errors.length === 0, 'D08 - no page error in the production build', errors.join('|'))
    await ctx.close()
  }

  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' })
    else preview.kill('SIGTERM')
  } catch {
    preview.kill('SIGKILL')
  }
}

await browser.close()

// ============================================================================
console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}  --  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
