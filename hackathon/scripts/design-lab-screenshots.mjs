// Design Lab verification + screenshot suite.
// Usage:  node scripts/design-lab-screenshots.mjs
// Requires: backend on :5000, Vite dev server on :5173, playwright installed.
//
// Login policy: NO credentials are stored in this script. It performs a real
// login through the existing /login form, reading the credentials at runtime
// from the backend's own local user store (python/data/users.json).

import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shotsDir = path.join(root, 'docs', 'design-lab', 'screenshots')
const BASE = 'http://localhost:5173'

// Fair-comparison scenario for all four concepts (person detected, one radar
// target approaching, medium risk, active alert) — forced demo, frozen phase.
const DEMO_QS = '?demo=1&phase=approach'

const PAGES = [
  { file: '00-design-lab-home.png', url: `${BASE}/design-lab`, wait: 3500 },
  { file: '01-minimal-command.png', url: `${BASE}/design-lab/minimal-command${DEMO_QS}`, wait: 3500 },
  { file: '02-sentinel-3d.png', url: `${BASE}/design-lab/sentinel-3d${DEMO_QS}`, wait: 9000 },
  { file: '03-industrial-ops.png', url: `${BASE}/design-lab/industrial-ops${DEMO_QS}`, wait: 3500 },
  { file: '04-neural-fusion.png', url: `${BASE}/design-lab/neural-fusion${DEMO_QS}`, wait: 3500 },
]

const RESOLUTIONS = [
  [1920, 1080],
  [1600, 900],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
]

async function loadCredentials() {
  const raw = await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8')
  const parsed = JSON.parse(raw)
  const users = Array.isArray(parsed) ? parsed : parsed.users || []
  const user =
    users.find((u) => u.role === 'admin') ||
    users.find((u) => u.role && u.role !== 'pending')
  if (!user) throw new Error('No usable account found in python/data/users.json')
  return { username: user.username, password: user.password }
}

async function login(page) {
  const creds = await loadCredentials()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', creds.username)
  await page.fill('#password', creds.password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ])
  console.log(`[login] authenticated as ${creds.username}`)
}

function attachCollectors(page, sink) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => sink.consoleErrors.push(`pageerror: ${err.message}`))
  page.on('response', (res) => {
    const url = res.url()
    if (res.status() >= 400 && url.includes(':5000')) {
      sink.failedRequests.push(`${res.status()} ${url}`)
    }
  })
  page.on('requestfailed', (req) => {
    const url = req.url()
    // MJPEG streams abort on navigation — not a failure.
    if (url.includes('/video_feed/')) return
    if (url.includes(':5000')) sink.failedRequests.push(`FAILED ${req.failure()?.errorText} ${url}`)
  })
}

async function main() {
  await mkdir(shotsDir, { recursive: true })
  const browser = await chromium.launch()
  const report = { pages: {}, responsive: [], rtl: null, reducedMotion: null }

  // --- Pass 1: full-page screenshots at 1920x1080 + console/API collection --
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  await login(page)

  for (const spec of PAGES) {
    const sink = { consoleErrors: [], failedRequests: [] }
    attachCollectors(page, sink)
    await page.goto(spec.url, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(spec.wait)
    await page.screenshot({ path: path.join(shotsDir, spec.file), fullPage: true })
    report.pages[spec.file] = sink
    page.removeAllListeners('console')
    page.removeAllListeners('pageerror')
    page.removeAllListeners('response')
    page.removeAllListeners('requestfailed')
    console.log(`[shot] ${spec.file}  consoleErrors=${sink.consoleErrors.length} failedReq=${sink.failedRequests.length}`)
  }

  // --- Pass 2: responsive sweep (overflow + key panels visible) -------------
  for (const [width, height] of RESOLUTIONS) {
    await page.setViewportSize({ width, height })
    for (const spec of PAGES) {
      await page.goto(spec.url, { waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.waitForTimeout(spec.file.includes('sentinel') ? 4000 : 1800)
      const check = await page.evaluate(() => {
        const doc = document.documentElement
        const overflowX = doc.scrollWidth - doc.clientWidth
        const visible = (selector) => {
          const el = document.querySelector(selector)
          if (!el) return null
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        }
        return {
          overflowX,
          canScroll: doc.scrollHeight <= doc.clientHeight + 4 || window.getComputedStyle(document.body).overflowY !== 'hidden',
          radarVisible:
            visible('.mc-radar-svg') ?? visible('.io-map-svg') ?? visible('.nf-ring') ??
            visible('canvas') ?? visible('.s3-fallback-svg'),
        }
      })
      if (check.overflowX > 4 || check.canScroll === false || check.radarVisible === false) {
        report.responsive.push({ page: spec.file, width, height, ...check })
      }
    }
    console.log(`[responsive] ${width}x${height} done`)
  }

  // --- Pass 3: RTL toggle sanity --------------------------------------------
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(`${BASE}/design-lab/minimal-command${DEMO_QS}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.click('.dl-switcher-lang')
  await page.waitForTimeout(800)
  report.rtl = await page.evaluate(() => document.querySelector('.dl-root')?.getAttribute('dir'))
  await page.screenshot({ path: path.join(shotsDir, '05-minimal-command-rtl.png'), fullPage: true })
  await page.click('.dl-switcher-lang') // restore EN for future sessions
  await context.close()

  // --- Pass 4: prefers-reduced-motion smoke test -----------------------------
  const rmContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: 'reduce',
  })
  const rmPage = await rmContext.newPage()
  const rmSink = { consoleErrors: [], failedRequests: [] }
  attachCollectors(rmPage, rmSink)
  await login(rmPage)
  await rmPage.goto(`${BASE}/design-lab/sentinel-3d${DEMO_QS}`, { waitUntil: 'networkidle' }).catch(() => {})
  await rmPage.waitForTimeout(6000)
  report.reducedMotion = { consoleErrors: rmSink.consoleErrors, failedRequests: rmSink.failedRequests }
  await rmContext.close()

  await browser.close()
  console.log('=== REPORT ===')
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
