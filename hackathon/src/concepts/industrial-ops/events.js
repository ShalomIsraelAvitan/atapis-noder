// Which session event the operational bar should show.
//
// The alert feed is chronological, so "the newest entry" is often a routine
// `Person detected` that arrived a tick after the event that actually matters
// (a weapon, or a SAFE -> DANGER transition). The bar picks by significance
// first and recency second. This is presentation only: no event is created,
// dropped or re-timed, and the Session Log still shows everything.

const RANK = {
  WEAPON: 100,
  MODE_DANGER: 90,
  MODE_ALERT: 80,
  SUBSYSTEM_FAILURE: 70,
  DEGRADED: 60,
  OPERATOR: 50,
  MODE_OTHER: 40,
  PERSON: 20,
  INFO: 10,
}

export function alertRank(alert) {
  if (!alert) return -1
  const msg = String(alert.message || '').toUpperCase()

  if (alert.kind === 'weapon' || /WEAPON/.test(msg)) return RANK.WEAPON
  if (alert.kind === 'mode') {
    if (/DANGER/.test(msg)) return RANK.MODE_DANGER
    if (/ALERT/.test(msg)) return RANK.MODE_ALERT
    return RANK.MODE_OTHER
  }
  if (alert.kind === 'connection' || alert.kind === 'controller') {
    return /LOST|OFFLINE|DISCONNECT|NOT FOUND|FAIL/.test(msg) ? RANK.SUBSYSTEM_FAILURE : RANK.DEGRADED
  }
  if (alert.kind === 'operator') return RANK.OPERATOR
  if (alert.kind === 'person') return RANK.PERSON

  if (alert.severity === 'danger') return RANK.MODE_DANGER
  if (alert.severity === 'alert') return RANK.DEGRADED
  return RANK.INFO
}

/**
 * Highest-ranked alert from the most recent window; ties resolve to the newer
 * entry because `alerts` is newest-first. The returned object is the original
 * alert, so its real timestamp travels with it.
 */
export function pickHeadlineAlert(alerts, window = 12) {
  if (!Array.isArray(alerts) || !alerts.length) return null
  let best = null
  let bestRank = -1
  for (const alert of alerts.slice(0, window)) {
    const rank = alertRank(alert)
    if (rank > bestRank) {
      bestRank = rank
      best = alert
    }
  }
  return best
}
