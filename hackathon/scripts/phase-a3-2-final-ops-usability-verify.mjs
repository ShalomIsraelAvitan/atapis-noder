// Phase A3.2 - Final OPS usability, context navigation & log refinement.
//
// Three layers, the shape every phase since A1 has used:
//   A. static source checks   (the new grid bands, the full-height area list,
//                              the removed condition chip, the new controls)
//   B. logic / data checks    (search normalization, the optical enable rule,
//                              the note edit, the log's area semantics)
//   C. browser checks         (geometry, live search, OPTICAL -> OPT navigation,
//                              the notes dialog, log persistence across
//                              selection changes)
//
// Two properties this suite is built to catch, because they are the ones the
// phase could plausibly get wrong in a way that still LOOKS right:
//
//   1. A search that filters the display must not touch the model. Several
//      checks below assert on counts and on selection AFTER filtering, not just
//      on the rows that remain.
//   2. Removing CONDITION STATE from a box must not remove the condition from
//      the system. Every removal check here is paired with a check that the
//      thing it used to say is still true and still said where it decides
//      something (§61/§62/§63).
//
// Usage: node scripts/phase-a3-2-final-ops-usability-verify.mjs [baseUrl]
//        needs backend :5000 and Vite (default http://localhost:5174)

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LIFECYCLE,
  RESOLVE_NOTE_MAX,
  applyLifecycleAction,
  editResolveNote,
  resolveAlert,
  reopenAlert,
} from '../src/concepts/industrial-ops/alerts.js'
import {
  legalActionsFor,
  matchesAreaQuery,
  matchesQuery,
  normalizeSearchText,
  opticalContextFor,
  opticalQueryParams,
  areaOperationalSummary,
  lifecycleCounts,
  resolveSelection,
} from '../src/concepts/industrial-ops/alertSelectors.js'
import { readOpticalContext, opticalSourceKeyFor } from '../src/concepts/industrial-ops/opticalContext.js'
import { operatorLogEntries, mergeSessionLog } from '../src/concepts/industrial-ops/operatorLog.js'
import { splitSessionLog } from '../src/concepts/industrial-ops/useIndustrialOpsCommandCenter.js'
import { demoAlerts } from '../src/concepts/industrial-ops/demoAlerts.js'
import { DEMO_AREAS, LIVE_AREAS } from '../src/concepts/industrial-ops/areas.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'http://localhost:5174'
const IO = 'src/concepts/industrial-ops'

