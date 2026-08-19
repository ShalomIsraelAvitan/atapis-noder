// Industrial Ops — the operator's global sound preference (Phase A3).
//
// localStorage, deliberately, not sessionStorage: unlike the alert workflow this
// is a preference about the person, not about a shift. An operator who muted the
// console yesterday should not be startled by it tomorrow, and the same choice
// must hold across Demo and Live because there is only one pair of ears.
//
// What is stored is ONLY the preference:
//
//     { "v": 1, "muted": false }
//
// Never alert ids, never a history of what has already sounded, and never
// anything about audio permission. `muted: false` is a statement of intent, not
// of capability — whether the browser will actually let a tone through is
// AudioContext.state's business and is re-derived from scratch every session.
//
// Reading NEVER throws. Corrupt JSON, an older schema, a hand-edited value or a
// storage blocked by privacy settings all resolve to the default. A console that
// refuses to render because a preference is malformed would be worse than one
// that quietly starts unmuted.

export const AUDIO_PREF_KEY = 'industrial-ops-audio-v1'
export const AUDIO_PREF_SCHEMA_VERSION = 1

export function createDefaultAudioPrefs() {
  return { muted: false }
}

function safeStorage(explicit) {
  if (explicit) return explicit
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    // Storage access can throw outright under strict privacy settings.
    return null
  }
}

export function serializeAudioPrefs(prefs) {
  return { v: AUDIO_PREF_SCHEMA_VERSION, muted: Boolean(prefs?.muted) }
}

/**
 * Read the stored preference. Anything unexpected reads as the default.
 *
 * `storage` is injectable so the logic is testable in Node without a DOM.
 */
export function loadAudioPrefs({ storage = null, key = AUDIO_PREF_KEY } = {}) {
  const store = safeStorage(storage)
  if (!store) return createDefaultAudioPrefs()

  let raw = null
  try {
    raw = store.getItem(key)
  } catch {
    return createDefaultAudioPrefs()
  }
  if (!raw) return createDefaultAudioPrefs()

  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createDefaultAudioPrefs()
  }

  if (!parsed || typeof parsed !== 'object') return createDefaultAudioPrefs()
  if (parsed.v !== AUDIO_PREF_SCHEMA_VERSION) return createDefaultAudioPrefs()
  // Strictly boolean: a truthy string like "false" must not read as muted.
  if (typeof parsed.muted !== 'boolean') return createDefaultAudioPrefs()

  return { muted: parsed.muted }
}

/** Persist the preference. Returns whether the write actually landed. */
export function saveAudioPrefs(prefs, { storage = null, key = AUDIO_PREF_KEY } = {}) {
  const store = safeStorage(storage)
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(serializeAudioPrefs(prefs)))
    return true
  } catch {
    // Quota or a blocked storage. The session still works, muting just will not
    // survive a reload — which is far better than breaking the console.
    return false
  }
}
