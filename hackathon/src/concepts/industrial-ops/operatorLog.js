// Industrial Ops — operator actions as session-log entries (Phase A2).
//
// Pure functions, so the merge and the ordering can be proven in Node.
//
// TIMESTAMP HONESTY, the rule this module exists to enforce:
//
//   An operator action has a real timestamp — the moment the operator pressed
//   the button — so it can be placed on a clock and sorted against anything
//   else that has one.
//
//   A session-feed entry may NOT have one. The feed carries a formatted `time`
//   label and an id; for events the adapter derives, the id starts with the
//   epoch, so it can be read back exactly. For controller messages it does not.
//   In that case the entry keeps `at: null`, and this module will not invent a
//   time for it, will not borrow one from a neighbouring event, and will not
//   read the clock. Anything without a trustworthy time keeps its position in
//   its own source order and is never interleaved by a fabricated one.
//
// Nothing here is sent anywhere. These entries are display rows over state that
// already exists in the tab, and every one of them is labelled SESSION-LOCAL.

const ACTION_LABEL = {
  acknowledge: { en: 'ACKNOWLEDGED', he: 'אושרה' },
  review: { en: 'IN REVIEW', he: 'בטיפול' },
  resolve: { en: 'RESOLVED', he: 'נסגרה' },
  reopen: { en: 'REOPENED', he: 'נפתחה מחדש' },
  edit_note: { en: 'RESOLVE NOTE EDITED', he: 'הערת הסגירה נערכה' },
}

const LIFECYCLE_LABEL = {
  NEW: { en: 'NEW', he: 'חדשה' },
  ACKNOWLEDGED: { en: 'ACKNOWLEDGED', he: 'אושרה' },
  IN_REVIEW: { en: 'IN REVIEW', he: 'בטיפול' },
  RESOLVED: { en: 'RESOLVED', he: 'נסגרה' },
}

const REASON_LABEL = {
  false_alarm: { en: 'FALSE ALARM', he: 'התראת שווא' },
  no_threat: { en: 'NO THREAT', he: 'אין איום' },
  handled: { en: 'HANDLED', he: 'טופל' },
  sensor_issue: { en: 'SENSOR ISSUE', he: 'תקלה בחיישן' },
  other: { en: 'OTHER', he: 'אחר' },
}

const pick = (map, key, lang) => (map[key] ? map[key][lang === 'he' ? 'he' : 'en'] : key || '')

/** Formats an epoch the same way the session feed formats its own clock. */
export function formatLogTime(at) {
  if (!Number.isFinite(at)) return null
  return new Date(at).toLocaleTimeString()
}

/**
 * The epoch a session-feed entry can be trusted to have, or null.
 *
 * Derived events are keyed `${Date.now()}-${index}` by the adapter, so the
 * leading number is the real observation time. Controller entries are keyed by
 * the controller's own message key and carry no time we can stand behind.
 */
export function sessionEntryEpoch(entry) {
  const id = entry?.id
  if (typeof id !== 'string') return null
  const head = id.split('-')[0]
  if (!/^\d+$/.test(head)) return null
  const value = Number(head)
  return Number.isFinite(value) ? value : null
}

/**
 * Operator actions as log rows, newest first.
 *
 * `areaId` is copied from the alert the action was performed on. That is the
 * declared area the alert already belongs to — it is read from the model, never
 * guessed from a source type.
 */
export function operatorLogEntries(alerts, { lang = 'en' } = {}) {
  const rows = []
  for (const alert of Array.isArray(alerts) ? alerts : []) {
    for (const entry of Array.isArray(alert?.actionLog) ? alert.actionLog : []) {
      if (!entry || !Number.isFinite(entry.at)) continue
      const who = entry.operatorName || (lang === 'he' ? 'מפעיל לא מזוהה' : 'UNIDENTIFIED OPERATOR')
      const from = pick(LIFECYCLE_LABEL, entry.from, lang)
      const to = pick(LIFECYCLE_LABEL, entry.to, lang)
      const reason = entry.reason ? ` · ${pick(REASON_LABEL, entry.reason, lang)}` : ''
      // A note edit is not a transition, so printing "RESOLVED → RESOLVED" would
      // describe it as one. It gets its own phrasing (Phase A3.2 §56); the four
      // lifecycle actions keep the from → to form they have always had.
      const isTransition = entry.from !== entry.to
      const headline = isTransition
        ? `${from} → ${to}${reason}`
        : pick(ACTION_LABEL, entry.action, lang)
      rows.push({
        id: `op:${alert.id}:${entry.at}:${entry.action}`,
        at: entry.at,
        time: formatLogTime(entry.at),
        severity: 'info',
        source: 'operator',
        kind: 'operator',
        message: `${headline} · ${who} · SESSION-LOCAL`,
        // From the alert's own declared area. Not inferred, not invented.
        areaId: alert.areaId,
        alertId: alert.id,
        action: entry.action,
        sessionLocal: true,
      })
    }
  }
  return rows.sort((a, b) => b.at - a.at)
}

/**
 * Merges operator rows into the session feed for display.
 *
 * Both inputs are newest-first. Entries with a trustworthy epoch are merged on
 * it; entries without one (controller messages) are NOT given a time and are
 * NOT re-positioned by one — each keeps its place relative to the session
 * entries around it, which is the only ordering its source actually asserts.
 */
export function mergeSessionLog(sessionEntries, operatorEntries) {
  const session = (Array.isArray(sessionEntries) ? sessionEntries : []).map((entry) => ({
    ...entry,
    at: Number.isFinite(entry.at) ? entry.at : sessionEntryEpoch(entry),
  }))
  const operator = Array.isArray(operatorEntries) ? operatorEntries : []
  if (!operator.length) return session

  const out = []
  let i = 0
  let j = 0
  while (i < session.length && j < operator.length) {
    const s = session[i]
    // A timeless entry travels with the entry above it rather than sinking to
    // the bottom of the list: it is emitted in place, in its own source order.
    if (!Number.isFinite(s.at) || s.at >= operator[j].at) {
      out.push(s)
      i += 1
    } else {
      out.push(operator[j])
      j += 1
    }
  }
  while (i < session.length) out.push(session[i++])
  while (j < operator.length) out.push(operator[j++])
  return out
}
