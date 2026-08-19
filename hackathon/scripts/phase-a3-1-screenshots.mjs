// Phase A3.1 - visual QA capture.
//
// The claim this phase makes is "bigger and clearer", so the captures are meant
// to be compared against the A3 shots rather than admired on their own: full
// pages at both resolutions and both languages, then close-ups of each panel
// that was supposed to gain from the three removals.
//
// No hardware is faked. Live captures show CAMERA UNAVAILABLE and a
// DISCONNECTED radar because that is what this machine reports.
//
// Usage: node scripts/phase-a3-1-screenshots.mjs [baseUrl]

import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a3-1', 'shots')

await mkdir(OUT, { recursive: true })

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()
const manifest = []

async function open({ width = 1920, height = 1080, lang = 'he' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
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
  }, [lang])
  page.meta = { viewport: `${width}x${height}`, lang }
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
      panels: document.querySelectorAll('.io2-grid > .io2-panel').length || null,
      areas: box('.io2-a-areas'),
      feed: box('.io2-a-feed'),
      alerts: box('.io2-a-alerts'),
      log: box('.io2-a-log'),
      visibleAlerts: visible || null,
      rowH: rows[0] ? Math.round(rows[0].getBoundingClientRect().height) : null,
      pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
    }
  })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: Boolean(opts.full) })
  manifest.push({ shot: `${name}.png`, ...page.meta, mode, ...m })
  console.log(`  ${name.padEnd(44)} ${page.meta.viewport} ${page.meta.lang} panels=${m.panels ?? '-'} ` +
    `rows=${m.visibleAlerts ?? '-'} scroll=${m.pageScroll}`)
}

async function closeUp(page, sel, name) {
  const el = await page.$(sel)
  if (!el) { console.log(`  (missing ${sel})`); return }
  await el.screenshot({ path: path.join(OUT, `${name}.png`) })
  manifest.push({ shot: `${name}.png`, ...page.meta, mode: 'close-up', selector: sel })
  console.log(`  ${name.padEnd(44)} close-up`)
}

// ------------------------------------------------------------------ OPS pages
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

// -------------------------------------------------------------- OPS close-ups
{
  console.log('\nOPS close-ups (1920 he demo):')
  const page = await open()
  await page.ops()
  await closeUp(page, '.io2-a-areas', 'closeup-areas')
  await closeUp(page, '.io2-a-feed', 'closeup-visual-feed')
  await closeUp(page, '.io2-a-alerts', 'closeup-operational-alerts')
  await closeUp(page, '.io2-decision', 'closeup-decision-evidence')
  await closeUp(page, '.io2-actionbar', 'closeup-action-bar')
  await closeUp(page, '.io2-a-log', 'closeup-session-log')
  // The analysis band, both panels together.
  await page.evaluate(() => document.querySelector('.io2-a-factors').scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  await closeUp(page, '.io2-a-factors', 'closeup-risk-factors')
  await closeUp(page, '.io2-a-timeline', 'closeup-risk-time')
  await page.ctx.close()
}

{
  console.log('\nOPS close-ups (1920 en demo):')
  const page = await open({ lang: 'en' })
  await page.ops()
  await closeUp(page, '.io2-a-alerts', 'closeup-operational-alerts-en')
  await closeUp(page, '.io2-a-areas', 'closeup-areas-en')
  await page.ctx.close()
}

// ---------------------------------------------------------------- Configuration
{
  console.log('\nConfiguration 1920 he:')
  const page = await open()
  await page.config()
  for (const [i, name] of [[0, 'radar'], [1, 'operator'], [2, 'general']]) {
    await page.click(`.io2-tabs button >> nth=${i}`)
    await page.waitForTimeout(700)
    await shot(page, `config-1920-he-${name}`, 'config')
  }
  await page.click('.io2-tabs button >> nth=3')
  await page.waitForTimeout(2500)
  await shot(page, 'config-1920-he-system-health', 'config')
  await closeUp(page, '.io2-health-tab', 'closeup-system-health-he')
  await page.ctx.close()
}

for (const [w, h, lang] of [[1920, 1080, 'en'], [1366, 768, 'he'], [1366, 768, 'en']]) {
  console.log(`\nConfiguration ${w} ${lang}:`)
  const page = await open({ width: w, height: h, lang })
  await page.config()
  await page.click('.io2-tabs button >> nth=3')
  await page.waitForTimeout(2500)
  await shot(page, `config-${w}-${lang}-system-health`, 'config')
  if (w === 1920) await closeUp(page, '.io2-health-tab', 'closeup-system-health-en')
  await page.ctx.close()
}

await browser.close()

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`\n${manifest.length} captures -> artifacts/industrial-ops-phase-a3-1/shots/`)
