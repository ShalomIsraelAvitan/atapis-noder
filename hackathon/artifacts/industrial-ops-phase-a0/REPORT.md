# דוח סיום — Phase A0 · Data Foundations
## Industrial Ops — OPS Operational Workflow & Multi-Zone Command Center

**תאריך:** 2026-08-04 · **Scope:** `src/concepts/industrial-ops/` — לוגיקה ונתונים בלבד.
**מסמך המפרט המחייב:** `artifacts/industrial-ops-phase-a0/SPEC.md` (נכתב לפני המימוש).

---

## 1. סיכום קצר

נבנתה תשתית הנתונים והלוגיקה שעליה ייבנה מסך החמ״ל: מודל אזורים מוצהר, מנוע התראות עם זהות דטרמיניסטית ו־deduplication, מחזור חיים מקומי, בעלות לסשן, אחסון ב־sessionStorage עם schema version, מיון, מסננים, חיפוש וכללי בחירה — **כולם כפונקציות טהורות**.

**ה־Baseline החזותי לא נגע, ולא יכול היה לגעת:** אף רכיב קיים אינו מייבא את המודולים החדשים. זה לא הבטחה אלא **נבדק אוטומטית** (בדיקה 20) וגם אומת מול חותמות הזמן של כל קובץ בפרויקט.

לא בוצע חיבור ל־`IndustrialDashboard`. ההנחיה התירה חיבור מינימלי "רק אם אינו משנה את ה־UI" — ויתרתי עליו במכוון: הוא לא היה מוסיף כלום לאימות (ה־round-trip של האחסון נבדק דרך serialization, כפי שדרשה בדיקה 11) והיה מכניס סיכון מיותר ל־Baseline מאושר. החיבור שייך ל־Phase A1.

---

## 2. נתיב הגיבוי

```
C:\Users\SADAB\Desktop\ATAPIS-backups\hackathon-before-phaseA0-20260804-223619.zip
גודל: 92.7 MB
```

הוחרגו: `node_modules`, `dist`, `venv`, `.venv`, `__pycache__`, `.vite`, `.cache`, `outputs`, `run-logs`, `logs`, `*.pyc`.
**שני הגיבויים הקודמים לא נדרסו** (‏`hackathon-src-backup-20260729`, ‏`hackathon-before-patch01-20260803`).
לא שונו credentials ולא הועתקו ללוגים או לדוח.

---

## 3. קבצים שנוצרו ושונו

### נוצרו (8) — כולם חדשים לחלוטין
| קובץ | תפקיד |
|---|---|
| `src/concepts/industrial-ops/areas.js` | מודל אזורים, mapping מוצהר, resolveAreaIdForSource |
| `src/concepts/industrial-ops/alerts.js` | מנוע ההתראות: candidates, fingerprint, reduce, lifecycle |
| `src/concepts/industrial-ops/alertStorage.js` | sessionStorage v1, serialize/deserialize, fallback בטוח |
| `src/concepts/industrial-ops/alertSelectors.js` | מיון, מסננים, מונים, חיפוש, כללי בחירה |
| `src/concepts/industrial-ops/useAlertSelection.js` | שתי עטיפות React דקות (לא מחוברות לאף View) |
| `src/concepts/industrial-ops/demoAlerts.js` | 12 התראות Demo, ‏`isDemo: true` |
| `scripts/phase-a0-alerts-verify.mjs` | 64 בדיקות המכסות את 20 התרחישים |
| `artifacts/industrial-ops-phase-a0/SPEC.md` | המפרט המחייב |

### שונו — **אפס קבצים קיימים**

אומת בשתי דרכים בלתי תלויות:
1. **בדיקה 20** סורקת כל קובץ `.js`/`.jsx` תחת `src/` ומוודאת שאף אחד מחוץ לאשכול אינו מייבא אותו → 0 מייבאים.
2. סריקת `LastWriteTime` על `src/` ו־`scripts/` → הקבצים היחידים ששונו הם 7 החדשים.

