// Candidate Pair model — pairs a camera track with a radar target for DISPLAY.
//
// HONESTY CONTRACT (read before changing anything here):
//
// The backend performs NO camera<->radar association. `combine_camera_risk_and_
// radar_risk()` (analysis.py) takes two scalars plus a radar confidence; the
// simulator explicitly discards the camera tracks it is handed
// (radar_simulator.py: `del camera_tracks`). There is no calibration, no
// homography and no shared frame of reference in the repo: `track.bbox` is
// image pixels, `target.xMm/yMm` is site-relative millimetres. Geometric
// association is therefore NOT COMPUTABLE and must never be synthesized.
// Speed matching is equally forbidden — `track.speed` is px/s, `speedCmS` is
// cm/s; correlating them would be fabrication dressed up as math.
//
// So in LIVE mode this module only ever produces an UNVERIFIED candidate:
// id `CP-nn`, `association.confidence === null`. A numeric confidence and the
// `FC-nn` identifier exist ONLY under `method: 'scenario'` (demo), where the
// renderer must show a DemoModeBadge alongside it.
//
// Terminology: "Fused Risk" is reserved for the backend value
// `snapshot.risks.fused`. The per-pair number here is `pairRisk` and must never
// be labeled Fused Risk in the UI.

export const PAIR_METHODS = {
  SINGLETON: 'singleton',
  GATE: 'gate-agreement',
  SCENARIO: 'scenario',
}

const BASIS = {
  [PAIR_METHODS.SINGLETON]: {
    en: 'Sole candidate in frame — association not measured',
    he: 'המועמד היחיד בפריים — לא נבדק שיוך',
  },
  [PAIR_METHODS.GATE]: {
    en: 'Both sensors flag a gate approach — corroboration, not a spatial match',
    he: 'שני החיישנים מסמנים התקרבות לשער — חיזוק, לא התאמה מרחבית',
  },
  [PAIR_METHODS.SCENARIO]: {
    en: 'Scenario-provided association (demo data)',
    he: 'שיוך מתוך תרחיש הדגמה',
  },
}

const pad = (index) => String(index + 1).padStart(2, '0')

// Picks the pairing method, or null when no defensible one applies.
// Order matters: the trivial single-candidate case wins over gate agreement.
function pickMethod(tracks, targets) {
  if (tracks.length === 1 && targets.length === 1) return PAIR_METHODS.SINGLETON

  const gateTracks = tracks.filter((track) => track.approachingGate)
  const gateTargets = targets.filter((target) => target.approachingGate)
  if (gateTracks.length === 1 && gateTargets.length === 1) return PAIR_METHODS.GATE

  return null
}

function buildPairRisk(track, target) {
  const cameraRisk = track ? track.risk : null
  const radarRisk = target ? target.risk : null

  if (track && target) {
    // Max, never an average: averaging would invent a blended number the
    // backend never computed and would understate the louder sensor.
    return { value: Math.max(cameraRisk, radarRisk), basis: 'max-of-sources', cameraRisk, radarRisk }
  }
  if (track) return { value: cameraRisk, basis: 'camera-only', cameraRisk, radarRisk: null }
  return { value: radarRisk, basis: 'radar-only', cameraRisk: null, radarRisk }
}

function buildPair({ track, target, index, method, confidence }) {
  const paired = Boolean(track && target)
  const isDemo = method === PAIR_METHODS.SCENARIO
  const prefix = isDemo && paired ? 'FC' : 'CP'

  let association = null
  let associationState = 'unavailable'
  if (paired && method) {
    association = {
      method,
      // A number ONLY for scenario/demo data. Always null in live mode.
      confidence: isDemo && Number.isFinite(confidence) ? confidence : null,
      basisEn: BASIS[method].en,
      basisHe: BASIS[method].he,
      isDemo,
    }
    associationState = isDemo ? 'demo-verified' : 'candidate'
  }

  return {
    id: `${prefix}-${pad(index)}`,
    displayId: `${prefix}-${pad(index)}`,
    cameraTrackId: track ? track.id : null,
    radarTargetId: target ? target.id : null,
    source: { camera: Boolean(track), radar: Boolean(target) },
    association,
    associationState,
    behavior: {
      state: track ? track.state : null,
      zone: track ? track.zone : null,
      approachingGate: Boolean(track?.approachingGate || target?.approachingGate),
      direction: target ? target.direction : null,
    },
    pairRisk: buildPairRisk(track, target),
    // null (not false) when no camera contributes: absence of a camera is not
    // evidence of absence of a weapon.
    hasWeapon: track ? track.hasWeapon : null,
    distance: target ? { mm: target.distanceMm, source: 'radar' } : { mm: null, source: null },
    speed: target
      ? { cmS: target.speedCmS, source: 'radar', cameraRaw: track ? track.speed : null }
      : { cmS: null, source: null, cameraRaw: track ? track.speed : null },
  }
}

