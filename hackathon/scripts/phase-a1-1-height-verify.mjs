// Phase A1.1 - height and scroll verification.
//
// A1.1 is a spacing patch, so every check here is about what the patch is and
// is not allowed to have changed. The strongest ones diff the live CSS against
// the exact file that was in place before the patch, taken out of the backup
// zip and kept as artifacts/industrial-ops-phase-a1-1/industrial.a1-baseline.css.txt
// - that is what makes "no font-size was reduced" a proof rather than a claim.
// (.txt, not .css: a stray stylesheet inside the project tree makes Vite's
// watcher pick it up as a module.)
//
// Usage: node scripts/phase-a1-1-height-verify.mjs [baseUrl]
//        needs backend :5000 and Vite (default http://localhost:5174)

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const ART = path.join(root, 'artifacts', 'industrial-ops-phase-a1-1')

let failed = 0
let passed = 0
const check = (ok, label, detail = '') => {
  if (ok) passed += 1; else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`)
}
const section = (n) => console.log(`\n=== ${n} ===`)

const css = await readFile(path.join(root, 'src/concepts/industrial-ops/industrial.css'), 'utf-8')
const baseline = await readFile(path.join(ART, 'industrial.a1-baseline.css.txt'), 'utf-8')
const before = JSON.parse(await readFile(path.join(ART, 'measure-before.json'), 'utf-8'))

// The A1.1 row targets, replacing A1's 8-12 / 6-8. Documented here because a
// test that silently moves its own goalposts is worse than no test.
// Re-based by Phase A3.1, which enlarged the rows for readability: 4-5 at 1920
// and 3-4 at 1366 are the approved counts, and MORE is explicitly fine as long
// as the rows stay legible. Fewer is not — that is what this guards.
// Re-based again by Phase A3.1.1, which narrowed the alerts panel from 4/12 to
// 3/12 to give the visual feed its width back. Narrower rows wrap to more lines
// at the SAME type size — the approved answer to a narrower column is wrapping,
// never shrinking — so §27 lowered the 1920 floor from 4 to 3 and left 1366 at
// 3. This is the goalpost moving, and it is written down rather than quietly
// relaxed: the count that matters is legible rows, and the rest are one short
// scroll away inside the list.
const TARGET = {
  1920: { min: 3, was: '4-5 (A3.1)' },
  1366: { min: 3, was: '3-4 (A3.1)' },
}

// ============================================================================
section('A - the patch did not touch type')

// 4 - no font-size on this screen ever got smaller than it was before A1.1.
//
// Compared PER SELECTOR against the pre-A1.1 file, which is strictly stronger
// than the multiset containment this used to do. Multiset counting could only
// say "some 15px went missing"; it could not say which rule shrank, and it broke
// the moment a phase deliberately grew a size — which is exactly what A3.1 does.
// Reading the actual selector -> size mapping answers the real question: did any
// individual rule get smaller. Insertions, reordering and new rules are all
// invisible to it; a single shrink anywhere is not.
{
  // Walks the stylesheet with brace depth, so rules inside @media are keyed by
  // their media condition and never confused with the top-level rule.
  const ruleSizes = (text) => {
    const out = new Map()
    let i = 0
    let media = ''
    let buf = ''
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, '')
    while (i < clean.length) {
      const ch = clean[i]
      if (ch === '{') {
        const head = buf.trim()
        buf = ''
        if (head.startsWith('@')) {
          media = head
          i += 1
          continue
        }
        // Collect this rule's body (no nested braces inside a style rule).
        let j = i + 1
        let body = ''
        while (j < clean.length && clean[j] !== '}') { body += clean[j]; j += 1 }
        const size = (body.match(/font-size:\s*([\d.]+)px/) || [])[1]
        if (size) {
          for (const sel of head.split(',')) {
            const key = `${media}|${sel.trim().replace(/\s+/g, ' ')}`
            const px = Number(size)
            // A selector listed twice keeps the LAST declaration, as CSS does.
            out.set(key, px)
          }
        }
        i = j + 1
        continue
      }
      if (ch === '}') { media = ''; buf = ''; i += 1; continue }
      buf += ch
      i += 1
    }
    return out
  }

  const now = ruleSizes(css)
  const was = ruleSizes(baseline)

  const shrunk = []
  const grew = []
  for (const [key, oldPx] of was) {
    if (!now.has(key)) continue // rule removed or renamed — covered by other checks
    const newPx = now.get(key)
    if (newPx < oldPx) shrunk.push(`${key.split('|').pop()} ${oldPx}px -> ${newPx}px`)
    else if (newPx > oldPx) grew.push(`${key.split('|').pop()} ${oldPx}->${newPx}`)
  }
  check(shrunk.length === 0,
    '01 - no rule that existed before A1.1 has a smaller font-size today',
    shrunk.length ? shrunk.join(', ') : `${was.size} rules compared, ${grew.length} deliberately larger`)

  // New type introduced since. The screen's operational floor is 10.5px; A3.1
  // raised several old micro-labels above it and must not add new ones below it.
  const added = [...now.entries()].filter(([key]) => !was.has(key))
  const tooSmall = added.filter(([, px]) => px < 10.5).map(([key, px]) => `${key.split('|').pop()} ${px}px`)
  check(tooSmall.length === 0,
    '02 - every font-size rule added since A1.1 sits at 10.5px or above',
    tooSmall.length ? tooSmall.join(', ') : `${added.length} added, smallest ${added.length ? Math.min(...added.map(([, px]) => px)) : '-'}px`)
}

// 4b - line-height was not squeezed either. Same multiset reasoning.
{
  const lh = (text) => [...text.matchAll(/line-height:\s*([^;]+);/g)].map((m) => m[1].trim())
  const now = lh(css)
  const was = lh(baseline)
  const nowCount = now.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map())
  const lost = was.filter((v) => {
    const left = nowCount.get(v) || 0
    if (left > 0) { nowCount.set(v, left - 1); return false }
    return true
  })
  check(lost.length === 0, '03 - every line-height the pre-A1.1 file declared is still declared',
    lost.length ? `lost: ${lost.join(', ')}` : `${was.length} baseline declarations all present`)
}

// 5/6 - the forbidden shortcuts.
{
  const bad = []
  if (/transform:\s*scale/.test(css)) bad.push('transform: scale')
  if (/[^-\w]zoom\s*:/.test(css)) bad.push('zoom')
  if (/font-size:\s*(inherit|0|unset|initial)\s*;/.test(css)) bad.push('font-size reset')
  check(bad.length === 0, '04 - no scale, no zoom, no font-size reset', bad.join(', '))
}

// The alert list is still capped at every breakpoint, and still well below where
// it sat before A1.1.
//
// The A1.1 ceiling was 420px. Phase A3.1 re-based it to 440px on purpose: its
// rows are taller and more legible, and at the old cap an English list showed
// three alerts where the approved floor is four. The cap follows the rows, not
// the other way round — and the check that matters is 10 below, which counts the
// rows an operator can actually see.
{
  const caps = (text) => [...text.matchAll(/\.io2-alerts-scroll\s*\{[^}]*max-height:\s*(\d+)px/g)].map((m) => Number(m[1]))
  const now = caps(css)
  const was = caps(baseline)
  check(now.length >= was.length && now.every((v) => v <= 440),
    '05 - every alert-list cap is declared and within the A3.1 ceiling', `now: ${now.join(', ')} / was: ${was.join(', ')}`)
  check(Math.max(...now) < Math.max(...was),
    '06 - and the tallest cap is still below the pre-A1.1 value', `${Math.max(...was)}px -> ${Math.max(...now)}px`)
}

// The grid is still legal: equal row widths, every area a rectangle.
{
  const blocks = [...css.matchAll(/grid-template-areas:\s*([^;]+);/g)].map((m) => m[1])
  let allRect = true
  let allSameWidth = true
  const problems = []
  for (const block of blocks) {
    const rows = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
    if (!rows.length) continue
    const width = rows[0].length
    if (!rows.every((r) => r.length === width)) {
      allSameWidth = false
      problems.push(`row width mismatch: ${rows.map((r) => r.length).join('/')}`)
      continue
    }
    for (const name of new Set(rows.flat())) {
      if (name === '.') continue
      let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1, count = 0
      rows.forEach((row, r) => row.forEach((cell, c) => {
        if (cell !== name) return
        count += 1
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }))
      if ((maxR - minR + 1) * (maxC - minC + 1) !== count) {
        allRect = false
        problems.push(`${name} is not rectangular`)
      }
    }
  }
  check(allSameWidth, '07 - every grid row still declares the same column count', problems.join('; '))
  check(allRect, '08 - every grid area is still a contiguous rectangle', problems.join('; '))

  // A1.1 changed no grid-template-areas; Phase A3.1 rebuilt them deliberately,
  // so the invariant is now about what the layout may CONTAIN. Three panels were
  // removed from OPS, and a stale grid area left behind would reserve a column
  // or a row for a panel that no longer renders.
  const areaNames = new Set(
    [...css.matchAll(/grid-template-areas:\s*([^;]+);/g)]
      .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)])
      .flatMap((m) => m[1].trim().split(/\s+/))
  )
  const removed = ['targets', 'tracks', 'health'].filter((n) => areaNames.has(n))
  check(removed.length === 0,
    '09 - no grid area is reserved for a panel OPS no longer renders',
    removed.length ? removed.join(', ') : [...areaNames].sort().join(' '))
  check(!/\.io2-a-targets|\.io2-a-tracks|\.io2-a-health/.test(css),
    '09b - and their grid-area rules are gone from the stylesheet too')
}

// ============================================================================
section('B - browser: heights, rows and scroll')

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', admin.username)
await page.fill('#password', admin.password)
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
  page.click('button[type="submit"]'),
])

const load = async ({ width, height, lang, density, qs = '?demo=1&phase=approach' }) => {
  await page.setViewportSize({ width, height })
  await page.evaluate(([l, d]) => {
    localStorage.setItem('atapis-concepts-lang', l)
    localStorage.setItem('atapis-concepts-density', d)
  }, [lang, density])
  await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1700)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
}

const readMetrics = () => page.evaluate(() => {
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
  const feed = document.querySelector('.io2-vf-body')
  return {
    visible,
    rendered: rows.length,
    listH: s ? Math.round(s.clientHeight) : 0,
    feedH: feed ? Math.round(feed.getBoundingClientRect().height) : 0,
    pageScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight)),
    hOverflow: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
  }
})

// 1/2 - the visible-row count at both target resolutions, in both languages and
// both densities. English messages wrap to more lines than Hebrew, so this is
// the case that actually constrains the height.
for (const width of [1920, 1366]) {
  const height = width === 1920 ? 1080 : 768
  const t = TARGET[width]
  for (const lang of ['he', 'en']) {
    for (const density of ['compact', 'comfort']) {
      await load({ width, height, lang, density })
      const m = await readMetrics()
      check(m.visible >= t.min,
        `10 - ${width} ${lang} ${density}: at least ${t.min} alerts visible (target replaces ${t.was})`,
        `${m.visible} of ${m.rendered} visible, list ${m.listH}px`)
    }
  }
}

// 3 - the declared cap is what the browser actually applies.
{
  await load({ width: 1920, height: 1080, lang: 'he', density: 'compact' })
  const max = await page.$eval('.io2-alerts-scroll', (e) => getComputedStyle(e).maxHeight)
  check(max === '408px', '11 - the alert list cap resolves to the declared 408px at 1920 compact', max)
}

// 12/13 - page scroll came down at both resolutions, measured against the
// numbers recorded before the patch.
{
  const beforeOf = (name) => before.find((r) => r.name === name)
  for (const [name, width] of [['1920 he demo compact', 1920], ['1366 he demo compact', 1366]]) {
    const b = beforeOf(name)
    const [w, h] = width === 1920 ? [1920, 1080] : [1366, 768]
    await load({ width: w, height: h, lang: 'he', density: 'compact' })
    const m = await readMetrics()
    check(b && m.pageScroll < b.pageScroll,
      `12 - page scroll came down at ${width}`,
      `${b ? b.pageScroll : '?'}px -> ${m.pageScroll}px`)
  }
}

// 11 - the whole top operational band clears the fold at 1920.
//
// Rebased by Phase A3.1.1, which removed the decision band from this screen.
// The assertion is deliberately made STRONGER rather than merely shorter: the
// three panels must still clear the fold, AND the band that used to sit between
// the strip and them must be gone, AND the grid has to start immediately below
// the strip. That last one is the whole point of the phase (§80) and nothing
// asserted it before.
{
  await load({ width: 1920, height: 1080, lang: 'he', density: 'compact' })
  const band = await page.evaluate(() => {
    const bottom = (sel) => {
      const e = document.querySelector(sel)
      return e ? Math.round(e.getBoundingClientRect().bottom) : null
    }
    const strip = document.querySelector('.io2-strip')
    const grid = document.querySelector('.io2-grid')
    return {
      vh: window.innerHeight,
      strip: bottom('.io2-strip'),
      alerts: bottom('.io2-a-alerts'),
      feed: bottom('.io2-a-feed'),
      areas: bottom('.io2-a-areas'),
      decisionPresent: Boolean(document.querySelector('.io2-decision')),
      barPresent: Boolean(document.querySelector('.io2-actionbar')),
      stripToGrid: Math.round(grid.getBoundingClientRect().top - strip.getBoundingClientRect().bottom),
    }
  })
  const all = [band.strip, band.alerts, band.feed, band.areas]
  check(all.every((v) => v !== null && v <= band.vh),
    '13 - strip, alerts, feed and areas are all above the fold at 1920',
    JSON.stringify(band))
  check(!band.decisionPresent && !band.barPresent,
    '13b - and no decision band or external action bar sits between them',
    `decision=${band.decisionPresent} bar=${band.barPresent}`)
  check(band.stripToGrid <= 4,
    '13c - the command grid starts immediately under the status strip',
    `${band.stripToGrid}px`)
}

// 12 - the feed is still a usable size, not a strip.
{
  for (const [w, h, floor] of [[1920, 1080, 320], [1366, 768, 260]]) {
    await load({ width: w, height: h, lang: 'he', density: 'compact' })
    const m = await readMetrics()
    check(m.feedH >= floor, `14 - visual feed stays usable at ${w} (>= ${floor}px)`, `${m.feedH}px`)
  }
}

// 8/9 - one scroll region, no nesting, no trapping.
{
  await load({ width: 1920, height: 1080, lang: 'he', density: 'compact' })
  const scroll = await page.evaluate(() => {
    const list = document.querySelector('.io2-alerts-scroll')
    const nested = [...list.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el)
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight - el.clientHeight > 2
    }).length
    const all = [...document.querySelectorAll('.io2-grid *')].filter((el) => {
      const s = getComputedStyle(el)
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight - el.clientHeight > 2
    }).map((el) => el.className.toString().split(/\s+/)[0])
    return {
      nested,
      all,
      overscroll: getComputedStyle(list).overscrollBehaviorY,
      canScroll: list.scrollHeight - list.clientHeight > 2,
    }
  })
  check(scroll.nested === 0, '15 - nothing inside the alert list scrolls on its own', `${scroll.nested} nested`)
  check(scroll.canScroll, '16 - the alert list is genuinely scrollable (the rest are one scroll away)')
  check(scroll.overscroll !== 'contain' && scroll.overscroll !== 'none',
    '17 - the alert list does not trap the wheel (overscroll chains to the page)', scroll.overscroll)
  check(scroll.all.filter((c) => c === 'io2-alerts-scroll').length <= 1,
    '18 - the alert list is the top band\'s single scroll region', scroll.all.join(', '))

  // And the wheel actually reaches the page once the list is at its end.
  const chained = await page.evaluate(async () => {
    const list = document.querySelector('.io2-alerts-scroll')
    list.scrollTop = list.scrollHeight
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 100))
    return { atEnd: list.scrollTop > 0, pageY: window.scrollY }
  })
  await page.mouse.move(1400, 700)
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => window.scrollY)
  check(chained.atEnd && after > 0,
    '19 - with the list scrolled to its end the wheel scrolls the page', `pageY ${after}`)
}

// 10 - the DANGER announcement occupies nothing at all when there is none.
//
// Rebased by Phase A3.1.1: the full-width notice became a chip in the alerts
// panel header. The property under test is identical and is now easier to hold
// honestly — the chip is not rendered at all when nothing is unseen, and it
// lives inside a panel that was going to be that tall regardless, so it cannot
// push the grid down even when it IS rendered. That last part is asserted here
// and was not assertable before.
{
  await load({ width: 1920, height: 1080, lang: 'he', density: 'compact', qs: '' })
  const hidden = await page.evaluate(() => {
    const chip = document.querySelector('.io2-new-danger')
    const strip = document.querySelector('.io2-strip').getBoundingClientRect()
    const grid = document.querySelector('.io2-grid').getBoundingClientRect()
    return {
      present: Boolean(chip),
      band: Boolean(document.querySelector('.io2-danger-notice')),
      gap: Math.round(grid.top - strip.bottom),
      alertsPanelH: Math.round(document.querySelector('.io2-a-alerts').getBoundingClientRect().height),
    }
  })
  check(!hidden.band && !hidden.present && hidden.gap <= 4,
    '20 - with no new DANGER nothing is rendered and no height is reserved',
    JSON.stringify(hidden))

  await load({ width: 1920, height: 1080, lang: 'he', density: 'compact' })
  const shown = await page.evaluate(() => {
    const n = document.querySelector('.io2-new-danger')
    if (!n) return null
    const b = n.getBoundingClientRect()
    const alerts = document.querySelector('.io2-a-alerts').getBoundingClientRect()
    const feed = document.querySelector('.io2-a-feed').getBoundingClientRect()
    const grid = document.querySelector('.io2-grid').getBoundingClientRect()
    const strip = document.querySelector('.io2-strip').getBoundingClientRect()
    return {
      h: Math.round(b.height),
      tag: n.tagName,
      live: n.getAttribute('aria-live'),
      insideAlerts: b.top >= alerts.top - 1 && b.bottom <= alerts.bottom + 1,
      overlapsFeed: b.right > feed.left && b.left < feed.right,
      gap: Math.round(grid.top - strip.bottom),
      alertsPanelH: Math.round(alerts.height),
    }
  })
  check(shown && shown.h > 0 && shown.tag === 'BUTTON' && shown.live === 'assertive',
    '21 - when there is a new DANGER the indicator is present, focusable and aria-live=assertive',
    JSON.stringify(shown))
  check(shown && shown.insideAlerts && !shown.overlapsFeed,
    '22 - and it sits inside the alerts panel, covering neither the list nor the feed')
  check(shown && shown.gap <= 4,
    '22b - and it does not push the command grid down by a single pixel', `${shown && shown.gap}px`)
}

// 13 - nothing was removed from an alert row.
{
  await load({ width: 1920, height: 1080, lang: 'he', density: 'compact' })
  const row = await page.evaluate(() => {
    const r = document.querySelector('[data-io2-alert-row]')
    if (!r) return null
    const has = (sel) => Boolean(r.querySelector(sel))
    return {
      severity: has('.io2-alert-sev'),
      area: has('.io2-alert-area'),
      message: has('.io2-alert-msg'),
      source: has('.io2-alert-src'),
      time: has('.io2-alert-age'),
      lifecycle: has('.io2-alert-life'),
      sessionLocal: has('.io2-alert-local'),
      clipped: getComputedStyle(r).overflow === 'hidden' && r.scrollHeight > r.clientHeight + 1,
      lines: r.querySelectorAll('.io2-alert-line').length,
    }
  })
  const kept = row && row.severity && row.area && row.message && row.source && row.time &&
    row.lifecycle && row.sessionLocal
  check(kept, '23 - the alert row still carries severity, area, message, source, time, lifecycle, SESSION-LOCAL',
    JSON.stringify(row))
  check(row && !row.clipped, '24 - no alert row is clipped by the tighter layout')

  // The honesty rules the height patch must not have quietly relaxed.
  const srcs = await page.$$eval('.io2-alert-src', (n) => n.map((e) => e.textContent.trim()))
  // A3.2: LIVE camera ids stay forbidden. A demo alert may name a DEMO- camera
  // its own area declares (§35); phase-a1 test 33 enforces that stricter rule.
  check(!srcs.some((s) => /(^|[^-])\bCAM-0\d/.test(s)),
    '25 - still no live camera id claimed as an alert source', srcs.join(' | '))
  const body = await page.content()
  check(!/Pair Risk|Combined Risk|Matched|Associated(?! )|Confirmed/i.test(body.replace(/NOT ASSOCIATED/gi, '')),
    '26 - still no pair/association vocabulary on the page')
}

// 15 - one feed, still.
{
  await load({ width: 1920, height: 1080, lang: 'he', density: 'compact' })
  check((await page.$$('.dl-feed')).length === 1, '27 - exactly one feed component is mounted')
  await page.click('[data-io2-vf-tab="all"]')
  await page.waitForTimeout(500)
  check((await page.$$('.dl-feed')).length === 0, '28 - ALL CAMERAS still mounts zero feeds')
  await page.click('[data-io2-vf-tab="radar"]')
  await page.waitForTimeout(500)
  check((await page.$$('.dl-feed')).length === 0, '29 - the radar tab still mounts zero camera feeds')
}

// Filters, counts, search and keyboard focus all survive the shorter list -
// including the scroll-into-view that a shorter window makes matter more.
{
  await load({ width: 1920, height: 1080, lang: 'he', density: 'compact' })
  const total = (await page.$$('[data-io2-alert-row]')).length
  await page.click('.io2-filter-tab >> nth=1')
  await page.waitForTimeout(400)
  check(await page.$eval('.io2-filter-tab >> nth=1', (e) => e.classList.contains('is-active')),
    '30 - lifecycle filters still work')
  // Back to ALL ACTIVE through the tab itself: the reset button belongs to the
  // secondary filters and does not appear for a lifecycle tab.
  await page.click('.io2-filter-tab >> nth=0')
  await page.waitForTimeout(400)

  await page.keyboard.press('/')
  await page.waitForTimeout(200)
  check(await page.evaluate(() => document.activeElement?.type === 'search'),
    '31 - "/" still focuses the search field')
  await page.fill('.io2-filter-search input', 'RDR')
  await page.waitForTimeout(600)
  const n = (await page.$$('[data-io2-alert-row]')).length
  check(n > 0 && n < total, '32 - search still narrows the list', `${n} of ${total} rows`)
  await page.click('.io2-filter-reset')
  await page.waitForTimeout(500)
  check((await page.$$('[data-io2-alert-row]')).length === total,
    '32b - reset restores the full list')

  // Keyboard focus must pull a row into the shorter window.
  await page.focus('[data-io2-alert-row]')
  for (let i = 0; i < 7; i += 1) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(90)
  }
  const inView = await page.evaluate(() => {
    const el = document.activeElement
    const s = document.querySelector('.io2-alerts-scroll')
    const b = el.getBoundingClientRect()
    const box = s.getBoundingClientRect()
    return b.top >= box.top - 2 && b.bottom <= box.top + s.clientHeight + 2
  })
  check(inView, '33 - keyboard focus scrolls the focused row into the shorter window')

  const roving = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-io2-alert-row]')]
    return rows.filter((r) => r.getAttribute('tabindex') === '0').length
  })
  check(roving === 1, '34 - roving tabindex intact (exactly one row is tabbable)', `${roving}`)
}

// 7 - no horizontal overflow anywhere, still.
{
  let worst = 0
  for (const [w, h] of [[1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    await load({ width: w, height: h, lang: 'he', density: 'compact' })
    const m = await readMetrics()
    if (m.hOverflow > worst) worst = m.hOverflow
    check(m.hOverflow <= 1, `35 - no horizontal overflow @${w}x${h}`, `${m.hOverflow}px`)
  }
  check(worst <= 1, '36 - worst-case horizontal overflow across every viewport', `${worst}px`)
}

await browser.close()

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}  --  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