let failed = 0
let passed = 0
const check = (ok, label, detail = '') => {
  if (ok) passed += 1; else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`)
}
const section = (n) => console.log(`\n=== ${n} ===`)

const read = (p) => readFile(path.join(root, p), 'utf-8')
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// ============================================================================
section('A - static source checks')

const css = await read(`${IO}/industrial.css`)
const dashboardRaw = await read(`${IO}/views/IndustrialDashboard.jsx`)
const dashboard = stripComments(dashboardRaw)
const regionRaw = await read(`${IO}/components/SelectedAlertActions.jsx`)
const region = stripComments(regionRaw)
const areaListRaw = await read(`${IO}/components/AreaList.jsx`)
const areaList = stripComments(areaListRaw)
const dialogsRaw = await read(`${IO}/components/AlertActionDialogs.jsx`)
const dialogs = stripComments(dialogsRaw)
const optRaw = await read(`${IO}/views/IndustrialCamera.jsx`)
const opt = stripComments(optRaw)

// --- §4 / §16 / §18: the rebuilt desktop grid --------------------------------
{
  const desktop = css.slice(css.indexOf('.io2-grid {'), css.indexOf('.io2-a-areas'))
  const rows = [...desktop.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
  const span = (row, name) => row.filter((c) => c === name).length
  const rowsWith = (name) => rows.filter((r) => r.includes(name)).length

  // §72: the approved 3/6/3 split is untouched.
  check(span(rows[0], 'areas') === 3, 'A01 - areas is still 3/12', `${span(rows[0], 'areas')}`)
  check(span(rows[0], 'feed') === 6, 'A02 - the visual feed is still 6/12', `${span(rows[0], 'feed')}`)
  check(span(rows[0], 'alerts') === 3, 'A03 - operational alerts is still 3/12', `${span(rows[0], 'alerts')}`)

  // §16: risk/time is in the CENTRAL column, in the band under the feed.
  const feedRow = rows.findIndex((r) => r.includes('feed'))
  const timeRow = rows.findIndex((r) => r.includes('timeline'))
  check(timeRow === feedRow + 1, 'A04 - risk/time is the band directly under the visual feed',
    `feed@${feedRow} timeline@${timeRow}`)
  const feedCols = rows[feedRow].flatMap((c, i) => (c === 'feed' ? [i] : []))
  const timeCols = rows[timeRow].flatMap((c, i) => (c === 'timeline' ? [i] : []))
  check(JSON.stringify(feedCols) === JSON.stringify(timeCols),
    'A05 - and occupies exactly the feed\'s columns, so it is the same column',
    `${feedCols.join(',')} vs ${timeCols.join(',')}`)

  // §18: the session log is no longer a full-width strip.
  const logRow = rows.findIndex((r) => r.includes('log'))
  check(span(rows[logRow], 'log') < 12, 'A06 - the session log is no longer full width',
    `${span(rows[logRow], 'log')}/12`)
  check(span(rows[logRow], 'log') === 6, 'A07 - it is a half-width panel', `${span(rows[logRow], 'log')}/12`)

  // §5: areas spans more than one band, which is what gives it the height.
  check(rowsWith('areas') >= 2, 'A08 - the areas panel spans more than one band', `${rowsWith('areas')} bands`)

  // The structural invariants A3.1.1 established, still true.
  const blocks = [...css.matchAll(/grid-template-areas:\s*([^;]+);/g)].map((m) => m[1])
  let allRect = true
  let allSame = true
  const problems = []
  for (const block of blocks) {
    const brows = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
    if (!brows.length) continue
    const width = brows[0].length
    if (!brows.every((r) => r.length === width)) { allSame = false; problems.push('row width mismatch'); continue }
    for (const name of new Set(brows.flat())) {
      if (name === '.') { allRect = false; problems.push('blank cell'); continue }
      let minR = Infinity; let maxR = -1; let minC = Infinity; let maxC = -1; let count = 0
      brows.forEach((row, r) => row.forEach((cell, c) => {
        if (cell !== name) return
        count += 1
        minR = Math.min(minR, r); maxR = Math.max(maxR, r)
        minC = Math.min(minC, c); maxC = Math.max(maxC, c)
      }))
      if ((maxR - minR + 1) * (maxC - minC + 1) !== count) { allRect = false; problems.push(`${name} not rectangular`) }
    }
  }
  check(allSame, 'A09 - every grid row still declares the same column count', problems.join('; '))
  check(allRect, 'A10 - every named area is still a contiguous rectangle', problems.join('; '))
  check(!problems.includes('blank cell'), 'A11 - and no grid leaves a blank cell')
}

// --- §73 / §74: the narrow and single-column grids ---------------------------
{
  const narrow = css.slice(css.indexOf('@media (max-width: 1500px)'), css.indexOf('@media (max-width: 1200px)'))
  const nDecl = narrow.slice(narrow.indexOf('grid-template-areas'),
    narrow.indexOf(';', narrow.indexOf('grid-template-areas')))
  const nRows = [...nDecl.matchAll(/'([^']+)'/g)].map((m) => m[1].trim().split(/\s+/))
  const nFeed = nRows.findIndex((r) => r.includes('feed'))
  const nTime = nRows.findIndex((r) => r.includes('timeline'))
  check(nRows[0]?.includes('alerts') && nRows[0]?.includes('feed'),
    'A12 - <=1500px band 1 is still alerts | feed')
  check(nTime === nFeed + 1, 'A13 - <=1500px risk/time is directly under the feed', `feed@${nFeed} time@${nTime}`)
  check(nRows.some((r) => r.includes('areas') && r.includes('factors')),
    'A14 - <=1500px keeps the areas | risk factors pairing (§73)')
  const nLogRow = nRows.findIndex((r) => r.includes('log'))
  check(nLogRow >= 0 && nRows[nLogRow].filter((c) => c === 'log').length < 12,
    'A15 - <=1500px the session log is no longer full width',
    `${nRows[nLogRow]?.filter((c) => c === 'log').length}/12`)
  check(nRows.filter((r) => r.includes('areas')).length >= 2,
    'A16 - <=1500px areas still spans more than one band')

  const single = css.slice(css.indexOf('@media (max-width: 1200px)'), css.indexOf('@media (max-height: 820px)'))
  const sBlock = single.slice(single.indexOf('grid-template-areas'), single.indexOf(';', single.indexOf('grid-template-areas')))
  const order = [...sBlock.matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  check(order[0] === 'alerts' && order[1] === 'feed',
    'A17 - <=1200px alerts and feed are still first (§74)', order.join(','))
  check(order.length === 6 && new Set(order).size === 6,
    'A18 - <=1200px is a single column containing every panel exactly once', order.join(','))
  check(order.indexOf('timeline') === order.indexOf('feed') + 1,
    'A19 - <=1200px risk/time follows the feed', order.join(','))
}

// --- §6 / §7: the area list fills the panel instead of a fixed cap -----------
{
  const listCss = css.slice(css.indexOf('.io2-area-list {'), css.indexOf('.io2-area-row'))
  // §6 forbids a SMALL ARBITRARY cap that forces a scrollbar while the panel
  // still has free space below. It does not forbid an upper bound as such, and
  // §7 in fact requires one: without it a long list grows the auto-height grid
  // row and the scrolling moves to the page. So the check is specific — no fixed
  // pixel cap — rather than "no max-height at all", which would forbid the very
  // thing that makes internal scroll work (verified live by C10b-C10e).
  check(!/max-height:\s*\d+px/.test(listCss),
    'A20 - the area list declares no fixed pixel cap (§6)', listCss.match(/max-height:[^;]+/)?.[0] || 'none')
  check(/max-height:\s*calc\([^)]*vh/.test(listCss),
    'A20b - its only bound is viewport-relative, so it engages only when the list would leave the screen (§7)',
    listCss.match(/max-height:[^;]+/)?.[0] || 'none')
  check(/flex:\s*1\s+1\s+auto/.test(listCss), 'A21 - it grows into the height the panel has', listCss.match(/flex:[^;]+/)?.[0])
  check(/min-height:\s*0/.test(listCss), 'A22 - and may shrink below its content so the overflow stays inside it')
  check(/overflow-y:\s*auto/.test(listCss), 'A23 - with its own vertical scroll (§7)')

  // The chain that carries the panel's height down to the list.
  const areasCss = css.slice(css.indexOf('.io2-areas {'), css.indexOf('.io2-area-search {'))
  check(/flex:\s*1\s+1\s+auto/.test(areasCss) && /min-height:\s*0/.test(areasCss),
    'A24 - and its container passes the panel height through')

  // The old arbitrary caps are gone from every breakpoint, not only the base.
  const caps = [...css.matchAll(/\.io2-area-list\s*\{[^}]*?max-height:\s*(\d+)px/gs)].map((m) => m[1])
  check(caps.length === 0, 'A25 - no breakpoint reinstates a fixed pixel cap on the list', caps.join('/'))
}

// --- §9 / §10: the areas search ---------------------------------------------
{
  check(/data-io2-area-search/.test(areaList), 'A26 - the areas panel renders a search field')
  check(/onChange=\{\(event\) => setQuery/.test(areaList), 'A27 - it filters on change, in real time (§10)')
  check(!/type="submit"|onSubmit|<form/.test(areaList), 'A28 - there is no search button and no form to submit (§10)')
  check(!/debounce|setTimeout/.test(areaList), 'A29 - and no debounce delaying the result')
  check(/matchesAreaQuery/.test(areaList), 'A30 - matching goes through the shared selector, not a local rule')
  // §12: a display filter may not drive selection.
  check(!/onSelect\(|selectArea|setSelection/.test(areaList.replace(/onClick=\{\(\) => onSelect\(row\.areaId\)\}/g, '')),
    'A31 - the search never changes the selection (§12)')
}

// --- §60 / §61: condition state leaves the box, not the model ---------------
{
  check(!/io2-ab-cond/.test(region), 'A32 - the selected-alert region no longer renders a condition chip (§60)')
  check(!/conditionLabel/.test(region), 'A33 - and does not import the condition label for it')
  // The paired half: the model and its other consumers are untouched.
  const alertsSrc = await read(`${IO}/alerts.js`)
  check(/active:\s*true/.test(alertsSrc) && /clearedAt/.test(alertsSrc),
    'A34 - alert.active and clearedAt still exist in the engine (§61)')
  check(/alert\.active \?/.test(dialogs),
    'A35 - the resolve dialog still branches on the live condition (§62)')
  check(/THE SOURCE CONDITION IS STILL ACTIVE/.test(dialogs),
    'A36 - and still prints the active-condition warning')
  const labels = await read(`${IO}/components/alertLabels.js`)
  check(/conditionLabel/.test(labels), 'A37 - the condition vocabulary is not deleted, only unused here')
}

// --- §31 / §49: the two new controls -----------------------------------------
{
  check(/data-io2-secondary="optical"/.test(region), 'A38 - the region renders an OPTICAL control (§31)')
  check(/'OPTICAL', 'אופטי'/.test(regionRaw), 'A39 - labelled in both languages (§70)')
  check(/data-io2-secondary="notes"/.test(region), 'A40 - and a NOTES control (§49)')
  check(/'NOTES', 'הערות'/.test(regionRaw), 'A41 - also in both languages')
  // The RESOLVED test lives in the dashboard, not in the region: the region is
  // forbidden to import the alert engine (Phase A2 A06), so it receives the
  // answer rather than computing it. Both halves are checked, so the rule cannot
  // be satisfied by simply dropping the condition.
  check(/canShowNotes \? \(/.test(region), 'A42 - NOTES is rendered only when the caller allows it (§49)')
  check(/canShowNotes=\{cc\.selectedAlert\?\.lifecycle === LIFECYCLE\.RESOLVED\}/.test(dashboard),
    'A42b - and the caller allows it for RESOLVED only (§49)')
  check(/disabled=\{!optical\.enabled\}/.test(region),
    'A43 - OPTICAL uses the real disabled attribute, not a styled-off click target (§34)')
  check(/CAMERA SOURCE NOT IDENTIFIED FOR THIS ALERT/.test(regionRaw) &&
        /מקור המצלמה של התראה זו לא זוהה/.test(regionRaw),
    'A44 - the disabled explanation exists in both languages (§34)')
  // §69: the wrapper that carries the tooltip must not be an action.
  //
  // Only the wrapper's OWN opening tag is examined. Slicing to its closing tag
  // would swallow the button it contains, and that button legitimately has an
  // onClick — the check would then be asserting nothing at all.
  const wrapStart = regionRaw.lastIndexOf('<span', regionRaw.indexOf('io2-ab-btnwrap'))
  const wrap = regionRaw.slice(wrapStart, regionRaw.indexOf('<button', wrapStart))
  check(!/onClick|role=|tabIndex|href/.test(wrap),
    'A45 - the tooltip wrapper has no click handler, role, tab stop or href (§69)', wrap.replace(/\s+/g, ' ').slice(0, 90))
  // §67: secondary styling must be colour, not a smaller font.
  const secCss = css.slice(css.indexOf('.io2-ab-btn--secondary {'), css.indexOf('.io2-ab-btn:disabled'))
  check(!/font-size/.test(secCss), 'A46 - the secondary buttons do not shrink their type (§67/§75)')

  // Neither new control may claim to be a lifecycle action. `data-io2-action`
  // marks the transitions the engine declared legal, and other suites read every
  // one of them to assert what a lifecycle offers; tagging OPTICAL or NOTES with
  // it would make those assertions silently wrong while still passing.
  check(!/data-io2-action="(optical|notes)"/.test(region),
    'A46b - and neither is tagged as a lifecycle action (§30/§67)')
  check(/data-io2-secondary="optical"/.test(region) && /data-io2-secondary="notes"/.test(region),
    'A46c - they are marked as secondary controls instead')
  // The region must still be unable to form an opinion about lifecycle at all.
  check(!/from '\.\.\/alerts\.js'/.test(regionRaw),
    'A46d - the region still imports no lifecycle engine (Phase A2 A06)')
  check(/canShowNotes/.test(region),
    'A46e - so the RESOLVED test is made by the caller and passed in')
}

// --- §51-§57: the notes dialog ------------------------------------------------
{
  check(/AlertNotesDialog/.test(dialogs), 'A47 - a notes dialog component exists')
  check(/<AlertNotesDialog/.test(dashboard), 'A48 - and OPS renders it')
  check(/aria-modal="true"/.test(dialogs), 'A49 - it is a modal dialog (§68)')
  check(/data-io2-notes-reason/.test(dialogs), 'A50 - it shows the resolve reason (§51)')
  check(/data-io2-readonly="true"/.test(dialogs), 'A51 - marked read-only (§52)')
  check(/data-io2-notes-edit/.test(dialogs), 'A52 - the note has an edit control (§53)')
  check(/aria-label=\{t\('Edit resolve note'/.test(dialogsRaw),
    'A53 - which is a real button with an accessible name, not a clickable span (§68)')
  check(/maxLength=\{RESOLVE_NOTE_MAX\}/.test(dialogs), 'A54 - the textarea keeps the 500 cap (§54)')
  check(RESOLVE_NOTE_MAX === 500, 'A55 - and that cap is 500', `${RESOLVE_NOTE_MAX}`)
  check(/'SAVE', 'שמור'/.test(dialogsRaw) && /'CANCEL', 'ביטול'/.test(dialogsRaw),
    'A56 - save and cancel are labelled in both languages (§54)')
  check(/SESSION-LOCAL · NOT SERVER-PERSISTED/.test(dialogsRaw), 'A57 - the session-local wording is present (§57)')
  // Comments are stripped first: the file explains in prose which claims it is
  // forbidden to make, and naming them there is documentation, not a render.
  check(!/Saved to server|Synced|Audit DB/i.test(dialogs), 'A58 - and no server, sync or audit-DB claim (§57)')
  check(/resolvedBy/.test(dialogs), 'A59 - the resolving operator is read from the action log, not from the owner')
}

// --- §36-§48: the OPT side ----------------------------------------------------
{
  check(/useSearchParams/.test(opt), 'A60 - OPT reads its context from the query string (§46/§47)')
  check(/readOpticalContext/.test(opt), 'A61 - through the shared intake, not an inline parse')
  check(/CONTEXT UNAVAILABLE|ההקשר אינו זמין/.test(optRaw), 'A62 - it can report an unresolvable context (§48)')
  check(/RADAR AREA CONTEXT/.test(optRaw) && /הקשר רדאר של האזור/.test(optRaw),
    'A63 - the radar side is labelled AREA CONTEXT in both languages (§41)')
  check(/NOT ASSOCIATED WITH SELECTED CAMERA TRACK/.test(optRaw) &&
        /ללא שיוך מאומת למסלול המצלמה שנבחר/.test(optRaw),
    'A64 - and explicitly NOT ASSOCIATED, in both languages (§41)')
  // §82: no redesign. The panels OPT had are the panels OPT has.
  check(/RADAR PLOT/.test(opt) && /CONTACT TABLE/.test(opt) && /TRACK TABLE/.test(opt) && /FEED/.test(opt),
    'A65 - every existing OPT panel is still rendered (§82)')
  check(/<TracksTable snapshot=\{vm\.snapshot\} \/>/.test(opt),
    'A66 - and the shared tracks table is passed exactly what it was before (§83)')
  // §42: no heuristic target selection anywhere in the intake.
  const ctxSrc = stripComments(await read(`${IO}/opticalContext.js`))
  check(!/nearest|closest|proximity|distance|similar/i.test(ctxSrc),
    'A67 - the context intake computes no proximity or similarity (§42)')
  check(!/setSelectedTargetId/.test(opt.slice(0, opt.indexOf('return ('))),
    'A68 - and nothing auto-selects a radar target on arrival (§42)')
  // §84: no backend.
  check(!/fetch\(|axios|\/api\//.test(ctxSrc) && !/fetch\(|\/api\//.test(stripComments(regionRaw)),
    'A69 - no new API call was added by this phase (§45/§84)')
}

// --- §75: nothing shrank ------------------------------------------------------
{
  const bad = []
  if (/transform:\s*scale/.test(css)) bad.push('transform: scale')
  if (/[^-\w]zoom\s*:/.test(css)) bad.push('zoom')
  if (/font-size:\s*(inherit|0|unset|initial)\s*;/.test(css)) bad.push('font-size reset')
  check(bad.length === 0, 'A70 - no scale, no zoom, no font-size reset (§75)', bad.join(', '))
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  check(sizes.filter((s) => s < 8.5).length === 0, 'A71 - nothing goes below the 8.5px floor',
    sizes.filter((s) => s < 8.5).join(','))
  // A3.1's readability anchors are untouched.
  const anchors = [['.io2-panel-title', 16], ['.io2-alert-line1', 14], ['.io2-alert-line2', 12], ['.io2-area-name', 15]]
  const shrunk = []
  for (const [sel, px] of anchors) {
    const m = css.match(new RegExp(`${sel.replace('.', '\\.')}\\s*\\{[^}]*font-size:\\s*([\\d.]+)px`, 's'))
    if (!m || Number(m[1]) < px) shrunk.push(`${sel} ${m ? m[1] : 'missing'} < ${px}`)
  }
  check(shrunk.length === 0, 'A72 - every A3.1 readability size is still at or above its approved value', shrunk.join(', '))
  // The type this phase adds sits on the readable scale.
  const newBlocks = [
    css.slice(css.indexOf('.io2-area-search {'), css.indexOf('.io2-area-empty')),
    css.slice(css.indexOf('.io2-notes-ro {'), css.indexOf('/* OPT alert context band')),
    css.slice(css.indexOf('.io2-optctx {'), css.indexOf('/* Session log scope')),
  ].join('\n')
  const newSizes = [...newBlocks.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  check(newSizes.length > 0 && newSizes.every((s) => s >= 11),
    'A73 - all type added by this phase is 11px or above', newSizes.join('/'))
}

// --- §20 / §64: the fixed heights this phase must not break -------------------
{
  const regionCss = css.slice(css.indexOf('.io2-sel-actions {'), css.indexOf('.io2-sel-identity'))
  const h = Number((regionCss.match(/\bheight:\s*(\d+)px/) || [])[1])
  check(h > 0 && /overflow:\s*hidden/.test(regionCss),
    'A74 - the selected-alert region still has one fixed, clipped height (§64)', `${h}px`)
  check(!/min-height|max-height/.test(regionCss), 'A75 - and not a range it can drift inside (§64)')
  const logCss = css.slice(css.indexOf('.io2-log-scroll {'), css.indexOf('.io2-log-scroll:focus-visible'))
  check(/\bheight:\s*\d+px/.test(logCss) && !/max-height/.test(logCss),
    'A76 - the session log still declares a fixed height, not a cap it grows into (§20)')
  check(/overflow-y:\s*auto/.test(logCss), 'A77 - with its own vertical scroll (§19)')
}

// ============================================================================
section('B - logic / data checks')

const now = Date.now()
const seeded = demoAlerts(now)
const alertById = (id) => seeded.find((a) => a.id === id)

// --- §11 / §29: hebrew search normalization ----------------------------------
{
  // The fold that actually bites: the demo area is written with GERSHAYIM
  // (U+05F4) and a Hebrew keyboard emits a plain quotation mark.
  const gate = DEMO_AREAS.find((a) => a.id === 'DEMO-AREA-01')
  check(gate.nameHe.includes('\u05F4'), 'B01 - the demo area name really does use gershayim', gate.nameHe)
  check(matchesAreaQuery(gate, 'ש"ג'), 'B02 - and a typed ASCII quote still finds it (§11)')
  check(matchesAreaQuery(gate, 'ש\u05F4ג'), 'B03 - as does the displayed form')
  check(matchesAreaQuery(gate, 'ראשי'), 'B04 - Hebrew name search (§86.21)')
  check(matchesAreaQuery(gate, 'Main'), 'B05 - English name search (§86.22)')
  check(matchesAreaQuery(gate, 'DEMO-AREA-01'), 'B06 - Area ID search (§86.23)')
  check(matchesAreaQuery(gate, 'demo-area-01'), 'B07 - and it is case-insensitive (§11)')
  check(matchesAreaQuery(gate, 'רא'), 'B08 - partial search (§86.24)')
  check(matchesAreaQuery(gate, '  ראשי  '), 'B09 - the query is trimmed (§11)')
  check(matchesAreaQuery(gate, ''), 'B10 - a blank query filters nothing')
  check(!matchesAreaQuery(gate, 'shaar'), 'B11 - there is no transliteration (§11/§87.36)')
  check(!matchesAreaQuery(gate, 'North'), 'B12 - and a non-match really does not match')
  check(normalizeSearchText('\u05F4') === '"', 'B13 - gershayim folds to a quotation mark')
  check(normalizeSearchText('\u05F3') === "'", 'B14 - geresh folds to an apostrophe')
  check(normalizeSearchText('\u05BE') === '-', 'B15 - maqaf folds to a hyphen')
  check(normalizeSearchText('שָׁלוֹם') === 'שלום', 'B16 - niqqud is stripped', normalizeSearchText('שָׁלוֹם'))
  check(normalizeSearchText(null) === '' && normalizeSearchText(undefined) === '',
    'B17 - and null/undefined normalize to empty rather than "null"')
}

// --- §27 / §87: the alert search keeps everything and gains Hebrew -----------
{
  const areas = DEMO_AREAS
  const camera = seeded.find((a) => a.trackId === 7)
  const radar = seeded.find((a) => a.targetId === 1)
  check(matchesQuery(camera, 'מסלול', { areas }), 'B18 - Hebrew message search (§87.29)')
  check(matchesQuery(camera, 'approaching', { areas }), 'B19 - English message search preserved (§87.31)')
  check(matchesQuery(camera, 'ש"ג', { areas }), 'B20 - Hebrew AREA NAME search on an alert (§87.30)')
  check(matchesQuery(camera, 'Main Gate', { areas }), 'B21 - English area name preserved')
  check(matchesQuery(camera, camera.id, { areas }), 'B22 - ID search preserved (§87.32)')
  check(matchesQuery(camera, 'DEMO-AREA-01', { areas }), 'B23 - area ID search preserved')
  check(matchesQuery(camera, '#7', { areas }) && matchesQuery(camera, '7', { areas }),
    'B24 - track search preserved, with and without the prefix (§87.33)')
  check(matchesQuery(radar, 't1', { areas }) && matchesQuery(radar, '1', { areas }),
    'B25 - target search preserved, with and without the prefix (§87.34)')
  check(matchesQuery(radar, 'DEMO-RDR-01', { areas }), 'B26 - source id search preserved')
  check(!matchesQuery(camera, 'shaar', { areas }), 'B27 - no transliteration on the alert search either (§87.36)')

  // §87.37: counts are selector-computed, and a query narrows them honestly.
  const all = lifecycleCounts(seeded, { query: '' }, { areas })
  const q = lifecycleCounts(seeded, { query: 'ש"ג' }, { areas })
  const expected = seeded.filter((a) => matchesQuery(a, 'ש"ג', { areas })).length
  check(q.ALL === expected, 'B28 - counts stay selector-correct under a Hebrew query (§87.37)',
    `${q.ALL} vs ${expected}`)
  check(all.ALL === seeded.length, 'B29 - and an empty query counts everything', `${all.ALL}/${seeded.length}`)
  check(q.ALL < all.ALL, 'B30 - a query that matches a subset really does narrow the counts')
}

// --- §32 / §33 / §35 / §43 / §88: the optical enable rule --------------------
{
  const known = seeded.find((a) => a.cameraSourceKnown === true)
  const unknownCam = seeded.find((a) => a.sourceType === 'camera' && !a.cameraSourceKnown)
  const radarOnly = seeded.find((a) => a.sourceType === 'radar')
  const system = seeded.find((a) => a.sourceType === 'system')

  check(Boolean(known), 'B31 - the demo fixture has a camera-known alert to test with', known?.id)
  check(opticalContextFor(known, { areas: DEMO_AREAS }).enabled === true,
    'B32 - camera-known alert -> OPTICAL enabled (§88.38)')
  check(opticalContextFor(unknownCam, { areas: DEMO_AREAS }).enabled === false,
    'B33 - camera-unknown alert -> OPTICAL disabled (§88.39)')
  check(opticalContextFor(radarOnly, { areas: DEMO_AREAS }).enabled === false,
    'B34 - radar-only alert without a camera -> disabled (§88.42/§43)')
  check(opticalContextFor(system, { areas: DEMO_AREAS }).enabled === false,
    'B35 - a system alert -> disabled')
  check(opticalContextFor(null, { areas: DEMO_AREAS }).enabled === false,
    'B36 - and nothing is offered with no selection')

  // §33: a display-only camera id must never satisfy the rule.
  const spoofed = { ...unknownCam, sourceId: 'DEMO-CAM-01' }
  check(opticalContextFor(spoofed, { areas: DEMO_AREAS }).enabled === false,
    'B37 - a camera id without cameraSourceKnown does not enable it (§33/§88.41)')
  const flagged = { ...unknownCam, cameraSourceKnown: true, sourceId: null }
  check(opticalContextFor(flagged, { areas: DEMO_AREAS }).enabled === false,
    'B38 - and the flag alone, with no id, does not either')
  const foreign = { ...known, sourceId: 'DEMO-CAM-99' }
  check(opticalContextFor(foreign, { areas: DEMO_AREAS }).enabled === false,
    'B39 - a camera the area does not declare is refused (§33)')
  const otherArea = { ...known, sourceId: 'DEMO-CAM-01' } // declared, but by AREA-01
  check(opticalContextFor(otherArea, { areas: DEMO_AREAS }).enabled === false,
    'B40 - as is a camera declared by a DIFFERENT area')

  // §35: demo stays demo.
  const ctx = opticalContextFor(known, { areas: DEMO_AREAS })
  check(ctx.isDemo === true, 'B41 - the demo context is marked demo and stays so (§88.43)')
  check(ctx.cameraId === known.sourceId, 'B42 - and carries the camera the alert named', ctx.cameraId)

  // §37: only real values travel, and none is invented.
  const params = opticalQueryParams(ctx)
  check(params.get('cameraId') === known.sourceId, 'B43 - camera context is in the query (§88.45)')
  check(params.get('areaId') === known.areaId, 'B44 - area context is in the query (§88.46)')
  check(params.get('alertId') === known.id, 'B45 - alert id is in the query (§88.47)')
  check(params.get('trackId') === String(known.trackId), 'B46 - track id travels when present (§88.48)')
  check(params.get('targetId') === null, 'B47 - and targetId is ABSENT when the alert has none (§37/§88.49)')
  check(params.get('demo') === '1', 'B48 - the demo marking travels with it (§35)')
  check(opticalQueryParams(opticalContextFor(radarOnly, { areas: DEMO_AREAS })) === null,
    'B49 - a disabled context produces no navigation target at all')

  // LIVE can never reach the enabled path, and that is correct, not a gap.
  const liveish = { sourceType: 'camera', cameraSourceKnown: false, sourceId: null, areaId: 'AREA-01', id: 'x' }
  check(opticalContextFor(liveish, { areas: LIVE_AREAS }).enabled === false,
    'B50 - a live camera alert can never enable OPTICAL, by construction (§32)')
}

// --- §48: the OPT intake refuses to repair a broken context ------------------
{
  const known = seeded.find((a) => a.cameraSourceKnown === true)
  const good = opticalQueryParams(opticalContextFor(known, { areas: DEMO_AREAS }))
  const readBack = readOpticalContext(good, { areas: DEMO_AREAS })
  check(readBack?.resolved === true, 'B51 - a context OPS produced resolves on the OPT side')
  check(readBack.cameraId === known.sourceId, 'B52 - to the same camera it named')
  check(readBack.trackId === known.trackId, 'B53 - with the track id intact (§39)')
  check(readBack.radarId === 'DEMO-RDR-03', 'B54 - and the AREA\'s radar for context only (§40)', readBack.radarId)

  const bad = new URLSearchParams(good)
  bad.set('cameraId', 'DEMO-CAM-99')
  const badCtx = readOpticalContext(bad, { areas: DEMO_AREAS })
  check(badCtx.resolved === false, 'B55 - an unknown camera id does not resolve (§88.51)')
  check(badCtx.camera === null, 'B56 - and no other camera is substituted for it (§48)')
  check(badCtx.reason === 'camera-not-in-area', 'B57 - the reason is reported', badCtx.reason)

  const wrongMode = readOpticalContext(good, { areas: LIVE_AREAS })
  check(wrongMode.resolved === false, 'B58 - a demo context opened in a live session does not resolve (§35)')
  check(opticalSourceKeyFor(wrongMode) === null, 'B59 - and opens no live camera on its behalf')

  check(readOpticalContext(new URLSearchParams(''), { areas: DEMO_AREAS }) === null,
    'B60 - no context at all reads as no context, not as a broken one')
  check(opticalSourceKeyFor(readBack) === null,
    'B61 - a demo camera never forces a real adapter source (§35)')

  // A live-shaped context DOES map to a real source key.
  const liveParams = new URLSearchParams({ ctx: 'ops-alert', cameraId: 'CAM-02', areaId: 'AREA-01' })
  const liveCtx = readOpticalContext(liveParams, { areas: LIVE_AREAS })
  check(liveCtx.resolved === true && opticalSourceKeyFor(liveCtx) === 'dahua',
    'B62 - a live camera id maps to its declared adapter source (§38)', opticalSourceKeyFor(liveCtx))
}

// --- §53-§56 / §90: the note edit --------------------------------------------
{
  const base = { ...alertById(seeded.find((a) => a.lifecycle === LIFECYCLE.RESOLVED).id) }
  const op = { id: 7, name: 'Tester' }

  const edited = editResolveNote(base, { now, operator: op, note: '  corrected wording  ' })
  check(edited.resolveNote === 'corrected wording', 'B63 - SAVE trims the note (§55/§90.73)', edited.resolveNote)
  check(edited.lifecycle === LIFECYCLE.RESOLVED, 'B64 - and the lifecycle does not move (§53)')
  check(edited.resolveReason === base.resolveReason, 'B65 - the reason is untouched (§52/§90.67)')
  const logEntry = edited.actionLog[edited.actionLog.length - 1]
  check(logEntry.action === 'edit_note', 'B66 - an edit_note entry is logged (§56/§90.76)')
  check(logEntry.operatorName === 'Tester', 'B67 - naming who edited it (§56)')
  check(logEntry.previousNote === (base.resolveNote ?? null), 'B68 - and what it was before (§56)')
  check(logEntry.note === 'corrected wording', 'B69 - and what it became')
  check(Number.isFinite(logEntry.at), 'B70 - with a real timestamp')

  const blanked = editResolveNote(edited, { now, operator: op, note: '    ' })
  check(blanked.resolveNote === null, 'B71 - whitespace-only normalizes to null (§55/§90.73)')

  const capped = editResolveNote(base, { now, operator: op, note: 'x'.repeat(900) })
  check(capped.resolveNote.length === RESOLVE_NOTE_MAX, 'B72 - the 500 cap is enforced in the engine too (§54)',
    `${capped.resolveNote.length}`)

  const unchanged = editResolveNote(edited, { now, operator: op, note: 'corrected wording' })
  check(unchanged === edited, 'B73 - saving the same text is a no-op and logs nothing')

  // §53: only RESOLVED. There is no note to edit before that.
  for (const lc of [LIFECYCLE.NEW, LIFECYCLE.ACKNOWLEDGED, LIFECYCLE.IN_REVIEW]) {
    const a = { ...base, lifecycle: lc }
    check(editResolveNote(a, { now, operator: op, note: 'nope' }) === a,
      `B74 - editResolveNote refuses a ${lc} alert`)
  }

  // Routed through the same dispatcher as the lifecycle actions.
  const state = { alerts: [base] }
  const next = applyLifecycleAction(state, base.id, 'edit_note', { now, operator: op, note: 'via dispatcher' })
  check(next.alerts[0].resolveNote === 'via dispatcher',
    'B77 - and it is reachable through applyLifecycleAction (§55)')
}

// --- §65: the button rules ----------------------------------------------------
{
  const of = (lifecycle) => legalActionsFor({ lifecycle, active: true })
  check(of(LIFECYCLE.NEW).join() === 'acknowledge,review,resolve', 'B78 - NEW still offers ack, review, resolve (§65)')
  check(of(LIFECYCLE.ACKNOWLEDGED).join() === 'review,resolve', 'B79 - ACK still offers review, resolve (§65)')
  check(of(LIFECYCLE.IN_REVIEW).join() === 'resolve', 'B80 - IN REVIEW still offers resolve (§65)')
  check(of(LIFECYCLE.RESOLVED).join() === 'reopen', 'B81 - RESOLVED still offers reopen (§65/§66)')
}

// --- §21-§26 / §85: the session log's area semantics --------------------------
{
  // Two alerts in DIFFERENT areas, each acted on.
  const a1 = resolveAlert({ ...seeded.find((a) => a.areaId === 'DEMO-AREA-01' && a.lifecycle === LIFECYCLE.NEW) },
    { now: now - 5000, operator: { id: 1, name: 'Op1' }, reason: 'handled', note: 'n1' })
  const a2 = { ...seeded.find((a) => a.areaId === 'DEMO-AREA-02' && a.lifecycle === LIFECYCLE.NEW) }
  const a2ack = applyLifecycleAction({ alerts: [a2] }, a2.id, 'acknowledge',
    { now: now - 4000, operator: { id: 2, name: 'Op2' } }).alerts[0]

  const entries = operatorLogEntries([a1, a2ack], { lang: 'en' })
  check(entries.length === 2, 'B82 - both operator actions produce log rows', `${entries.length}`)
  check(entries.every((e) => e.areaId), 'B83 - each carries an areaId (§22)')
  check(entries.find((e) => e.alertId === a1.id).areaId === a1.areaId,
    'B84 - taken from the alert the action was performed on, not from a selection (§22/§85.3)')
  check(entries.find((e) => e.alertId === a2ack.id).areaId === a2ack.areaId,
    'B85 - for every entry independently')

  // §24: no invented area. An alert with no areaId yields an entry with none.
  const orphan = applyLifecycleAction({ alerts: [{ ...a2, areaId: null, actionLog: [] }] }, a2.id, 'acknowledge',
    { now, operator: { id: 3, name: 'Op3' } }).alerts[0]
  const orphanRows = operatorLogEntries([orphan], { lang: 'en' })
  check(!orphanRows[0].areaId, 'B86 - an alert with no area yields an entry with no area (§24/§85.13)')
  const { unassigned } = splitSessionLog(orphanRows, DEMO_AREAS, 'DEMO-AREA-01')
  check(unassigned.length === 1, 'B87 - and it lands in UNASSIGNED, not under the selected area (§24)')

  // §23/§26: area scope filters on the EVENT's area and nothing else.
  const merged = mergeSessionLog([], entries)
  const inA1 = splitSessionLog(merged, DEMO_AREAS, 'DEMO-AREA-01').inArea
  const inA2 = splitSessionLog(merged, DEMO_AREAS, 'DEMO-AREA-02').inArea
  check(inA1.length === 1 && inA1[0].alertId === a1.id,
    'B88 - SELECTED AREA shows only that area\'s events (§26/§85.6)')
  check(inA2.length === 1 && inA2[0].alertId === a2ack.id,
    'B89 - and switching area switches which ones (§85.6)')
  check(splitSessionLog(merged, DEMO_AREAS, 'DEMO-AREA-01').inArea.length === 1,
    'B90 - switching back restores the first area\'s history (§85.7)')

  // §85.4: selectedAlertId is not an input to any of it.
  check(splitSessionLog.length === 3, 'B91 - the log filter takes (entries, areas, areaId) and no alert id (§85.4)')
  const src = stripComments(await read(`${IO}/useIndustrialOpsCommandCenter.js`))
  const fn = src.slice(src.indexOf('export function splitSessionLog'), src.indexOf('export function useIndustrialOpsCommandCenter'))
  check(!/selectedAlertId|selectedAlert\b/.test(fn),
    'B92 - and never reads a selected alert (§22/§26)')

  // §85.14: an entry with no trustworthy time is neither given one nor moved.
  const controller = [{ id: 'ctrl-key', source: 'controller', message: 'x', time: '10:00:00' }]
  const mergedCtrl = mergeSessionLog(controller, entries)
  check(mergedCtrl.find((e) => e.id === 'ctrl-key').at === null,
    'B93 - a controller entry is not given a fabricated timestamp (§85.14)')
}

// --- §21 / §23: the root cause, proven at the selector -----------------------
{
  // The bug: choosing an area was overridden by the selected alert's area, so
  // the SELECTED AREA log followed the ALERT. The fix is the precedence below.
  const alerts = seeded
  const alertInArea2 = alerts.find((a) => a.areaId === 'DEMO-AREA-02')
  const sel = resolveSelection(alerts,
    { selectedAlertId: alertInArea2.id, selectedAreaId: 'DEMO-AREA-01' },
    { areas: DEMO_AREAS })
  check(sel.selectedAreaId === 'DEMO-AREA-01',
    'B94 - an explicitly chosen area survives a selected alert from another area (§21/§26)',
    sel.selectedAreaId)
  check(sel.selectedAlertId === alertInArea2.id, 'B95 - and the alert selection is untouched by that')
  // With no stored area, the alert's area is still the fallback.
  const fallback = resolveSelection(alerts, { selectedAlertId: alertInArea2.id }, { areas: DEMO_AREAS })
  check(fallback.selectedAreaId === alertInArea2.areaId,
    'B96 - with no stored area the alert\'s own area is still used', fallback.selectedAreaId)
  // A stored area that no longer exists falls back rather than pointing nowhere.
  const stale = resolveSelection(alerts, { selectedAreaId: 'GONE-01' }, { areas: DEMO_AREAS })
  check(DEMO_AREAS.some((a) => a.id === stale.selectedAreaId),
    'B97 - a stored area that no longer exists falls back to a real one')
}

// --- §61 / §63 / §91: condition semantics are untouched ----------------------
{
  const area = DEMO_AREAS[0]
  const activeDanger = { areaId: area.id, severity: 'danger', active: true, lifecycle: LIFECYCLE.RESOLVED }
  const s = areaOperationalSummary(area, [activeDanger])
  check(s.severity === 'DANGER',
    'B98 - an ACTIVE danger that was RESOLVED still makes the area DANGER (§63/§91.86)', s.severity)
  check(s.activeCount === 0, 'B99 - while the operator work count correctly reads zero')
  const cleared = areaOperationalSummary(area, [{ ...activeDanger, active: false }])
  check(cleared.severity === 'SAFE', 'B100 - and a cleared condition does not (§91.84)', cleared.severity)

  // §59: reopen's existing semantics are not changed by this phase.
  const resolved = resolveAlert({ ...seeded[0], lifecycle: LIFECYCLE.NEW, actionLog: [] },
    { now, operator: null, reason: 'handled', note: 'x' })
  const reopened = reopenAlert(resolved, { now })
  check(reopened.resolveNote === null && reopened.resolveReason === null,
    'B101 - reopen still clears the resolve record exactly as A0/A2 already did (§59)')
}

// ============================================================================
section('C - browser checks')

const parsed = JSON.parse(await readFile(path.join(root, 'python', 'data', 'users.json'), 'utf-8'))
const users = Array.isArray(parsed) ? parsed : parsed.users || []
const admin = users.find((u) => u.role === 'admin')

const browser = await chromium.launch()

async function open({ width = 1920, height = 1080, lang = 'en', density = 'compact' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(String(e)))
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
  page.ctx = ctx
  page.ops = async (qs = '?demo=1&phase=approach') => {
    await page.goto(`${BASE}/concepts/industrial/dashboard${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2100)
  }
  return page
}

