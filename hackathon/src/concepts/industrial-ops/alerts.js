// Industrial Ops — local alert engine (Phase A0).
//
// See artifacts/industrial-ops-phase-a0/SPEC.md for the binding rules. The three
// that constrain every line below:
//
// 1. FOUR INDEPENDENT AXES. severity (how bad) / active-cleared (does the
//    condition still hold) / lifecycle (what the operator did) / sourceState
//    (is the sensor up). A condition that stops holding NEVER changes lifecycle:
//    a NEW alert that cleared is still NEW, because nobody handled it.
//
// 2. NO CROSS-SENSOR ASSOCIATION. `areaId` is operational context, not proof two
//    sensors saw the same thing. Camera alerts stay camera alerts. There is no
//    pair risk, no match percentage, no time-window merging. The backend
//    computes no association (analysis.py combines two scalars; the simulator
//    discards the camera tracks it is handed) so any grouping here would be
//    fabrication.
//
// 3. cameraId IS UNKNOWN. `/status` merges camera sources into one global
//    snapshot and tracks carry no camera id, so every camera alert records
//    sourceId: null / cameraSourceKnown: false. CAM-01 is never assumed.
//
// Everything here is pure: `now` is injected, never read from the clock, so the
// engine is testable in Node without a browser or a running backend.

// Relative imports in this Phase A0 cluster carry explicit .js extensions: these
// modules are deliberately runnable under plain Node (see
// scripts/phase-a0-alerts-verify.mjs), and Node's ESM resolver does not do the
// extensionless resolution Vite provides.
import { RADAR_SENSOR_ID, SOURCE_TYPES, resolveAreaIdForSource } from './areas.js'

export { SOURCE_TYPES }

export const LIFECYCLE = {
  NEW: 'NEW',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
}

export const ACTIVE_LIFECYCLES = [LIFECYCLE.NEW, LIFECYCLE.ACKNOWLEDGED, LIFECYCLE.IN_REVIEW]

export const SEVERITY = { INFO: 'info', ALERT: 'alert', DANGER: 'danger' }

export const RESOLVE_REASONS = ['false_alarm', 'no_threat', 'handled', 'sensor_issue', 'other']

export const SOURCE_STATES = {
  LIVE: 'LIVE',
  DISCONNECTED: 'DISCONNECTED',
  STALE: 'STALE',
  DISABLED: 'DISABLED',
  ERROR: 'ERROR',
  UNKNOWN: 'UNKNOWN',
}

export const ALERT_KINDS = {
  WEAPON: 'weapon',
  BEHAVIOR: 'behavior',
  PERSON: 'person',
  CONNECTION: 'connection',
  TARGET: 'target',
  MODE: 'mode',
}

// A cleared condition that comes back within this window is the SAME incident
// flapping; past it, it is a new one. Chosen against the system's own rhythm:
// the poll is 1s and the radar staleness threshold is 3s (useFreshness.js), so
// 15s is comfortably past transient flicker.
// NOTE: engineering constant, not an operational source of truth. It is NOT the
// unacknowledged-reminder interval from the brief — that is not implemented.
export const REACTIVATION_WINDOW_MS = 15000

// Local cap on the operator note. Nothing is sent anywhere; this only keeps a
// session-local string from growing without bound. It lives with the model
// rather than with the dialog because Phase A3.2 gave the note a second way in
// (editResolveNote), and one field may not have two different limits.
export const RESOLVE_NOTE_MAX = 500

// Mirrors useFreshness.js STALE_AFTER_MS so both agree on what "stale" means.
const RADAR_STALE_AFTER_MS = 3000

// Upper bound on retained alerts, so a long shift cannot grow the session state
// without limit. Resolved + cleared entries are dropped first.
const MAX_RETAINED_ALERTS = 200

// Behaviour states that are an operational event in their own right. Sourced
// from the behaviour engine's vocabulary (analysis.py).
const BEHAVIOR_STATES = ['running', 'approaching', 'loitering', 'gate_loitering']

