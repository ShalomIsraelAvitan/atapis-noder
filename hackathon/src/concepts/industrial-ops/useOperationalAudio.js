// Industrial Ops — wiring the alert stream to the sound engine (Phase A3).
//
// Everything hard already lives elsewhere: audioCuePlanner.js decides whether a
// cue is owed, operationalSoundEngine.js decides how to make it. This hook is
// the thin, boring layer that connects them to React, and it is deliberately the
// ONLY place in the app where a cue can start.
//
// Audio is output. Nothing here writes to an alert, a lifecycle, a selection or
// a risk figure, and no decision anywhere in the console reads back from it.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { CUE, createAudioBook, planAudioCues, soundDisplayState } from './audioCuePlanner.js'
import { loadAudioPrefs, saveAudioPrefs } from './audioPrefs.js'
import {
  getEngineState,
  initAudioEngine,
  playAlertCue,
  playDangerCue,
  resumeAudio,
  stopAllCues,
  subscribeEngineState,
} from './operationalSoundEngine.js'

/**
 * @param {object}  input
 * @param {Array}   input.alerts           the FULL canonical list (never the filtered view —
 *                                          a filter is a viewing preference and must not
 *                                          silence a real alert)
 * @param {boolean} input.isDemo
 * @param {boolean} input.documentVisible
 * @param {number|null} input.dataStamp  the data layer's own "the backend actually
 *                                        answered" marker (vm.link.lastSuccessAt)
 */
export function useOperationalAudio({ alerts, isDemo, documentVisible, dataStamp } = {}) {
  // Bookkeeping lives in a ref: no render depends on it, and it must survive
  // re-renders without causing them. Because it is per hook instance, leaving
  // OPS and coming back starts from a fresh book — which is precisely the
  // "returning establishes a new silent baseline" rule, for free.
  const bookRef = useRef(createAudioBook())

  // Audio stays disarmed until the console actually knows the state of the
  // world. On mount the data layer hands out an empty snapshot and only fills it
  // a poll later, so an incident that was already running while the operator was
  // on another screen would otherwise be folded in afterwards and read as new.
  // Until the backend has genuinely answered, every pass is a baseline.
  const armedRef = useRef(false)
  const settledStampRef = useRef(null)

  const [muted, setMuted] = useState(() => loadAudioPrefs().muted)

  // The engine is an external store, so it is read as one. Subscribing (rather
  // than polling, or mirroring into state from an effect) is what keeps the
  // displayed status true when the browser suspends the context on its own, and
  // it is the pattern React 19 tears down and re-runs safely under StrictMode.
  const subscribe = useCallback((onChange) => {
    initAudioEngine()
    return subscribeEngineState(onChange)
  }, [])
  const engineState = useSyncExternalStore(subscribe, getEngineState, getEngineState)

  // Leaving OPS must leave nothing sounding. The context itself stays alive but
  // passive — closing it here would destroy what StrictMode's immediate remount
  // is about to need, and would cost a fresh context on every visit.
  useEffect(() => () => stopAllCues(), [])

  // Detection. The only path to a cue.
  useEffect(() => {
    const disarmed = !armedRef.current
    // While disarmed the book is rebuilt from scratch every pass, so whatever is
    // on screen keeps counting as "already there" rather than as an arrival.
    const { cue, nextBook } = planAudioCues(
      disarmed ? null : bookRef.current,
      alerts,
      { mode: isDemo ? 'demo' : 'live' },
    )
    bookRef.current = nextBook

    if (disarmed) {
      if (isDemo) {
        // Demo has no transport to wait for: its seed is the whole world.
        armedRef.current = true
      } else if (dataStamp) {
        // Two passes on the same answer, not one. The alert list is folded in a
        // later commit than the snapshot that produced it, so arming on the
        // first pass would arm while still holding the previous list — and the
        // incident that was already running would then arrive as news.
        if (settledStampRef.current === dataStamp) armedRef.current = true
        else settledStampRef.current = dataStamp
      }
      return
    }

    if (!cue) return
    // Absorbed above, played (or not) here. Running the planner unconditionally
    // is what prevents a backlog: alerts that arrive while hidden or muted are
    // accounted for as they happen, so unhiding or unmuting cannot replay them.
    if (!documentVisible || muted) return

    if (cue === CUE.DANGER) playDangerCue()
    else playAlertCue()
  }, [alerts, isDemo, documentVisible, muted, dataStamp])

  // A hidden tab means no audio output at all — not merely no new audio. A
  // DANGER cue that started a moment before the operator switched away is cut
  // off rather than played to an empty room.
  useEffect(() => {
    if (!documentVisible) stopAllCues()
  }, [documentVisible])

  useEffect(() => {
    saveAudioPrefs({ muted })
  }, [muted])

  // The click is the user gesture, and the only moment a resume can succeed.
  const toggle = useCallback(() => {
    if (muted) {
      setMuted(false)
      // Fire-and-forget: resumeAudio never rejects, and the resulting state
      // arrives through the subscription rather than being assumed here.
      resumeAudio()
      return
    }
    if (getEngineState() === 'running') {
      setMuted(true)
      stopAllCues()
      return
    }
    // Not muted and not running: the control is an ENABLE button, and pressing
    // it retries for real instead of relabelling a blocked context as ready.
    resumeAudio()
  }, [muted])

  return {
    soundState: soundDisplayState({ muted, engineState }),
    muted,
    toggle,
  }
}
