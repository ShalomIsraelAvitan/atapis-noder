// Phase A3.1.1 - visual QA capture.
//
// The phase claims two things you can only judge by looking: that the operator
// reaches AREAS | VISUAL FEED | OPERATIONAL ALERTS almost immediately, and that
// the feed is big again. So the full pages come first, at both resolutions and
// both languages, and then close-ups of the parts that moved.
//
// No hardware is faked. Live captures show CAMERA UNAVAILABLE and a
// DISCONNECTED radar because that is what this machine reports.
//
// Usage: node scripts/phase-a3-1-1-screenshots.mjs [baseUrl]

import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a3-1-1', 'shots')

await mkdir(OUT, { recursive: true })

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()
const manifest = []

async function open({ width = 1920, height = 1080, lang = 'he', density = 'compact' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
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
  page.meta = { viewport: `${width}x${height}`, lang, density }
  page.ctx = ctx
  page.ops = async (qs = '?demo=1&phase=approach') => {
    await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)
  }
  return page
}

async function shot(page, name, mode, opts = {}) {
  await page.waitForTimeout(300)
  const m = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return `${Math.round(r.width)}x${Math.round(r.height)}`
    }
    const rows = [...document.querySelectorAll('[data-io2-alert-row]')]
    const s = document.querySelector('.io2-alerts-scroll')
    let visible = 0
    if (s) {
      const top = s.getBoundingClientRect().top
      const bottom = top + s.clientHeight
      visible = rows.filter((r) => {
        const b = r.getBoundingClientRect()
        return b.top >= top - 1 && b.bottom <= bottom + 1
      }).length
    }
    const strip = document.querySelector('.io2-strip')
    const grid = document.querySelector('.io2-grid')
    return {
      areas: box('.io2-a-areas'),
      feed: box('.io2-a-feed'),
      alerts: box('.io2-a-alerts'),
      log: box('.io2-a-log'),
      selActions: box('.io2-sel-actions'),
      newDanger: box('.io2-new-danger'),
      visibleAlerts: visible || null,
      gridTop: grid && strip
        ? Math.round(grid.getBoundingClientRect().top - document.querySelector('.io2-page').getBoundingClientRect().top)
        : null,
      pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
      removed: Boolean(document.querySelector('.io2-decision, .io2-actionbar, .io2-danger-notice')),
    }
  })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: Boolean(opts.full) })
  manifest.push({ shot: `${name}.png`, ...page.meta, mode, ...m })
  console.log(`  ${name.padEnd(42)} ${page.meta.viewport} ${page.meta.lang} feed=${m.feed} ` +
    `alerts=${m.alerts} rows=${m.visibleAlerts ?? '-'} gridTop=${m.gridTop} scroll=${m.pageScroll}`)
}

async function closeUp(page, sel, name) {
  const el = await page.$(sel)
  if (!el) { console.log(`  (missing ${sel})`); return }
  await el.screenshot({ path: path.join(OUT, `${name}.png`) })
  manifest.push({ shot: `${name}.png`, ...page.meta, mode: 'close-up', selector: sel })
  console.log(`  ${name.padEnd(42)} close-up`)
}

// ------------------------------------------------------------- 81: full OPS
for (const [w, h] of [[1920, 1080], [1366, 768]]) {
  for (const lang of ['he', 'en']) {
    console.log(`\nOPS ${w}x${h} ${lang}:`)
    const page = await open({ width: w, height: h, lang })
    await page.ops()
    await shot(page, `ops-${w}-${lang}-demo`, 'demo')
    await shot(page, `ops-${w}-${lang}-demo-full`, 'demo', { full: true })
    await page.ops('')
    await shot(page, `ops-${w}-${lang}-live`, 'live')
    await shot(page, `ops-${w}-${lang}-live-full`, 'live', { full: true })
    await page.ctx.close()
  }
}