// This screen refuses to print "gate" as a calibrated claim: the camera's
// approaching_gate is computed against GATE_POINT in image pixels and the
// radar's is a sensor-relative cone. Same wording the concept already uses in
// reasons.js, kept identical on purpose.
const BEHAVIOR_TEXT = {
  running: { en: (id) => `Track #${id} running`, he: (id) => `מסלול #${id} בריצה` },
  approaching: {
    en: (id) => `Track #${id} approaching configured reference point`,
    he: (id) => `מסלול #${id} מתקרב לנקודת ייחוס מוגדרת`,
  },
  loitering: { en: (id) => `Track #${id} loitering`, he: (id) => `מסלול #${id} משתהה` },
  gate_loitering: {
    en: (id) => `Track #${id} loitering at reference point`,
    he: (id) => `מסלול #${id} משתהה בנקודת הייחוס`,
  },
}

// --- state ------------------------------------------------------------------

export function createInitialAlertState() {
  return { alerts: [] }
}

// --- source state -----------------------------------------------------------

/** Radar link state from the adapted snapshot. Mock data reports as LIVE; the
 *  synthetic provenance travels on `isDemo`, not on the link state. */
export function radarLinkState(radar) {
  if (!radar) return SOURCE_STATES.UNKNOWN
  if (radar.enabled === false) return SOURCE_STATES.DISABLED
  if (!radar.connected) {
    const status = String(radar.status || '').toUpperCase()
    if (status === 'ERROR') return SOURCE_STATES.ERROR
    if (status === 'DISABLED') return SOURCE_STATES.DISABLED
    return SOURCE_STATES.DISCONNECTED
  }
  if (typeof radar.lastUpdateMs === 'number' && radar.lastUpdateMs > RADAR_STALE_AFTER_MS) {
    return SOURCE_STATES.STALE
  }
  return SOURCE_STATES.LIVE
}

function cameraSourceState(cameras) {
  if (!cameras) return SOURCE_STATES.UNKNOWN
  const up = Boolean(cameras.webcam?.connected || cameras.dahua?.connected)
  return up ? SOURCE_STATES.LIVE : SOURCE_STATES.DISCONNECTED
}

// --- fingerprints -----------------------------------------------------------

export function buildFingerprint({ areaId, sourceType, kind, discriminator }) {
  return [areaId, sourceType, kind, discriminator].join('|')
}

// --- candidate derivation ---------------------------------------------------

/**
 * Conditions that hold in this snapshot, as candidate alerts.
 * Pure: same snapshot in, same candidates out. No ids, no timestamps.
 */
