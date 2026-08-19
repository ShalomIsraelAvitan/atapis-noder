// Phase A0 — Data Foundations verification.
//
// Proves the twenty scenarios the phase brief requires, against the real
// modules, with no browser and no backend. Every rule in the alert engine is a
// pure function precisely so it can be checked here.
//
// Usage: node scripts/phase-a0-alerts-verify.mjs

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LIFECYCLE,
  REACTIVATION_WINDOW_MS,
  SEVERITY,
  acknowledgeAlert,
  applyLifecycleAction,
  createInitialAlertState,
  reduceAlerts,
  reopenAlert,
  resolveAlert,
  startReviewAlert,
} from '../src/concepts/industrial-ops/alerts.js'
import {
  LIVE_AREAS,
  DEMO_AREAS,
  cameraIdForSourceKey,
  getAreas,
  isSingleAreaDeployment,
} from '../src/concepts/industrial-ops/areas.js'
import {
  LIFECYCLE_FILTERS,
  computeUnseenDanger,
  lifecycleCounts,
  pickDefaultAlertId,
  resolveSelection,
  sortAlerts,
  visibleAlerts,
} from '../src/concepts/industrial-ops/alertSelectors.js'
import {
  STORAGE_KEY,
  deserializeState,
  loadState,
  saveState,
  serializeState,
} from '../src/concepts/industrial-ops/alertStorage.js'
import { demoAlerts } from '../src/concepts/industrial-ops/demoAlerts.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
let passed = 0
const check = (ok, label, detail = '') => {
  if (ok) passed += 1
  else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
}
const section = (name) => console.log(`\n=== ${name} ===`)

// --- fixtures ---------------------------------------------------------------

const AREAS = LIVE_AREAS
const T0 = 1_700_000_000_000

function camera(connected = true) {
  return { connected, status: connected ? 'active' : 'disconnected', mode: 'SAFE', fusedRisk: 0,
    personCount: 0, hasWeapon: false, weaponDetectionAvailable: true, lastError: null, context: null }
}

function track(id, over = {}) {
  return { id, state: 'detected', risk: 10, speed: 20, hasWeapon: false, zone: 'fence',
    approachingGate: false, bbox: null, ...over }
}

function target(id, over = {}) {
  return { id, xMm: 100, yMm: 3000, distanceMm: 3002, angleDeg: 2, speedCmS: 40,
    direction: 'stationary', approachingGate: false, confidence: 0.9, risk: 20, valid: true, ...over }
}

function snap({ mode = 'SAFE', tracks = [], targets = [], radar = {}, cameras = {}, hasWeapon = null } = {}) {
  return {
    mode,
    systemActive: true,
    hasPerson: tracks.length > 0,
    personCount: tracks.length,
    hasWeapon: hasWeapon === null ? tracks.some((t) => t.hasWeapon) : hasWeapon,
    weaponType: null,
    motion: null,
    risks: { camera: 0, radar: 0, fused: 0, max: 0 },
    tracks,
    radar: {
      enabled: true, provider: 'ld2450', connected: true, status: 'OK', lastUpdateMs: 100,
      lastError: null, targetsCount: targets.length, maxRisk: 0, confidence: 0, targets, ...radar,
    },
    cameras: { webcam: camera(true), dahua: camera(false), ...cameras },
  }
}

const run = (state, snapshot, now, extra = {}) =>
  reduceAlerts(state, snapshot, { now, areas: AREAS, isDemo: false, ...extra })

const find = (state, predicate) => state.alerts.filter(predicate)

// A sessionStorage stand-in, so persistence is exercised for real in Node.
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

// ============================================================================
section('1-4 · identity, deduplication, clearing, reactivation')

