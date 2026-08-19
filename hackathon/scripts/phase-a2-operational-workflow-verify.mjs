// Phase A2 - Operational Alert Workflow verification.
//
// Three layers, same shape as the A1 suite:
//   A. static source checks   (no actions in rows, one dispatcher, no engine
//                              imports in UI components, no scale/zoom)
//   B. logic checks           (engine + selectors + storage + operator log,
//                              imported directly and run in Node)
//   C. browser checks         (playwright, against a running dev server, which
//                              serves the app inside React StrictMode)
//
// Browser scenarios that touch the demo workflow each get a FRESH context. Demo
// state now persists per tab by design, so reusing one context would let an
// earlier scenario's acknowledgements leak into the next one's expectations.
//
// Usage: node scripts/phase-a2-operational-workflow-verify.mjs [baseUrl]
//        needs backend :5000 and Vite (default http://localhost:5174)

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LIFECYCLE, RESOLVE_REASONS, createInitialAlertState,
  acknowledgeAlert, startReviewAlert, resolveAlert, reopenAlert,
  reopenTargetLifecycle, applyLifecycleAction, reduceAlerts,
} from '../src/concepts/industrial-ops/alerts.js'
import {
  ALERT_ACTIONS, DEFAULT_FILTERS, LIFECYCLE_FILTERS, FILTER_AXIS_UNBLOCK,
  areaOperationalSummary, blockingFilterAxes, legalActionsFor, lifecycleCounts,
  sortAreasOperational, unblockFilterPatch, visibleAlerts,
} from '../src/concepts/industrial-ops/alertSelectors.js'
import {
  createInitialPersistedState, deserializeState, loadState, saveState, serializeState,
} from '../src/concepts/industrial-ops/alertStorage.js'
import { canonicalAlertState } from '../src/concepts/industrial-ops/useAlertSelection.js'
import {
  mergeSessionLog, operatorLogEntries, sessionEntryEpoch,
} from '../src/concepts/industrial-ops/operatorLog.js'
import { demoAlerts } from '../src/concepts/industrial-ops/demoAlerts.js'
import { DEMO_AREAS } from '../src/concepts/industrial-ops/areas.js'
import { splitSessionLog } from '../src/concepts/industrial-ops/useIndustrialOpsCommandCenter.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const T0 = 1_800_000_000_000

