// Industrial Ops — pure selectors for alerts, areas, filters and selection.
//
// Everything here is a pure function so the whole operational ruleset can be
// proven in Node (scripts/phase-a0-alerts-verify.mjs) without a browser, a
// backend or a rendered component. The React hook is a thin wrapper over these.

import { LIFECYCLE, ACTIVE_LIFECYCLES, SEVERITY, SOURCE_TYPES } from './alerts.js'
import { areaName } from './areas.js'

export const LIFECYCLE_FILTERS = {
  ALL_ACTIVE: 'ALL_ACTIVE',
  NEW: LIFECYCLE.NEW,
  ACKNOWLEDGED: LIFECYCLE.ACKNOWLEDGED,
  IN_REVIEW: LIFECYCLE.IN_REVIEW,
  RESOLVED: LIFECYCLE.RESOLVED,
  ALL: 'ALL',
}

export const SEVERITY_RANK = { [SEVERITY.DANGER]: 3, [SEVERITY.ALERT]: 2, [SEVERITY.INFO]: 1 }

// NEW sorts above ACKNOWLEDGED above IN_REVIEW: an untouched alert outranks one
// somebody is already handling.
export const LIFECYCLE_RANK = {
  [LIFECYCLE.NEW]: 0,
  [LIFECYCLE.ACKNOWLEDGED]: 1,
  [LIFECYCLE.IN_REVIEW]: 2,
  [LIFECYCLE.RESOLVED]: 3,
}

export function isActiveLifecycle(alert) {
  return Boolean(alert) && ACTIVE_LIFECYCLES.includes(alert.lifecycle)
}

// --- sorting ----------------------------------------------------------------

/** severity desc -> lifecycle (NEW first) -> most recently seen first. */
export function compareAlerts(a, b) {
  const sev = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
  if (sev) return sev
  const life = (LIFECYCLE_RANK[a.lifecycle] ?? 9) - (LIFECYCLE_RANK[b.lifecycle] ?? 9)
  if (life) return life
  return (b.lastSeenAt || 0) - (a.lastSeenAt || 0)
}

export function sortAlerts(alerts) {
  return Array.isArray(alerts) ? alerts.slice().sort(compareAlerts) : []
}

/** Per-area rollup used to sort the area list and to badge each row. */
export function areaSummary(area, alerts) {
  const mine = alerts.filter((alert) => alert.areaId === area.id)
  const operational = mine.filter((alert) => isActiveLifecycle(alert))
  let topSeverity = null
  let lastEventAt = 0
  let hasUnacknowledged = false
  for (const alert of operational) {
    if (!topSeverity || (SEVERITY_RANK[alert.severity] || 0) > (SEVERITY_RANK[topSeverity] || 0)) {
      topSeverity = alert.severity
    }
    if ((alert.lastSeenAt || 0) > lastEventAt) lastEventAt = alert.lastSeenAt || 0
    if (alert.lifecycle === LIFECYCLE.NEW) hasUnacknowledged = true
  }
  return {
    areaId: area.id,
    area,
    alertCount: operational.length,
    totalCount: mine.length,
    topSeverity,
    hasUnacknowledged,
    lastEventAt: lastEventAt || null,
  }
}

// --- area rollup, Phase A1 rules (additive) ---------------------------------
//
// `areaSummary` / `sortAreas` above are the Phase A0 rollup and stay untouched.
// The command-centre panel needs its own definition, so it gets its own pair
// rather than a behaviour change under the old names.
//
// TWO DIFFERENT QUESTIONS, TWO DIFFERENT SETS (corrected in Phase A2):
//
//   severity — "what is happening in this area right now". Driven by the
//     CONDITION only: every alert with active === true counts, whatever the
//     operator has done about it. An operator resolving a weapon alert closes
//     their own workflow; it does not make the weapon go away, and an area that
//     went green because somebody clicked Resolve would be a lie.
//
//   counts / bestLifecycleRank — "what is still on the operator's plate".
//     Driven by the workflow set: active AND still open (NEW/ACK/IN_REVIEW).
//
// INFO never promotes an area to ALERT in either set. An area is DANGER, ALERT
// or SAFE — an informational contact is not a reason to light up a zone.