/**
 * @param snapshot  adapted snapshot from design-lab/shared/adapter
 * @param scenario  demo-only pairing: { cameraTrackId, radarTargetId, confidence }
 * @returns { pairs, linkage }
 */
export function buildCandidatePairs(snapshot, { scenario = null } = {}) {
  const tracks = Array.isArray(snapshot?.tracks) ? snapshot.tracks : []
  const targets = Array.isArray(snapshot?.radar?.targets) ? snapshot.radar.targets : []

  let method = null
  let pairedTrack = null
  let pairedTarget = null
  let confidence = null

  if (scenario) {
    pairedTrack = tracks.find((track) => track.id === scenario.cameraTrackId) || null
    pairedTarget = targets.find((target) => target.id === scenario.radarTargetId) || null
    if (pairedTrack && pairedTarget) {
      method = PAIR_METHODS.SCENARIO
      confidence = scenario.confidence
    }
  } else {
    method = pickMethod(tracks, targets)
    if (method === PAIR_METHODS.SINGLETON) {
      pairedTrack = tracks[0]
      pairedTarget = targets[0]
    } else if (method === PAIR_METHODS.GATE) {
      pairedTrack = tracks.find((track) => track.approachingGate)
      pairedTarget = targets.find((target) => target.approachingGate)
    }
  }

  const pairs = []
  if (pairedTrack && pairedTarget) {
    pairs.push(buildPair({ track: pairedTrack, target: pairedTarget, index: 0, method, confidence }))
  }
  tracks
    .filter((track) => track !== pairedTrack)
    .forEach((track) => pairs.push(buildPair({ track, target: null, index: pairs.length })))
  targets
    .filter((target) => target !== pairedTarget)
    .forEach((target) => pairs.push(buildPair({ track: null, target, index: pairs.length })))

  const pairedCount = pairedTrack && pairedTarget ? 1 : 0
  const reason = pairedCount
    ? BASIS[method]
    : {
        en: 'No defensible camera–radar pairing: the backend provides no association.',
        he: 'אין שיוך מצלמה–רדאר בר־הגנה: ה־Backend אינו מספק שיוך.',
      }

  return {
    pairs,
    linkage: {
      method: pairedCount ? method : null,
      pairedCount,
      unpairedCamera: tracks.length - pairedCount,
      unpairedRadar: targets.length - pairedCount,
      reasonEn: reason.en,
      reasonHe: reason.he,
    },
  }
}

// Demo-only: derive a scenario that pairs the dominant camera track with the
// dominant radar target so demo mode can showcase a "fused contact" (FC-01) with
// an illustrative confidence. The confidence is DEMO data — the backend computes
// no association — so any renderer must show it beside a DemoModeBadge. Returns
// null (→ live CP-nn behavior) when both sources are not present.
export function demoAssociationScenario(snapshot, confidence = 0.9) {
  const track = snapshot?.tracks?.[0]
  const target = snapshot?.radar?.targets?.[0]
  if (!track || !target) return null
  return { cameraTrackId: track.id, radarTargetId: target.id, confidence }
}

// 'CP-01 — Unverified' in live mode, 'FC-01' for demo scenario data.
export function pairLabel(pair, t) {
  if (!pair) return ''
  if (pair.associationState === 'candidate') {
    const suffix = t ? t('Unverified', 'לא מאומת') : 'Unverified'
    return `${pair.displayId} — ${suffix}`
  }
  return pair.displayId
}

export function associationLabel(association, t) {
  if (!association) {
    return t ? t('Association unavailable', 'שיוך לא זמין') : 'Association unavailable'
  }
  if (association.confidence !== null) {
    return `${Math.round(association.confidence * 100)}%`
  }
  return t ? t('Unverified', 'לא מאומת') : 'Unverified'
}