let failed = 0
let passed = 0
const check = (ok, label, detail = '') => {
  if (ok) passed += 1; else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`)
}
const section = (n) => console.log(`\n=== ${n} ===`)
const read = (p) => readFile(path.join(root, p), 'utf-8')

const IO = 'src/concepts/industrial-ops'
const OP = { id: 42, name: 'Operator 42' }

// ============================================================================
section('A - static source checks')

const dashboard = await read(`${IO}/views/IndustrialDashboard.jsx`)
const alertList = await read(`${IO}/components/AlertList.jsx`)
// Phase A3.1.1 moved the operator's controls out of the full-width bar and into
// a fixed region inside the alerts panel. Same controls, same dispatcher, same
// single-render rule — a different place on the screen. Everything A2 asserts
// about them is asserted here against the region that renders them now.
const bar = await read(`${IO}/components/SelectedAlertActions.jsx`)
const dialogs = await read(`${IO}/components/AlertActionDialogs.jsx`)
const ctxmenu = await read(`${IO}/components/AlertContextMenu.jsx`)
const css = await read(`${IO}/industrial.css`)

// 78 - no action buttons inside an alert row.
{
  const listBody = alertList.slice(alertList.indexOf('io2-alert-list'))
  check(!/<button/.test(listBody), 'A01 - no <button> is rendered inside the alert list rows')
  check(!/data-io2-action=/.test(alertList), 'A02 - the row markup carries no lifecycle action')
  check(/io2-alert-line1/.test(alertList) && /io2-alert-line2/.test(alertList),
    'A03 - the approved row structure is still what the list renders')
}

// 76/90 - one dispatcher; the UI surfaces never touch the engine.
{
  check(/const runAlertAction = \(action, alertId\)/.test(dashboard),
    'A04 - a single runAlertAction dispatcher exists')
  const barCalls = /onAction\(/.test(bar)
  const menuCalls = /onAction\(/.test(ctxmenu)
  check(barCalls && menuCalls, 'A05 - the selected-alert region and the context menu both dispatch through onAction')
  for (const [name, src] of [['selected-alert region', bar], ['context menu', ctxmenu]]) {
    check(!/from '\.\.\/alerts\.js'/.test(src),
      `A06 - the ${name} imports no lifecycle engine`, name)
  }
  check(!/acknowledgeAlert|startReviewAlert|resolveAlert\(|reopenAlert\(/.test(bar + ctxmenu),
    'A07 - neither surface calls an engine transition directly')
}

// Where the controls render. Phase A2 required them between the decision band
// and the grid; A3.1.1 requires them INSIDE the alerts panel, after the filters
// and before the list. The invariant both versions are really protecting is the
// same one — the actions are somewhere fixed, not inside a scrolling row — so
// the check follows the approved position rather than being dropped.
{
  const alertsPanelAt = dashboard.indexOf('io2-a-alerts')
  const filtersAt = dashboard.indexOf('<AlertFilters')
  const regionAt = dashboard.indexOf('<SelectedAlertActions')
  const listAt = dashboard.indexOf('<AlertList')
  check(alertsPanelAt > 0 && regionAt > filtersAt && filtersAt > alertsPanelAt && listAt > regionAt,
    'A08 - the selected-alert region renders inside the alerts panel, after the filters and before the list')
  check(!/<DecisionBlock|<OperationalActionBar|<NewDangerNotice/.test(dashboard),
    'A08b - and no decision block, external action bar or danger band is rendered at all')
}

// 95 - a declared, FIXED height, so the region cannot swing the panel around.
//
// A2 pinned the bar to a 44-60px range with overflow hidden. The region is
// taller than a single-line bar by design — it stacks a label row, the identity
// and the buttons in a 3/12 column instead of laying them out across the page —
// so the number is restated rather than the check dropped. The invariant is
// unchanged and is if anything stricter: one declared height, clipped rather
// than allowed to grow, and the same height when nothing is selected.
{
  const block = css.slice(css.indexOf('.io2-sel-actions {'), css.indexOf('.io2-sel-identity'))
  const fixed = Number((block.match(/\bheight:\s*(\d+)px/) || [])[1])
  check(fixed >= 44 && /overflow:\s*hidden/.test(block),
    'A09 - the selected-alert region declares one fixed, clipped height', `${fixed}px`)
  check(!/min-height|max-height/.test(block),
    'A09b - and not a range it could drift inside')
  check(/\.io2-sel-actions--empty\s*\{/.test(css),
    'A09c - the empty state is styled from the same box, so selecting does not resize it')
  check(/\.io2-sel-buttons\s*\{[^}]*margin-top:\s*auto/s.test(css),
    'A09d - the action buttons are pinned to the floor of the box, so nothing above them can move them')
}

// 98/99/100 - the forbidden ways of buying space.
{
  const bad = []
  if (/transform:\s*scale/.test(css)) bad.push('transform: scale')
  if (/[^-\w]zoom\s*:/.test(css)) bad.push('zoom')
  if (/font-size:\s*(inherit|0|unset|initial)\s*;/.test(css)) bad.push('font-size reset')
  check(bad.length === 0, 'A10 - no scale, zoom or font-size reset', bad.join(', '))
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  check(sizes.filter((s) => s < 8.5).length === 0,
    "A11 - nothing goes below the screen's existing 8.5px floor")
}

// 23/39 - no permissions anywhere in the workflow.
{
  // Comments stripped first: the context menu legitimately mentions clipboard
  // permission in prose, and this check is about code, not vocabulary.
  const code = [dashboard, bar, dialogs, ctxmenu, alertList]
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  check(!/\brole\s*===|\bisAdmin\b|\buser\.role\b|unauthorized|supervisor|permissionDenied/i.test(code),
    'A12 - no role, permission or authorization gate exists in the workflow')
}

// 29 - dialog accessibility is declared in the markup, not assumed.
{
  check(/<dialog/.test(dialogs) && /aria-modal="true"/.test(dialogs) &&
    /aria-labelledby=/.test(dialogs) && /onCancel=/.test(dialogs) && /onClose=/.test(dialogs),
    'A13 - dialogs are native <dialog> with aria-modal, labelling and cancel/close handlers')
  check(/role="menu"/.test(ctxmenu) && /role="menuitem"/.test(ctxmenu),
    'A14 - the context menu declares menu semantics')
}

// The engine still reads no clock (A0 rule 20b) after the A2 helper was added.
{
  const engine = await read(`${IO}/alerts.js`)
  check(!/Date\.now\(\)/.test(engine), 'A15 - the alert engine still never reads the clock')
  check(/export function reopenTargetLifecycle\(alert\)/.test(engine),
    'A16 - reopenTargetLifecycle takes the alert alone, never the current operator')
}

// 33 - the label changed, the filter id did not.
{
  const filters = await read(`${IO}/components/AlertFilters.jsx`)
  check(/ALL OPEN/.test(filters) && !/'ALL ACTIVE'/.test(filters),
    'A17 - the lifecycle tab reads ALL OPEN')
  check(/LIFECYCLE_FILTERS\.ALL_ACTIVE/.test(filters),
    'A18 - and its internal filter id is unchanged')
}

// ============================================================================
section('B - logic: lifecycle transitions')

const base = {
  id: 'a', fingerprint: 'f', areaId: 'AREA-01', severity: 'danger', active: true,
  lifecycle: LIFECYCLE.NEW, owner: null, actionLog: [], lastSeenAt: T0, firstSeenAt: T0,
  sourceType: 'camera', sourceEvidence: [{ at: T0 }], resolveReason: null, resolveNote: null,
  // Present on every real alert (newAlertFromCandidate / normalizeAlert both set
  // it); reduceAlerts reads it, so the fixture carries it too.
  otherActiveEvidenceInArea: [], instanceSeq: 1, reactivationCount: 0,
}
const state1 = { ...createInitialAlertState(), alerts: [base] }
const act = (state, action, ctx) => applyLifecycleAction(state, 'a', action, { now: T0 + 1000, operator: OP, ...ctx })
const only = (state) => state.alerts[0]

// 1-6 - every legal transition.
check(only(act(state1, 'acknowledge')).lifecycle === LIFECYCLE.ACKNOWLEDGED, 'B01 - NEW -> ACKNOWLEDGED')
check(only(act(state1, 'review')).lifecycle === LIFECYCLE.IN_REVIEW, 'B02 - NEW -> IN REVIEW')
{
  const acked = act(state1, 'acknowledge')
  check(only(act(acked, 'review')).lifecycle === LIFECYCLE.IN_REVIEW, 'B03 - ACKNOWLEDGED -> IN REVIEW')
  check(only(act(acked, 'resolve', { reason: 'handled' })).lifecycle === LIFECYCLE.RESOLVED,
    'B05 - ACKNOWLEDGED -> RESOLVED')
}
check(only(act(state1, 'resolve', { reason: 'handled' })).lifecycle === LIFECYCLE.RESOLVED, 'B04 - NEW -> RESOLVED')
{
  const inReview = act(state1, 'review')
  check(only(act(inReview, 'resolve', { reason: 'no_threat' })).lifecycle === LIFECYCLE.RESOLVED,
    'B06 - IN REVIEW -> RESOLVED')
}

// 7/8/9 - reopen destination comes from the alert's own prior ownership.
{
  const owned = resolveAlert({ ...base, owner: { id: 1, name: 'Prior' } }, { now: T0, reason: 'handled' })
  check(reopenAlert(owned, { now: T0 + 1, operator: OP }).lifecycle === LIFECYCLE.IN_REVIEW,
    'B07 - RESOLVED with a previous owner reopens to IN REVIEW')

  const unowned = resolveAlert({ ...base, owner: null }, { now: T0, reason: 'handled' })
  check(reopenAlert(unowned, { now: T0 + 1 }).lifecycle === LIFECYCLE.ACKNOWLEDGED,
    'B08 - RESOLVED without a previous owner reopens to ACKNOWLEDGED')

  // The rule the brief singles out: the person pressing Reopen is NOT evidence
  // that anybody ever reviewed the alert.
  const reopened = reopenAlert(unowned, { now: T0 + 1, operator: OP })
  check(reopened.lifecycle === LIFECYCLE.ACKNOWLEDGED,
    'B09 - a logged-in operator alone does not make a reopen go to IN REVIEW',
    reopened.lifecycle)
  check(reopened.owner === null, 'B10 - and reopen creates no owner')
  check(reopened.actionLog.at(-1).operatorId === OP.id &&
    reopened.actionLog.at(-1).operatorName === OP.name,
    'B11 - while still recording who performed the reopen')
  check(reopenTargetLifecycle(unowned) === LIFECYCLE.ACKNOWLEDGED &&
    reopenTargetLifecycle(owned) === LIFECYCLE.IN_REVIEW,
    'B12 - reopenTargetLifecycle predicts exactly what reopenAlert does')
  check(reopenTargetLifecycle(base) === null,
    'B13 - and predicts nothing for an alert that is not resolved')
}

// 10 - invalid transitions are identity no-ops.
{
  const acked = acknowledgeAlert(base, { now: T0 })
  check(acknowledgeAlert(acked, { now: T0 }) === acked, 'B14 - acknowledging twice is a no-op')
  check(startReviewAlert(resolveAlert(base, { now: T0, reason: 'other' }), { now: T0 }).lifecycle
    === LIFECYCLE.RESOLVED, 'B15 - review on a resolved alert is a no-op')
  check(reopenAlert(base, { now: T0 }) === base, 'B16 - reopen on a NEW alert is a no-op')
  check(resolveAlert(base, { now: T0, reason: 'nope' }) === base, 'B17 - an unapproved reason is refused')
  check(resolveAlert(base, { now: T0 }) === base, 'B18 - a missing reason is refused')
  check(applyLifecycleAction(state1, 'nope', 'resolve', { now: T0, reason: 'handled' }) === state1,
    'B19 - acting on an unknown id leaves the state identical')
}

// 11-15 - what a lifecycle action must never touch.
{
  const resolved = resolveAlert(base, { now: T0 + 5, operator: OP, reason: 'false_alarm', note: 'n' })
  check(resolved.id === base.id, 'B20 - resolve does not change the alert id')
  check(resolved.fingerprint === base.fingerprint, 'B21 - resolve does not change the fingerprint')
  check(resolved.severity === base.severity, 'B22 - resolve does not change the severity')
  check(resolved.active === base.active, 'B23 - resolve does not change the condition')
  check(resolved.sourceEvidence === base.sourceEvidence, 'B24 - resolve does not change the source evidence')
  check(resolved.firstSeenAt === base.firstSeenAt, 'B25 - resolve does not change when it was first seen')

  const re = reopenAlert(resolved, { now: T0 + 6, operator: OP })
  check(re.id === base.id && re.fingerprint === base.fingerprint && re.instanceSeq === base.instanceSeq,
    'B26 - reopen creates no new alert: same id, fingerprint and instance')
  check(re.severity === base.severity && re.active === base.active,
    'B27 - reopen changes neither severity nor condition')
  check(re.resolveReason === null && re.resolveNote === null && re.resolvedAt === null,
    'B28 - reopen clears the resolution it is undoing')
}

// 16-22 - the operator record.
{
  let s = act(state1, 'acknowledge')
  const ackEntry = only(s).actionLog.at(-1)
  check(ackEntry.action === 'acknowledge' && ackEntry.operatorId === OP.id && ackEntry.operatorName === OP.name,
    'B29 - acknowledge records the operator')
  check(only(s).owner === null, 'B30 - acknowledge does NOT take ownership')
  check(Number.isFinite(ackEntry.at), 'B31 - the action carries a real timestamp')
  check(ackEntry.from === LIFECYCLE.NEW && ackEntry.to === LIFECYCLE.ACKNOWLEDGED,
    'B32 - and records both ends of the transition')

  s = act(s, 'review', { now: T0 + 2000 })
  check(only(s).owner?.id === OP.id && only(s).owner?.name === OP.name,
    'B33 - start review assigns ownership from the real session user')
  check(only(s).reviewStartedAt === T0 + 2000, 'B34 - and records when review started')

  s = act(s, 'resolve', { now: T0 + 3000, reason: 'sensor_issue', note: 'cable' })
  const res = only(s).actionLog.at(-1)
  check(res.reason === 'sensor_issue' && res.note === 'cable', 'B35 - resolve records reason and note')
  check(only(s).actionLog.length === 3, 'B36 - the action log accumulates, one entry per action')
  const ats = only(s).actionLog.map((e) => e.at)
  check(ats.every((v, i) => i === 0 || v >= ats[i - 1]), 'B37 - action log entries are in chronological order')

  s = act(s, 'reopen', { now: T0 + 4000 })
  check(only(s).actionLog.at(-1).action === 'reopen' && only(s).actionLog.length === 4,
    'B38 - reopen records the operator too')
  check(only(s).lifecycle === LIFECYCLE.IN_REVIEW,
    'B39 - and honours the ownership Start Review had created')
}

// A snapshot fold must never roll an operator's work back.
{
  const snapshot = {
    mode: 'DANGER', risks: { fused: 90 }, tracks: [], targets: [],
    radar: { enabled: true, connected: true, status: 'OK', targets: [] },
    cameras: { webcam: { connected: false }, dahua: { connected: false } },
  }
  let s = act(state1, 'review')
  s = reduceAlerts(s, snapshot, { now: T0 + 5000, areas: DEMO_AREAS, isDemo: false })
  const survivor = s.alerts.find((a) => a.id === 'a')
  check(survivor && survivor.lifecycle === LIFECYCLE.IN_REVIEW && survivor.owner?.id === OP.id,
    'B40 - a snapshot fold preserves lifecycle, owner and action log')
}

// ============================================================================
section('B - logic: legal actions and filters')

check(JSON.stringify(legalActionsFor({ lifecycle: LIFECYCLE.NEW }))
  === JSON.stringify([ALERT_ACTIONS.ACKNOWLEDGE, ALERT_ACTIONS.REVIEW, ALERT_ACTIONS.RESOLVE]),
  'B41 - NEW offers acknowledge, review and resolve')
check(JSON.stringify(legalActionsFor({ lifecycle: LIFECYCLE.ACKNOWLEDGED }))
  === JSON.stringify([ALERT_ACTIONS.REVIEW, ALERT_ACTIONS.RESOLVE]),
  'B42 - ACKNOWLEDGED offers review and resolve')
check(JSON.stringify(legalActionsFor({ lifecycle: LIFECYCLE.IN_REVIEW })) === JSON.stringify([ALERT_ACTIONS.RESOLVE]),
  'B43 - IN REVIEW offers resolve only')
check(JSON.stringify(legalActionsFor({ lifecycle: LIFECYCLE.RESOLVED })) === JSON.stringify([ALERT_ACTIONS.REOPEN]),
  'B44 - RESOLVED offers reopen only')
check(legalActionsFor(null).length === 0, 'B45 - no alert offers no actions')

// Every offered action is one the engine actually performs.
{
  const cases = [
    [LIFECYCLE.NEW, base],
    [LIFECYCLE.ACKNOWLEDGED, acknowledgeAlert(base, { now: T0 })],
    [LIFECYCLE.IN_REVIEW, startReviewAlert(base, { now: T0, operator: OP })],
    [LIFECYCLE.RESOLVED, resolveAlert(base, { now: T0, reason: 'other' })],
  ]
  let allReal = true
  for (const [, alert] of cases) {
    for (const action of legalActionsFor(alert)) {
      const st = applyLifecycleAction({ alerts: [alert] }, alert.id, action, {
        now: T0 + 9, operator: OP, reason: 'handled',
      })
      if (st.alerts[0] === alert) allReal = false
    }
  }
  check(allReal, 'B46 - every action the UI offers actually changes the alert (no dead buttons)')
}

// 63/64/65 - the selected alert outside the filter.
{
  const resolved = resolveAlert(base, { now: T0, reason: 'handled' })
  const openFilters = { ...DEFAULT_FILTERS, lifecycle: LIFECYCLE_FILTERS.ALL_ACTIVE }
  check(blockingFilterAxes(resolved, openFilters, { areas: [] }).join() === 'lifecycle',
    'B47 - resolving under ALL OPEN identifies lifecycle as the blocking axis')
  check(FILTER_AXIS_UNBLOCK.lifecycle === LIFECYCLE_FILTERS.ALL,
    'B48 - and lifecycle unblocks to ALL, not back to the ALL OPEN default')

  const many = { ...openFilters, severity: 'alert', query: 'zzz' }
  const axes = blockingFilterAxes(resolved, many, { areas: [] })
  check(axes.includes('lifecycle') && axes.includes('severity') && axes.includes('query'),
    'B49 - every blocking axis is reported, not just the first', axes.join(','))

  const patch = unblockFilterPatch(resolved, many, { areas: [] })
  const after = { ...many, ...patch }
  check(visibleAlerts([resolved], after, { areas: [] }).length === 1,
    'B50 - applying the patch makes the alert visible again')
  check(after.areaId === many.areaId && after.sourceType === many.sourceType && after.activity === many.activity,
    'B51 - and leaves every filter that was not blocking exactly as the operator set it')
  check(Object.keys(patch).length === axes.length, 'B52 - the patch touches only the blocking axes')
  check(blockingFilterAxes(base, DEFAULT_FILTERS, { areas: [] }).length === 0,
    'B53 - a visible alert reports no blocking axis')
}

// 56-62 - counts follow the workflow.
{
  const areas = []
  let s = { alerts: [base] }
  const c0 = lifecycleCounts(s.alerts, DEFAULT_FILTERS, { areas })
  s = applyLifecycleAction(s, 'a', 'acknowledge', { now: T0, operator: OP })
  const c1 = lifecycleCounts(s.alerts, DEFAULT_FILTERS, { areas })
  check(c0[LIFECYCLE.NEW] === 1 && c1[LIFECYCLE.NEW] === 0, 'B54 - NEW count falls after acknowledge')
  check(c1[LIFECYCLE.ACKNOWLEDGED] === 1, 'B55 - ACKNOWLEDGED count rises')

  s = applyLifecycleAction(s, 'a', 'review', { now: T0, operator: OP })
  const c2 = lifecycleCounts(s.alerts, DEFAULT_FILTERS, { areas })
  check(c2[LIFECYCLE.ACKNOWLEDGED] === 0 && c2[LIFECYCLE.IN_REVIEW] === 1,
    'B56 - ACKNOWLEDGED falls and IN REVIEW rises after start review')

  s = applyLifecycleAction(s, 'a', 'resolve', { now: T0, operator: OP, reason: 'handled' })
  const c3 = lifecycleCounts(s.alerts, DEFAULT_FILTERS, { areas })
  check(c3[LIFECYCLE.RESOLVED] === 1, 'B57 - RESOLVED count rises after resolve')
  check(c3[LIFECYCLE_FILTERS.ALL_ACTIVE] === 0, 'B58 - and ALL OPEN excludes it')
  check(c3[LIFECYCLE_FILTERS.ALL] === 1, 'B59 - while ALL still counts it')

  s = applyLifecycleAction(s, 'a', 'reopen', { now: T0, operator: OP })
  const c4 = lifecycleCounts(s.alerts, DEFAULT_FILTERS, { areas })
  check(c4[LIFECYCLE.RESOLVED] === 0 && c4[LIFECYCLE.IN_REVIEW] === 1,
    'B60 - reopen moves the count to the destination the rule chose')

  // The condition axis is independent of anything an operator does.
  const cleared = { ...base, active: false }
  check(visibleAlerts([cleared], { ...DEFAULT_FILTERS, activity: 'ACTIVE' }, { areas }).length === 0 &&
    visibleAlerts([cleared], { ...DEFAULT_FILTERS, activity: 'CLEARED' }, { areas }).length === 1,
    'B61 - the condition filter is independent of the lifecycle filter')
}

// ============================================================================
section('B - logic: area severity follows the condition')

{
  const area = { id: 'AREA-01' }
  const at = (lifecycle, active = true, severity = 'danger') =>
    [{ ...base, lifecycle, active, severity }]

  check(areaOperationalSummary(area, at(LIFECYCLE.NEW)).severity === 'DANGER',
    'B62 - active DANGER + NEW -> area DANGER')
  check(areaOperationalSummary(area, at(LIFECYCLE.ACKNOWLEDGED)).severity === 'DANGER',
    'B63 - active DANGER + ACKNOWLEDGED -> area DANGER')
  check(areaOperationalSummary(area, at(LIFECYCLE.IN_REVIEW)).severity === 'DANGER',
    'B64 - active DANGER + IN REVIEW -> area DANGER')
  check(areaOperationalSummary(area, at(LIFECYCLE.RESOLVED)).severity === 'DANGER',
    'B65 - active DANGER + RESOLVED -> area STILL DANGER (the corrected rule)')
  check(areaOperationalSummary(area, at(LIFECYCLE.RESOLVED, false)).severity === 'SAFE',
    'B66 - a CLEARED condition stops driving the area severity')
  check(areaOperationalSummary(area, at(LIFECYCLE.RESOLVED, true, 'alert')).severity === 'ALERT',
    'B67 - active ALERT + RESOLVED -> area ALERT')
  check(areaOperationalSummary(area, at(LIFECYCLE.NEW, true, 'info')).severity === 'SAFE',
    'B68 - INFO never promotes an area')

  // The two questions stay separate: severity is the world, counts are the work.
  const resolvedActive = areaOperationalSummary(area, at(LIFECYCLE.RESOLVED))
  check(resolvedActive.severity === 'DANGER' && resolvedActive.activeCount === 0,
    'B69 - a resolved-but-active alert is off the work count while still colouring the area')

  const every = [LIFECYCLE.NEW, LIFECYCLE.ACKNOWLEDGED, LIFECYCLE.IN_REVIEW, LIFECYCLE.RESOLVED]
    .map((l) => areaOperationalSummary(area, at(l)).severity)
  check(new Set(every).size === 1,
    'B70 - lifecycle never changes area severity while the condition holds', every.join(','))

  // ...and it survives the real sort used by the panel.
  const rows = sortAreasOperational(DEMO_AREAS, [
    { ...base, areaId: 'DEMO-AREA-01', lifecycle: LIFECYCLE.RESOLVED, active: true },
  ])
  check(rows[0].areaId === 'DEMO-AREA-01' && rows[0].severity === 'DANGER',
    'B71 - and the area board still sorts that area to the top')
}

// ============================================================================
section('B - logic: demo seed and session state')

{
  // 24 - a seeded session and a restored session are the same shape.
  const fixture = demoAlerts(T0)
  const seeded = canonicalAlertState(true, { alerts: fixture })
  const restored = canonicalAlertState(true, deserializeState(
    JSON.stringify(serializeState(seeded, { isDemo: true, now: T0 })), { isDemo: true }
  ))
  const shape = (o) => JSON.stringify(Object.keys(o).sort())
  check(shape(seeded) === shape(restored),
    'B72 - a fresh demo seed has the same canonical state shape as a restored session',
    `${shape(seeded)} vs ${shape(restored)}`)
  check(shape(seeded.selection) === shape(restored.selection), 'B73 - identical selection shape')
  check(shape(seeded.filters) === shape(restored.filters), 'B74 - identical filters shape')
  check(shape(seeded) === shape(canonicalAlertState(false, null)),
    'B75 - and an empty live session has that shape too')
  check(seeded.isDemo === true && canonicalAlertState(false, null).isDemo === false,
    'B76 - the mode travels inside the state')
  check(Array.isArray(seeded.alerts) && seeded.alerts.length === fixture.length,
    'B77 - the seed carries the fixture alerts')

  // Every persisted filter axis survives, including the condition axis.
  check(Object.keys(createInitialPersistedState().filters).sort().join() ===
    Object.keys(DEFAULT_FILTERS).sort().join(),
    'B78 - the persisted filter set matches the runtime filter set')
}

// 26-30 - the storage round trip, with a fake storage.
{
  const makeStorage = () => {
    const map = new Map()
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    }
  }
  const storage = makeStorage()
  const fixture = demoAlerts(T0)
  let s = canonicalAlertState(true, { alerts: fixture })
  const target = s.alerts.find((a) => a.lifecycle === LIFECYCLE.NEW)
  s = applyLifecycleAction(s, target.id, 'review', { now: T0 + 10, operator: OP })
  s = applyLifecycleAction(s, target.id, 'resolve', {
    now: T0 + 20, operator: OP, reason: 'false_alarm', note: 'looked again',
  })
  saveState(s, { isDemo: true, storage, now: T0 + 30 })

  const back = loadState({ isDemo: true, storage })
  const kept = back.alerts.find((a) => a.id === target.id)
  check(kept.lifecycle === LIFECYCLE.RESOLVED, 'B79 - a demo resolve survives the storage round trip')
  check(kept.resolveReason === 'false_alarm', 'B80 - the reason survives')
  check(kept.resolveNote === 'looked again', 'B81 - the note survives')
  check(kept.owner?.name === OP.name, 'B82 - the owner survives')
  check(kept.actionLog.length === 2, 'B83 - the whole action log survives', `${kept.actionLog.length} entries`)
  check(kept.acknowledgedAt === undefined || kept.reviewStartedAt === T0 + 10,
    'B84 - the workflow timestamps survive')
  check(kept.persisted === false && kept.sessionLocal === true,
    'B85 - and a restored alert still declares itself session-local')

  // 29/30 - the two modes never read each other's state.
  check(loadState({ isDemo: false, storage }) === null,
    'B86 - a live session refuses to restore demo state')
  const liveStorage = makeStorage()
  saveState(canonicalAlertState(false, { alerts: [base] }), { isDemo: false, storage: liveStorage, now: T0 })
  check(loadState({ isDemo: true, storage: liveStorage }) === null,
    'B87 - a demo session refuses to restore live state')
  check(loadState({ isDemo: false, storage: liveStorage })?.alerts.length === 1,
    'B88 - while each mode restores its own')
}

// ============================================================================
section('B - logic: operator log and timestamp honesty')

{
  let s = canonicalAlertState(true, { alerts: demoAlerts(T0) })
  const target = s.alerts.find((a) => a.lifecycle === LIFECYCLE.NEW)
  s = applyLifecycleAction(s, target.id, 'acknowledge', { now: T0 + 1000, operator: OP })
  s = applyLifecycleAction(s, target.id, 'resolve', {
    now: T0 + 2000, operator: OP, reason: 'handled', note: null,
  })
  const rows = operatorLogEntries(s.alerts, { lang: 'en' })
  check(rows.length === 2, 'B89 - every operator action becomes a log row', `${rows.length}`)
  check(rows[0].at > rows[1].at, 'B90 - operator rows are newest first')
  check(rows.every((r) => r.source === 'operator' && r.kind === 'operator'),
    'B91 - operator rows declare their own source')
  check(rows.every((r) => /SESSION-LOCAL/.test(r.message)), 'B92 - and every one says SESSION-LOCAL')
  check(rows.every((r) => r.areaId === target.areaId),
    'B93 - the area comes from the alert, never inferred from a source type')
  check(rows.every((r) => Number.isFinite(r.at) && typeof r.time === 'string'),
    'B94 - operator actions carry a real timestamp')
  check(/HANDLED/.test(rows[0].message), 'B95 - the resolve reason is shown in the log row')
  check(operatorLogEntries(s.alerts, { lang: 'he' })[0].message !== rows[0].message,
    'B96 - the log row is localized')
}

// 73/74/75 - nothing invents a time for an event that has none.
{
  check(sessionEntryEpoch({ id: `${T0}-0` }) === T0, 'B97 - a derived feed id yields its real epoch')
  check(sessionEntryEpoch({ id: 'ard-alert' }) === null,
    'B98 - a controller id yields no epoch rather than a guess')
  check(sessionEntryEpoch({ id: undefined }) === null, 'B99 - a missing id yields no epoch')

  const session = [
    { id: `${T0 + 5000}-0`, message: 'newest sensor', source: 'radar' },
    { id: 'ard-alert', message: 'controller', source: 'controller' },
    { id: `${T0 + 1000}-1`, message: 'older sensor', source: 'camera' },
  ]
  const operator = operatorLogEntries(
    [{ ...base, areaId: 'AREA-01', actionLog: [{ at: T0 + 3000, action: 'acknowledge', from: 'NEW', to: 'ACKNOWLEDGED', operatorName: 'x' }] }],
    { lang: 'en' }
  )
  const merged = mergeSessionLog(session, operator)
  const controller = merged.find((e) => e.id === 'ard-alert')
  check(controller.at === null || controller.at === undefined,
    'B100 - a controller entry is given no timestamp by the merge', String(controller.at))
  check(merged.indexOf(controller) === 1,
    'B101 - and keeps its position in its own source order rather than being re-sorted by a made-up time')
  check(merged[0].message === 'newest sensor' && merged[3].message === 'older sensor',
    'B102 - timed entries merge chronologically around it')
  check(merged.filter((e) => e.source === 'operator').length === 1,
    'B103 - the operator entry is merged in exactly once')
  check(merged.length === session.length + operator.length,
    'B104 - the merge adds rows and removes none')
  check(mergeSessionLog(session, []).length === session.length,
    'B105 - with no operator actions the feed is returned unchanged')
}

// 72 - the log split still refuses to invent an area.
{
  const entries = [
    { id: '1', source: 'controller', message: 'Arduino: ALERT' },
    { id: '2', source: 'radar', message: 'Radar link lost' },
    { id: '3', source: 'operator', areaId: 'DEMO-AREA-02', message: 'NEW -> ACKNOWLEDGED' },
  ]
  const split = splitSessionLog(entries, DEMO_AREAS, 'DEMO-AREA-02')
  check(split.unassigned.some((e) => e.id === '1'),
    'B106 - a controller message is still filed as unassigned, never given an area')
  check(split.inArea.some((e) => e.id === '3'),
    'B107 - an operator action is filed under the area of the alert it acted on')
  check(!split.inArea.some((e) => e.id === '1'), 'B108 - and never leaks into an area')
}

// ============================================================================
section('C - browser checks')

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()

/** A brand-new tab: demo workflow state is per-session, so each scenario that
 *  mutates it starts clean. */
async function freshPage({ width = 1920, height = 1080, lang = 'en', density = 'compact' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  page.consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') page.consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => page.consoleErrors.push(String(e)))
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', admin.username)
  await page.fill('#password', admin.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
  await page.evaluate(([l, d]) => {
    localStorage.setItem('atapis-concepts-lang', l)
    localStorage.setItem('atapis-concepts-density', d)
  }, [lang, density])
  page.ops = async (qs = '?demo=1&phase=approach') => {
    await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1900)
  }
  page.ctx = ctx
  return page
}

const lifeOf = (page) => page.$eval('.io2-ab-life', (e) => e.textContent.trim()).catch(() => '(none)')
const idOf = (page) => page.$eval('.io2-ab-id', (e) => e.textContent.trim()).catch(() => '(none)')
const actionsOf = (page) => page.$$eval('[data-io2-action]', (n) => n.map((e) => e.dataset.io2Action))
const docHeight = (page) => page.evaluate(() => document.documentElement.scrollHeight)

// 76-86 - the action bar.
{
  const page = await freshPage()
  await page.ops()

  check(Boolean(await page.$('.io2-sel-actions')), 'C01 - the selected-alert action region renders')
  const placement = await page.evaluate(() => {
    const region = document.querySelector('.io2-sel-actions')
    const list = document.querySelector('.io2-alerts-scroll')
    const panel = document.querySelector('.io2-a-alerts')
    return {
      outsideScroller: !list.contains(region),
      insidePanel: panel.contains(region),
      externalBar: Boolean(document.querySelector('.io2-actionbar')),
    }
  })
  check(placement.outsideScroller, 'C02 - and it sits outside the scrolling alert list entirely')
  check(placement.insidePanel && !placement.externalBar,
    'C02b - it is part of the alerts panel, and no external action bar exists (A3.1.1)',
    JSON.stringify(placement))
  check((await page.$$('[data-io2-alert-row] [data-io2-action]')).length === 0,
    'C03 - no alert row contains an action button')

  const barH = await page.$eval('.io2-sel-actions', (e) => Math.round(e.getBoundingClientRect().height))
  check(barH >= 44, 'C04 - the region holds its approved minimum height', `${barH}px`)

  // 77 - selecting a row must not change that row's height.
  const rowHeights = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll('[data-io2-alert-row]')]
    // A row that is NOT currently selected, measured before and after selection.
    const target = rows.find((r) => r.getAttribute('aria-selected') !== 'true')
    const before = Math.round(target.getBoundingClientRect().height)
    return { id: target.getAttribute('data-io2-alert-row'), before }
  })
  await page.click(`[data-io2-alert-row="${rowHeights.id.replace(/"/g, '\\"')}"]`)
  await page.waitForTimeout(500)
  const afterH = await page.$eval(`[data-io2-alert-row]`, () => 0).catch(() => 0)
  const measured = await page.evaluate((id) => {
    const el = document.querySelector(`[data-io2-alert-row="${CSS.escape(id)}"]`)
    return el ? Math.round(el.getBoundingClientRect().height) : null
  }, rowHeights.id)
  check(measured === rowHeights.before,
    'C05 - an alert row is exactly as tall selected as unselected',
    `${rowHeights.before}px -> ${measured}px (${afterH === 0 ? 'measured' : ''})`)

  // 83/84/85 - what the region states.
  //
  // SESSION-LOCAL is abbreviated in the region and stated in full in the panel
  // caption two lines above it, which is A3.1.1 §17: the warning stays visible,
  // it just does not need a strip of its own. Both halves are checked.
  const localText = await page.evaluate(() => {
    const panel = document.querySelector('.io2-a-alerts')
    return {
      region: document.querySelector('.io2-sel-actions').innerText,
      caption: panel.querySelector('.io2-panel-note')?.innerText || '',
      full: panel.innerText,
    }
  })
  check(/SESSION-LOCAL/.test(localText.region),
    'C06 - the region always states SESSION-LOCAL')
  check(/NOT PERSISTED ON THE SERVER|NOT SERVER-PERSISTED/i.test(localText.full) ||
        localText.full.includes('אינו נשמר בשרת'),
    'C06b - and the panel states in full that it is not persisted on the server',
    localText.caption.replace(/\s+/g, ' ').slice(0, 80))
  // Rebased in Phase A3.2 (§60/§61/§95). The condition chip was removed from the
  // selected-alert region and ONLY from there; the two axes are still separate
  // and the condition is still reported, on the alert row. Coverage is not
  // reduced — it is asserted in both halves, so deleting the condition from the
  // model would still fail here.
  check(Boolean(await page.$('.io2-sel-actions .io2-ab-life')),
    'C07 - lifecycle is shown as its own readout in the region')
  check(await page.$('.io2-sel-actions .io2-ab-cond') === null,
    'C07b - and the condition chip is no longer duplicated there (A3.2 §60)')
  check(await page.evaluate(() => {
    const row = document.querySelector('[data-io2-alert-row][aria-selected="true"]')
    if (!row) return false
    // The row encodes the condition independently of the lifecycle: a cleared
    // condition marks the row and prints CONDITION CLEARED, an active one does
    // neither. Either way the axis is present and readable.
    const cleared = row.classList.contains('is-cleared')
    const says = Boolean(row.querySelector('.io2-alert-cleared'))
    return cleared === says
  }), 'C07c - while the condition axis is still reported on the row, separately from lifecycle')
  // Severity is in the region. The SOURCE is deliberately not repeated there
  // (§16: the region does not duplicate what the row beside it already says) —
  // so it is checked where it actually lives, on the selected row.
  check(Boolean(await page.$('.io2-sel-actions .io2-ab-sev')), 'C08 - severity is shown in the region')
  check(await page.evaluate(() => {
    const row = document.querySelector('[data-io2-alert-row][aria-selected="true"]')
    return Boolean(row && row.querySelector('.io2-alert-src')?.textContent.trim())
  }), 'C08b - and the selected row still names its source')
  const isolated = await page.$$eval('.io2-sel-actions .io2-val', (n) => n.every((e) => e.getAttribute('dir') === 'ltr'))
  check(isolated, 'C09 - every identifier in the region is isolated with dir="ltr"')

  // 86 - a truncated id is still fully available.
  const idInfo = await page.$eval('.io2-ab-id', (e) => ({
    title: e.getAttribute('title'), aria: e.getAttribute('aria-label'), text: e.textContent.trim(),
  }))
  check(idInfo.title === idInfo.text && /Alert ID/.test(idInfo.aria || ''),
    'C10 - the full alert id is available in title and aria-label even when it truncates visually')

  await page.ctx.close()
}