// 1. Same condition across 20 polls is one alert.
{
  let state = createInitialAlertState()
  const s = snap({ tracks: [track(7, { hasWeapon: true, state: 'armed' })], mode: 'DANGER' })
  for (let i = 0; i < 20; i += 1) state = run(state, s, T0 + i * 1000, { isFirstSnapshot: i === 0 })
  const weapons = find(state, (a) => a.kind === 'weapon')
  check(weapons.length === 1, '01 · 20 polls of the same condition produce exactly one alert',
    `got ${weapons.length}`)

  // 2. lastSeenAt advances while firstSeenAt stays put.
  const w = weapons[0]
  check(w.firstSeenAt === T0 && w.lastSeenAt === T0 + 19000,
    '02 · lastSeenAt advances, firstSeenAt is pinned to first sighting',
    `first=${w.firstSeenAt - T0} last=${w.lastSeenAt - T0}`)
}

// 3. Condition disappears -> cleared, lifecycle untouched.
{
  let state = createInitialAlertState()
  state = run(state, snap({ tracks: [track(7, { hasWeapon: true })] }), T0)
  state = run(state, snap({ tracks: [] }), T0 + 1000)
  const w = find(state, (a) => a.kind === 'weapon')[0]
  check(w.active === false && w.clearedAt === T0 + 1000 && w.lifecycle === LIFECYCLE.NEW,
    '03 · a condition that stops holding is cleared and keeps its lifecycle',
    `active=${w.active} lifecycle=${w.lifecycle}`)
}

// 4a. Return inside the window reactivates the same instance.
{
  let state = createInitialAlertState()
  state = run(state, snap({ tracks: [track(7, { hasWeapon: true })] }), T0)
  state = run(state, snap({ tracks: [] }), T0 + 1000)
  state = run(state, snap({ tracks: [track(7, { hasWeapon: true })] }), T0 + 1000 + REACTIVATION_WINDOW_MS - 1)
  const weapons = find(state, (a) => a.kind === 'weapon')
  check(weapons.length === 1 && weapons[0].active && weapons[0].reactivationCount === 1,
    '04a · return inside the reactivation window reuses the same instance',
    `count=${weapons.length} reactivations=${weapons[0]?.reactivationCount}`)
}

// 4b. Return after the window is a new incident, back to NEW.
{
  let state = createInitialAlertState()
  state = run(state, snap({ tracks: [track(7, { hasWeapon: true })] }), T0)
  let s2 = state
  s2 = run(s2, snap({ tracks: [] }), T0 + 1000)
  s2 = applyLifecycleAction(s2, find(s2, (a) => a.kind === 'weapon')[0].id, 'acknowledge', { now: T0 + 1500 })
  s2 = run(s2, snap({ tracks: [track(7, { hasWeapon: true })] }), T0 + 1000 + REACTIVATION_WINDOW_MS + 1)
  const weapons = find(s2, (a) => a.kind === 'weapon')
  const fresh = weapons.find((a) => a.instanceSeq === 2)
  check(weapons.length === 2 && fresh && fresh.lifecycle === LIFECYCLE.NEW,
    '04b · return after the window opens a new instance at NEW',
    `instances=${weapons.map((a) => `${a.instanceSeq}:${a.lifecycle}`).join(',')}`)
}

// ============================================================================
section('5-6 · unknown camera source, no cross-sensor grouping')

{
  let state = createInitialAlertState()
  state = run(state, snap({
    tracks: [track(7, { hasWeapon: true })],
    targets: [target(1, { direction: 'approaching', approachingGate: true })],
    mode: 'DANGER',
  }), T0)

  const cameraAlerts = find(state, (a) => a.sourceType === 'camera')
  const badSource = cameraAlerts.filter((a) => a.sourceId !== null || a.cameraSourceKnown !== false)
  check(cameraAlerts.length > 0 && badSource.length === 0,
    '05 · camera alerts carry sourceId:null and cameraSourceKnown:false',
    `camera alerts=${cameraAlerts.length} violating=${badSource.length}`)

  const asJson = JSON.stringify(cameraAlerts)
  check(!/CAM-0\d/.test(asJson),
    '05b · no CAM-01/CAM-02 is ever attached to a camera alert')

  // 6. Camera and radar in the same area stay separate alerts.
  const radarAlerts = find(state, (a) => a.sourceType === 'radar')
  const sameArea = cameraAlerts[0].areaId === radarAlerts[0].areaId
  const distinct = cameraAlerts.every((c) => radarAlerts.every((r) => r.id !== c.id && r.fingerprint !== c.fingerprint))
  const noMergedEvidence = [...cameraAlerts, ...radarAlerts].every(
    (a) => a.sourceEvidence.every((e) => e.sourceType === a.sourceType)
  )
  check(sameArea && distinct && noMergedEvidence,
    '06 · camera and radar in one area remain separate alerts with single-source evidence',
    `sameArea=${sameArea} distinct=${distinct} singleSourceEvidence=${noMergedEvidence}`)

  // The companion list is ids only, and never claims a link.
  const companion = cameraAlerts[0].otherActiveEvidenceInArea
  check(Array.isArray(companion) && companion.length > 0 && companion.every((id) => typeof id === 'string'),
    '06b · otherActiveEvidenceInArea holds ids only, as unassociated context',
    `entries=${companion.length}`)
}

