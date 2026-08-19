// Demo data for the full-site concepts ONLY (never touches the legacy
// design-lab demoData behavior). Used exclusively in forced demo mode
// (?demo=1) and always rendered under the "DEMO DATA — DESIGN PREVIEW" label.
// Shapes mirror GET /api/detections items exactly.

const PHASES = [
  { motion: 'walking', mode: 'SAFE', context: 'detected', cam: 14, radar: 10, fused: 16, weapon: false },
  { motion: 'walking', mode: 'ALERT', context: 'approaching', cam: 47, radar: 42, fused: 51, weapon: false },
  { motion: 'running', mode: 'ALERT', context: 'approaching', cam: 58, radar: 48, fused: 62, weapon: false },
  { motion: 'walking', mode: 'DANGER', context: 'armed', cam: 92, radar: 55, fused: 95, weapon: true },
  { motion: 'standing', mode: 'ALERT', context: 'gate_loitering', cam: 44, radar: 30, fused: 49, weapon: false },
  { motion: 'walking', mode: 'SAFE', context: 'detected', cam: 18, radar: 8, fused: 20, weapon: false },
]

export function demoDetections(count = 18) {
  const now = Date.now()
  const items = []
  for (let i = 0; i < count; i += 1) {
    const phase = PHASES[i % PHASES.length]
    const ts = new Date(now - (i + 1) * 9 * 60 * 1000) // every ~9 minutes back
    items.push({
      filename: null, // no real snapshot in demo — UI must show Unavailable
      timestamp: ts.toISOString(),
      source: i % 3 === 0 ? 'dahua' : 'webcam',
      motion: phase.motion,
      mode: phase.mode,
      camera_mode: phase.mode,
      context: phase.context,
      confidence: 0.8,
      camera_risk: phase.cam,
      radar_risk: phase.radar,
      fused_risk: phase.fused,
      person_count: 1,
      has_weapon: phase.weapon,
      weapon_type: phase.weapon ? 'weapon' : null,
      radar: {
        radar_connected: true,
        radar_status: 'MOCK',
        provider: 'demo',
        targets_count: 1,
        max_radar_risk: phase.radar,
        confidence: 0.9,
        targets: [
          {
            id: 1, radar_id: 1,
            x_mm: 300 - (i % 5) * 120, y_mm: 2200 + (i % 4) * 900,
            distance_mm: 2300 + (i % 4) * 900, angle_deg: 6 - (i % 5) * 3,
            speed_cm_s: phase.motion === 'running' ? 120 : 45,
            direction: 'approaching', approaching_gate: phase.context.includes('approach'),
            confidence: 0.9, radar_risk: phase.radar, valid: true,
          },
        ],
      },
    })
  }
  return items
}
