// Phase A1 - Command Centre verification.
//
// Covers the fifty scenarios the phase brief requires, in three layers:
//   A. static source checks   (grid validity, typography, no scale/zoom, isolation)
//   B. logic checks           (engine + selectors, imported directly)
//   C. browser checks         (playwright, against a running dev server)
//
// Usage: node scripts/phase-a1-command-center-verify.mjs [baseUrl]
//        needs backend :5000 and Vite (default http://localhost:5174)

import { chromium } from 'playwright'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LIFECYCLE, createInitialAlertState, reduceAlerts,
} from '../src/concepts/industrial-ops/alerts.js'
import { LIVE_AREAS, DEMO_AREAS } from '../src/concepts/industrial-ops/areas.js'
import {
  LIFECYCLE_FILTERS, lifecycleCounts, sortAreasOperational, visibleAlerts,
} from '../src/concepts/industrial-ops/alertSelectors.js'
import { demoAlerts } from '../src/concepts/industrial-ops/demoAlerts.js'
import { splitSessionLog } from '../src/concepts/industrial-ops/useIndustrialOpsCommandCenter.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const IO = path.join(root, 'src', 'concepts', 'industrial-ops')

// Camera tabs are whichever tabs are not the two fixed ones.
const CAM_TAB = '[data-io2-vf-tab]:not([data-io2-vf-tab="all"]):not([data-io2-vf-tab="radar"])'