export function deriveCandidates(snapshot, { areas, isDemo = false } = {}) {
  if (!snapshot) return []
  const candidates = []

  const cameraAreaId = resolveAreaIdForSource(areas, { sourceType: SOURCE_TYPES.CAMERA })
  const radarAreaId = resolveAreaIdForSource(areas, { sourceType: SOURCE_TYPES.RADAR })
  const systemAreaId = resolveAreaIdForSource(areas, { sourceType: SOURCE_TYPES.SYSTEM })

  const camState = cameraSourceState(snapshot.cameras)
  const tracks = Array.isArray(snapshot.tracks) ? snapshot.tracks : []

  // --- camera ---------------------------------------------------------------
  if (cameraAreaId) {
    let anyTrackArmed = false

    for (const track of tracks) {
      const armed = Boolean(track.hasWeapon) || track.state === 'armed'
      if (armed) {
        anyTrackArmed = true
        candidates.push({
          areaId: cameraAreaId,
          sourceType: SOURCE_TYPES.CAMERA,
          kind: ALERT_KINDS.WEAPON,
          discriminator: `track:${track.id}`,
          severity: SEVERITY.DANGER,
          sourceId: null,
          cameraSourceKnown: false,
          sourceState: camState,
          trackId: track.id,
          targetId: null,
          // Worded as a camera fact about one track. "Associated" is avoided on
          // purpose: on this screen that word must never read as a cross-sensor
          // claim, and an automated check greps the live payload for it.
          message: `Weapon detected on track #${track.id}`,
          messageHe: `זוהה נשק על מסלול #${track.id}`,
          sourceEvidence: [cameraEvidence(track)],
          isDemo,
        })
      }

      if (BEHAVIOR_STATES.includes(track.state)) {
        const text = BEHAVIOR_TEXT[track.state]
        candidates.push({
          areaId: cameraAreaId,
          sourceType: SOURCE_TYPES.CAMERA,
          kind: ALERT_KINDS.BEHAVIOR,
          // The state is part of the identity: running -> loitering is a change
          // of behaviour, which is its own operational event.
          discriminator: `track:${track.id}:${track.state}`,
          severity: SEVERITY.ALERT,
          sourceId: null,
          cameraSourceKnown: false,
          sourceState: camState,
          trackId: track.id,
          targetId: null,
          message: text.en(track.id),
          messageHe: text.he(track.id),
          sourceEvidence: [cameraEvidence(track)],
          isDemo,
        })
      } else if (!armed) {
        candidates.push({
          areaId: cameraAreaId,
          sourceType: SOURCE_TYPES.CAMERA,
          kind: ALERT_KINDS.PERSON,
          discriminator: `track:${track.id}`,
          severity: SEVERITY.INFO,
          sourceId: null,
          cameraSourceKnown: false,
          sourceState: camState,
          trackId: track.id,
          targetId: null,
          message: `Person tracked #${track.id}`,
          messageHe: `אדם במעקב #${track.id}`,
          sourceEvidence: [cameraEvidence(track)],
          isDemo,
        })
      }
    }

    // A weapon reported without any track carrying it: still a camera fact, but
    // there is no track to attach it to and none is invented.
    if (snapshot.hasWeapon && !anyTrackArmed) {
      candidates.push({
        areaId: cameraAreaId,
        sourceType: SOURCE_TYPES.CAMERA,
        kind: ALERT_KINDS.WEAPON,
        discriminator: 'track:none',
        severity: SEVERITY.DANGER,
        sourceId: null,
        cameraSourceKnown: false,
        sourceState: camState,
        trackId: null,
        targetId: null,
        message: `Weapon detected${snapshot.weaponType ? `: ${snapshot.weaponType}` : ''} — no track carries it`,
        messageHe: `זוהה נשק${snapshot.weaponType ? `: ${snapshot.weaponType}` : ''} — אין מסלול שנושא אותו`,
        sourceEvidence: [],
        isDemo,
      })
    }
  }

  // --- radar ----------------------------------------------------------------
  if (radarAreaId) {
    const linkState = radarLinkState(snapshot.radar)

    if (linkState !== SOURCE_STATES.LIVE) {
      candidates.push({
        areaId: radarAreaId,
        sourceType: SOURCE_TYPES.RADAR,
        kind: ALERT_KINDS.CONNECTION,
        // The link state is part of the identity, so DISCONNECTED and a later
        // STALE are two events rather than one alert quietly mutating.
        discriminator: `${RADAR_SENSOR_ID}:${linkState}`,
        severity: SEVERITY.ALERT,
        sourceId: RADAR_SENSOR_ID,
        cameraSourceKnown: false,
        sourceState: linkState,
        trackId: null,
        targetId: null,
        message: `Radar ${RADAR_SENSOR_ID} ${linkState.toLowerCase()}`,
        messageHe: `רדאר ${RADAR_SENSOR_ID} — ${linkState}`,
        sourceEvidence: [],
        isDemo,
      })
    }

    const targets = Array.isArray(snapshot.radar?.targets) ? snapshot.radar.targets : []
    for (const target of targets) {
      if (target.direction !== 'approaching') continue
      candidates.push({
        areaId: radarAreaId,
        sourceType: SOURCE_TYPES.RADAR,
        kind: ALERT_KINDS.TARGET,
        discriminator: `${RADAR_SENSOR_ID}:target:${target.id}`,
        severity: target.approachingGate ? SEVERITY.ALERT : SEVERITY.INFO,
        sourceId: RADAR_SENSOR_ID,
        cameraSourceKnown: false,
        sourceState: linkState,
        trackId: null,
        targetId: target.id,
        message: target.approachingGate
          ? `Radar T${target.id} closing inside sensor reference cone`
          : `Radar T${target.id} closing`,
        messageHe: target.approachingGate
          ? `רדאר T${target.id} מתקרב בתוך קונוס הייחוס של החיישן`
          : `רדאר T${target.id} סוגר מרחק`,
        sourceEvidence: [radarEvidence(target)],
        isDemo,
      })
    }
  }

  // --- system ---------------------------------------------------------------
  if (systemAreaId && snapshot.mode && snapshot.mode !== 'SAFE') {
    candidates.push({
      areaId: systemAreaId,
      sourceType: SOURCE_TYPES.SYSTEM,
      kind: ALERT_KINDS.MODE,
      // Mode is part of the identity: ALERT -> DANGER opens a new alert and
      // closes the old one, so the escalation stays visible instead of being
      // overwritten in place.
      discriminator: snapshot.mode,
      severity: snapshot.mode === 'DANGER' ? SEVERITY.DANGER : SEVERITY.ALERT,
      sourceId: null,
      cameraSourceKnown: false,
      sourceState: SOURCE_STATES.LIVE,
      trackId: null,
      targetId: null,
      message: `System mode ${snapshot.mode} (fused risk ${snapshot.risks?.fused ?? 0} — backend)`,
      messageHe: `מצב מערכת ${snapshot.mode} (סיכון ממוזג ${snapshot.risks?.fused ?? 0} — מהשרת)`,
      sourceEvidence: [],
      isDemo,
    })
  }

  return candidates
}