לא נגעו: `python/**` · `.env` · `radar_config.json` · thresholds · routes · `ConceptsApp.jsx` · `concepts-base.css` · `IndustrialShell.jsx` · `IndustrialDashboard.jsx` · `industrial.css` · `useMonitoringViewModel.js` · `CameraFeed.jsx` · `TargetsTable.jsx` · `TracksTable.jsx` · `OpenAlerts.jsx` · קונספטים אחרים.

---

## 4. מודל ה־Area הסופי

**Live — אזור אחד, מיפוי מוצהר ולא נגזר:**

```
AREA-01 · "Primary Site" / "אתר ראשי"
  deploymentMode : 'single-area'
  isDemo         : false
  cameras        : CAM-01 ← webcam , CAM-02 ← dahua
  radars         : RDR-01
  primaryCameraId: null          ← אין source of truth, לא הומצא
```

**Demo — 3 אזורים** (`DEMO-AREA-01/02/03`), כולם `isDemo: true`, מקורות `mock` בלבד.

המבנה מוכן ל־N אזורים כדי שהחלפה ל־`/api/areas` בעתיד תהיה החלפת מקור נתונים ולא כתיבה מחדש. **ה־endpoint לא מומש.**

‏`resolveAreaIdForSource` הוא **חיפוש במיפוי המוצהר**; מקור שאינו במיפוי מחזיר `null`, ואין fallback ל"אזור הראשון".

---

## 5. מודל ה־Alert הסופי

```
id, fingerprint, instanceSeq
areaId, areaIsDemo
severity (info|alert|danger)          ← חומרה
active, clearedAt                     ← מצב התנאי
lifecycle (NEW|ACKNOWLEDGED|IN_REVIEW|RESOLVED)   ← מחזור חיים תפעולי
sourceState (LIVE|DISCONNECTED|STALE|DISABLED|ERROR|UNKNOWN)  ← מצב המקור
kind, sourceType, sourceId, cameraSourceKnown
message, messageHe, trackId, targetId
firstSeenAt, lastSeenAt, observedFromSessionStart, reactivationCount
owner, acknowledgedAt, reviewStartedAt, resolvedAt, reopenedAt
resolveReason, resolveNote, actionLog[]
sourceEvidence[], otherActiveEvidenceInArea[]
persisted: false, sessionLocal: true
isDemo, demoScenarioId
```

**ארבעת הצירים מופרדים לחלוטין.** זה העיקרון המרכזי של הפאזה: התראה שהתנאי שלה חדל להתקיים מסומנת `active:false` אך **נשארת `NEW`** — היא קרתה, ואיש לא טיפל בה. רק מפעיל משנה `lifecycle`.

`persisted:false` ו־`sessionLocal:true` נאכפים גם **בטעינה מחדש** מהאחסון, כך שערך שנערך ידנית ב־storage אינו יכול לטעון שהוא נשמר בשרת.

---

## 6. כללי fingerprint ו־deduplication

`Date.now()` **אינו** מזהה. הזהות היא fingerprint דטרמיניסטי:

```
fingerprint = areaId | sourceType | kind | discriminator
id          = fingerprint#instanceSeq
```

| משפחה | discriminator |
|---|---|
| נשק על מסלול | `track:<id>` |
| נשק ללא מסלול | `track:none` |
| התנהגות | `track:<id>:<state>` |
| נוכחות | `track:<id>` |
| קישור רדאר | `RDR-01:<linkState>` |
| מטרת רדאר | `RDR-01:target:<id>` |
| מצב מערכת | `<mode>` |

**שלוש החלטות מכוונות:**
- מצב החיבור בתוך ה־fingerprint → `DISCONNECTED` ואחריו `STALE` הן שתי התראות (כפי שההנחיה דרשה).
- ה־mode בתוך ה־fingerprint → **ALERT → DANGER פותח התראה חדשה** וסוגר את הישנה; ההסלמה נשארת גלויה במקום להידרס.
- ה־state בתוך fingerprint של התנהגות → מעבר `running` → `loitering` הוא אירוע תפעולי נפרד.

---

## 7. פתיחה · עדכון · סגירה · הפעלה מחדש

