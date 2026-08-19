// The one-sentence operational summary shown at the top of a command screen.
//
// Goal: the operator must not have to assemble five numbers from five cards to
// learn what is happening. Every claim here is composed from values the backend
// actually reports — nothing is inferred beyond what buildRiskReasons already
// derives, and no severity is invented.
//
// This deliberately does NOT reuse buildActivitySummary (useDashboardViewModel):
// that returns a list of independent bullet statements consumed by
// ActivitySummary in five views. It keeps its [en, he] pair convention.
//
// "Fused Risk" here always means snapshot.risks.fused — the backend value.
import { formatDistance, formatSpeed, modeTone } from '../../design-lab/shared/adapter'

// First match wins. Ordered by operational urgency, not by data availability.
function primaryClaim(snapshot) {
  const tracks = snapshot.tracks || []
  const targets = snapshot.radar?.targets || []

  const armed = tracks.find((track) => track.hasWeapon || track.state === 'armed')
  if (armed) {
    return [`Person #${armed.id} armed — weapon detected`, `אדם ‎#${armed.id}‎ חמוש — זוהה נשק`]
  }
  if (snapshot.hasWeapon) {
    return ['Weapon detected in frame', 'זוהה נשק בפריים']
  }

  const running = tracks.find((track) => track.state === 'running')
  if (running) {
    return [`Person #${running.id} running`, `אדם ‎#${running.id}‎ בריצה`]
  }

  const approaching = tracks.find(
    (track) => track.approachingGate || track.state === 'approaching'
  )
  if (approaching) {
    return [`Person #${approaching.id} approaching the gate`, `אדם ‎#${approaching.id}‎ מתקרב לשער`]
  }

  const loitering = tracks.find(
    (track) => track.state === 'loitering' || track.state === 'gate_loitering'
  )
  if (loitering) {
    const zone = loitering.zone ? ` (${loitering.zone})` : ''
    return [`Person #${loitering.id} loitering${zone}`, `אדם ‎#${loitering.id}‎ משתהה${zone}`]
  }

  const closing = targets.find((target) => target.direction === 'approaching')
  if (closing) {
    return [`Radar target T${closing.id} closing`, `מטרת רדאר T${closing.id} מתקרבת`]
  }

  if (snapshot.personCount > 0) {
    const plural = snapshot.personCount === 1 ? 'person' : 'persons'
    return [`${snapshot.personCount} ${plural} tracked`, `‏${snapshot.personCount} אנשים במעקב`]
  }
  if (targets.length > 0) {
    return [`${targets.length} radar target(s) present`, `‏${targets.length} מטרות רדאר נוכחות`]
  }
  return ['No active contacts', 'אין מגעים פעילים']
}

// Distance / speed come from the radar only — the camera reports px/s, which is
// not a ground speed and must never be printed as one.
function contactMetrics(snapshot) {
  const targets = snapshot.radar?.targets || []
  if (!targets.length) return []
  const lead = targets.reduce((best, t) => (t.risk > best.risk ? t : best), targets[0])
  return [
    [`Distance ${formatDistance(lead.distanceMm)}`, `מרחק ${formatDistance(lead.distanceMm)}`],
    [`Speed ${formatSpeed(lead.speedCmS)}`, `מהירות ${formatSpeed(lead.speedCmS)}`],
  ]
}

/**
 * @param snapshot adapted snapshot
 * @param linkage  from buildCandidatePairs — used only to state honestly that
 *                 no verified camera<->radar association exists
 * @returns { headline: [en, he], subline: [en, he], tone }
 */
export function buildDecisionSentence(snapshot, { linkage = null } = {}) {
  const mode = snapshot?.mode || 'SAFE'
  const risks = snapshot?.risks || { fused: 0, camera: 0, radar: 0 }
  const [claimEn, claimHe] = primaryClaim(snapshot || {})

  const headline = [
    `${mode} · Fused Risk ${risks.fused} · ${claimEn}`,
    `${mode} · סיכון ממוזג ${risks.fused} · ${claimHe}`,
  ]

  const metrics = contactMetrics(snapshot || {})
  const subEn = [`Camera ${risks.camera}`, `Radar ${risks.radar}`, ...metrics.map(([en]) => en)]
  const subHe = [`מצלמה ${risks.camera}`, `רדאר ${risks.radar}`, ...metrics.map(([, he]) => he)]

  // State the association gap explicitly rather than letting two IDs sitting
  // near each other imply a link the system never computed.
  if (linkage && linkage.pairedCount === 0 && (linkage.unpairedCamera || linkage.unpairedRadar)) {
    subEn.push('Association unavailable')
    subHe.push('שיוך לא זמין')
  }

  return {
    headline,
    subline: [subEn.join(' · '), subHe.join(' · ')],
    tone: modeTone(mode),
  }
}

// Radar detail as its own sentence rather than a clause appended to a risk list.
function radarSentence(snapshot) {
  const targets = snapshot?.radar?.targets || []
  if (!targets.length) return null
  const lead = targets.reduce((best, t) => (t.risk > best.risk ? t : best), targets[0])
  const distance = formatDistance(lead.distanceMm)
  const speed = formatSpeed(lead.speedCmS)
  return [
    `Radar target T${lead.id} detected at ${distance} · ${speed}.`,
    `מטרת רדאר T${lead.id} זוהתה במרחק ${distance} · ${speed}.`,
  ]
}

/**
 * Operator-facing multi-sentence variant of buildDecisionSentence, opted into by
 * a concept passing the result to RiskDecisionHeader's `sentence` prop.
 *
 * buildDecisionSentence above is deliberately left untouched: it is rendered by
 * every concept, and changing its wording would alter screens outside this
 * change's scope.
 *
 * The association line states the gap in plain words whenever the shown pair is
 * unverified — two IDs sitting next to each other must never be left to imply a
 * link the backend never computed. A numeric confidence appears only for demo
 * scenario data, where the caller also renders a DemoModeBadge.
 *
 * @returns { headline: [en, he], radarLine: [en, he]|null,
 *            associationLine: [en, he]|null, tone }
 */
export function buildOperatorSentence(snapshot, { linkage = null, pair = null } = {}) {
  const mode = snapshot?.mode || 'SAFE'
  const [claimEn, claimHe] = primaryClaim(snapshot || {})

  const headline = [`${mode} — ${claimEn}.`, `${mode} — ${claimHe}.`]

  let associationLine = null
  if (pair?.associationState === 'demo-verified' && pair.association?.confidence !== null) {
    const pct = Math.round(pair.association.confidence * 100)
    associationLine = [`Association ${pct}% · DEMO`, `שיוך ${pct}% · הדגמה`]
  } else if (pair || (linkage && (linkage.unpairedCamera || linkage.unpairedRadar))) {
    associationLine = ['Association unavailable.', 'שיוך לא זמין.']
  }

  return {
    headline,
    radarLine: radarSentence(snapshot || {}),
    associationLine,
    tone: modeTone(mode),
  }
}