// Evidence rows stay strictly single-source and keep the backend's own units.
function cameraEvidence(track) {
  return {
    sourceType: SOURCE_TYPES.CAMERA,
    sourceId: null,
    cameraSourceKnown: false,
    trackId: track.id,
    state: track.state,
    speedPxS: track.speed,
    zone: track.zone ?? null,
    hasWeapon: Boolean(track.hasWeapon),
    cameraRisk: track.risk,
  }
}

function radarEvidence(target) {
  return {
    sourceType: SOURCE_TYPES.RADAR,
    sourceId: RADAR_SENSOR_ID,
    targetId: target.id,
    distanceMm: target.distanceMm,
    speedCmS: target.speedCmS,
    direction: target.direction,
    radarRisk: target.risk,
  }
}

// --- reduce -----------------------------------------------------------------

function newAlertFromCandidate(candidate, { now, instanceSeq, observedFromSessionStart }) {
  const fingerprint = buildFingerprint(candidate)
  return {
    id: `${fingerprint}#${instanceSeq}`,
    fingerprint,
    instanceSeq,
    areaId: candidate.areaId,
    areaIsDemo: Boolean(candidate.isDemo),
    severity: candidate.severity,
    kind: candidate.kind,
    sourceType: candidate.sourceType,
    sourceId: candidate.sourceId ?? null,
    cameraSourceKnown: Boolean(candidate.cameraSourceKnown),
    sourceState: candidate.sourceState || SOURCE_STATES.UNKNOWN,
    message: candidate.message,
    messageHe: candidate.messageHe,
    trackId: candidate.trackId ?? null,
    targetId: candidate.targetId ?? null,

    firstSeenAt: now,
    lastSeenAt: now,
    clearedAt: null,
    active: true,
    // We cannot know when the condition actually began — only when this session
    // first saw it. The field is named accordingly and the flag says so.
    observedFromSessionStart: Boolean(observedFromSessionStart),
    reactivationCount: 0,

    lifecycle: LIFECYCLE.NEW,
    owner: null,
    acknowledgedAt: null,
    reviewStartedAt: null,
    resolvedAt: null,
    reopenedAt: null,
    resolveReason: null,
    resolveNote: null,
    actionLog: [],

    sourceEvidence: candidate.sourceEvidence || [],
    otherActiveEvidenceInArea: [],

    persisted: false,
    sessionLocal: true,
    isDemo: Boolean(candidate.isDemo),
    demoScenarioId: candidate.demoScenarioId ?? null,
  }
}

