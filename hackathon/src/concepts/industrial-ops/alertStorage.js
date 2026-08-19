// Industrial Ops — session persistence for the local alert workflow (Phase A0).
//
// sessionStorage, deliberately, not localStorage:
//   - refreshing the same tab must not throw away a shift's acknowledgements;
//   - a new tab must NOT inherit another operator's workflow, because none of
//     this is server state and pretending otherwise across tabs would be worse
//     than losing it.
//
// Nothing here is a claim of persistence. Every alert carries persisted:false /
// sessionLocal:true and the UI is required to say SESSION-LOCAL · NOT
// SERVER-PERSISTED.
//
// Reading NEVER throws. Corrupt JSON, an older schema, a blocked storage in
// private mode or a hand-edited value all resolve to null, and the caller starts
// from an empty state. A dashboard that crashes on bad storage is worse than one
// that quietly starts fresh.

export const STORAGE_KEY = 'industrial-ops-alert-state-v1'
export const SCHEMA_VERSION = 1

export function createInitialPersistedState() {
  return {
    alerts: [],
    selection: { selectedAreaId: null, selectedAlertId: null, lastSelectedCameraId: null },
    // Mirrors DEFAULT_FILTERS in alertSelectors.js. `activity` is the condition
    // axis (ACTIVE / CLEARED) and is stored like any other filter — Phase A2
    // needs a restored session to have exactly the shape a fresh one has.
    filters: {
      lifecycle: 'ALL_ACTIVE',
      areaId: 'ALL',
      severity: 'ALL',
      sourceType: 'ALL',
      activity: 'ALL',
      query: '',
    },
  }
}

function safeStorage(explicit) {
  if (explicit) return explicit
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    // Storage access can throw outright under strict privacy settings.
    return null
  }
}

export function serializeState(state, { isDemo = false, now = Date.now() } = {}) {
  return {
    v: SCHEMA_VERSION,
    savedAt: now,
    isDemo: Boolean(isDemo),
    alerts: Array.isArray(state?.alerts) ? state.alerts : [],
    selection: {
      selectedAreaId: state?.selection?.selectedAreaId ?? null,
      selectedAlertId: state?.selection?.selectedAlertId ?? null,
      // A UI preference only. It is never treated as the source of an alert.
      lastSelectedCameraId: state?.selection?.lastSelectedCameraId ?? null,
    },
    filters: { ...createInitialPersistedState().filters, ...(state?.filters || {}) },
  }
}

/**
 * Parses stored state. Returns null for anything it does not fully trust.
 * @param raw     the raw string from storage
 * @param isDemo  the CURRENT session mode — demo state is never restored into a
 *                live session, or live state into a demo one, so the two sets
 *                of alerts can never mix.
 */
export function deserializeState(raw, { isDemo = false } = {}) {
  if (typeof raw !== 'string' || !raw) return null

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.v !== SCHEMA_VERSION) return null
  if (Boolean(parsed.isDemo) !== Boolean(isDemo)) return null
  if (!Array.isArray(parsed.alerts)) return null

  const alerts = parsed.alerts.filter(isPlausibleAlert).map(normalizeAlert)

  const base = createInitialPersistedState()
  return {
    alerts,
    selection: {
      selectedAreaId: stringOrNull(parsed.selection?.selectedAreaId),
      selectedAlertId: stringOrNull(parsed.selection?.selectedAlertId),
      lastSelectedCameraId: stringOrNull(parsed.selection?.lastSelectedCameraId),
    },
    filters: { ...base.filters, ...pickFilters(parsed.filters) },
  }
}

// Minimum shape an entry must have to be usable. Anything else is dropped
// individually rather than failing the whole restore.
function isPlausibleAlert(alert) {
  return Boolean(
    alert &&
    typeof alert === 'object' &&
    typeof alert.id === 'string' &&
    typeof alert.fingerprint === 'string' &&
    typeof alert.lifecycle === 'string'
  )
}

// Re-asserts the invariants a restored alert must satisfy, so a hand-edited
// entry cannot claim to be server-persisted.
function normalizeAlert(alert) {
  return {
    ...alert,
    persisted: false,
    sessionLocal: true,
    active: Boolean(alert.active),
    actionLog: Array.isArray(alert.actionLog) ? alert.actionLog : [],
    sourceEvidence: Array.isArray(alert.sourceEvidence) ? alert.sourceEvidence : [],
    otherActiveEvidenceInArea: Array.isArray(alert.otherActiveEvidenceInArea)
      ? alert.otherActiveEvidenceInArea
      : [],
    instanceSeq: Number.isFinite(alert.instanceSeq) ? alert.instanceSeq : 1,
    reactivationCount: Number.isFinite(alert.reactivationCount) ? alert.reactivationCount : 0,
  }
}

function stringOrNull(value) {
  return typeof value === 'string' && value ? value : null
}

function pickFilters(filters) {
  if (!filters || typeof filters !== 'object') return {}
  const out = {}
  for (const key of ['lifecycle', 'areaId', 'severity', 'sourceType', 'activity', 'query']) {
    if (typeof filters[key] === 'string') out[key] = filters[key]
  }
  return out
}

/** Loads persisted state, or null. Never throws. */
export function loadState({ isDemo = false, storage = null, key = STORAGE_KEY } = {}) {
  const store = safeStorage(storage)
  if (!store) return null
  try {
    return deserializeState(store.getItem(key), { isDemo })
  } catch {
    return null
  }
}

/** Saves state. Returns false when storage is unavailable or full. Never throws. */
export function saveState(state, { isDemo = false, storage = null, key = STORAGE_KEY, now = Date.now() } = {}) {
  const store = safeStorage(storage)
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(serializeState(state, { isDemo, now })))
    return true
  } catch {
    // Quota exceeded or storage disabled: the workflow keeps running in memory.
    return false
  }
}

export function clearState({ storage = null, key = STORAGE_KEY } = {}) {
  const store = safeStorage(storage)
  if (!store) return false
  try {
    store.removeItem(key)
    return true
  } catch {
    return false
  }
}
