# דוח סיום — Patch 01 · Industrial Ops / מסך OPS

**תאריך:** 2026-08-03
**Scope:** `/concepts/industrial/dashboard` בלבד — תיקוני UI/UX ממוקדים, ללא עיצוב מחדש.
**גיבוי חדש:** `C:\Users\SADAB\Desktop\ATAPIS-backups\hackathon-before-patch01-20260803-215735.zip` (‏411.7MB). **הגיבוי הקודם לא נדרס.**
**תוצרים:** `hackathon\artifacts\industrial-ops-ops-upgrade\patch-01\`

---

## 1. סיכום התיקונים

בוצעו כל 10 הליקויים. **המבנה המאושר נשמר** — אותם Grid areas, אותה חלוקת פאנלים, אותה טיפוגרפיה. לא הוקטן אף גודל טקסט קיים.

| # | ליקוי | תיקון |
|---|---|---|
| 4 | `ALL SYSTEMS NOMINAL` בזמן שהרדאר מנותק | מצב המערכת מחושב מתקינות תתי־המערכות בפועל |
| 5 | `DATA LIVE` נקרא כאילו כל המערכת תקינה | הפרדה מלאה בין Data Link, Operational Coverage ו־Threat State |
| 6 | הפס התחתון הציג `Person detected` בזמן DANGER | בחירת האירוע לפי חומרה, לא לפי סדר כרונולוגי |
| 7 | הבורר מכסה תוכן במסכים קטנים | מקופל כברירת מחדל ב־≤1500px או ≤820px גובה |
| 8 | הפס התחתון נעלם בגלילה ב־1366 | מוצמד לתחתית ה־viewport, עם שטח שמור |
| 9 | הודעת COM ארוכה נשברת ונחתכת | סיכום קצר + `<details>` נגיש למקלדת |
| 10 | `approaching gate` כטענה מכוילת | ניסוח "נקודת ייחוס" + תג `ללא כיול` |
| 11 | `ALERT ≥40` נקרא כ־240 | ריווח + הילה כהה + הדגשה |
| 12 | גורמי הסיכון באנגלית בממשק העברי | תרגום opt-in ל־Industrial בלבד |
| 13 | `Direction` ו־`Gate` נראו ככפילות | `RADIAL DIR` / `כיוון רדיאלי` + tooltips |

---

## 2. קבצים

### חדשים (2) — industrial-ops בלבד
- `src/concepts/industrial-ops/events.js` — דירוג חומרת אירועים לפס התחתון
- `src/concepts/industrial-ops/reasons.js` — תרגום + ניסוח "ללא כיול" לגורמי הסיכון

### שונו — industrial-ops בלבד (5)
`IndustrialShell.jsx` · `useFreshness.js` · `industrial.css` · `views/IndustrialDashboard.jsx` · `components/DecisionBlock.jsx` · `components/RiskFactorsPanel.jsx`

### שונו — משותפים (4), **כולם additive / default-off**
| קובץ | תוספת | ברירת מחדל |
|---|---|---|
| `domain/TargetsTable.jsx` | prop `directionHeader` + tooltips | `null` → פלט זהה |
| `domain/TracksTable.jsx` | prop `uncalibratedRefNote` | `null` → פלט זהה |
| `domain/RiskTimelineChart.jsx` | ריווח בתוויות הספים | טקסט בלבד; הספים 40/75 ללא שינוי |
| `domain/SensorHealth.jsx` | `shortRadarError` + `<details>` | **יובאן יחיד — Industrial בלבד** |

**‏`useAtapisData.js` לא נגע בפאטץ' זה.** לא נגעתי ב־`concepts-base.css`, ב־routes, או בקונספטים אחרים.

**כל ההערות בעברית בקוד נשמרו כלשונן** — לא נמחקה ולא שונתה אף אחת מהן.

---

## 3. כיצד מחושב NOMINAL / DEGRADED

ב־`useFreshness.js`, מרשימת תקלות שנבנית מסטטוסים אמיתיים שכבר קיימים ב־Frontend:

```
faults ← מצלמה מנותקת | רדאר מושבת/מנותק/STALE | בקר לא נמצא
```

ואז, לפי סדר העדיפות שנקבע:

| תנאי | מצב | גוון |
|---|---|---|
| `backendStatus === 'offline'` | `BACKEND OFFLINE` | אדום |
| שני חיישנים ראשיים למטה (מצלמה **וגם** רדאר) | `NO SENSOR COVERAGE` | אדום |
| קיימת תקלה כלשהי | `COVERAGE DEGRADED` | כתום |
| אין תקלות | `ALL SYSTEMS NOMINAL` | ירוק |

לתא הצר בפס העליון יש גרסה מקוצרת (`OFFLINE` / `NO COVERAGE` / `DEGRADED` / `NOMINAL`), ובפס התחתון מוצג הניסוח המלא **עם רשימת התקלות בפועל**:

```
LINK LIVE · NO SENSOR COVERAGE — CAMERA DOWN · RADAR DISCONNECTED · CONTROLLER NOT FOUND
```

**לא הומצא שום נתון בריאות.** כל תקלה נגזרת משדה קיים: `cameras.*.connected`, `radar.connected`/`radar.enabled`/`lastUpdateMs`, `sensor.connected`, `backendStatus`.

---

## 4. כיצד נבחר האירוע בפס התחתון

`events.js :: pickHeadlineAlert` סורק את 12 האירועים האחרונים ובוחר את בעל הדירוג הגבוה ביותר; שוויון נשבר לטובת החדש יותר (המערך ממוין newest-first).

| דירוג | קטגוריה |
|---|---|
| 100 | נשק |
| 90 | מעבר ל־DANGER |
| 80 | מעבר ל־ALERT |
| 70 | כשל תת־מערכת (קישור אבד / נותק / לא נמצא) |
| 60 | Degraded |
| 50 | פעולת מפעיל |
| 40 | מעבר מצב אחר |
| 20 | זוהה אדם |
| 10 | מידע |

**אומת בצילום DANGER:** הפס מציג `22:26:57 CAMERA DANGER Weapon detected: weapon` למרות ש־`Person detected` הגיע אחריו. ה־timestamp הוא של האירוע האמיתי — אין הצגת אירוע ישן כאילו קרה עכשיו. **מנגנון יצירת האירועים לא נגע**, ו־Session Log ממשיך להציג הכול.

---

## 5. ההפרדה בין Threat State ל־System State ל־Data State

שלושה מדדים בלתי תלויים, כל אחד עם מקום ומילון משלו:

| ציר | מקור | ערכים | היכן |
|---|---|---|---|
| **Threat** | `snapshot.mode` מה־Backend | SAFE / ALERT / DANGER | `SYS MODE`, ‏System Decision |
| **System** | תקינות תתי־מערכות (חישוב Frontend מסטטוסים קיימים) | NOMINAL / DEGRADED / NO COVERAGE / BACKEND OFFLINE | תא `COVERAGE`, פס תחתון |
| **Data** | מקור הנתונים בפועל | LIVE / DEMO / DEMO·OFFLINE / RECONNECTING / OFFLINE | תא `DATA`, תג הפס התחתון |

בצילום ה־Live המצורף רואים את שלושתם יחד ובלי סתירה: **‏SYS MODE SAFE** (אין איום) לצד **‏COVERAGE NO COVERAGE** באדום (החיישנים למטה) לצד **‏DATA LIVE** (הנתונים אמיתיים). ‏SAFE כבר לא יכול להיקרא כאישור שהחיישנים פעילים.

---

## 6. כיצד טופל Camera approaching gate ללא שינוי Backend

`analysis.py` לא נגע. השינוי הוא **בשכבת ההצגה של Industrial בלבד**:

`reasons.js` קורא ל־`buildRiskReasons(snapshot, t)` — הפונקציה המשותפת, עם המתרגם של הקונספט — ואז מחליף את הטקסט לפי מפתח הסיבה:

| מפתח | לפני | אחרי (EN) | אחרי (HE) |
|---|---|---|---|
| `appr-N` | `Track #N approaching gate` | `Track #N approaching configured reference point` | `מסלול #N מתקרב לנקודת ייחוס מוגדרת` |
| `radar-gate-N` | `Radar TN near gate axis` | `Radar TN closing inside sensor reference cone` | `רדאר TN מתקרב בתוך קונוס הייחוס של החיישן` |

