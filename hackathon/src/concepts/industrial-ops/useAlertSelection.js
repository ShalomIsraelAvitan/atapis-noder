// Industrial Ops — React bindings for the local alert workflow (Phase A0).
//
// Deliberately thin. Every rule lives in alerts.js / alertSelectors.js as pure
// functions so it can be proven in Node; this file only wires them to React
// state, the snapshot stream and sessionStorage.
//
// NOT WIRED INTO ANY VIEW IN PHASE A0. Nothing imports these hooks yet, which is
// what guarantees the approved OPS baseline cannot shift. Phase A1 consumes them.
//
// Two hooks share this file because they are one workflow: the selection rules
// only make sense against the alert list the engine produces, and splitting them
// would mean a second module that cannot be used on its own.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAreas } from './areas.js'
import { createInitialAlertState, reduceAlerts, applyLifecycleAction } from './alerts.js'
import {
  DEFAULT_FILTERS,
  computeUnseenDanger,
  lifecycleCounts,
  markDangerSeen,
  resolveSelection,
  sortAreas,
  visibleAlerts,
} from './alertSelectors.js'
import { createInitialPersistedState, loadState, saveState } from './alertStorage.js'

const INITIAL_SELECTION = {
  selectedAreaId: null,
  selectedAlertId: null,
  lastSelectedCameraId: null,
  seenDangerIds: [],
}

/**
 * The one canonical state shape.
 *
 * Every path into state goes through here — a fresh session, a restored one,
 * and a demo session seeded from the fixture — so a seeded state and a restored
 * state are the same object shape by construction rather than by inspection.
 *
 * @param persisted  a persisted-shaped payload ({ alerts, selection, filters })
 *                   or null for an empty session
 */
export function canonicalAlertState(isDemo, persisted = null) {
  const base = createInitialPersistedState()
  return {
    ...createInitialAlertState(),
    // The mode travels inside the state, so a live/demo switch can be detected
    // by comparing it with the current prop.
    isDemo: Boolean(isDemo),
    alerts: persisted?.alerts || base.alerts,
    selection: { ...INITIAL_SELECTION, ...(persisted?.selection || {}) },
    filters: { ...DEFAULT_FILTERS, ...(persisted?.filters || {}) },
  }
}

/**
 * Restore this mode's session, or start a new one.
 *
 * `seed` supplies the alerts a BRAND NEW session of this mode starts from — the
 * demo fixture. It is consulted only when there is nothing to restore, so it is
 * an initial state and never an overwrite: once an operator has acted, the
 * stored session wins and the fixture is not consulted again in this tab.
 */
function initialStateFor(isDemo, storageKey, seed = null) {
  const restored = loadState({ isDemo, ...(storageKey ? { key: storageKey } : {}) })
  if (restored) return canonicalAlertState(isDemo, restored)
  const seededAlerts = typeof seed === 'function' ? seed() : seed
  return canonicalAlertState(isDemo, Array.isArray(seededAlerts) ? { alerts: seededAlerts } : null)
}

/**
 * Owns the alert state: folds each snapshot through the engine, keeps the
 * session copy in sessionStorage, and exposes the lifecycle actions.
 *
 * @param snapshot  adapted snapshot (vm.snapshot)
 * @param isDemo    demo session; demo and live state never share storage
 * @param operator  { id, name } from the session, for local ownership only
 * @param seed      alerts a brand-new session of this mode starts from
 */
