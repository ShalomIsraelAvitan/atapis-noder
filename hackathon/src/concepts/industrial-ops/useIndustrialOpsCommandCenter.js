// Industrial Ops — command-centre orchestration (Phase A1).
//
// The single place that turns the live snapshot into everything the OPS screen
// renders. `IndustrialDashboard.jsx` stays a view: it composes panels and passes
// props, it does not derive state.
//
// What this layer refuses to do, because A0 already decided it and a second
// opinion in the UI is how honest data turns into a lie:
//   - it never recomputes selection rules, area severity or lifecycle counts;
//   - it never attaches a camera id to an alert (the backend does not report
//     one), and the camera the operator happens to be watching is a DISPLAY
//     choice that never travels into `sourceId`;
//   - it never groups a camera alert with a radar alert. Same area is context,
//     not association.

import { useCallback, useMemo, useState } from 'react'
import { radarIdForArea, resolveAreaIdForSource, SOURCE_TYPES } from './areas.js'
import { SOURCE_STATES, radarLinkState } from './alerts.js'
import {
  LIFECYCLE_FILTERS,
  areaOperationalSummary,
  blockingFilterAxes,
  legalActionsFor,
  operationalAlerts,
  opticalContextFor,
  sortAreasOperational,
  unblockFilterPatch,
} from './alertSelectors.js'
import { useAlertSelection, useIndustrialAlerts } from './useAlertSelection.js'
import { useDocumentVisible } from './useDocumentVisible.js'
import { demoAlertFixture } from './demoAlerts.js'

export const VISUAL_TABS = { CAMERA: 'camera', ALL: 'all', RADAR: 'radar' }

// Health of one declared camera, resolved through the declared source key.
// A key that is not a real adapter source (demo areas use 'mock') reports MOCK
// rather than borrowing a real camera's status.
function cameraHealth(camera, snapshot) {
  const source = snapshot?.cameras?.[camera.sourceKey]
  if (!source) {
    // A demo area's camera is synthetic. It is usable (the demo feed renders)
    // but it reports MOCK, and MOCK is styled grey rather than green so it can
    // never be mistaken for a working sensor.
    const mock = camera.sourceKey === 'mock'
    return {
      ...camera,
      connected: mock,
      state: mock ? 'MOCK' : SOURCE_STATES.UNKNOWN,
      status: mock ? 'mock' : 'unknown',
      lastError: null,
      lastFrameTime: null,
      isReal: false,
    }
  }
  return {
    ...camera,
    connected: Boolean(source.connected),
    state: source.connected ? SOURCE_STATES.LIVE : SOURCE_STATES.DISCONNECTED,
    status: source.status || 'unknown',
    lastError: source.lastError || null,
    lastFrameTime: source.lastFrameTime || source.lastUpdate || null,
    isReal: true,
  }
}

function radarHealth(radar, snapshot) {
  if (radar.sourceKey === 'mock') {
    return { ...radar, state: 'MOCK', connected: true, lastError: null, isReal: false }
  }
  const state = radarLinkState(snapshot?.radar)
  return {
    ...radar,
    state,
    connected: state === SOURCE_STATES.LIVE || state === SOURCE_STATES.STALE,
    lastError: snapshot?.radar?.lastError || null,
    isReal: true,
  }
}

/**
 * Which camera to SHOW. Display only — see the module header.
 *   1. the operator's previous choice, if still valid in this area
 *   2. the first connected camera, in declared mapping order
 *   3. the first declared camera (rendered with CAMERA UNAVAILABLE)
 *   4. none
 */
export function pickDisplayCamera(cameras, lastSelectedCameraId) {
  if (!cameras.length) return null
  const remembered = cameras.find((c) => c.id === lastSelectedCameraId)
  if (remembered) return remembered
  return cameras.find((c) => c.connected) || cameras[0]
}

// Risk reasons that belong to the selected alert's own contact. Reason keys are
// `<kind>-<id>` (whyThisRisk.js), so a track id or target id can be matched
// exactly — and a camera reason is never offered for a radar alert.
function focusReasons(reasons, alert) {
  const all = Array.isArray(reasons) ? reasons : []
  if (!alert) return { rows: all, areaContext: true }

  if (alert.sourceType === SOURCE_TYPES.CAMERA && alert.trackId !== null && alert.trackId !== undefined) {
    const rows = all.filter((r) => r.source === 'camera' && String(r.key).endsWith(`-${alert.trackId}`))
    if (rows.length) return { rows, areaContext: false }
  }
  if (alert.sourceType === SOURCE_TYPES.RADAR && alert.targetId !== null && alert.targetId !== undefined) {
    const rows = all.filter((r) => r.source === 'radar' && String(r.key).endsWith(`-${alert.targetId}`))
    if (rows.length) return { rows, areaContext: false }
  }
  // Not enough in the data to tie factors to this contact: show the area's
  // factors, labelled as context rather than as this alert's cause.
  return { rows: all, areaContext: true }
}

