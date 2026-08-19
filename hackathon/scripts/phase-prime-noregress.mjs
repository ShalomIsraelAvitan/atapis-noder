// Proves the shared-file changes are inert for every concept that did not opt in.
// Each of the other four concepts must still render the legacy two-group radar
// form, with the security thresholds ungated under Operation.
// Usage: node scripts/phase-prime-noregress.mjs [baseUrl]
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5173'
const OTHERS = ['minimal', 'sentinel', 'industrial', 'neural']

async function loadCredentials() {
  const raw = await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8')
  const parsed = JSON.parse(raw)
  const users = Array.isArray(parsed) ? parsed : parsed.users || []
  return users.find((u) => u.role === 'admin')
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const creds = await loadCredentials()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', creds.username)
  await page.fill('#password', creds.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])

  let failed = 0
  const check = (ok, label, detail = '') => {
    if (!ok) failed += 1
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
  }

  for (const concept of OTHERS) {
    await page.goto(`${BASE}/concepts/${concept}/settings`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)
    const body = await page.locator('body').innerText()
    check(!/Security calibration|כיול אבטחה/.test(body),
      `${concept}/settings: no calibration group (legacy layout kept)`)
    // The legacy layout keeps the thresholds visible outside any admin block.
    const operatorFieldset = await page.locator('fieldset.dm-settings-block').first().innerText().catch(() => '')
    check(/Alert speed|מהירות התראה/.test(operatorFieldset),
      `${concept}/settings: thresholds still in the Operation fieldset`)
    check(!/wiring paths|מסלולי חיווט/.test(body),
      `${concept}/settings: no topology advisory`)
    // Legacy layout still shows raw keys to admins wherever it did before; the
    // key-hiding change must not have leaked out of the three-way layout.
    const operatorKeys = await page.locator('fieldset.dm-settings-block .dm-key').count()
    check(operatorKeys > 0,
      `${concept}/settings: legacy raw-key behaviour unchanged`, `${operatorKeys} keys`)
  }

  // Demo chrome for the other concepts must be untouched: their switcher and
  // camera feed still carry their own demo indicators.
  for (const concept of ['minimal', 'neural']) {
    await page.goto(`${BASE}/concepts/${concept}/dashboard?demo=1&phase=approach`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    const switcherBadge = await page.locator('.cs-demo').count()
    check(switcherBadge > 0, `${concept}/dashboard: switcher demo badge still present`)
  }

  // The other concepts' About pages must not gain the worked example.
  for (const concept of ['industrial', 'neural']) {
    await page.goto(`${BASE}/concepts/${concept}/about`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    const body = await page.locator('body').innerText()
    check(!/One event, end to end|אירוע אחד, מקצה לקצה/.test(body),
      `${concept}/about: no worked example`)
  }

  await browser.close()
  console.log(failed ? `\n${failed} regression(s)` : '\nno regressions')
  if (failed) process.exit(1)
}

main().catch((err) => { console.error(err); process.exit(1) })
