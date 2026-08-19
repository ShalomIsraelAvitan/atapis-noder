# דוח סיום — Phase A1 · Command Center Layout & A0 Integration
## Industrial Ops — OPS Operational Workflow & Multi-Zone Command Center

**תאריך:** 2026-08-05 · **Scope:** ‏`/concepts/industrial/dashboard` — Frontend/UI בלבד.

---

## 1. סיכום מה בוצע

מסך OPS חובר לתשתית A0 והפך למסך חמ״ל: פאנל **Areas**, מרכז **Operational Alerts** עם מסננים, מונים וחיפוש, **Visual Feed** עם מצלמה כברירת מחדל ולשונית Radar, בחירה תפעולית שמעדכנת את כל הפאנלים, טבלאות מצומצמות, Risk Factors ממוקדים, Session Log דו־מצבי, Empty/Error states, חיווי DANGER חדשה ללא מעבר אוטומטי, ו־Responsive מלא.

**‏87 בדיקות A1 חדשות עוברות, וכל בסיס בדיקות קיים נשמר ללא הרעה.**

לא מומשו — כפי שהורית — פעולות lifecycle, תפריט הקשר, מעבר ל־OPT, צלילים, Mute, הרשאות או persistence שרתי.

---

## 2. גיבוי

```
C:\Users\SADAB\Desktop\ATAPIS-backups\hackathon-before-phaseA1-20260805-191446.zip
גודל: 92.7 MB
```

**exclusions:** `node_modules`, `dist`, `venv`, `.venv`, `__pycache__`, `.vite`, `.cache`, `outputs`, `run-logs`, `logs`, `*.pyc`.
שלושת הגיבויים הקודמים נשמרו ולא נדרסו. לא הועתקו credentials לדוח או ללוגים.

---

## 3. קבצים חדשים (11)

| קובץ | תפקיד |
|---|---|
| `industrial-ops/useIndustrialOpsCommandCenter.js` | שכבת ה־orchestration היחידה |
| `industrial-ops/useDocumentVisible.js` | שחרור ה־feed כשהלשונית ברקע |
| `industrial-ops/components/AreaList.jsx` | פאנל Areas |
| `industrial-ops/components/AlertList.jsx` | רשימת ההתראות + roving tabindex |
| `industrial-ops/components/AlertFilters.jsx` | מסננים, מונים, חיפוש, קיצור `/` |
| `industrial-ops/components/VisualFeedPanel.jsx` | לשוניות, feed יחיד, מצבי שגיאה, Radar |
| `industrial-ops/components/AllCamerasPanel.jsx` | לוח סטטוס — אפס זרמים |
| `industrial-ops/components/NewDangerNotice.jsx` | חיווי DANGER חדשה |
| `industrial-ops/components/OpsTargetsTable.jsx` | טבלת רדאר מצומצמת (מקומית) |
| `industrial-ops/components/OpsTracksTable.jsx` | טבלת מסלולים מצומצמת (מקומית) |
| `scripts/phase-a1-command-center-verify.mjs` | 87 בדיקות |
| `scripts/phase-a1-screenshots.mjs` | לכידת QA חזותי |

## 4. קבצים ששונו (6) — כולם ב־industrial-ops

| קובץ | שינוי |
|---|---|
| `views/IndustrialDashboard.jsx` | הרכבה מחדש; **פס הסטטוס בן 12 התאים והפס התחתון הועתקו כלשונם** |
| `industrial.css` | grid חדש + סגנונות הפאנלים החדשים + responsive |
| `components/DecisionBlock.jsx` | ‏`selected` ו־`otherEvidence` — **props אופציונליים, ברירת מחדל `null` = מבנה זהה** |
| `components/RiskFactorsPanel.jsx` | ‏`areaContext` — **prop אופציונלי, ברירת מחדל `false` = פלט זהה** |
| `alertSelectors.js` | **תוספות בלבד**: `operationalAlerts`, `areaOperationalSummary`, `sortAreasOperational` |
| `demoAlerts.js` | תוספת `demoAlertFixture()` — cache יחיד לטעינת עמוד |
| `scripts/phase-a0-alerts-verify.mjs` | בדיקה 20 עודכנה — ראה §22 |

**‏`TargetsTable.jsx`, `TracksTable.jsx`, `OpenAlerts.jsx`, `CameraFeed.jsx`, `IndustrialShell.jsx` — לא נגעו כלל.**

---