let failed = 0
let passed = 0
const check = (ok, label, detail = '') => {
  if (ok) passed += 1; else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`)
}
const section = (n) => console.log(`\n=== ${n} ===`)

const read = (p) => readFile(path.join(root, p), 'utf-8')

// ============================================================================
section('A - static source checks')

const css = await read('src/concepts/industrial-ops/industrial.css')
const dashboard = await read('src/concepts/industrial-ops/views/IndustrialDashboard.jsx')

// 42/43 - every grid-template-areas block must be a rectangle: equal column
// count on every row, and every named area contiguous (no L shapes).
{
  const blocks = [...css.matchAll(/grid-template-areas:\s*([^;]+);/g)].map((m) => m[1])
  let allRect = true
  let allSameWidth = true
  const problems = []

  for (const block of blocks) {
    const rows = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
    if (!rows.length) continue
    const width = rows[0].length
    if (!rows.every((r) => r.length === width)) {
      allSameWidth = false
      problems.push(`row width mismatch: ${rows.map((r) => r.length).join('/')}`)
      continue
    }
    const names = new Set(rows.flat())
    for (const name of names) {
      if (name === '.') continue
      let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1, count = 0
      rows.forEach((row, r) => row.forEach((cell, c) => {
        if (cell !== name) return
        count += 1
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }))
      const area = (maxR - minR + 1) * (maxC - minC + 1)
      if (area !== count) { allRect = false; problems.push(`${name}: ${count} cells in a ${area}-cell box`) }
    }
  }
  check(allSameWidth, '42 - every grid-template-areas row declares the same column count',
    problems.filter((p) => p.includes('width')).join('; '))
  check(allRect, '43 - every named grid area is a contiguous rectangle (no L shapes)',
    problems.filter((p) => !p.includes('width')).join('; '))
}

// 45 - the approved type scale is a FLOOR, not a fixed set.
//
// A1 pinned these to exact pixel values. Phase A3.1 is a readability phase and
// deliberately raised several of them, so pinning would now fail on an
// improvement while still saying nothing about a regression. The invariant that
// actually matters is the one below: none of these may ever be smaller than the
// size A1 approved.
{
  const anchors = [
    ['.io2-panel-title', 15], ['.io2-block-title', 15], ['.io2-panel-note', 11],
    ['.io2-ev-line', 13], ['.io2-rf-text', 13], ['.io2-bar-body', 13],
  ]
  const below = []
  const raised = []
  for (const [sel, px] of anchors) {
    const re = new RegExp(`${sel.replace('.', '\\.')}\\s*\\{[^}]*font-size:\\s*([\\d.]+)px`, 's')
    const found = css.match(re)
    if (!found) { below.push(`${sel} missing`); continue }
    const actual = Number(found[1])
    if (actual < px) below.push(`${sel} ${actual}px < ${px}px`)
    else if (actual > px) raised.push(`${sel} ${px}->${actual}`)
  }
  check(below.length === 0, '45 - no approved font size is below its A1 value',
    below.length ? below.join(', ') : `all at or above; raised since: ${raised.join(', ') || 'none'}`)

  // The screen's pre-existing floor is 8.5px (table headers), set long before
  // this phase. A1 must not go below it, and the CSS added in this phase must
  // not introduce micro-type at all.
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  const belowFloor = sizes.filter((s) => s < 8.5)
  check(belowFloor.length === 0, "45b - nothing goes below the screen's existing 8.5px floor",
    belowFloor.join(', '))

  const a1Start = css.indexOf('Command centre: Areas / Alerts / Visual Feed (Phase A1)')
  const a1End = css.indexOf('--- Responsive ---', a1Start)
  const a1Css = a1Start >= 0 && a1End > a1Start ? css.slice(a1Start, a1End) : ''
  const a1Sizes = [...a1Css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  const a1TooSmall = a1Sizes.filter((s) => s < 10.5)
  check(a1Css.length > 0 && a1TooSmall.length === 0,
    '45c - all type added in Phase A1 sits at 10.5px or above',
    a1TooSmall.join(', ') || `${a1Sizes.length} declarations checked`)
}

// 46 - the forbidden ways of "fixing" density.
{
  const bad = []
  if (/transform:\s*scale/.test(css)) bad.push('transform: scale')
  if (/[^-\w]zoom\s*:/.test(css)) bad.push('zoom')
  if (/font-size:\s*(inherit|0|unset|initial)\s*;/.test(css)) bad.push('font-size reset')
  check(bad.length === 0, '46 - no scale, zoom or font-size reset', bad.join(', '))
}

// 39 - the shared tables were never touched, so their default output cannot move.
{
  const targets = await read('src/concepts/domain/TargetsTable.jsx')
  const tracks = await read('src/concepts/domain/TracksTable.jsx')
  const untouched =
    !/\bcolumns\b/.test(targets) && !/\bcolumns\b/.test(tracks) &&
    /closingHeader = null/.test(targets) && /scrollProps = null/.test(targets) &&
    /uncalibratedRefNote = null/.test(tracks)
  check(untouched, '39 - shared TargetsTable/TracksTable carry no A1 changes at all')

  // A1 asserted that OPS renders its own reduced tables rather than the shared
  // ones. Phase A3.1 removed both tables from OPS entirely — the data still
  // drives the engine, the plot and the evidence, it simply is not a table on
  // this screen any more. So the assertion becomes: OPS renders NEITHER, and the
  // reduced components are still intact for the screens that do use them.
  // Comments are stripped first: the file explains in prose why the tables left,
  // and naming them there is documentation, not a render.
  const dashboardCode = dashboard.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  check(!/OpsTargetsTable|OpsTracksTable|domain\/TargetsTable|domain\/TracksTable/.test(dashboardCode),
    '39b - the OPS screen renders no contact table at all (Phase A3.1)')
  check(/export function OpsTargetsTable/.test(await read('src/concepts/industrial-ops/components/OpsTargetsTable.jsx')) &&
    /export function OpsTracksTable/.test(await read('src/concepts/industrial-ops/components/OpsTracksTable.jsx')),
    '39c - and the reduced table components still exist, unchanged and available')
}

// 37/38 - reduced OPS columns. Asserted against the rendered <thead>: the
// modules explain in prose WHY angle, confidence, px/s and zone were left out,
// and a full-text match would trip over their own documentation.
{
  const headOf = (src) => (src.match(/<thead>([\s\S]*?)<\/thead>/) || ['', ''])[1]
  const t = await read('src/concepts/industrial-ops/components/OpsTargetsTable.jsx')
  const k = await read('src/concepts/industrial-ops/components/OpsTracksTable.jsx')
  const tHead = headOf(t)
  const kHead = headOf(k)

  const tCols = (tHead.match(/<th/g) || []).length
  check(tCols === 5 && /--dm-cols': 5/.test(t) && !/Angle/i.test(tHead) && !/Conf/i.test(tHead),
    '37 - radar targets table is ID / Distance / Radial dir / Closing / Risk only',
    `${tCols} columns`)

  const kCols = (kHead.match(/<th/g) || []).length
  check(kCols === 4 && /--dm-cols': 4/.test(k) && !/px\/s/.test(kHead) && !/Zone/i.test(kHead),
    '38 - camera tracks table is Track / Behaviour / Weapon / Risk only',
    `${kCols} columns`)
}

// 1 - A0 really is wired to the screen, and only through the orchestrator.
{
  const wired = /useIndustrialOpsCommandCenter/.test(dashboard)
  const hook = await read('src/concepts/industrial-ops/useIndustrialOpsCommandCenter.js')
  const usesEngine = /useIndustrialAlerts/.test(hook) && /useAlertSelection/.test(hook)
  check(wired && usesEngine, '01 - A0 engine is connected to the dashboard through the orchestration hook')
  check(!/reduceAlerts|buildFingerprint|deriveCandidates/.test(dashboard),
    '01b - the view composes panels and never derives alert state itself')
}

// 50 - isolation.
{
  const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true })
    const out = []
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) out.push(...(await walk(full)))
      else if (/\.(js|jsx)$/.test(e.name)) out.push(full)
    }
    return out
  }
  const files = await walk(path.join(root, 'src'))

  // The registry legitimately imports the Shell and views - that is how the
  // concept mounts. What must not leak is the command-centre logic.
  const PRIVATE = [
    'useIndustrialOpsCommandCenter', 'alertSelectors', 'alertStorage', 'demoAlerts',
    'useAlertSelection', 'useDocumentVisible',
    'components/AreaList', 'components/AlertList', 'components/AlertFilters',
    'components/VisualFeedPanel', 'components/AllCamerasPanel', 'components/NewDangerNotice',
    'components/OpsTargetsTable', 'components/OpsTracksTable',
  ]
  const foreign = []
  for (const file of files) {
    if (file.startsWith(IO)) continue
    const text = await readFile(file, 'utf-8')
    for (const mod of PRIVATE) {
      if (new RegExp(`industrial-ops/${mod}`).test(text)) {
        foreign.push(`${path.relative(root, file)} -> ${mod}`)
      }
    }
  }
  check(foreign.length === 0, '50 - no file outside industrial-ops imports the command-centre modules',
    foreign.join(', '))

  const otherConcepts = files.filter((f) =>
    /concepts[\\/](minimal-command|sentinel-3d|neural-fusion|fusion-prime)[\\/]/.test(f))
  const contaminated = []
  for (const file of otherConcepts) {
    const text = await readFile(file, 'utf-8')
    if (/industrial-ops/.test(text)) contaminated.push(path.relative(root, file))
  }
  check(contaminated.length === 0, '50b - no other concept references industrial-ops',
    contaminated.join(', '))
}

// ============================================================================
section('B - logic checks')

const T0 = 1_700_000_000_000
const camera = (connected) => ({ connected, status: connected ? 'active' : 'disconnected', lastError: null })
const snap = (over = {}) => ({
  mode: 'SAFE', hasPerson: false, personCount: 0, hasWeapon: false, weaponType: null,
  risks: { camera: 0, radar: 0, fused: 0, max: 0 }, tracks: [],
  radar: { enabled: true, connected: true, status: 'OK', lastUpdateMs: 100, targets: [], lastError: null },
  cameras: { webcam: camera(false), dahua: camera(false) },
  ...over,
})

// 2 - a steady condition across many polls stays one alert.
{
  let state = createInitialAlertState()
  const s = snap({ radar: { enabled: true, connected: false, status: 'DISCONNECTED', targets: [], lastError: 'x' } })
  for (let i = 0; i < 20; i += 1) {
    state = reduceAlerts(state, s, { now: T0 + i * 1000, areas: LIVE_AREAS, isDemo: false, isFirstSnapshot: i === 0 })
  }
  check(state.alerts.length === 1, '02 - the same condition over 20 polls stays one alert',
    `got ${state.alerts.length}`)
}

// 4/6 - deployments.
{
  check(LIVE_AREAS.length === 1 && LIVE_AREAS[0].id === 'AREA-01', '04 - live declares exactly AREA-01')
  check(DEMO_AREAS.length > 1 && DEMO_AREAS.every((a) => a.isDemo),
    '06 - demo declares several areas, all marked isDemo', `${DEMO_AREAS.length} areas`)
}

// 21/22 - counts.
{
  const alerts = demoAlerts(T0)
  const counts = lifecycleCounts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL_ACTIVE }, { areas: DEMO_AREAS })
  const manual = { NEW: 0, ACKNOWLEDGED: 0, IN_REVIEW: 0, RESOLVED: 0 }
  for (const a of alerts) manual[a.lifecycle] += 1
  check(counts.NEW === manual.NEW && counts.RESOLVED === manual.RESOLVED,
    '21 - lifecycle counts match the data')
  const narrowed = lifecycleCounts(alerts, { lifecycle: LIFECYCLE.NEW }, { areas: DEMO_AREAS })
  check(narrowed.RESOLVED === manual.RESOLVED,
    '21b - choosing a lifecycle tab does not zero the other counts')
  const active = visibleAlerts(alerts, { lifecycle: LIFECYCLE_FILTERS.ALL_ACTIVE }, { areas: DEMO_AREAS })
  check(active.every((a) => a.lifecycle !== LIFECYCLE.RESOLVED),
    '22 - RESOLVED never appears inside ALL ACTIVE')
}

// 23 - area severity comes from conditions that still HOLD.
//
// Corrected in Phase A2: severity follows the condition axis alone. A cleared
// condition stops counting; a condition an operator has closed in their own
// workflow does NOT, because resolving an alert is a statement about the
// operator's handling and not about the world.
{
  const rows = sortAreasOperational(DEMO_AREAS, demoAlerts(T0))
  const area3 = rows.find((r) => r.areaId === 'DEMO-AREA-03')
  check(area3.severity === 'ALERT', '23 - cleared alerts do not drive area severity',
    `got ${area3.severity}`)

  const infoOnly = [{
    id: 'x', fingerprint: 'x', areaId: 'DEMO-AREA-01', severity: 'info',
    active: true, lifecycle: LIFECYCLE.NEW, lastSeenAt: T0,
  }]
  const infoRow = sortAreasOperational(DEMO_AREAS, infoOnly).find((r) => r.areaId === 'DEMO-AREA-01')
  check(infoRow.severity === 'SAFE', '23b - an INFO alert never promotes an area to ALERT',
    `got ${infoRow.severity}`)
  check(rows[0].severity === 'DANGER', '23c - DANGER areas sort to the top', `top=${rows[0].areaId}`)

  // 23d - the case the A1 rule got wrong: a weapon that is still on the camera,
  // which the operator has closed out. The area stays DANGER.
  const stillArmed = [{
    id: 'w', fingerprint: 'w', areaId: 'DEMO-AREA-01', severity: 'danger',
    active: true, lifecycle: LIFECYCLE.RESOLVED, resolveReason: 'false_alarm', lastSeenAt: T0,
  }]
  const armedRow = sortAreasOperational(DEMO_AREAS, stillArmed).find((r) => r.areaId === 'DEMO-AREA-01')
  check(armedRow.severity === 'DANGER',
    '23d - an ACTIVE danger stays the area severity after the operator resolves it',
    `got ${armedRow.severity}`)
  check(armedRow.activeCount === 0,
    '23e - and it is off the operator work count, which is the separate question',
    `activeCount=${armedRow.activeCount}`)
}

// 35/36 - controller messages.
{
  const session = [
    { id: '1', source: 'controller', message: 'Arduino: ALERT', severity: 'alert' },
    { id: '2', source: 'radar', message: 'Radar link lost', severity: 'alert' },
  ]
  const split = splitSessionLog(session, LIVE_AREAS, 'AREA-01')
  check(split.unassigned.length === 1 && split.unassigned[0].source === 'controller',
    '36 - a controller message gets no invented areaId and stays unassigned')
  check(split.inArea.length === 1 && split.inArea[0].source === 'radar',
    '36b - declared sources still resolve to the declared area')

  const engineAlerts = reduceAlerts(createInitialAlertState(), snap(), {
    now: T0, areas: LIVE_AREAS, isDemo: false,
  })
  check(engineAlerts.alerts.every((a) => a.sourceType !== 'controller'),
    '35 - controller messages never become Operational Alerts')
}

// 47 - demo fixtures never present themselves as live.
{
  check(demoAlerts(T0).every((a) => a.isDemo === true && a.demoScenarioId),
    '47 - every demo alert is marked isDemo with a scenario id')
}

// 11/12/13 - vocabulary, in live-engine output and demo fixtures alike.
{
  const live = reduceAlerts(createInitialAlertState(), snap({
    radar: { enabled: true, connected: false, status: 'DISCONNECTED', targets: [], lastError: null },
  }), { now: T0, areas: LIVE_AREAS, isDemo: false })
  const payloads = JSON.stringify(live.alerts) + JSON.stringify(demoAlerts(T0))
  const hits = []
  if (/matched/i.test(payloads)) hits.push('Matched')
  if (/associat/i.test(payloads)) hits.push('Associated')
  if (/confirmed/i.test(payloads)) hits.push('Confirmed')
  if (/pair[_ -]?risk/i.test(payloads)) hits.push('Pair Risk')
  if (/combined[_ -]?risk/i.test(payloads)) hits.push('Combined Risk')
  if (/\d+\s?%/.test(payloads)) hits.push('percentage')
  check(hits.length === 0, '11/12/13 - no pair risk, no Matched/Associated/Confirmed, no percentages',
    hits.join(', '))
}

// ============================================================================
section('C - browser checks')

async function loadCredentials() {
  const parsed = JSON.parse(await read('python/data/users.json'))
  const users = Array.isArray(parsed) ? parsed : parsed.users || []
  return users.find((u) => u.role === 'admin')
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`))
const noise = (t) => /video_feed|ERR_ABORTED|favicon|Failed to fetch|NetworkError/.test(t)

