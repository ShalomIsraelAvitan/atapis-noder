// Industrial Ops — synthetic alert set for exercising the Phase A0 workflow.
//
// DEMO DATA. Every entry carries isDemo:true and a demoScenarioId, and demo
// state is never restored into a live session (alertStorage.js drops it on a
// mode mismatch). Nothing here proves the backend can do any of it.
//
// What it deliberately does NOT contain, in demo or anywhere else:
//   no FC-nn identifiers, no association percentage, no Matched / Associated /
//   Confirmed, no pair risk, no combined risk, no camera-radar link of any kind.
// Camera alerts and radar alerts in the same demo area are separate events that
// happen to share a place. That is all `areaId` ever means.

import { ALERT_KINDS, LIFECYCLE, SEVERITY, SOURCE_STATES, SOURCE_TYPES, buildFingerprint } from './alerts.js'

export const DEMO_SCENARIO_ID = 'industrial-a0-multizone'

// Relative offsets (seconds ago) so the set stays coherent whenever it is built.
function makeAlert({
  areaId, severity, kind, sourceType, discriminator,
  message, messageHe, secondsAgo, lifecycle = LIFECYCLE.NEW,
  sourceId = null, trackId = null, targetId = null, owner = null,
  active = true, clearedSecondsAgo = null, resolveReason = null,
  sourceState = SOURCE_STATES.LIVE, instanceSeq = 1, cameraId = null,
}, now) {
  const fingerprint = buildFingerprint({ areaId, sourceType, kind, discriminator })
  const firstSeenAt = now - secondsAgo * 1000
  return {
    id: `${fingerprint}#${instanceSeq}`,
    fingerprint,
    instanceSeq,
    areaId,
    areaIsDemo: true,
    severity,
    kind,
    sourceType,
    sourceId: cameraId || sourceId,
    // LIVE camera alerts never know their camera: the backend merges every
    // camera into one global snapshot and tracks carry no camera id, so
    // `alerts.js` sets this false in every branch and always will.
    //
    // A DEMO alert may say otherwise, but only when the fixture NAMES a camera
    // that the demo area actually declares in areas.js (Phase A3.2 §35). That is
    // authored data, not an inference — and it is what makes the OPTICAL action's
    // enabled path demonstrable at all, since no live alert can ever reach it.
    // Alerts left without a cameraId keep the unknown path, so both branches are
    // visible side by side on the same screen.
    cameraSourceKnown: Boolean(cameraId),
    sourceState,
    message,
    messageHe,
    trackId,
    targetId,
    firstSeenAt,
    lastSeenAt: active ? now : now - (clearedSecondsAgo ?? 0) * 1000,
    clearedAt: active ? null : now - (clearedSecondsAgo ?? 0) * 1000,
    active,
    observedFromSessionStart: false,
    reactivationCount: 0,
    lifecycle,
    owner,
    acknowledgedAt: lifecycle === LIFECYCLE.NEW ? null : firstSeenAt + 2000,
    reviewStartedAt: lifecycle === LIFECYCLE.IN_REVIEW || lifecycle === LIFECYCLE.RESOLVED ? firstSeenAt + 5000 : null,
    resolvedAt: lifecycle === LIFECYCLE.RESOLVED ? firstSeenAt + 20000 : null,
    reopenedAt: null,
    resolveReason: lifecycle === LIFECYCLE.RESOLVED ? resolveReason || 'handled' : null,
    resolveNote: null,
    actionLog: [],
    sourceEvidence: [],
    otherActiveEvidenceInArea: [],
    persisted: false,
    sessionLocal: true,
    isDemo: true,
    demoScenarioId: DEMO_SCENARIO_ID,
  }
}

const OPERATOR_2 = { id: 902, name: 'Operator 2' }
const OPERATOR_1 = { id: 901, name: 'Operator 1' }

// Built once per page load. The clock is read here, outside React, so the hook
// that consumes it stays pure and the identities never change mid-session while
// the displayed ages keep advancing.
let fixture = null

/** Stable demo fixture for this page load. */
export function demoAlertFixture() {
  if (!fixture) fixture = demoAlerts(Date.now())
  return fixture
}

/**
 * 12 demo alerts across three demo areas: every severity, every lifecycle,
 * camera-only / radar-only / system-only, one cleared-but-unhandled entry.
 */