## 5. חיבור A0 ל־UI

```
IndustrialDashboard.jsx  (View / composition בלבד)
   └── useIndustrialOpsCommandCenter(vm, { operator })
          ├── useIndustrialAlerts(A0)   ← reduce, sessionStorage, lifecycle
          ├── useAlertSelection(A0)     ← כללי בחירה + unseen DANGER
          ├── sortAreasOperational(A0)  ← חומרת אזור ומיון
          ├── lifecycleCounts(A0)       ← מונים
          └── תוספות A1: בריאות חיישנים, בחירת מצלמת תצוגה, מיקוד גורמים, פיצול היומן
```

הכלל שנשמר: **אין חישוב מקביל ב־UI.** הבדיקה `01b` מוודאת שה־View אינו קורא ל־`reduceAlerts` / `buildFingerprint` / `deriveCandidates`.
‏`useDashboardViewModel.js` המשותף **לא שונה**.

### הכרעה שנדרשה במהלך העבודה — Demo

ב־Demo מוגדרים שלושה אזורים, ולכן `resolveAreaIdForSource` מחזיר `null` (הוא מסרב לנחש אזור עבור מקור שאינו ממופה). המשמעות: המנוע היה מייצר **אפס** התראות ב־Demo.
הפתרון: ב־Demo ה־snapshot **אינו** מוזן למנוע, וההתראות מגיעות מ־fixture ה־A0 (`demoAlerts.js`) — 12 התראות עם `areaId` אמיתיים, כל החומרות וכל מצבי ה־lifecycle, כולן `isDemo: true`.
**ב־Live המנוע עובד רגיל על ה־snapshot.** לא נעשה שום שינוי ב־`resolveAreaIdForSource` — הסירוב שלו לנחש הוא התנהגות נכונה.

---

## 6. מבנה ה־Grid הסופי

**‏≥1501px** — 12 עמודות, כל area מלבן רציף:

```
'areas areas feed feed feed feed feed feed alerts alerts alerts alerts'
'areas areas feed feed feed feed feed feed alerts alerts alerts alerts'
'targets targets targets tracks tracks tracks factors factors factors timeline timeline timeline'
'log log log log log log log log health health health health'
```

**‏≤1500px** — שתי עמודות בסדר תפעולי: Alerts → Feed → Areas → Targets/Tracks → Factors/Timeline → Log/Health.
**‏≤1200px** — עמודה אחת: Alerts → Feed → Areas → Targets → Tracks → Factors → Timeline → Log → Health.

בדיקות `42`/`43` מאמתות אוטומטית שכל שורה מצהירה על אותו מספר עמודות ושכל area הוא מלבן רציף — **אין area בצורת L**.

---

## 7. התנהגות Areas

לכל אזור: שם, Area ID, חומרה, מספר התראות פעילות, מספר NEW, זמן האירוע האחרון, ו־chip לכל מצלמה ורדאר מוצהרים.

**חומרת אזור** נגזרת **רק** מהתראות ש`active === true` **וגם** ב־lifecycle פתוח:
- DANGER → ALERT → SAFE.
- **‏INFO אינו מקדם אזור ל־ALERT** (בדיקה `23b`).
- **RESOLVED ו־`active:false` אינם קובעים חומרה** (בדיקה `23`).

מיון: חומרה → NEW לפני ACK לפני IN REVIEW → החדש יותר. אזורים שקטים **נשארים ברשימה**, נמוך יותר.
ב־Live מוצג `פריסת אזור יחיד` במפורש, כדי שרשימה בת שורה אחת לא תיקרא כקטומה.
‏chip של מקור סינתטי מוצג `MOCK` באפור — לעולם לא בירוק.

---

## 8. התנהגות Operational Alerts

שתי שכבות לכל שורה:

```
DANGER │ מגדל צפוני │ זוהה נשק על מסלול #4        [DEMO]
מקור המצלמה אינו מזוהה · #4 · 7s · בטיפול · Operator 2 · SESSION-LOCAL
```

- **מצלמה:** תמיד `מקור המצלמה אינו מזוהה` / `CAMERA SOURCE NOT IDENTIFIED`. ‏**CAM-01/CAM-02 לעולם אינם מוצגים כמקור התראה** (בדיקות `07`, `05b`).
- **רדאר:** מותר `RDR-01` — מיפוי מוצהר (בדיקה `08`).
- **מקורות נשארים נפרדים** (בדיקות `09`, `09b`).
- כל שורה שמציגה lifecycle מציגה גם `SESSION-LOCAL` (בדיקה `49`), והמשפט המלא — `תהליך מקומי לסשן — אינו נשמר בשרת` — מופיע ככיתוב הפאנל.
- בשורה הנבחרת: `ראיות פעילות נוספות באזור (N) — ללא שיוך`.

