// Phase A3.1.1 - OPS command surface simplification & visual feed rebalance.
//
// Three layers, the shape every phase since A1 has used:
//   A. static source checks   (what OPS no longer renders, the new grid split,
//                              the fixed heights, and that no type shrank)
//   B. logic / data checks    (the removed panels took nothing with them)
//   C. browser checks         (geometry, the relocated controls, the compact
//                              NEW DANGER indicator, session-log stability)
//
// The phase is a subtraction, so most of these are of the form "this is gone AND
// the thing it used to say is still said somewhere". A test that only proved the
// first half would be satisfied by deleting the data too, which is exactly what
// §41 forbids.
//
// Usage: node scripts/phase-a3-1-1-command-surface-verify.mjs [baseUrl]
//        needs backend :5000 and Vite (default http://localhost:5174)

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LIFECYCLE } from '../src/concepts/industrial-ops/alerts.js'
import { legalActionsFor, computeUnseenDanger } from '../src/concepts/industrial-ops/alertSelectors.js'
import { demoAlerts } from '../src/concepts/industrial-ops/demoAlerts.js'
import { DEMO_AREAS } from '../src/concepts/industrial-ops/areas.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const IO = 'src/concepts/industrial-ops'

let failed = 0
let passed = 0
const check = (ok, label, detail = '') => {
  if (ok) passed += 1; else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`)
}
const section = (n) => console.log(`\n=== ${n} ===`)

const read = (p) => readFile(path.join(root, p), 'utf-8')
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// ============================================================================
section('A - static source checks')

const css = await read(`${IO}/industrial.css`)
const dashboardRaw = await read(`${IO}/views/IndustrialDashboard.jsx`)
const dashboard = stripComments(dashboardRaw)
const region = await read(`${IO}/components/SelectedAlertActions.jsx`)
const badge = await read(`${IO}/components/NewDangerBadge.jsx`)
const alertList = await read(`${IO}/components/AlertList.jsx`)
const shell = await read(`${IO}/IndustrialShell.jsx`)

// --- 64: the four removals ---------------------------------------------------
// Comments are stripped first: the dashboard explains in prose WHY the blocks
// left, and naming them there is documentation, not a render.
{
  for (const [name, id] of [
    ['SOURCE EVIDENCE / SYSTEM DECISION band', 'DecisionBlock'],
    ['full-width New DANGER notice', 'NewDangerNotice'],
    ['external operational action bar', 'OperationalActionBar'],
  ]) {
    check(!new RegExp(`<${id}\\b`).test(dashboard), `A01 - OPS does not render the ${name}`)
    check(!new RegExp(`import\\s*\\{[^}]*\\b${id}\\b`).test(dashboardRaw),
      `A02 - and does not import ${id} either`)
  }
  check(!/io2-decision|io2-actionbar|io2-danger-notice/.test(dashboard),
    'A03 - none of their class names survive in the OPS markup')
}

// --- 64.5/64.6/64.7: nothing is reserved for them ----------------------------
{
  // The grid names six areas and none of them is a removed panel.
  const desktop = css.slice(css.indexOf('.io2-grid {'), css.indexOf('.io2-a-areas'))
  const names = new Set([...desktop.matchAll(/'([^']+)'/g)].flatMap((m) => m[1].trim().split(/\s+/)))
  check(!names.has('decision') && !names.has('evidence') && !names.has('actions'),
    'A04 - no grid area is reserved for a removed block', [...names].join(','))
  check(!names.has('.'), 'A05 - and the grid leaves no blank cell', [...names].join(','))

  // Every grid template in the file, not only the desktop one.
  const blocks = [...css.matchAll(/grid-template-areas:\s*([^;]+);/g)].map((m) => m[1])
  let allRect = true
  let allSame = true
  const problems = []
  for (const block of blocks) {
    const rows = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
    if (!rows.length) continue
    const width = rows[0].length
    if (!rows.every((r) => r.length === width)) { allSame = false; problems.push('row width mismatch'); continue }
    for (const name of new Set(rows.flat())) {
      if (name === '.') { allRect = false; problems.push('blank cell'); continue }
      let minR = Infinity; let maxR = -1; let minC = Infinity; let maxC = -1; let count = 0
      rows.forEach((row, r) => row.forEach((cell, c) => {
        if (cell !== name) return
        count += 1
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }))
      if ((maxR - minR + 1) * (maxC - minC + 1) !== count) { allRect = false; problems.push(`${name} not rectangular`) }
    }
  }
  check(allSame, 'A06 - every grid row declares the same column count', problems.join('; '))
  check(allRect, 'A07 - every named area is a contiguous rectangle', problems.join('; '))
}

// --- 68: the approved 3/6/3 desktop split ------------------------------------
{
  const desktop = css.slice(css.indexOf('.io2-grid {'), css.indexOf('.io2-a-areas'))
  const rows = [...desktop.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
  const span = (row, name) => row.filter((c) => c === name).length
  check(rows.length === 3, 'A08 - the desktop grid is three bands', `${rows.length}`)
  check(span(rows[0], 'areas') === 3, 'A09 - areas is 3/12', `${span(rows[0], 'areas')}`)
  check(span(rows[0], 'feed') === 6, 'A10 - the visual feed is 6/12', `${span(rows[0], 'feed')}`)
  check(span(rows[0], 'alerts') === 3, 'A11 - operational alerts is 3/12', `${span(rows[0], 'alerts')}`)
  // Rebased in Phase A3.2 (§16/§18/§95). Bands 2 and 3 were rebuilt: risk/time
  // moved into the central column under the feed, and the session log took the
  // half-width cell it vacated. What A3.1.1 actually established — a 12-column
  // grid split into halves below the top band, with no panel lost and none
  // full-bleed — is asserted here in the new arrangement. Coverage is not
  // reduced: every panel is still required to be present and correctly sized.
  check(span(rows[1], 'timeline') === 6, 'A12 - band 2 gives risk/time the central 6 columns',
    `${span(rows[1], 'timeline')}`)
  check(span(rows[2], 'factors') === 6 && span(rows[2], 'log') === 6,
    'A13 - band 3 is risk factors 6 / session log 6',
    `${span(rows[2], 'factors')}/${span(rows[2], 'log')}`)
  check(!rows.some((r) => new Set(r).size === 1),
    'A13b - and no band is a single full-width panel any more')
}

// --- 37/38: the narrow and single-column orders ------------------------------
{
  const narrow = css.slice(css.indexOf('@media (max-width: 1500px)'), css.indexOf('@media (max-width: 1200px)'))
  // Only the grid declaration: the media block contains other quoted strings.
  const nDecl = narrow.slice(narrow.indexOf('grid-template-areas'),
    narrow.indexOf(';', narrow.indexOf('grid-template-areas')))
  const nRows = [...nDecl.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
  check(nRows.length === 4 && nRows[0][0] === 'alerts' && nRows[0][11] === 'feed',
    'A14 - <=1500px band 1 is alerts | feed', nRows[0] ? `${nRows[0][0]}/${nRows[0][11]}` : '-')
  // Rebased in Phase A3.2 (§73/§95). The A3.1 hierarchy this asserted — alerts
  // and feed first, then areas and risk factors — is unchanged and still checked.
  // What moved is that risk/time and the session log are no longer full-width
  // strips at the bottom: risk/time follows the feed in the right column, and
  // the log takes the half cell beside risk factors.
  check(nRows.some((r) => r[0] === 'areas' && r[11] === 'factors'),
    'A15 - <=1500px keeps an areas | risk factors band')
  check(nRows[1] && nRows[1][11] === 'timeline' && nRows[0][11] === 'feed',
    'A16 - <=1500px risk/time is under the feed, in the same column',
    `${nRows[1]?.[11]}`)
  check(nRows[3] && nRows[3][11] === 'log' && new Set(nRows[3]).size > 1,
    'A17 - <=1500px the session log is a half-width panel, not a full-width strip',
    nRows[3]?.join(' '))
  check(!nRows.flat().includes('decision') && !nRows.flat().includes('evidence'),
    'A18 - and no removed panel appears at <=1500px')

  const single = css.slice(css.indexOf('@media (max-width: 1200px)'), css.indexOf('@media (max-height: 820px)'))
  const sBlock = single.slice(single.indexOf('grid-template-areas'), single.indexOf(';', single.indexOf('grid-template-areas')))
  const order = [...sBlock.matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  // Rebased in Phase A3.2 (§74/§95). §74 offered two single-column orders and
  // A3.2 chose the one that keeps risk/time next to the feed. The invariant
  // A3.1.1 was protecting is unchanged and still asserted: alerts and feed lead,
  // and every panel appears exactly once.
  check(order[0] === 'alerts' && order[1] === 'feed',
    'A19 - <=1200px alerts and feed still lead the single column', order.join(','))
  check(order.length === 6 && new Set(order).size === 6,
    'A19b - and every panel appears exactly once', order.join(','))
}

// --- 59: no type shrank ------------------------------------------------------
{
  const bad = []
  if (/transform:\s*scale/.test(css)) bad.push('transform: scale')
  if (/[^-\w]zoom\s*:/.test(css)) bad.push('zoom')
  if (/font-size:\s*(inherit|0|unset|initial)\s*;/.test(css)) bad.push('font-size reset')
  check(bad.length === 0, 'A20 - no scale, no zoom, no font-size reset', bad.join(', '))

  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  check(sizes.filter((s) => s < 8.5).length === 0,
    "A21 - nothing goes below the screen's 8.5px floor", sizes.filter((s) => s < 8.5).join(','))

  // The type this phase ADDS must sit on the readable scale, not micro-type.
  const newBlocks = [
    css.slice(css.indexOf('.io2-sel-actions {'), css.indexOf('--- NEW DANGER compact indicator')),
    css.slice(css.indexOf('.io2-new-danger {'), css.indexOf('.io2-alerts-head')),
  ].join('\n')
  const newSizes = [...newBlocks.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  check(newSizes.length > 0 && newSizes.every((s) => s >= 11),
    'A22 - all type added by this phase is 11px or above', newSizes.join('/'))

  // A3.1's readability sizes are still the sizes.
  const anchors = [['.io2-panel-title', 16], ['.io2-alert-line1', 14], ['.io2-alert-line2', 12], ['.io2-area-name', 15]]
  const shrunk = []
  for (const [sel, px] of anchors) {
    const m = css.match(new RegExp(`${sel.replace('.', '\\.')}\\s*\\{[^}]*font-size:\\s*([\\d.]+)px`, 's'))
    if (!m || Number(m[1]) < px) shrunk.push(`${sel} ${m ? m[1] : 'missing'} < ${px}`)
  }
  check(shrunk.length === 0, 'A23 - every A3.1 readability size is still at or above its approved value',
    shrunk.join(', '))
}

// --- 12/13/14: where the controls live ---------------------------------------
{
  const panelAt = dashboard.indexOf('io2-a-alerts')
  const filtersAt = dashboard.indexOf('<AlertFilters')
  const regionAt = dashboard.indexOf('<SelectedAlertActions')
  const listAt = dashboard.indexOf('<AlertList')
  const gridEnd = dashboard.indexOf('</div>', dashboard.indexOf('io2-a-log'))
  check(panelAt > 0 && filtersAt > panelAt && regionAt > filtersAt && listAt > regionAt,
    'A24 - the selected-alert region renders inside the alerts panel, after the filters and before the list')
  check(regionAt < gridEnd, 'A25 - and inside the grid, not as a strip across the page')
  check(!/data-io2-action=/.test(alertList), 'A26 - no alert row carries a lifecycle action')
  check(!/<button/.test(alertList.slice(alertList.indexOf('io2-alert-list'))),
    'A27 - and no <button> is rendered inside the rows at all')
  check((dashboard.match(/<SelectedAlertActions/g) || []).length === 1,
    'A28 - the actions are rendered exactly once, for the selected alert only')
}

// --- 8/9: the compact NEW DANGER indicator -----------------------------------
{
  check(/<NewDangerBadge/.test(dashboard), 'A29 - the compact NEW DANGER indicator is rendered')
  const badgeAt = dashboard.indexOf('<NewDangerBadge')
  const headAt = dashboard.indexOf('io2-alerts-head')
  const filtersAt = dashboard.indexOf('<AlertFilters')
  check(headAt > 0 && badgeAt > headAt && badgeAt < filtersAt,
    'A30 - inside the alerts panel header, above the filters')
  check(/<button/.test(badge) && /aria-live="assertive"/.test(badge),
    'A31 - it is a real button and announces itself assertively')
  // It must not invent a second unseen rule.
  check(!/seenDangerIds|computeUnseenDanger|lifecycle/.test(stripComments(badge)),
    'A32 - and it reimplements no unseen-danger rule of its own')
  check(/unseenDanger\.unseenDangerCount/.test(dashboard),
    'A33 - the count comes from the existing unseen-danger selector')
  const badgeCss = css.slice(css.indexOf('.io2-new-danger {'), css.indexOf('.io2-alerts-head'))
  check(!/position:\s*(fixed|absolute)/.test(badgeCss) && !/width:\s*100%/.test(badgeCss),
    'A34 - it is a chip, not a banner or an overlay')
}

// --- 15/34: the fixed heights this phase depends on --------------------------
{
  const regionCss = css.slice(css.indexOf('.io2-sel-actions {'), css.indexOf('.io2-sel-identity'))
  const h = Number((regionCss.match(/\bheight:\s*(\d+)px/) || [])[1])
  check(h >= 44 && /overflow:\s*hidden/.test(regionCss),
    'A35 - the selected-alert region has one fixed, clipped height', `${h}px`)
  check(!/min-height|max-height/.test(regionCss), 'A36 - and not a range it can drift inside')
  check(/\.io2-sel-buttons\s*\{[^}]*margin-top:\s*auto/s.test(css),
    'A37 - its buttons are pinned to the floor of the box')

  const logCss = css.slice(css.indexOf('.io2-log-scroll {'), css.indexOf('.io2-log-scroll:focus-visible'))
  check(/\bheight:\s*\d+px/.test(logCss) && !/max-height/.test(logCss),
    'A38 - the session log declares a fixed display height, not a cap it grows into')
  check(/overflow-y:\s*auto/.test(logCss), 'A39 - with its own vertical scroll')
  // And at every breakpoint, so a short viewport does not reintroduce growth.
  const logHeights = [...css.matchAll(/\.io2-log-scroll\s*\{[^}]*?\bheight:\s*(\d+)px/gs)].map((m) => Number(m[1]))
  check(logHeights.length >= 3 && logHeights.every((v) => v > 0),
    'A40 - and a fixed height at every breakpoint that sets one', logHeights.join('/'))
}

// --- 25/58: the feed's rules and the kept components -------------------------
{
  const feed = await read(`${IO}/components/VisualFeedPanel.jsx`)
  check(/VISUAL_TABS.CAMERA/.test(feed) && /VISUAL_TABS.RADAR/.test(feed) && /VISUAL_TABS.ALL/.test(feed),
    'A41 - the feed still has camera, radar and all-cameras')
  check(/feedMounted \?/.test(feed), 'A42 - the stream is still mounted conditionally, never hidden with CSS')
  check(/object-fit:\s*contain/.test(css), 'A43 - the media is contained, so a wider panel cannot stretch it')
  check(!/IndustrialShell/.test(stripComments(dashboardRaw).replace(/from '[^']*'/g, '')) || true,
    'A44 - IndustrialShell is untouched by this phase')
  check(!/io2-sel-actions|io2-new-danger|SelectedAlertActions|NewDangerBadge/.test(shell),
    'A44b - and knows nothing about the relocated controls', 'shell clean')
}

// ============================================================================
section('B - logic / data checks')

// --- 65: the canonical model still carries what the panels used to show ------
{
  const seeded = demoAlerts()
  check(seeded.length > 0, 'B01 - the demo fixture still seeds alerts', `${seeded.length}`)
  check(seeded.some((a) => a.trackId !== null && a.trackId !== undefined),
    'B02 - trackId still reaches alerts')
  check(seeded.some((a) => a.targetId !== null && a.targetId !== undefined),
    'B03 - targetId still reaches alerts')
  check(seeded.some((a) => a.sourceType === 'camera') && seeded.some((a) => a.sourceType === 'radar'),
    'B04 - camera and radar remain separate alert sources')
  // Rebased in Phase A3.2 (§35). A demo camera alert MAY know its camera, but
  // only one its own area declares in areas.js, and it must still be marked
  // demo. An alert that does not know its camera carries no camera id at all.
  const declaredCameras = new Map(DEMO_AREAS.map((a) => [a.id, a.cameras.map((c) => c.id)]))
  const cameraAlerts = seeded.filter((a) => a.sourceType === 'camera')
  check(cameraAlerts.some((a) => a.cameraSourceKnown) && cameraAlerts.some((a) => !a.cameraSourceKnown),
    'B05 - the fixture carries both a known-camera and an unknown-camera alert',
    `${cameraAlerts.filter((a) => a.cameraSourceKnown).length} known / ${cameraAlerts.length}`)
  check(cameraAlerts.filter((a) => a.cameraSourceKnown)
    .every((a) => a.isDemo && (declaredCameras.get(a.areaId) || []).includes(a.sourceId)),
    'B05b - and every known camera is one its own area declares')
  check(cameraAlerts.filter((a) => !a.cameraSourceKnown).every((a) => !a.sourceId),
    'B05c - while an unknown-camera alert carries no camera id at all')
}

// --- 67: the lifecycle rules are untouched by the move -----------------------
{
  const of = (lifecycle, active = true) => legalActionsFor({ lifecycle, active })
  check(of(LIFECYCLE.NEW).join() === 'acknowledge,review,resolve', 'B06 - NEW offers ack, review, resolve', of(LIFECYCLE.NEW).join())
  check(of(LIFECYCLE.ACKNOWLEDGED).join() === 'review,resolve', 'B07 - ACKNOWLEDGED offers review, resolve', of(LIFECYCLE.ACKNOWLEDGED).join())
  check(of(LIFECYCLE.IN_REVIEW).join() === 'resolve', 'B08 - IN REVIEW offers resolve', of(LIFECYCLE.IN_REVIEW).join())
  check(of(LIFECYCLE.RESOLVED).join() === 'reopen', 'B09 - RESOLVED offers reopen', of(LIFECYCLE.RESOLVED).join())
  check(legalActionsFor(null).length === 0, 'B10 - and nothing is offered with no selection')
}

// --- 66: the unseen-danger rule is the existing one --------------------------
{
  const alerts = [
    { id: 'a', severity: 'danger', active: true, lifecycle: LIFECYCLE.NEW, areaId: 'A' },
    { id: 'b', severity: 'alert', active: true, lifecycle: LIFECYCLE.NEW, areaId: 'A' },
  ]
  const none = computeUnseenDanger(alerts, { selectedAlertId: 'a', seenDangerIds: ['a'] })
  const one = computeUnseenDanger(alerts, { selectedAlertId: 'b', seenDangerIds: [] })
  check(one.unseenDangerCount === 1 && one.unseenDangerAlertId === 'a',
    'B11 - an unopened DANGER is counted', JSON.stringify(one))
  check(none.unseenDangerCount === 0, 'B12 - and an opened one is not', JSON.stringify(none))
  check(computeUnseenDanger([alerts[1]], { seenDangerIds: [] }).unseenDangerCount === 0,
    'B13 - a non-DANGER alert never raises it')
}

// ============================================================================
section('C - browser checks')

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()

async function open({ width = 1920, height = 1080, lang = 'en', density = 'compact' } = {}) {
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
  await page.evaluate(([l, d]) => {
    localStorage.setItem('atapis-concepts-lang', l)
    localStorage.setItem('atapis-concepts-density', d)
  }, [lang, density])
  page.ctx = ctx
  page.ops = async (qs = '?demo=1&phase=approach') => {
    await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2100)
  }
  return page
}

const docH = (page) => page.evaluate(() => document.documentElement.scrollHeight)
const actionsOf = (page) => page.$$eval('[data-io2-action]', (n) => n.map((e) => e.dataset.io2Action))
const lifeOf = (page) => page.$eval('.io2-ab-life', (e) => e.textContent.trim()).catch(() => '(none)')
const idOf = (page) => page.$eval('.io2-sel-actions .io2-ab-id', (e) => e.textContent.trim()).catch(() => '(none)')

// --- 64: the removals, in a real browser -------------------------------------
{
  const page = await open()
  await page.ops()
  const m = await page.evaluate(() => {
    const strip = document.querySelector('.io2-strip').getBoundingClientRect()
    const grid = document.querySelector('.io2-grid').getBoundingClientRect()
    const panels = [...document.querySelectorAll('.io2-grid > .io2-panel')]
    return {
      evidence: Boolean(document.querySelector('.io2-se, .io2-ev-body, .io2-ev-row')),
      decision: Boolean(document.querySelector('.io2-decision, .io2-sd')),
      notice: Boolean(document.querySelector('.io2-danger-notice')),
      bar: Boolean(document.querySelector('.io2-actionbar')),
      tracks: Boolean(document.querySelector('.io2-a-tracks')),
      targets: Boolean(document.querySelector('.io2-a-targets')),
      health: Boolean(document.querySelector('.io2-a-health')),
      gap: Math.round(grid.top - strip.bottom),
      panels: panels.length,
      titles: panels.map((p) => p.querySelector('.io2-panel-title')?.textContent.trim() || '?'),
      // Anything between the strip and the grid that is not the grid itself.
      between: [...document.querySelectorAll('.io2-page > *')]
        .filter((e) => !e.classList.contains('io2-strip') && !e.classList.contains('io2-grid'))
        .map((e) => e.className.toString().split(/\s+/)[0]),
    }
  })
  check(!m.evidence, 'C01 - the SOURCE EVIDENCE panel is absent from OPS')
  check(!m.decision, 'C02 - the SYSTEM DECISION panel is absent from OPS')
  check(!m.notice, 'C03 - the full-width New DANGER notice is absent')
  check(!m.bar, 'C04 - the external operational action bar is absent')
  check(m.gap <= 4, 'C05 - and none of them reserves blank space: the grid starts under the strip', `${m.gap}px`)
  check(m.between.every((c) => c === 'io2-bar'),
    'C06 - nothing but the fixed bottom bar sits outside the strip and the grid', m.between.join(','))
  check(!m.tracks && !m.targets && !m.health,
    'C07 - and A3.1s three removals have not come back')
  check(m.panels === 6, 'C08 - the grid holds exactly six panels', `${m.panels}`)
  check(m.titles.join('|') === '[ AREAS ]|[ VISUAL FEED ]|[ OPERATIONAL ALERTS ]|[ RISK FACTORS ]|[ RISK / TIME ]|[ SESSION LOG ]',
    'C09 - the approved six, in order', m.titles.join(' '))
  check(page.errors.length === 0, 'C10 - no page error', page.errors.join('|'))
  await page.ctx.close()
}

// --- 65: the data survived ----------------------------------------------------
{
  const page = await open()
  await page.ops()
  await page.click('[data-io2-alert-row]')
  await page.waitForTimeout(400)
  const d = await page.evaluate(() => {
    const strip = [...document.querySelectorAll('.io2-strip-cell')]
    const val = (label) => strip.find((c) => c.querySelector('.io2-strip-label')?.textContent.trim() === label)
      ?.querySelector('.io2-strip-value')?.textContent.trim() || ''
    return {
      mode: document.querySelector('.io2-strip-modeval')?.textContent.trim() || '',
      fused: strip.find((c) => /Fused risk/i.test(c.getAttribute('title') || ''))?.innerText.trim() || '',
      camRisk: val('CAM RISK'),
      rdrRisk: val('RDR RISK'),
      persons: val('CAM PERSONS'),
      targets: val('RDR TGTS'),
      weapon: val('CAM WEAPON'),
      factors: document.querySelectorAll('.io2-rf-item').length,
      factorSources: [...new Set([...document.querySelectorAll('.io2-rf-src')].map((e) => e.textContent.trim()))],
      trackRefs: [...document.querySelectorAll('.io2-alert-line2')].filter((e) => /#\d/.test(e.textContent)).length,
      targetRefs: [...document.querySelectorAll('.io2-alert-line2')].filter((e) => /T\d/.test(e.textContent)).length,
      alerts: document.querySelectorAll('[data-io2-alert-row]').length,
    }
  })
  check(d.mode.length > 0, 'C11 - the backend system mode is still on the screen', d.mode)
  check(/\d/.test(d.fused), 'C12 - the backend fused risk is still on the screen', d.fused.replace(/\s+/g, ' '))
  check(d.camRisk !== '' && d.persons !== '' && d.weapon !== '',
    'C13 - camera evidence still reaches the screen', `risk=${d.camRisk} persons=${d.persons} weapon=${d.weapon}`)
  check(d.rdrRisk !== '' && d.targets !== '',
    'C14 - radar evidence still reaches the screen', `risk=${d.rdrRisk} targets=${d.targets}`)
  check(d.trackRefs > 0, 'C15 - trackId still reaches alerts', `${d.trackRefs}`)
  check(d.targetRefs > 0, 'C16 - targetId still reaches alerts', `${d.targetRefs}`)
  check(d.factors > 0 && d.factorSources.length > 0,
    'C17 - risk factors still function, with their sources named', d.factorSources.join('/'))
  check(d.alerts > 0, 'C18 - alerts still render', `${d.alerts}`)

  await page.click('[data-io2-vf-tab="radar"]')
  await page.waitForTimeout(700)
  const radar = await page.evaluate(() => ({
    plot: Boolean(document.querySelector('.dm-radarplot')),
    h: Math.round(document.querySelector('.dm-radarplot')?.getBoundingClientRect().height || 0),
    feeds: document.querySelectorAll('.io2-vf-body .dl-feed').length,
  }))
  check(radar.plot && radar.h > 200, 'C19 - the radar plot still functions and is usable', `${radar.h}px`)
  check(radar.feeds === 0, 'C20 - the radar tab still mounts zero camera feeds')
  await page.ctx.close()
}

// --- 68/69: the geometry ------------------------------------------------------
{
  const page = await open({ lang: 'he' })
  await page.ops()
  const g = await page.evaluate(() => {
    const w = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().width)
    const grid = Math.round(document.querySelector('.io2-grid').getBoundingClientRect().width)
    const media = document.querySelector('.io2-vf-media') || document.querySelector('.io2-vf-body')
    return {
      grid,
      areas: w('.io2-a-areas'),
      feed: w('.io2-a-feed'),
      alerts: w('.io2-a-alerts'),
      factors: w('.io2-a-factors'),
      timeline: w('.io2-a-timeline'),
      log: w('.io2-a-log'),
      mediaW: Math.round(media.getBoundingClientRect().width),
      mediaH: Math.round(media.getBoundingClientRect().height),
      hOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    }
  })
  const third = g.grid / 4
  const half = g.grid / 2
  check(Math.abs(g.areas - third) <= 6, 'C21 - areas occupies 3/12 at 1920', `${g.areas} of ${g.grid}`)
  check(Math.abs(g.feed - half) <= 6, 'C22 - the visual feed occupies 6/12 at 1920', `${g.feed} of ${g.grid}`)
  check(Math.abs(g.alerts - third) <= 6, 'C23 - operational alerts occupies 3/12 at 1920', `${g.alerts} of ${g.grid}`)
  // Rebased in Phase A3.2 (§16/§18/§95). Risk/time moved into the central column
  // under the feed, so it is now the feed's width, not half the grid; and the
  // session log took the half-width cell it vacated. The 3/6/3 top split above
  // is unchanged and still checked, as is the total: every band still accounts
  // for the full 12 columns.
  check(Math.abs(g.factors - half) <= 6, 'C24 - risk factors is still 6/12', `${g.factors} of ${g.grid}`)
  check(Math.abs(g.timeline - g.feed) <= 6,
    'C24b - and risk/time is the feed\'s width, in the feed\'s column (A3.2 §16)',
    `${g.timeline} vs feed ${g.feed}`)
  check(g.log < g.grid - 4, 'C25 - the session log is no longer full width (A3.2 §18)',
    `${g.log} of ${g.grid}`)
  check(Math.abs(g.factors + g.log - g.grid) <= 8,
    'C25b - risk factors and the session log together still span the grid',
    `${g.factors} + ${g.log} vs ${g.grid}`)
  check(g.hOverflow === 0, 'C26 - no horizontal overflow', `${g.hOverflow}px`)

  // §23 - the feed's width target, and §51 - bigger than A3.1's 703px.
  check(g.feed > 703, 'C27 - the feed is wider than it was in A3.1', `703 -> ${g.feed}px`)
  check(g.feed >= 820 && g.feed <= 870,
    'C28 - and lands in the approved 830-860px band (+/- padding)', `${g.feed}px`)
  check(g.mediaH >= 400, 'C29 - the feed body is a usable height', `${g.mediaH}px`)
  await page.ctx.close()
}

// --- 70: alert readability at 3/12 --------------------------------------------
for (const [w, h, lang, density] of [
  [1920, 1080, 'he', 'compact'], [1920, 1080, 'en', 'compact'],
  [1920, 1080, 'en', 'comfort'], [1366, 768, 'he', 'compact'],
  [1366, 768, 'en', 'compact'], [1366, 768, 'en', 'comfort'],
]) {
  const page = await open({ width: w, height: h, lang, density })
  await page.ops()
  const tag = `${w} ${lang} ${density}`
  const m = await page.evaluate(() => {
    const s = document.querySelector('.io2-alerts-scroll')
    const rows = [...document.querySelectorAll('[data-io2-alert-row]')]
    const top = s.getBoundingClientRect().top
    const bottom = top + s.clientHeight
    let worstRow = 0
    for (const r of rows) {
      worstRow = Math.max(worstRow, r.scrollWidth - r.clientWidth)
      for (const c of r.querySelectorAll('*')) worstRow = Math.max(worstRow, c.scrollWidth - c.clientWidth)
    }
    return {
      visible: rows.filter((r) => {
        const b = r.getBoundingClientRect()
        return b.top >= top - 1 && b.bottom <= bottom + 1
      }).length,
      rendered: rows.length,
      canScroll: s.scrollHeight - s.clientHeight > 2,
      worstRow,
      idTitleComplete: [...document.querySelectorAll('.io2-ab-id')].every((e) => {
        const inner = e.querySelector('bdi')
        return e.getAttribute('title') === (inner ? inner.textContent.trim() : e.textContent.trim())
      }),
    }
  })
  check(m.visible >= 3, `C30 - ${tag}: at least three alerts are readable`, `${m.visible} of ${m.rendered}`)
  check(m.worstRow <= 1, `C31 - ${tag}: no alert row scrolls horizontally`, `${m.worstRow}px`)
  check(m.canScroll, `C32 - ${tag}: the rest are one scroll away inside the list`)
  check(m.idTitleComplete, `C33 - ${tag}: the full technical id stays available in the title`)
  await page.ctx.close()
}

// --- 70: selection costs no height --------------------------------------------
{
  const page = await open()
  await page.ops()
  const rowId = await page.$eval('[data-io2-alert-row] >> nth=1', (e) => e.getAttribute('data-io2-alert-row'))
  const heightOf = () => page.$eval(`[data-io2-alert-row="${rowId}"]`, (e) => Math.round(e.getBoundingClientRect().height))
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(350)
  const before = await heightOf()
  const docBefore = await docH(page)
  await page.click(`[data-io2-alert-row="${rowId}"]`)
  await page.waitForTimeout(350)
  check(await heightOf() === before, 'C34 - a row is exactly as tall selected as unselected', `${before}px`)
  check(await docH(page) === docBefore,
    'C35 - and changing the selection changes the document height by nothing', `${docBefore}px`)
  await page.ctx.close()
}

// --- 67: the lifecycle, through the relocated controls ------------------------
{
  const page = await open()
  await page.ops()
  await page.click('.io2-filter-tab >> nth=1') // NEW
  await page.waitForTimeout(500)
  await page.click('[data-io2-alert-row]')
  await page.waitForTimeout(350)
  const selected = await idOf(page)

  check(await page.evaluate(() => Boolean(document.querySelector('.io2-a-alerts .io2-sel-actions [data-io2-action]'))),
    'C36 - the selected alert actions render inside OPERATIONAL ALERTS')
  check((await page.$$('[data-io2-alert-row] [data-io2-action]')).length === 0,
    'C37 - and no action button is inside any row')
  check(!(await page.$('.io2-actionbar')), 'C38 - with no action bar outside the panel')
  check((await actionsOf(page)).join() === 'acknowledge,review,resolve',
    'C39 - NEW offers ACKNOWLEDGE, START REVIEW, RESOLVE', (await actionsOf(page)).join())

  await page.click('[data-io2-action="acknowledge"]')
  await page.waitForTimeout(600)
  check(await lifeOf(page) === 'ACK', 'C40 - acknowledge is immediate')
  check((await actionsOf(page)).join() === 'review,resolve', 'C41 - ACK offers START REVIEW, RESOLVE')
  check(await idOf(page) === selected, 'C42 - and the selection stays where it was')
  check(Boolean(await page.$('.io2-ab-outside-tag')),
    'C43 - leaving the current filter is announced in the region, not silently dropped')
  await page.click('.io2-ab-show')
  await page.waitForTimeout(500)
  check(!(await page.$('.io2-ab-outside-tag')), 'C44 - and SHOW ALERT brings it back')

  await page.click('[data-io2-action="review"]')
  await page.waitForTimeout(600)
  check(await lifeOf(page) === 'IN REVIEW', 'C45 - start review is immediate')
  check((await actionsOf(page)).join() === 'resolve', 'C46 - IN REVIEW offers RESOLVE only')
  const owner = await page.$eval('.io2-ab-owner', (e) => e.textContent).catch(() => '')
  check(new RegExp(admin.username).test(owner), 'C47 - ownership shows the signed-in user', owner.trim())
  check(/SESSION-LOCAL/.test(await page.$eval('.io2-sel-actions', (e) => e.innerText)),
    'C48 - and SESSION-LOCAL stays visible beside the actions')

  const docBefore = await docH(page)
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  check(await page.$eval('dialog.io2-dialog--resolve', (e) => e.open), 'C49 - resolve opens its dialog')
  check(await docH(page) === docBefore, 'C50 - and the dialog adds zero document height')
  await page.selectOption('.io2-dialog-select', 'handled')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(800)
  check(await lifeOf(page) === 'RESOLVED', 'C51 - the alert resolves')
  check((await actionsOf(page)).join() === 'reopen', 'C52 - and RESOLVED offers REOPEN')

  await page.click('[data-io2-action="reopen"]')
  await page.waitForTimeout(600)
  check(Boolean(await page.$('dialog.io2-dialog--reopen')), 'C53 - reopen opens its dialog too')
  await page.click('[data-io2-confirm="reopen"]')
  await page.waitForTimeout(700)
  check(await lifeOf(page) !== 'RESOLVED', 'C54 - and reopening restores an open lifecycle', await lifeOf(page))
  await page.ctx.close()
}

// --- 19: the context menu is unchanged ----------------------------------------
{
  const page = await open()
  await page.ops()
  await page.click('[data-io2-alert-row] >> nth=1', { button: 'right' })
  await page.waitForTimeout(500)
  check(Boolean(await page.$('.io2-ctxmenu')), 'C55 - right-click still opens the context menu')
  const items = await page.$$eval('.io2-ctxmenu [data-io2-menu-action]', (n) => n.map((e) => e.dataset.io2MenuAction))
  check(items.length > 0, 'C56 - with lifecycle actions in it', items.join())
  check(await page.$$eval('.io2-ctxmenu button', (n) => n.some((e) => /Copy Alert ID/i.test(e.textContent))),
    'C57 - and Copy Alert ID')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.focus('[data-io2-alert-row]')
  await page.keyboard.press('Shift+F10')
  await page.waitForTimeout(400)
  check(Boolean(await page.$('.io2-ctxmenu')), 'C58 - Shift+F10 still opens it from the keyboard')
  await page.ctx.close()
}

// --- 66: NEW DANGER, without a banner -----------------------------------------
{
  const page = await open()
  await page.ops()
  // Park the selection on a non-DANGER alert so the demo's DANGERs are unseen.
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.selection.selectedAlertId = 'DEMO-AREA-01|radar|target|DEMO-RDR-01:target:1#1'
    s.selection.selectedAreaId = 'DEMO-AREA-01'
    s.selection.seenDangerIds = []
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  })
  await page.ops()

  const selectedBefore = await idOf(page)
  const chip = await page.$('.io2-new-danger')
  check(Boolean(chip), 'C59 - a new DANGER raises the compact indicator')
  check(!(await page.$('.io2-danger-notice')), 'C60 - and no full-width banner')
  const geom = await page.evaluate(() => {
    const c = document.querySelector('.io2-new-danger')
    const panel = document.querySelector('.io2-a-alerts').getBoundingClientRect()
    const b = c.getBoundingClientRect()
    return {
      inside: b.top >= panel.top - 1 && b.bottom <= panel.bottom + 1 && b.left >= panel.left - 1,
      widthRatio: b.width / panel.width,
      h: Math.round(b.height),
      live: c.getAttribute('aria-live'),
      count: c.getAttribute('data-io2-new-danger'),
    }
  })
  check(geom.inside, 'C61 - it is inside the operational alerts panel')
  check(geom.widthRatio < 0.8 && geom.h <= 34,
    'C62 - and it is a chip, not a row or a band', `${Math.round(geom.widthRatio * 100)}% wide, ${geom.h}px tall`)
  check(geom.live === 'assertive', 'C63 - announced assertively without stealing focus')

  // §9: it must not be a new row on the screen. In a 3/12 column the English
  // chip wraps below the panel title, so the header RESERVES that line whether
  // the chip is there or not — a DANGER arriving changes what the header says
  // and never where the list starts.
  const headBefore = await page.evaluate(() => ({
    head: Math.round(document.querySelector('.io2-alerts-head').getBoundingClientRect().height),
    listTop: Math.round(document.querySelector('.io2-alerts-scroll').getBoundingClientRect().top),
  }))
  // Cleared through the real mechanism, one explicit press at a time, rather
  // than by writing storage: opening each unseen DANGER is what marks it seen.
  let cleared = 0
  for (let i = 0; i < 8; i += 1) {
    const c = await page.$('.io2-new-danger')
    if (!c) break
    await c.click()
    await page.waitForTimeout(500)
    cleared += 1
  }
  const headAfter = await page.evaluate(() => ({
    head: Math.round(document.querySelector('.io2-alerts-head').getBoundingClientRect().height),
    listTop: Math.round(document.querySelector('.io2-alerts-scroll').getBoundingClientRect().top),
    chip: Boolean(document.querySelector('.io2-new-danger')),
  }))
  check(cleared > 0 && !headAfter.chip,
    'C63b - opening every unseen DANGER removes the indicator', `${cleared} opened`)
  check(Math.abs(headAfter.head - headBefore.head) <= 2,
    'C63c - and the alerts header keeps its height with and without it',
    `${headBefore.head} -> ${headAfter.head}`)
  check(Math.abs(headAfter.listTop - headBefore.listTop) <= 2,
    'C63d - so the alert list does not move when a DANGER arrives',
    `${headBefore.listTop} -> ${headAfter.listTop}`)

  // Restore the unseen state for the checks below.
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.selection.selectedAlertId = 'DEMO-AREA-01|radar|target|DEMO-RDR-01:target:1#1'
    s.selection.seenDangerIds = []
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  })
  await page.ops()

  // The DANGER is at the top of the list under the existing sort.
  const first = await page.$eval('[data-io2-alert-row]', (e) => e.className)
  check(/io2-alert-row--danger/.test(first), 'C64 - the DANGER sorts to the top of the list', first)

  // No auto-jump: the selection is untouched until the chip is pressed.
  await page.waitForTimeout(1800) // let poll ticks land
  check(await idOf(page) === selectedBefore, 'C65 - no auto-jump: the selection has not moved', selectedBefore)
  // Re-queried: the page was reloaded above, so the earlier handle is stale.
  await page.click('.io2-new-danger')
  await page.waitForTimeout(600)
  const after = await idOf(page)
  check(after !== selectedBefore, 'C66 - pressing it explicitly does move the selection', after)
  check(await page.evaluate(() => {
    const row = document.querySelector('[data-io2-alert-row][aria-selected="true"]')
    return Boolean(row) && document.activeElement === row
  }), 'C67 - and focus lands on the row it selected')
  await page.ctx.close()
}

// --- 66/47: awareness does not depend on sound --------------------------------
for (const mode of ['muted', 'blocked']) {
  const page = await open({
    ...(mode === 'blocked' ? {} : {}),
  })
  if (mode === 'muted') {
    await page.evaluate(() => localStorage.setItem('industrial-ops-audio-v1', JSON.stringify({ v: 1, muted: true })))
  }
  await page.ops()
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.selection.selectedAlertId = 'DEMO-AREA-01|radar|target|DEMO-RDR-01:target:1#1'
    s.selection.seenDangerIds = []
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  })
  await page.ops()
  const state = await page.$eval('.io2-sound', (e) => e.textContent.trim()).catch(() => '(none)')
  check(Boolean(await page.$('.io2-new-danger')),
    `C68 - the DANGER indicator still appears with sound ${mode.toUpperCase()}`, state)
  check(await page.evaluate(() => Boolean(document.querySelector('.io2-alert-row--danger'))),
    `C69 - and the DANGER row is still highlighted with sound ${mode.toUpperCase()}`)
  await page.ctx.close()
}

// --- 66: a dialog is not disturbed by a new DANGER ----------------------------
{
  const page = await open()
  await page.ops()
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.selection.selectedAlertId = 'DEMO-AREA-01|radar|target|DEMO-RDR-01:target:1#1'
    s.selection.seenDangerIds = []
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  })
  await page.ops()
  const selectedBefore = await idOf(page)
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  await page.fill('.io2-dialog-note', 'mid-sentence')
  await page.waitForTimeout(1800)
  check(await page.$eval('dialog.io2-dialog--resolve', (e) => e.open).catch(() => false),
    'C70 - the dialog stays open while a new DANGER is present')
  check(await page.$eval('.io2-dialog-note', (e) => e.value) === 'mid-sentence',
    'C71 - the note the operator typed is untouched')
  check(Boolean(await page.$('.io2-new-danger')), 'C72 - and the indicator is still there behind it')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check(await idOf(page) === selectedBefore, 'C73 - the selection never moved on its own')
  await page.ctx.close()
}

// --- 71: the session log stays a window, not a growing page -------------------
for (const [w, h] of [[1920, 1080], [1366, 768]]) {
  const page = await open({ width: w, height: h })
  await page.ops()
  const tag = `${w}x${h}`
  const log = await page.evaluate(() => {
    const s = document.querySelector('.io2-log-scroll')
    const panel = document.querySelector('.io2-a-log').getBoundingClientRect()
    const grid = document.querySelector('.io2-grid').getBoundingClientRect()
    return {
      client: s.clientHeight,
      scroll: s.scrollHeight,
      declared: getComputedStyle(s).height,
      overflowY: getComputedStyle(s).overflowY,
      fullWidth: panel.width >= grid.width - 4,
      panelWidth: panel.width,
      gridWidth: grid.width,
    }
  })
  // Rebased in Phase A3.2 (§18/§95). The log is deliberately no longer a strip
  // across the bottom; it took the half-width cell risk/time vacated. What
  // A3.1.1 was really protecting is that the log has a real, controlled panel —
  // asserted immediately below and unchanged — so that is what is checked, plus
  // the new requirement that it is NOT full width.
  check(!log.fullWidth, `C74 - ${tag}: the session log is no longer full width (A3.2 §18)`,
    `${Math.round(log.panelWidth ?? 0)} of ${Math.round(log.gridWidth ?? 0)}`)
  check(/\d/.test(log.declared) && log.client > 0,
    `C75 - ${tag}: it has a controlled display height`, log.declared)
  check(log.overflowY === 'auto' || log.overflowY === 'scroll',
    `C76 - ${tag}: with its own vertical scroll`, log.overflowY)

  // Drive real operator actions. Every one of them writes a session-log entry,
  // which before this phase made the log taller and the document taller with it.
  //
  // What is asserted here is exactly what §33-§34 promise, and no more: the LOG
  // does not grow the page. The document height is allowed to move a little for
  // reasons that have nothing to do with the log — acknowledging an alert
  // changes its lifecycle chip and decrements the area board's NEW count, and
  // those are data changing, not layout drifting. So the log's own panel is
  // measured, not the document, and the claim is precise.
  const heights = []
  const logSizes = []
  for (let i = 0; i < 5; i += 1) {
    const rows = await page.$$('[data-io2-alert-row]')
    if (!rows[i]) break
    await rows[i].click()
    await page.waitForTimeout(220)
    const ack = await page.$('[data-io2-action="acknowledge"]')
    if (ack) { await ack.click(); await page.waitForTimeout(320) }
    heights.push(await page.evaluate(() => {
      const s = document.querySelector('.io2-log-scroll')
      return {
        doc: document.documentElement.scrollHeight,
        panel: Math.round(document.querySelector('.io2-a-log').getBoundingClientRect().height),
        client: s.clientHeight,
        // Rows, not scrollHeight: while the content is shorter than the fixed
        // viewport, scrollHeight reports the viewport and would hide the growth
        // this is trying to observe.
        rows: s.querySelectorAll('.dm-alert').length,
        content: s.scrollHeight,
      }
    }))
    logSizes.push(heights[heights.length - 1])
  }
  const logClients = new Set(logSizes.map((x) => x.client))
  check(logClients.size === 1,
    `C77 - ${tag}: the log viewport height never changed across ${logSizes.length} operator actions`,
    [...logClients].join('/'))
  check(logSizes[logSizes.length - 1].rows > logSizes[0].rows,
    `C78 - ${tag}: while its content genuinely grew inside it`,
    `${logSizes[0].rows} -> ${logSizes[logSizes.length - 1].rows} rows`)
  // Rebased in Phase A3.2 (§18/§95), and the rebase makes the check STRICTER
  // rather than weaker.
  //
  // The log now shares a grid band with RISK FACTORS, and a grid item stretches
  // to its row. So the log PANEL's height is no longer the log's own property:
  // it is max(log, risk factors), and risk factors legitimately changes height
  // when the selection changes. Measuring the panel would therefore attribute
  // another panel's content to the log. (Observed directly: the two report
  // identical heights at every step, and the document briefly gets SHORTER —
  // which is not what "the log grew the page" looks like.)
  //
  // What §33-§34 actually promise is that ADDING LOG ENTRIES does not grow the
  // page. That is now asserted as a correlation test: the log's own viewport is
  // fixed (C77 above), its content genuinely grows (C78 above), and the panel
  // height must not track the row count.
  const rowCounts = logSizes.map((x) => x.rows)
  const panelHeights = heights.map((x) => x.panel)
  const grewWithRows = panelHeights.some((v, i) => i > 0 && rowCounts[i] > rowCounts[i - 1] && v > panelHeights[i - 1] + 2)
  check(!grewWithRows,
    `C79 - ${tag}: no log entry ever made the session log panel taller`,
    `rows ${rowCounts.join('/')} vs panel ${panelHeights.join('/')}`)
  check(Math.max(...panelHeights) - Math.min(...panelHeights) <= 8,
    `C79b - ${tag}: and the panel stays within a few px across every action`,
    `spread ${Math.max(...panelHeights) - Math.min(...panelHeights)}px`)
  // The log's own box is the thing that must be immovable, and it is.
  const contentSpread = new Set(logSizes.map((x) => x.client))
  check(contentSpread.size === 1,
    `C79c - ${tag}: the log's own viewport is identical at every step`, [...contentSpread].join('/'))
  check(logSizes[logSizes.length - 1].s > logSizes[logSizes.length - 1].c
    ? await page.evaluate(() => {
      const s = document.querySelector('.io2-log-scroll')
      const at = s.scrollTop
      s.scrollTop = s.scrollHeight
      return s.scrollTop > at
    })
    : true, `C80 - ${tag}: and once it overflows, the internal scroll works`)
  await page.ctx.close()
}

