// Phase A audit: open every existing page, collect console errors + key facts.
// Login policy: credentials read at runtime from python/data/users.json (not stored).
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'http://localhost:5173'

const raw = await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8')
const parsed = JSON.parse(raw)
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const results = {}

async function visit(name, url, extra) {
  const errors = []
  const onErr = (e) => errors.push(`pageerror: ${e.message}`)
  const onCon = (m) => { if (m.type() === 'error') errors.push(m.text()) }
  page.on('pageerror', onErr)
  page.on('console', onCon)
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((e) => errors.push(`nav: ${e.message}`))
  await page.waitForTimeout(2500)
  const facts = extra ? await page.evaluate(extra).catch((e) => `evalfail: ${e.message}`) : null
  results[name] = { errors: errors.filter((e) => !e.includes('video_feed')), facts }
  page.off('pageerror', onErr)
  page.off('console', onCon)
}

await visit('landing', `${BASE}/`, () => ({
  sections: [...document.querySelectorAll('h2, .hero-title, .section-title')].map((el) => el.textContent.trim()).slice(0, 12),
}))

// login
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', admin.username)
await page.fill('#password', admin.password)
await Promise.all([page.waitForURL((u) => !u.pathname.includes('/login')), page.click('button[type="submit"]')])

await visit('rooms', `${BASE}/rooms`, () => ({
  cards: document.querySelectorAll('.room-card, [class*="room"]').length,
  text: document.body.innerText.slice(0, 400),
}))
await visit('history', `${BASE}/history`, () => ({
  statCards: [...document.querySelectorAll('[class*="stat"]')].map((el) => el.textContent.trim()).slice(0, 8),
  detectionCards: document.querySelectorAll('[class*="detection"]').length,
}))
await visit('settings', `${BASE}/settings`, () => ({
  tabs: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 12),
}))
await visit('admin', `${BASE}/admin`, () => ({
  tableRows: document.querySelectorAll('table tr').length,
  buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 14),
}))

await browser.close()
console.log(JSON.stringify(results, null, 2))
