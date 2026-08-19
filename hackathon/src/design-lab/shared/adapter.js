// Normalizes the raw ATAPIS API payloads into one snapshot shape shared by
// all four Design Lab concepts. Pure functions only — no fetching, no state.
// Field semantics (mode, risk values, behavior states) come from the backend
// as-is; nothing is re-interpreted here.

export const MODES = ['SAFE', 'ALERT', 'DANGER']

export function modeTone(mode) {
  if (mode === 'DANGER') return 'danger'
  if (mode === 'ALERT') return 'alert'
  return 'safe'
}

// Display-only mirror of the server thresholds (server decides the mode;
// this is used only to color per-track / per-target risk numbers).
export function riskTone(risk) {
  const value = Number(risk) || 0
  if (value >= 75) return 'danger'
  if (value >= 40) return 'alert'
  return 'safe'
}

// Maps the hook's backend link state to a StatusDot state.
export function backendDotState(backendStatus) {
  if (backendStatus === 'ok') return 'ok'
  if (backendStatus === 'reconnecting' || backendStatus === 'connecting') return 'warn'
  return 'err'
}

const num = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function adaptTrack(track) {
  if (!track || typeof track !== 'object') return null
  return {
    id: track.id ?? '?',
    state: track.state || 'detected',
    risk: num(track.risk),
    speed: num(track.speed),
    hasWeapon: Boolean(track.has_weapon),
    zone: track.zone ?? null,
    approachingGate: Boolean(track.approaching_gate),
    bbox: Array.isArray(track.bbox) ? track.bbox : null,
  }
}

function adaptRadarTarget(target) {
  if (!target || typeof target !== 'object') return null
  const speedCmS =
    target.speed_cm_s !== undefined && target.speed_cm_s !== null
      ? num(target.speed_cm_s)
      : num(target.speed_mm_s) / 10
  return {
    id: target.id ?? target.radar_id ?? 0,
    xMm: num(target.x_mm),
    yMm: num(target.y_mm),
    distanceMm: num(target.distance_mm),
    angleDeg: num(target.angle_deg),
    speedCmS,
    direction: target.direction || 'stationary',
    approachingGate: Boolean(target.approaching_gate),
    confidence: num(target.confidence),
    risk: num(target.radar_risk),
    valid: target.valid !== false,
  }
}

function adaptCameraSource(source) {
  if (!source || typeof source !== 'object') {
    return {
      connected: false,
      status: 'unknown',
      mode: 'SAFE',
      fusedRisk: 0,
      personCount: 0,
      hasWeapon: false,
      weaponDetectionAvailable: null,
      lastError: null,
      context: null,
    }
  }
  return {
    connected: Boolean(source.connected),
    status: source.status || 'unknown',
    mode: source.mode || 'SAFE',
    fusedRisk: num(source.fused_risk, num(source.max_risk)),
    personCount: num(source.person_count),
    hasWeapon: Boolean(source.has_weapon),
    weaponDetectionAvailable: source.weapon_detection_available ?? null,
    lastError: source.last_error || null,
    context: source.context || null,
    subtype: source.subtype,
    lastFrameTime: source.last_frame_time || null,
    lastUpdate: source.last_update || null,
  }
}

// Radar targets live in x: ±3000mm (lateral), y: 0–8000mm (forward).
// Same mapping the production dashboard uses (CameraRoom.jsx getRadarMapPosition).
export const RADAR_RANGE = { xMm: 3000, yMm: 8000 }

export function radarMapPosition(target) {
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
  const xRatio = clamp(target.xMm / RADAR_RANGE.xMm, -1, 1)
  const yRatio = clamp(target.yMm / RADAR_RANGE.yMm, 0, 1)
  return { xRatio, yRatio }
}

export function formatDistance(distanceMm) {
  return `${(num(distanceMm) / 1000).toFixed(1)} m`
}

export function formatSpeed(speedCmS) {
  return `${(num(speedCmS) / 100).toFixed(2)} m/s`
}

export function adaptSnapshot({ status, radar, cameras }) {
  const radarPayload = radar || status?.radar || null
  const targets = Array.isArray(radarPayload?.targets)
    ? radarPayload.targets.map(adaptRadarTarget).filter(Boolean).filter((t) => t.valid)
    : []
  const tracks = Array.isArray(status?.tracks)
    ? status.tracks.map(adaptTrack).filter(Boolean)
    : []

  return {
    mode: status?.mode || 'SAFE',
    systemActive: status?.status === 'active',
    lastUpdate: status?.last_update || null,
    profile: status?.profile || null,
    context: status?.context || null,
    motion: status?.motion || null,
    distanceCm:
      status?.distance !== null && status?.distance !== undefined
        ? num(status.distance)
        : null,
    hasPerson: Boolean(status?.has_person),
    personCount: num(status?.person_count),
    hasWeapon: Boolean(status?.has_weapon),
    weaponType: status?.weapon_type || null,
    risks: {
      camera: num(status?.camera_risk, num(status?.max_risk)),
      radar: num(radarPayload?.max_radar_risk, num(status?.radar_risk)),
      fused: num(status?.fused_risk, num(status?.max_risk)),
      max: num(status?.max_risk),
    },
    tracks,
    radar: {
      enabled: radarPayload?.enabled !== false,
      provider: radarPayload?.provider || null,
      scenario: radarPayload?.scenario || null,
      connected: Boolean(radarPayload?.radar_connected),
      status: radarPayload?.radar_status || (radarPayload?.radar_connected ? 'OK' : 'DISCONNECTED'),
      lastUpdateMs:
        radarPayload?.last_update_ms !== undefined ? radarPayload.last_update_ms : null,
      lastError: radarPayload?.last_error || null,
      targetsCount: num(radarPayload?.targets_count, targets.length),
      maxRisk: num(radarPayload?.max_radar_risk),
      confidence: num(radarPayload?.confidence),
      targets,
    },
    cameras: {
      webcam: adaptCameraSource(cameras?.webcam),
      dahua: adaptCameraSource(cameras?.dahua),
    },
  }
}

export const EMPTY_SNAPSHOT = adaptSnapshot({ status: null, radar: null, cameras: null })