| מצב | פעולה |
|---|---|
| fingerprint לא קיים | פתיחה: `NEW`, ‏`firstSeenAt = lastSeenAt = now`, ‏`instanceSeq: 1` |
| קיים ופעיל | עדכון: `lastSeenAt`, ‏message, ‏evidence. **lifecycle / owner / firstSeenAt לא נוגעים** |
| קיים, נסגר, פער ≤ 15s | הפעלה מחדש של אותו מופע: אותו `id`, אותו lifecycle, ‏`reactivationCount++` |
| קיים, נסגר, פער > 15s | מופע חדש: `instanceSeq++`, ‏`id` חדש, חזרה ל־`NEW` |
| פעיל אך לא במועמדים | סגירה: `active:false`, ‏`clearedAt`. **lifecycle לא משתנה** |

### ⚠️ `REACTIVATION_WINDOW_MS = 15000` — קבוע שנבחר הנדסית וטעון אישורך

זהו הערך היחיד בפאזה שאין לו מקור אמת מבצעי. הנימוק: ה־poll הוא 1s ו־STALE של הרדאר הוא 3s (`useFreshness.js`), ולכן פער של 15s כבר אינו רעש. הוא מיוצא ממקום אחד וניתן לשינוי בשורה אחת.
**הוא אינו ה־reminder interval מסעיף 28 של ההנחיה — זה לא מומש כלל**, בהיעדר source of truth.

**כניסה לדף כשהמערכת כבר ב־DANGER:** ההתראה נפתחת עם `observedFromSessionStart: true`, והשדה נקרא `firstSeenAt` — *נראה לראשונה*, לא "החל". אין ידיעה מתי התנאי באמת התחיל ולא מוצגת כזו.

---

## 8. מבנה ה־sessionStorage

```
key    : industrial-ops-alert-state-v1
schema : { v: 1, savedAt, isDemo, alerts[], selection{}, filters{} }
```

- **sessionStorage בלבד**, לא localStorage: רענון באותה לשונית משמר את ה־workflow; לשונית חדשה מתחילה נקי.
- `deserializeState` **לעולם אינו זורק**. JSON פגום / `v` שונה / `alerts` שאינו מערך / storage חסום → `null`, והקורא מתחיל ריק.
- רשומה בודדת פגומה נזרקת לבדה — שאר ההתראות עדיין נטענות.
- **‏`isDemo` שמור ≠ `isDemo` נוכחי → כל המצב נזרק.** כך נתוני Demo ו־Live לא יכולים להתערבב.
- `lastSelectedCameraId` נשמר כ**בחירת UI בלבד** ואינו מקור התראה.
- תקרת שמירה: 200 התראות; RESOLVED שנסגרו נזרקות ראשונות.

---

## 9. התנהגות Selection

1. ברירת מחדל: ההתראה הפעילה החמורה ביותר — DANGER לפני ALERT, ‏NEW לפני ACKNOWLEDGED לפני IN_REVIEW, ובתוך אותה רמה החדשה יותר.
2. **RESOLVED לעולם אינה ברירת מחדל.**
3. אין התראות פעילות → נשארים באזור האחרון; אם אין — האזור היחיד.
4. אזור שמור שאינו קיים בפריסה הנוכחית (מעבר demo↔live) → נפילה בחזרה במקום הצבעה על מקום שאינו קיים.
5. **התראה נבחרת שנפתרה נשארת נבחרת** — המפעיל לא מועבר משם אוטומטית.
6. `selected` נפרד מ־keyboard focus (ה־focus אינו במודול הזה כלל).

---

## 10. התנהגות DANGER חדשה

**אין שינוי בחירה. נקודה.**

DANGER חדשה מקבלת עדיפות בראש המיון ומרימה `hasUnseenDanger` + `unseenDangerAlertId` + `unseenDangerCount`. ההחלפה מתרחשת רק בפעולה מפורשת (`goToUnseenDanger`), ואז ההתראה מסומנת כנראתה כדי שה־banner לא יחזור.

