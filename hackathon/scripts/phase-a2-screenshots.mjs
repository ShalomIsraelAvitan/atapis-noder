// Phase A2 - visual QA capture.
//
// Each scenario runs in a FRESH context: demo workflow state now persists per
// tab, so sharing one context would let an earlier capture's acknowledgements
// bleed into a later one and the screenshots would stop meaning what they say.
//
// No hardware is faked. With no camera and no radar attached the live captures
// show CAMERA UNAVAILABLE and RADAR DISCONNECTED, because that is what this
// machine reports. Every DANGER state is captured in demo, labelled DEMO.
//
// Usage: node scripts/phase-a2-screenshots.mjs [baseUrl]

import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a2', 'shots')

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
    await page.waitForTimeout(1900)
  }
  return page
}

async function shot(page, name, mode = 'demo') {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => {
    const s = document.querySelector('.io2-alerts-scroll')
    const rows = [...document.querySelectorAll('[data-io2-alert-row]')]
    let visible = 0
    if (s) {
      const top = s.getBoundingClientRect().top
      const bottom = top + s.clientHeight
      visible = rows.filter((r) => {
        const b = r.getBoundingClientRect()
        return b.top >= top - 1 && b.bottom <= bottom + 1
      }).length
    }
    const bar = document.querySelector('.io2-actionbar')
    return {
      pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
      visibleAlerts: visible,
      barHeight: bar ? Math.round(bar.getBoundingClientRect().height) : null,
      lifecycle: document.querySelector('.io2-ab-life')?.textContent.trim() || null,
    }
  })
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  manifest.push({ shot: `${name}.png`, ...page.meta, mode, ...m })
  console.log(`  ${name.padEnd(46)} ${page.meta.viewport} ${page.meta.lang} ${page.meta.density.padEnd(7)} ` +
    `scroll=${String(m.pageScroll).padStart(5)} alerts=${m.visibleAlerts} bar=${m.barHeight} ${m.lifecycle || ''}`)
}

/** Select a NEW alert so the full action set is on screen. */
async function selectNew(page) {
  await page.click('.io2-filter-tab >> nth=1')
  await page.waitForTimeout(500)
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(400)
}

// ---------------------------------------------------------------- 1920 Hebrew
console.log('\n1920x1080 Hebrew:')
{
  const page = await open()
  await page.ops()
  await selectNew(page)
  await shot(page, '1920-he-new-selected')

  await page.click('[data-io2-action="acknowledge"]')
  await page.waitForTimeout(700)
  await shot(page, '1920-he-acknowledged')
  await shot(page, '1920-he-selected-outside-filter')

  await page.click('.io2-ab-show')
  await page.waitForTimeout(500)
  await page.click('[data-io2-action="review"]')
  await page.waitForTimeout(700)
  await shot(page, '1920-he-in-review-with-owner')

  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(700)
  await shot(page, '1920-he-resolve-dialog-active-condition-warning')

  await page.selectOption('.io2-dialog-select', 'false_alarm')
  await page.fill('.io2-dialog-note', 'בדיקה חוזרת — אין איום')
  await page.waitForTimeout(300)
  await shot(page, '1920-he-resolve-dialog-filled')

  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(800)
  await shot(page, '1920-he-resolved')

  await page.click('[data-io2-action="reopen"]')
  await page.waitForTimeout(700)
  await shot(page, '1920-he-reopen-dialog')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  await shot(page, '1920-he-session-log-operator-action')

  await page.click('[data-io2-alert-row] >> nth=1', { button: 'right' })
  await page.waitForTimeout(600)
  await shot(page, '1920-he-context-menu')
  await page.keyboard.press('Escape')
  await page.ctx.close()
}

// A new DANGER arriving while the resolve dialog is open.
{
  const page = await open()
  await page.ops()
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.selection.selectedAlertId = 'DEMO-AREA-01|radar|target|DEMO-RDR-01:target:1#1'
    s.selection.selectedAreaId = 'DEMO-AREA-01'
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  })
  await page.ops()
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(700)
  await page.fill('.io2-dialog-note', 'המפעיל עדיין כותב')
  await page.waitForTimeout(1500)
  await shot(page, '1920-he-new-danger-during-resolve-dialog')
  await page.ctx.close()
}

