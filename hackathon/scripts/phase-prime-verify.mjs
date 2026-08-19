// Phase 1 (Fusion Prime) verification.
//
// Two jobs:
//   1. Screenshot matrix — 6 pages x 2 resolutions x 2 densities x 2 modes = 48.
//   2. Honesty assertions — proves the live UI never claims a camera<->radar
//      association the backend does not compute.
//
// The honesty checks do NOT rely on live hardware or on whatever the poll
// happens to return: /status and /api/radar/live are intercepted and served a
// fixed payload, so "one camera track + one radar target" (which must produce a
// CP-nn Unverified pair) and "nothing present" (which must produce an empty
// state) are both reproducible without ?demo=1.
//
// Usage: node scripts/phase-prime-verify.mjs [baseUrl]
import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outRoot = path.join(root, 'docs', 'full-site-concepts', 'screenshots', 'phase-prime-1-1')
const BASE = process.argv[2] || 'http://localhost:5173'
const CONCEPT = 'fusion-prime'

const PAGES = [
  ['command', 'dashboard'],
  ['optics', 'camera/1'],
  ['investigation', 'history'],
  ['system', 'about'],
  ['settings', 'settings'],
  ['access', 'admin'],
]

// The focused Phase 1.1 review set: 12 shots, not the full matrix.
const SHOTS = [
  ['command', 'dashboard', '1920x1080', 1920, 1080, 'comfort', 'live'],
  ['investigation', 'history', '1920x1080', 1920, 1080, 'comfort', 'live'],
  ['system', 'about', '1920x1080', 1920, 1080, 'comfort', 'live'],
  ['settings', 'settings', '1920x1080', 1920, 1080, 'comfort', 'live'],
  ['access', 'admin', '1920x1080', 1920, 1080, 'comfort', 'live'],
  ['command', 'dashboard', '1366x768', 1366, 768, 'comfort', 'live'],
  ['investigation', 'history', '1366x768', 1366, 768, 'comfort', 'live'],
  ['settings', 'settings', '1366x768', 1366, 768, 'comfort', 'live'],
  ['command', 'dashboard', '1366x768', 1366, 768, 'compact', 'live'],
  ['investigation', 'history', '1366x768', 1366, 768, 'compact', 'live'],
  ['command', 'dashboard', '1920x1080', 1920, 1080, 'comfort', 'demo'],
  ['optics', 'camera/1', '1920x1080', 1920, 1080, 'comfort', 'demo'],
]

// Pages that host a ContactPairCard. Only these may assert on CP-/FC- ids.
const PAIR_PAGES = ['dashboard', 'camera/1']

const settle = (route) => (route === 'dashboard' ? 4500 : 2000)

// --- deterministic fixtures ---------------------------------------------------
const pairFixtureStatus = {
  mode: 'ALERT',
  fused_risk: 51,
  camera_risk: 47,
  radar_risk: 48,
  person_count: 1,
  has_weapon: false,
  motion: 'walking',
  tracks: [
    { id: 7, state: 'approaching', zone: 'gate', risk: 47, approaching_gate: true, speed: 62, has_weapon: false },
  ],
}
const pairFixtureRadar = {
  radar_connected: true,
  radar_status: 'OK',
  provider: 'ld2450',
  max_radar_risk: 48,
  last_update_ms: Date.now(),
  targets: [
    {
      id: 1, x_mm: 400, y_mm: 3900, distance_mm: 3900, angle_deg: 6,
      speed_cm_s: 96, direction: 'approaching', approaching_gate: true,
      confidence: 0.82, radar_risk: 48, valid: true,
    },
  ],
}
const quietFixtureStatus = {
  mode: 'SAFE', fused_risk: 0, camera_risk: 0, radar_risk: 0,
  person_count: 0, has_weapon: false, motion: null, tracks: [],
}
const quietFixtureRadar = {
  radar_connected: true, radar_status: 'OK', provider: 'ld2450',
  max_radar_risk: 0, last_update_ms: Date.now(), targets: [],
}

async function applyFixture(page, statusBody, radarBody) {
  await page.route('**/status', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(statusBody) }))
  await page.route('**/api/radar/live', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(radarBody) }))
}

async function clearFixture(page) {
  await page.unroute('**/status')
  await page.unroute('**/api/radar/live')
}

async function loadCredentials() {
  const raw = await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8')
  const parsed = JSON.parse(raw)
  const users = Array.isArray(parsed) ? parsed : parsed.users || []
  const user = users.find((u) => u.role === 'admin')
  if (!user) throw new Error('No admin account in python/data/users.json')
  return { username: user.username, password: user.password }
}