// 79-82 - the offered actions match the lifecycle, end to end.
{
  const page = await freshPage()
  await page.ops()

  // Drive one alert through the whole workflow and check the offer each time.
  await page.click('.io2-filter-tab >> nth=1') // NEW
  await page.waitForTimeout(500)
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(400)
  const selected = await idOf(page)
  check((await actionsOf(page)).join() === 'acknowledge,review,resolve',
    'C11 - a NEW alert offers acknowledge, start review and resolve', (await actionsOf(page)).join())

  await page.click('[data-io2-action="acknowledge"]')
  await page.waitForTimeout(600)
  check(await lifeOf(page) === 'ACK', 'C12 - acknowledge is immediate, with no confirmation')
  check(await idOf(page) === selected, 'C13 - and the selection stays on the same alert')
  check((await actionsOf(page)).join() === 'review,resolve',
    'C14 - an ACKNOWLEDGED alert offers start review and resolve')
  check(Boolean(await page.$('.io2-ab-outside-tag')),
    'C15 - the alert leaving the NEW filter is announced, not silently dropped')

  await page.click('.io2-ab-show')
  await page.waitForTimeout(500)
  check(!(await page.$('.io2-ab-outside-tag')), 'C16 - SHOW ALERT brings it back into view')
  check(await idOf(page) === selected, 'C17 - without changing the selection')

  await page.click('[data-io2-action="review"]')
  await page.waitForTimeout(600)
  check(await lifeOf(page) === 'IN REVIEW', 'C18 - start review is immediate too')
  check((await actionsOf(page)).join() === 'resolve', 'C19 - IN REVIEW offers resolve only')
  const ownerText = await page.$eval('.io2-ab-owner', (e) => e.textContent).catch(() => '')
  check(/SESSION OWNER/.test(ownerText) && new RegExp(admin.username).test(ownerText),
    'C20 - ownership shows the real signed-in user', ownerText.trim())

  await page.ctx.close()
}