// ------------------------------------------------------------- 82: states
{
  console.log('\nLifecycle states (1920 en demo):')
  const page = await open({ lang: 'en' })
  await page.ops()
  await page.click('.io2-filter-tab >> nth=1') // NEW
  await page.waitForTimeout(500)
  await page.click('[data-io2-alert-row]')
  await page.waitForTimeout(400)
  await shot(page, 'state-new-selected', 'demo')
  await closeUp(page, '.io2-sel-actions', 'closeup-selected-actions-new')

  await page.click('[data-io2-action="acknowledge"]')
  await page.waitForTimeout(600)
  await shot(page, 'state-acknowledged-outside-filter', 'demo')
  await closeUp(page, '.io2-sel-actions', 'closeup-selected-actions-outside-filter')

  await page.click('.io2-ab-show')
  await page.waitForTimeout(500)
  await page.click('[data-io2-action="review"]')
  await page.waitForTimeout(600)
  await shot(page, 'state-in-review', 'demo')
  await closeUp(page, '.io2-sel-actions', 'closeup-selected-actions-in-review')

  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  await shot(page, 'dialog-resolve', 'demo')
  await page.selectOption('.io2-dialog-select', 'handled')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(800)
  await shot(page, 'state-resolved', 'demo')
  await closeUp(page, '.io2-sel-actions', 'closeup-selected-actions-resolved')

  await page.click('[data-io2-action="reopen"]')
  await page.waitForTimeout(600)
  await shot(page, 'dialog-reopen', 'demo')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.ctx.close()
}

// NEW DANGER, with sound available and muted.
for (const [muted, tag] of [[false, 'new-danger'], [true, 'new-danger-muted']]) {
  console.log(`\n${tag} (1920 en demo):`)
  const page = await open({ lang: 'en' })
  if (muted) {
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
  await shot(page, `state-${tag}`, 'demo')
  await closeUp(page, '.io2-alerts-head', `closeup-${tag}-indicator`)
  await closeUp(page, '.io2-strip-mode', `closeup-strip-mode-${tag}`)
  await page.ctx.close()
}

// Radar tab, camera unavailable, many alerts, a full session log.
{
  console.log('\nFeed states and session log (1920 en):')
  const page = await open({ lang: 'en' })
  await page.ops()
  await page.click('[data-io2-vf-tab="radar"]')
  await page.waitForTimeout(900)
  await shot(page, 'feed-radar-tab', 'demo')
  await closeUp(page, '.io2-a-feed', 'closeup-visual-feed-radar')

  await page.ops('')
  await page.waitForTimeout(600)
  await shot(page, 'feed-camera-unavailable-live', 'live')
  await closeUp(page, '.io2-a-feed', 'closeup-visual-feed-camera-unavailable')

  await page.ops()
  await page.click('.io2-filter-tab >> nth=0') // ALL OPEN
  await page.waitForTimeout(500)
  await shot(page, 'alerts-many', 'demo')
  await closeUp(page, '.io2-a-alerts', 'closeup-operational-alerts')

  // Fill the session log with real operator actions.
  for (let i = 0; i < 6; i += 1) {
    const rows = await page.$$('[data-io2-alert-row]')
    if (!rows[i]) break
    await rows[i].click()
    await page.waitForTimeout(200)
    const ack = await page.$('[data-io2-action="acknowledge"]')
    if (ack) { await ack.click(); await page.waitForTimeout(280) }
  }
  await shot(page, 'session-log-many-events', 'demo')
  await closeUp(page, '.io2-a-log', 'closeup-session-log')
  await page.ctx.close()
}

// ------------------------------------------------------------- 83: close-ups
{
  console.log('\nClose-ups (1920 he demo):')
  const page = await open()
  await page.ops()
  await closeUp(page, '.io2-strip', 'closeup-status-strip')
  await closeUp(page, '.io2-a-areas', 'closeup-areas')
  await closeUp(page, '.io2-a-feed', 'closeup-visual-feed')
  await closeUp(page, '.io2-a-alerts', 'closeup-operational-alerts-he')
  await page.evaluate(() => document.querySelector('.io2-a-factors').scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  await closeUp(page, '.io2-a-factors', 'closeup-risk-factors')
  await closeUp(page, '.io2-a-timeline', 'closeup-risk-time')
  await closeUp(page, '.io2-a-log', 'closeup-session-log-he')
  await page.ctx.close()
}

// Narrow layouts.
for (const [w, h] of [[1100, 900], [900, 900]]) {
  console.log(`\nNarrow ${w}:`)
  const page = await open({ width: w, height: h, lang: 'en' })
  await page.ops()
  await shot(page, `ops-${w}-en-demo-full`, 'demo', { full: true })
  await page.ctx.close()
}

await browser.close()

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`\n${manifest.length} captures -> artifacts/industrial-ops-phase-a3-1-1/shots/`)
