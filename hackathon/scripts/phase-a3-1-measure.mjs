// Phase A3.1 - OPS layout measurement.
//
// Richer than the A1.1 height tool: A3.1 is a redesign, so the question is no
// longer only "how much scroll" but "did the panels that matter actually get
// bigger". Every figure below is read from the live DOM.
//
// Eight configurations: 1920 and 1366, Hebrew and English, demo and live.
// Each one gets a FRESH context — demo workflow state and the mute preference
// both persist, and a shared context would let one reading contaminate the next.
//
// Usage: node scripts/phase-a3-1-measure.mjs [label] [baseUrl]
//        writes artifacts/industrial-ops-phase-a3-1/measure-<label>.json

import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = process.argv[2] || 'before'
const BASE = process.argv[3] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a3-1')

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
  await page.evaluate(() => window.scrollTo(0, 0))

  const m = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    }
    const rowsEl = [...document.querySelectorAll('[data-io2-alert-row]')]
    const scroll = document.querySelector('.io2-alerts-scroll')
    let visible = 0
    if (scroll) {
      const top = scroll.getBoundingClientRect().top
      const bottom = top + scroll.clientHeight
      visible = rowsEl.filter((r) => {
        const b = r.getBoundingClientRect()
        return b.top >= top - 1 && b.bottom <= bottom + 1
      }).length
    }
    const firstRow = rowsEl[0]?.getBoundingClientRect()
    const feedBody = document.querySelector('.io2-vf-body')
    const gridPanels = [...document.querySelectorAll('.io2-grid > .io2-panel')]

    return {
      doc: document.documentElement.scrollHeight,
      pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
      hOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      strip: box('.io2-strip'),
      decision: box('.io2-decision'),
      actionBar: box('.io2-actionbar'),
      areas: box('.io2-a-areas'),
      feedPanel: box('.io2-a-feed'),
      feedBody: feedBody ? { w: Math.round(feedBody.getBoundingClientRect().width), h: Math.round(feedBody.getBoundingClientRect().height) } : null,
      alerts: box('.io2-a-alerts'),
      factors: box('.io2-a-factors'),
      timeline: box('.io2-a-timeline'),
      log: box('.io2-a-log'),
      // Panels that A3.1 removes. Present in the "before" reading, absent after.
      targets: box('.io2-a-targets'),
      tracks: box('.io2-a-tracks'),
      health: box('.io2-a-health'),
      alertRowH: firstRow ? Math.round(firstRow.height) : null,
      alertRows: rowsEl.length,
      visibleAlerts: visible,
      alertsScrollH: scroll ? Math.round(scroll.getBoundingClientRect().height) : null,
      panelCount: gridPanels.length,
      panelTitles: gridPanels.map((p) => p.querySelector('.io2-panel-title')?.textContent.trim() || '?'),
      // Type sizes actually applied, so a regression is caught in computed values
      // rather than only in the stylesheet text.
      type: {
        panelTitle: getComputedStyle(document.querySelector('.io2-panel-title') || document.body).fontSize,
        alertLine1: document.querySelector('.io2-alert-line1')
          ? getComputedStyle(document.querySelector('.io2-alert-line1')).fontSize : null,
        alertLine2: document.querySelector('.io2-alert-line2')
          ? getComputedStyle(document.querySelector('.io2-alert-line2')).fontSize : null,
        areaName: document.querySelector('.io2-area-name')
          ? getComputedStyle(document.querySelector('.io2-area-name')).fontSize : null,
        logMsg: document.querySelector('.io2-log-scroll .dm-alert-msg')
          ? getComputedStyle(document.querySelector('.io2-log-scroll .dm-alert-msg')).fontSize : null,
      },
    }
  })

  rows.push({ ...cfg, ...m })
  const f = (b) => (b ? `${b.w}x${b.h}` : '—')
  console.log(
    `${cfg.name.padEnd(14)} scroll=${String(m.pageScroll).padStart(5)} doc=${String(m.doc).padStart(5)} ` +
    `feed=${f(m.feedPanel).padEnd(9)} areas=${f(m.areas).padEnd(9)} alerts=${f(m.alerts).padEnd(9)} ` +
    `rows=${m.visibleAlerts}/${m.alertRows} rowH=${m.alertRowH} panels=${m.panelCount} bar=${m.actionBar?.h}`
  )
  await ctx.close()
}

await browser.close()
await writeFile(path.join(OUT, `measure-${LABEL}.json`), JSON.stringify(rows, null, 2), 'utf-8')
console.log(`\nwritten: artifacts/industrial-ops-phase-a3-1/measure-${LABEL}.json`)
