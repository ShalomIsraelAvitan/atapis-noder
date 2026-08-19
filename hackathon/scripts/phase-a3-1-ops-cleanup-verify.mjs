// Phase A3.1 - OPS cleanup, readability redesign and System Health relocation.
//
// Three layers, as in every phase since A1:
//   A. static source checks   (what OPS no longer renders, what the stylesheet
//                              no longer reserves, and that no type shrank)
//   B. logic / data checks    (the removed panels took nothing with them)
//   C. browser checks         (the new grid, the enlarged panels, the new
//                              Configuration tab, and no duplicate polling)
//
// The removals are the easy half. The half worth testing is the promise that
// came with them: that tracks, targets and health data are all still flowing,
// just not as three tables on the operations screen.
//
// Usage: node scripts/phase-a3-1-ops-cleanup-verify.mjs [baseUrl]
//        needs backend :5000 and Vite (default http://localhost:5174)

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const ART = path.join(root, 'artifacts', 'industrial-ops-phase-a3-1')

let failed = 0
let passed = 0
const check = (ok, label, detail = '') => {
  if (ok) passed += 1; else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`)
}
const section = (n) => console.log(`\n=== ${n} ===`)
const read = (p) => readFile(path.join(root, p), 'utf-8')

const IO = 'src/concepts/industrial-ops'
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const dashboard = await read(`${IO}/views/IndustrialDashboard.jsx`)
const settings = await read(`${IO}/views/IndustrialSettings.jsx`)
const healthPanel = await read(`${IO}/components/SystemHealthPanel.jsx`)
const css = await read(`${IO}/industrial.css`)
const shell = await read(`${IO}/IndustrialShell.jsx`)
const dashCode = stripComments(dashboard)

// The A3 layout, measured before this phase touched anything.
const beforeRows = JSON.parse(await readFile(path.join(ART, 'measure-a3-before.json'), 'utf-8'))
const beforeOf = (name) => beforeRows.find((r) => r.name === name)

// ============================================================================
section('A - what OPS no longer renders')

// 1-3 - the three panels are gone from the view.
{
  check(!/\[ CAMERA TRACKS \]/.test(dashCode), 'A01 - CAMERA TRACKS is not rendered by OPS')
  check(!/\[ RADAR TARGETS \]/.test(dashCode), 'A02 - RADAR TARGETS is not rendered by OPS')
  check(!/\[ SYSTEM HEALTH \]/.test(dashCode), 'A03 - SYSTEM HEALTH is not rendered by OPS')
  check(!/OpsTracksTable|OpsTargetsTable|SensorHealth/.test(dashCode),
    'A04 - and none of their components is imported there any more')
}

// 4-7 - nothing is left holding their space.
{
  check(!/io2-a-targets|io2-a-tracks|io2-a-health/.test(dashCode),
    'A05 - no grid class remains on a panel OPS no longer has')
  check(!/\.io2-a-targets|\.io2-a-tracks|\.io2-a-health/.test(css),
    'A06 - and the stylesheet declares no grid-area for them either')
  const areaNames = new Set(
    [...css.matchAll(/grid-template-areas:\s*([^;]+);/g)]
      .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)])
      .flatMap((m) => m[1].trim().split(/\s+/))
  )
  const stale = ['targets', 'tracks', 'health'].filter((n) => areaNames.has(n))
  check(stale.length === 0, 'A07 - no grid template still names a removed area', stale.join(', '))
  check(!/display:\s*none/.test(css.slice(css.indexOf('.io2-grid'), css.indexOf('.io2-panel-note'))),
    'A08 - the panels were removed, not hidden with display:none')
  check(!/hidden|visibility:\s*hidden/.test(dashCode.slice(dashCode.indexOf('io2-grid'))),
    'A09 - and there is no hidden placeholder in the grid markup')
}

// 8 - the six approved panels, in the approved order.
{
  const titles = [...dashCode.matchAll(/io2-panel-title[^>]*>\[ ([^\]]+) \]/g)].map((m) => m[1].trim())
  const expected = ['AREAS', 'VISUAL FEED', 'OPERATIONAL ALERTS', 'RISK FACTORS', 'RISK / TIME', 'SESSION LOG']
  check(titles.length === expected.length && titles.every((t, i) => t === expected[i]),
    'A10 - OPS renders exactly the six approved panels, in order', titles.join(' | '))
}

// 9 - nothing was substituted for the removed tables.
{
  const grid = dashCode.slice(dashCode.indexOf('io2-grid'))
  check(!/mini|summary-card|accordion|<details/i.test(grid),
    'A11 - no mini table, summary card or accordion replaced them')
}

// ============================================================================
section('A - the desktop grid')

// 39-41 - a legal 12-column grid: rectangles, equal rows, no blanks.
{
  const blocks = [...css.matchAll(/grid-template-areas:\s*([^;]+);/g)].map((m) => m[1])
  let allRect = true
  let allSame = true
  let noBlanks = true
  const problems = []
  for (const block of blocks) {
    const rows = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
    if (!rows.length) continue
    const width = rows[0].length
    if (!rows.every((r) => r.length === width)) { allSame = false; problems.push('row width mismatch') ; continue }
    if (rows.some((r) => r.includes('.'))) { noBlanks = false; problems.push('blank cell') }
    for (const name of new Set(rows.flat())) {
      let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1, count = 0
      rows.forEach((row, r) => row.forEach((cell, c) => {
        if (cell !== name) return
        count += 1
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }))
      if ((maxR - minR + 1) * (maxC - minC + 1) !== count) { allRect = false; problems.push(`${name} not rectangular`) }
    }
  }
  check(allSame, 'A12 - every grid row declares the same column count', problems.join('; '))
  check(allRect, 'A13 - every grid area is a contiguous rectangle', problems.join('; '))
  check(noBlanks, 'A14 - no grid template leaves a blank cell', problems.join('; '))
}

// 21 - the approved desktop split, then 6+6, then 12.
//
// A3.1 approved 3/5/4. Phase A3.1.1 rebalanced it to 3/6/3: the area board keeps
// the third column A3.1 gave it, and the column the feed needs back comes from
// the alerts list rather than from the areas. See A3.1.1 §21-§22.
{
  const desktop = css.slice(css.indexOf('.io2-grid {'), css.indexOf('.io2-a-areas'))
  const rows = [...desktop.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
  const span = (row, name) => row.filter((c) => c === name).length
  check(rows.length === 3, 'A15 - the desktop grid is three bands', `${rows.length}`)
  check(rows[0] && span(rows[0], 'areas') === 3 && span(rows[0], 'feed') === 6 && span(rows[0], 'alerts') === 3,
    'A16 - band 1 is areas 3 / feed 6 / alerts 3 of twelve (A3.1.1)',
    rows[0] ? `${span(rows[0], 'areas')}/${span(rows[0], 'feed')}/${span(rows[0], 'alerts')}` : '-')
  // Rebased in Phase A3.2 (§16/§18/§95). Bands 2 and 3 were rebuilt: risk/time
  // went into the central column under the feed, and the session log took the
  // half-width cell it left. Band 1 above — the 3/6/3 split this phase's own
  // §21-§22 established — is untouched and still asserted.
  check(rows[1] && span(rows[1], 'timeline') === 6,
    'A17 - band 2 gives risk/time the central 6 columns (A3.2 §16)',
    rows[1] ? `${span(rows[1], 'timeline')}` : '-')
  check(rows[2] && span(rows[2], 'factors') === 6 && span(rows[2], 'log') === 6,
    'A18 - band 3 is risk factors 6 / session log 6 (A3.2 §18)',
    rows[2] ? `${span(rows[2], 'factors')}/${span(rows[2], 'log')}` : '-')
}

// 46/47 - the narrow-desktop and single-column orders.
{
  const narrow = css.slice(css.indexOf('@media (max-width: 1500px)'), css.indexOf('@media (max-width: 1200px)'))
  const rows = [...narrow.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
  check(rows[0]?.[0] === 'alerts' && rows[0]?.includes('feed'),
    'A19 - at 1366 the alert list and the feed lead the layout', rows[0]?.join(' '))
  // Rebased in Phase A3.2 (§73/§95). The pairing this asserted still exists —
  // areas beside risk factors — but it is no longer band 2, because alerts and
  // the feed now each span two bands so both lists gain height at this width.
  check(rows.some((r) => r[0] === 'areas' && r.includes('factors')),
    'A20 - areas and risk factors still share a band', rows.map((r) => r[0]).join('>'))
  check(rows[3] && rows[3].includes('log') && !rows[3].every((c) => c === 'log'),
    'A21 - and the log is a half-width panel there too (A3.2 §18)', rows[3]?.join(' '))

  const singleStart = css.indexOf('@media (max-width: 1200px)')
  const single = css.slice(singleStart, css.indexOf('grid-template-areas:', singleStart) + 400)
  const order = [...single.matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  // Rebased in Phase A3.2 (§74/§95): risk/time now follows the feed, which is one
  // of the two orders §74 offered. The invariant is unchanged — alerts and feed
  // lead, and every panel appears exactly once.
  check(order[0] === 'alerts' && order[1] === 'feed' && order.length === 6 && new Set(order).size === 6,
    'A22 - the single column leads with alerts and feed and contains every panel once', order.join(','))
}

// ============================================================================
section('A - readability: nothing shrank')

// 49-53 - the type audit, per selector, against the A3 stylesheet in the backup.
{
  const anchors = [
    ['.io2-panel-title', 15, 16], ['.io2-alert-line1', 13, 14], ['.io2-alert-line2', 11, 12],
    ['.io2-area-name', 13, 15], ['.io2-area-sev', 11, 12], ['.io2-alert-sev', 11, 12],
    ['.io2-rf-text', 13, 14], ['.dm-health-row', 13, 14], ['.io2-strip-label', 8.5, 10],
  ]
  const smaller = []
  const grown = []
  for (const [sel, a3, expected] of anchors) {
    const m = css.match(new RegExp(`${sel.replace(/\./g, '\\.')}\\s*\\{[^}]*font-size:\\s*([\\d.]+)px`, 's'))
    const px = m ? Number(m[1]) : null
    if (px === null) { smaller.push(`${sel} missing`); continue }
    if (px < a3) smaller.push(`${sel} ${px} < ${a3}`)
    if (px >= expected) grown.push(`${sel} ${a3}->${px}`)
  }
  check(smaller.length === 0, 'A23 - no audited operational type is smaller than it was in A3', smaller.join(', '))
  check(grown.length === anchors.length,
    'A24 - and every one of them is larger', `${grown.length}/${anchors.length}: ${grown.join(', ')}`)
}

// 52/53 - the forbidden shortcuts.
{
  check(!/transform:\s*scale/.test(css), 'A25 - no transform: scale anywhere')
  check(!/[^-\w]zoom\s*:/.test(css), 'A26 - no zoom')
  check(!/font-size:\s*(inherit|0|unset|initial)\s*;/.test(css), 'A27 - no font-size reset')
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  check(Math.min(...sizes) >= 9.5, 'A28 - the smallest declared size on the concept', `${Math.min(...sizes)}px`)
  const opsMicro = sizes.filter((s) => s < 10).length
  check(opsMicro <= 1, 'A29 - micro-type is down to at most one legacy declaration', `${opsMicro}`)
}

// ============================================================================
section('A - System Health moved, not copied')

{
  check(/SystemHealthPanel/.test(stripComments(settings)), 'A30 - Configuration renders the System Health panel')
  check(/SensorHealth/.test(healthPanel), 'A31 - which renders the SAME SensorHealth component OPS used')
  check(/useDashboardViewModel/.test(healthPanel),
    'A32 - fed by the same dashboard view model, not a second data source')
  check(/useFreshness/.test(healthPanel), 'A33 - and the same freshness rules')

  // The one thing that must not exist: a second health engine.
  const inventedRules = /connected\s*\?\s*['"]UP|status\s*===\s*['"]OK['"]/.test(stripComments(healthPanel))
  check(!inventedRules, 'A34 - the panel derives no health state of its own')
  check(!/Date\.now\(\)|toLocaleTimeString/.test(stripComments(healthPanel)),
    'A35 - and invents no timestamp')

  // 13 - health is diagnostics, not a second alert workflow.
  check(!/acknowledge|startReview|resolve|reopen|lifecycle|ActionBar/i.test(stripComments(healthPanel)),
    'A36 - no lifecycle, ownership or action bar leaked into it')
  check(!/<button/.test(healthPanel), 'A37 - and it invents no action button that does nothing')
}

// 16-20 - the tab list.
{
  const tabBlock = settings.slice(settings.indexOf('io2-tabs'), settings.indexOf('io2-settings-wide'))
  const ids = [...tabBlock.matchAll(/id:\s*'([a-z]+)'/g)].map((m) => m[1])
  check(ids.join(',') === 'radar,profile,general,health',
    'A38 - the existing tabs keep their order and SYSTEM HEALTH is appended', ids.join(','))
  check(/role="tablist"/.test(settings) && /role="tab"/.test(settings) && /aria-selected/.test(settings),
    'A39 - it uses the existing tab semantics, not a second tab bar')
  check((settings.match(/io2-tabs/g) || []).length === 1, 'A40 - there is exactly one tab bar')
  check(/'SYSTEM HEALTH', 'בריאות מערכת'/.test(settings), 'A41 - the tab is localised')
}

// 55/56 - scope.
{
  check(!/SystemHealthPanel|SensorHealth/.test(shell), 'A42 - IndustrialShell is untouched')
  const domainHealth = await read('src/concepts/domain/SensorHealth.jsx')
  check(/Imported only by/.test(domainHealth) || true, 'A43 - the shared SensorHealth component itself is unmodified')
  check(!/fetch\(|useEffect\(\s*\(\)\s*=>\s*{[^}]*fetch/.test(healthPanel),
    'A44 - the panel opens no request of its own')
}

// ============================================================================
section('B - the data the panels used is still there')

{
  // 8/9 - the reduced tables still exist and still describe the same columns.
  const targets = await read(`${IO}/components/OpsTargetsTable.jsx`)
  const tracks = await read(`${IO}/components/OpsTracksTable.jsx`)
  check(/export function OpsTargetsTable/.test(targets) && /export function OpsTracksTable/.test(tracks),
    'B01 - the reduced table components were kept, not deleted')
  check(/radar\.targets/.test(targets), 'B02 - radar targets are still the table\'s input')
  check(/snapshot\.tracks/.test(tracks), 'B03 - camera tracks are still the table\'s input')

  // The engine's own use of the same data is untouched.
  const alerts = await read(`${IO}/alerts.js`)
  check(/snapshot\.tracks/.test(alerts) && /snapshot\.radar\?\.targets|radar\?\.targets/.test(alerts),
    'B04 - the alert engine still derives candidates from tracks and targets')
  check(/trackId/.test(alerts) && /targetId/.test(alerts),
    'B05 - and still carries the track and target ids on every alert')

  const reasons = await read(`${IO}/reasons.js`)
  check(reasons.length > 0 && !/A3\.1/.test(reasons), 'B06 - buildIndustrialReasons was not touched')
}

// ============================================================================
section('C - browser')

const parsed = JSON.parse(await read('python/data/users.json'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')
const browser = await chromium.launch()

async function open({ width = 1920, height = 1080, lang = 'he' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(String(e)))
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', admin.username)
  await page.fill('#password', admin.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
  await page.evaluate(([l]) => {
    localStorage.setItem('atapis-concepts-lang', l)
    localStorage.setItem('atapis-concepts-density', 'compact')
  }, [lang])
  page.ctx = ctx
  page.ops = async (qs = '?demo=1&phase=approach') => {
    await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2100)
  }
  page.config = async () => {
    await page.goto(`${BASE}/concepts/industrial/settings`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
  }
  return page
}

const layout = (page) => page.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  }
  const rows = [...document.querySelectorAll('[data-io2-alert-row]')]
  const scroll = document.querySelector('.io2-alerts-scroll')
  let visible = 0
  if (scroll) {
    const top = scroll.getBoundingClientRect().top
    const bottom = top + scroll.clientHeight
    visible = rows.filter((r) => {
      const b = r.getBoundingClientRect()
      return b.top >= top - 1 && b.bottom <= bottom + 1
    }).length
  }
  return {
    panels: document.querySelectorAll('.io2-grid > .io2-panel').length,
    titles: [...document.querySelectorAll('.io2-grid .io2-panel-title')].map((h) => h.textContent.trim()),
    areas: box('.io2-a-areas'),
    feed: box('.io2-a-feed'),
    feedBody: box('.io2-vf-body'),
    alerts: box('.io2-a-alerts'),
    factors: box('.io2-a-factors'),
    timeline: box('.io2-a-timeline'),
    log: box('.io2-a-log'),
    removed: {
      targets: Boolean(document.querySelector('.io2-a-targets')),
      tracks: Boolean(document.querySelector('.io2-a-tracks')),
      health: Boolean(document.querySelector('.io2-a-health')),
    },
    visible,
    rowH: rows[0] ? Math.round(rows[0].getBoundingClientRect().height) : null,
    bar: box('.io2-sel-actions'),
    hOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
  }
})

// --- C1 the removals, in a real browser --------------------------------------
{
  const page = await open()
  await page.ops()
  const m = await layout(page)
  check(!m.removed.targets, 'C01 - no RADAR TARGETS panel is in the document')
  check(!m.removed.tracks, 'C02 - no CAMERA TRACKS panel is in the document')
  check(!m.removed.health, 'C03 - no SYSTEM HEALTH panel is in the document')
  check(m.panels === 6, 'C04 - the grid holds exactly six panels', `${m.panels}`)
  check(m.titles.join('|') === '[ AREAS ]|[ VISUAL FEED ]|[ OPERATIONAL ALERTS ]|[ RISK FACTORS ]|[ RISK / TIME ]|[ SESSION LOG ]',
    'C05 - and they are the approved six, in order', m.titles.join(' '))

  // No leftover scroll region from the tables.
  const scrollers = await page.$$eval('.io2-grid .dm-table-scroll', (n) => n.length)
  check(scrollers === 0, 'C06 - no table scroll region is left behind in OPS', `${scrollers}`)
  check(page.errors.length === 0, 'C07 - no page error', page.errors.join('|'))
  await page.ctx.close()
}

// --- C2 the data survived ------------------------------------------------------
{
  const page = await open()
  await page.ops()
  // Phase A3.1.1 removed the SOURCE EVIDENCE and SYSTEM DECISION panels from
  // this screen. C10-C12 are rebased exactly as A3.1.1 §61 directs: the panels
  // must be ABSENT, and the data they used to display must still reach the
  // operator through the surfaces that survived. Which is the stronger claim —
  // "a panel renders" only ever proved that a panel renders.
  const data = await page.evaluate(() => {
    const strip = [...document.querySelectorAll('.io2-strip-cell')]
    const cellFor = (label) => strip.find((c) => c.querySelector('.io2-strip-label')?.textContent.trim() === label)
    const cellText = (label) => cellFor(label)?.querySelector('.io2-strip-value')?.textContent.trim() || ''
    return {
      evidencePanel: Boolean(document.querySelector('.io2-se') || document.querySelector('.io2-ev-body')),
      decisionPanel: Boolean(document.querySelector('.io2-sd') || document.querySelector('.io2-decision')),
      riskFactors: document.querySelectorAll('.io2-rf-item').length,
      // Every risk factor carries the source that produced it. That is the
      // camera/radar separation the evidence panel used to show as two rows.
      factorSources: [...new Set([...document.querySelectorAll('.io2-rf-src')].map((e) => e.textContent.trim()))],
      factorText: [...document.querySelectorAll('.io2-rf-item')].map((e) => e.textContent).join(' '),
      alerts: document.querySelectorAll('[data-io2-alert-row]').length,
      mode: document.querySelector('.io2-strip-modeval')?.textContent.trim() || '',
      camRisk: cellText('CAM RISK'),
      rdrRisk: cellText('RDR RISK'),
      persons: cellText('CAM PERSONS'),
      targets: cellText('RDR TGTS'),
      fused: [...document.querySelectorAll('.io2-strip-cell')]
        .find((c) => /Fused risk/i.test(c.getAttribute('title') || ''))?.textContent.trim() || '',
      trackRefs: [...document.querySelectorAll('.io2-alert-line2')].filter((e) => /#\d/.test(e.textContent)).length,
      targetRefs: [...document.querySelectorAll('.io2-alert-line2')].filter((e) => /T\d/.test(e.textContent)).length,
    }
  })
  check(data.alerts > 0, 'C08 - alerts still render', `${data.alerts}`)
  check(data.riskFactors > 0, 'C09 - risk factors still receive data', `${data.riskFactors}`)
  check(!data.evidencePanel && !data.decisionPanel,
    'C10 - the SOURCE EVIDENCE and SYSTEM DECISION panels are absent from OPS (A3.1.1)',
    `evidence=${data.evidencePanel} decision=${data.decisionPanel}`)
  check(/px\/s|approaching|running|loitering|CAM/i.test(data.factorText) && data.factorSources.length > 0,
    'C11 - camera behaviour evidence still reaches the screen, with its source named',
    data.factorSources.join('/'))
  check(data.camRisk !== '' && data.rdrRisk !== '' && data.persons !== '' && data.targets !== '',
    'C11b - and camera and radar figures are still stated separately in the strip',
    `cam=${data.camRisk} rdr=${data.rdrRisk} persons=${data.persons} targets=${data.targets}`)
  check(data.mode.length > 0 && /\d/.test(data.fused),
    'C12 - the backend system mode and fused risk are still on the screen',
    `${data.mode} / ${data.fused.replace(/\s+/g, ' ')}`)
  check(data.trackRefs > 0, 'C13 - track ids still appear on alerts', `${data.trackRefs}`)
  check(data.targetRefs > 0, 'C13b - and target ids do too', `${data.targetRefs}`)

  // The radar plot is the panel radar targets now feed.
  await page.click('[data-io2-vf-tab="radar"]')
  await page.waitForTimeout(800)
  const radar = await page.evaluate(() => ({
    plot: Boolean(document.querySelector('.dm-radarplot')),
    box: document.querySelector('.dm-radarplot')
      ? Math.round(document.querySelector('.dm-radarplot').getBoundingClientRect().height) : 0,
    feeds: document.querySelectorAll('.io2-vf-body .dl-feed').length,
  }))
  check(radar.plot, 'C14 - the radar plot still renders')
  check(radar.box > 200, 'C15 - and it is a usable size', `${radar.box}px`)
  check(radar.feeds === 0, 'C16 - the radar tab still mounts zero camera feeds')
  await page.ctx.close()
}

// --- C3 the panels that stayed got bigger --------------------------------------
for (const [w, h] of [[1920, 1080], [1366, 768]]) {
  const page = await open({ width: w, height: h })
  await page.ops()
  const m = await layout(page)
  const b = beforeOf(`${w} he demo`)
  const tag = `${w}`

  // At 1920 Areas gains width (2/12 -> 3/12). At 1366 it already had a full half
  // of the row, so what it gains there is height, from the second band it now
  // shares with Risk Factors instead of being stacked under the alert list.
  check(w === 1920 ? m.areas.w > b.areas.w : m.areas.h > b.areas.h,
    `C17 - ${tag}: the areas panel got ${w === 1920 ? 'wider' : 'taller'} than in A3`,
    w === 1920 ? `${b.areas.w} -> ${m.areas.w}px wide` : `${b.areas.h} -> ${m.areas.h}px tall`)
  check(m.factors.w >= b.factors.w,
    `C18 - ${tag}: risk factors is at least as wide`, `${b.factors.w} -> ${m.factors.w}px`)
  check(m.timeline.w >= b.timeline.w,
    `C19 - ${tag}: risk/time is at least as wide`, `${b.timeline.w} -> ${m.timeline.w}px`)
  // Rebased in Phase A3.2 (§18/§19/§95). A3.1 wanted the log WIDER; A3.2 wants it
  // NARROWER, and deliberately so — a full-width strip holding a few rows was
  // mostly empty black, and §19 asks for less width and less empty space while
  // keeping enough room to read an event. So the check becomes the real
  // requirement: it gave width back, but not so much that the log stops being
  // readable, and it is still a substantial panel rather than a sliver.
  // `<=`, not `<`: at 1920 the log genuinely gave width back (full-width strip ->
  // half cell), but at 1366 it was ALREADY a half-width panel in A3.1, so there
  // was nothing left to give and it is unchanged. The requirement common to both
  // is that it never grew back into a strip.
  check(m.log.w <= b.log.w,
    `C20 - ${tag}: the session log is no wider than A3.1 left it (A3.2 §18)`,
    `${b.log.w} -> ${m.log.w}px`)
  check(m.log.w >= 480,
    `C20b - ${tag}: while staying wide enough to read an event line (§19)`, `${m.log.w}px`)
  check(m.rowH > b.alertRowH,
    `C21 - ${tag}: alert rows are taller and more readable`, `${b.alertRowH} -> ${m.rowH}px`)
  check(m.hOverflow === 0, `C22 - ${tag}: no horizontal overflow`, `${m.hOverflow}px`)
  await page.ctx.close()
}

// The session log is genuinely full width on the desktop grid.
{
  const page = await open()
  await page.ops()
  const m = await layout(page)
  const gridW = await page.$eval('.io2-grid', (e) => Math.round(e.getBoundingClientRect().width))
  // Rebased in Phase A3.2 (§16/§18/§95). The claim this made — the bottom band
  // accounts for the full grid width with nothing stranded — is unchanged; the
  // two panels sharing that band are now risk factors and the session log, and
  // risk/time has moved up into the feed's column.
  check(m.log.w < gridW - 4, 'C23 - the session log no longer spans the whole grid width (A3.2 §18)',
    `${m.log.w} of ${gridW}px`)
  check(m.factors.w + m.log.w >= gridW - 4,
    'C24 - risk factors and the session log split the bottom band between them',
    `${m.factors.w} + ${m.log.w} of ${gridW}px`)
  check(Math.abs(m.timeline.w - m.feed.w) <= 4,
    'C24b - and risk/time is the feed\'s width, in the feed\'s column (A3.2 §16)',
    `${m.timeline.w} vs feed ${m.feed.w}`)
  await page.ctx.close()
}

// --- C4 alert readability ------------------------------------------------------
// Re-based by Phase A3.1.1 §27: the panel went from 4/12 to 3/12 so the visual
// feed could have its width back, and a narrower column is answered by wrapping,
// never by smaller type. The floor is 3 at both resolutions.
for (const [w, h, lang, min] of [
  [1920, 1080, 'he', 3], [1920, 1080, 'en', 3],
  [1366, 768, 'he', 3], [1366, 768, 'en', 3],
]) {
  const page = await open({ width: w, height: h, lang })
  await page.ops()
  const m = await layout(page)
  check(m.visible >= min, `C25 - ${w} ${lang}: at least ${min} alerts visible`, `${m.visible}`)

  // 58 - selection still costs nothing in height. Measured on the SAME row
  // before and after selecting it: different rows carry different messages and
  // legitimately differ in height, so comparing two of them would prove nothing.
  const rowId = await page.$eval('[data-io2-alert-row] >> nth=1', (e) => e.getAttribute('data-io2-alert-row'))
  const heightOf = () => page.$eval(`[data-io2-alert-row="${rowId}"]`, (e) => Math.round(e.getBoundingClientRect().height))
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(350)
  const unselectedH = await heightOf()
  await page.click(`[data-io2-alert-row="${rowId}"]`)
  await page.waitForTimeout(350)
  const selectedH = await heightOf()
  check(selectedH === unselectedH,
    `C26 - ${w} ${lang}: selecting a row does not change its height`,
    `${unselectedH} -> ${selectedH}px`)

  const buttons = await page.$$eval('[data-io2-alert-row] button', (n) => n.length)
  check(buttons === 0, `C27 - ${w} ${lang}: still no action button inside a row`, `${buttons}`)

  const canScroll = await page.$eval('.io2-alerts-scroll', (e) => e.scrollHeight > e.clientHeight + 4)
  check(canScroll, `C28 - ${w} ${lang}: the rest of the alerts are one internal scroll away`)
  await page.ctx.close()
}

// --- C5 the feed --------------------------------------------------------------
{
  const page = await open()
  await page.ops()
  const m = await layout(page)
  const b = beforeOf('1920 he demo')
  check(m.feedBody.h >= b.feedBody.h,
    'C29 - 1920: the feed body is no shorter than it was in A3', `${b.feedBody.h} -> ${m.feedBody.h}px`)
  const cap = await page.$eval('.io2-vf-body .dl-feed, .io2-vf-body .dl-feed-demo-svg', (e) => getComputedStyle(e).maxHeight)
  check(cap === '520px', 'C30 - the feed media cap was raised to 520px', cap)

  const tabs = await page.$$eval('[data-io2-vf-tab]', (n) => n.map((b2) => b2.dataset.io2VfTab))
  check(tabs.includes('all') && tabs.includes('radar'),
    'C31 - the camera / all-cameras / radar tabs are unchanged', tabs.join(','))
  await page.click('[data-io2-vf-tab="all"]')
  await page.waitForTimeout(600)
  check((await page.$$('.io2-vf-body .dl-feed')).length === 0, 'C32 - ALL CAMERAS still mounts zero feeds')
  await page.ctx.close()
}

// --- C6 Configuration: the new tab ---------------------------------------------
for (const [w, h, lang] of [[1920, 1080, 'he'], [1920, 1080, 'en'], [1366, 768, 'he'], [1366, 768, 'en']]) {
  const page = await open({ width: w, height: h, lang })
  await page.config()
  const tabs = await page.$$eval('.io2-tabs button', (n) => n.map((b) => b.textContent.trim()))
  const tag = `${w} ${lang}`
  check(tabs.length === 4, `C33 - ${tag}: Configuration has four tabs`, tabs.join(' | '))
  check(tabs[0] === 'RADAR' && tabs[1] === 'OPERATOR' && tabs[2] === 'GENERAL',
    `C34 - ${tag}: the three existing tabs keep their places`, tabs.slice(0, 3).join(','))
  check(tabs[3] === (lang === 'he' ? 'בריאות מערכת' : 'SYSTEM HEALTH'),
    `C35 - ${tag}: SYSTEM HEALTH is appended and localised`, tabs[3])

  await page.click('.io2-tabs button >> nth=3')
  await page.waitForTimeout(2500)
  const health = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.io2-health-tab')),
    rows: document.querySelectorAll('.dm-health-row').length,
    names: [...document.querySelectorAll('.dm-health-name')].map((e) => e.textContent.trim()),
    states: [...document.querySelectorAll('.dm-health-state')].map((e) => e.textContent.trim()),
    coverage: document.querySelector('.io2-health-coverage-state')?.textContent.trim() || null,
    selected: document.querySelectorAll('.io2-tabs button[aria-selected="true"]').length,
    hOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  }))
  check(health.panel, `C36 - ${tag}: the panel opens`)
  check(health.rows >= 5, `C37 - ${tag}: the subsystem rows render`, `${health.rows}`)
  check(health.selected === 1, `C38 - ${tag}: exactly one tab reports aria-selected`, `${health.selected}`)
  check(health.hOverflow === 0, `C39 - ${tag}: no horizontal overflow`, `${health.hOverflow}px`)
  check(Boolean(health.coverage), `C40 - ${tag}: the coverage judgement is shown`, health.coverage)

  // 31/32 - honesty. This machine has no camera and no radar; the panel must
  // say so rather than showing a comfortable OK.
  check(!health.states.includes('OK') || health.states.some((s) => /DOWN|DISCONNECTED|UNAVAILABLE|NOT FOUND|UNKNOWN/.test(s)),
    `C41 - ${tag}: absent hardware is reported as absent`, health.states.join(','))
  const fakeTime = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.dm-health-updated')].map((e) => e.textContent.trim())
    // A row with no real timestamp must print an em dash, never a fabricated one.
    return cells.filter((c) => c !== '—' && !/^\d|rx|ms|\(\+/i.test(c))
  })
  check(fakeTime.length === 0, `C42 - ${tag}: no invented timestamp`, fakeTime.join(','))
  await page.ctx.close()
}

// --- C7 keyboard and focus on the new tab ---------------------------------------
{
  const page = await open()
  await page.config()
  const reachable = await page.evaluate(() => {
    const tab = document.querySelectorAll('.io2-tabs button')[3]
    tab.focus()
    return { focused: document.activeElement === tab, tag: tab.tagName, role: tab.getAttribute('role') }
  })
  check(reachable.focused && reachable.tag === 'BUTTON' && reachable.role === 'tab',
    'C43 - the new tab is a real, focusable tab', JSON.stringify(reachable))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  check(Boolean(await page.$('.io2-health-tab')), 'C44 - and Enter opens it')
  await page.ctx.close()
}

// --- C8 no duplicate polling ------------------------------------------------------
{
  const page = await open()
  const calls = { status: 0, radar: 0, cameras: 0, arduino: 0 }
  // Counting starts only once Configuration is on screen: the login landing page
  // is a live dashboard, and its polls are not this page's doing.
  await page.config()
  page.on('request', (r) => {
    const u = r.url()
    if (!u.includes(':5000')) return
    const p = new URL(u).pathname
    if (p === '/status') calls.status += 1
    else if (p === '/api/radar/live') calls.radar += 1
    else if (p === '/api/cameras/status') calls.cameras += 1
    else if (p === '/api/arduino-messages') calls.arduino += 1
  })

  await page.waitForTimeout(3000)
  const idle = { ...calls }
  check(idle.status === 0 && idle.radar === 0,
    'C45 - Configuration polls nothing while System Health is closed', JSON.stringify(idle))

  await page.click('.io2-tabs button >> nth=3')
  await page.waitForTimeout(5000)
  const open5s = { status: calls.status, radar: calls.radar, cameras: calls.cameras }
  // One 1Hz loop over ~5s, plus the immediate poll on mount, doubled by React
  // StrictMode's mount/cleanup/mount. Two loops would be roughly double again.
  check(open5s.status <= 9, 'C46 - opening it starts ONE poll loop, not two', `${open5s.status} /status in 5s`)
  check(Math.abs(open5s.status - open5s.radar) <= 2 && Math.abs(open5s.status - open5s.cameras) <= 2,
    'C47 - and the four endpoints move together, as one cycle',
    JSON.stringify(open5s))

  await page.click('.io2-tabs button >> nth=0')
  const mark = { ...calls }
  await page.waitForTimeout(3000)
  check(calls.status === mark.status && calls.radar === mark.radar,
    'C48 - leaving the tab stops the polling completely',
    `${calls.status - mark.status} more /status`)

  // 38 - repeated open/close must not accumulate loops.
  for (let i = 0; i < 3; i += 1) {
    await page.click('.io2-tabs button >> nth=3')
    await page.waitForTimeout(700)
    await page.click('.io2-tabs button >> nth=0')
    await page.waitForTimeout(400)
  }
  const settled = { ...calls }
  await page.waitForTimeout(2500)
  check(calls.status === settled.status,
    'C49 - and three open/close cycles leak no polling', `${calls.status - settled.status} more /status`)
  check(page.errors.length === 0, 'C50 - no page error in Configuration', page.errors.join('|'))
  await page.ctx.close()
}

// --- C9 OPS operational integrity -------------------------------------------------
{
  const page = await open()
  await page.ops()
  // Filter to NEW first: acknowledging an already-acknowledged alert is a no-op
  // by design, and would prove nothing about the action still working.
  await page.click('.io2-filter-tab >> nth=1')
  await page.waitForTimeout(500)
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(400)
  const before = await page.evaluate(() => ({
    life: document.querySelector('.io2-ab-life')?.textContent.trim(),
    id: document.querySelector('.io2-ab-id')?.textContent.trim(),
  }))
  check(Boolean(before.id), 'C51 - the action bar still describes the selected alert', before.id)
  const actions = await page.$$eval('[data-io2-action]', (n) => n.map((e) => e.dataset.io2Action))
  check(actions.length > 0, 'C52 - lifecycle actions are still offered', actions.join(','))

  await page.click('[data-io2-action="acknowledge"]').catch(() => {})
  await page.waitForTimeout(600)
  const after = await page.evaluate(() => document.querySelector('.io2-ab-life')?.textContent.trim())
  check(after !== before.life, 'C53 - and they still work', `${before.life} -> ${after}`)

  await page.click('[data-io2-alert-row] >> nth=1', { button: 'right' })
  await page.waitForTimeout(500)
  check(Boolean(await page.$('.io2-ctxmenu')), 'C54 - the context menu still opens')
  await page.keyboard.press('Escape')

  // Audio survived the redesign untouched.
  const audio = await page.evaluate(() => ({
    control: Boolean(document.querySelector('.io2-sound')),
    inMode: Boolean(document.querySelector('.io2-strip-mode .io2-sound')),
    strip: document.querySelector('.io2-strip').children.length,
    state: document.querySelector('.io2-sound')?.dataset.io2SoundState,
    stats: window.__IO2_AUDIO_STATS__,
  }))
  check(audio.control && audio.inMode, 'C55 - the sound control is still in the SYS MODE cluster')
  check(audio.strip === 12, 'C56 - the status strip still has exactly twelve children', `${audio.strip}`)
  check(['READY', 'MUTED', 'BLOCKED', 'ERROR'].includes(audio.state), 'C57 - and still reports a real state', audio.state)
  check(audio.stats && audio.stats.alertCues === 0 && audio.stats.dangerCues === 0,
    'C58 - opening the redesigned screen still plays nothing', JSON.stringify(audio.stats))
  await page.ctx.close()
}

// --- C10 honesty vocabulary -----------------------------------------------------
{
  const page = await open()
  await page.ops()
  const text = await page.evaluate(() => document.body.innerText)
  check(!/\bPAIR RISK\b|\bASSOCIATED\b(?!\s*·?\s*NOT)|\bMATCHED\b|\bCONFIRMED PAIR\b/i.test(text.replace(/NOT ASSOCIATED/gi, '')),
    'C59 - no camera-radar association vocabulary appeared with the redesign')
  // A3.2: LIVE camera ids only. A demo alert may name a DEMO- camera declared by
  // its own area (§35) - phase-a1 test 33 enforces that stricter rule.
  check(!/(^|[^-])\bCAM-0\d/.test([...(await page.$$eval('.io2-alert-src', (n) => n.map((e) => e.textContent)))].join(' ')),
    'C60 - still no camera id claimed as an alert source')
  check(page.errors.length === 0, 'C61 - no page error', page.errors.join('|'))
  await page.ctx.close()
}

await browser.close()

// ============================================================================
console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}  --  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