---

## 9. Filters, Counts, Search

מסנני lifecycle: `כל הפעילות · חדשות · אושרו · בטיפול · נסגרו`, ולצדם Area / Severity / Source / Condition / Search / Reset.

**המונים מגיעים מ־`lifecycleCounts` של A0** ומחושבים עם כל המסננים **פרט למסנן ה־lifecycle עצמו** — בחירת "חדשות" אינה מאפסת את שאר הלשוניות (בדיקה `21b`). ‏RESOLVED מחוץ ל־ALL ACTIVE (בדיקה `22`).

חיפוש: Alert ID, Area ID, שם אזור (שתי השפות), message, source ID, Track ID, Target ID; case-insensitive; מזהים ב־`<bdi dir="ltr">`.

**גלילה:** רשימת ההתראות היא **הגלילה הפנימית היחידה** של האזור העליון. אין scroll containers מתחרים סביבה.

---

## 10. Selection

כללי A0 בלבד, ללא חישוב מקביל. ברירת מחדל = ההתראה הפעילה החמורה ביותר; ‏RESOLVED לעולם לא כברירת מחדל; התראה נבחרת שנפתרה **נשארת נבחרת**; אזור שמור שאינו קיים בפריסה הנוכחית נופל בחזרה במקום להצביע על מקום שאינו קיים.

**‏`selected` נפרד מ־`focus`** — חיצים מזיזים פוקוס בלבד, והבחירה אינה משתנה (בדיקות `18`, `18b`).

---

## 11. התנהגות DANGER חדשה

**אין מעבר אוטומטי.** ההתראה עולה לראש המיון, ומופיע banner קבוע עם `role="alert"` ו־`aria-live="assertive"` שמציג אזור, זמן והודעה, עם פעולה `עבור להתראה` / `GO TO DANGER`.
‏`selectedAreaId` ו־`selectedAlertId` אינם משתנים עד לפעולה מפורשת (בדיקות `15`, `16`, `17`).
ב־A1 החיווי **חזותי בלבד — אין צליל.**

---

## 12. Camera fallback

סדר הבחירה: בחירת המשתמש הקודמת אם עדיין חוקית באזור → המצלמה המחוברת הראשונה לפי סדר המיפוי → המצלמה הראשונה המוגדרת עם `CAMERA UNAVAILABLE` → `NO CAMERA AVAILABLE`.

## 13. הוכחה שה־fallback אינו מקור ההתראה

1. כאשר נבחרה התראת מצלמה שמקורה אינו ידוע, מוצג ליד ה־feed: **`תצוגת ברירת מחדל — לא זוהתה כמקור ההתראה`**.
2. הבחירה נשמרת **רק** ב־`selection.lastSelectedCameraId`, לעולם לא ב־`alert.sourceId`.
3. בדיקה `33` קוראת את ה־sessionStorage בפועל ומוודאת שאין התראה שנושאת מזהה מצלמה כמקור.
4. בדיקה `32b` מוודאת ש־`cameraSourceKnown === false` נשמר גם אחרי טעינה מחדש.

## 14. ALL CAMERAS

לוח סטטוס בלבד: Camera ID, sourceKey, מצב, קליטה אחרונה, שגיאה, וכפתור פתיחה. **אפס זרמים** (בדיקות `26`, `26c`).

## 15. הוכחת feed יחיד

| ראיה | תוצאה |
|---|---|
| רכיב feed מותקן בלשונית מצלמה | **בדיוק 1** (בדיקה `25`) |
| מעבר בין מצלמות | נשאר **1** — מחליף, לא מוסיף (בדיקה `28`) |
| ALL CAMERAS | **0** (בדיקה `26c`) |
| לשונית RADAR | **0** (בדיקות `27`, `27b`) |
| `document.hidden = true` | **0** — מפורק, לא מוסתר (בדיקה `29`) |
| בקשות `/video_feed/` בסריקת הלשוניות | **0** |

