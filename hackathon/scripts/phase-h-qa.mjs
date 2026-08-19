// Phase H QA suite: routing/auth/switcher/lazy-chunks/responsive/original-site.
// Usage: node scripts/phase-h-qa.mjs   (backend :5000 + Vite :5174 running)
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'http://localhost:5174'
const DEMO_QS = '?demo=1&phase=approach'
const CONCEPTS = ['minimal', 'sentinel', 'industrial', 'neural', 'fusion-prime']
const ROUTES = ['dashboard', 'camera/1', 'history', 'about', 'settings', 'admin']

// Console/network noise that is EXPECTED with no hardware attached (documented):
const EXPECTED = [
  /video_feed/, // MJPEG streams abort/fail without cameras
  /net::ERR_ABORTED/,
  /favicon/,
]
const isExpected = (msg) => EXPECTED.some((re) => re.test(msg))

const results = { pass: [], fail: [] }
const ok = (name) => { results.pass.push(name); console.log(`PASS  ${name}`) }
const bad = (name, detail) => { results.fail.push(`${name} :: ${detail}`); console.log(`FAIL  ${name} :: ${detail}`) }

async function loadCredentials() {
  const raw = await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8')
  const parsed = JSON.parse(raw)
  const users = Array.isArray(parsed) ? parsed : parsed.users || []
  return users.find((u) => u.role === 'admin')
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  const failedReqs = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => failedReqs.push(`${r.failure()?.errorText} ${r.url()}`))

  const unexpected = () => [...errors.filter((e) => !isExpected(e)), ...failedReqs.filter((f) => !isExpected(f))]
  const resetLogs = () => { errors.length = 0; failedReqs.length = 0 }

  // --- 1. ProtectedRoute: logged out → /concepts redirects to /login --------
  await page.goto(`${BASE}/concepts/minimal/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  if (page.url().includes('/login')) ok('auth: /concepts redirects to /login when logged out')
  else bad('auth redirect', `landed on ${page.url()}`)

  // --- login -----------------------------------------------------------------
  const creds = await loadCredentials()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', creds.username)
  await page.fill('#password', creds.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ])
  console.log(`[login] ok as ${creds.username}`)

  // --- 2. all 30 concept routes: deep-link load (goto == refresh) ------------
  for (const c of CONCEPTS) {
    for (const r of ROUTES) {
      resetLogs()
      await page.goto(`${BASE}/concepts/${c}/${r}${DEMO_QS}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(c === 'sentinel' || (c === 'fusion-prime' && r === 'dashboard') ? 3500 : 1500)
      const u = unexpected()
      if (u.length) bad(`route /concepts/${c}/${r}`, u.join(' | '))
      else ok(`route /concepts/${c}/${r}`)
    }
  }

  // --- 3. concept switcher preserves page + query -----------------------------
  await page.goto(`${BASE}/concepts/fusion-prime/history${DEMO_QS}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.click('.cs-bar a:has-text("Sentinel 3D")')
  await page.waitForTimeout(1200)
  const su = new URL(page.url())
  if (su.pathname === '/concepts/sentinel/history' && su.search === DEMO_QS)
    ok('switcher preserves page + query params')
  else bad('switcher preserve', page.url())

  // roomId preservation on camera
  await page.goto(`${BASE}/concepts/minimal/camera/1${DEMO_QS}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  await page.click('.cs-bar a:has-text("Industrial Ops")')
  await page.waitForTimeout(1000)
  if (new URL(page.url()).pathname === '/concepts/industrial/camera/1')
    ok('switcher preserves camera roomId')
  else bad('switcher roomId', page.url())

  // --- 4. lazy 3D: Scene chunk must NOT load on non-twin pages ----------------
  for (const [route, expectScene] of [
    ['concepts/fusion-prime/settings', false],
    ['concepts/sentinel/settings', false],
    ['concepts/fusion-prime/dashboard', true],
    ['design-lab/compare', false],
  ]) {
    const sceneReqs = []
    const listener = (req) => { if (/Scene/i.test(req.url())) sceneReqs.push(req.url()) }
    page.on('request', listener)
    await page.goto(`${BASE}/${route}${route.includes('concepts') ? DEMO_QS : ''}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    page.off('request', listener)
    const loaded = sceneReqs.length > 0
    if (loaded === expectScene) ok(`3D chunk ${expectScene ? 'loads' : 'absent'} on /${route}`)
    else bad(`3D chunk on /${route}`, loaded ? sceneReqs[0] : 'Scene chunk not requested')
  }

  // --- 5. responsive sweep: no horizontal page overflow -----------------------
  const viewports = [[1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]
  const respRoutes = [
    'concepts/fusion-prime/dashboard',
    'concepts/fusion-prime/settings',
    'concepts/industrial/dashboard',
    'concepts/neural/camera/1',
    'concepts/minimal/history',
    'concepts/sentinel/dashboard',
  ]
  for (const r of respRoutes) {
    for (const [w, h] of viewports) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`${BASE}/${r}${DEMO_QS}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(r.includes('sentinel') || r.endsWith('prime/dashboard') ? 2500 : 1000)
      const overflow = await page.evaluate(() => {
        const el = document.documentElement
        return el.scrollWidth - el.clientWidth
      })
      if (overflow <= 1) ok(`no h-overflow ${r} @${w}x${h}`)
      else bad(`h-overflow ${r} @${w}x${h}`, `${overflow}px`)
    }
  }
  await page.setViewportSize({ width: 1600, height: 900 })

  // --- 6. original site unaffected --------------------------------------------
  for (const r of ['', 'rooms', 'camera/1', 'history', 'settings', 'admin', 'design-lab', 'design-lab/minimal-command']) {
    resetLogs()
    await page.goto(`${BASE}/${r}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const u = unexpected()
    if (u.length) bad(`original /${r || '(landing)'}`, u.join(' | ').slice(0, 300))
    else ok(`original /${r || '(landing)'}`)
  }

  await browser.close()
  console.log(`\n=== QA SUMMARY: ${results.pass.length} passed, ${results.fail.length} failed ===`)
  for (const f of results.fail) console.log(`  FAIL ${f}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