const docH = (page) => page.evaluate(() => document.documentElement.scrollHeight)
const box = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }
}, sel)

// --- §92: layout ---------------------------------------------------------------
{
  const page = await open()
  await page.ops()

  const feed = await box(page, '.io2-a-feed')
  const time = await box(page, '.io2-a-timeline')
  const log = await box(page, '.io2-a-log')
  const areas = await box(page, '.io2-a-areas')
  const alerts = await box(page, '.io2-a-alerts')

  check(time && feed && time.y > feed.y, 'C01 - risk/time renders below the visual feed (§92.87)',
    `feed y=${feed?.y} time y=${time?.y}`)
  check(time && feed && Math.abs(time.x - feed.x) <= 2 && Math.abs(time.w - feed.w) <= 2,
    'C02 - in the same column and at the same width (§16)', `feed ${feed?.x}/${feed?.w} time ${time?.x}/${time?.w}`)

  const pageW = 1920
  check(log && log.w < pageW * 0.8, 'C03 - the session log is no longer full width (§92.88)', `${log?.w}px`)
  check(log && Math.abs(log.w - feed.w) < feed.w * 0.35,
    'C04 - it occupies a half-width region comparable to the vacated risk/time cell (§92.89)', `${log?.w}px`)

  check(feed && feed.w >= 780, 'C05 - the feed panel stays large (§14/§92.91)', `${feed?.w}px`)
  const media = await box(page, '.io2-vf-body img, .io2-vf-body svg')
  check(!media || media.w >= 700, 'C06 - and the media inside it stays usable', media ? `${media.w}x${media.h}` : 'n/a')

  // §90: the area list actually uses the panel it is in.
  const fill = await page.evaluate(() => {
    const panel = document.querySelector('.io2-a-areas')
    const list = document.querySelector('.io2-area-list')
    if (!panel || !list) return null
    return {
      panelH: Math.round(panel.getBoundingClientRect().height),
      listH: Math.round(list.clientHeight),
      scrollH: Math.round(list.scrollHeight),
      rows: document.querySelectorAll('.io2-area-list > li').length,
    }
  })
  check(fill && fill.listH > 0, 'C07 - the area list has a real height', JSON.stringify(fill))
  check(fill && fill.listH >= fill.panelH * 0.5,
    'C08 - and it fills the vertical space rather than stopping at a cap (§92.90)',
    `list ${fill?.listH} of panel ${fill?.panelH}`)
  check(fill && fill.scrollH <= fill.listH + 2,
    'C09 - three demo areas fit, so no scrollbar is forced (§86.18)',
    `scroll ${fill?.scrollH} vs client ${fill?.listH}`)
  check(fill && fill.rows === 3, 'C10 - and all three are rendered, none clipped away (§86.20)', `${fill?.rows}`)

  // §86.19: many areas must produce a scrollbar INSIDE the list — not a taller
  // panel and not a taller page. The declared model tops out at three areas, so
  // the rows are cloned in the DOM to reach a count the data cannot produce.
  // This is the case that caught a real defect: with an auto-height grid row, a
  // list that outgrows its panel drives the panel, the panel drives the row, and
  // the scrolling ends up on the page.
  const beforeMany = await docH(page)
  const many = await page.evaluate(() => {
    const list = document.querySelector('.io2-area-list')
    const proto = list.children[0]
    for (let i = 0; i < 20; i += 1) list.appendChild(proto.cloneNode(true))
    return null
  })
  void many
  await page.waitForTimeout(250)
  const overflow = await page.evaluate(() => {
    const list = document.querySelector('.io2-area-list')
    const panel = document.querySelector('.io2-a-areas')
    return {
      client: Math.round(list.clientHeight),
      scroll: Math.round(list.scrollHeight),
      panel: Math.round(panel.getBoundingClientRect().height),
      overflowY: getComputedStyle(list).overflowY,
      rows: list.children.length,
    }
  })
  check(overflow.scroll > overflow.client,
    'C10b - with many areas the list overflows its own box (§86.19)',
    `${overflow.rows} rows, scroll ${overflow.scroll} > client ${overflow.client}`)
  check(overflow.overflowY === 'auto',
    'C10c - and that overflow is an internal scrollbar (§7)', overflow.overflowY)
  const scrolled = await page.evaluate(() => {
    const list = document.querySelector('.io2-area-list')
    const at = list.scrollTop
    list.scrollTop = list.scrollHeight
    return list.scrollTop > at
  })
  check(scrolled, 'C10d - which actually scrolls (§7)')
  const afterMany = await docH(page)
  check(afterMany - beforeMany <= 4,
    'C10e - and 20 extra areas did not make the PAGE taller (§7: not page scroll)',
    `${beforeMany} -> ${afterMany}`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2100)

  check(areas && alerts && Math.abs(areas.h - alerts.h) < 4,
    'C11 - areas and alerts span the same two bands', `${areas?.h} vs ${alerts?.h}`)

  const hOver = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))
  check(hOver === 0, 'C12 - no horizontal overflow @1920 (§92.92/§92.95)', `${hOver}px`)
  check(page.errors.length === 0, 'C13 - and no page errors', page.errors.join(' | '))
  await page.ctx.close()
}

