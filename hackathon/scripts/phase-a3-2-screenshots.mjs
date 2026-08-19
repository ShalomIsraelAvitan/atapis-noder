// Phase A3.2 - QA screenshots (§98 OPS, §99 OPT).
//
// Every OPT shot is taken by NAVIGATING FROM OPS through the real OPTICAL
// button, not by typing a URL. §99 asks for a real transition, and a hand-built
// URL would prove the OPT screen renders a context — not that OPS produces one.
//
// Usage: node scripts/phase-a3-2-screenshots.mjs [baseUrl]

import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LIFECYCLE } from '../src/concepts/industrial-ops/alerts.js'
import { demoAlerts } from '../src/concepts/industrial-ops/demoAlerts.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'phase-a3-2')

await mkdir(OUT, { recursive: true })

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const seeded = demoAlerts(Date.now())
const browser = await chromium.launch()
const shots = []

async function open({ width = 1920, height = 1080, lang = 'en' } = {}) {
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
  page.ctx = ctx
  page.ops = async (qs = '?demo=1&phase=approach') => {
    await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
  }
  return page
}

const shot = async (page, name, sel = null) => {
  const file = path.join(OUT, `${name}.png`)
  if (sel) {
    const el = await page.$(sel)
    if (!el) { console.log(`SKIP  ${name} (no ${sel})`); return }
    await el.screenshot({ path: file })
  } else {
    await page.screenshot({ path: file, fullPage: true })
  }
  shots.push(name)
  console.log(`OK    ${name}`)
}

const select = async (page, id) => {
  await page.evaluate((i) => {
    const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(i)}"]`)
    if (row) row.click()
  }, id)
  await page.waitForTimeout(400)
}

// --- §98: full screens --------------------------------------------------------
for (const [w, h, lang, demo, name] of [
  [1920, 1080, 'he', true, 'ops-1920-he-demo'],
  [1920, 1080, 'en', true, 'ops-1920-en-demo'],
  [1920, 1080, 'en', false, 'ops-1920-live'],
  [1366, 768, 'he', true, 'ops-1366-he-demo'],
  [1366, 768, 'en', true, 'ops-1366-en-demo'],
  [1366, 768, 'en', false, 'ops-1366-live'],
]) {
  const page = await open({ width: w, height: h, lang })
  await page.ops(demo ? '?demo=1&phase=approach' : '')
  await shot(page, name)
  await page.ctx.close()
}

// --- §98: close-ups -----------------------------------------------------------
{
  const page = await open({ lang: 'en' })
  await page.ops()
  await shot(page, 'areas-three-areas', '.io2-a-areas')

  await page.fill('[data-io2-area-search]', 'gate')
  await page.waitForTimeout(250)
  await shot(page, 'areas-search-english', '.io2-a-areas')
  await page.fill('[data-io2-area-search]', '')
  await page.waitForTimeout(200)

  await shot(page, 'feed-and-risktime', '.io2-a-feed')
  await shot(page, 'risktime-under-feed', '.io2-a-timeline')
  await shot(page, 'session-log-all-areas', '.io2-a-log')

  // Many areas: forced by cloning rows in the DOM, so the scroll behaviour can
  // be photographed without inventing areas in the model.
  await page.evaluate(() => {
    const list = document.querySelector('.io2-area-list')
    if (!list) return
    const proto = list.children[0]
    for (let i = 0; i < 12; i += 1) list.appendChild(proto.cloneNode(true))
  })
  await page.waitForTimeout(200)
  await shot(page, 'areas-many-with-scroll', '.io2-a-areas')
  await page.ctx.close()
}

{
  const page = await open({ lang: 'he' })
  await page.ops()
  await page.fill('[data-io2-area-search]', 'מגדל')
  await page.waitForTimeout(250)
  await shot(page, 'areas-search-hebrew', '.io2-a-areas')
  await page.fill('[data-io2-area-search]', '')

  const search = await page.$('.io2-filter-search input[type="search"]')
  if (search) {
    await search.fill('מסלול')
    await page.waitForTimeout(300)
    await shot(page, 'alerts-search-hebrew', '.io2-a-alerts')
    await search.fill('')
    await page.waitForTimeout(200)
  }
  await page.ctx.close()
}