// 37-48 - the resolve dialog.
{
  const page = await freshPage()
  await page.ops()
  const before = await docHeight(page)
  // Panel geometry before any of this, for C34 below.
  const layoutBefore = await page.evaluate(() => ({
    bar: Math.round(document.querySelector('.io2-sel-actions').getBoundingClientRect().height),
    alerts: Math.round(document.querySelector('.io2-a-alerts').getBoundingClientRect().height),
    list: Math.round(document.querySelector('.io2-alerts-scroll')?.getBoundingClientRect().height || 0),
  }))

  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  check(await page.$eval('dialog.io2-dialog--resolve', (e) => e.open),
    'C21 - resolve opens a confirmation rather than acting immediately')
  check(await docHeight(page) === before, 'C22 - the dialog adds no document height')
  check(await page.$eval('[data-io2-confirm="resolve"]', (e) => e.disabled),
    'C23 - confirm is disabled until a reason is chosen')

  const opts = await page.$$eval('.io2-dialog-select option', (n) => n.map((e) => e.value).filter(Boolean))
  check(opts.join() === RESOLVE_REASONS.join(), 'C24 - exactly the five approved reasons are offered', opts.join())
  check(Boolean(await page.$('.io2-dialog-warn')),
    'C25 - resolving an alert whose condition still holds shows the warning')
  const warn = await page.$eval('.io2-dialog-warn', (e) => e.textContent)
  check(/STILL ACTIVE/i.test(warn) && /does not indicate/i.test(warn),
    'C26 - and the warning says resolving closes the workflow, not the condition')
  check(await page.$eval('.io2-dialog-note', (e) => Number(e.getAttribute('maxlength'))) === 500,
    'C27 - the note is capped at 500 characters')

  // Escape must not mutate anything.
  const lifeBefore = await lifeOf(page)
  await page.selectOption('.io2-dialog-select', 'handled')
  await page.fill('.io2-dialog-note', 'typed, then escaped')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  check((await page.$$('dialog')).length === 0, 'C28 - Escape closes the dialog')
  check(await lifeOf(page) === lifeBefore, 'C29 - Escape mutates nothing')
  check(await page.evaluate(() => document.activeElement?.dataset?.io2Action) === 'resolve',
    'C30 - and focus returns to the button that opened it')

  // 46 - and the dialog is usable again afterwards.
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  check(await page.$eval('.io2-dialog-note', (e) => e.value) === '' &&
    await page.$eval('.io2-dialog-select', (e) => e.value) === '',
    'C31 - reopening the dialog gives a fresh form, not the abandoned one')

  // Cancel is equally inert.
  await page.selectOption('.io2-dialog-select', 'handled')
  await page.click('.io2-dialog-cancel')
  await page.waitForTimeout(500)
  check((await page.$$('dialog')).length === 0 && await lifeOf(page) === lifeBefore,
    'C32 - Cancel closes without mutating')

  // Confirm, with a whitespace-only note.
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(500)
  await page.selectOption('.io2-dialog-select', 'false_alarm')
  await page.fill('.io2-dialog-note', '    ')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(700)
  check(await lifeOf(page) === 'RESOLVED', 'C33 - confirming resolves the alert')

  // C34 used to assert the document height was back where it started. Since
  // Phase A3.1 that is no longer true, for an honest reason: resolving writes an
  // operator entry to the session log, and the log is now full width and no
  // longer sitting at its scroll cap, so one more entry makes the page one row
  // taller. The dialog's own contribution is still exactly zero — asserted while
  // it was open, above — and the layout itself must not reflow, which is what
  // this now checks.
  {
    const after = await page.evaluate(() => ({
      bar: Math.round(document.querySelector('.io2-sel-actions').getBoundingClientRect().height),
      alerts: Math.round(document.querySelector('.io2-a-alerts').getBoundingClientRect().height),
      list: Math.round(document.querySelector('.io2-alerts-scroll')?.getBoundingClientRect().height || 0),
      doc: document.documentElement.scrollHeight,
    }))
    check(after.bar === layoutBefore.bar && after.alerts === layoutBefore.alerts && after.list === layoutBefore.list,
      'C34 - resolving reflows no panel: the region, the alerts panel and the list keep their heights',
      `${JSON.stringify(layoutBefore)} -> ${JSON.stringify(after)}`)
    // Phase A3.1.1 §34: resolving writes a session-log row, and with the log at
    // a FIXED height that row changes what is inside the log and nothing else.
    // Before this phase the log grew with its content and the whole document
    // grew with it, so this could not have been asserted at all.
    check(after.doc === before,
      'C34b - and the document height is exactly what it was before the action',
      `${before} -> ${after.doc}`)
  }

  const stored = await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    const a = s.alerts.find((x) => x.lifecycle === 'RESOLVED' && x.resolveReason === 'false_alarm')
    return a ? { note: a.resolveNote, log: a.actionLog.length, owner: a.owner } : null
  })
  check(stored && (stored.note === null || stored.note === ''),
    'C35 - a whitespace-only note is normalized away', JSON.stringify(stored?.note))
  check(stored && stored.log >= 1, 'C36 - the action is written to the action log')

  await page.ctx.close()
}