בכל מקום שבו הטענה מופיעה מתווסף תג **`ללא כיול` / `UNCALIBRATED`** עם tooltip שמסביר בדיוק מה מקורה: נקודת ייחוס במרחב התמונה (מצלמה) או קונוס החיישן (רדאר), ושאין במערכת שער מדוד ואין כיול מצלמה–רדאר.

הופעל ב־**System Decision**, ב־**Source Evidence** (שורת המצלמה), ב־**Risk Factors**, וב־**Camera Tracks** (דרך prop חדש `uncalibratedRefNote` עם ברירת מחדל `null`). הערך המקורי, החישוב וה־Risk לא שונו.

---

## 7. התנהגות בורר העיצובים לפי רזולוציה

`IndustrialShell.jsx`:

1. קיימת בחירה מפורשת ב־`sessionStorage['io2-switcher-open']` → **היא מנצחת תמיד**.
2. אין בחירה שמורה → `matchMedia('(max-width: 1500px), (max-height: 820px)')`; אם מתקיים — **מקופל**.
3. אחרת (למשל 1920×1080) — פתוח.

‏Alt+0 והכפתור `DESIGN` ממשיכים לעבוד ושומרים את הבחירה. **אומת בצילום:** ב־1366×768 הבורר מקופל מלכתחילה; ב־1920×1080 הוא פתוח ואינו חופף לפס התחתון.