/**
 * Fold one snapshot into the alert state.
 *
 * @param state     previous state (createInitialAlertState() on first call)
 * @param snapshot  adapted snapshot
 * @param ctx.now   injected clock (ms)
 * @param ctx.areas declared areas
 * @param ctx.isDemo whether this session is running on demo data
 * @param ctx.isFirstSnapshot marks alerts opened from a condition that was
 *        already true when the screen opened
 */
export function reduceAlerts(state, snapshot, { now, areas, isDemo = false, isFirstSnapshot = false } = {}) {
  const prev = state && Array.isArray(state.alerts) ? state.alerts : []
  const candidates = deriveCandidates(snapshot, { areas, isDemo })

  const byFingerprint = new Map()
  for (const alert of prev) {
    const bucket = byFingerprint.get(alert.fingerprint)
    // Keep the newest instance of each fingerprint as the reactivation target.
    if (!bucket || alert.instanceSeq > bucket.instanceSeq) byFingerprint.set(alert.fingerprint, alert)
  }

  const touched = new Set()
  const next = prev.slice()

  const replace = (alert, patch) => {
    const index = next.findIndex((a) => a.id === alert.id)
    if (index === -1) return
    next[index] = { ...alert, ...patch }
  }

  for (const candidate of candidates) {
    const fingerprint = buildFingerprint(candidate)
    touched.add(fingerprint)
    const existing = byFingerprint.get(fingerprint)

    if (!existing) {
      next.push(newAlertFromCandidate(candidate, {
        now,
        instanceSeq: 1,
        observedFromSessionStart: isFirstSnapshot,
      }))
      continue
    }

    if (existing.active) {
      // Update in place. lifecycle / owner / firstSeenAt are the operator's and
      // the incident's — the engine never touches them.
      replace(existing, {
        lastSeenAt: now,
        message: candidate.message,
        messageHe: candidate.messageHe,
        sourceState: candidate.sourceState || existing.sourceState,
        sourceEvidence: candidate.sourceEvidence || existing.sourceEvidence,
      })
      continue
    }

    const gap = now - (existing.clearedAt ?? now)
    if (gap <= REACTIVATION_WINDOW_MS) {
      // Same incident flapping: same id, same lifecycle, same ownership.
      replace(existing, {
        active: true,
        clearedAt: null,
        lastSeenAt: now,
        reactivationCount: (existing.reactivationCount || 0) + 1,
        message: candidate.message,
        messageHe: candidate.messageHe,
        sourceState: candidate.sourceState || existing.sourceState,
        sourceEvidence: candidate.sourceEvidence || existing.sourceEvidence,
      })
    } else {
      // Long enough gone to be a separate incident: a new instance, back to NEW.
      next.push(newAlertFromCandidate(candidate, {
        now,
        instanceSeq: (existing.instanceSeq || 1) + 1,
        observedFromSessionStart: false,
      }))
    }
  }

  // Conditions that stopped holding: clear them, but never touch lifecycle.
  for (const alert of next.slice()) {
    if (!alert.active) continue
    if (touched.has(alert.fingerprint)) continue
    replace(alert, { active: false, clearedAt: now })
  }

  return { ...state, alerts: withOtherActiveEvidenceInArea(pruneAlerts(next)) }
}

/**
 * Display-only companion list: other alerts currently active in the same area.
 * It is NOT an association — same area is not evidence of the same event, and
 * the UI must word it as "not associated".
 */
export function withOtherActiveEvidenceInArea(alerts) {
  const activeByArea = new Map()
  for (const alert of alerts) {
    if (!alert.active) continue
    if (!activeByArea.has(alert.areaId)) activeByArea.set(alert.areaId, [])
    activeByArea.get(alert.areaId).push(alert.id)
  }
  return alerts.map((alert) => {
    const others = (activeByArea.get(alert.areaId) || []).filter((id) => id !== alert.id)
    const same = others.length === alert.otherActiveEvidenceInArea.length &&
      others.every((id, i) => id === alert.otherActiveEvidenceInArea[i])
    return same ? alert : { ...alert, otherActiveEvidenceInArea: others }
  })
}