אומת בבדיקות 07 ו־07b: הבחירה לפני ואחרי הגעת DANGER זהה, והדגל עלה.

---

## 11. הוכחה שאין association בין Camera ל־Radar

| מנגנון | הוכחה |
|---|---|
| התראות נפרדות | בדיקה 06: מצלמה ורדאר באותו אזור → fingerprints שונים, ‏ids שונים, ללא מיזוג |
| ראיות חד־מקוריות | בדיקה 06: כל רשומה ב־`sourceEvidence` נושאת את `sourceType` של ההתראה שלה בלבד |
| אין שדות שיוך | בדיקה 15b: לאף התראה אין `pairRisk` / `association` / `fusedRisk` / צמד `cameraTrackId`+`radarTargetId` |
| אין אוצר מילים | בדיקה 15: סריקת ה־JSON של נתוני Live על `Matched` / `Associat*` / `Confirmed` / `Pair Risk` / `Combined Risk` / `FC-nn` / אחוזים → **0 מופעים** |
| גם ב־Demo | בדיקה 15c: אותה סריקה על נתוני ה־Demo → **0 מופעים** |
| "Fused" שמור | בדיקות 15d/15e: המילה מותרת רק כערך ה־Backend, וכל אזכור שלה חייב לשאת ייחוס `backend`/`מהשרת` |
| אין קיבוץ לפי זמן | אין בקוד שום חלון זמן שמאחד מקורות. `otherActiveEvidenceInArea` הוא **מערך מזהים בלבד**, לתצוגה כ"ראיות נוספות באזור — ללא שיוך" |

בזמן המימוש שיניתי את נוסח התראת הנשק מ־`Weapon associated with track #N` ל־`Weapon detected on track #N`. הניסוח המקורי היה נכון עובדתית (המצלמה אכן משייכת נשק למסלול), אבל המילה "associated" על המסך הזה עלולה להיקרא כטענה בין־חיישנית — ועכשיו בדיקה אוטומטית חוסמת אותה.

---

## 12. הוכחה שאין cameraId מומצא

- כל התראת מצלמה נוצרת עם `sourceId: null` ו־`cameraSourceKnown: false` — **בדיקה 05**, ‏0 חריגות.
- **בדיקה 05b** סורקת את התראות המצלמה על `CAM-0\d` → 0 מופעים.
- גם ב־Demo נשמר `cameraSourceKnown: false`, בכוונה: כדי שהעין לא תתרגל לשדה שה־Live לעולם לא יוכל למלא.
- `cameraIdForSourceKey('webcam') === 'CAM-01'` אך `cameraIdForSourceKey('nope') === null` — **בדיקה 16e**: מיפוי מוצהר, לא ניחוש. הפונקציה מוכנה לרגע שבו יגיע `sourceKey` אמיתי.
- **בדיקה 16d**: `primaryCameraId === null` ב־Live — לא הומצאה מצלמה ראשית.

---

## 13. תוצאות הבדיקות — לפני ואחרי

| בדיקה | Baseline מתועד | אחרי Phase A0 | סטטוס |
|---|---|---|---|
| `npm run build` | ירוק | **ירוק** (‏3.24s) | ✅ |
| lint (`src/concepts` + `src/design-lab`) | 4 שגיאות, 0 אזהרות | **4 שגיאות, 0 אזהרות** | ✅ ללא הרעה |
| `phase-h-qa.mjs` | 92/93 | **92/93** | ✅ אותו כישלון קיים־מראש |
| `phase-prime-verify.mjs` | 30/30 | **30/30** | ✅ |
| `phase-prime-noregress.mjs` | ללא רגרסיות | **ללא רגרסיות** | ✅ |
| `phase-a0-alerts-verify.mjs` | — | **64/64** | ✅ חדש |

הכישלון היחיד ב־phase-h-qa הוא `original /design-lab :: Error fetching users: TypeError: Failed to fetch` — לוג fetch-abort קיים־מראש שמתועד ב־REPORT של הפאזה הקודמת ואינו קשור לעבודה הזו.