⚠️ **סייג ביושר:** במחשב הזה אין מצלמה מחוברת, ולכן אלמנט MJPEG חי לעולם אינו נטען — הספירה 0 היא נכונה אך אינה כשלעצמה הוכחה. לכן הבדיקות סופרות את **רכיב ה־feed המותקן** (`.dl-feed`), שקיים גם ב־Demo, ושם הכלל "בדיוק אחד" נבדק בפועל. אימות מול זרם MJPEG אמיתי ממתין לחומרה.

## 16. Radar tab

מפת הרדאר עברה מפאנל קבוע ללשונית `RADAR`, **עם כל היכולות שלה**: true range ticks, lateral ticks, sensor label, legend, corner tag, declutter labels, ‏MOCK DATA / STALE / DISCONNECTED, יחידות וצירים. העמודה נשארה `CLOSING` עם ההסבר שהסגירה היא ביחס לחיישן ולא לשער.
בניתוק: `RADAR DISCONNECTED` + last error + משפט מפורש ש־payload ריק **אינו נתון חדש** (בדיקות `34`, `34b`).

## 17. Camera unavailable

`CAMERA UNAVAILABLE` + Camera ID + sourceKey + state + LAST RX + last error + `RETRY` + `OPEN RADAR`.
**אין מעבר אוטומטי לרדאר** (בדיקה `30b`); המעבר רק בלחיצה מפורשת (בדיקות `31`, `31b`), ומוצג המשפט שנפילת המצלמה היא מידע בפני עצמו.
‏`RETRY` נשמר יחד עם המצלמה שאליה הוא שייך, כך שמעבר לשונית מבטל אותו ולא יורש ניסיון של מצלמה אחרת.

## 18. Controller messages

- **אינם הופכים ל־Operational Alerts** (בדיקה `35`).
- **אינם מקבלים `areaId` מומצא** (בדיקה `36`).
- נשארים ב־Session Log; במצב `אזור נבחר` הם מוצגים בסעיף נפרד: **`אירועי מערכת ללא שיוך — אין אזור בנתוני המקור`**.
- **חיבורם למודל ההתראות נדחה לשלב נפרד**, כפי שהורית.

## 19. Targets / Tracks

**Radar Targets:** ‏ID · Distance · Radial Dir · Closing · Risk. **Camera Tracks:** ‏Track ID · Behavior · Weapon · Risk.
‏Angle, Confidence, px/s ו־Zone **לא נמחקו מהמערכת** — הם פשוט אינם חלק מההחלטה הראשונית.
מומשו כ**טבלאות מקומיות** ולא כ־prop על הטבלאות המשותפות: זו ערובת אי־רגרסיה חזקה יותר מכל ברירת מחדל (בדיקות `37`, `38`, `39`, `39b`).

## 20. Risk Factors

כשנבחרה התראה עם `trackId`/`targetId` מוצגים רק הגורמים של אותו מגע; גורמי מצלמה לעולם אינם מיוחסים להתראת רדאר ולהפך. כשאין מיפוי מספיק מוצגים גורמי האזור עם התג **`הקשר אזורי — ללא שיוך`**. ‏`buildRiskReasons` ו־Risk Logic לא שונו; ניסוח "נקודת ייחוס ללא כיול" נשמר.

## 21. Session Log

שני מצבים — `כל האזורים` / `אזור נבחר` (בדיקות `40`, `40b`). הסינון **תצוגתי בלבד**; המקור נשאר שלם, ‏`role="log"`, הפוקוס והגלילה הפנימית נשמרו, ותקרת 50 הרשומות לא שונתה.

---

## 22. תוצאות כל הבדיקות

| בדיקה | Baseline | אחרי A1 | סטטוס |
|---|---|---|---|
| `npm run build` | ירוק | **ירוק** | ✅ |
| lint (`src/concepts` + `src/design-lab`) | 4 שגיאות, 0 אזהרות | **4 שגיאות, 0 אזהרות** | ✅ ללא הרעה |
| `phase-h-qa.mjs` | 92/93 | **92/93** | ✅ אותו כישלון קיים־מראש |
| `phase-prime-verify.mjs` | 30/30 | **30/30** | ✅ |
| `phase-prime-noregress.mjs` | ללא רגרסיות | **ללא רגרסיות** | ✅ |
| `phase-a0-alerts-verify.mjs` | 64/64 | **64/64** | ✅ |
| `phase-a1-command-center-verify.mjs` | — | **87/87** | ✅ חדש |