// ============================================================================
section('7-9 · selection and ordering')

// 7. A new DANGER does not move the selection.
{
  let state = createInitialAlertState()
  state = run(state, snap({ tracks: [track(7, { state: 'running' })], mode: 'ALERT' }), T0)
  let selection = resolveSelection(state.alerts, { selectedAlertId: null, seenDangerIds: [] }, { areas: AREAS })
  const before = selection.selectedAlertId

  state = run(state, snap({ tracks: [track(7, { state: 'running' }), track(8, { hasWeapon: true })], mode: 'DANGER' }), T0 + 2000)
  selection = resolveSelection(state.alerts, selection, { areas: AREAS })
  const unseen = computeUnseenDanger(state.alerts, selection)

  check(selection.selectedAlertId === before,
    '07 · a new DANGER does not steal the selection', `before=${before} after=${selection.selectedAlertId}`)
  check(unseen.hasUnseenDanger && unseen.unseenDangerAlertId,
    '07b · the new DANGER raises hasUnseenDanger instead', `id=${unseen.unseenDangerAlertId}`)

  // 8. DANGER sorts to the top regardless.
  const sorted = sortAlerts(state.alerts)
  check(sorted[0].severity === SEVERITY.DANGER,
    '08 · DANGER pins to the top of the ordering', `top=${sorted[0].severity}`)
}

// 9. NEW outranks ACKNOWLEDGED and IN_REVIEW at equal severity.
{
  const base = { severity: SEVERITY.ALERT, active: true, areaId: 'AREA-01', lastSeenAt: T0 }
  const list = [
    { ...base, id: 'c', fingerprint: 'c', lifecycle: LIFECYCLE.IN_REVIEW },
    { ...base, id: 'b', fingerprint: 'b', lifecycle: LIFECYCLE.ACKNOWLEDGED },
    { ...base, id: 'a', fingerprint: 'a', lifecycle: LIFECYCLE.NEW },
  ]
  const order = sortAlerts(list).map((a) => a.id).join(',')
  check(order === 'a,b,c', '09 · NEW > ACKNOWLEDGED > IN_REVIEW at equal severity', order)

  // Recency breaks the final tie.
  const sameStage = [
    { ...base, id: 'old', fingerprint: 'old', lifecycle: LIFECYCLE.NEW, lastSeenAt: T0 },
    { ...base, id: 'new', fingerprint: 'new', lifecycle: LIFECYCLE.NEW, lastSeenAt: T0 + 5000 },
  ]
  check(sortAlerts(sameStage)[0].id === 'new', '09b · newest first within the same severity and stage')

  // RESOLVED is never the default selection.
  const resolvedOnly = [{ ...base, id: 'r', fingerprint: 'r', lifecycle: LIFECYCLE.RESOLVED, severity: SEVERITY.DANGER }]
  check(pickDefaultAlertId(resolvedOnly) === null, '09c · RESOLVED is never chosen as the default selection')
}

// ============================================================================
section('10 · lifecycle transitions')