**על "לפני":** לא הרצתי סבב "לפני" נפרד, מפני שהוא לא היה מוסיף מידע — **אף קובץ קיים לא שונה**, ויש לכך שתי הוכחות בלתי תלויות (סעיף 3). ה־Baseline בעמודה השמאלית הוא זה שתועד בדוחות WP0–WP11 ו־Patch 01.

**תיקון שביצעתי במהלך העבודה:** הגרסה הראשונה של `useAlertSelection.js` הוסיפה שגיאת lint חמישית (`react-hooks/set-state-in-effect`) ב־effect שאיפס את המצב במעבר Live↔Demo. איחדתי אותו לתוך effect הקליטה בצורת functional updater — חזרה ל־4, וגם קוד טוב יותר: מקום אחד מחליט על כל מעברי המצב.

**לוגים:** `artifacts/industrial-ops-phase-a0/qa-logs/` — ‏`build.txt` · `lint-final.json` · `lint-before-fix.json` · `phase-h-qa.txt` · `prime-verify.txt` · `prime-noregress.txt` · `phase-a0-alerts-verify.txt`.

---

## 14. כיסוי 20 התרחישים הנדרשים

| # | תרחיש | בדיקה |
|---|---|---|
| 1 | 20 polls → alert אחד | 01 ✅ |
| 2 | `lastSeenAt` מתעדכן | 02 ✅ |
| 3 | אירוע שנעלם → cleared | 03 ✅ |
| 4 | חזרה אחרי ההפרדה → Alert חדש | 04a + 04b ✅ |
| 5 | אין CAM-01/02 אוטומטי | 05 + 05b ✅ |
| 6 | Camera ו־Radar לא מקובצים | 06 + 06b ✅ |
| 7 | DANGER חדשה לא משנה selection | 07 + 07b ✅ |
| 8 | DANGER בראש המיון | 08 ✅ |
| 9 | NEW לפני ACK ו־IN REVIEW | 09 + 09b + 09c ✅ |
| 10 | Resolve ואז Reopen | 10a–10i ✅ |
| 11 | רענון מדומה משמר lifecycle | 11 + 11b + 11c ✅ |
| 12 | storage פגום לא מפיל | 12 + 12b + 12c ✅ |
| 13 | schema ישן → fallback | 13 + 13b ✅ |
| 14 | Demo לא מתערבב עם Live | 14 + 14b + 14c ✅ |
| 15 | אין association/אחוזים/Pair Risk | 15 + 15b–15e ✅ |
| 16 | אזור Live = המקורות המוצהרים בלבד | 16 + 16b–16e ✅ |
| 17 | אין אזורים עתידיים ב־Live | 17 + 17b + 17c ✅ |
| 18 | selectors ומונים נכונים | 18 + 18b–18h ✅ |
| 19 | חיפוש Alert/Track/Target ID | 19 + 19b–19f ✅ |
| 20 | build ורגרסיות ללא הרעה | 20 + 20b + סעיף 13 ✅ |

---

## 15. בעיות שנותרו

1. **`REACTIVATION_WINDOW_MS = 15000` טעון אישורך** — הערך היחיד בפאזה שנקבע הנדסית ולא ממקור אמת (סעיף 7).
2. **הודעות הבקר אינן מיוצרות כהתראות.** `/api/arduino-messages` אינו חלק מה־snapshot המנורמל, ולכן משפחת ה־`controller` שקיימת בפיד הישן חסרה במנוע. גבול מוצהר של A0, לא השמטה.
3. **`primaryCameraId: null`** — עד שתוגדר מצלמה ראשית, "פתח את המצלמה הראשית של האזור" ב־Phase A1 ייפול לבחירה האחרונה של המפעיל.
4. **סיומות `.js` מפורשות ב־import** באשכול A0 בלבד, בשונה משאר הריפו שמסתמך על ה־resolver של Vite. נדרש כדי שהמודולים ירוצו תחת Node לצורך הבדיקות; מתועד בהערה בקוד.
5. **`otherActiveEvidenceInArea` מחושב מחדש בכל poll** ונשמר על ההתראה. זול (מערך מזהים) אך מגדיל מעט את המצב הנשמר.
6. **אין הרשאות** — כפי שהורית. כל פעולות ה־lifecycle פתוחות לכל מפעיל ב־A0.