הכישלון היחיד ב־phase-h-qa הוא `original /design-lab :: Error fetching users` — קיים־מראש ומתועד בפאזות הקודמות.

### שינוי אחד בבדיקה קיימת — ומדוע

בדיקה `20` ב־`phase-a0-alerts-verify.mjs` קבעה *"אף מודול אינו מייבא את אשכול A0"*. זו הייתה הערובה של **שלב A0**, שבו הקוד נשלח בכוונה **לא מחובר**. חיבורו הוא כל מטרתו של A1, ולכן הבדיקה עודכנה לערובה שעדיין רלוונטית: **אף מודול מחוץ ל־`industrial-ops` אינו מייבא את המנוע**. לא נמחקה — הוצרה.

### שגיאות lint שתיקנתי במהלך העבודה

הוספתי 4 שגיאות ותיקנתי את כולן, כדי לא להחמיר את ה־baseline:
1. `AlertList` — קריאת `ref` בזמן render → ה־roving tabindex נגזר עכשיו ב־render מהבחירה, ללא mirror ל־state.
2. `VisualFeedPanel` — `setState` בתוך effect → מצב ה־retry נשמר יחד עם מזהה המצלמה, ללא effect.
3. `useIndustrialOpsCommandCenter` — import לא בשימוש, ו־`areaCameras` שלא היה ב־`useMemo`.
4. `useIndustrialOpsCommandCenter` — `Date.now()` בתוך `useMemo` → נדחף ל־cache ברמת מודול ב־`demoAlerts.js`.

---

## 23. השוואת Baseline לפני/אחרי

**‏0 קבצים משותפים שונו.** רשימת הקבצים ששונו (§3–4) כוללת אך ורק קבצים תחת `src/concepts/industrial-ops/` ו־`scripts/`.

| היבט | לפני | אחרי |
|---|---|---|
| פס סטטוס (12 תאים) | ללא שינוי | **ללא שינוי** |
| System Decision / Source Evidence | מבנה מאושר | **מבנה זהה** + שורת הקשר ו־שורת `NOT ASSOCIATED` |
| Risk/Time | קיים | **קיים, ללא שינוי** |
| טיפוגרפיה | 15/13/11/10.5/9.5/8.5px | **זהה** — בדיקות `45`, `45b`, `45c` |
| overflow אופקי | 0px | **0px** ב־8 רזולוציות |
| קונספטים אחרים | — | **ללא שינוי** — בדיקות `50`, `50b` + prime-noregress |

### ⚠️ סטייה מדודה שיש לאשר: גלילת עמוד

| רזולוציה | התראות גלויות | יעד ההנחיה | גלילת עמוד |
|---|---|---|---|
| 1920×1080 | **9** | 8–12 ✅ | **592px** |
| 1366×768 | **7** | 6–8 ✅ | **1243px** |

יעדי ההתראות הגלויות הושגו, אך **במחיר גלילת עמוד משמעותית** — ה־Baseline הקודם ב־1920 היה ~74px.
הסיבה: שורת התראה נושאת שלוש שורות מידע אמיתי בעמודה בת 4 עמודות, ולהציג 9 מהן דורש רשימה בגובה 512px. הדרכים היחידות להימנע מכך היו הקטנת טקסט או הסרת מידע מהשורה — **שתיהן אסורות**.
כל הפאנלים נשארים נגישים, קיימת **גלילה פנימית אחת בלבד**, ואין scroll trapping. **אם תעדיף פחות גלילת עמוד על חשבון פחות התראות גלויות — זו החלטה שלך, ושינוי של שורה אחת ב־CSS.**

---

## 24. נתיבי צילומי המסך

```
hackathon\artifacts\industrial-ops-phase-a1\
├── final\        8   — he/en × live/demo × 1920/1366
├── states\      20   — SAFE/ALERT/DANGER, multi-zone, many alerts, no active alerts,
│                       lifecycle filters, search, selected camera/radar alert,
│                       camera source unknown, camera unavailable, radar disconnected,
│                       new DANGER notice, keyboard focus (1920 + 1366)
├── proof\        2   — ALL CAMERAS ו־RADAR עם אפס feeds
├── regression\   4   — fusion-prime / minimal / sentinel / neural (after A1)
└── qa-logs\      8   — build, lint, phase-h-qa, prime-verify, prime-noregress, a0, a1, capture
```