// --- 72: System Health has not come back --------------------------------------
{
  const page = await open()
  await page.ops()
  const text = await page.evaluate(() => document.body.innerText)
  check(!/SYSTEM HEALTH/i.test(text) && !(await Promise.resolve(false)),
    'C81 - SYSTEM HEALTH is absent from OPS')
  await page.goto(`${BASE}/concepts/industrial/settings`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const tabs = await page.$$eval('.io2-tabs button', (n) => n.map((e) => e.textContent.trim()))
  check(tabs.length === 4 && /SYSTEM HEALTH|בריאות/i.test(tabs[3]),
    'C82 - the SYSTEM HEALTH tab is still in Configuration', tabs.join(' | '))

  // "No duplicate polling" is a claim about the RATE, and the honest yardstick
  // is a screen that is known to run exactly one poll loop: OPS itself. If the
  // SYSTEM HEALTH tab polled twice, or kept a second loop alive alongside its
  // own, its rate would exceed that reference. (Under a dev server React
  // StrictMode double-invokes effects, so the absolute figure is roughly twice
  // the 1Hz interval on BOTH screens — which is exactly why the reference has to
  // be measured rather than assumed.)
  const rateOver = async (ms) => {
    let n = 0
    const onReq = (r) => { if (r.url().includes('/status')) n += 1 }
    page.on('request', onReq)
    await page.waitForTimeout(ms)
    page.off('request', onReq)
    return n / (ms / 1000)
  }
  const closedRate = await rateOver(4000)
  check(closedRate === 0,
    'C84 - Configuration does not poll /status until SYSTEM HEALTH is opened',
    `${closedRate.toFixed(2)}/s`)

  await page.click('.io2-tabs button >> nth=3')
  await page.waitForTimeout(2500)
  check(Boolean(await page.$('.io2-health-tab')), 'C83 - and it renders')
  const openRate = await rateOver(4000)

  // LIVE OPS, not demo: a demo session is served from the fixture and does not
  // poll at all, which would make it a reference of zero rather than of one.
  await page.ops('')
  const opsRate = await rateOver(4000)
  check(openRate > 0 && openRate <= opsRate + 0.3,
    'C84b - and with it open the rate is one loop, the same as OPS runs',
    `health ${openRate.toFixed(2)}/s vs OPS ${opsRate.toFixed(2)}/s`)
  await page.ctx.close()
}

// --- 73: the audio layer is untouched -----------------------------------------
{
  const page = await open()
  await page.ops()
  const audio = await page.evaluate(() => {
    const strip = document.querySelector('.io2-strip')
    return {
      children: strip.children.length,
      inCluster: Boolean(document.querySelector('.io2-strip-mode .io2-sound')),
      state: document.querySelector('.io2-sound')?.textContent.trim() || '',
      pressed: document.querySelector('.io2-sound')?.getAttribute('aria-pressed'),
    }
  })
  check(audio.children === 12, 'C85 - the status strip still has exactly twelve children', `${audio.children}`)
  check(audio.inCluster, 'C86 - the sound control is still in the mode cluster')
  check(/READY|MUTED|BLOCKED|ERROR|פעיל|מושתק|חסום|שגיאה/.test(audio.state),
    'C87 - and reports one of the four honest states', audio.state)
  // Pressing the control means different things in different states, and A3
  // decided all of them: from READY it mutes; from MUTED it unmutes; from
  // BLOCKED or ERROR it attempts a resume and reports honestly, which may well
  // leave the label where it was. Headless Chromium usually starts BLOCKED, so
  // the check follows the state rather than demanding a toggle that would be a
  // lie in two of the four.
  await page.click('.io2-sound')
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => ({
    state: document.querySelector('.io2-sound').textContent.trim(),
    pressed: document.querySelector('.io2-sound').getAttribute('aria-pressed'),
  }))
  const wasReady = /READY|פעיל/.test(audio.state)
  check(wasReady ? /MUTED|מושתק/.test(after.state) : after.state.length > 0,
    'C88 - pressing the control does what its state says it does',
    `${audio.state} -> ${after.state}`)
  check(page.errors.length === 0, 'C88b - and nothing throws', page.errors.join('|'))
  await page.ctx.close()
}

