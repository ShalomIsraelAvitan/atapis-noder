# דוח סיום — Industrial Ops / מסך OPS

**תאריך:** 2026-08-03
**Scope:** `/concepts/industrial/dashboard` בלבד (UI/UX/Frontend).
**גיבוי:** `C:\Users\SADAB\Desktop\ATAPIS-backups\hackathon-src-backup-20260729-223356.zip` (‏407MB, ללא `node_modules`/`dist`).
**תיקיית תוצרים:** `C:\Users\SADAB\Desktop\ATAPIS\hackathon\artifacts\industrial-ops-ops-upgrade\`

---

## 1. סיכום כללי

בוצעו WP0–WP11 במלואם. מסך OPS עבר ארגון מחדש מבני: הפס העליון מנצל את השטח הריק למידע תפעולי אמיתי, נוסף בלוק החלטה דו־חלקי שמפריד בין החלטת המערכת לראיות המקורות, הטבלאות פוצלו לשני פאנלים מתויגי־מקור, מפת הרדאר קיבלה צירים/יחידות/legend/תיוג חיישן, גרף הסיכון עבר לצבע לפי מצב, יומן הסשן קיבל גלילה נשלטת ותיוג מקור, ופאנל התקינות נבנה מחדש עם הבחנה ברורה בין Live ל־Mock.

**כל בסיסי הבדיקות נשמרו ללא הרעה.** אף קונספט אחר לא שונה ויזואלית או התנהגותית.

---

## 2. קבצים שנערכו

### קבצים חדשים (5) — כולם ב־industrial-ops בלבד
| קובץ | תפקיד |
|---|---|
| `src/concepts/industrial-ops/shortcuts.js` | הגנת קיצורים (input/textarea/select/contenteditable/dialog, ‏`repeat`, ‏`isComposing`) + מיפוי פוקוס לפי `data-io2-focus` |
| `src/concepts/industrial-ops/useFreshness.js` | freshness אמיתי פר־מקור (Backend / Radar / Camera / Global) |
| `src/concepts/industrial-ops/components/DecisionBlock.jsx` | ‏SYSTEM DECISION + SOURCE EVIDENCE |
| `src/concepts/industrial-ops/components/RiskFactorsPanel.jsx` | גורמי סיכון עם מקור, גיל, active/stale, ‏+N MORE, וסיכום פר־מקור |
| `artifacts/industrial-ops-ops-upgrade/**` | תיקיית התוצרים |

### קבצים ששונו — industrial-ops בלבד (3)
- `src/concepts/industrial-ops/IndustrialShell.jsx`
- `src/concepts/industrial-ops/industrial.css`
- `src/concepts/industrial-ops/views/IndustrialDashboard.jsx`

### קבצים משותפים ששונו (7) — **כולם additive / default-off**
| קובץ | השינוי | ברירת מחדל |
|---|---|---|
| `domain/TargetsTable.jsx` | props ‏`closingHeader`, `confHeader`, `scrollProps` | `null` → פלט זהה לחלוטין |
| `domain/TracksTable.jsx` | prop ‏`scrollProps` | `null` → פלט זהה |
| `domain/RadarPlot.jsx` | props ‏`trueRangeTicks`, `lateralTicks`, `sensorLabel`, `legend`, `cornerTag`, `declutterLabels` | `false`/`null` → ענף הטבעות הישן נשמר ביט־זהה |
| `domain/RiskTimelineChart.jsx` | props ‏`axisTicks`, `thresholdLabelPos` | `false` / `'end'` → זהה |
| `domain/OpenAlerts.jsx` | prop ‏`showMeta` | `false` → זהה בכל 8 אתרי הקריאה |
| `domain/SensorHealth.jsx` | מבנה חדש + props `fresh`, `backendStatus` | **יובאן יחיד — Industrial בלבד** (אומת ב־grep) |
| `design-lab/shared/useAtapisData.js` | הוספת `link` למחזיר; הוספת `source`/`kind` לאובייקט alert | additive בלבד — צרכנים קוראים `id/time/severity/message` |
| `data/useDashboardViewModel.js` | העברת `link` הלאה | additive |

**סה"כ 15 קבצים.** אין שינוי ב־`concepts-base.css`, ב־`ConceptSwitcher.jsx`, ב־`riskDecision.js`, ב־`candidatePairs.js`, ב־`whyThisRisk.js`, ב־`adapter.js`, ב־routes או בקונספטים אחרים.

---

## 3. שינויים לפי WP

**WP1 — Shell ובורר העיצובים.** הגנת קיצורים מלאה; קיצורים חדשים Alt+0 (קיפול הבורר), Alt+7/8/9 (פוקוס ליומן/מטרות רדאר/מעקבי מצלמה); tooltips לקיצורים ברייל; `:focus-visible` בסרגל; תיקון `calc(100vh - 64px)` → `100vh`; media query לגובה ≤820px; הבורר הפך ל־collapsible עם כפתור DESIGN קבוע ומצב נשמר ב־`sessionStorage`.

**WP2 — Freshness ופס עליון.** ‏`CONTACTS` → `RDR TGTS`; כל תא נושא את שם מקורו בטקסט (`CAM RISK`, `CAM PERSONS`, `CAM WEAPON`, `RDR RISK`, `RDR TGTS`, `RDR LINK`); נוספו `DATA` (LIVE/DEMO/DEMO·OFFLINE/RECONNECTING/OFFLINE) ו־`LAST RX`. **אין LAST EVENT בפס העליון** כנדרש.

**WP3 — בלוק החלטה.** ‏`RiskDecisionHeader` הוסר מהמסך (הוא רונדר כ־`<p>` דיפולטי 16px ללא שום CSS). במקומו שני חצאים: החלטה (מצב, Fused Risk + תווית "מהשרת", הסיבה המרכזית עם תג מקור, DATA + LAST RX) וראיות (CAMERA / RADAR / PAIR, כל אחד בשורה נפרדת). כל מספר/מזהה/יחידה עטוף `<bdi dir="ltr">`.

**WP4 — Grid וטבלאות.** ‏`[ CONTACT TABLE ]` → `[ RADAR TARGETS ]` עם כיתוב `RADAR-ONLY · <provider> · RX <age>`; ‏`[ TRACK TABLE ]` → `[ CAMERA TRACKS ]` עם `CAMERA-ONLY · SPEED IN px/s (IMAGE UNITS)`. שתי הטבלאות בפאנלים נפרדים. Grid עבר ל־named areas.

**WP5 — Risk Factors.** מקור, טקסט, ציון, גיל, מצב stale, ‏`+N MORE` (ללא scroll פנימי מתחרה), וסיכום פר־מקור מוצמד לתחתית.

**WP6 — Radar Plot.** תוקנה סטיית הטבעות (‏2M/4M/6M צוירו ב־60/120/180px בעוד המיפוי הוא `mm/8000·208` — סטייה ~15%); כעת `2 m/4 m/6 m/8 m` במיקום האמיתי. נוספו ציר רוחבי, legend, תיוג `RADAR SENSOR`, corner tag (‏MOCK DATA / RADAR <state> / STALE), ומניעת חפיפת תוויות.

**WP7 — Risk/Time.** צבע הקו עוקב אחרי המצב (ירוק/כתום/אדום) במקום אדום קבוע; תוויות הספים הועברו שמאלה כדי לא להתנגש בנתונים; נוספו תוויות ציר זמן וכיתוב `FUSED RISK — BACKEND · SESSION · THRESHOLDS 40 / 75`.

**WP8 — Session Log.** גלילה פנימית מוגדרת (‏232px / 220px / 190px לפי מסך), ‏`role="log"`, ‏`tabIndex`, פוקוס נראה; עמודת מקור (CAMERA/RADAR/SYSTEM/CONTROLLER); מעברי מצב מודגשים ברקע לפי חומרה; `limit` הועלה ל־50.

**WP9 — System Health.** ‏`[ SENSOR HEALTH ]` → `[ SYSTEM HEALTH ]`, מבנה `Subsystem | State | Mode | Value | Updated`, שורות חדשות Backend ו־Camera. **MOCK מוצג כ־chip אפור נייטרלי ולא בירוק.**

**WP10 — פס תחתון, תנועה, density.** ה־marquee הוחלף בקריאה סטטית; התג משקף מצב אמיתי (LIVE ירוק־תפעולי / DEMO אפור / OFFLINE אדום) — **אדום כבר לא קבוע**; ‏`+N EARLIER — SEE SESSION LOG`; אנימציות קצרות בלבד תחת `prefers-reduced-motion: no-preference`; density spacing-only (comfort מגדיל padding/gaps, בלי שינוי גופן).

---

## 4. שינויי Grid ו־Responsive

| רוחב | פריסה |
|---|---|
| ≥1501px | 12 עמודות: plot (4, פורש 2 שורות) │ targets+tracks (5) │ factors (3); שורה 3: timeline (5) │ health (3) │ log (4) |
| ≤1500px | פס עליון כ־grid של 6 עמודות בשתי שורות מאוזנות; גוף בשתי עמודות: plot│targets, factors│tracks, timeline│health, log ברוחב מלא |
| ≤1200px | עמודה אחת בסדר תפעולי |
| ≤820px גובה | צמצום padding בסרגל, גבהי גלילה נמוכים יותר |

`.dm-table-scroll` תחת `.c-industrial` הוגבל ל־260/210/180px (במקום 320px גלובלי) — יחד עם הפיצול לשני פאנלים זה מוציא את הטבלאות ממלכודת הגלילה הכפולה שגרמה לחיתוך עמודת Risk.

---

## 5. שינויים טיפוגרפיים מדויקים

**לא הוקטן ולא נורמל אף `font-size` קיים.** אין `transform: scale`, אין zoom, אין reset.

| רכיב | קיים | חדש | סיבה |
|---|---|---|---|
| `.io2-rail-foot` | `#666161` | `#8a8a8a` | ניגודיות — **צבע בלבד, הגודל לא נגע** |

**אלמנטים חדשים** (לא הקטנה של קיים), כולם בסקאלת הטקסט המשני המאושרת:
`.io2-block-title` 15px (זהה ל־`.io2-panel-title`) · `.io2-panel-note` 11px · `.io2-strip-sub` 11px · `.io2-ev-line` 13px · `.io2-ev-source`/`.io2-sd-cause-src`/`.io2-rf-src` 11px · `.io2-rf-text` 13px · `.io2-rf-sum dd` 15px / `dt` 10.5px · `.dm-health-row` 13px / `.dm-health-head` 10.5px · `.io2-bar-body` 13px.
אין אף טקסט חדש ב־10px או פחות למעט שתי כותרות טבלה ב־10.5px, שהן בסקאלת כותרות הטבלה הקיימת (9.5px) ואף גדולות ממנה.

---

## 6. שינויי Keyboard

| קיצור | פעולה | סטטוס |
|---|---|---|
| Alt+1..6 | ניווט מקטעים | קיים — **נוספה הגנה** |
| Alt+0 | קיפול/פתיחת בורר העיצובים | חדש (אושר) |
| Alt+7 | פוקוס ל־Session Log | חדש (אושר) |
| Alt+8 | פוקוס ל־Radar Targets | חדש (אושר) |
| Alt+9 | פוקוס ל־Camera Tracks | חדש (אושר) |

**אומת בפועל:** Alt+7/8/9 מעבירים פוקוס לאזור הנכון (`data-io2-focus` = `log` / `radar-targets` / `camera-tracks`); **הגנת ההקלדה עברה** — ‏Alt+1 בתוך שדה קלט בעמוד ההגדרות לא ניווט.

---

## 7. שינויי Live/Demo ואמינות

**Live:** אין `FC-nn`, אין אחוזי שיוך, אין Matched/Confirmed/Associated, אין קו Camera–Radar, אין Gate על מפת הרדאר, אין נתוני רדאר בשורת מצלמה, **ואין Pair Risk בשום מקום**. זוג מוצג רק כ־`CP-nn — Unverified` + בסיס מילולי.
**Demo:** ‏`FC-nn` + אחוז מוצגים רק לצד `DemoModeBadge` באותו אזור חזותי, ובנוסף `DATA DEMO` בפס העליון, `MOCK DATA` על המפה, `DEMO` בפס התחתון ו־`MOCK` ב־System Health.
**Fused Risk:** התווית משמשת אך ורק ל־`snapshot.risks.fused` מה־Backend, ותמיד עם ציון מקור ("מהשרת" / "BACKEND").

---

## 8. שינויי Freshness

`useAtapisData` קיבל `link = { lastSuccessAt, lastFailureAt, failures, source }`. **`lastSuccessAt` זז רק כאשר `/status` באמת ענה** — לא ב־render, לא ב־poll כושל, ולא ב־demo tick. מעבר auto-demo מציג `DEMO · OFFLINE` ולא "עודכן עכשיו". בדמו מאולץ `LAST RX` מציג `—` כי אין ולו קריאה מוצלחת אחת.

**freshness פר־מקור:** גיל הרדאר נלקח מ־`radar.lastUpdateMs` (חותמת ה־payload בשרת) ומוצג **רק כאשר הרדאר מחובר** — כי בזמן ניתוק ה־Backend ממשיך לפרסם payload ריק עם חותמת מתחדשת, כך שהמספר אינו מעיד על נתונים. התוויות הן `RX` / `LAST RX` — **זמן קבלה, לא זמן מדידה**.

---

## 9. החלטת Gate / CLOSING — מה נמצא בקוד

נבדק בקריאה בלבד. המקור האמיתי, `python/ld2450_reader.py:696-700`:

```python
approaching_gate = (
    direction == "approaching"                    # מהירות רדיאלית שלילית = סגירת מרחק אל החיישן
    and abs(angle_deg) <= 45.0                    # בתוך קונוס ±45° סביב ציר החיישן
    and distance_mm <= max(gate_distance_alert_mm * 2, 6000)   # עד ~6 מ' מהחיישן
)
```

כאשר `distance_mm = hypot(x_mm, y_mm)` ו־`angle_deg = atan2(x_mm, y_mm)` — **שניהם נמדדים מראשית החיישן**. נוסחה זהה כ־fallback ב־`analysis.py:448-452`.

**מסקנה: אין שום שער בחישוב.** אין קואורדינטת שער, אין כיול, אין מערכת ייחוס משותפת. המילה "gate" נכנסת רק דרך *שם מפתח הקונפיגורציה* `gate_distance_alert_mm`, שהוא סף מרחק במילימטרים ולא מיקום. הדגל מתאר סגירת מרחק אל **חיישן הרדאר**, בתוך הקונוס הקדמי ובטווח קרוב.

לפי כלל ההכרעה שנקבע, ‏`CLOSING` מותר — והוא מיושם עם tooltip שמנסח את הכלל המלא: *"Radar-only: closing on the radar sensor, within ±45° and under ~6 m. Not a gate — no gate calibration exists."* הערך בתא הוא `YES`/`—`.

**נמצא בנוסף (לא שונה):** `track.approachingGate` של המצלמה (`analysis.py:877`) הוא חישוב **שונה לגמרי** — `dot(heading, vector_to_gate) > 0.70` מול `GATE_POINT = (960, 1080)` בפיקסלים, שאינו מכויל לרזולוציית ה־Dahua (‏H1 ב־CLAUDE.md). הוא מופיע בטקסט של `whyThisRisk.js` כ־"Track #N approaching gate". **לא נגעתי בו** — הוא דיווח נאמן של מה שמנוע ההתנהגות הסיק, הוא בקובץ משותף לארבעה קונספטים נוספים, ושינויו חורג מ־Scope. **מומלץ לטפל בו בנפרד יחד עם כיול H1.**

---

## 10. תוצאות בדיקות

| בדיקה | Baseline | אחרי | סטטוס |
|---|---|---|---|
| `npm run build` | ירוק | ירוק | ✅ |
| lint (`src/concepts` + `src/design-lab`) | 4 שגיאות, 0 אזהרות | **4 שגיאות, 0 אזהרות** | ✅ ללא הרעה |
| `phase-h-qa.mjs` | 92/93 | **92/93** | ✅ אותו כישלון קיים־מראש |
| `phase-prime-verify.mjs` | 30/30 | **30/30** | ✅ |
| `phase-prime-noregress.mjs` | 20/20 | **no regressions** | ✅ |
| overflow אופקי | — | **0px** בכל הצילומים ובכל 8 הרזולוציות | ✅ |
| שגיאות קונסול במסך OPS | — | **0** | ✅ |

> הערה על lint: `npm run lint` מדווח ~400 שגיאות repo-wide מפני ש־eslint סורק גם את `python/venv`, `.venv` ו־`python/dist`. אלה אינם קוד המקור של הפרויקט. הגייט שהופעל הוא על `src/concepts` + `src/design-lab` בלבד, שם ה־baseline המתועד הוא 4.

---

## 11. צילומי מסך

**נתיב מלא:** `C:\Users\SADAB\Desktop\ATAPIS\hackathon\artifacts\industrial-ops-ops-upgrade\`

### baseline/ — 4 צילומים (לפני השינויים)
נוצרו מתוך **הקוד שבגיבוי ה־ZIP**, שהורץ בשרת Vite נפרד (פורט 5175) — כדי שיהיו baseline אמיתי ולא שחזור.
`ops-baseline_1920x1080_he_demo.png` · `ops-baseline_1920x1080_en_demo.png` · `ops-baseline_1366x768_he_demo.png` · `ops-baseline_1366x768_en_demo.png`

### final/ — 6 צילומים
`1920x1080/`: `ops-he-demo-1920x1080.png` · `ops-en-demo-1920x1080.png` · `ops-he-live-1920x1080.png`
`1366x768/`: `ops-he-demo-1366x768.png` · `ops-en-demo-1366x768.png` · `ops-he-live-1366x768.png`

### states/ — 10 צילומים
`ops-safe-idle-demo-1920x1080.png` · `ops-safe-detected-demo-1920x1080.png` · `ops-alert-approach-demo-1920x1080.png` · `ops-danger-armed-demo-1920x1080.png` · `ops-radar-disconnected-live-1920x1080.png` · `ops-radar-disconnected-live-1366x768.png` · `ops-density-compact-demo-1920x1080.png` · `ops-density-comfort-demo-1920x1080.png` · `ops-concept-switcher-open.png` · `ops-concept-switcher-collapsed.png`

### keyboard-focus/ — 4 צילומים
`ops-session-log-focus.png` · `ops-radar-targets-focus.png` · `ops-camera-tracks-focus.png` · `ops-rail-nav-focus.png`

### regression/ — 8 צילומים (לפני ואחרי, קונספטים אחרים בלבד)
`fusion-prime-regression-before/after.png` · `minimal-regression-before/after.png` · `sentinel-regression-before/after.png` · `neural-regression-before/after.png`

### qa-logs/ — 8 קבצים
`baseline-summary.txt` · `lint-baseline.json` · `lint-final.txt` · `build-final.txt` · `phase-h-qa-after.txt` · `prime-verify-after.txt` · `prime-noregress-after.txt` · `capture-final.txt`

### מצבים שלא ניתן היה לצלם — ולא זויפו
| מצב | סיבה |
|---|---|
| **Live עם רדאר מחובר** | ה־LD2450 אינו מחובר למחשב זה. `/api/radar/live` מחזיר `radar_status: DISCONNECTED` ו־`last_error: could not open port 'COM14'`. הצילום `ops-radar-disconnected-live-*` מתעד את המצב האמיתי. |
| **Live עם מצלמה ואדם בפריים** | אין מצלמה מחוברת; אין tracks אמיתיים. |
| **DANGER ב־Live** | דורש נשק/אדם אמיתיים. ה־DANGER מוצג דרך `?demo=1&phase=armed` בלבד, מסומן DEMO. |
| **Radar STALE** | דורש רדאר שמתחבר ואז מפסיק לשדר. הלוגיקה מיושמת (‏>3s → `STALE`, corner tag) אך לא ניתנת להדגמה ללא חומרה. |
| **Backend offline / auto-demo fallback** | דורש הפלת השרת תוך כדי צילום. הלוגיקה מיושמת (`DEMO · OFFLINE`) ולא הודגמה. |

---

## 12. בעיות שנותרו ומגבלות

1. **בורר העיצובים מכסה חלקית את תוויות ציר הזמן של הגרף** כשהוא פתוח ב־1920. הפס התחתון עצמו כבר אינו מכוסה (הוא `sticky` עם `z-index` גבוה יותר, והבורר הוזז ל־`bottom: 58px`). ניתן לקפל ב־Alt+0 / כפתור DESIGN, וב־production הבורר אינו אמור להופיע כלל.
2. **גלילת עמוד של ~74px ב־1920×1080** — זהו ה־gutter השמור לבורר מתחת לפס התחתון. כל התוכן, כולל הפס התחתון, נראה ללא גלילה.
3. **טקסט גורמי הסיכון באנגלית גם בעברית** — `useDashboardViewModel` קורא ל־`buildRiskReasons(snapshot)` בלי `t`. זה קיים־מראש ומשותף לכל הקונספטים; תיקון ידרוש שינוי בקובץ משותף.
4. **"Track #N approaching gate"** — ראה סעיף 9. טענת שער לא מכוילת שמקורה ב־Behavior Engine, בקובץ משותף. **דורש החלטה נפרדת.**
5. `dm-alert--k-connection` הוגדר ב־JS אך ה־CSS מדגיש רק `--k-mode`; מקורות מובחנים בעמודת המקור.

---

## 13. נקודות להמשך

- כיול H1 (‏`FENCE_LINE_Y` / `GATE_POINT` יחסית לרזולוציה) ואיתו ניסוח מחדש של טענת "approaching gate" של המצלמה.
- תרגום `buildRiskReasons` (דורש prop opt-in בקובץ משותף).
- אימות ויזואלי חי כשהחומרה תחובר (רדאר על COM אמיתי, מצלמה).
- החלטה אם לקדם Industrial Ops או Fusion Prime לברירת מחדל.

---

## 14. אישור מפורש — מה לא שונה

מאשר במפורש שלא שונו:
**Backend** · **Risk logic** · **ספי SAFE/ALERT/DANGER** · **API ו־API contracts** · **routes** · **חיבור הרדאר, COM, Baud** · **הגדרות מצלמת Dahua** · **credentials** · **`.env`** · **`python/` כולו כולל `analysis.py`, `ld2450_reader.py`, `server.py`** · **Tracking** · **Behavior Engine** · **Sensor fusion logic** · **מודלי YOLO** · **database / `users.json`** · **authentication** · **run scripts** · **`concepts-base.css`** · **Minimal Command / Sentinel 3D / Neural Fusion / Fusion Prime** · **Comparison Center** · **פרוטוטייפים ישנים ב־`design-lab/concepts/`**.

קבצי `python/` נקראו בלבד, לצורך אימות מקור הנתון של `approaching_gate`.
