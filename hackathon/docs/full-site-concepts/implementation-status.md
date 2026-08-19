# Full-Site Concepts — Implementation Status

Updated 2026-07-18 (fourth update: ALL PHASES COMPLETE — A through I).
This file reflects what was verified against the actual files/build/browser at
that time, not what the plan intended. Update it at the end of every phase.

## Done

- **Phase A+B — infrastructure**: registry, shared view models (`data/*`),
  shared domain components (`domain/*`), `concepts-base.css`, About content,
  routing (`ConceptsApp.jsx`, `pages.jsx`). Stable, unchanged this session.
- **Phase C1 — Minimal Command**: 6/6 views present (dashboard, camera,
  history, about, settings, admin) + `minimal.css`. Verified working.
- **Phase C2 — Industrial Ops**: 6/6 views + `industrial.css`. Verified working.
- **Phase C3 — Neural Fusion**: 6/6 views + `neural.css`. Fixed one pre-existing
  lint error this session (`NeuralDashboard.jsx` imported `riskTone` unused).
- **Phase C4 — Sentinel 3D**: was left with only `SentinelShell.jsx` +
  `SentinelDashboard.jsx` from the previous session (build was broken —
  `sentinel.css` and 5 of 6 views did not exist). This session added:
  - `views/SentinelCamera.jsx`, `SentinelInvestigation.jsx`, `SentinelAbout.jsx`,
    `SentinelSettings.jsx`, `SentinelAdmin.jsx`
  - `sentinel.css` (full token/HUD/page CSS the Shell + Dashboard already
    depended on, plus rules for the 5 new views)
  - All 6 routes (`/concepts/sentinel/{dashboard,camera/1,history,about,settings,admin}`)
    verified live in a real browser (Playwright, logged in as admin, backend
    on :5000, Vite dev on :5174): zero console errors, zero page errors.

- **Phase D — review gate**: complete. 24 screenshots (4 concepts × 6 pages,
  frozen `?demo=1&phase=approach`, zero console errors) under
  `docs/full-site-concepts/screenshots/<concept>/`; capture script kept at
  `scripts/phase-d-screenshots.mjs`. Full report: `phase-d-review.md`.
  Verdict: no concept is a reskin — passed. Three review-driven fixes applied:
  legacy Navbar now hidden on `/concepts/*` only (double-navigation removed;
  `concepts-scope` min-height updated to 100vh), `.dm-table-scroll` forced
  `direction:ltr` (RTL scroll anchoring clipped first table columns),
  Industrial About Hebrew tagline/note got `dir="auto"` inside the LTR doc
  header. All re-verified in browser after the fixes.

- **Phase E — Fusion Prime decision**: complete. `fusion-prime-decision.md`
  fixes the per-page inheritance (per the pre-approved direction); no
  materially-different UX alternatives surfaced, so no stop was needed.
- **Phase F — Fusion Prime implementation**: complete. The temporary
  placeholder stubs were replaced with the real concept (`PrimeComingSoon.jsx`
  deleted — it was this session's own stub): `PrimeShell` (clean top bar +
  fixed bottom command strip fed by its own `useAtapisData` poll; the concept
  switcher floats above the strip via a scoped `.c-prime .cs-bar` override),
  full `prime.css` (graphite + restrained gold), and 6 real views —
  dashboard (hero + compact 3D twin beside live camera feed + targets table
  with twin↔table selection sync + why/sparkline/alerts/status/summary),
  camera (large feed + evidence strip + bottom targets/tracks tables + focus
  card), investigation (events risk timeline + filters + split list/details +
  real Reload/Clear-History actions behind ConfirmDialog), about (premium
  narrative order), settings (Minimal structure + display-only "configuration
  checks" advisory panel derived from the draft — includes the C3 baud note;
  save flow and contract untouched), admin (shared UsersManager in Prime
  chrome). All 6 routes verified in a real browser (demo scenario, zero
  console errors); screenshots at
  `docs/full-site-concepts/screenshots/fusion-prime/`.
  `scripts/phase-d-screenshots.mjs` now covers all 5 concepts (30 shots).
  Twin hides ≤767px per the matrix's mobile behavior.