export function demoAlerts(now = Date.now()) {
  return [
    // --- DEMO-AREA-02 · north tower ----------------------------------------
    makeAlert({
      areaId: 'DEMO-AREA-02', severity: SEVERITY.DANGER, kind: ALERT_KINDS.WEAPON,
      sourceType: SOURCE_TYPES.CAMERA, discriminator: 'track:4', trackId: 4, secondsAgo: 4,
      lifecycle: LIFECYCLE.IN_REVIEW, owner: OPERATOR_2,
      // Declared by DEMO-AREA-02 in areas.js. See the cameraSourceKnown note above.
      cameraId: 'DEMO-CAM-04',
      message: 'Weapon detected on track #4', messageHe: 'זוהה נשק על מסלול #4',
    }, now),
    makeAlert({
      areaId: 'DEMO-AREA-02', severity: SEVERITY.ALERT, kind: ALERT_KINDS.TARGET,
      sourceType: SOURCE_TYPES.RADAR, discriminator: 'DEMO-RDR-03:target:2',
      sourceId: 'DEMO-RDR-03', targetId: 2, secondsAgo: 9, lifecycle: LIFECYCLE.NEW,
      message: 'Radar T2 closing inside sensor reference cone',
      messageHe: 'רדאר T2 מתקרב בתוך קונוס הייחוס של החיישן',
    }, now),
    makeAlert({
      areaId: 'DEMO-AREA-02', severity: SEVERITY.DANGER, kind: ALERT_KINDS.MODE,
      sourceType: SOURCE_TYPES.SYSTEM, discriminator: 'DANGER', secondsAgo: 6,
      lifecycle: LIFECYCLE.ACKNOWLEDGED,
      message: 'System mode DANGER (fused risk 88 — backend)',
      messageHe: 'מצב מערכת DANGER (סיכון ממוזג 88 — מהשרת)',
    }, now),

    // --- DEMO-AREA-01 · main gate -------------------------------------------
    makeAlert({
      areaId: 'DEMO-AREA-01', severity: SEVERITY.ALERT, kind: ALERT_KINDS.BEHAVIOR,
      sourceType: SOURCE_TYPES.CAMERA, discriminator: 'track:7:approaching', trackId: 7,
      secondsAgo: 12, lifecycle: LIFECYCLE.NEW, cameraId: 'DEMO-CAM-01',
      message: 'Track #7 approaching configured reference point',
      messageHe: 'מסלול #7 מתקרב לנקודת ייחוס מוגדרת',
    }, now),
    makeAlert({
      areaId: 'DEMO-AREA-01', severity: SEVERITY.ALERT, kind: ALERT_KINDS.TARGET,
      sourceType: SOURCE_TYPES.RADAR, discriminator: 'DEMO-RDR-01:target:1',
      sourceId: 'DEMO-RDR-01', targetId: 1, secondsAgo: 14, lifecycle: LIFECYCLE.ACKNOWLEDGED,
      message: 'Radar T1 closing inside sensor reference cone',
      messageHe: 'רדאר T1 מתקרב בתוך קונוס הייחוס של החיישן',
    }, now),
    makeAlert({
      areaId: 'DEMO-AREA-01', severity: SEVERITY.INFO, kind: ALERT_KINDS.PERSON,
      sourceType: SOURCE_TYPES.CAMERA, discriminator: 'track:9', trackId: 9,
      secondsAgo: 21, lifecycle: LIFECYCLE.NEW,
      message: 'Person tracked #9', messageHe: 'אדם במעקב #9',
    }, now),
    makeAlert({
      areaId: 'DEMO-AREA-01', severity: SEVERITY.ALERT, kind: ALERT_KINDS.MODE,
      sourceType: SOURCE_TYPES.SYSTEM, discriminator: 'ALERT', secondsAgo: 40,
      lifecycle: LIFECYCLE.RESOLVED, resolveReason: 'no_threat',
      message: 'System mode ALERT (fused risk 46 — backend)',
      messageHe: 'מצב מערכת ALERT (סיכון ממוזג 46 — מהשרת)',
    }, now),

    // --- DEMO-AREA-03 · east entrance ---------------------------------------
    makeAlert({
      areaId: 'DEMO-AREA-03', severity: SEVERITY.ALERT, kind: ALERT_KINDS.CONNECTION,
      sourceType: SOURCE_TYPES.RADAR, discriminator: 'DEMO-RDR-04:DISCONNECTED',
      sourceId: 'DEMO-RDR-04', secondsAgo: 65, lifecycle: LIFECYCLE.IN_REVIEW, owner: OPERATOR_1,
      sourceState: SOURCE_STATES.DISCONNECTED,
      message: 'Radar DEMO-RDR-04 disconnected', messageHe: 'רדאר DEMO-RDR-04 — מנותק',
    }, now),
    makeAlert({
      areaId: 'DEMO-AREA-03', severity: SEVERITY.ALERT, kind: ALERT_KINDS.BEHAVIOR,
      sourceType: SOURCE_TYPES.CAMERA, discriminator: 'track:11:running', trackId: 11,
      secondsAgo: 33, lifecycle: LIFECYCLE.NEW, cameraId: 'DEMO-CAM-05',
      message: 'Track #11 running', messageHe: 'מסלול #11 בריצה',
    }, now),
    makeAlert({
      areaId: 'DEMO-AREA-03', severity: SEVERITY.INFO, kind: ALERT_KINDS.TARGET,
      sourceType: SOURCE_TYPES.RADAR, discriminator: 'DEMO-RDR-04:target:3',
      sourceId: 'DEMO-RDR-04', targetId: 3, secondsAgo: 52, lifecycle: LIFECYCLE.ACKNOWLEDGED,
      message: 'Radar T3 closing', messageHe: 'רדאר T3 סוגר מרחק',
    }, now),
    // Condition gone, nobody handled it: still NEW. This is the case that proves
    // "cleared" and "lifecycle" are different axes.
    makeAlert({
      areaId: 'DEMO-AREA-03', severity: SEVERITY.INFO, kind: ALERT_KINDS.PERSON,
      sourceType: SOURCE_TYPES.CAMERA, discriminator: 'track:12', trackId: 12,
      secondsAgo: 90, lifecycle: LIFECYCLE.NEW, active: false, clearedSecondsAgo: 70,
      message: 'Person tracked #12', messageHe: 'אדם במעקב #12',
    }, now),
    makeAlert({
      areaId: 'DEMO-AREA-03', severity: SEVERITY.ALERT, kind: ALERT_KINDS.CONNECTION,
      sourceType: SOURCE_TYPES.RADAR, discriminator: 'DEMO-RDR-04:STALE',
      sourceId: 'DEMO-RDR-04', secondsAgo: 120, lifecycle: LIFECYCLE.RESOLVED,
      resolveReason: 'sensor_issue', active: false, clearedSecondsAgo: 100,
      sourceState: SOURCE_STATES.STALE,
      message: 'Radar DEMO-RDR-04 stale', messageHe: 'רדאר DEMO-RDR-04 — STALE',
    }, now),
  ]
}