---

## 8. כיצד הפס התחתון נשאר גלוי

**הבעיה שנמצאה:** ‏`.concepts-scope` ב־`concepts-base.css` משתמש ב־`clip-path: inset(0 -100vmax)` כדי לפרוש את הרקע. `clip-path` הופך את האלמנט ל־containing block עבור צאצאי `fixed`/`sticky` — ולכן ההצמדה של הפס פשוט לא עבדה, והוא נשאר בזרימה בתחתית המסמך.

**התיקון (scoped ל־`.c-industrial` בלבד, ‏`concepts-base.css` לא נגע):**
- ‏`clip-path: none; box-shadow: none; background: var(--cx-bg); overflow-x: clip` — Industrial צובע את הרקע בעצמו.
- `.io2-bar { position: fixed; bottom: 0; z-index: 82 }` עם היסט 200px לצד הסרגל **לפי כיוון ה־scope** (`[dir='rtl']` / `[dir='ltr']`) — הפס עצמו הוא `dir="ltr"`, ולכן היסטים לוגיים היו נפתרים לצד ההפוך.
- `.io2-dashboard { padding-bottom: 52px }` — שטח שמור כדי שהפס לא יכסה פאנל.
- ≤1023px — הפס נפרש לרוחב מלא (הסרגל הופך אופקי).

**מדידה בפועל:**

| רזולוציה | scroll top | middle | bottom | חפיפה עם הבורר | overflow אופקי |
|---|---|---|---|---|---|
| 1920×1080 | גלוי | גלוי | גלוי | אין | 0px |
| 1366×768 | גלוי | גלוי | גלוי | הבורר מקופל | 0px |

---

## 9. תוצאות בדיקות

| בדיקה | Baseline | אחרי Patch | סטטוס |
|---|---|---|---|
| `npm run build` | ירוק | **ירוק** | ✅ |
| lint (`src/concepts` + `src/design-lab`) | 4 שגיאות, 0 אזהרות | **4 שגיאות, 0 אזהרות** | ✅ |
| `phase-h-qa.mjs` | 92/93 | **92/93** — אותו כישלון קיים־מראש ב־`/design-lab` | ✅ |
| `phase-prime-verify.mjs` | 30/30 | **30/30** | ✅ |
| `phase-prime-noregress.mjs` | ללא רגרסיות | **ללא רגרסיות** | ✅ |
| שגיאות Console במסך OPS | — | **0** | ✅ |
| overflow אופקי | — | **0px** בכל 20 הצילומים | ✅ |

לא תוקנו שגיאות ה־lint שמקורן ב־`venv`/`dist`, ולא שונו ה־global ignores.