/**
 * Splits the session feed by area WITHOUT inventing a mapping.
 *
 * The session feed (useAtapisData) carries a coarse `source` and no area. Camera,
 * radar and system events resolve through the declared topology; controller
 * messages do not map to anything, so they are kept aside as unassigned instead
 * of being quietly filed under AREA-01.
 *
 * An entry that already carries an `areaId` keeps it. That is only ever the case
 * for operator actions (Phase A2), which take the area from the alert they were
 * performed on — a value read out of the declared model, not inferred from a
 * source type. Nothing here ever writes an areaId onto an entry that lacks one.
 */
export function splitSessionLog(sessionAlerts, areas, selectedAreaId) {
  const list = Array.isArray(sessionAlerts) ? sessionAlerts : []
  const inArea = []
  const unassigned = []
  for (const entry of list) {
    const source = entry.source === 'controller' ? null : entry.source || 'system'
    const areaId = entry.areaId
      || (source ? resolveAreaIdForSource(areas, { sourceType: source }) : null)
    if (!areaId) unassigned.push(entry)
    else if (areaId === selectedAreaId) inArea.push(entry)
  }
  return { inArea, unassigned }
}

/**
 * @param vm       dashboard view model (snapshot, alerts, isDemo, reasons, ...)
 * @param operator { id, name } for session-local ownership display only
 */