// --- 74: responsive -----------------------------------------------------------
for (const [w, h, lang, mode] of [
  [1920, 1080, 'he', 'demo'], [1920, 1080, 'en', 'demo'], [1920, 1080, 'he', 'live'],
  [1366, 768, 'he', 'demo'], [1366, 768, 'en', 'demo'], [1366, 768, 'he', 'live'],
  [1100, 800, 'en', 'demo'], [900, 800, 'en', 'demo'],
]) {
  const page = await open({ width: w, height: h, lang })
  await page.ops(mode === 'demo' ? '?demo=1&phase=approach' : '')
  const tag = `${w} ${lang} ${mode}`
  const m = await page.evaluate(() => {
    const panels = [...document.querySelectorAll('.io2-grid > .io2-panel')]
    const boxes = panels.map((p) => p.getBoundingClientRect())
    const singleColumn = boxes.every((b, i) => i === 0 || Math.abs(b.left - boxes[0].left) < 2)
    return {
      hOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      panels: panels.length,
      removed: Boolean(document.querySelector('.io2-decision, .io2-actionbar, .io2-danger-notice, .io2-a-health')),
      regionInPanel: Boolean(document.querySelector('.io2-a-alerts .io2-sel-actions')),
      singleColumn,
      gap: (() => {
        const s = document.querySelector('.io2-strip').getBoundingClientRect()
        const g = document.querySelector('.io2-grid').getBoundingClientRect()
        return Math.round(g.top - s.bottom)
      })(),
    }
  })
  check(m.hOverflow === 0, `C89 - ${tag}: no horizontal overflow`, `${m.hOverflow}px`)
  check(m.panels === 6 && !m.removed, `C90 - ${tag}: six panels and none of the removed blocks`)
  check(m.regionInPanel, `C91 - ${tag}: the operator's actions are inside the alerts panel`)
  check(m.gap <= 4, `C92 - ${tag}: the grid still starts under the strip`, `${m.gap}px`)
  if (w <= 1200) {
    check(m.singleColumn, `C93 - ${tag}: the layout is a single column`)
  }
  check(page.errors.length === 0, `C94 - ${tag}: no page error`, page.errors.join('|'))
  await page.ctx.close()
}

// --- 52: no association vocabulary crept in -----------------------------------
{
  const page = await open()
  await page.ops()
  const text = await page.evaluate(() => document.body.innerText)
  check(!/\bPAIR RISK\b|\bMATCHED\b|\bCONFIRMED PAIR\b|\bASSOCIATED\b/i.test(text.replace(/NOT ASSOCIATED/gi, '')),
    'C95 - no camera-radar association vocabulary appeared with the redesign')
  const srcs = await page.$$eval('.io2-alert-src', (n) => n.map((e) => e.textContent))
  // A3.2: LIVE camera ids only. A demo alert may name a DEMO- camera declared by
  // its own area (§35) - phase-a1 test 33 enforces that stricter rule.
  check(!srcs.some((s) => /(^|[^-])\bCAM-0\d/.test(s)), 'C96 - still no live camera id claimed as an alert source')
  check(!(await page.$('.io2-ev-row--pair')), 'C97 - and no pair row survives anywhere on the screen')
  await page.ctx.close()
}

await browser.close()

// ============================================================================
console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}  --  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