// --- §86: areas search, live ---------------------------------------------------
{
  const page = await open({ lang: 'he' })
  await page.ops()

  const rowCount = () => page.evaluate(() => document.querySelectorAll('.io2-area-list > li').length)
  const before = await rowCount()
  check(before === 3, 'C14 - three demo areas before searching', `${before}`)

  check(await page.$('[data-io2-area-search]') !== null, 'C15 - the search field is present (§9)')
  check(await page.$('.io2-areas button[type="submit"]') === null, 'C16 - and there is no SEARCH button (§86.26)')

  // §86.25: typing filters immediately, with no submit and no waiting.
  await page.fill('[data-io2-area-search]', 'מגדל')
  await page.waitForTimeout(120)
  const afterHe = await rowCount()
  check(afterHe === 1, 'C17 - a Hebrew name filters the list in real time (§86.21/§86.25)', `${afterHe}`)

  await page.fill('[data-io2-area-search]', 'ש"ג')
  await page.waitForTimeout(120)
  check(await rowCount() === 1, 'C18 - a typed ASCII quote finds the gershayim name (§11)')

  await page.fill('[data-io2-area-search]', 'DEMO-AREA-03')
  await page.waitForTimeout(120)
  check(await rowCount() === 1, 'C19 - an Area ID filters (§86.23)')

  await page.fill('[data-io2-area-search]', 'zzzz')
  await page.waitForTimeout(120)
  check(await rowCount() === 0, 'C20 - a non-match shows nothing rather than everything')

  await page.fill('[data-io2-area-search]', '')
  await page.waitForTimeout(120)
  check(await rowCount() === 3, 'C21 - clearing the box restores every area')

  // §86.27: a hidden selected area stays selected.
  //
  // The AREA ID is compared, not the row's text. The row also carries a relative
  // "ago" label that advances with the clock, so comparing textContent across a
  // few hundred milliseconds compares the time as well as the identity and fails
  // whenever the second happens to tick over between the two reads.
  const selectedAreaId = () => page.evaluate(() => {
    const el = document.querySelector('.io2-area-row.is-selected')
    return el ? el.querySelector('.io2-val')?.textContent?.trim() ?? null : null
  })
  const areaBeforeFilter = await selectedAreaId()
  check(Boolean(areaBeforeFilter), 'C22a - an area is selected to begin with', String(areaBeforeFilter))
  await page.fill('[data-io2-area-search]', 'zzzz')
  await page.waitForTimeout(150)
  await page.fill('[data-io2-area-search]', '')
  await page.waitForTimeout(150)
  const areaAfterFilter = await selectedAreaId()
  check(areaAfterFilter === areaBeforeFilter,
    'C22 - the selected area survives being filtered out of view (§86.27)',
    `${areaBeforeFilter} -> ${areaAfterFilter}`)

  // §86.28: order is the selector's, not the filter's.
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.io2-area-list .io2-area-sev')].map((e) => e.textContent.trim()))
  const rank = { DANGER: 3, ALERT: 2, SAFE: 1 }
  check(order.every((s, i) => i === 0 || rank[order[i - 1]] >= rank[s]),
    'C23 - sorting is unchanged: severity still descends (§86.28)', order.join('>'))

  check(page.errors.length === 0, 'C24 - no page errors during search', page.errors.join(' | '))
  await page.ctx.close()
}