{
  let state = createInitialAlertState()
  state = run(state, snap({ tracks: [track(7, { hasWeapon: true })] }), T0)
  const id = state.alerts[0].id
  const op = { id: 5, name: 'Operator 5' }

  let s = applyLifecycleAction(state, id, 'acknowledge', { now: T0 + 1000, operator: op })
  check(s.alerts[0].lifecycle === LIFECYCLE.ACKNOWLEDGED && s.alerts[0].acknowledgedAt === T0 + 1000,
    '10a · acknowledge moves NEW -> ACKNOWLEDGED')

  s = applyLifecycleAction(s, id, 'review', { now: T0 + 2000, operator: op })
  check(s.alerts[0].lifecycle === LIFECYCLE.IN_REVIEW && s.alerts[0].owner?.name === 'Operator 5',
    '10b · start review takes session-local ownership')

  s = applyLifecycleAction(s, id, 'resolve', { now: T0 + 3000, operator: op, reason: 'handled', note: 'n' })
  check(s.alerts[0].lifecycle === LIFECYCLE.RESOLVED && s.alerts[0].resolveReason === 'handled',
    '10c · resolve records a reason')

  const reopened = applyLifecycleAction(s, id, 'reopen', { now: T0 + 4000, operator: op })
  check(reopened.alerts[0].lifecycle === LIFECYCLE.IN_REVIEW,
    '10d · reopen with a known owner returns to IN_REVIEW')

  // No owner anywhere -> ACKNOWLEDGED.
  const ownerless = resolveAlert({ ...state.alerts[0], owner: null }, { now: T0, reason: 'other' })
  check(reopenAlert(ownerless, { now: T0 + 1 }).lifecycle === LIFECYCLE.ACKNOWLEDGED,
    '10e · reopen without an owner returns to ACKNOWLEDGED')

  // Invalid moves are no-ops rather than throws.
  const acked = acknowledgeAlert(state.alerts[0], { now: T0 })
  check(acknowledgeAlert(acked, { now: T0 }) === acked, '10f · acknowledging twice is a no-op')
  check(resolveAlert(state.alerts[0], { now: T0, reason: 'nonsense' }) === state.alerts[0],
    '10g · an unknown resolve reason is rejected')
  check(startReviewAlert(null, { now: T0 }) === null, '10h · lifecycle helpers tolerate a missing alert')
  check(applyLifecycleAction(state, 'no-such-id', 'resolve', { now: T0, reason: 'handled' }) === state,
    '10i · acting on an unknown id leaves the state untouched')
}

// ============================================================================
section('11-14 · persistence')

// 11. Simulated refresh preserves lifecycle, ownership and resolve reason.
{
  let state = createInitialAlertState()
  state = run(state, snap({ tracks: [track(7, { hasWeapon: true })], mode: 'DANGER' }), T0)
  const id = state.alerts[0].id
  state = applyLifecycleAction(state, id, 'review', { now: T0 + 1000, operator: { id: 3, name: 'Op 3' } })
  state = { ...state, selection: { selectedAlertId: id, selectedAreaId: 'AREA-01', lastSelectedCameraId: 'CAM-02' } }

  const storage = memoryStorage()
  saveState(state, { isDemo: false, storage, now: T0 + 2000 })
  const restored = loadState({ isDemo: false, storage })
  const same = restored.alerts.find((a) => a.id === id)

  check(same && same.lifecycle === LIFECYCLE.IN_REVIEW && same.owner?.name === 'Op 3',
    '11 · a simulated refresh preserves lifecycle and ownership', `lifecycle=${same?.lifecycle}`)
  check(restored.selection.selectedAlertId === id && restored.selection.lastSelectedCameraId === 'CAM-02',
    '11b · selection and last camera choice survive the round trip')
  check(same.persisted === false && same.sessionLocal === true,
    '11c · restored alerts still declare themselves session-local and unpersisted')
}

