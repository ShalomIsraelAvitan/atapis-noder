// Canonical "Why this risk?" derivation for the full-site concepts.
// Uses ONLY signals the backend actually reports — no invented rationale.
// Numeric "contribution" is shown only where a real number exists
// (camera_risk / radar_risk / per-target radar_risk); otherwise 'unavailable'.
import { formatDistance, formatSpeed } from '../../design-lab/shared/adapter'

export function buildRiskReasons(snapshot, t = (en) => en) {
  const reasons = []
  const add = (key, severity, source, en, he, contribution = null) =>
    reasons.push({ key, severity, source, text: t(en, he), contribution })

  if (snapshot.hasPerson) {
    add('person', 'info', 'camera', 'Person detected', 'זוהה אדם')
  }
  for (const track of snapshot.tracks) {
    const id = track.id
    if (track.state === 'running') {
      add(`run-${id}`, 'alert', 'camera', `Track #${id} running`, `מעקב ‎#${id}‎ בריצה`, track.risk)
    } else if (track.state === 'approaching' || track.approachingGate) {
      add(`appr-${id}`, 'alert', 'camera', `Track #${id} approaching gate`, `מעקב ‎#${id}‎ מתקרב לשער`, track.risk)
    } else if (track.state === 'loitering' || track.state === 'gate_loitering') {
      add(
        `loiter-${id}`, 'alert', 'camera',
        `Track #${id} loitering${track.zone ? ` (${track.zone})` : ''}`,
        `מעקב ‎#${id}‎ משתהה${track.zone ? ` (${track.zone})` : ''}`,
        track.risk
      )
    } else if (track.state === 'detected' && snapshot.motion) {
      add(`motion-${id}`, 'info', 'camera', `Track #${id} ${snapshot.motion}`, `מעקב ‎#${id}‎ — ${snapshot.motion}`, track.risk)
    }
    if (track.hasWeapon || track.state === 'armed') {
      add(`armed-${id}`, 'danger', 'camera', `Track #${id} armed — weapon detected`, `מעקב ‎#${id}‎ חמוש — זוהה נשק`, track.risk)
    }
  }
  if (snapshot.hasWeapon && !snapshot.tracks.some((tr) => tr.hasWeapon)) {
    add('weapon', 'danger', 'camera', 'Weapon detected', 'זוהה נשק')
  }
  for (const target of snapshot.radar.targets) {
    if (target.direction === 'approaching') {
      add(
        `radar-${target.id}`,
        target.approachingGate ? 'alert' : 'info',
        'radar',
        `Radar T${target.id} closing at ${formatSpeed(target.speedCmS)} (${formatDistance(target.distanceMm)})`,
        `רדאר T${target.id} מתקרב ב־${formatSpeed(target.speedCmS)} (${formatDistance(target.distanceMm)})`,
        target.risk
      )
    } else if (target.approachingGate) {
      add(`radar-gate-${target.id}`, 'alert', 'radar', `Radar T${target.id} near gate axis`, `רדאר T${target.id} על ציר השער`, target.risk)
    }
  }
  return reasons
}

// Contribution summary per source — real numbers only (camera_risk / radar_risk).
export function sourceContributions(snapshot) {
  return {
    camera: { risk: snapshot.risks.camera, confidence: null }, // no camera confidence in API
    radar: {
      risk: snapshot.risks.radar,
      confidence: snapshot.radar.confidence || null, // real (max of per-target)
    },
    fused: { risk: snapshot.risks.fused, confidence: null }, // no fused confidence in API
  }
}