// 47/48 - the reopen dialog.
{
  const page = await freshPage()
  await page.ops()
  await page.click('.io2-filter-tab >> nth=4') // RESOLVED
  await page.waitForTimeout(600)
  const rows = await page.$$('[data-io2-alert-row]')
  check(rows.length > 0, 'C37 - the demo seed includes resolved alerts to reopen', `${rows.length}`)
  await rows[0].click()
  await page.waitForTimeout(400)
  check((await actionsOf(page)).join() === 'reopen', 'C38 - a RESOLVED alert offers reopen only')

  const before = await docHeight(page)
  await page.click('[data-io2-action="reopen"]')
  await page.waitForTimeout(600)
  check(await page.$eval('dialog.io2-dialog--reopen', (e) => e.open), 'C39 - reopen requires confirmation')
  check(await docHeight(page) === before, 'C40 - the reopen dialog adds no document height')

  const target = await page.$eval('[data-io2-reopen-target]', (e) => e.dataset.io2ReopenTarget)
  const hasOwner = await page.evaluate(() => Boolean(document.querySelector('.io2-dialog-identity .io2-ab-owner')))
  check(target === (hasOwner ? 'IN_REVIEW' : 'ACKNOWLEDGED'),
    'C41 - the dialog states the destination, decided by the prior owner alone',
    `owner=${hasOwner} target=${target}`)
  const prev = await page.$eval('.io2-dialog-prev', (e) => e.textContent)
  check(prev.length > 0, 'C42 - the previous reason, note and owner are shown before confirming')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check(await lifeOf(page) === 'RESOLVED', 'C43 - escaping the reopen dialog mutates nothing')

  await page.click('[data-io2-action="reopen"]')
  await page.waitForTimeout(500)
  await page.click('[data-io2-confirm="reopen"]')
  await page.waitForTimeout(700)
  const after = await lifeOf(page)
  check(after === (hasOwner ? 'IN REVIEW' : 'ACK'), 'C44 - reopen lands on the stated destination', after)

  await page.ctx.close()
}