// 12. Corrupt storage never crashes.
{
  for (const bad of ['{not json', '', 'null', '[]', '{"v":1}', '{"v":1,"alerts":"nope"}']) {
    const out = deserializeState(bad, { isDemo: false })
    if (out !== null) { check(false, `12 · corrupt payload rejected (${bad.slice(0, 12)})`, `got ${typeof out}`); break }
  }
  check(true, '12 · corrupt or malformed stored state falls back to null instead of throwing')

  const storage = memoryStorage({ [STORAGE_KEY]: '{{{' })
  check(loadState({ isDemo: false, storage }) === null, '12b · loadState survives unparseable storage')

  // Individually broken entries are dropped, the rest still load.
  const mixed = JSON.stringify({
    v: 1, savedAt: T0, isDemo: false,
    alerts: [{ id: 'x', fingerprint: 'x', lifecycle: 'NEW' }, { junk: true }, null],
    selection: {}, filters: {},
  })
  const partial = deserializeState(mixed, { isDemo: false })
  check(partial && partial.alerts.length === 1, '12c · unusable entries are dropped without failing the restore',
    `kept=${partial?.alerts.length}`)
}

// 13. An older schema version falls back safely.
{
  const older = JSON.stringify({ v: 0, alerts: [{ id: 'a', fingerprint: 'a', lifecycle: 'NEW' }] })
  check(deserializeState(older, { isDemo: false }) === null,
    '13 · a stored state from an older schema version is discarded, not migrated blindly')
  const storage = memoryStorage({ [STORAGE_KEY]: older })
  check(loadState({ isDemo: false, storage }) === null, '13b · loadState returns null for the old schema')
}

// 14. Demo and live never mix.
{
  const demoState = { alerts: demoAlerts(T0), selection: {}, filters: {} }
  const storage = memoryStorage()
  saveState(demoState, { isDemo: true, storage, now: T0 })
  check(loadState({ isDemo: false, storage }) === null,
    '14 · demo state is never restored into a live session')
  check((loadState({ isDemo: true, storage })?.alerts.length || 0) === demoState.alerts.length,
    '14b · demo state restores inside a demo session')

  const liveMarked = serializeState({ alerts: [] }, { isDemo: false, now: T0 })
  check(liveMarked.isDemo === false && liveMarked.v === 1, '14c · serialized state records its mode and schema version')
}

// ============================================================================
section('15-17 · honesty constraints')

// 15. No association vocabulary anywhere in live alert data.
{
  let state = createInitialAlertState()
  state = run(state, snap({
    tracks: [track(7, { hasWeapon: true, state: 'armed' }), track(8, { state: 'running' })],
    targets: [target(1, { direction: 'approaching', approachingGate: true }), target(2, { direction: 'approaching' })],
    mode: 'DANGER',
  }), T0)

  const json = JSON.stringify(state.alerts)
  const forbidden = [
    [/matched/i, 'Matched'],
    [/associat/i, 'Associated'],
    [/confirmed/i, 'Confirmed'],
    [/pair[_ -]?risk/i, 'Pair Risk'],
    [/combined[_ -]?risk/i, 'Combined Risk'],
    [/\bFC-\d/, 'FC-nn'],
    [/\d+\s?%/, 'percentage'],
  ]
  const hits = forbidden.filter(([re]) => re.test(json)).map(([, name]) => name)
  check(hits.length === 0, '15 · live alert data contains no association vocabulary',
    hits.length ? `found: ${hits.join(', ')}` : '')

  // "Fused" is not banned — it is *reserved*. The only legitimate use is the
  // backend's own snapshot.risks.fused, and it must never appear without saying
  // where it came from, so the test is attribution rather than absence.
  const fusedMentions = state.alerts.filter((a) => /fused/i.test(`${a.message} ${a.messageHe}`))
  const unattributed = fusedMentions.filter((a) => !/backend|מהשרת/i.test(`${a.message} ${a.messageHe}`))
  check(unattributed.length === 0,
    '15d · every "fused risk" mention carries its backend attribution',
    unattributed.map((a) => a.message).join(' | '))

  const noPairFields = state.alerts.every(
    (a) => !('pairRisk' in a) && !('association' in a) && !('fusedRisk' in a) && !('cameraTrackId' in a && 'radarTargetId' in a)
  )
  check(noPairFields, '15b · no alert carries pair, association or fused fields')

  // Demo data is held to the same rule.
  const demo = demoAlerts(T0)
  const demoJson = JSON.stringify(demo)
  const demoHits = forbidden.filter(([re]) => re.test(demoJson)).map(([, n]) => n)
  check(demoHits.length === 0, '15c · demo alert data contains no association vocabulary either',
    demoHits.length ? `found: ${demoHits.join(', ')}` : '')
  const demoUnattributed = demo
    .filter((a) => /fused/i.test(`${a.message} ${a.messageHe}`))
    .filter((a) => !/backend|מהשרת/i.test(`${a.message} ${a.messageHe}`))
  check(demoUnattributed.length === 0, '15e · demo data holds the same attribution rule',
    demoUnattributed.map((a) => a.message).join(' | '))
}