/** Alerts whose condition still holds and which are still open operationally. */
export function operationalAlerts(alerts) {
  return (Array.isArray(alerts) ? alerts : []).filter((a) => a.active && isActiveLifecycle(a))
}

/** Alerts whose condition still holds, regardless of who closed what. */
export function activeConditionAlerts(alerts) {
  return (Array.isArray(alerts) ? alerts : []).filter((a) => a && a.active)
}

export const AREA_SEVERITY = { DANGER: 'DANGER', ALERT: 'ALERT', SAFE: 'SAFE' }

const AREA_SEVERITY_RANK = { DANGER: 3, ALERT: 2, SAFE: 1 }

/** Operational rollup for one area. Severity is DANGER / ALERT / SAFE only. */
export function areaOperationalSummary(area, alerts) {
  // The threat picture: conditions that still hold, whatever their lifecycle.
  const holding = activeConditionAlerts(alerts).filter((a) => a.areaId === area.id)
  // The work picture: what is still open for an operator.
  const mine = operationalAlerts(alerts).filter((a) => a.areaId === area.id)

  let severity = AREA_SEVERITY.SAFE
  if (holding.some((a) => a.severity === SEVERITY.DANGER)) severity = AREA_SEVERITY.DANGER
  else if (holding.some((a) => a.severity === SEVERITY.ALERT)) severity = AREA_SEVERITY.ALERT

  let lastEventAt = 0
  let bestLifecycleRank = 9
  for (const alert of mine) {
    if ((alert.lastSeenAt || 0) > lastEventAt) lastEventAt = alert.lastSeenAt || 0
    const rank = LIFECYCLE_RANK[alert.lifecycle] ?? 9
    if (rank < bestLifecycleRank) bestLifecycleRank = rank
  }

  return {
    areaId: area.id,
    area,
    severity,
    activeCount: mine.length,
    newCount: mine.filter((a) => a.lifecycle === LIFECYCLE.NEW).length,
    acknowledgedCount: mine.filter((a) => a.lifecycle === LIFECYCLE.ACKNOWLEDGED).length,
    inReviewCount: mine.filter((a) => a.lifecycle === LIFECYCLE.IN_REVIEW).length,
    bestLifecycleRank,
    lastEventAt: lastEventAt || null,
    isDemo: Boolean(area.isDemo),
  }
}

/** DANGER -> ALERT -> SAFE, then NEW before ACK before IN_REVIEW, then recency.
 *  Quiet areas stay in the list — lower down, never removed. */
export function sortAreasOperational(areas, alerts) {
  return (Array.isArray(areas) ? areas : [])
    .map((area) => areaOperationalSummary(area, alerts))
    .sort((a, b) => {
      const sev = AREA_SEVERITY_RANK[b.severity] - AREA_SEVERITY_RANK[a.severity]
      if (sev) return sev
      if (a.bestLifecycleRank !== b.bestLifecycleRank) return a.bestLifecycleRank - b.bestLifecycleRank
      return (b.lastEventAt || 0) - (a.lastEventAt || 0)
    })
}

/** Areas with alerts first (by severity), then unacknowledged, then recency.
 *  Quiet areas are never removed — they stay available, just lower down. */
export function sortAreas(areas, alerts) {
  const list = Array.isArray(areas) ? areas : []
  const all = Array.isArray(alerts) ? alerts : []
  return list
    .map((area) => areaSummary(area, all))
    .sort((a, b) => {
      const sev = (SEVERITY_RANK[b.topSeverity] || 0) - (SEVERITY_RANK[a.topSeverity] || 0)
      if (sev) return sev
      if (a.hasUnacknowledged !== b.hasUnacknowledged) return a.hasUnacknowledged ? -1 : 1
      return (b.lastEventAt || 0) - (a.lastEventAt || 0)
    })
}

// --- search -----------------------------------------------------------------