export function useIndustrialOpsCommandCenter(vm, { operator = null } = {}) {
  const isDemo = Boolean(vm.isDemo)
  const snapshot = vm.snapshot

  // A0 owns the alert state, the storage round trip and the lifecycle rules.
  //
  // In DEMO the snapshot is deliberately NOT fed to the engine. A demo
  // deployment declares several areas, and `resolveAreaIdForSource` refuses to
  // pick one for a source that maps to none — correctly, because guessing an
  // area is exactly the kind of invention this project forbids. Instead the A0
  // fixture SEEDS the engine's state for a brand-new demo session: it is
  // authored with real area ids, every severity and every lifecycle, and is
  // marked isDemo throughout.
  //
  // Phase A2 note: the fixture is an initial state, not a render-time source.
  // It is read once, when there is no stored demo session to restore, so an
  // operator's acknowledgements survive a reload instead of being overwritten
  // on the next render. Both modes now render the engine's alerts.
  const engine = useIndustrialAlerts({
    snapshot: isDemo ? null : snapshot,
    isDemo,
    operator,
    seed: isDemo ? demoAlertFixture : null,
  })
  const { areas, filters, selection, setFilters, resetFilters, setSelection } = engine

  const alerts = engine.alerts

  const selectionApi = useAlertSelection({ alerts, areas, selection, setSelection, filters })
  const { selectedAlert, visibleAlerts, counts, unseenDanger } = selectionApi
  const selectedAreaId = selectionApi.selection.selectedAreaId

  // Display tab is a view preference, not part of the alert state.
  const [visualTab, setVisualTab] = useState(VISUAL_TABS.CAMERA)
  const documentVisible = useDocumentVisible()

  const deployment = useMemo(() => ({
    isSingleArea: !isDemo && areas.length === 1,
    areaCount: areas.length,
  }), [areas, isDemo])

  // --- area rows with sensor health ----------------------------------------
  const areaRows = useMemo(() => {
    const sorted = sortAreasOperational(areas, alerts)
    return sorted.map((row) => ({
      ...row,
      cameras: row.area.cameras.map((cam) => cameraHealth(cam, snapshot)),
      radars: row.area.radars.map((rdr) => radarHealth(rdr, snapshot)),
    }))
  }, [areas, alerts, snapshot])

  const selectedAreaRow = useMemo(
    () => areaRows.find((row) => row.areaId === selectedAreaId) || null,
    [areaRows, selectedAreaId]
  )

  const selectedArea = selectedAreaRow ? selectedAreaRow.area : null

  // --- visual feed ----------------------------------------------------------
  const areaCameras = useMemo(
    () => (selectedAreaRow ? selectedAreaRow.cameras : []),
    [selectedAreaRow]
  )
  const displayCamera = useMemo(
    () => pickDisplayCamera(areaCameras, selection.lastSelectedCameraId),
    [areaCameras, selection.lastSelectedCameraId]
  )

  // The alert never names a camera, so whatever is on screen is explicitly a
  // display fallback. This flag drives that label; it is not stored anywhere.
  const displayIsFallback = Boolean(
    displayCamera && selectedAlert && selectedAlert.sourceType === SOURCE_TYPES.CAMERA &&
    selectedAlert.cameraSourceKnown === false
  )

  const cameraFeedMounted = visualTab === VISUAL_TABS.CAMERA && documentVisible && Boolean(displayCamera)

  const radarState = useMemo(() => radarLinkState(snapshot?.radar), [snapshot])
  const areaRadarId = useMemo(() => radarIdForArea(areas, selectedAreaId), [areas, selectedAreaId])

  // --- focused panel content ------------------------------------------------
  const focusedReasons = useMemo(() => focusReasons(vm.reasons, selectedAlert), [vm.reasons, selectedAlert])

  const sessionLog = useMemo(
    () => splitSessionLog(vm.alerts, areas, selectedAreaId),
    [vm.alerts, areas, selectedAreaId]
  )

  const activeInArea = useMemo(
    () => operationalAlerts(alerts).filter((a) => a.areaId === selectedAreaId),
    [alerts, selectedAreaId]
  )

  // Other open evidence in the same area. Context only — never a claim that any
  // of it describes the same event as the selected alert.
  const otherEvidence = useMemo(() => {
    if (!selectedAlert) return []
    return activeInArea.filter((a) => a.id !== selectedAlert.id)
  }, [activeInArea, selectedAlert])

  const hasActiveAlerts = useMemo(() => operationalAlerts(alerts).length > 0, [alerts])

  // --- operator workflow (Phase A2) ------------------------------------------
  const legalActions = useMemo(() => legalActionsFor(selectedAlert), [selectedAlert])

  // May this alert open the optical station, and with what (Phase A3.2 §32)?
  //
  // Note what is NOT passed in: `displayCamera`. The camera on screen is a
  // display choice this module makes a few lines above, and §33 forbids it from
  // ever becoming an alert's source. Keeping it out of the argument list means it
  // cannot become one by accident later either.
  const opticalContext = useMemo(
    () => opticalContextFor(selectedAlert, { areas }),
    [selectedAlert, areas]
  )

  // An operator's own action can push the alert they are working on out of the
  // list — resolving it under ALL OPEN, for instance. The selection deliberately
  // stays put (A0's resolveSelection looks the id up in the whole model, not in
  // the filtered view), so the screen has to say why it vanished instead of
  // letting the operator think it was lost.
  const selectedOutsideFilter = useMemo(
    () => Boolean(selectedAlert) && !visibleAlerts.some((a) => a.id === selectedAlert.id),
    [selectedAlert, visibleAlerts]
  )

  const blockingAxes = useMemo(
    () => (selectedOutsideFilter ? blockingFilterAxes(selectedAlert, filters, { areas }) : []),
    [selectedOutsideFilter, selectedAlert, filters, areas]
  )

  // --- actions --------------------------------------------------------------
  const selectCamera = useCallback((cameraId) => {
    selectionApi.setLastSelectedCamera(cameraId)
    setVisualTab(VISUAL_TABS.CAMERA)
  }, [selectionApi])

  const openRadarTab = useCallback(() => setVisualTab(VISUAL_TABS.RADAR), [])

  const setSearch = useCallback((query) => setFilters({ query }), [setFilters])

  // Lifts ONLY the axes hiding the selected alert. Never a reset-all: the
  // operator set those other filters on purpose.
  const unblockFilters = useCallback(() => {
    if (!selectedAlert) return
    setFilters(unblockFilterPatch(selectedAlert, filters, { areas }))
  }, [selectedAlert, filters, areas, setFilters])

  return {
    // state
    areas,
    areaRows,
    selectedArea,
    selectedAreaRow,
    selectedAreaId,
    alerts,
    visibleAlerts,
    counts,
    filters,
    selectedAlert,
    unseenDanger,
    deployment,
    isDemo,

    // visual feed
    visualTab,
    setVisualTab,
    areaCameras,
    displayCamera,
    displayIsFallback,
    cameraFeedMounted,
    documentVisible,
    radarState,
    areaRadarId,

    // panel content
    focusedReasons,
    sessionLog,
    otherEvidence,
    hasActiveAlerts,

    // selection and filtering
    selectAlert: selectionApi.selectAlert,
    selectArea: selectionApi.selectArea,
    selectCamera,
    openRadarTab,
    goToUnseenDanger: selectionApi.goToUnseenDanger,
    setFilters,
    setSearch,
    resetFilters,
    unblockFilters,
    lifecycleFilters: LIFECYCLE_FILTERS,

    // Lifecycle actions (Phase A2). Straight from the engine, which is the only
    // place the transition rules live — no view may reimplement them.
    acknowledge: engine.acknowledge,
    startReview: engine.startReview,
    resolve: engine.resolve,
    reopen: engine.reopen,
    // Phase A3.2 §55. Edits the note on a RESOLVED alert only; the engine
    // refuses anything else and never moves the lifecycle.
    editNote: engine.editNote,
    legalActions,
    opticalContext,
    selectedOutsideFilter,
    blockingAxes,

    // Session-local throughout. Any UI built on this must say so.
    sessionLocal: true,
    persisted: false,
  }
}

export { areaOperationalSummary }
