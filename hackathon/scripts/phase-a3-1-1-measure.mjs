// Phase A3.1.1 - OPS command-surface measurement.
//
// A3.1.1 is a subtraction: four blocks leave the screen and the top row is
// rebalanced to 3/6/3. The claims it makes are therefore all positional and
// dimensional, so this tool reads §79's list straight off the live DOM and
// records it per configuration. The two figures the phase is actually judged on
// are `gridTop` (how far down the command grid begins - §80) and `feedPanel.w`
// (the Visual Feed's width - §23).
//
// Every configuration gets a fresh browser context: demo workflow state and the
// audio preference both persist in storage, and a shared context would let one
// reading contaminate the next.
//
// An alert is selected before measuring wherever one exists, because the
// selected-action region only has a height when something is selected - and its
// height is exactly what §79 asks for.
//
// Usage: node scripts/phase-a3-1-1-measure.mjs [label] [baseUrl]
//        writes artifacts/industrial-ops-phase-a3-1-1/measure-<label>.json

import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = process.argv[2] || 'before'
const BASE = process.argv[3] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a3-1-1')

await mkdir(OUT, { recursive: true })

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const CONFIGS = []
for (const [width, height] of [[1920, 1080], [1366, 768]]) {
  for (const lang of ['he', 'en']) {
    for (const mode of ['demo', 'live']) {
      CONFIGS.push({ name: `${width} ${lang} ${mode}`, width, height, lang, mode })
    }
  }
}

const browser = await chromium.launch()
const rows = []

for (const cfg of CONFIGS) {
  const ctx = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height } })
  const page = await ctx.newPage()
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
  }, [cfg.lang])

  const qs = cfg.mode === 'demo' ? '?demo=1&phase=approach' : ''
  await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)

  // Select an alert if the deployment has one, so the selected-action region is
  // rendered at its real height rather than at its empty one.
  const firstRow = await page.$('[data-io2-alert-row]')
  if (firstRow) {
    await firstRow.click()
    await page.waitForTimeout(400)
  }
  await page.evaluate(() => window.scrollTo(0, 0))

  const m = await page.evaluate(() => {
    const el = (sel) => document.querySelector(sel)
    const box = (sel) => {
      const node = el(sel)
      if (!node) return null
      const r = node.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    }
    // Distance from the top of the OPS page to the top of an element. Read in
    // page coordinates so it does not depend on where the window is scrolled.
    const topOf = (sel) => {
      const node = el(sel)
      const page = el('.io2-page')
      if (!node || !page) return null
      return Math.round(node.getBoundingClientRect().top - page.getBoundingClientRect().top)
    }

    const rowsEl = [...document.querySelectorAll('[data-io2-alert-row]')]
    const scroll = el('.io2-alerts-scroll')
    let visible = 0
    if (scroll) {
      const top = scroll.getBoundingClientRect().top
      const bottom = top + scroll.clientHeight
      visible = rowsEl.filter((r) => {
        const b = r.getBoundingClientRect()
        return b.top >= top - 1 && b.bottom <= bottom + 1
      }).length
    }
    const selectedRow = document.querySelector('[data-io2-alert-row].is-selected')
      || document.querySelector('[data-io2-alert-row][aria-selected="true"]')
    const logScroll = el('.io2-log-scroll')
    const gridPanels = [...document.querySelectorAll('.io2-grid > .io2-panel')]

    // Widest scrollable row inside the alert list: §28 forbids a horizontal
    // scrollbar on an individual alert row.
    let worstRowOverflow = 0
    for (const r of rowsEl) {
      worstRowOverflow = Math.max(worstRowOverflow, r.scrollWidth - r.clientWidth)
      for (const child of r.querySelectorAll('*')) {
        worstRowOverflow = Math.max(worstRowOverflow, child.scrollWidth - child.clientWidth)
      }
    }

    const media = el('.io2-vf-media') || el('.io2-vf-body')

    return {
      doc: document.documentElement.scrollHeight,
      pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
      hOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),

      // §80 - where the command grid starts, and the blocks that push it down.
      stripH: box('.io2-strip')?.h ?? null,
      gridTop: topOf('.io2-grid'),
      feedTop: topOf('.io2-a-feed'),
      areasTop: topOf('.io2-a-areas'),
      alertsTop: topOf('.io2-a-alerts'),

      // Blocks A3.1.1 removes. Present in "before", absent in "after".
      decision: box('.io2-decision'),
      actionBar: box('.io2-actionbar'),
      dangerNotice: box('.io2-danger-notice'),

      // Grid panels.
      areas: box('.io2-a-areas'),
      feedPanel: box('.io2-a-feed'),
      feedBody: box('.io2-vf-body'),
      feedMedia: media ? {
        w: Math.round(media.getBoundingClientRect().width),
        h: Math.round(media.getBoundingClientRect().height),
      } : null,
      alerts: box('.io2-a-alerts'),
      factors: box('.io2-a-factors'),
      timeline: box('.io2-a-timeline'),
      log: box('.io2-a-log'),

      // Alerts.
      alertRowH: rowsEl[0] ? Math.round(rowsEl[0].getBoundingClientRect().height) : null,
      selectedRowH: selectedRow ? Math.round(selectedRow.getBoundingClientRect().height) : null,
      alertRows: rowsEl.length,
      visibleAlerts: visible,
      alertsScrollH: scroll ? Math.round(scroll.getBoundingClientRect().height) : null,
      worstRowOverflow,

      // §79 - selected-action region, wherever it is rendered.
      selectedActions: box('.io2-sel-actions'),

      // §33/§34 - session log stability.
      logScrollH: logScroll ? logScroll.scrollHeight : null,
      logClientH: logScroll ? logScroll.clientHeight : null,
      logMaxH: logScroll ? getComputedStyle(logScroll).maxHeight : null,

      panelCount: gridPanels.length,
      panelTitles: gridPanels.map((p) => p.querySelector('.io2-panel-title')?.textContent.trim() || '?'),

      // Computed type, so a font regression shows up in applied values rather
      // than only in the stylesheet text (§59).
      type: {
        panelTitle: getComputedStyle(el('.io2-panel-title') || document.body).fontSize,
        alertLine1: el('.io2-alert-line1') ? getComputedStyle(el('.io2-alert-line1')).fontSize : null,
        alertLine2: el('.io2-alert-line2') ? getComputedStyle(el('.io2-alert-line2')).fontSize : null,
        areaName: el('.io2-area-name') ? getComputedStyle(el('.io2-area-name')).fontSize : null,
        logMsg: el('.io2-log-scroll .dm-alert-msg')
          ? getComputedStyle(el('.io2-log-scroll .dm-alert-msg')).fontSize : null,
      },
    }
  })

  rows.push({ ...cfg, ...m })
  const f = (b) => (b ? `${b.w}x${b.h}` : '—')
  console.log(
    `${cfg.name.padEnd(14)} gridTop=${String(m.gridTop).padStart(4)} scroll=${String(m.pageScroll).padStart(5)} ` +
    `feed=${f(m.feedPanel).padEnd(9)} areas=${f(m.areas).padEnd(9)} alerts=${f(m.alerts).padEnd(9)} ` +
    `rows=${m.visibleAlerts}/${m.alertRows} log=${m.logClientH}/${m.logScrollH} panels=${m.panelCount}`
  )
  await ctx.close()
}

await browser.close()
await writeFile(path.join(OUT, `measure-${LABEL}.json`), JSON.stringify(rows, null, 2), 'utf-8')
console.log(`\nwritten: artifacts/industrial-ops-phase-a3-1-1/measure-${LABEL}.json`)