// The critical scenario: an ACTIVE danger resolved as a false alarm.
{
  const page = await open()
  await page.ops()
  const dangerId = await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    const a = s.alerts.find((x) => x.severity === 'danger' && x.active && x.lifecycle !== 'RESOLVED')
    return a ? a.id : null
  })
  await page.evaluate((id) => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.selection.selectedAlertId = id
    s.filters.lifecycle = 'ALL'
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  }, dangerId)
  await page.ops()
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(700)
  await page.selectOption('.io2-dialog-select', 'false_alarm')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(900)
  await shot(page, '1920-he-active-danger-resolved-area-still-danger')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await shot(page, '1920-he-demo-persisted-after-reload')
  await page.ctx.close()
}

// --------------------------------------------------------------- 1920 English
console.log('\n1920x1080 English:')
{
  const page = await open({ lang: 'en' })
  await page.ops()
  await selectNew(page)
  await shot(page, '1920-en-new-selected')

  await page.click('[data-io2-action="review"]')
  await page.waitForTimeout(700)
  await shot(page, '1920-en-in-review')

  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(700)
  await shot(page, '1920-en-resolve-dialog')
  await page.selectOption('.io2-dialog-select', 'handled')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(800)
  await shot(page, '1920-en-resolved')

  await page.click('[data-io2-action="reopen"]')
  await page.waitForTimeout(700)
  await shot(page, '1920-en-reopen-dialog')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  await page.click('.io2-filter-tab >> nth=5').catch(() => {})
  await page.click('.io2-filter-tab >> nth=0')
  await page.waitForTimeout(600)
  await shot(page, '1920-en-many-alerts-with-action-bar')
  await page.ctx.close()
}

// Comfort density, so the bar is captured at its other size.
{
  const page = await open({ lang: 'en', density: 'comfort' })
  await page.ops()
  await selectNew(page)
  await shot(page, '1920-en-comfort-action-bar')
  await page.ctx.close()
}

// Live: the honest, hardware-absent state.
{
  const page = await open()
  await page.ops('')
  await shot(page, '1920-he-live-action-bar', 'live')
  await page.ctx.close()
}

// ----------------------------------------------------------------- 1366 x 768
console.log('\n1366x768:')
{
  const page = await open({ width: 1366, height: 768 })
  await page.ops()
  await selectNew(page)
  await shot(page, '1366-he-new-action-bar')

  await page.click('[data-io2-action="review"]')
  await page.waitForTimeout(700)
  await shot(page, '1366-he-in-review')

  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(700)
  await shot(page, '1366-he-resolve-dialog')
  await page.selectOption('.io2-dialog-select', 'no_threat')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(800)
  await shot(page, '1366-he-resolved')

  await page.click('.io2-ab-show').catch(() => {})
  await page.waitForTimeout(500)
  await shot(page, '1366-he-many-alerts')

  await page.click('[data-io2-alert-row] >> nth=1', { button: 'right' })
  await page.waitForTimeout(600)
  await shot(page, '1366-he-context-menu')
  await page.keyboard.press('Escape')
  await page.ctx.close()
}

{
  const page = await open({ width: 1366, height: 768, lang: 'en' })
  await page.ops()
  await selectNew(page)
  await shot(page, '1366-en-action-bar-long-state')
  await page.ctx.close()
}

// 1366, the critical scenario again at the smaller viewport.
{
  const page = await open({ width: 1366, height: 768 })
  await page.ops()
  const dangerId = await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    const a = s.alerts.find((x) => x.severity === 'danger' && x.active && x.lifecycle !== 'RESOLVED')
    return a ? a.id : null
  })
  await page.evaluate((id) => {
    const s = JSON.parse(sessionStorage.getItem('industrial-ops-alert-state-v1'))
    s.selection.selectedAlertId = id
    s.filters.lifecycle = 'ALL'
    sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(s))
  }, dangerId)
  await page.ops()
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(700)
  await page.selectOption('.io2-dialog-select', 'false_alarm')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(900)
  await shot(page, '1366-he-active-danger-resolved-lifecycle')
  await page.ctx.close()
}

await browser.close()

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`\n${manifest.length} captures -> artifacts/industrial-ops-phase-a2/shots/`)