// 16-17. The live deployment is exactly the declared hardware.
{
  check(isSingleAreaDeployment(LIVE_AREAS) && LIVE_AREAS.length === 1,
    '16 · live is a single declared area', `areas=${LIVE_AREAS.length}`)

  const area = LIVE_AREAS[0]
  const camIds = area.cameras.map((c) => c.id).join(',')
  const camKeys = area.cameras.map((c) => c.sourceKey).join(',')
  check(camIds === 'CAM-01,CAM-02' && camKeys === 'webcam,dahua',
    '16b · the live area maps exactly the two real camera sources', `${camKeys} -> ${camIds}`)
  check(area.radars.length === 1 && area.radars[0].id === 'RDR-01',
    '16c · the live area declares exactly one radar')
  check(area.primaryCameraId === null,
    '16d · no primary camera is invented where no source of truth exists')
  check(cameraIdForSourceKey('webcam') === 'CAM-01' && cameraIdForSourceKey('nope') === null,
    '16e · camera id lookup is a declared mapping, not a guess')

  const liveJson = JSON.stringify(getAreas({ isDemo: false }))
  check(!/tower|gate|warehouse|north|west|east/i.test(liveJson),
    '17 · no speculative area names exist in the live configuration')
  check(getAreas({ isDemo: false }).every((a) => a.isDemo === false) &&
        getAreas({ isDemo: true }).every((a) => a.isDemo === true),
    '17b · every area declares its own provenance')
  check(DEMO_AREAS.length > 1, '17c · multiple areas exist only in demo', `demo areas=${DEMO_AREAS.length}`)
}

// ============================================================================
section('18-19 · selectors, counts and search')

