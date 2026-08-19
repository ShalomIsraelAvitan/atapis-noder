// Phase A3.2 - geometry measurements (§96/§97).
//
// Runs the same probe against any Vite instance, so the pre-A3.2 build and the
// post-A3.2 build can be measured with ONE piece of code and compared without
// the measurement itself being a variable. Point it at a different port to get
// the "before" column.
//
// Usage: node scripts/phase-a3-2-measure.mjs [baseUrl] [label]

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const LABEL = process.argv[3] || BASE

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()

async function measure({ width, height, lang, demo }) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', admin.username)
  await page.fill('#password', admin.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
  await page.evaluate((l) => {
    localStorage.setItem('atapis-concepts-lang', l)
    localStorage.setItem('atapis-concepts-density', 'compact')
  }, lang)
  await page.goto(`${BASE}/concepts/industrial/dashboard${demo ? '?demo=1&phase=approach' : ''}`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)

  const m = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { w: Math.round(b.width), h: Math.round(b.height) }
    }
    const list = document.querySelector('.io2-area-list')
    const log = document.querySelector('.io2-log-scroll')
    const rows = [...document.querySelectorAll('.io2-area-list > li')]
    // How many rows fit without scrolling: counted against the list's own
    // client box, which is the question §97 actually asks.
    let visible = 0
    if (list) {
      const top = list.getBoundingClientRect().top
      for (const li of rows) {
        const b = li.getBoundingClientRect()
        if (b.bottom - top <= list.clientHeight + 1) visible += 1
      }
    }
    const media = document.querySelector('.io2-vf-body img, .io2-vf-body svg')
    const mb = media ? media.getBoundingClientRect() : null
    return {
      areasPanel: r('.io2-a-areas'),
      areasListClientH: list ? Math.round(list.clientHeight) : null,
      areasListScrollH: list ? Math.round(list.scrollHeight) : null,
      areasRowsTotal: rows.length,
      areasRowsVisibleNoScroll: visible,
      feed: r('.io2-a-feed'),
      feedMedia: mb ? { w: Math.round(mb.width), h: Math.round(mb.height) } : null,
      riskTime: r('.io2-a-timeline'),
      alerts: r('.io2-a-alerts'),
      selectedAlertRegion: r('.io2-sel-actions'),
      sessionLogPanel: r('.io2-a-log'),
      sessionLogScroll: log ? { w: Math.round(log.clientWidth), h: Math.round(log.clientHeight) } : null,
      sessionLogScrollH: log ? Math.round(log.scrollHeight) : null,
      documentHeight: document.documentElement.scrollHeight,
      pageScroll: Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight),
      hOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    }
  })
  await ctx.close()
  return m
}

const dim = (v) => (v ? `${v.w}x${v.h}` : '—')
const out = []

for (const [width, height] of [[1920, 1080], [1366, 768]]) {
  for (const lang of ['he', 'en']) {
    for (const demo of [true, false]) {
      const m = await measure({ width, height, lang, demo })
      out.push({ cfg: `${width} ${lang} ${demo ? 'Demo' : 'Live'}`, ...m })
    }
  }
}

await browser.close()

console.log(`\n### ${LABEL}\n`)
const cols = [
  ['config', (r) => r.cfg],
  ['areasPanel', (r) => dim(r.areasPanel)],
  ['listClientH', (r) => r.areasListClientH],
  ['listScrollH', (r) => r.areasListScrollH],
  ['rowsVis/total', (r) => `${r.areasRowsVisibleNoScroll}/${r.areasRowsTotal}`],
  ['feed', (r) => dim(r.feed)],
  ['media', (r) => dim(r.feedMedia)],
  ['riskTime', (r) => dim(r.riskTime)],
  ['alerts', (r) => dim(r.alerts)],
  ['selRegionH', (r) => r.selectedAlertRegion?.h],
  ['logPanel', (r) => dim(r.sessionLogPanel)],
  ['logScroll', (r) => dim(r.sessionLogScroll)],
  ['logScrollH', (r) => r.sessionLogScrollH],
  ['docH', (r) => r.documentHeight],
  ['pageScroll', (r) => r.pageScroll],
  ['hOverflow', (r) => r.hOverflow],
]
console.log(cols.map(([h]) => h).join(' | '))
console.log(cols.map(() => '---').join(' | '))
for (const r of out) console.log(cols.map(([, f]) => String(f(r) ?? '—')).join(' | '))
console.log(`\nJSON ${LABEL}`)
console.log(JSON.stringify(out))