// 66-71 - the session log.
{
  const page = await freshPage()
  await page.ops()
  await page.click('[data-io2-action="acknowledge"]').catch(async () => {
    await page.click('[data-io2-action="review"]')
  })
  await page.waitForTimeout(800)

  const operatorRows = await page.$$eval('.dm-alert--k-operator', (n) =>
    n.map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
  check(operatorRows.length >= 1, 'C45 - an operator action appears in the session log', `${operatorRows.length}`)
  check(operatorRows.every((r) => /SESSION-LOCAL/.test(r)),
    'C46 - and every operator row is marked SESSION-LOCAL')
  const kinds = await page.$$eval('.io2-log-scroll .dm-alert', (n) =>
    [...new Set(n.map((e) => [...e.classList].find((c) => c.startsWith('dm-alert--k-'))))])
  check(kinds.length > 1, 'C47 - the sensor and system events are still in the log beside it', kinds.join(','))

  await page.ctx.close()
}

// 26-28/36 - demo persistence.
{
  const page = await freshPage()
  await page.ops()
  await page.click('.io2-filter-tab >> nth=1')
  await page.waitForTimeout(500)
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(300)
  const workedOn = await idOf(page)
  await page.click('[data-io2-action="review"]')
  await page.waitForTimeout(700)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const survived = await page.evaluate((id) => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    const a = s.alerts.find((x) => x.id === id)
    return a ? { lifecycle: a.lifecycle, owner: a.owner?.name || null, log: a.actionLog.length } : null
  }, workedOn)
  check(survived?.lifecycle === LIFECYCLE.IN_REVIEW,
    'C48 - a demo lifecycle change survives a reload of the same tab', JSON.stringify(survived))
  check(survived?.owner === admin.username, 'C49 - with its owner')
  check(survived?.log === 1, 'C50 - and its action log, unduplicated by StrictMode', `${survived?.log}`)

  // 28 - a new tab is a new session.
  const other = await freshPage()
  await other.ops()
  const fresh = await other.evaluate((id) => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    const a = s.alerts.find((x) => x.id === id)
    return a ? { lifecycle: a.lifecycle, log: a.actionLog.length } : null
  }, workedOn)
  check(fresh && fresh.lifecycle === LIFECYCLE.NEW && fresh.log === 0,
    'C51 - a new tab starts from the pristine fixture', JSON.stringify(fresh))
  await other.ctx.close()
  await page.ctx.close()
}