- **Phase G — Comparison Center**: complete. New lazy route `/design-lab/compare`
  (`src/design-lab/CompareCenter.jsx` + `compare.css`): 5 concept cards (name,
  description, nav style, motion, density, 3D, futuristic ★, perf impact,
  pros/cons, recommended use, open-with-demo button) + per-page comparison (6
  page tabs → 5 schematic SVG wireframes side by side with open links).
  Fully static — zero polling/MJPEG/three.js on the page. Entry banner added
  to DesignLabHome; the `/concepts` switcher "Compare" button now points here.
  Old Design Lab routes untouched. Fusion Prime visual critique vs the 4 base
  concepts passed (not a Sentinel reskin; keeps Minimal clarity, Industrial
  operability, Neural "why"). 31 screenshots captured (comparison-home + 5×6)
  via `scripts/phase-d-screenshots.mjs`.
- **Phase H — QA**: complete, 92/93 automated checks passed
  (`scripts/phase-h-qa.mjs`): auth redirect, 30 deep-link routes with zero
  unexpected console/network errors, switcher preserves page+roomId+query,
  Scene chunk absent on settings/compare and loads on prime dashboard,
  48 responsive checks (6 routes × 8 viewports incl. 390×844) with zero
  horizontal overflow, original-site routes clean. The single "failure" is a
  pre-existing legacy artifact: navigating away from `/admin` aborts the old
  Admin page's users fetch and AuthContext logs it (attributed to the next
  page). Not caused by new code; not fixed (active site untouched).
  Lint: all new/changed files clean; only the 4 documented pre-existing
  `data/*` errors remain. Build green. Design-hook note: `overused-font Inter`
  in `src/App.css` is the legacy active-site font — out of scope, documented.
- **Phase I — restore & wrap-up**: complete. `hackathon/.env`
  `RADAR_USE_MOCK` restored to `false` (radar_config.json was already false);
  verified byte-safe rewrite. A backend started BEFORE this restore keeps mock
  until restarted. Site default unchanged; no concept promoted. Final report
  delivered in chat (2026-07-18).

## Fixed incidentally (pre-existing, not Sentinel-specific)

- `registry.jsx` already declared all 5 concepts including `fusion-prime`
  pointing at files that don't exist yet. This isn't just a production-build
  issue — Vite's dev-server import analysis also eagerly resolves every
  `import()` in `registry.jsx`, so the **entire `/concepts/*` app was 500'ing
  in dev for every concept**, not only Sentinel. Added temporary placeholder
  stubs (`fusion-prime/PrimeShell.jsx`, `fusion-prime/PrimeComingSoon.jsx`,
  `fusion-prime/prime.css`, 6 thin `views/Prime*.jsx` files) so the registry
  resolves cleanly in both `npm run dev` and `npm run build`. These stubs
  render an honest "not built yet" placeholder and must be replaced by the
  real Fusion Prime implementation in Phase E/F — do not mistake them for that
  phase's deliverable.
- `useDetections.js` derived each persisted event's `id` from `raw.filename`
  alone. The real persisted detection log has duplicate filenames, which
  caused a React duplicate-key warning **and** ambiguous event selection
  (selecting one event could visually select another with the same id) on
  every concept's Investigation page, not just Sentinel's. Fixed by making
  `id` always include the array index (`${filename}-${index}`); `filename`
  and `imageUrl` are unaffected since they read `raw.filename` directly.

## Known, not fixed this session (pre-existing, out of scope)

- 4 pre-existing `eslint` errors in `data/useArduinoSensor.js`,
  `data/useDetections.js`, `data/useInvestigationViewModel.js`,
  `data/useSettingsViewModel.js` (`react-hooks/set-state-in-effect`,
  `react-hooks/purity`). These predate this session, affect all 5 concepts
  equally, and are stylistic React-compiler findings, not functional bugs —
  left alone to keep this session's diff focused on Phase C4.
- Production build has one pre-existing >500kB chunk warning
  (`Scene-*.js`, the shared three.js digital-twin scene) — inherited from
  Design Lab, not introduced this session.
- `RADAR_USE_MOCK=true` in `hackathon/.env` remains temporarily set (approved
  2026-07-16 for concept-building purposes). **Must be restored to `false`**
  in Phase I per the approved plan — not touched this session.

## Next step

None — the approved plan (Phases A–I) is fully delivered. Open follow-ups if
ever picked up: the user choosing a winning concept; optional dedup of the
Prime shell's second poller; the 4 pre-existing `data/*` lint errors; the
legacy `/admin` fetch-abort console log.