/**
 * Search normalization (Phase A3.2).
 *
 * The rule is narrow on purpose: fold away the differences between what is
 * DISPLAYED and what a keyboard can TYPE, and nothing else. No transliteration,
 * no fuzzy matching, no translation — "shaar" must not find "שער" (§29).
 *
 * The three folds, each earning its place:
 *
 *  1. `normalize('NFKC')`, so a composed and a decomposed form of the same
 *     grapheme compare equal.
 *  2. Hebrew punctuation to its ASCII lookalike. This is the one that actually
 *     bites: the demo area "ש״ג ראשי" is written with U+05F4 GERSHAYIM, and a
 *     standard Hebrew keyboard produces U+0022 QUOTATION MARK. Without this fold
 *     an operator can look straight at the name, type it exactly as they see it,
 *     and find nothing. Geresh (U+05F3) and maqaf (U+05BE) have the same problem.
 *  3. Strip niqqud and cantillation (U+0591-U+05C7), which are displayed but
 *     essentially never typed.
 *
 * Latin text keeps its existing case-insensitive behaviour; `toLowerCase` is a
 * no-op on Hebrew, which has no case.
 */
export function normalizeSearchText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .normalize('NFKC')
    // Hebrew punctuation -> the ASCII character a keyboard actually emits.
    .replace(/״/g, '"')
    .replace(/׳/g, "'")
    .replace(/־/g, '-')
    // Typographic forms of the same characters, from either language.
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[‐-―]/g, '-')
    // Niqqud and cantillation: rendered, not typed.
    .replace(/[֑-ׇ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Case-insensitive match across the identifiers an operator would actually type.
 * Track and target ids match with or without their display prefix (#7 / 7,
 * T1 / 1) because both forms appear on screen.
 *
 * Phase A3.2 routes both sides through `normalizeSearchText`. The Hebrew fields
 * were already in the haystack; what was missing was that the displayed text and
 * the typed text could not be compared character for character.
 */
export function matchesQuery(alert, query, { areas = [] } = {}) {
  const q = normalizeSearchText(query)
  if (!q) return true

  const area = areas.find((a) => a.id === alert.areaId)
  const haystack = [
    alert.id,
    alert.fingerprint,
    alert.areaId,
    area ? areaName(area, 'en') : '',
    area ? areaName(area, 'he') : '',
    alert.message,
    alert.messageHe,
    alert.sourceId,
    alert.sourceType,
    alert.kind,
    alert.severity,
    alert.lifecycle,
    alert.trackId !== null && alert.trackId !== undefined ? `#${alert.trackId} ${alert.trackId}` : '',
    alert.targetId !== null && alert.targetId !== undefined ? `t${alert.targetId} ${alert.targetId}` : '',
  ]
    .filter(Boolean)
    .map(normalizeSearchText)
    .join(' ')

  return haystack.includes(q)
}

/**
 * The same match, for the AREAS panel (Phase A3.2 §9-§12).
 *
 * Display filter only. It reads the area's own declared fields — both names as
 * rendered, and the id — and answers a yes/no. It never touches selection,
 * severity, counts or any other area state.
 */
export function matchesAreaQuery(area, query) {
  const q = normalizeSearchText(query)
  if (!q) return true
  if (!area) return false
  const haystack = [area.id, area.name, area.nameHe]
    .filter(Boolean)
    .map(normalizeSearchText)
    .join(' ')
  return haystack.includes(q)
}

// --- filtering --------------------------------------------------------------

export const DEFAULT_FILTERS = {
  lifecycle: LIFECYCLE_FILTERS.ALL_ACTIVE,
  areaId: 'ALL',
  severity: 'ALL',
  sourceType: 'ALL',
  activity: 'ALL', // ALL | ACTIVE | CLEARED — condition state, not lifecycle
  query: '',
}

function matchesLifecycle(alert, lifecycle) {
  if (!lifecycle || lifecycle === LIFECYCLE_FILTERS.ALL) return true
  if (lifecycle === LIFECYCLE_FILTERS.ALL_ACTIVE) return isActiveLifecycle(alert)
  return alert.lifecycle === lifecycle
}

/** Every filter EXCEPT lifecycle. Kept separate so counts stay honest. */
function matchesNonLifecycle(alert, filters, { areas }) {
  if (filters.areaId && filters.areaId !== 'ALL' && alert.areaId !== filters.areaId) return false
  if (filters.severity && filters.severity !== 'ALL' && alert.severity !== filters.severity) return false
  if (filters.sourceType && filters.sourceType !== 'ALL' && alert.sourceType !== filters.sourceType) return false
  if (filters.activity === 'ACTIVE' && !alert.active) return false
  if (filters.activity === 'CLEARED' && alert.active) return false
  if (!matchesQuery(alert, filters.query, { areas })) return false
  return true
}

export function filterAlerts(alerts, filters = {}, { areas = [] } = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters }
  const list = Array.isArray(alerts) ? alerts : []
  return list.filter((alert) => matchesNonLifecycle(alert, f, { areas }) && matchesLifecycle(alert, f.lifecycle))
}

/**
 * Counts per lifecycle bucket.
 *
 * Computed with every filter applied EXCEPT the lifecycle filter itself.
 * Counting the already-lifecycle-filtered array would zero every other bucket
 * the moment an operator picks one — a tab strip that lies about what is behind
 * the other tabs.
 */
export function lifecycleCounts(alerts, filters = {}, { areas = [] } = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters }
  const scope = (Array.isArray(alerts) ? alerts : []).filter((alert) =>
    matchesNonLifecycle(alert, f, { areas })
  )
  const counts = {
    [LIFECYCLE_FILTERS.ALL_ACTIVE]: 0,
    [LIFECYCLE.NEW]: 0,
    [LIFECYCLE.ACKNOWLEDGED]: 0,
    [LIFECYCLE.IN_REVIEW]: 0,
    [LIFECYCLE.RESOLVED]: 0,
    [LIFECYCLE_FILTERS.ALL]: scope.length,
  }
  for (const alert of scope) {
    if (counts[alert.lifecycle] !== undefined) counts[alert.lifecycle] += 1
    if (isActiveLifecycle(alert)) counts[LIFECYCLE_FILTERS.ALL_ACTIVE] += 1
  }
  return counts
}

