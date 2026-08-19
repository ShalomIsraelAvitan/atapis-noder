// Phase A1.1 - visual QA capture.
//
// Every shot records what it actually is: viewport, density, live or demo,
// page scroll and how many alert rows were visible. Nothing is staged: with no
// camera and no radar attached, the live captures show CAMERA UNAVAILABLE and
// RADAR DISCONNECTED because that is what this machine reports.
//
// Usage: node scripts/phase-a1-1-screenshots.mjs [baseUrl]

import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a1-1')
const CAM_TAB = '[data-io2-vf-tab]:not([data-io2-vf-tab="all"]):not([data-io2-vf-tab="radar"])'

const HD = { width: 1920, height: 1080 }
const LAP = { width: 1366, height: 768 }

await mkdir(path.join(OUT, 'shots'), { recursive: true })

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: HD })

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', admin.username)
await page.fill('#password', admin.password)
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
  page.click('button[type="submit"]'),
])

const manifest = []

const metrics = () => page.evaluate(() => {
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
  return {
    pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
    documentHeight: Math.round(document.documentElement.scrollHeight),
    visibleAlerts: visible,
    renderedAlerts: rows.length,
    alertsListHeight: s ? Math.round(s.clientHeight) : 0,
  }
})

const go = async ({ vp, lang, density, qs = '' }) => {
  await page.setViewportSize(vp)
  await page.evaluate(([l, d]) => {
    localStorage.setItem('atapis-concepts-lang', l)
    localStorage.setItem('atapis-concepts-density', d)
  }, [lang, density])
  await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1700)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
}

const shot = async (name, ctx) => {
  const m = await metrics()
  const file = path.join(OUT, 'shots', `${name}.png`)
  await page.screenshot({ path: file })
  const row = { shot: `${name}.png`, ...ctx, ...m }
  manifest.push(row)
  console.log(
    `  ${name.padEnd(46)} ${String(ctx.viewport).padEnd(9)} ${ctx.density.padEnd(7)} ` +
    `${ctx.mode.padEnd(4)} scroll=${String(m.pageScroll).padStart(5)}px visible=${m.visibleAlerts}`
  )
}

// ---------------------------------------------------------------- 1920 x 1080
console.log('\n1920x1080:')
for (const [lang, mode, qs] of [
  ['he', 'live', ''], ['en', 'live', ''],
  ['he', 'demo', '?demo=1&phase=approach'], ['en', 'demo', '?demo=1&phase=approach'],
]) {
  await go({ vp: HD, lang, density: 'compact', qs })
  await shot(`1920-${lang}-${mode}-compact`, { viewport: '1920x1080', lang, density: 'compact', mode })
}

await go({ vp: HD, lang: 'he', density: 'compact', qs: '?demo=1&phase=armed' })
await shot('1920-he-demo-danger', { viewport: '1920x1080', lang: 'he', density: 'compact', mode: 'demo' })

// Many alerts: the full demo fixture, unfiltered.
await go({ vp: HD, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await page.click('.io2-filter-tab >> nth=0')
await page.waitForTimeout(600)
await shot('1920-he-demo-many-alerts', { viewport: '1920x1080', lang: 'he', density: 'compact', mode: 'demo' })

// The whole top band in one frame: Areas + Alerts + Feed above the fold.
await go({ vp: HD, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await shot('1920-he-demo-areas-alerts-feed-together', { viewport: '1920x1080', lang: 'he', density: 'compact', mode: 'demo' })

// Densities, side by side in the manifest.
await go({ vp: HD, lang: 'he', density: 'comfort', qs: '?demo=1&phase=approach' })
await shot('1920-he-demo-comfort', { viewport: '1920x1080', lang: 'he', density: 'comfort', mode: 'demo' })

// New DANGER notice: seed the selection away from the DANGER alerts so they are
// genuinely unseen on load.
const seedDangerSelection = () => page.evaluate(() => {
  const raw = sessionStorage.getItem('industrial-ops-alert-state-v1')
  const state = raw ? JSON.parse(raw) : { v: 1, isDemo: true, alerts: [], selection: {}, filters: {} }
  state.v = 1
  state.isDemo = true
  state.selection = {
    selectedAlertId: 'DEMO-AREA-01|radar|target|DEMO-RDR-01:target:1#1',
    selectedAreaId: 'DEMO-AREA-01',
    lastSelectedCameraId: null,
  }
  sessionStorage.setItem('industrial-ops-alert-state-v1', JSON.stringify(state))
})

await go({ vp: HD, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await seedDangerSelection()
await go({ vp: HD, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await shot('1920-he-demo-new-danger-notice', { viewport: '1920x1080', lang: 'he', density: 'compact', mode: 'demo' })

// Live camera and radar tabs - honestly unavailable on this machine.
await go({ vp: HD, lang: 'he', density: 'compact', qs: '' })
await page.click(`${CAM_TAB} >> nth=0`)
await page.waitForTimeout(1200)
await shot('1920-he-live-camera-unavailable', { viewport: '1920x1080', lang: 'he', density: 'compact', mode: 'live' })

await page.click('[data-io2-vf-tab="radar"]')
await page.waitForTimeout(1200)
await shot('1920-he-live-radar-tab', { viewport: '1920x1080', lang: 'he', density: 'compact', mode: 'live' })

// ----------------------------------------------------------------- 1366 x 768
console.log('\n1366x768:')
for (const [lang, mode, qs] of [
  ['he', 'live', ''], ['en', 'live', ''],
  ['he', 'demo', '?demo=1&phase=approach'], ['en', 'demo', '?demo=1&phase=approach'],
]) {
  await go({ vp: LAP, lang, density: 'compact', qs })
  await shot(`1366-${lang}-${mode}-compact`, { viewport: '1366x768', lang, density: 'compact', mode })
}

await go({ vp: LAP, lang: 'he', density: 'compact', qs: '?demo=1&phase=armed' })
await shot('1366-he-demo-danger', { viewport: '1366x768', lang: 'he', density: 'compact', mode: 'demo' })

await go({ vp: LAP, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await page.click('.io2-filter-tab >> nth=0')
await page.waitForTimeout(600)
await shot('1366-he-demo-many-alerts', { viewport: '1366x768', lang: 'he', density: 'compact', mode: 'demo' })

await go({ vp: LAP, lang: 'he', density: 'comfort', qs: '?demo=1&phase=approach' })
await shot('1366-he-demo-comfort', { viewport: '1366x768', lang: 'he', density: 'comfort', mode: 'demo' })

await go({ vp: LAP, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await seedDangerSelection()
await go({ vp: LAP, lang: 'he', density: 'compact', qs: '?demo=1&phase=approach' })
await shot('1366-he-demo-new-danger-notice', { viewport: '1366x768', lang: 'he', density: 'compact', mode: 'demo' })

await go({ vp: LAP, lang: 'he', density: 'compact', qs: '' })
await page.click(`${CAM_TAB} >> nth=0`)
await page.waitForTimeout(1200)
await shot('1366-he-live-camera-unavailable', { viewport: '1366x768', lang: 'he', density: 'compact', mode: 'live' })

await page.click('[data-io2-vf-tab="radar"]')
await page.waitForTimeout(1200)
await shot('1366-he-live-radar-tab', { viewport: '1366x768', lang: 'he', density: 'compact', mode: 'live' })

await browser.close()

await writeFile(path.join(OUT, 'shots', 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`\n${manifest.length} captures -> artifacts/industrial-ops-phase-a1-1/shots/`)
