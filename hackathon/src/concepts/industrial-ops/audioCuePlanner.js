// Industrial Ops — deciding WHETHER a sound is owed (Phase A3).
//
// This module is pure and has no imports. It never touches the DOM, the clock,
// storage or Web Audio. Given the alert list the engine already produced and a
// small bookkeeping value, it answers one question: does this update owe the
// operator a cue, and if so which one. Everything about actually making noise
// lives in operationalSoundEngine.js, and everything about React lives in
// useOperationalAudio.js. That separation is what makes the ~50 detection rules
// testable in Node without a browser.
//
// Identity is A0's and only A0's: `alert.id` (`${fingerprint}#${instanceSeq}`).
// No Date.now(), no random, no array index, no message text. A0 already decided
// what counts as "the same alert coming back" (the 15s reactivation window keeps
// the id; a later return gets a fresh instanceSeq and therefore a new id) and A3
// simply consumes that verdict.
//
// The book is in memory only. It is deliberately NOT persisted: a reload is not
// a new threat, and storing which ids have already sounded would both lie about
// what the session witnessed and violate the storage schema.

export const CUE = { ALERT: 'alert', DANGER: 'danger' }

// Lowercase to match SEVERITY in alerts.js. INFO exists in the ranking so that a
// later rise out of INFO registers as an escalation, but rank 1 never sounds.
export const CUE_SEVERITY_RANK = { info: 1, alert: 2, danger: 3 }

const MIN_AUDIBLE_RANK = CUE_SEVERITY_RANK.alert

/**
 * The sentinel for "nothing has been accounted for yet".
 *
 * The next planAudioCues() call therefore runs as a baseline pass: it absorbs
 * whatever is on screen in silence. That single fact is what makes the initial
 * load, a reload, a restored session and a fresh Demo seed all silent without
 * any of them needing a special case.
 */
export function createAudioBook() {
  return null
}

/**
 * Decide the cue owed by this update.
 *
 * @param {object|null} book    previous bookkeeping, or null for a baseline pass
 * @param {Array}       alerts  the FULL canonical alert list (never the filtered view)
 * @param {{mode: string}} opts 'demo' | 'live' — a mode change re-baselines
 * @returns {{cue: 'alert'|'danger'|null, nextBook: object}}
 */
export function planAudioCues(book, alerts, { mode } = {}) {
  const currentMode = mode === 'demo' ? 'demo' : 'live'

  // A book from the other mode is not evidence about this one. Discarding it
  // gives both halves of the rule at once: no backlog when the operator switches,
  // and no chance of a Demo id silencing a Live alert that happens to share it.
  const baseline = !book || book.mode !== currentMode
  const previous = baseline ? null : book.entries

  // Rebuilt every pass rather than mutated. This is the whole garbage collection
  // story: the book can never outgrow the list it describes (A0 prunes at 200),
  // and an id the engine has dropped simply stops being remembered.
  const entries = new Map()
  let top = 0

  for (const alert of Array.isArray(alerts) ? alerts : []) {
    if (!alert || typeof alert.id !== 'string') continue

    const rank = CUE_SEVERITY_RANK[alert.severity] || CUE_SEVERITY_RANK.info
    const accounted = previous ? previous.get(alert.id) : undefined
    // A0 already marks the alerts that were simply there when this observation
    // began — the first snapshot after mounting, after returning to OPS from
    // another screen, or after a Demo/Live flip. They are not events that
    // happened to a watching operator, so they never sound, even though the
    // model has only just built them.
    const audible = alert.active && rank >= MIN_AUDIBLE_RANK && !alert.observedFromSessionStart

    if (accounted === undefined) {
      // An id this session has never accounted for.
      if (!baseline && audible) top = Math.max(top, rank)
      entries.set(alert.id, rank)
    } else if (rank > accounted) {
      // The same id got worse. Defensive: the current engine never patches
      // severity in place (reduceAlerts only refreshes message/lastSeen/source),
      // so a real escalation arrives as a NEW id. This branch exists so that if
      // that ever changes, an ALERT that becomes a DANGER is heard exactly once
      // rather than silently swallowed.
      if (!baseline && audible) top = Math.max(top, rank)
      entries.set(alert.id, rank)
    } else {
      // Keep the high-water mark. A downgrade is not an event, and a condition
      // that flaps between severities must not chirp on every swing.
      entries.set(alert.id, accounted)
    }
  }

  // One cue per update, never a queue: ten new alerts in a single poll are one
  // sound, and a DANGER anywhere in the batch outranks every ALERT in it.
  const cue = top >= CUE_SEVERITY_RANK.danger
    ? CUE.DANGER
    : top >= CUE_SEVERITY_RANK.alert
      ? CUE.ALERT
      : null

  return { cue, nextBook: { mode: currentMode, entries } }
}

/**
 * What the control should say. Pure, so the honesty rule is testable.
 *
 * Mute wins because it is the operator's own decision and nothing about the
 * hardware changes it. Otherwise the answer comes from the AudioContext itself:
 * READY is claimed only for a context verified to be running. A suspended
 * context is BLOCKED even when the stored preference says unmuted, because the
 * preference is intent and the context is capability.
 */
export function soundDisplayState({ muted, engineState } = {}) {
  if (muted) return 'MUTED'
  if (engineState === 'unsupported' || engineState === 'error' || engineState === 'closed') return 'ERROR'
  if (engineState === 'running') return 'READY'
  return 'BLOCKED'
}