/** Alerts for the list panel: filtered then sorted. */
export function visibleAlerts(alerts, filters, { areas = [] } = {}) {
  return sortAlerts(filterAlerts(alerts, filters, { areas }))
}

// --- selection --------------------------------------------------------------

/**
 * Default selection: the most severe alert an operator still has to deal with.
 * RESOLVED is never chosen as a default — it is finished work.
 */
export function pickDefaultAlertId(alerts) {
  const candidates = (Array.isArray(alerts) ? alerts : []).filter(isActiveLifecycle)
  if (!candidates.length) return null
  return sortAlerts(candidates)[0].id
}

/**
 * Selection after a state change.
 *
 * Two deliberate refusals:
 *  - a resolved selection STAYS selected while the operator is still looking at
 *    it; the screen does not yank them somewhere else the moment they finish;
 *  - a new DANGER does NOT steal the selection (see computeUnseenDanger).
 */
export function resolveSelection(alerts, selection = {}, { areas = [] } = {}) {
  const list = Array.isArray(alerts) ? alerts : []
  const current = selection.selectedAlertId
    ? list.find((alert) => alert.id === selection.selectedAlertId) || null
    : null

  const selectedAlertId = current ? current.id : pickDefaultAlertId(list)
  const selectedAlert = selectedAlertId ? list.find((a) => a.id === selectedAlertId) || null : null

  // The stored area wins over the selected alert's area (Phase A3.2).
  //
  // It used to be the other way round, and that was the root cause of the
  // session-log bug: `selectArea` would write the operator's choice, this
  // function would immediately recompute the area from the still-selected alert,
  // and the effect in useAlertSelection would write it straight back. Clicking an
  // area row did nothing at all, and the SELECTED AREA log filter was in practice
  // driven by the selected ALERT — which §26 forbids.
  //
  // Nothing about following the alert is lost: `selectAlert` sets BOTH ids
  // explicitly, so choosing an alert still moves the area to that alert's area.
  // The alert's area is now what it always should have been — the fallback for a
  // selection that has no area of its own yet.
  let selectedAreaId = selection.selectedAreaId || (selectedAlert ? selectedAlert.areaId : null)
  if (!selectedAreaId && areas.length) selectedAreaId = areas[0].id
  if (selectedAreaId && areas.length && !areas.some((a) => a.id === selectedAreaId)) {
    // The stored area no longer exists (e.g. demo -> live): fall back rather
    // than keep pointing at a place that is not in this deployment.
    selectedAreaId = areas[0].id
  }

  return { ...selection, selectedAlertId, selectedAreaId }
}