// Drops the least operationally relevant entries first: resolved+cleared, then
// oldest. Active or unresolved alerts are never dropped ahead of those.
function pruneAlerts(alerts) {
  if (alerts.length <= MAX_RETAINED_ALERTS) return alerts
  const score = (a) => {
    if (a.active) return 3
    if (a.lifecycle !== LIFECYCLE.RESOLVED) return 2
    return 1
  }
  return alerts
    .slice()
    .sort((a, b) => (score(b) - score(a)) || (b.lastSeenAt - a.lastSeenAt))
    .slice(0, MAX_RETAINED_ALERTS)
}

// --- lifecycle actions ------------------------------------------------------

function logAction(alert, entry) {
  return [...(alert.actionLog || []), entry]
}

function operatorOf(operator) {
  if (!operator) return null
  return { id: operator.id ?? null, name: operator.name ?? operator.username ?? null }
}

/** NEW -> ACKNOWLEDGED. Any other source state is a no-op. */
export function acknowledgeAlert(alert, { now, operator = null } = {}) {
  if (!alert || alert.lifecycle !== LIFECYCLE.NEW) return alert
  const who = operatorOf(operator)
  return {
    ...alert,
    lifecycle: LIFECYCLE.ACKNOWLEDGED,
    acknowledgedAt: now,
    actionLog: logAction(alert, {
      at: now, action: 'acknowledge', from: alert.lifecycle, to: LIFECYCLE.ACKNOWLEDGED,
      operatorId: who?.id ?? null, operatorName: who?.name ?? null,
    }),
  }
}

/** NEW | ACKNOWLEDGED -> IN_REVIEW, taking session-local ownership. */
export function startReviewAlert(alert, { now, operator = null } = {}) {
  if (!alert) return alert
  if (alert.lifecycle !== LIFECYCLE.NEW && alert.lifecycle !== LIFECYCLE.ACKNOWLEDGED) return alert
  const who = operatorOf(operator)
  return {
    ...alert,
    lifecycle: LIFECYCLE.IN_REVIEW,
    reviewStartedAt: now,
    // Visible ownership, never a lock: there is no multi-user synchronization
    // in the system, so nothing here may block another operator.
    owner: who,
    actionLog: logAction(alert, {
      at: now, action: 'review', from: alert.lifecycle, to: LIFECYCLE.IN_REVIEW,
      operatorId: who?.id ?? null, operatorName: who?.name ?? null,
    }),
  }
}

/** Anything but RESOLVED -> RESOLVED. A valid reason is required. */
export function resolveAlert(alert, { now, operator = null, reason, note = null } = {}) {
  if (!alert || alert.lifecycle === LIFECYCLE.RESOLVED) return alert
  if (!RESOLVE_REASONS.includes(reason)) return alert
  const who = operatorOf(operator)
  return {
    ...alert,
    lifecycle: LIFECYCLE.RESOLVED,
    resolvedAt: now,
    resolveReason: reason,
    resolveNote: note,
    actionLog: logAction(alert, {
      at: now, action: 'resolve', from: alert.lifecycle, to: LIFECYCLE.RESOLVED,
      operatorId: who?.id ?? null, operatorName: who?.name ?? null, reason, note,
    }),
  }
}

/**
 * Edits the note left on a RESOLVED alert (Phase A3.2 §53-§56).
 *
 * Deliberately narrow, and each refusal is a rule rather than a guard:
 *
 *  - RESOLVED only. There is no note to edit before an alert is resolved, and
 *    inventing one would create a field the resolve dialog never wrote.
 *  - The NOTE only. `resolveReason` is untouchable here (§52): the reason is why
 *    the incident was closed, and changing that after the fact is a different and
 *    much larger claim than correcting a sentence.
 *  - The LIFECYCLE does not move. Editing a note is not reopening.
 *
 * Whitespace-only normalizes to null, exactly as the resolve dialog does, so a
 * note cleared by editing is indistinguishable from one never written.
 *
 * The action log records that the note was edited and by whom. It stores the
 * previous value too — the note is a short session-local string, so keeping it
 * costs nothing and is the difference between an audit line and a rumour.
 */