---

## 10. צילומי מסך

**נתיב:** `hackathon\artifacts\industrial-ops-ops-upgrade\patch-01\`

**baseline/** (8) — המצב לפני ה־Patch, ‏1920/1366 × עברית/אנגלית × live/demo. *(צילומי WP0–WP11 המקוריים לא נדרסו.)*

**final/** (3) — `ops-patch-he-live-degraded-1920x1080` · `ops-patch-en-live-degraded-1920x1080` · `ops-patch-he-live-degraded-1366x768`

**states/** (13) — `ops-patch-he-alert-demo-1920x1080` · `ops-patch-he-danger-demo-1920x1080` · `ops-patch-bottom-bar-scroll-{top,middle,bottom}-1366x768` · `ops-patch-switcher-default-collapsed-1366x768` · `ops-patch-switcher-open-1366x768` · `ops-patch-system-health-short-error` · `ops-patch-system-health-error-details` · `ops-patch-risk-factors-hebrew` · `ops-patch-camera-reference-uncalibrated` · `ops-patch-risk-threshold-labels` · `ops-patch-radar-columns`

**regression/** (4) — `{fusion-prime,minimal,sentinel,neural}-regression-after-patch01`

**qa-logs/** (6) — build · lint · phase-h-qa · prime-verify · prime-noregress · capture

### מצבים שלא צולמו — ולא זויפו
| מצב | סיבה |
|---|---|
| Live עם רדאר מחובר | ה־LD2450 אינו מחובר; ‏`/api/radar/live` מחזיר `DISCONNECTED` + `could not open port 'COM14'` |
| Live DANGER | דורש אדם ונשק אמיתיים. DANGER מוצג רק ב־Demo ומסומן ככזה |
| Radar STALE | דורש רדאר שמתחבר ואז מפסיק לשדר. הלוגיקה קיימת ולא הודגמה |
| Backend offline / auto-demo | דורש הפלת השרת תוך כדי צילום |

צילומי ה־`live-degraded` הם **Live אמיתי** עם `COVERAGE: NO COVERAGE` — בדיוק המצב שהמכונה נמצאת בו.

---

## 11. בעיות שנותרו

1. **‏`overflow-x: clip` על `.c-industrial`** — נדרש כדי לנטרל את ה־`clip-path` שחסם את הצמדת הפס. הרקע נפרש כעת דרך `background` רגיל. אין לכך השפעה שנצפתה, אך זה הבדל מהמנגנון של שאר הקונספטים.
2. **טקסט "gate" בעמודת Zone** — ‏`track.zone` מגיע מה־Backend עם הערך `gate`. זהו שם אזור מהמנוע, לא טענת התקרבות, ולכן לא שוניתי אותו; התג `ללא כיול` באותה שורה מסייג את ההקשר.
3. **`COVERAGE NOMINAL` ב־Demo** — נתוני הדמו מדווחים שכל תתי־המערכות למעלה, ולכן NOMINAL נכון *עבור נתוני הדמו*; ‏`DATA DEMO` צמוד אליו.
4. **המלצה שלא בוצעה** (מחוץ ל־Scope): כיול H1 (`FENCE_LINE_Y`/`GATE_POINT` יחסית לרזולוציה). עד שיבוצע, תג `ללא כיול` הוא הכיסוי הנכון.

---

## 12. אישור מפורש — מה לא שונה

מאשר במפורש שבמסגרת Patch 01 **לא שונו**:
**Backend** · **Risk logic** · **API ו־API contracts** · **thresholds (40/75)** · **`python/` כולו** (`analysis.py`, `ld2450_reader.py`, `server.py`) · **Tracking** · **Behavior Engine** · **Radar logic** · **Sensor Fusion** · **הגדרות מצלמה** · **credentials** · **`.env`** · **COM / Baud** · **routes** · **מודלי YOLO** · **`concepts-base.css`** · **Minimal Command / Sentinel 3D / Neural Fusion / Fusion Prime** · **Comparison Center** · **פרוטוטייפים ישנים**.

בנוסף: **כל ההערות בעברית בקוד נשמרו במלואן וללא שינוי.**