/**
 * Is there an active DANGER the operator has not looked at?
 *
 * Returns a flag, never a selection change. A new DANGER while somebody is
 * working an incident must not move the screen out from under them — it rises
 * to the top of the list and raises this flag, and only an explicit action
 * switches context.
 */
export function computeUnseenDanger(alerts, selection = {}) {
  const seen = new Set(selection.seenDangerIds || [])
  const candidates = (Array.isArray(alerts) ? alerts : []).filter(
    (alert) =>
      alert.severity === SEVERITY.DANGER &&
      alert.active &&
      isActiveLifecycle(alert) &&
      alert.id !== selection.selectedAlertId &&
      !seen.has(alert.id)
  )
  if (!candidates.length) return { hasUnseenDanger: false, unseenDangerAlertId: null, unseenDangerCount: 0 }
  const top = sortAlerts(candidates)[0]
  return { hasUnseenDanger: true, unseenDangerAlertId: top.id, unseenDangerCount: candidates.length }
}

/** Marks a danger alert as seen, so its banner does not come back. */
export function markDangerSeen(selection = {}, alertId) {
  if (!alertId) return selection
  const seen = new Set(selection.seenDangerIds || [])
  if (seen.has(alertId)) return selection
  seen.add(alertId)
  return { ...selection, seenDangerIds: [...seen] }
}

// --- operator actions, Phase A2 ---------------------------------------------

/**
 * Which lifecycle actions are legal on this alert, in the order they should be
 * offered. One source of truth for the action bar AND the context menu, so the
 * two surfaces can never disagree about what is possible.
 *
 * These mirror the transitions alerts.js actually implements; anything not
 * listed here would be a silent no-op in the engine, which is exactly what a
 * disabled-looking-but-clickable button trains an operator to distrust.
 */
export const ALERT_ACTIONS = {
  ACKNOWLEDGE: 'acknowledge',
  REVIEW: 'review',
  RESOLVE: 'resolve',
  REOPEN: 'reopen',
}

export function legalActionsFor(alert) {
  if (!alert) return []
  switch (alert.lifecycle) {
    case LIFECYCLE.NEW:
      return [ALERT_ACTIONS.ACKNOWLEDGE, ALERT_ACTIONS.REVIEW, ALERT_ACTIONS.RESOLVE]
    case LIFECYCLE.ACKNOWLEDGED:
      return [ALERT_ACTIONS.REVIEW, ALERT_ACTIONS.RESOLVE]
    case LIFECYCLE.IN_REVIEW:
      return [ALERT_ACTIONS.RESOLVE]
    case LIFECYCLE.RESOLVED:
      return [ALERT_ACTIONS.REOPEN]
    default:
      return []
  }
}

/**
 * Which filter axes are hiding this alert from the list.
 *
 * Used when an operator's own action pushes the alert they are working on out
 * of view: the screen says which filter did it and offers to lift exactly that
 * one, instead of silently resetting every filter they had set.
 */
export function blockingFilterAxes(alert, filters = {}, { areas = [] } = {}) {
  if (!alert) return []
  const f = { ...DEFAULT_FILTERS, ...filters }
  const blocking = []
  if (!matchesLifecycle(alert, f.lifecycle)) blocking.push('lifecycle')
  if (f.areaId !== 'ALL' && alert.areaId !== f.areaId) blocking.push('areaId')
  if (f.severity !== 'ALL' && alert.severity !== f.severity) blocking.push('severity')
  if (f.sourceType !== 'ALL' && alert.sourceType !== f.sourceType) blocking.push('sourceType')
  if ((f.activity === 'ACTIVE' && !alert.active) || (f.activity === 'CLEARED' && alert.active)) {
    blocking.push('activity')
  }
  if (!matchesQuery(alert, f.query, { areas })) blocking.push('query')
  return blocking
}

/**
 * What each axis has to become for the alert to be visible again.
 *
 * `lifecycle` unblocks to ALL rather than to the ALL_ACTIVE default: the most
 * common reason an alert vanishes is that the operator just resolved it, and
 * ALL_ACTIVE hides RESOLVED too.
 */
