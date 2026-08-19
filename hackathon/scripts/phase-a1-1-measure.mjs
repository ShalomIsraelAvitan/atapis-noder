// Phase A1.1 - height and scroll measurement.
//
// Records the exact numbers the A1.1 brief asks for, before and after the CSS
// patch, so the report can show a real Before/After table instead of the claim
// that "scrolling went down".
//
// Definitions, stated once so both runs mean the same thing:
//   visible alerts   - rows whose box sits ENTIRELY inside the alerts scroll
//                      viewport. A row half cut off by the scroll edge is not
//                      counted as visible.
//   page scroll      - document.scrollHeight - window.innerHeight, floored at 0.
//   above the fold   - the element's bottom edge is at or above innerHeight
//                      with the page scrolled to the top.
//
// Usage: node scripts/phase-a1-1-measure.mjs [label] [baseUrl]
//        writes artifacts/industrial-ops-phase-a1-1/measure-<label>.json

import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = process.argv[2] || 'before'
const BASE = process.argv[3] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a1-1')

await mkdir(OUT, { recursive: true })

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', admin.username)
await page.fill('#password', admin.password)
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
  page.click('button[type="submit"]'),
])

const measure = () => page.evaluate(() => {
  const px = (n) => Math.round(n)
  const doc = document.documentElement
  const vh = window.innerHeight

  const scroller = document.querySelector('.io2-alerts-scroll')
  const rows = [...document.querySelectorAll('[data-io2-alert-row]')]

  let visibleRows = 0
  if (scroller) {
    const box = scroller.getBoundingClientRect()
    // client box: the padding box minus the scrollbar gutter.
    const top = box.top
    const bottom = box.top + scroller.clientHeight
    visibleRows = rows.filter((r) => {
      const rb = r.getBoundingClientRect()
      return rb.top >= top - 1 && rb.bottom <= bottom + 1
    }).length
  }

  const rect = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { top: px(b.top + window.scrollY), bottom: px(b.bottom + window.scrollY), height: px(b.height) }
  }

  const feed = document.querySelector('.io2-vf-body')
  const alertsPanel = document.querySelector('.io2-a-alerts')
  const areasPanel = document.querySelector('.io2-a-areas')
  const targetsPanel = document.querySelector('.io2-a-targets')

  const fullyAbove = (el) => {
    if (!el) return null
    const b = el.getBoundingClientRect()
    return b.bottom <= vh + 1
  }

  // Every element on the page that scrolls vertically - used to prove there is
  // no nested scrolling inside the alerts list.
  const scrollers = [...document.querySelectorAll('.io2-dashboard *')]
    .filter((el) => {
      const s = getComputedStyle(el)
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight - el.clientHeight > 2
    })
    .map((el) => el.className.toString().split(/\s+/)[0] || el.tagName.toLowerCase())

  const nestedInAlerts = scroller
    ? [...scroller.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el)
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight - el.clientHeight > 2
    }).length
    : 0

  return {
    viewport: { w: window.innerWidth, h: vh },
    documentHeight: px(doc.scrollHeight),
    pageScroll: Math.max(0, px(doc.scrollHeight - vh)),
    hOverflow: px(doc.scrollWidth - doc.clientWidth),
    alertRowsRendered: rows.length,
    visibleRows,
    rowHeights: rows.slice(0, 8).map((r) => Math.round(r.getBoundingClientRect().height)),
    alertsScrollHeight: scroller ? px(scroller.clientHeight) : null,
    alertsScrollContent: scroller ? px(scroller.scrollHeight) : null,
    alertsPanelHeight: alertsPanel ? px(alertsPanel.getBoundingClientRect().height) : null,
    feedBodyHeight: feed ? px(feed.getBoundingClientRect().height) : null,
    feedInner: rect('.io2-vf-body .dl-feed') || rect('.io2-vf-body .dm-radarplot') || rect('.io2-vf-state'),
    lowerPanelsStartAt: targetsPanel ? px(targetsPanel.getBoundingClientRect().top + window.scrollY) : null,
    areasFullyVisible: fullyAbove(areasPanel),
    alertsFullyVisible: fullyAbove(alertsPanel),
    feedFullyVisible: fullyAbove(document.querySelector('.io2-a-feed')),
    decisionFullyVisible: fullyAbove(document.querySelector('.io2-decision')),
    dangerNoticeHeight: (() => {
      const n = document.querySelector('.io2-danger-notice')
      return n ? Math.round(n.getBoundingClientRect().height) : 0
    })(),
    verticalScrollers: scrollers,
    nestedScrollersInsideAlerts: nestedInAlerts,
  }
})

const setLang = (lang) => page.evaluate((l) => localStorage.setItem('atapis-concepts-lang', l), lang)
const setDensity = (d) => page.evaluate((v) => localStorage.setItem('atapis-concepts-density', v), d)

const results = []

async function run(name, { width, height, lang, density, qs }) {
  await page.setViewportSize({ width, height })
  await setLang(lang)
  await setDensity(density)
  await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  const m = await measure()
  results.push({ name, lang, density, mode: qs.includes('demo') ? 'demo' : 'live', ...m })
  console.log(
    `${name.padEnd(34)} scroll=${String(m.pageScroll).padStart(5)}px  ` +
    `doc=${String(m.documentHeight).padStart(5)}  rows=${String(m.visibleRows).padStart(2)}/${m.alertRowsRendered}  ` +
    `alertsList=${m.alertsScrollHeight}  feed=${m.feedBodyHeight}  ` +
    `areasVis=${m.areasFullyVisible}  lower@${m.lowerPanelsStartAt}`
  )
}

// The demo fixture carries 12 alerts, so it is the case that actually exercises
// the list height. Live currently has none (no hardware), and is measured too
// because that is the state the machine is really in.
console.log(`\n=== ${LABEL} ===`)
await run('1920 he demo compact', { width: 1920, height: 1080, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await run('1920 en demo compact', { width: 1920, height: 1080, lang: 'en', density: 'compact', qs: '?demo=1&phase=approach' })
await run('1920 he demo comfort', { width: 1920, height: 1080, lang: 'he', density: 'comfort', qs: '?demo=1&phase=approach' })
await run('1920 en demo comfort', { width: 1920, height: 1080, lang: 'en', density: 'comfort', qs: '?demo=1&phase=approach' })
await run('1920 he live compact', { width: 1920, height: 1080, lang: 'he', density: 'compact', qs: '' })
await run('1920 he live comfort', { width: 1920, height: 1080, lang: 'he', density: 'comfort', qs: '' })
await run('1366 he demo compact', { width: 1366, height: 768, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await run('1366 en demo compact', { width: 1366, height: 768, lang: 'en', density: 'compact', qs: '?demo=1&phase=approach' })
await run('1366 he demo comfort', { width: 1366, height: 768, lang: 'he', density: 'comfort', qs: '?demo=1&phase=approach' })
await run('1366 en demo comfort', { width: 1366, height: 768, lang: 'en', density: 'comfort', qs: '?demo=1&phase=approach' })
await run('1366 he live compact', { width: 1366, height: 768, lang: 'he', density: 'compact', qs: '' })
await run('1366 he live comfort', { width: 1366, height: 768, lang: 'he', density: 'comfort', qs: '' })

await browser.close()

const file = path.join(OUT, `measure-${LABEL}.json`)
await writeFile(file, JSON.stringify(results, null, 2), 'utf-8')
console.log(`\nwritten: ${path.relative(root, file)}`)