const creds = await loadCredentials()
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', creds.username)
await page.fill('#password', creds.password)
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
  page.click('button[type="submit"]'),
])

const OPS = `${BASE}/concepts/industrial/dashboard`
const goto = async (qs = '') => {
  await page.goto(`${OPS}${qs}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
}

// --- LIVE ---------------------------------------------------------------------
await goto('')

{
  const rows = await page.$$eval('.io2-area-row', (n) => n.map((e) => e.textContent))
  check(rows.length === 1 && /AREA-01/.test(rows[0]),
    '04b - live renders exactly one area row', `${rows.length} rows`)
  const deploy = await page.$eval('.io2-area-deploy', (e) => e.textContent.trim()).catch(() => null)
  check(Boolean(deploy), '05 - SINGLE-AREA DEPLOYMENT is stated in live', deploy || 'missing')
}

{
  const srcs = await page.$$eval('.io2-alert-src', (n) => n.map((e) => e.textContent.trim()))
  check(srcs.some((s) => /RDR-01/.test(s)), '08 - radar alerts show RDR-01', srcs.join(' | '))
}

// 34/27 - radar tab.
{
  await page.click('[data-io2-vf-tab="radar"]')
  await page.waitForTimeout(600)
  const txt = await page.$eval('[data-io2-radar-tab]', (e) => e.textContent)
  check(/DISCONNECTED|STALE|DISABLED/.test(txt), '34 - the radar tab states the link is down')
  check(/empty|not new data/i.test(txt) || txt.includes('ריק'),
    '34b - and says the empty plot is not new data')
  check((await page.$$('.dl-feed-img')).length === 0,
    '27 - the radar tab mounts zero camera feeds')
}

// 30/31 - camera unavailable never jumps to radar.
{
  await page.click(`${CAM_TAB} >> nth=0`)
  await page.waitForTimeout(700)
  const title = await page.$eval('.io2-vf-state-title', (e) => e.textContent.trim()).catch(() => '')
  check(title.length > 0, '30 - camera down renders an explicit unavailable state', title)
  const radarActive = await page.$eval('[data-io2-vf-tab="radar"]', (e) => e.classList.contains('is-active'))
  check(!radarActive, '30b - it did NOT switch to radar by itself')
  const openRadar = await page.$('.io2-vf-action >> nth=-1')
  const actions = await page.$$eval('.io2-vf-action', (n) => n.map((e) => e.textContent.trim()))
  check(actions.some((a) => /OPEN RADAR/.test(a)), '31 - OPEN RADAR is offered as an explicit action',
    actions.join(' | '))
  await page.click('.io2-vf-action:has-text("OPEN RADAR")')
  await page.waitForTimeout(500)
  check(await page.$eval('[data-io2-vf-tab="radar"]', (e) => e.classList.contains('is-active')),
    '31b - and only that click moves to radar')
  void openRadar
}

// 26 - ALL CAMERAS is a status board.
{
  await page.click('[data-io2-vf-tab="all"]')
  await page.waitForTimeout(600)
  check((await page.$$('.dl-feed-img')).length === 0, '26 - ALL CAMERAS loads zero streams')
  const rows = await page.$$('.io2-allcams-table tbody tr')
  check(rows.length >= 2, '26b - ALL CAMERAS lists the declared cameras', `${rows.length} rows`)
}

// 3 - sessionStorage keeps filters across a reload.
{
  await page.fill('.io2-filter-search input', 'RDR')
  await page.waitForTimeout(800)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const q = await page.$eval('.io2-filter-search input', (e) => e.value)
  check(q === 'RDR', '03 - the search filter survives a reload in the same tab', `got "${q}"`)
  const stored = await page.evaluate(() => sessionStorage.getItem('industrial-ops-alert-state-v1'))
  check(Boolean(stored) && JSON.parse(stored).v === 1, '03b - state is stored under the versioned key')
  await page.fill('.io2-filter-search input', '')
  await page.waitForTimeout(500)
}

// 33/32b - the visible camera never becomes the alert's source.
//
// Rebased in Phase A3.2, and made stronger rather than looser. The rule was
// never "the string CAM-0n must not appear" — it was "an alert must not claim a
// camera the model does not give it". Live still cannot name one at all
// (alerts.js sets cameraSourceKnown false in every branch, asserted below). A
// DEMO alert may, but only a camera its own area DECLARES in areas.js, which is
// authored fixture data and is what makes the OPTICAL action's enabled path
// reachable (A3.2 §35). A camera the area does not declare is still a leak, and
// that is now what is checked.
{
  const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1') || '{}'))
  const alerts = state.alerts || []
  const declared = new Map(DEMO_AREAS.concat(LIVE_AREAS).map((a) => [a.id, a.cameras.map((c) => c.id)]))
  const leaked = alerts.filter((a) => {
    if (!a.sourceId || !/CAM-/.test(String(a.sourceId))) return false
    return !(declared.get(a.areaId) || []).includes(a.sourceId)
  })
  check(leaked.length === 0, '33 - no alert names a camera its own area does not declare',
    leaked.map((a) => `${a.areaId}:${a.sourceId}`).join(', ') || 'none')
  check(alerts.filter((a) => a.sourceType === 'camera' && a.cameraSourceKnown).every((a) => a.isDemo),
    '32b - only demo alerts may know their camera; live camera alerts never do')
  check(alerts.filter((a) => a.sourceType === 'camera' && !a.cameraSourceKnown).every((a) => !a.sourceId),
    '32c - and an alert that does not know its camera carries no camera id at all')
}

// 48 - never claims freshness it does not have.
{
  const text = await page.$eval('.io2-strip', (e) => e.textContent)
  check(!/updated now/i.test(text), '48 - the status strip never says "updated now"')
}

// 20 - existing shortcuts survive, and stay guarded while typing.
{
  // Guarded: with focus in the search field, Alt+n must do nothing at all.
  await page.focus('.io2-filter-search input')
  await page.keyboard.press('Alt+2')
  await page.waitForTimeout(700)
  check(page.url().includes('/dashboard'),
    '20 - Alt+n is suppressed while the operator is typing', page.url())

  // Outside a field it navigates exactly as before.
  await page.click('.io2-panel-title >> nth=0')
  await page.keyboard.press('Alt+2')
  await page.waitForTimeout(1000)
  check(page.url().includes('/camera/'), '20b - Alt+2 still navigates (Alt+1..9 preserved)', page.url())
  await page.keyboard.press('Alt+1')
  await page.waitForTimeout(1000)
  check(page.url().includes('/dashboard'), '20c - Alt+1 returns to OPS')
}

// --- DEMO ---------------------------------------------------------------------
await goto('?demo=1&phase=approach')

{
  const rows = await page.$$('.io2-area-row')
  check(rows.length >= 3, '06b - demo renders several areas', `${rows.length} rows`)
  check(!(await page.$('.io2-area-deploy')),
    '06c - SINGLE-AREA DEPLOYMENT is not claimed in a multi-area demo')
}

// 7/32 - camera alerts never name a camera.
{
  const srcs = await page.$$eval('.io2-alert-src', (n) => n.map((e) => e.textContent.trim()))
  // A3.2: a LIVE camera id (CAM-01 / CAM-02) may never appear as an alert source.
  // A demo alert may show a DEMO- camera its own area declares — see test 33.
  check(!srcs.some((s) => /(^|[^-])\bCAM-0\d/.test(s)), '07 - no camera alert shows CAM-01/CAM-02 as its source',
    srcs.join(' | '))
  check(srcs.some((s) => /NOT IDENTIFIED/i.test(s) || s.includes('אינו מזוהה')),
    '32 - unknown camera source is stated explicitly', srcs.join(' | '))
}

// 9 - sources stay separate.
{
  const rows = await page.$$eval('[data-io2-alert-row]', (n) => n.map((e) => e.textContent))
  const cam = rows.filter((r) => /CAMERA|מצלמ/i.test(r)).length
  const rdr = rows.filter((r) => /RDR-|RADAR|רדאר/i.test(r)).length
  check(cam > 0 && rdr > 0, '09 - camera and radar alerts are separate rows', `${cam} camera / ${rdr} radar`)
  check(rows.filter((r) => /CAM-0\d/.test(r) && /RDR-0\d/.test(r) && !/DEMO-CAM/.test(r)).length === 0,
    '09b - no row mixes a camera source id with a radar source id')
}

// 49 - every lifecycle shown carries SESSION-LOCAL.
{
  const rows = await page.$$eval('[data-io2-alert-row]', (n) => n.map((e) => ({
    life: Boolean(e.querySelector('.io2-alert-life')),
    local: Boolean(e.querySelector('.io2-alert-local')),
  })))
  check(rows.length > 0 && rows.every((r) => !r.life || r.local),
    '49 - every row that shows a lifecycle also shows SESSION-LOCAL', `${rows.length} rows`)
}

// 10/11b - same-area evidence is context, never association.
//
// Rebased in Phase A3.1.1, in two ways that both make it stricter.
//
// First, it used to search page.content(), which under a Vite dev server also
// contains the injected stylesheet — a class name or a CSS comment could
// satisfy it. It now reads RENDERED TEXT out of the live DOM.
//
// Second, the decision band that carried the label is gone, so the surviving
// home is the risk factors panel: whenever the factors it lists belong to the
// AREA rather than to the selected contact, it must say so. That is checked for
// EVERY selectable alert, and at least one of them has to actually produce the
// label — otherwise the check would pass by never being exercised.
{
  const ids = await page.$$eval('[data-io2-alert-row]', (n) => n.map((e) => e.getAttribute('data-io2-alert-row')))
  let labelled = 0
  let unlabelledAreaContext = 0
  for (const id of ids) {
    await page.click(`[data-io2-alert-row="${id}"]`)
    await page.waitForTimeout(220)
    const state = await page.evaluate(() => {
      const panel = document.querySelector('.io2-a-factors')
      if (!panel) return null
      const text = panel.innerText
      return {
        labelled: /NOT ASSOCIATED|ללא שיוך/i.test(text),
        // The panel marks area-scope factors with this class; contact-scoped
        // factors do not carry it.
        areaContext: Boolean(panel.querySelector('.io2-rf-context')),
      }
    })
    if (state?.labelled) labelled += 1
    else if (state?.areaContext) unlabelledAreaContext += 1
  }
  check(labelled > 0, '10 - area-scope evidence is labelled NOT ASSOCIATED',
    `${labelled} of ${ids.length} selections showed the label`)
  check(unlabelledAreaContext === 0,
    '10b - and no selection shows area-scope factors without the label',
    `${unlabelledAreaContext} unlabelled`)

  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(400)
  const text = await page.evaluate(() => document.body.innerText)
  check(!/Pair Risk|Combined Risk|Matched|Confirmed/i.test(text),
    '11b - the rendered page shows no pair/combined risk vocabulary')
}

// 14 - Fused Risk keeps its backend attribution.
//
// Rebased in Phase A3.1.1 to the status strip cell, which is where the figure
// lives now that the decision band is gone. Read out of the cell's own markup
// rather than out of the whole document, so the stylesheet cannot satisfy it.
{
  const fused = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.io2-strip-cell')]
    const cell = cells.find((c) => /Fused risk/i.test(c.getAttribute('title') || ''))
    return cell ? { title: cell.getAttribute('title'), text: cell.innerText.trim() } : null
  })
  check(Boolean(fused) && /backend/i.test(fused.title),
    '14 - Fused Risk is shown with its backend attribution', fused ? fused.title : 'cell absent')
  check(Boolean(fused) && /\d/.test(fused.text),
    '14b - and it carries the backend figure itself', fused ? fused.text.replace(/\s+/g, ' ') : '—')
}

// 15/16/17 - a new DANGER announces itself and waits.
{
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('industrial-ops-alert-state-v1')
    const state = raw ? JSON.parse(raw) : { v: 1, isDemo: true, alerts: [], selection: {}, filters: {} }
    state.v = 1
    state.isDemo = true
    state.selection = {
      selectedAlertId: 'DEMO-AREA-01|radar|target|DEMO-RDR-01:target:1#1',
      selectedAreaId: 'DEMO-AREA-01',
      lastSelectedCameraId: null,
    }
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(state))
  })
  await goto('?demo=1&phase=approach')

  // Phase A3.1.1: the full-width notice became a compact chip in the alerts
  // panel header, and the selection is read from the selected-alert region
  // inside the same panel. The behaviour under test is unchanged, and the three
  // original assertions are unchanged with it — announced, does not move the
  // selection, only the explicit click moves it. Two are added, because the new
  // placement makes two more things checkable than the band ever allowed.
  const selectedBefore = await page.$eval('.io2-sel-actions .io2-ab-id', (e) => e.textContent).catch(() => '')
  const notice = await page.$('.io2-new-danger')
  check(Boolean(notice), '16 - a new DANGER raises a visible indicator')
  check(await page.evaluate(() => Boolean(document.querySelector('.io2-a-alerts .io2-new-danger'))),
    '16b - and it is inside the operational alerts panel, not a band of its own')
  check(!(await page.$('.io2-danger-notice')),
    '16c - the full-width danger notice is gone from the screen')
  check(/DEMO-AREA-01/.test(selectedBefore), '15 - and does NOT move the selection', selectedBefore.trim())

  if (notice) {
    await notice.click()
    await page.waitForTimeout(600)
    const after = await page.$eval('.io2-sel-actions .io2-ab-id', (e) => e.textContent)
    check(!/DEMO-AREA-01/.test(after), '17 - only the explicit action changes the selection', after.trim())
  } else {
    check(false, '17 - only the explicit action changes the selection', 'indicator absent')
  }
}

// 18/19 - focus is not selection; "/" is guarded.
{
  await goto('?demo=1&phase=approach')
  const firstId = await page.$eval('[data-io2-alert-row]', (e) => e.getAttribute('data-io2-alert-row'))
  await page.focus('[data-io2-alert-row]')
  const selBefore = await page.$eval('.io2-sel-actions .io2-ab-id', (e) => e.textContent)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(400)
  const focusedId = await page.evaluate(() => document.activeElement?.getAttribute('data-io2-alert-row'))
  const selAfter = await page.$eval('.io2-sel-actions .io2-ab-id', (e) => e.textContent)
  check(Boolean(focusedId) && focusedId !== firstId, '18 - ArrowDown moves focus')
  check(selBefore === selAfter, '18b - moving focus does not change the selection')

  await page.keyboard.press('Space')
  await page.waitForTimeout(500)
  check((await page.$eval('.io2-sel-actions .io2-ab-id', (e) => e.textContent)) !== selBefore,
    '18c - Space selects the focused row')

  await page.keyboard.press('/')
  await page.waitForTimeout(300)
  check(await page.evaluate(() => document.activeElement?.type === 'search'),
    '19 - "/" focuses the search field')
  await page.fill('.io2-filter-search input', 'a/b')
  const value = await page.$eval('.io2-filter-search input', (e) => e.value)
  check(value.includes('/'), '19b - "/" typed inside the field is text, not a shortcut', value)
  await page.fill('.io2-filter-search input', '')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// 40 - session log scope.
{
  await page.click('.io2-log-modes button:nth-child(2)')
  await page.waitForTimeout(500)
  check(await page.$eval('.io2-log-modes button:nth-child(2)', (e) => e.classList.contains('is-active')),
    '40 - the session log switches to SELECTED AREA')
  await page.click('.io2-log-modes button:nth-child(1)')
  await page.waitForTimeout(400)
  check(await page.$eval('.io2-log-modes button:nth-child(1)', (e) => e.classList.contains('is-active')),
    '40b - and back to ALL AREAS')
}

// 24 - an empty result keeps every area on screen.
{
  await page.fill('.io2-filter-search input', 'zzzz-no-match')
  await page.waitForTimeout(700)
  check(Boolean(await page.$('.io2-alerts-empty')), '24 - an empty result renders NO ACTIVE ALERTS')
  check((await page.$$('.io2-area-row')).length >= 3, '24b - and every configured area stays visible')
  await page.click('.io2-filter-reset')
  await page.waitForTimeout(600)
}

// 25/28/27b - feed accounting.
//
// Two different things are counted. `.dl-feed` is the mounted feed COMPONENT,
// which exists in demo as well, so the "exactly one" rule is genuinely
// exercised here. `.dl-feed-img` is the live MJPEG element, which only appears
// with a real camera attached — on this machine there is none, so a zero there
// is honest but not by itself proof of anything.
{
  await goto('?demo=1&phase=approach')
  const mounted = (await page.$$('.dl-feed')).length
  check(mounted === 1, '25 - exactly one feed component is mounted on the camera tab',
    `${mounted} mounted`)
  check((await page.$$('.dl-feed-img')).length <= 1, '25b - and never more than one live stream element')

  const camTabs = await page.$$(CAM_TAB)
  if (camTabs.length > 1) {
    await camTabs[1].click()
    await page.waitForTimeout(700)
  }
  const afterSwitch = (await page.$$('.dl-feed')).length
  check(afterSwitch === 1, '28 - switching cameras replaces the feed rather than adding one',
    `${afterSwitch} mounted`)

  await page.click('[data-io2-vf-tab="all"]')
  await page.waitForTimeout(600)
  check((await page.$$('.dl-feed')).length === 0, '26c - ALL CAMERAS mounts no feed component at all')

  await page.click('[data-io2-vf-tab="radar"]')
  await page.waitForTimeout(600)
  check((await page.$$('.dl-feed')).length === 0, '27b - moving to radar unmounts the feed component')
}

// 29 - a hidden tab drops the stream.
{
  await page.click(`${CAM_TAB} >> nth=0`)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(700)
  check((await page.$$('.dl-feed')).length === 0 && Boolean(await page.$('.io2-vf-state-title')),
    '29 - a hidden tab unmounts the feed component instead of hiding it')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(600)
}

// 44 - identifiers stay LTR inside Hebrew text.
{
  await goto('?demo=1&phase=approach')
  const bad = await page.$$eval('.io2-val', (nodes) =>
    nodes.filter((n) => n.getAttribute('dir') !== 'ltr').length)
  check(bad === 0, '44 - every identifier is isolated with dir="ltr"', `${bad} unisolated`)
}

// 41 - no horizontal overflow anywhere.
{
  const viewports = [[1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]
  let worst = 0
  for (const [w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h })
    await goto('?demo=1&phase=approach')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > worst) worst = overflow
    check(overflow <= 1, `41 - no horizontal overflow @${w}x${h}`, `${overflow}px`)
  }
  check(worst <= 1, '41b - worst-case horizontal overflow across all viewports', `${worst}px`)
  await page.setViewportSize({ width: 1920, height: 1080 })
}

{
  const real = consoleErrors.filter((t) => !noise(t))
  check(real.length === 0, 'OPS console is clean (hardware-absent noise excluded)',
    real.slice(0, 2).join(' | '))
}

await browser.close()

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}  --  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