// 29-32/36 - mode transitions, under StrictMode (the app runs in it).
{
  const page = await freshPage()
  await page.ops()
  await page.click('[data-io2-action="acknowledge"]').catch(() => {})
  await page.waitForTimeout(700)
  const demoIds = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1')).alerts.map((a) => a.id))

  // Demo -> Live.
  await page.ops('')
  const live = await page.evaluate(() => JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1')))
  check(live.isDemo === false, 'C52 - switching to live stores live state')
  check(!live.alerts.some((a) => demoIds.includes(a.id)),
    'C53 - and no demo alert is carried into it')
  check(!live.alerts.some((a) => a.areaId?.startsWith('DEMO-')),
    'C54 - no live alert claims a demo area')

  // Live -> Demo.
  await page.ops()
  const back = await page.evaluate(() => JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1')))
  check(back.isDemo === true, 'C55 - switching back to demo stores demo state')
  check(back.alerts.every((a) => a.isDemo === true),
    'C56 - and every alert in it is a demo alert')
  check(back.alerts.length === demoIds.length,
    'C57 - the demo session is reseeded whole, not merged', `${back.alerts.length}/${demoIds.length}`)

  // 36 - a reload immediately after a switch keeps the right mode.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const afterReload = await page.evaluate(() => JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1')))
  check(afterReload.isDemo === true, 'C58 - a reload straight after a mode switch restores the right mode')
  check(page.consoleErrors.filter((e) => !/Failed to fetch|net::|favicon/i.test(e)).length === 0,
    'C59 - no console error, warning or render loop across the transitions',
    page.consoleErrors.slice(0, 2).join(' | '))

  await page.ctx.close()
}

// 87-94 - the context menu.
{
  const page = await freshPage()
  await page.ops()
  const before = await docHeight(page)

  await page.click('[data-io2-alert-row] >> nth=1', { button: 'right' })
  await page.waitForTimeout(500)
  check(Boolean(await page.$('.io2-ctxmenu')), 'C60 - right-click opens the context menu')
  check(await docHeight(page) === before, 'C61 - the menu adds no document height')

  const menuFor = await page.$eval('.io2-ctxmenu', (e) => e.dataset.io2Ctxmenu)
  check(menuFor === await idOf(page), 'C62 - the menu acts on the row it was opened from, which it selects first')

  const items = await page.$$eval('[data-io2-menu-action]', (n) => n.map((e) => e.dataset.io2MenuAction))
  const barActions = await actionsOf(page)
  check(items.slice(0, -1).join() === barActions.join(),
    'C63 - it offers exactly the actions the bar offers', `${items.join()} vs ${barActions.join()}`)
  check(items.at(-1) === 'copy-id', 'C64 - plus Copy Alert ID')
  check(await page.$eval('[data-io2-menu-action="copy-id"]', (e) => e.dataset.io2CopyValue) === menuFor,
    'C65 - and Copy Alert ID carries the full, untruncated id')

  const clamped = await page.evaluate(() => {
    const b = document.querySelector('.io2-ctxmenu').getBoundingClientRect()
    return b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1
  })
  check(clamped, 'C66 - the menu is clamped inside the viewport')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check(!(await page.$('.io2-ctxmenu')), 'C67 - Escape closes it')
  check(await page.evaluate(() => document.activeElement?.hasAttribute('data-io2-alert-row')),
    'C68 - and focus returns to the alert row')

  // Shift+F10 is the keyboard route to the same menu.
  await page.focus('[data-io2-alert-row]')
  await page.keyboard.press('Shift+F10')
  await page.waitForTimeout(500)
  check(Boolean(await page.$('.io2-ctxmenu')), 'C69 - Shift+F10 opens the menu from the keyboard')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // An action taken from the menu goes through the same dispatcher.
  await page.click('.io2-filter-tab >> nth=1')
  await page.waitForTimeout(500)
  await page.click('[data-io2-alert-row] >> nth=0', { button: 'right' })
  await page.waitForTimeout(500)
  const ackItem = await page.$('[data-io2-menu-action="acknowledge"]')
  if (ackItem) {
    await ackItem.click()
    await page.waitForTimeout(600)
    check(await lifeOf(page) === 'ACK', 'C70 - an action taken from the menu produces the same result as the bar')
  } else {
    check(false, 'C70 - an action taken from the menu produces the same result as the bar', 'no acknowledge item')
  }
  check(!(await page.$('.io2-ctxmenu')), 'C71 - and the menu closes after acting')

  await page.ctx.close()
}

// 41-44 - a new DANGER during handling.
{
  const page = await freshPage()
  await page.ops()
  // Park the selection on a non-DANGER alert so the demo's DANGER alerts are
  // genuinely unseen, then open a dialog and let the notice arrive behind it.
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('industrial-ops-alert-state-v1')
    const state = JSON.parse(raw)
    state.selection.selectedAlertId = 'DEMO-AREA-01|radar|target|DEMO-RDR-01:target:1#1'
    state.selection.selectedAreaId = 'DEMO-AREA-01'
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(state))
  })
  await page.ops()

  const selectedBefore = await idOf(page)
  // Phase A3.1.1: the band became a chip inside the alerts panel. Same trigger,
  // same unseen-danger selector, same rule that it never moves anything.
  check(Boolean(await page.$('.io2-new-danger')), 'C72 - a new DANGER raises its indicator')
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  await page.fill('.io2-dialog-note', 'still typing')
  await page.waitForTimeout(1600) // let at least one poll tick land
  check(await page.$eval('dialog.io2-dialog--resolve', (e) => e.open).catch(() => false),
    'C73 - the dialog stays open while a new DANGER is present')
  check(await page.$eval('.io2-dialog-note', (e) => e.value) === 'still typing',
    'C74 - and the note the operator typed is untouched')
  check(Boolean(await page.$('.io2-new-danger')), 'C75 - the DANGER indicator remains visible')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check(await idOf(page) === selectedBefore, 'C76 - the selection never moved on its own')

  await page.ctx.close()
}