// --- §87: alert search, live ---------------------------------------------------
{
  const page = await open({ lang: 'he' })
  await page.ops()
  const rows = () => page.evaluate(() => document.querySelectorAll('[data-io2-alert-row]').length)
  const search = await page.$('.io2-filter-search input[type="search"]')
  check(search !== null, 'C25 - the alerts panel has a search input')
  if (search) {
    const all = await rows()
    await search.fill('מסלול')
    await page.waitForTimeout(200)
    const he = await rows()
    check(he > 0 && he < all, 'C26 - a Hebrew query filters the alert list in real time (§87.29/§87.35)',
      `${he} of ${all}`)
    await search.fill('shaar')
    await page.waitForTimeout(200)
    check(await rows() === 0, 'C27 - and a transliteration matches nothing (§87.36)')
    await search.fill('')
    await page.waitForTimeout(200)
    check(await rows() === all, 'C28 - clearing restores the list', `${await rows()} of ${all}`)
  }
  await page.ctx.close()
}

// --- §88 / §89: OPTICAL and the OPT context ------------------------------------
{
  const page = await open()
  await page.ops()

  // Select the camera-known demo alert.
  const knownAlert = seeded.find((a) => a.cameraSourceKnown === true)
  await page.evaluate(() => {
    const el = document.querySelector('[data-io2-filter-lifecycle="ALL"], .io2-filter-row button')
    if (el) el.click()
  })
  await page.waitForTimeout(200)

  const clicked = await page.evaluate((id) => {
    const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(id)}"]`)
    if (!row) return false
    row.click()
    return true
  }, knownAlert.id)
  check(clicked, 'C29 - the camera-known demo alert can be selected', knownAlert.id)
  await page.waitForTimeout(300)

  const opticalState = await page.evaluate(() => {
    const b = document.querySelector('[data-io2-secondary="optical"]')
    return b ? { enabled: b.getAttribute('data-io2-optical-enabled'), disabled: b.disabled } : null
  })
  check(opticalState?.enabled === 'true' && opticalState.disabled === false,
    'C30 - OPTICAL is enabled for it (§88.38)', JSON.stringify(opticalState))

  // §88.44-§88.50: it navigates, and the context arrives and survives a reload.
  await page.click('[data-io2-secondary="optical"]')
  await page.waitForTimeout(1500)
  const url = page.url()
  check(/\/concepts\/industrial\/camera\//.test(url), 'C31 - it navigates to the existing OPT route (§88.44)', url)
  check(url.includes(`cameraId=${knownAlert.sourceId}`), 'C32 - carrying the camera context (§88.45)')
  check(url.includes(`areaId=${knownAlert.areaId}`), 'C33 - the area context (§88.46)')
  check(url.includes('alertId='), 'C34 - the alert id (§88.47)')
  check(url.includes(`trackId=${knownAlert.trackId}`), 'C35 - and the track id (§88.48)')
  check(!url.includes('targetId='), 'C36 - with NO targetId, because the alert has none (§88.49)')

  const shown = await page.evaluate(() => {
    const el = document.querySelector('[data-io2-optctx-camera]')
    return el ? el.textContent.trim() : null
  })
  check(shown === knownAlert.sourceId, 'C37 - OPT displays the camera it was given', shown)
  check(await page.$('[data-io2-optctx="resolved"]') !== null, 'C38 - the context resolved on arrival')
  check(await page.$('[data-io2-optctx-track]') !== null, 'C39 - and the track context is stated (§39)')

  // §89: the radar side is area context and says it is not associated.
  check(await page.$('[data-io2-not-associated]') !== null, 'C40 - the NOT ASSOCIATED label is rendered (§89.54)')
  const noassoc = await page.evaluate(() => document.querySelector('[data-io2-not-associated]')?.innerText || '')
  check(/AREA CONTEXT/i.test(noassoc), 'C41 - labelled AREA CONTEXT (§89.53)', noassoc.slice(0, 60))
  check(/NOT ASSOCIATED/i.test(noassoc), 'C42 - and explicitly not associated (§89.54)')

  const panels = await page.evaluate(() => document.body.innerText)
  check(/RADAR PLOT/.test(panels), 'C43 - the radar plot remains (§89.59)')
  check(/CONTACT TABLE/.test(panels), 'C44 - the contact table remains (§89.58)')
  check(/FEED/.test(panels), 'C45 - the camera feed remains (§89.60)')
  check(/TRACK TABLE/.test(panels), 'C46 - and the track table remains')

  // §89.55/§89.56: nothing was auto-selected on the radar side.
  const selectedTarget = await page.$('.dm-radarplot .is-selected, .dm-targets tr.is-selected')
  check(selectedTarget === null, 'C47 - no radar target is auto-selected on arrival (§89.55/§89.56)')

  // §47: a refresh keeps the context.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const afterReload = await page.evaluate(() => {
    const el = document.querySelector('[data-io2-optctx-camera]')
    return el ? el.textContent.trim() : null
  })
  check(afterReload === knownAlert.sourceId, 'C48 - and a refresh preserves it (§88.50)', afterReload)

  // §48: a broken context is reported, not repaired.
  await page.goto(page.url().replace(/cameraId=[^&]*/, 'cameraId=DEMO-CAM-99'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  check(await page.$('[data-io2-optctx="unavailable"]') !== null,
    'C49 - an unknown camera id reports CONTEXT UNAVAILABLE (§88.51)')
  check(await page.$('[data-io2-optctx="resolved"]') === null,
    'C50 - and nothing was silently substituted for it (§48)')

  check(page.errors.length === 0, 'C51 - no page errors across the OPT round trip', page.errors.join(' | '))
  await page.ctx.close()
}

// --- §88.39 / §34: the disabled path -------------------------------------------
{
  const page = await open()
  await page.ops()
  const radarAlert = seeded.find((a) => a.sourceType === 'radar' && a.lifecycle !== LIFECYCLE.RESOLVED)
  await page.evaluate((id) => {
    const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(id)}"]`)
    if (row) row.click()
  }, radarAlert.id)
  await page.waitForTimeout(300)

  const state = await page.evaluate(() => {
    const b = document.querySelector('[data-io2-secondary="optical"]')
    if (!b) return null
    return {
      disabled: b.disabled,
      enabled: b.getAttribute('data-io2-optical-enabled'),
      reason: b.getAttribute('data-io2-optical-reason'),
      wrapTitle: b.parentElement?.getAttribute('title') || '',
      describedby: b.getAttribute('aria-describedby'),
    }
  })
  check(state?.disabled === true, 'C52 - a radar-only alert leaves OPTICAL disabled (§88.42)')
  check(state?.enabled === 'false', 'C53 - and it says so in the data attribute', state?.reason)
  check(/CAMERA SOURCE NOT IDENTIFIED/i.test(state?.wrapTitle || ''),
    'C54 - the explanation is reachable on hover (§34/§88.40)', state?.wrapTitle)
  check(Boolean(state?.describedby), 'C55 - and is announced to assistive technology (§69)')

  // The disabled button really cannot navigate.
  const before = page.url()
  await page.evaluate(() => document.querySelector('[data-io2-secondary="optical"]')?.click())
  await page.waitForTimeout(600)
  check(page.url() === before, 'C56 - clicking it navigates nowhere (§34)')
  await page.ctx.close()
}

