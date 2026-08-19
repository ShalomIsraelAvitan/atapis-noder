// Phase D review-gate screenshots: 4 base concepts x 6 pages, all under the
// same frozen, clearly-labeled demo scenario (?demo=1&phase=approach) so the
// structural comparison is fair. Also collects console/page errors per route.
// Usage: node scripts/phase-d-screenshots.mjs [baseUrl]
import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outRoot = path.join(root, 'docs', 'full-site-concepts', 'screenshots')
const BASE = process.argv[2] || 'http://localhost:5174'
const DEMO_QS = '?demo=1&phase=approach'

const CONCEPTS = ['minimal', 'sentinel', 'industrial', 'neural', 'fusion-prime']
const PAGES = [
  ['dashboard', 'dashboard'],
  ['camera', 'camera/1'],
  ['history', 'history'],
  ['about', 'about'],
  ['settings', 'settings'],
  ['admin', 'admin'],
]

// 3D scene needs longer settle time.
const waitFor = (concept, page) =>
  (concept === 'sentinel' && (page === 'dashboard' || page === 'camera')) ||
  (concept === 'fusion-prime' && page === 'dashboard')
    ? 5000
    : 2200

async function loadCredentials() {
  const raw = await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8')
  const parsed = JSON.parse(raw)
  const users = Array.isArray(parsed) ? parsed : parsed.users || []
  const user = users.find((u) => u.role === 'admin')
  if (!user) throw new Error('No admin account in python/data/users.json')
  return { username: user.username, password: user.password }
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  const creds = await loadCredentials()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', creds.username)
  await page.fill('#password', creds.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ])
  console.log(`[login] ok as ${creds.username}`)

  const problems = []

  // Comparison Center home (static page — no demo QS needed, nothing polls)
  errors.length = 0
  await page.goto(`${BASE}/design-lab/compare`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await mkdir(outRoot, { recursive: true })
  await page.screenshot({ path: path.join(outRoot, 'comparison-home.png'), fullPage: true })
  if (errors.length) problems.push(`comparison-home: ${errors.join(' | ')}`)
  console.log(`shot: comparison-home${errors.length ? `  [ERRORS: ${errors.length}]` : ''}`)

  for (const concept of CONCEPTS) {
    const dir = path.join(outRoot, concept)
    await mkdir(dir, { recursive: true })
    for (const [file, route] of PAGES) {
      errors.length = 0
      await page.goto(`${BASE}/concepts/${concept}/${route}${DEMO_QS}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(waitFor(concept, file))
      await page.screenshot({ path: path.join(dir, `${file}.png`) })
      const label = `${concept}/${file}`
      if (errors.length) {
        problems.push(`${label}: ${errors.join(' | ')}`)
        console.log(`shot: ${label}  [ERRORS: ${errors.length}]`)
      } else {
        console.log(`shot: ${label}`)
      }
    }
  }

  await browser.close()
  console.log('\n=== console/page errors summary ===')
  console.log(problems.length ? problems.join('\n') : 'none')
}

main().catch((err) => { console.error(err); process.exit(1) })