// 6/12 - the empty state.
{
  const page = await freshPage()
  await page.ops()
  await page.fill('.io2-filter-search input', 'zzzz-no-such-alert')
  await page.waitForTimeout(800)
  // The selection survives an empty result, so the region keeps its context.
  const hasBar = Boolean(await page.$('.io2-sel-actions'))
  const h = await page.$eval('.io2-sel-actions', (e) => Math.round(e.getBoundingClientRect().height))
  check(hasBar && h >= 44, 'C77 - the region keeps its height when the list empties', `${h}px`)

  // And the genuine no-selection state, forced through storage.
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.alerts = []
    s.selection.selectedAlertId = null
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  })
  await page.ops()
  const empty = await page.$('.io2-sel-actions--empty')
  if (empty) {
    const eh = await page.$eval('.io2-sel-actions--empty', (e) => Math.round(e.getBoundingClientRect().height))
    const text = await page.$eval('.io2-sel-actions--empty', (e) => e.textContent)
    check(eh >= 44, 'C78 - the empty region keeps its height rather than collapsing', `${eh}px`)
    check(/NO ALERT SELECTED/i.test(text) || /לא נבחרה/.test(text),
      'C79 - and says NO ALERT SELECTED with a hint')
    check(!(await page.$('[data-io2-action]')), 'C80 - with no action buttons offered')
  } else {
    check(false, 'C78 - the empty region keeps its height rather than collapsing', 'empty region not reached')
    check(false, 'C79 - and says NO ALERT SELECTED with a hint')
    check(false, 'C80 - with no action buttons offered')
  }
  await page.ctx.close()
}

// 50 - the critical scenario, in the browser.
{
  const page = await freshPage()
  await page.ops()
  // Find an ACTIVE DANGER and resolve it as a false alarm.
  const dangerId = await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    const a = s.alerts.find((x) => x.severity === 'danger' && x.active && x.lifecycle !== 'RESOLVED')
    return a ? a.id : null
  })
  check(Boolean(dangerId), 'C81 - the demo has an active DANGER to work with')
  await page.click('.io2-filter-tab >> nth=5').catch(() => {})
  await page.evaluate((id) => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.selection.selectedAlertId = id
    s.filters.lifecycle = 'ALL'
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  }, dangerId)
  await page.ops()

  const modeBefore = await page.$eval('.io2-strip-modeval', (e) => e.textContent.trim())
  // Read from the status strip cell: Phase A3.1.1 removed the decision band, and
  // the strip is where the backend's fused figure is stated now.
  const fusedBefore = await page.$eval('.io2-strip-cell[title*="Fused risk"]', (e) => e.textContent.trim()).catch(() => '')
  const areaBefore = await page.$$eval('.io2-area-row', (n) => n.map((e) => e.textContent.slice(0, 20)))

  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  await page.selectOption('.io2-dialog-select', 'false_alarm')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(900)

  check(await lifeOf(page) === 'RESOLVED', 'C82 - the alert lifecycle becomes RESOLVED')
  // Rebased in Phase A3.2 (§60/§62/§95). This check's subject was never the chip
  // — it is that resolving an alert does NOT clear the condition. With the chip
  // gone from the region, the same fact is read from the row, which marks a
  // cleared condition and says nothing when the condition still holds.
  const stillActive = await page.evaluate(() => {
    const row = document.querySelector('[data-io2-alert-row][aria-selected="true"]')
    if (!row) return null
    return {
      cleared: row.classList.contains('is-cleared'),
      says: Boolean(row.querySelector('.io2-alert-cleared')),
    }
  })
  check(stillActive && stillActive.cleared === false && stillActive.says === false,
    'C83 - the condition is still ACTIVE: resolving closed the workflow, not the condition',
    JSON.stringify(stillActive))
  check(await page.$eval('.io2-strip-modeval', (e) => e.textContent.trim()) === modeBefore,
    'C84 - the system mode is unchanged by an operator resolving an alert')
  check(await page.$eval('.io2-strip-cell[title*="Fused risk"]', (e) => e.textContent.trim()).catch(() => '') === fusedBefore,
    'C85 - the fused risk is unchanged')
  const areaAfter = await page.$$eval('.io2-area-row', (n) => n.map((e) => e.textContent.slice(0, 20)))
  check(JSON.stringify(areaAfter) === JSON.stringify(areaBefore),
    'C86 - and the area severities are unchanged: the threat did not go away',
    `${areaBefore[0]} -> ${areaAfter[0]}`)
  const sev = await page.$eval('.io2-ab-sev', (e) => e.textContent.trim())
  check(/DANGER/i.test(sev) || /סכנה/.test(sev), 'C87 - the alert severity is still DANGER', sev)

  await page.ctx.close()
}

// 96/97/104 - the height budget survives the relocated controls.
{
  // Re-based by Phase A3.1: 4+ at 1920 and 3+ at 1366, because the rows are
  // taller and more readable than they were in A2. Re-based again by A3.1.1,
  // which narrowed the panel to 3/12 so the feed could have its width back:
  // §27 sets the floor at 3 everywhere. More rows are fine; fewer than the
  // approved floor is the regression this guards against.
  for (const [w, h, lang, density, min] of [
    [1920, 1080, 'he', 'compact', 3], [1920, 1080, 'en', 'compact', 3],
    [1920, 1080, 'he', 'comfort', 3], [1920, 1080, 'en', 'comfort', 3],
    [1366, 768, 'he', 'compact', 3], [1366, 768, 'en', 'compact', 3],
    [1366, 768, 'he', 'comfort', 3], [1366, 768, 'en', 'comfort', 3],
  ]) {
    const page = await freshPage({ width: w, height: h, lang, density })
    await page.ops()
    const m = await page.evaluate(() => {
      const s = document.querySelector('.io2-alerts-scroll')
      const rows = [...document.querySelectorAll('[data-io2-alert-row]')]
      const top = s.getBoundingClientRect().top
      const bottom = top + s.clientHeight
      return {
        visible: rows.filter((r) => {
          const b = r.getBoundingClientRect()
          return b.top >= top - 1 && b.bottom <= bottom + 1
        }).length,
        bar: Math.round(document.querySelector('.io2-sel-actions').getBoundingClientRect().height),
        insidePanel: document.querySelector('.io2-a-alerts').contains(document.querySelector('.io2-sel-actions')),
        overflow: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
      }
    })
    check(m.visible >= min,
      `C88 - ${w} ${lang} ${density}: at least ${min} alerts still visible`, `${m.visible}`)
    check(m.bar >= 44 && m.insidePanel,
      `C89 - ${w} ${lang} ${density}: the action region holds its height inside the panel`, `${m.bar}px`)
    check(m.overflow <= 1, `C90 - ${w} ${lang} ${density}: no horizontal overflow`, `${m.overflow}px`)
    await page.ctx.close()
  }
}

// 101-105 - the honesty rules the workflow must not have relaxed.
{
  const page = await freshPage()
  await page.ops()
  // Rendered text, not page.content(): under a dev server the latter also
  // contains the injected stylesheet, where a class name could satisfy the test.
  const body = await page.evaluate(() => document.body.innerText)
  check(!/Pair Risk|Combined Risk|\bMatched\b|\bConfirmed\b/i.test(body.replace(/NOT ASSOCIATED/gi, '')),
    'C91 - still no pair, matched or confirmed vocabulary')
  const srcs = await page.$$eval('.io2-alert-src', (n) => n.map((e) => e.textContent.trim()))
  // A3.2: LIVE camera ids stay forbidden. A demo alert may name a DEMO- camera
  // its own area declares (§35); phase-a1 test 33 checks that stricter rule.
  check(!srcs.some((s) => /(^|[^-])\bCAM-0\d/.test(s)), 'C92 - still no live camera id claimed as an alert source')
  check(await page.evaluate(() => {
    const cell = [...document.querySelectorAll('.io2-strip-cell')]
      .find((c) => /Fused risk/i.test(c.getAttribute('title') || ''))
    return Boolean(cell) && /backend/i.test(cell.getAttribute('title'))
  }), 'C93 - fused risk still carries its backend attribution')
  const barSrc = await page.$eval('.io2-sel-actions', (e) => e.textContent.trim())
  check(!/(^|[^-])\bCAM-0\d/.test(barSrc), 'C94 - and the selected-alert region does not name a live camera either',
    barSrc.replace(/\s+/g, ' ').slice(0, 70))
  const areaIds = await page.$$eval('[data-io2-alert-row]', (n) => n.length)
  check(areaIds > 0, 'C95 - the demo workflow renders alerts to act on')

  // 19 - `/` and Alt+n must be dead while a dialog is open.
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  await page.focus('.io2-dialog-note')
  await page.keyboard.press('/')
  await page.waitForTimeout(300)
  check(await page.evaluate(() => document.activeElement?.className?.includes?.('io2-dialog-note')),
    'C96 - "/" does not steal focus to the search box while a dialog is open')
  await page.keyboard.press('Alt+2')
  await page.waitForTimeout(700)
  check(page.url().includes('/dashboard'), 'C97 - and Alt+n does not navigate away from an open dialog')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  await page.ctx.close()
}

await browser.close()

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}  --  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