// --- §90: the notes dialog, end to end -----------------------------------------
{
  const page = await open()
  await page.ops()

  // NOTES is absent before RESOLVED.
  const newAlert = seeded.find((a) => a.lifecycle === LIFECYCLE.NEW && a.active)
  await page.evaluate((id) => {
    const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(id)}"]`)
    if (row) row.click()
  }, newAlert.id)
  await page.waitForTimeout(300)
  check(await page.$('[data-io2-secondary="notes"]') === null, 'C57 - NOTES is absent for NEW (§90.61)')

  // Resolve it with a note, which is also how the fixture gains one to read.
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(400)
  await page.selectOption('.io2-dialog-select', 'handled')
  await page.fill('.io2-dialog-note', '  initial note  ')
  await page.click('[data-io2-confirm="resolve"]')
  await page.waitForTimeout(600)

  check(await page.$('[data-io2-secondary="notes"]') !== null, 'C58 - and present once RESOLVED (§90.64)')

  await page.click('[data-io2-secondary="notes"]')
  await page.waitForTimeout(400)
  check(await page.$('.io2-dialog--notes') !== null, 'C59 - the dialog opens (§90.65)')

  const body = await page.evaluate(() => document.querySelector('.io2-dialog--notes')?.innerText || '')
  check(/Handled/i.test(body), 'C60 - the resolve reason is visible (§90.66)')
  check(/initial note/.test(body), 'C61 - the note is visible (§90.68)')
  check(/SESSION-LOCAL/.test(body), 'C62 - SESSION-LOCAL is visible (§90.79)')
  check(!/saved to server|synced/i.test(body), 'C63 - and no backend claim is made (§90.78)')

  // §90.67: the reason is not editable.
  const reasonEditable = await page.evaluate(() => {
    const dl = document.querySelector('[data-io2-notes-reason]')
    if (!dl) return 'missing'
    return Boolean(dl.querySelector('input, select, textarea, [contenteditable="true"]'))
  })
  check(reasonEditable === false, 'C64 - the reason offers no editing control (§90.67)', String(reasonEditable))

  // §90.69-§90.71: edit, cancel, no mutation.
  await page.click('[data-io2-notes-edit]')
  await page.waitForTimeout(200)
  check(await page.$('[data-io2-notes-textarea]') !== null, 'C65 - the pencil opens edit mode (§90.69)')
  const max = await page.getAttribute('[data-io2-notes-textarea]', 'maxlength')
  check(max === '500', 'C66 - the textarea caps at 500 (§90.70)', max)

  await page.fill('[data-io2-notes-textarea]', 'discarded text')
  await page.click('[data-io2-notes-canceledit]')
  await page.waitForTimeout(300)
  const afterCancel = await page.evaluate(() =>
    document.querySelector('[data-io2-notes-body]')?.innerText || '')
  check(/initial note/.test(afterCancel) && !/discarded/.test(afterCancel),
    'C67 - Cancel mutates nothing (§90.71)', afterCancel)

  // §90.72-§90.74: save.
  await page.click('[data-io2-notes-edit]')
  await page.waitForTimeout(200)
  await page.fill('[data-io2-notes-textarea]', '   corrected note   ')
  await page.click('[data-io2-confirm="save-note"]')
  await page.waitForTimeout(400)
  const afterSave = await page.evaluate(() =>
    document.querySelector('[data-io2-notes-body]')?.innerText || '')
  check(afterSave.trim() === 'corrected note', 'C68 - SAVE updates the note and trims it (§90.72/§90.73)', afterSave)

  const stored = await page.evaluate(() => {
    for (const k of Object.keys(sessionStorage)) {
      const v = sessionStorage.getItem(k)
      if (v && v.includes('corrected note')) return k
    }
    return null
  })
  check(Boolean(stored), 'C69 - and sessionStorage holds it (§90.74)', stored || 'not found')

  // §90.80: focus goes back to the control that opened the dialog.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-io2-secondary'))
  check(focused === 'notes', 'C70 - closing restores focus to the NOTES button (§90.80)', String(focused))

  // §90.75: a reload in the same tab keeps the edit.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const survived = await page.evaluate(() => {
    for (const k of Object.keys(sessionStorage)) {
      if ((sessionStorage.getItem(k) || '').includes('corrected note')) return true
    }
    return false
  })
  check(survived, 'C71 - and it survives a reload in the same tab (§90.75)')

  // §90.76/§90.77: the edit is in the operator log.
  const logText = await page.evaluate(() => document.querySelector('.io2-log-scroll')?.innerText || '')
  check(/RESOLVE NOTE EDITED/i.test(logText),
    'C72 - the session log shows the note-edit operator action (§90.77)', logText.slice(0, 120))

  check(page.errors.length === 0, 'C73 - no page errors through the notes flow', page.errors.join(' | '))
  await page.ctx.close()
}