{
  const alerts = demoAlerts(T0)
  const areas = DEMO_AREAS

  const counts = lifecycleCounts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL_ACTIVE }, { areas })
  const manual = { NEW: 0, ACKNOWLEDGED: 0, IN_REVIEW: 0, RESOLVED: 0 }
  for (const a of alerts) manual[a.lifecycle] += 1
  const activeTotal = manual.NEW + manual.ACKNOWLEDGED + manual.IN_REVIEW

  check(counts.NEW === manual.NEW && counts.ACKNOWLEDGED === manual.ACKNOWLEDGED &&
        counts.IN_REVIEW === manual.IN_REVIEW && counts.RESOLVED === manual.RESOLVED,
    '18 · lifecycle counts match the underlying data',
    JSON.stringify({ counts: { N: counts.NEW, A: counts.ACKNOWLEDGED, R: counts.IN_REVIEW, D: counts.RESOLVED }, manual }))
  check(counts.ALL_ACTIVE === activeTotal, '18b · ALL_ACTIVE = NEW + ACKNOWLEDGED + IN_REVIEW',
    `${counts.ALL_ACTIVE} vs ${activeTotal}`)

  // The trap this guards: counts must not collapse when a lifecycle tab is picked.
  const narrowed = lifecycleCounts(alerts, { lifecycle: LIFECYCLE.NEW }, { areas })
  check(narrowed.RESOLVED === manual.RESOLVED && narrowed.ALL_ACTIVE === activeTotal,
    '18c · picking a lifecycle tab does not zero the other tabs\' counts',
    `resolved=${narrowed.RESOLVED} active=${narrowed.ALL_ACTIVE}`)

  // RESOLVED stays out of the active list.
  const active = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL_ACTIVE }, { areas })
  check(active.every((a) => a.lifecycle !== LIFECYCLE.RESOLVED) && active.length === activeTotal,
    '18d · ALL_ACTIVE excludes RESOLVED', `shown=${active.length}`)

  // Non-lifecycle filters.
  const oneArea = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, areaId: 'DEMO-AREA-02' }, { areas })
  check(oneArea.length > 0 && oneArea.every((a) => a.areaId === 'DEMO-AREA-02'), '18e · area filter')
  const radarOnly = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, sourceType: 'radar' }, { areas })
  check(radarOnly.length > 0 && radarOnly.every((a) => a.sourceType === 'radar'), '18f · source-type filter')
  const dangerOnly = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, severity: SEVERITY.DANGER }, { areas })
  check(dangerOnly.length > 0 && dangerOnly.every((a) => a.severity === SEVERITY.DANGER), '18g · severity filter')
  const clearedOnly = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, activity: 'CLEARED' }, { areas })
  check(clearedOnly.length > 0 && clearedOnly.every((a) => !a.active),
    '18h · activity filter separates cleared conditions from lifecycle')

  // 19. Search.
  const byAlertId = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, query: alerts[0].id }, { areas })
  check(byAlertId.length === 1 && byAlertId[0].id === alerts[0].id, '19 · search finds an Alert ID')

  const byTrack = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, query: '#4' }, { areas })
  check(byTrack.length > 0 && byTrack.every((a) => a.trackId === 4 || String(a.message).includes('#4')),
    '19b · search finds a Track ID', `hits=${byTrack.length}`)

  const byTarget = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, query: 'T2' }, { areas })
  check(byTarget.some((a) => a.targetId === 2), '19c · search finds a Target ID', `hits=${byTarget.length}`)

  const byAreaName = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, query: 'north tower' }, { areas })
  check(byAreaName.length > 0 && byAreaName.every((a) => a.areaId === 'DEMO-AREA-02'),
    '19d · search matches an area name, case-insensitively')

  const upper = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, query: 'RADAR' }, { areas })
  const lower = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, query: 'radar' }, { areas })
  check(upper.length === lower.length && upper.length > 0, '19e · search is case-insensitive')

  check(visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL, query: '   ' }, { areas }).length === alerts.length,
    '19f · a blank query filters nothing')
}

// ============================================================================
section('20 · the engine stays private to Industrial Ops')

{
  // In Phase A0 this asserted that NOTHING imported the cluster, because A0
  // shipped deliberately unwired. Phase A1 connected it to the OPS screen — that
  // was the point of A1 — so the guarantee that still matters is narrower and
  // just as important: the cluster is consumed only from inside industrial-ops,
  // and no shared module or other concept can be affected by it.
  const NEW_MODULES = ['areas', 'alerts', 'alertStorage', 'alertSelectors', 'useAlertSelection', 'demoAlerts']
  const srcDir = path.join(root, 'src')

  const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) files.push(...(await walk(full)))
      else if (/\.(js|jsx)$/.test(entry.name)) files.push(full)
    }
    return files
  }

  const files = await walk(srcDir)
  const industrialDir = path.join(root, 'src', 'concepts', 'industrial-ops')
  const importers = []
  for (const file of files) {
    // Anything inside industrial-ops may use the engine; that is its home.
    if (file.startsWith(industrialDir)) continue
    const text = await readFile(file, 'utf-8')
    for (const mod of NEW_MODULES) {
      const re = new RegExp(`from\\s+['"][^'"]*\\b${mod}(\\.js)?['"]`)
      if (re.test(text)) importers.push(`${path.relative(root, file)} -> ${mod}`)
    }
  }
  check(importers.length === 0,
    '20 · no module outside industrial-ops imports the alert engine',
    importers.join(' | '))

  // And the engine itself never reads the clock, which is what makes all of the
  // above reproducible.
  const engine = await readFile(path.join(industrialDir, 'alerts.js'), 'utf-8')
  check(!/Date\.now\(\)/.test(engine), '20b · the alert engine takes an injected clock and never reads Date.now()')
}

// ============================================================================
console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}  —  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
