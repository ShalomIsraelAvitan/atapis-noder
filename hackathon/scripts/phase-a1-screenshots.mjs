// Phase A1 - visual QA capture.
//
// Nothing here fabricates a live state. With no camera and no radar attached,
// the live captures show CAMERA UNAVAILABLE and RADAR DISCONNECTED, because that
// is what the machine actually reports. DANGER is only ever captured in demo,
// where the screen is labelled DEMO throughout.
//
// Usage: node scripts/phase-a1-screenshots.mjs [baseUrl]

import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a1')
const CAM_TAB = '[data-io2-vf-tab]:not([data-io2-vf-tab="all"]):not([data-io2-vf-tab="radar"])'

const HD = { width: 1920, height: 1080 }
const LAP = { width: 1366, height: 768 }

for (const d of ['final', 'states', 'regression', 'proof']) {
  await mkdir(path.join(OUT, d), { recursive: true })
}

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: HD })

// Track every camera stream the page opens, as evidence for the one-feed rule.
const feedRequests = []
page.on('request', (r) => { if (/\/video_feed\//.test(r.url())) feedRequests.push(r.url()) })

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', admin.username)
await page.fill('#password', admin.password)
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
  page.click('button[type="submit"]'),
])

const setLang = async (lang) => {
  await page.evaluate((l) => localStorage.setItem('atapis-concepts-lang', l), lang)
}

const shot = async (dir, name, wait = 1800) => {
  await page.waitForTimeout(wait)
  const file = path.join(OUT, dir, `${name}.png`)
  await page.screenshot({ path: file })
  console.log(`  ${dir}/${name}.png`)
}

const ops = async (qs = '') => {
  await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1600)
}

// ---------------------------------------------------------------- 1920 x 1080
console.log('1920x1080:')
await page.setViewportSize(HD)

for (const [lang, tag] of [['he', 'he'], ['en', 'en']]) {
  await setLang(lang)
  await ops('')
  await shot('final', `ops-${tag}-live-1920x1080`)
  await ops('?demo=1&phase=approach')
  await shot('final', `ops-${tag}-demo-1920x1080`)
}

await setLang('he')

// Threat states - demo only, and labelled demo on screen.
for (const [phase, name] of [['idle', 'safe'], ['approach', 'alert'], ['armed', 'danger']]) {
  await ops(`?demo=1&phase=${phase}`)
  await shot('states', `ops-${name}-demo-1920x1080`)
}

// Multi-zone demo + many alerts (the demo fixture carries 12).
await ops('?demo=1&phase=approach')
await shot('states', 'ops-multizone-demo-1920x1080')
await page.selectOption('.io2-filter-field select >> nth=0', 'ALL').catch(() => {})
await page.click('.io2-filter-tab >> nth=0')
await shot('states', 'ops-many-alerts-demo-1920x1080')

// Lifecycle filters + counts.
await page.click('.io2-filter-tab >> nth=1')
await shot('states', 'ops-lifecycle-filter-new-1920x1080')
await page.click('.io2-filter-tab >> nth=4')
await shot('states', 'ops-lifecycle-filter-resolved-1920x1080')
await page.click('.io2-filter-tab >> nth=0')
await page.waitForTimeout(500)

// Search.
await page.fill('.io2-filter-search input', 'RDR')
await shot('states', 'ops-search-1920x1080', 900)

// No active alerts.
await page.fill('.io2-filter-search input', 'zzzz-no-match')
await shot('states', 'ops-no-active-alerts-1920x1080', 900)
await page.click('.io2-filter-reset')
await page.waitForTimeout(600)

// A selected camera alert (source unknown) and a selected radar alert.
{
  const rows = await page.$$('[data-io2-alert-row]')
  for (const row of rows) {
    const txt = await row.textContent()
    if (/מקור המצלמה אינו מזוהה|NOT IDENTIFIED/.test(txt)) {
      await row.click()
      await shot('states', 'ops-selected-camera-alert-unknown-source-1920x1080', 900)
      break
    }
  }
  for (const row of rows) {
    const txt = await row.textContent()
    if (/DEMO-RDR-/.test(txt)) {
      await row.click()
      await shot('states', 'ops-selected-radar-alert-1920x1080', 900)
      break
    }
  }
}

// Keyboard focus, visibly distinct from selection.
await page.focus('[data-io2-alert-row]')
await page.keyboard.press('ArrowDown')
await shot('states', 'ops-keyboard-focus-1920x1080', 700)

// New DANGER notice: seed the selection at a non-DANGER alert so the demo's
// DANGER alerts are genuinely unseen on load.
await page.evaluate(() => {
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
await ops('?demo=1&phase=approach')
await shot('states', 'ops-new-danger-notice-1920x1080')

// ALL CAMERAS and RADAR tabs - both must load zero streams.
feedRequests.length = 0
await ops('')
await page.click('[data-io2-vf-tab="all"]')
await shot('proof', 'ops-all-cameras-zero-feeds-1920x1080', 1200)
const afterAll = feedRequests.length

await page.click('[data-io2-vf-tab="radar"]')
await shot('proof', 'ops-radar-tab-zero-camera-feeds-1920x1080', 1200)
const afterRadar = feedRequests.length

// Live camera state: with no hardware this is genuinely CAMERA UNAVAILABLE.
await page.click(`${CAM_TAB} >> nth=0`)
await shot('states', 'ops-camera-unavailable-live-1920x1080', 1200)

await page.click('[data-io2-vf-tab="radar"]')
await shot('states', 'ops-radar-disconnected-live-1920x1080', 1200)

// ----------------------------------------------------------------- 1366 x 768
console.log('1366x768:')
await page.setViewportSize(LAP)

for (const [lang, tag] of [['he', 'he'], ['en', 'en']]) {
  await setLang(lang)
  await ops('')
  await shot('final', `ops-${tag}-live-1366x768`)
  await ops('?demo=1&phase=approach')
  await shot('final', `ops-${tag}-demo-1366x768`)
}

await setLang('he')
await ops('?demo=1&phase=armed')
await shot('states', 'ops-danger-demo-1366x768')

await ops('?demo=1&phase=approach')
await shot('states', 'ops-many-alerts-demo-1366x768')

await page.fill('.io2-filter-search input', 'zzzz-no-match')
await shot('states', 'ops-no-active-alerts-1366x768', 900)
await page.click('.io2-filter-reset')
await page.waitForTimeout(500)

await ops('')
await page.click(`${CAM_TAB} >> nth=0`)
await shot('states', 'ops-camera-unavailable-live-1366x768', 1200)
await page.click('[data-io2-vf-tab="radar"]')
await shot('states', 'ops-radar-tab-live-1366x768', 1200)

// ------------------------------------------------------------ regression: the
// other four concepts, which must be untouched.
console.log('regression:')
await page.setViewportSize(HD)
for (const concept of ['fusion-prime', 'minimal', 'sentinel', 'neural']) {
  await page.goto(`${BASE}/concepts/${concept}/dashboard?demo=1&phase=approach`, { waitUntil: 'domcontentloaded' })
  await shot('regression', `${concept}-regression-after-a1`, concept === 'sentinel' || concept === 'fusion-prime' ? 3500 : 2000)
}

await browser.close()

console.log('\nfeed accounting:')
console.log(`  camera streams opened while ALL CAMERAS was shown : ${afterAll}`)
console.log(`  camera streams opened while RADAR was shown       : ${afterRadar - afterAll}`)
console.log(`  total /video_feed/ requests during the tab sweep  : ${feedRequests.length}`)