export const FILTER_AXIS_UNBLOCK = {
  lifecycle: LIFECYCLE_FILTERS.ALL,
  areaId: 'ALL',
  severity: 'ALL',
  sourceType: 'ALL',
  activity: 'ALL',
  query: '',
}

/** Filter patch that lifts only the axes currently hiding this alert. */
export function unblockFilterPatch(alert, filters = {}, { areas = [] } = {}) {
  const patch = {}
  for (const axis of blockingFilterAxes(alert, filters, { areas })) {
    patch[axis] = FILTER_AXIS_UNBLOCK[axis]
  }
  return patch
}

// --- optical context, Phase A3.2 §31-§43 ------------------------------------

/**
 * May this alert open the optical station, and with what?
 *
 * ONE rule, in one place, because the OPTICAL button, the navigation target and
 * the OPT screen's own intake must not be able to disagree about which camera an
 * alert came from.
 *
 * Every clause is a refusal to guess:
 *
 *  - `sourceType === CAMERA`. A radar alert has no camera source, and the area's
 *    camera is not it (§43). Radar-only stays disabled rather than opening some
 *    camera that happens to be nearby.
 *  - `cameraSourceKnown === true`. This is the canonical field the A0 engine
 *    writes, and in LIVE it is false on every branch and always will be: /status
 *    merges the camera sources into one global snapshot and tracks carry no
 *    camera id. So live OPTICAL is permanently disabled, and that is the correct
 *    answer rather than a gap to be filled in.
 *  - a real `sourceId`. The flag alone is not enough; there has to be an actual
 *    identifier to travel.
 *  - and that identifier must be one the alert's OWN area declares. A camera id
 *    that no area claims is not a camera we can open, and one belonging to a
 *    different area would be a cross-area claim nothing in the data supports.
 *
 * What is deliberately NOT consulted: the camera currently on screen. That is a
 * display choice (`pickDisplayCamera`), the panel already labels it a fallback,
 * and §33 forbids it as a source. `displayCamera` is not a parameter here, so it
 * cannot leak in later either.
 */
export function opticalContextFor(alert, { areas = [] } = {}) {
  if (!alert) return { enabled: false, reason: 'no-selection', cameraId: null }
  if (alert.sourceType !== SOURCE_TYPES.CAMERA) {
    return { enabled: false, reason: 'not-a-camera-alert', cameraId: null }
  }
  if (alert.cameraSourceKnown !== true || !alert.sourceId) {
    return { enabled: false, reason: 'camera-source-unknown', cameraId: null }
  }
  const area = areas.find((a) => a.id === alert.areaId) || null
  const declared = area ? area.cameras.some((cam) => cam.id === alert.sourceId) : false
  if (!declared) return { enabled: false, reason: 'camera-not-declared-in-area', cameraId: null }

  return {
    enabled: true,
    reason: null,
    cameraId: alert.sourceId,
    areaId: alert.areaId,
    alertId: alert.id,
    // Only when the alert genuinely carries them (§37/§49). `targetId` on a
    // camera alert is always null in the model, and nothing here invents one.
    trackId: alert.trackId ?? null,
    targetId: alert.targetId ?? null,
    at: alert.firstSeenAt ?? null,
    isDemo: Boolean(alert.isDemo),
  }
}

/**
 * The optical context as URL query parameters (§46/§47).
 *
 * Query params rather than router state so a refresh keeps the context: the ids
 * are short, stable and already public within the session. Only keys with a real
 * value are emitted, so an absent trackId is absent from the URL rather than
 * present and empty.
 */
export function opticalQueryParams(context) {
  if (!context || !context.enabled) return null
  const params = new URLSearchParams()
  params.set('ctx', 'ops-alert')
  params.set('cameraId', context.cameraId)
  if (context.areaId) params.set('areaId', context.areaId)
  if (context.alertId) params.set('alertId', context.alertId)
  if (context.trackId !== null && context.trackId !== undefined) params.set('trackId', String(context.trackId))
  if (context.targetId !== null && context.targetId !== undefined) params.set('targetId', String(context.targetId))
  if (Number.isFinite(context.at)) params.set('at', String(context.at))
  // The demo marking travels with the context so OPT cannot present demo data as
  // live after a refresh (§35).
  if (context.isDemo) params.set('demo', '1')
  return params
}