---

## 16. סיכונים ל־Phase A1

1. **עלות MJPEG (‏H4)** — הסיכון הגדול ביותר. כל `<img>` MJPEG שנטען מפעיל לולאת YOLO נוספת בשרת. הוספת Visual Feed ל־OPS חייבת לוודא feed **אחד** מותקן בכל רגע, אחרת OPS+OPT יריצו שני ניתוחים במקביל ויפילו את ה־FPS בדמו לשופטים.
2. **שינוי ה־Grid** — הוספת Areas + Alerts + Visual Feed לשבעת האזורים הקיימים היא הנקודה שבה ה־Baseline המאושר נמצא בסיכון אמיתי, במיוחד מול הבדיקה של 0 h-overflow ב־8 רזולוציות.
3. **`RADAR PLOT` כלשונית** — ההנחיה קובעת שהמפה לא תהיה ברירת המחדל. זה מוציא אותה מהתצוגה הקבועה שבה היא נמצאת היום ב־Baseline המאושר. **טעון אישור מפורש לפני ביצוע.**
4. **תיוג `SESSION-LOCAL · NOT SERVER-PERSISTED`** חייב להופיע בכל מקום שבו מוצג lifecycle, ובכל דיאלוג Resolve/Reopen. הנתונים כבר נושאים `persisted:false`; הכשל האפשרי הוא ב־UI שישכח להציג זאת.
5. **ריבוי אזורים ב־Live** — ה־UI חייב להציג `SINGLE-AREA DEPLOYMENT` במפורש ולא רשימה שנראית קטומה או שבורה.
6. **‏1366×768** — רשימת התראות + מסננים + חיפוש + Visual Feed באותו מסך היא הלחץ האמיתי. אין לפתור אותו בהקטנת טקסט.
7. **מונים מטעים** — `lifecycleCounts` כבר פותר את זה נכון; הסיכון הוא ש־UI יחשב מונים בעצמו מהמערך המסונן.

---

## 17. אישור מפורש

מאשר במפורש:

- **לא התחלתי את Phase A1.** לא נוצרו: Grid חדש · פאנל Areas חזותי · Operational Alerts UI · Visual Feed · Radar כלשונית · ALL CAMERAS · Context Menu · Resolve Dialog · Banner חזותי · WebAudio · Global Mute · קיצורי A/R/M · OPT context navigation · View Full Alert History.
- **לא שונה Backend** — `python/**` כולו, כולל `server.py`, `analysis.py`, `ld2450_reader.py`, לא נגע.
- **לא שונו API או חוזי API.**
- **לא שונו routes** — `ConceptsApp.jsx` לא נגע.
- **לא שונתה Risk logic ולא thresholds** (‏40/75).
- **לא שונו credentials, `.env`, ‏`radar_config.json`, ‏COM או Baud.**
- **לא שונו קונספטים אחרים** — Fusion Prime, Minimal Command, Sentinel 3D, Neural Fusion, Comparison Center והפרוטוטייפים הישנים.
- **לא שונו `concepts-base.css`, ‏`IndustrialShell.jsx`, ‏`IndustrialDashboard.jsx`, ‏`industrial.css`, ‏`useMonitoringViewModel.js`, ‏`CameraFeed.jsx`, ‏`TargetsTable.jsx`, ‏`TracksTable.jsx`, ‏`OpenAlerts.jsx`.**
- **לא שונה ה־Baseline החזותי** — אף רכיב מרונדר אינו מייבא את הקוד החדש (מאומת אוטומטית).
- **לא הומצא cameraId, לא הומצא areaId, ולא נוצר association בין Camera ל־Radar.**
- **לא מומשו הרשאות**, ולא הוצגו `Unauthorized` / `Permission denied` / `Supervisor required` / `Backend enforced`.
- **לא נמחקה ולא שונתה אף הערה בעברית בקוד הקיים** (לא נגעתי בקוד קיים כלל).
