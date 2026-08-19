// Phase A3 - visual QA capture.
//
// Screenshots prove placement, layout and what the control SAYS. They cannot
// prove a sound, so every capture also records the engine's cue counters into
// the manifest: an image of a READY chip next to `alertCues: 1` is evidence, an
// image on its own is not.
//
// No hardware is faked. Live captures show CAMERA UNAVAILABLE and a
// DISCONNECTED radar because that is what this machine reports; every DANGER
// state is captured in demo, where the badge says DEMO.
//
// Each scenario runs in a FRESH context: the mute preference is persisted in
// localStorage and demo workflow state in sessionStorage, so sharing one context
// would let an earlier capture's choices bleed into a later one.
//
// Usage: node scripts/phase-a3-screenshots.mjs [baseUrl]

import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const OUT = path.join(root, 'artifacts', 'industrial-ops-phase-a3', 'shots')

await mkdir(OUT, { recursive: true })

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()
const manifest = []

async function open({ width = 1920, height = 1080, lang = 'he', density = 'compact', noWebAudio = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  if (noWebAudio) {
    await ctx.addInitScript(() => {
      delete window.AudioContext
      delete window.webkitAudioContext
    })
  }
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#username', admin.username)
  await page.fill('#password', admin.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
  await page.evaluate(([l, d]) => {
    localStorage.setItem('atapis-concepts-lang', l)
    localStorage.setItem('atapis-concepts-density', d)
  }, [lang, density])
  page.meta = { viewport: `${width}x${height}`, lang, density }
  page.ctx = ctx
  page.ops = async (qs = '?demo=1&phase=approach') => {
    await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
  }
  return page
}

async function shot(page, name, mode = 'demo') {
  await page.waitForTimeout(350)
  const m = await page.evaluate(() => {
    const strip = document.querySelector('.io2-strip')
    const btn = document.querySelector('.io2-sound')
    const bar = document.querySelector('.io2-actionbar')
    return {
      soundState: btn?.dataset.io2SoundState || null,
      soundText: btn ? btn.innerText.replace(/\s+/g, ' ').trim() : null,
      ariaPressed: btn?.getAttribute('aria-pressed') ?? null,
      stripChildren: strip ? strip.children.length : null,
      barHeight: bar ? Math.round(bar.getBoundingClientRect().height) : null,
      pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
      // The part a picture cannot show.
      cues: window.__IO2_AUDIO_STATS__
        ? {
          alert: window.__IO2_AUDIO_STATS__.alertCues,
          danger: window.__IO2_AUDIO_STATS__.dangerCues,
          contexts: window.__IO2_AUDIO_STATS__.contexts,
          engine: window.__IO2_AUDIO_STATS__.engineState,
        }
        : null,
    }
  })
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  manifest.push({ shot: `${name}.png`, ...page.meta, mode, ...m })
  console.log(`  ${name.padEnd(42)} ${page.meta.viewport} ${page.meta.lang} ` +
    `${String(m.soundState).padEnd(8)} cues=${m.cues ? `${m.cues.alert}/${m.cues.danger}` : 'n/a'} ` +
    `scroll=${String(m.pageScroll).padStart(5)} children=${m.stripChildren}`)
}

/** The click is a real user gesture, which is the only thing that can unblock audio. */
async function enable(page) {
  await page.click('.io2-sound')
  await page.waitForTimeout(600)
}

// ---------------------------------------------------------------- 1920 Hebrew
console.log('\n1920x1080 Hebrew:')
{
  const page = await open()
  await page.ops()
  await shot(page, '1920-he-blocked-initial')
  await page.locator('.io2-strip-mode').screenshot({ path: path.join(OUT, '1920-he-control-closeup-blocked.png') })
  manifest.push({ shot: '1920-he-control-closeup-blocked.png', ...page.meta, mode: 'demo', note: 'mode cluster only' })

  await enable(page)
  await shot(page, '1920-he-ready')
  await page.locator('.io2-strip-mode').screenshot({ path: path.join(OUT, '1920-he-control-closeup-ready.png') })
  manifest.push({ shot: '1920-he-control-closeup-ready.png', ...page.meta, mode: 'demo', note: 'mode cluster only' })

  await page.click('.io2-sound')
  await shot(page, '1920-he-muted')
  await page.locator('.io2-strip-mode').screenshot({ path: path.join(OUT, '1920-he-control-closeup-muted.png') })
  manifest.push({ shot: '1920-he-control-closeup-muted.png', ...page.meta, mode: 'demo', note: 'mode cluster only' })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await shot(page, '1920-he-muted-persists-after-reload')
  await page.ctx.close()
}

// A DANGER-bearing demo alert selected, with a resolve dialog open, so the
// control is visible while the operator is mid-workflow.
{
  const page = await open()
  await page.ops()
  await enable(page)
  await page.click('.io2-filter-tab >> nth=1')
  await page.waitForTimeout(400)
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(300)
  await shot(page, '1920-he-alert-selected-ready')
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  await shot(page, '1920-he-resolve-dialog-with-sound-control')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.ctx.close()
}

// Live: the honest, hardware-absent state, with the control still reachable.
{
  const page = await open()
  await page.ops('')
  await shot(page, '1920-he-live-blocked', 'live')
  await enable(page)
  await shot(page, '1920-he-live-ready', 'live')
  await page.ctx.close()
}

// No Web Audio at all.
{
  const page = await open({ noWebAudio: true })
  await page.ops()
  await shot(page, '1920-he-error-no-webaudio')
  await page.locator('.io2-strip-mode').screenshot({ path: path.join(OUT, '1920-he-control-closeup-error.png') })
  manifest.push({ shot: '1920-he-control-closeup-error.png', ...page.meta, mode: 'demo', note: 'mode cluster only' })
  await page.ctx.close()
}

// --------------------------------------------------------------- 1920 English
console.log('\n1920x1080 English:')
{
  const page = await open({ lang: 'en' })
  await page.ops()
  await shot(page, '1920-en-blocked-initial')
  await enable(page)
  await shot(page, '1920-en-ready')
  await page.click('.io2-sound')
  await shot(page, '1920-en-muted')
  await page.ctx.close()
}

{
  const page = await open({ lang: 'en', noWebAudio: true })
  await page.ops()
  await shot(page, '1920-en-error-no-webaudio')
  await page.ctx.close()
}

// Comfort density, where the strip cluster has more padding to absorb.
{
  const page = await open({ lang: 'en', density: 'comfort' })
  await page.ops()
  await enable(page)
  await shot(page, '1920-en-comfort-ready')
  await page.ctx.close()
}

// ----------------------------------------------------------------- 1366 x 768
console.log('\n1366x768:')
{
  const page = await open({ width: 1366, height: 768 })
  await page.ops()
  await shot(page, '1366-he-blocked-initial')
  await enable(page)
  await shot(page, '1366-he-ready')
  await page.click('.io2-sound')
  await shot(page, '1366-he-muted')

  await page.click('.io2-sound')
  await page.waitForTimeout(400)
  await page.click('.io2-filter-tab >> nth=1')
  await page.waitForTimeout(400)
  await page.click('[data-io2-alert-row] >> nth=0')
  await page.waitForTimeout(300)
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(600)
  await shot(page, '1366-he-resolve-dialog-with-sound-control')
  await page.keyboard.press('Escape')
  await page.ctx.close()
}

{
  const page = await open({ width: 1366, height: 768, lang: 'en' })
  await page.ops()
  await enable(page)
  await shot(page, '1366-en-ready')
  await page.click('.io2-sound')
  await shot(page, '1366-en-muted')
  await page.ctx.close()
}

{
  const page = await open({ width: 1366, height: 768, lang: 'en', noWebAudio: true })
  await page.ops()
  await shot(page, '1366-en-error-no-webaudio')
  await page.ctx.close()
}

{
  const page = await open({ width: 1366, height: 768 })
  await page.ops('')
  await shot(page, '1366-he-live-blocked', 'live')
  await page.ctx.close()
}

await browser.close()

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`\n${manifest.length} captures -> artifacts/industrial-ops-phase-a3/shots/`)