// --- §98: the selected-alert region in both OPTICAL states --------------------
{
  const page = await open({ lang: 'en' })
  await page.ops()
  const known = seeded.find((a) => a.cameraSourceKnown === true)
  await select(page, known.id)
  await shot(page, 'selected-alert-optical-enabled', '.io2-sel-actions')

  const radar = seeded.find((a) => a.sourceType === 'radar' && a.lifecycle !== LIFECYCLE.RESOLVED)
  await select(page, radar.id)
  await shot(page, 'selected-alert-optical-disabled', '.io2-sel-actions')
  await page.ctx.close()
}

// --- §98: RESOLVED + NOTES, the dialog, and edit mode -------------------------
{
  const page = await open({ lang: 'en' })
  await page.ops()
  const target = seeded.find((a) => a.lifecycle === LIFECYCLE.NEW && a.active)
  await select(page, target.id)
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(500)
  await page.selectOption('.io2-dialog-select', 'handled')
  await page.fill('.io2-dialog-note', 'Patrol confirmed the area is clear. Closing the workflow.')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(700)

  await shot(page, 'selected-alert-resolved-with-notes', '.io2-sel-actions')

  await page.click('[data-io2-secondary="notes"]')
  await page.waitForTimeout(500)
  await shot(page, 'notes-dialog', '.io2-dialog--notes')

  await page.click('[data-io2-notes-edit]')
  await page.waitForTimeout(300)
  await page.fill('[data-io2-notes-textarea]', 'Patrol confirmed the area is clear. Corrected: second sweep at 04:12.')
  await shot(page, 'notes-dialog-edit-mode', '.io2-dialog--notes')
  await page.click('[data-io2-confirm="save-note"]')
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // The note edit lands in the log, under the area it was performed in.
  await shot(page, 'session-log-with-note-edit', '.io2-a-log')
  await page.click('.io2-log-modes button:last-child')
  await page.waitForTimeout(400)
  await shot(page, 'session-log-selected-area-history', '.io2-a-log')
  await page.ctx.close()
}

// --- §99: the OPS -> OPT transition, three cases ------------------------------
// Case 1 & 3 are the same navigation: the only camera-known alerts in this
// project are demo ones (live never knows its camera), so a real transition is
// necessarily a demo transition — and it must stay marked as one.
{
  const page = await open({ lang: 'en' })
  await page.ops()
  const known = seeded.find((a) => a.cameraSourceKnown === true)
  await select(page, known.id)
  await shot(page, 'opt-case1-ops-before-click', '.io2-sel-actions')

  await page.click('[data-io2-secondary="optical"]')
  await page.waitForTimeout(2200)
  await shot(page, 'opt-case1-camera-known-full')
  await shot(page, 'opt-case1-context-band', '[data-io2-optctx="resolved"]')
  await shot(page, 'opt-case1-not-associated', '[data-io2-not-associated]')
  console.log(`      URL: ${page.url()}`)
  await page.ctx.close()
}

// Case 2: camera-known, no radar available for the area. DEMO-AREA-01's alert
// is used with the radar context reported honestly by the panel itself.
{
  const page = await open({ lang: 'he' })
  await page.ops()
  const gateCam = seeded.find((a) => a.sourceId === 'DEMO-CAM-01')
  if (gateCam) {
    await select(page, gateCam.id)
    await page.click('[data-io2-secondary="optical"]')
    await page.waitForTimeout(2200)
    await shot(page, 'opt-case2-radar-honesty-he')
    await shot(page, 'opt-case2-context-band-he', '[data-io2-optctx="resolved"]')
  }
  await page.ctx.close()
}

// Case 3: the demo marking survives the transition and a refresh.
{
  const page = await open({ lang: 'en' })
  await page.ops()
  const known = seeded.find((a) => a.cameraSourceKnown === true)
  await select(page, known.id)
  await page.click('[data-io2-secondary="optical"]')
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await shot(page, 'opt-case3-demo-marked-after-refresh')

  // And a context that cannot be resolved.
  await page.goto(page.url().replace(/cameraId=[^&]*/, 'cameraId=DEMO-CAM-99'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await shot(page, 'opt-context-unavailable', '[data-io2-optctx="unavailable"]')
  await page.ctx.close()
}

await browser.close()
console.log(`\n${shots.length} screenshots written to artifacts/phase-a3-2/`)