export function useIndustrialAlerts({
  snapshot, isDemo = false, operator = null, storageKey = null, seed = null,
} = {}) {
  const areas = useMemo(() => getAreas({ isDemo }), [isDemo])
  const [state, setState] = useState(() => initialStateFor(isDemo, storageKey, seed))

  // A live/demo flip resets the session DURING RENDER, not in an effect.
  //
  // This is not a style choice. The persistence effect below writes `state`
  // under the current `isDemo`; if the reset ran in an effect there would be one
  // committed render where the previous mode's alerts are live in state while
  // `isDemo` already describes the new mode, and that render would persist live
  // alerts into demo storage (or the reverse). Adjusting during render means no
  // commit — and therefore no effect — ever observes the mixed pair.
  //
  // React re-runs this component immediately and discards the render below, so
  // this settles in one extra pass and cannot loop: after the update the stored
  // mode equals the prop. The demo seed is a cached module singleton, so the
  // double invocation React performs in StrictMode cannot seed twice.
  if (state.isDemo !== Boolean(isDemo)) {
    setState(initialStateFor(isDemo, storageKey, seed))
  }

  // `firstSnapshot` marks alerts opened from a condition that was already true
  // when the screen opened — we know when we first saw it, not when it started.
  // It is per-mode: the first live snapshot after a flip is a fresh start.
  const firstSnapshotRef = useRef({ mode: Boolean(isDemo), first: true })
  useEffect(() => {
    if (!snapshot) return
    if (firstSnapshotRef.current.mode !== Boolean(isDemo)) {
      firstSnapshotRef.current = { mode: Boolean(isDemo), first: true }
    }
    const wasFirst = firstSnapshotRef.current.first
    firstSnapshotRef.current = { mode: Boolean(isDemo), first: false }
    setState((prev) => {
      // The render-phase reset above has already run by the time any snapshot
      // lands, so `prev` is always this mode's state. The guard stays as a
      // belt-and-braces against a future path that skips it.
      const modeChanged = prev.isDemo !== Boolean(isDemo)
      const base = modeChanged ? initialStateFor(isDemo, storageKey, seed) : prev
      return reduceAlerts(base, snapshot, {
        now: Date.now(),
        areas,
        isDemo,
        isFirstSnapshot: wasFirst || modeChanged,
      })
    })
  }, [snapshot, areas, isDemo, storageKey, seed])

  useEffect(() => {
    saveState(state, { isDemo, ...(storageKey ? { key: storageKey } : {}) })
  }, [state, isDemo, storageKey])

  const setFilters = useCallback((patch) => {
    setState((prev) => ({ ...prev, filters: { ...prev.filters, ...patch } }))
  }, [])

  const resetFilters = useCallback(() => {
    setState((prev) => ({ ...prev, filters: { ...DEFAULT_FILTERS } }))
  }, [])

  const setSelection = useCallback((patch) => {
    setState((prev) => ({ ...prev, selection: { ...prev.selection, ...patch } }))
  }, [])

  // All four lifecycle actions go through one path so every one of them is
  // logged and none can skip the transition rules.
  const runAction = useCallback((alertId, action, extra = {}) => {
    setState((prev) => applyLifecycleAction(prev, alertId, action, {
      now: Date.now(),
      operator,
      ...extra,
    }))
  }, [operator])

  return {
    areas,
    alerts: state.alerts,
    filters: state.filters,
    selection: state.selection,
    setFilters,
    resetFilters,
    setSelection,
    acknowledge: useCallback((id) => runAction(id, 'acknowledge'), [runAction]),
    startReview: useCallback((id) => runAction(id, 'review'), [runAction]),
    resolve: useCallback((id, reason, note = null) => runAction(id, 'resolve', { reason, note }), [runAction]),
    reopen: useCallback((id) => runAction(id, 'reopen'), [runAction]),
    // Phase A3.2. Same dispatcher, so the edit is timestamped, attributed and
    // logged exactly like the four lifecycle actions, and the persistence effect
    // above writes it to sessionStorage with everything else.
    editNote: useCallback((id, note = null) => runAction(id, 'edit_note', { note }), [runAction]),
    // Session-local, never a server write. Any UI built on this must say so.
    persisted: false,
    sessionLocal: true,
  }
}

/**
 * Selection over an alert list.
 *
 * The two behaviours worth stating out loud:
 *  - a new DANGER never moves the selection; it raises `unseenDanger` and the
 *    operator decides;
 *  - a resolved alert the operator is looking at stays selected.
 */
export function useAlertSelection({ alerts, areas, selection, setSelection, filters }) {
  const resolved = useMemo(
    () => resolveSelection(alerts, selection, { areas }),
    [alerts, selection, areas]
  )

  // Keep persisted selection in step with what is actually shown, without
  // fighting the operator's explicit choice.
  useEffect(() => {
    if (resolved.selectedAlertId === selection.selectedAlertId &&
        resolved.selectedAreaId === selection.selectedAreaId) return
    setSelection({
      selectedAlertId: resolved.selectedAlertId,
      selectedAreaId: resolved.selectedAreaId,
    })
  }, [resolved, selection.selectedAlertId, selection.selectedAreaId, setSelection])

  const selectedAlert = useMemo(
    () => alerts.find((alert) => alert.id === resolved.selectedAlertId) || null,
    [alerts, resolved.selectedAlertId]
  )

  const unseenDanger = useMemo(() => computeUnseenDanger(alerts, resolved), [alerts, resolved])

  const selectAlert = useCallback((alertId) => {
    const alert = alerts.find((a) => a.id === alertId) || null
    setSelection({
      selectedAlertId: alertId,
      ...(alert ? { selectedAreaId: alert.areaId } : {}),
      ...(markDangerSeen({ seenDangerIds: selection.seenDangerIds }, alertId)),
    })
  }, [alerts, setSelection, selection.seenDangerIds])

  const selectArea = useCallback((areaId) => {
    setSelection({ selectedAreaId: areaId })
  }, [setSelection])

  // A UI preference: which camera tab the operator last looked at in this area.
  // It is never treated as the source of an alert.
  const setLastSelectedCamera = useCallback((cameraId) => {
    setSelection({ lastSelectedCameraId: cameraId })
  }, [setSelection])

  const goToUnseenDanger = useCallback(() => {
    if (!unseenDanger.unseenDangerAlertId) return
    selectAlert(unseenDanger.unseenDangerAlertId)
  }, [unseenDanger.unseenDangerAlertId, selectAlert])

  const list = useMemo(() => visibleAlerts(alerts, filters, { areas }), [alerts, filters, areas])
  const counts = useMemo(() => lifecycleCounts(alerts, filters, { areas }), [alerts, filters, areas])
  const areaRows = useMemo(() => sortAreas(areas, alerts), [areas, alerts])

  return {
    selection: resolved,
    selectedAlert,
    selectAlert,
    selectArea,
    setLastSelectedCamera,
    unseenDanger,
    goToUnseenDanger,
    visibleAlerts: list,
    counts,
    areaRows,
  }
}