export function editResolveNote(alert, { now, operator = null, note = null } = {}) {
  if (!alert || alert.lifecycle !== LIFECYCLE.RESOLVED) return alert
  const who = operatorOf(operator)
  const trimmed = typeof note === 'string' ? note.trim() : ''
  const next = trimmed.length ? trimmed.slice(0, RESOLVE_NOTE_MAX) : null
  const previous = alert.resolveNote ?? null
  if (next === previous) return alert
  return {
    ...alert,
    resolveNote: next,
    actionLog: logAction(alert, {
      at: now,
      action: 'edit_note',
      // The lifecycle is unchanged, and the log says so rather than leaving the
      // fields blank for a reader to interpret.
      from: LIFECYCLE.RESOLVED,
      to: LIFECYCLE.RESOLVED,
      operatorId: who?.id ?? null,
      operatorName: who?.name ?? null,
      previousNote: previous,
      note: next,
    }),
  }
}

/**
 * Where a reopen would put this alert. Pure and clock-free, so the Reopen
 * confirmation can state the destination without duplicating the rule.
 *
 * The destination is decided by the ownership the alert ALREADY had before it
 * was resolved — never by whoever happens to be pressing Reopen now. Somebody
 * reopening an alert is not evidence that anybody ever reviewed it.
 */
export function reopenTargetLifecycle(alert) {
  if (!alert || alert.lifecycle !== LIFECYCLE.RESOLVED) return null
  return alert.owner ? LIFECYCLE.IN_REVIEW : LIFECYCLE.ACKNOWLEDGED
}

/**
 * RESOLVED -> IN_REVIEW when the alert already had an owner, otherwise
 * ACKNOWLEDGED.
 *
 * `operator` is recorded in the action log as who performed the reopen, and is
 * deliberately NOT written to `owner`: reopening is not taking the incident on.
 * Ownership is only ever created by Start Review.
 */
export function reopenAlert(alert, { now, operator = null } = {}) {
  if (!alert || alert.lifecycle !== LIFECYCLE.RESOLVED) return alert
  const who = operatorOf(operator)
  const to = reopenTargetLifecycle(alert)
  return {
    ...alert,
    lifecycle: to,
    reopenedAt: now,
    resolvedAt: null,
    resolveReason: null,
    resolveNote: null,
    actionLog: logAction(alert, {
      at: now, action: 'reopen', from: LIFECYCLE.RESOLVED, to,
      operatorId: who?.id ?? null, operatorName: who?.name ?? null,
    }),
  }
}

const ACTIONS = {
  acknowledge: acknowledgeAlert,
  review: startReviewAlert,
  resolve: resolveAlert,
  reopen: reopenAlert,
  // Not a lifecycle transition — `editResolveNote` leaves the lifecycle where it
  // is — but it goes through the same dispatcher so it gets the same injected
  // clock, the same operator and the same action-log discipline as the four
  // above. A second write path for one field is how two records of the same
  // change end up disagreeing.
  edit_note: editResolveNote,
}

/** Applies a lifecycle action to one alert inside the state. Unknown action or
 *  unknown id is a no-op, so a stale UI reference can never throw. */
export function applyLifecycleAction(state, alertId, action, ctx = {}) {
  const fn = ACTIONS[action]
  if (!fn || !state || !Array.isArray(state.alerts)) return state
  let changed = false
  const alerts = state.alerts.map((alert) => {
    if (alert.id !== alertId) return alert
    const updated = fn(alert, ctx)
    if (updated !== alert) changed = true
    return updated
  })
  return changed ? { ...state, alerts } : state
}
