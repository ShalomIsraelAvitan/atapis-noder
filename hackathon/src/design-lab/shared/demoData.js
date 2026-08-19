// Client-side demo timeline for Design Lab preview mode ONLY.
// Used when the backend is unreachable or when ?demo=1 is set explicitly.
// Every snapshot produced here is clearly labeled "DEMO DATA — DESIGN PREVIEW"
// by the UI. Shapes mirror the real API responses exactly (see adapter.js) —
// no fields are invented beyond the documented contract.

const PHASES = [
  { key: 'idle', duration: 6 },
  { key: 'detected', duration: 8 },
  { key: 'approach', duration: 12 },
  { key: 'armed', duration: 10 },
  { key: 'retreat', duration: 8 },
]
const CYCLE = PHASES.reduce((sum, phase) => sum + phase.duration, 0)

export const DEMO_PHASES = PHASES.map((phase) => phase.key)

function phaseAt(elapsedSeconds) {
  let t = elapsedSeconds % CYCLE
  for (const phase of PHASES) {
    if (t < phase.duration) return { key: phase.key, t, progress: t / phase.duration }
    t -= phase.duration
  }
  return { key: 'idle', t: 0, progress: 0 }
}

const lerp = (a, b, p) => a + (b - a) * p

function buildRawSnapshot(phase, progress, nowSeconds) {
  const timeLabel = new Date(nowSeconds * 1000).toLocaleTimeString('en-GB')

  // Radar target walks in from ~7m, closes to ~1.8m during "armed".
  const base = {
    idle: null,
    detected: { y: lerp(7000, 5200, progress), x: lerp(-900, -400, progress), speed: 38, dir: 'approaching' },
    approach: { y: lerp(5200, 2600, progress), x: lerp(-400, 250, progress), speed: 96, dir: 'approaching' },
    armed: { y: lerp(2600, 1800, progress), x: lerp(250, 120, progress), speed: 22, dir: 'approaching' },
    retreat: { y: lerp(1800, 6400, progress), x: lerp(120, -700, progress), speed: 110, dir: 'receding' },
  }[phase]

  const target = base
    ? {
        id: 1,
        radar_id: 1,
        x_mm: Math.round(base.x),
        y_mm: Math.round(base.y),
        distance_mm: Math.round(Math.hypot(base.x, base.y)),
        angle_deg: Number((Math.atan2(base.x, base.y) * (180 / Math.PI)).toFixed(1)),
        speed_cm_s: base.speed,
        speed_mm_s: base.speed * 10,
        resolution_mm: 120,
        direction: base.dir,
        approaching_gate: phase === 'approach' || phase === 'armed',
        confidence: 0.9,
        radar_risk: { detected: 24, approach: 48, armed: 62, retreat: 18 }[phase] ?? 0,
        timestamp: nowSeconds,
        valid: true,
      }
    : null

  const trackByPhase = {
    idle: null,
    detected: { state: 'detected', risk: 12, speed: 40 },
    approach: { state: 'approaching', risk: Math.round(lerp(35, 58, progress)), speed: 150 },
    armed: { state: 'armed', risk: Math.round(lerp(78, 92, progress)), speed: 25, weapon: true },
    retreat: { state: 'detected', risk: Math.round(lerp(45, 15, progress)), speed: 130 },
  }[phase]

  const cameraRisk = trackByPhase ? trackByPhase.risk : 0
  const radarRisk = target ? target.radar_risk : 0
  const fused = { idle: 0, detected: 16, approach: Math.round(lerp(42, 60, progress)), armed: Math.round(lerp(82, 94, progress)), retreat: Math.round(lerp(38, 10, progress)) }[phase]
  const mode = fused >= 75 ? 'DANGER' : fused >= 40 ? 'ALERT' : 'SAFE'

  const status = {
    status: 'active',
    last_update: timeLabel,
    mode,
    camera_mode: mode,
    profile: 'perimeter',
    has_person: Boolean(trackByPhase),
    person_count: trackByPhase ? 1 : 0,
    has_weapon: Boolean(trackByPhase?.weapon),
    weapon_type: trackByPhase?.weapon ? 'weapon' : null,
    motion: trackByPhase ? (trackByPhase.speed >= 120 ? 'running' : trackByPhase.speed >= 15 ? 'walking' : 'standing') : null,
    max_risk: cameraRisk,
    camera_risk: cameraRisk,
    radar_risk: radarRisk,
    fused_risk: fused,
    distance: target ? Math.round(target.distance_mm / 10) : null,
    context: {
      idle: 'Perimeter clear.',
      detected: 'Person detected near fence line.',
      approach: 'Person approaching gate at speed.',
      armed: 'Weapon associated with tracked person.',
      retreat: 'Target moving away from perimeter.',
    }[phase],
    tracks: trackByPhase
      ? [
          {
            id: 7,
            state: trackByPhase.state,
            risk: trackByPhase.risk,
            speed: trackByPhase.speed,
            has_weapon: Boolean(trackByPhase.weapon),
            zone: phase === 'approach' || phase === 'armed' ? 'gate' : 'fence',
            approaching_gate: phase === 'approach' || phase === 'armed',
            bbox: [420, 180, 640, 620],
          },
        ]
      : [],
  }

  const radar = {
    enabled: true,
    mode: 'mock',
    provider: 'demo',
    scenario: `design-preview:${phase}`,
    radar_connected: true,
    radar_status: 'MOCK',
    last_update_ms: 40,
    targets_count: target ? 1 : 0,
    targets: target ? [target] : [],
    max_radar_risk: radarRisk,
    confidence: target ? target.confidence : 0,
    last_error: null,
  }

  const cameraSource = {
    connected: true,
    status: 'active',
    mode,
    fused_risk: fused,
    person_count: status.person_count,
    has_weapon: status.has_weapon,
    weapon_detection_available: true,
    last_error: null,
    context: status.context,
    last_update: timeLabel,
  }

  return {
    status,
    radar,
    cameras: {
      webcam: cameraSource,
      dahua: { ...cameraSource, subtype: 1, last_frame_time: timeLabel },
    },
  }
}

// `freezePhase` pins the timeline to the middle of a named phase — used for
// fair side-by-side screenshots of all four concepts (?demo=1&phase=approach).
export function demoRawSnapshot(elapsedSeconds, freezePhase = null) {
  const now = Date.now() / 1000
  if (freezePhase && DEMO_PHASES.includes(freezePhase)) {
    return buildRawSnapshot(freezePhase, 0.5, now)
  }
  const { key, progress } = phaseAt(elapsedSeconds)
  return buildRawSnapshot(key, progress, now)
}