// --- §85 / §21: the session log bug, in the browser ----------------------------
{
  const page = await open()
  await page.ops()

  const logText = () => page.evaluate(() => document.querySelector('.io2-log-scroll')?.innerText || '')
  const clickAlert = async (id) => {
    await page.evaluate((i) => {
      const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(i)}"]`)
      if (row) row.click()
    }, id)
    await page.waitForTimeout(350)
  }

  const a1 = seeded.find((a) => a.areaId === 'DEMO-AREA-01' && a.lifecycle === LIFECYCLE.NEW)
  const a2 = seeded.find((a) => a.areaId === 'DEMO-AREA-02' && a.lifecycle === LIFECYCLE.NEW)

  await clickAlert(a1.id)
  const h0 = await docH(page)
  await page.click('[data-io2-action="acknowledge"]')
  await page.waitForTimeout(500)

  const afterAck = await logText()
  check(/ACKNOWLEDGED/i.test(afterAck), 'C74 - the operator action reaches the log (§85.9)')

  // §85.2: selecting another alert must not remove it.
  await clickAlert(a2.id)
  const afterSwitch = await logText()
  check(/ACKNOWLEDGED/i.test(afterSwitch),
    'C75 - selecting another alert does not remove it in ALL AREAS (§85.1/§85.2)')

  // §85.5: switching between alerts does not rewrite history.
  await clickAlert(a1.id)
  check((await logText()).includes('ACKNOWLEDGED'),
    'C76 - and switching back leaves the history intact (§85.5)')

  // §85.3/§85.6: area scope follows the EVENT's area.
  await page.click('.io2-log-modes button:last-child')
  await page.waitForTimeout(400)
  const areaScoped = await logText()
  check(/ACKNOWLEDGED/i.test(areaScoped),
    'C77 - SELECTED AREA shows the action performed in that area (§85.3)')

  // Choosing a DIFFERENT area filters it out — by event area, not by alert.
  const otherAreaClicked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.io2-area-row')]
    const target = rows.find((r) => r.innerText.includes('DEMO-AREA-02'))
    if (!target) return false
    target.click()
    return true
  })
  await page.waitForTimeout(500)
  if (otherAreaClicked) {
    check(!/ACKNOWLEDGED/i.test(await logText()),
      'C78 - and another area does not show it (§85.6)')
    // §85.7: coming back restores it.
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.io2-area-row')]
      const target = rows.find((r) => r.innerText.includes('DEMO-AREA-01'))
      if (target) target.click()
    })
    await page.waitForTimeout(500)
    check(/ACKNOWLEDGED/i.test(await logText()), 'C79 - switching back restores that area\'s history (§85.7)')
  } else {
    check(false, 'C78 - could not click the second area row')
    check(false, 'C79 - could not return to the first area row')
  }

  // §85.15/§85.16: internal scroll, stable document.
  const scroll = await page.evaluate(() => {
    const el = document.querySelector('.io2-log-scroll')
    if (!el) return null
    const cs = getComputedStyle(el)
    return { overflowY: cs.overflowY, h: Math.round(el.clientHeight), scrollH: Math.round(el.scrollHeight) }
  })
  check(scroll?.overflowY === 'auto', 'C80 - the log scrolls internally (§85.15)', JSON.stringify(scroll))
  const h1 = await docH(page)
  check(h1 === h0, 'C81 - and the document height did not move across every action (§85.16/§20)', `${h0} -> ${h1}`)

  await page.ctx.close()
}