**‏"לפני" לרגרסיה:** צילומי ה־regression של Patch 01 (`artifacts/industrial-ops-ops-upgrade/patch-01/regression/`) הם ה"לפני" התקף — בין Patch 01 ל־A1 לא נגע דבר בארבעת הקונספטים האחרים (‏A0 נשלח לא מחובר).

**מצבים שלא זויפו:** אין מצלמה ואין רדאר במחשב הזה, ולכן צילומי ה־Live מציגים `CAMERA UNAVAILABLE` ו־`RADAR DISCONNECTED` — המצב האמיתי. ‏DANGER מצולם ב־Demo בלבד, מסומן DEMO לכל אורכו.

---

## 25. בעיות שנותרו

1. **גלילת עמוד** — §23. הסטייה המדודה היחידה מההנחיה.
2. **הוכחת feed יחיד חלקית** — §15. נדרשת מצלמה מחוברת לאימות מלא.
3. **בורר העיצובים** מכסה חלקית את שורת הפאנלים התחתונה כשהוא פתוח — קיים־מראש, ניתן לקיפול ב־Alt+0, ואינו אמור להופיע ב־production.
4. **‏`DemoModeBadge` המלא הוחלף בשורת ההתראה בתג `DEMO` קומפקטי** — הבאדג' המלא נשבר לשורה נפרדת וחתך את מספר ההתראות הגלויות בכחצי. כל שאר סימוני הדמו נשמרו במלואם.
5. **‏`SESSION-LOCAL` בשורה מקוצר**, והמשפט המלא מופיע ככיתוב הפאנל ובתיאור ה־tooltip.
6. **הודעות Controller** עדיין אינן במודל ההתראות — לפי הנחייתך.

---

## 26. סיכונים ל־Phase A2

1. **פעולות lifecycle יגדילו את גובה השורה** — כפתורי Acknowledge/Review יתחרו על אותו מקום שכבר לחוץ. שקול שורת פעולות להתראה **הנבחרת בלבד**.
2. **‏Resolve dialog חייב להצהיר `SESSION-LOCAL`** — הנתונים כבר נושאים `persisted:false`; הכשל האפשרי הוא ב־UI שישכח להציג זאת.
3. **הרשאות** — אין זהות בשרת. כל חסימה לפי role ב־A2 תהיה חזותית בלבד וחייבת להיות מסומנת ככזו.
4. **קיצורי A/R/M** — לא מומשו בכוונה. יש לוודא שאינם מתנגשים עם Alt+0..9 ועם ההגנה על שדות קלט.
5. **‏Demo לא ישמור lifecycle** — ב־Demo ההתראות הן fixture ולא עוברות במנוע, ולכן פעולות מפעיל ב־A2 לא יישמרו שם. יש להכריע אם A2 מזין את ה־fixture למנוע.
6. **גובה** — כל תוספת חזותית ב־A2 מגדילה את גלילת העמוד. שווה להכריע על §23 לפני שמתחילים.

---

## 27. אישור מפורש — לא התחלתי Phase A2

לא מומשו: Acknowledge · Start Review · Resolve · Reopen · Resolve dialog · Context menu · Open in OPT · Double-click / Enter ל־OPT · Query params ל־OPT · Sound · WebAudio · Global Mute · Reminder · Permissions · תפקידי operator/supervisor · Server persistence · Alert API · Areas API · Full Alert History · הודעות Controller כמנוע Alert.

## 28. אישור מפורש — מה לא שונה

**לא שונו:** `python/**` כולו (`server.py`, `analysis.py`, `ld2450_reader.py`) · API וחוזי API · routes · `ConceptsApp.jsx` · OPT (`useMonitoringViewModel.js`, `IndustrialCamera.jsx`) · AuthContext · users database · credentials · `.env` · `radar_config.json` · COM · Baud · Risk Logic · ספי 40/75 · `concepts-base.css` · `ConceptSwitcher.jsx` · `IndustrialShell.jsx` · `TargetsTable.jsx` · `TracksTable.jsx` · `OpenAlerts.jsx` · `CameraFeed.jsx` · `useDashboardViewModel.js` · adapter · Fusion Prime · Minimal Command · Sentinel 3D · Neural Fusion · design-lab prototypes.

**בנוסף:** כל ההערות בעברית ב־`industrial.css` נשמרו במלואן וללא שינוי (9 הערות, אומת ברמת code point).
**לא הומצא `cameraId`, לא הומצא `areaId`, ולא נוצר association בין Camera ל־Radar.**