const results = []
const record = (ok, label, detail = '') => {
  results.push({ ok, label, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  const creds = await loadCredentials()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', creds.username)
  await page.fill('#password', creds.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])
  console.log(`[login] ok as ${creds.username}\n`)

  // ---------- 1. Honesty: LIVE with a pair-producing fixture ----------
  console.log('--- honesty: live, one camera track + one radar target ---')
  await applyFixture(page, pairFixtureStatus, pairFixtureRadar)
  for (const route of PAIR_PAGES) {
    await page.goto(`${BASE}/concepts/${CONCEPT}/${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(settle(route))
    const body = await page.locator('body').innerText()
    const hasCp = /CP-\d+/.test(body)
    const hasUnverified = /Unverified|לא מאומת/.test(body)
    record(hasCp && hasUnverified, `live/${route}: shows CP-nn marked Unverified`,
      hasCp ? (hasUnverified ? '' : 'CP id present but no Unverified label') : 'no CP- id found')
  }
  // No page in live mode may show a fused-contact id or an association percentage.
  for (const [, route] of PAGES) {
    await page.goto(`${BASE}/concepts/${CONCEPT}/${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(settle(route))
    const body = await page.locator('body').innerText()
    const fc = body.match(/FC-\d+/)
    const pct = body.match(/Association\s*\d+%|שיוך\s*\d+%/)
    record(!fc && !pct, `live/${route}: no FC-nn and no association %`,
      [fc?.[0], pct?.[0]].filter(Boolean).join(' + '))
    const link = await page.locator('.dm-rp-pairlink, [data-pair-link]').count()
    record(link === 0, `live/${route}: no camera<->radar link element`, link ? `${link} found` : '')
  }

  // ---------- 2. Honesty: LIVE with nothing present ----------
  console.log('\n--- honesty: live, quiet perimeter ---')
  await clearFixture(page)
  await applyFixture(page, quietFixtureStatus, quietFixtureRadar)
  for (const route of PAIR_PAGES) {
    await page.goto(`${BASE}/concepts/${CONCEPT}/${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(settle(route))
    const body = await page.locator('body').innerText()
    const ids = /CP-\d+|FC-\d+/.test(body)
    const empty = await page.locator('.dm-empty').count()
    record(!ids && empty > 0, `live-quiet/${route}: empty state, no pair id`,
      ids ? 'a pair id was rendered with no contacts' : (empty ? '' : 'no .dm-empty element'))
  }
  await clearFixture(page)

  // ---------- 3. Honesty: DEMO ----------
  console.log('\n--- honesty: demo mode ---')
  for (const route of PAIR_PAGES) {
    await page.goto(`${BASE}/concepts/${CONCEPT}/${route}?demo=1&phase=approach`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(settle(route))
    const body = await page.locator('body').innerText()
    const hasFc = /FC-\d+/.test(body)
    const hasPct = /\d+%/.test(body)
    record(hasFc && hasPct, `demo/${route}: shows FC-nn with association %`,
      hasFc ? (hasPct ? '' : 'no percentage') : 'no FC- id')
    // The badge must sit with the claim, not elsewhere on the page.
    const adjacent = await page.locator('.dm-cp-head .dm-demo-tag, .dm-cp-head .cs-demo').count()
    record(adjacent > 0, `demo/${route}: DemoModeBadge adjacent to the pair id`,
      adjacent ? '' : 'no badge inside .dm-cp-head')
  }

  // ---------- 4. Phase 1.1 corrections ----------
  console.log('\n--- phase 1.1 corrections ---')

  // 4a. Raw config keys must not appear outside the Engineering disclosure.
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(`${BASE}/concepts/${CONCEPT}/settings`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const keysOutsideEngineering = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('.dm-radarform .dm-key').forEach((el) => {
      if (!el.closest('details.dm-eng')) out.push(el.textContent.trim())
      else {
        const summary = el.closest('details.dm-eng')?.querySelector('summary')?.textContent || ''
        if (!/Engineering|הנדסה/.test(summary)) out.push(`${el.textContent.trim()} (in ${summary.trim()})`)
      }
    })
    return out
  })
  record(keysOutsideEngineering.length === 0,
    'settings: no raw config keys outside the Engineering block',
    keysOutsideEngineering.join(', '))

  // 4b. Exactly two demo indicators on a demo page carrying a pair claim.
  for (const route of PAIR_PAGES) {
    await page.goto(`${BASE}/concepts/${CONCEPT}/${route}?demo=1&phase=approach`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(settle(route))
    const badges = await page.locator('.dm-demo-tag, .cs-demo, .dl-feed-demo-tag').evaluateAll(
      (els) => els.filter((el) => el.offsetParent !== null || el.getClientRects().length).length)
    record(badges === 2, `demo/${route}: exactly two demo indicators visible`, `found ${badges}`)
  }

  // 4c. Nothing fixed may sit on top of page content.
  const overlapRoutes = [
    ['dashboard', 1366, 768], ['dashboard', 1920, 1080],
    ['history', 1366, 768], ['history', 1920, 1080],
    ['about', 1920, 1080], ['settings', 1366, 768],
  ]
  for (const [route, w, h] of overlapRoutes) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/concepts/${CONCEPT}/${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(settle(route))
    // Scroll to the end: with correct bottom clearance the last card must clear
    // both fixed elements there.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const covered = await page.evaluate(() => {
      const fixedTop = Math.min(
        ...['.pp-strip', '.cs-bar']
          .map((sel) => document.querySelector(sel))
          .filter(Boolean)
          .map((el) => el.getBoundingClientRect().top)
      )
      if (!Number.isFinite(fixedTop)) return []
      const hits = []
      document.querySelectorAll('.pp-page .pp-card, .pp-page .dm-arch, .pp-page .dm-filters').forEach((el) => {
        const r = el.getBoundingClientRect()
        // Only content actually on screen can be covered.
        if (r.bottom > fixedTop + 1 && r.top < fixedTop) {
          hits.push(`${el.className.split(' ')[0]} overlaps by ${Math.round(r.bottom - fixedTop)}px`)
        }
      })
      return hits
    })
    record(covered.length === 0, `${route} @${w}x${h}: no fixed element covers content`, covered.join(' | '))
  }

  // ---------- 5. Focused screenshot set (12) ----------
  console.log('\n--- screenshots (12) ---')
  await mkdir(outRoot, { recursive: true })
  const shotProblems = []
  for (const [label, route, resName, w, h, density, modeName] of SHOTS) {
    await page.setViewportSize({ width: w, height: h })
    const qs = modeName === 'demo' ? '?demo=1&phase=approach&' : '?'
    const url = `${BASE}/concepts/${CONCEPT}/${route}${qs}density=${density}`
    errors.length = 0
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(settle(route))
    const file = `${label}_${resName}_${density}_${modeName}.png`
    await page.screenshot({ path: path.join(outRoot, file) })
    if (errors.length) shotProblems.push(`${file}: ${errors.join(' | ')}`)
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 1) shotProblems.push(`${file}: horizontal overflow ${overflow}px`)
    console.log(`shot: ${file}`)
  }
  record(shotProblems.length === 0, 'screenshots: no console errors, no page overflow',
    shotProblems.join(' | '))

  // ---------- 6. Montage ----------
  await page.setViewportSize({ width: 1920, height: 1080 })
  const tiles = []
  for (const [label, route] of PAGES) {
    await page.goto(`${BASE}/concepts/${CONCEPT}/${route}?demo=1&phase=approach`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(settle(route))
    const buffer = await page.screenshot()
    tiles.push({ label, data: buffer.toString('base64') })
  }
  const montage = await context.newPage()
  await montage.setViewportSize({ width: 1960, height: 1200 })
  await montage.setContent(`
    <style>
      body { margin:0; background:#0c0c10; font-family: ui-monospace, monospace; }
      h1 { color:#c9a24b; font-size:20px; margin:18px 20px 12px; letter-spacing:.14em; }
      .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; padding:0 20px 20px; }
      figure { margin:0; }
      figcaption { color:#91919c; font-size:12px; letter-spacing:.12em; text-transform:uppercase; margin-bottom:5px; }
      img { width:100%; display:block; border:1px solid rgba(255,255,255,.12); }
    </style>
    <h1>ATAPIS — FUSION PRIME</h1>
    <div class="grid">
      ${tiles.map((t) => `<figure><figcaption>${t.label}</figcaption><img src="data:image/png;base64,${t.data}"></figure>`).join('')}
    </div>
  `)
  await montage.waitForTimeout(600)
  await montage.screenshot({ path: path.join(outRoot, 'fusion-prime-phase1-1-montage.png'), fullPage: true })
  console.log('montage -> fusion-prime-phase1-1-montage.png')

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
  if (failed.length) {
    failed.forEach((f) => console.log(`FAILED: ${f.label} ${f.detail}`))
    process.exit(1)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