// --- §91: condition state in the rendered UI -----------------------------------
{
  const page = await open()
  await page.ops()
  const regionText = await page.evaluate(() => {
    const el = document.querySelector('.io2-sel-actions')
    return el ? el.innerText : ''
  })
  check(!/CONDITION ACTIVE|CONDITION CLEARED/i.test(regionText),
    'C82 - CONDITION STATE is absent from the selected-alert region (§91.81)', regionText.replace(/\n/g, ' | '))
  check(await page.$('.io2-sel-actions .io2-ab-cond') === null,
    'C83 - and its chip is not rendered there at all')

  // §62: the resolve dialog still warns. Same screen, one click away.
  const activeAlert = seeded.find((a) => a.active && a.lifecycle !== LIFECYCLE.RESOLVED)
  await page.evaluate((id) => {
    const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(id)}"]`)
    if (row) row.click()
  }, activeAlert.id)
  await page.waitForTimeout(300)
  await page.click('[data-io2-action="resolve"]')
  await page.waitForTimeout(400)
  const dlg = await page.evaluate(() => document.querySelector('.io2-dialog--resolve')?.innerText || '')
  check(/THE SOURCE CONDITION IS STILL ACTIVE/i.test(dlg),
    'C84 - the resolve dialog still warns that the condition is active (§91.85/§62)')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.ctx.close()
}

// --- §72 / §73 / §74 / §92: the three widths ------------------------------------
for (const [w, h, label] of [[1920, 1080, '1920'], [1366, 768, '1366'], [1100, 900, '1100']]) {
  const page = await open({ width: w, height: h })
  await page.ops()
  const hOver = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))
  check(hOver === 0, `C85.${label} - no horizontal overflow @${w} (§92.92)`, `${hOver}px`)

  const feed = await box(page, '.io2-a-feed')
  const time = await box(page, '.io2-a-timeline')
  check(time && feed && time.y > feed.y, `C86.${label} - risk/time still follows the feed @${w}`,
    `feed ${feed?.y} time ${time?.y}`)

  const log = await box(page, '.io2-a-log')
  check(log && log.w > 0, `C87.${label} - the session log renders @${w}`, `${log?.w}x${log?.h}`)

  const listFits = await page.evaluate(() => {
    const list = document.querySelector('.io2-area-list')
    if (!list) return null
    return { client: Math.round(list.clientHeight), scroll: Math.round(list.scrollHeight) }
  })
  check(listFits && listFits.client > 0, `C88.${label} - the area list has height @${w}`, JSON.stringify(listFits))
  check(page.errors.length === 0, `C89.${label} - no page errors @${w}`, page.errors.join(' | '))
  await page.ctx.close()
}

// --- §70: both languages render the new controls --------------------------------
for (const lang of ['en', 'he']) {
  const page = await open({ lang })
  await page.ops()
  check(await page.$('[data-io2-area-search]') !== null, `C90.${lang} - the areas search renders in ${lang} (§70)`)
  const known = seeded.find((a) => a.cameraSourceKnown === true)
  await page.evaluate((id) => {
    const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(id)}"]`)
    if (row) row.click()
  }, known.id)
  await page.waitForTimeout(300)
  const label = await page.evaluate(() =>
    document.querySelector('[data-io2-secondary="optical"]')?.textContent?.trim() || '')
  check(label === (lang === 'he' ? 'אופטי' : 'OPTICAL'),
    `C91.${lang} - OPTICAL is labelled correctly in ${lang} (§70)`, label)

  // §64: the fixed region did not start growing with the lifecycle.
  const regionH = await page.evaluate(() =>
    Math.round(document.querySelector('.io2-sel-actions')?.getBoundingClientRect().height || 0))
  check(regionH > 0 && regionH <= 200,
    `C92.${lang} - the selected-alert region keeps one fixed height in ${lang} (§64)`, `${regionH}px`)
  await page.ctx.close()
}

await browser.close()

// ============================================================================
console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}  —  ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
