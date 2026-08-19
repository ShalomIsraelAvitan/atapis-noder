# Phase A3 — Operational Sound Alerts & Global Mute · דוח סיום

**תאריך:** 2026-08-10 · **Scope:** `src/concepts/industrial-ops/` + `scripts/` בלבד · **Frontend-only**
**מקור:** `d:\פרומטים\A3.txt` (91 סעיפים) + הנחיית האישור עם ארבעת התיקונים המחייבים.

---

## 1. סיכום A3

הקונסולה קיבלה שכבת מודעות קולית, ותו לא. שני cues מסונתזים ב־Web Audio — ALERT קצר, DANGER כפול וחזק יותר — מושמעים **פעם אחת** כשהתראה חדשה באמת מופיעה מול מפעיל שצופה. יש שליטת השתקה גלובלית אחת, נשמרת ב־localStorage, ומצב הצליל מדווח ביושר: ‏`READY` רק על AudioContext שנצפה כ־`running`, ‏`BLOCKED` כשהדפדפן טרם איפשר, ‏`ERROR` כשאין WebAudio, ‏`MUTED` כשהמפעיל בחר.

מה **לא** קורה: אין reminder, אין loop, אין תור, אין Notification API, אין קובץ שמע, אין ספרייה חדשה, אין volume, אין test-tone. קול לא משנה severity, condition, lifecycle, owner, selection, אזור נבחר, risk, ‏Fused Risk, ‏System Decision או Backend — והמסך לא זז בגללו.

**מבנה:** ארבע שכבות מופרדות — planner טהור שמחליט *אם* מגיע cue, מנוע שיודע *איך* להשמיע, hook דק שמחבר אותם ל־React, ו־control יחיד. כל 75 כללי הזיהוי נבדקים ב־Node בלי דפדפן.

---

## 2. גיבוי

```
C:\Users\SADAB\Desktop\ATAPIS-backups\hackathon-before-phaseA3-20260810-173025.zip
103.79 MB · 721 entries
```

**Exclusions:** ‏`node_modules`, ‏`dist`, ‏`venv`, ‏`.venv`, ‏`__pycache__`, ‏`.vite`, ‏`cache`, ‏`.cache`, ‏`logs`, ‏`run-logs`, ‏`outputs`, ‏`*.pyc`.
**אומת בתוך ה־zip:** ‏195 קבצי `src/` (מול 194 על הדיסק — הפרש של רשומת תיקייה), ‏228 קבצי industrial-ops, ‏183 קבצי python, ‏14 סקריפטים; **0** רשומות `node_modules`, **0** רשומות `logs/`.
**כל ששת הגיבויים הקודמים נשמרו** (סה"כ 7 בתיקייה): ‏`hackathon-src-backup-20260729`, ‏`before-patch01-20260803`, ‏`before-phaseA0-20260804`, ‏`before-phaseA1-20260805`, ‏`before-phaseA1-1-20260805`, ‏`before-phaseA2-20260809`.

---

## 3. קבצים חדשים

| קובץ | שורות | תפקיד |
|---|---|---|
| `src/concepts/industrial-ops/audioCuePlanner.js` | 107 | הליבה הטהורה: האם מגיע cue, ואיזה |
| `src/concepts/industrial-ops/operationalSoundEngine.js` | 287 | AudioContext יחיד, סינתזה, מצב, מונים |
| `src/concepts/industrial-ops/useOperationalAudio.js` | 124 | חיבור ל־React; המקום היחיד ש־cue מתחיל בו |
| `src/concepts/industrial-ops/audioPrefs.js` | 78 | העדפת ההשתקה ב־localStorage |
| `src/concepts/industrial-ops/components/SoundControl.jsx` | 57 | הכפתור |
| `scripts/phase-a3-audio-verify.mjs` | 1049 | סוויטת A3 — 207 בדיקות |
| `scripts/phase-a3-screenshots.mjs` | 221 | 26 צילומי QA |

## 4. קבצים ששונו

| קובץ | השינוי |
|---|---|
| `views/IndustrialDashboard.jsx` | 2 imports · קריאת `useOperationalAudio` · ‏`<SoundControl>` בתוך `.io2-strip-mode`. **אפס שינוי מבני אחר.** |
| `industrial.css` | בלוק `.io2-sound` (‏~24 שורות) + ‏`row-gap/column-gap` ל־`.io2-strip-mode` ב־≤1500px |
| `components/NewDangerNotice.jsx` | **הערה בלבד**: "Phase A1 is visual only — no sound" עודכן להפניה ל־`useOperationalAudio.js`. אפס שינוי קוד. |

**לא נגעתי:** ‏`IndustrialShell.jsx`, ‏`alerts.js`, ‏`alertSelectors.js`, ‏`alertStorage.js`, ‏`useAlertSelection.js`, ‏`useIndustrialOpsCommandCenter.js`, ‏`operatorLog.js`, ‏`concepts-base.css`, ‏`ConceptsApp.jsx`, ‏`ConceptSwitcher.jsx`, ‏`AuthContext.jsx`, ‏`OpenAlerts.jsx`, ‏`TargetsTable`/`TracksTable`/`CameraFeed`, ‏`python/**`, ‏`.env`, וכל קונספט אחר. אומת ב־`LastWriteTime` — כולם מתאריך קודם ל־2026-08-10.

## 5. מיקום ה־Sound Control

בתוך אשכול `SYS MODE` בפס העליון (`.io2-strip-mode`), מיד אחרי `DemoModeBadge` — ‏`IndustrialDashboard.jsx:154`.

## 6. הוכחה שאין Layout row חדש

‏`.io2-strip` היה 12 ילדים ונשאר **12 ילדים** — נמדד בדפדפן ב־1920 וב־1366 (C60), בכל 26 הצילומים (`children=12` ב־manifest), וב־production build (D05). זה לא פרט אסתטי: ב־≤1500px הפס הופך ל־grid של 7 עמודות שבו mode תופס 2 והתא האחרון תופס 2 — 14 משבצות בדיוק ל־12 ילדים. ילד 13 היה מוסיף שורה שלמה. בדיקה סטטית נוספת מוודאת שנשארו 11 `StatusStripCell` (A33) ושה־control נמצא בתוך אשכול ה־mode ולא כילד של הפס (A32).

## 7. מודל מצבי הקול

```
muted                                   → MUTED     (בחירת המפעיל גוברת תמיד)
AudioContext.state === 'running'        → READY
AudioContext.state === 'suspended'      → BLOCKED
AudioContext.state === 'closed'         → ERROR
אין WebAudio / בנייה נכשלה              → ERROR
לא אותחל                                 → BLOCKED  (ברירת מחדל בטוחה, לעולם לא READY)
```

הפונקציה `soundDisplayState` טהורה — כל 9 המעברים נבדקים ב־Node (B50–B58).

## 8. ארכיטקטורת WebAudio

`AudioContext` **אחד** לכל חיי העמוד, נוצר עצל ב־`initAudioEngine()` שהוא אידמפוטנטי (`if (ctx) return`). המונה `contexts` עולה רק בבנייה אמיתית — הוא ההוכחה ש־StrictMode וניווט חוזר לא מייצרים שני contexts. ‏`masterGain` יחיד; לכל cue נוצרים oscillator+gain זמניים שמתנתקים ב־`onended`. **אפס JS timers**: הפולסים מתוזמנים על `AudioContext.currentTime`. אין WebAudio → `state='unsupported'` וכל קריאה היא no-op בטוחה שמחזירה `false`.

## 9. התנהגות ALERT cue

טון בודד, ‏880Hz, ‏160ms, ‏peakGain 0.16, עם רמפות attack 8ms / release 55ms כדי שלא ייפתח או ייסגר בקליק.

## 10. התנהגות DANGER cue

פולס כפול — ‏740Hz ל־130ms, הפסקה, ואז 1175Hz ל־170ms — ‏peakGain 0.26.

## 11. ההבדל ביניהם

שלושה ממדים בו־זמנית: **מספר הפולסים** (1 מול 2), **הגובה** (טון יחיד מול ירידה־עלייה), ו**העוצמה** (0.26 מול 0.16). זה נבדק כאילוץ, לא כטעם (A11–A12): ההבחנה חייבת לשרוד גם כשלא מסתכלים על המסך. אין משמעות מבצעית לתדר עצמו — הוא implementation detail וכל הקבועים מרוכזים ב־`TONES`/`ENVELOPE` (A09–A10).

## 12. שתיקה בטעינה ראשונה

שני מנגנונים בלתי תלויים:
1. **Baseline pass** — ה־book מתחיל כ־`null`, ולכן המעבר הראשון בולע את כל מה שעל המסך בשקט.
2. **Arming** — הקול כלל אינו חמוש עד שהמערכת יודעת מה קורה בעולם (סעיף 24).

נבדק ב־Node על fixture ה־Demo שמכיל DANGER (B02–B03) ובדפדפן: פתיחת Demo עם 10 התראות → **0 cues** (C02).

## 13. שתיקה ב־Reload

ה־book חי בזיכרון בלבד ולעולם לא נשמר — בדיקה סטטית אוכפת שאין בו `localStorage`/`sessionStorage` (B06). ריענון = book חדש = baseline. נבדק בדפדפן: reload עם אותן התראות על המסך → 0 cues (C05).

## 14. מניעת כפילויות

ה־book הוא `Map<alertId, highestRankAlreadyAccounted>`. אותה התראה ב־poll הבא, אחרי re-render, אחרי שינוי מסנן, בחירה, שפה, density, טאב מצלמה/רדאר או פעולת lifecycle — כבר רשומה, ולכן שקטה. נבדק: ‏B13–B17, ‏C17 (שתי שניות של polling נוסף על אותה התראה — עדיין `alertCues=1`).

## 15. סמנטיקת Batch

מצטבר `top` יחיד לכל מעבר:

- 3 DANGER חדשות באותו update → **cue אחד** (B20).
- ALERT + DANGER יחד → **DANGER בלבד** (B21), ללא תלות בסדר הרשימה (B22).
- 3 ALERT חדשות → **cue אחד** (B23).
- בדפדפן: mode→DANGER יחד עם שני tracks באותו poll → `dangerCues=1, alertCues=0` (C21–C22), ואין תור שמתנקז אחר כך (C23).

## 16. הסלמת ALERT→DANGER

מיושמת ב־planner ככלל של עליית rank: ‏INFO→ALERT ו־ALERT→DANGER על אותו id משמיעים פעם אחת (B24–B25); ‏DANGER→DANGER שקט (B26).

**ממצא שדווח ולא הוסתר:** במנוע האמיתי המסלול הזה **אינו נגיש** — ‏`reduceAlerts` לעולם לא מעדכן `severity` במקום, וה־mode הוא חלק מה־discriminator, ולכן הסלמה אמיתית מגיעה כ־**id חדש**. הוכחתי את הטענה במקום להניח אותה (B29), והמסלול האמיתי נבדק גם ב־Node (B30) וגם בדפדפן (C18: ‏SAFE→ALERT→DANGER נותן `alertCues=1, dangerCues=1`). כלל עליית ה־rank נשאר כהגנה: אם המנוע ישתנה ביום מן הימים, הסלמה תישמע פעם אחת במקום להיבלע בשקט.

## 17. שתיקת פעולות lifecycle

Acknowledge / Start Review / Resolve / Reopen לא משמיעים דבר — משום שאף אחת מהן לא משנה `id` או `severity`. נבדק דרך המנוע האמיתי: ארבע הפעולות מופעלות על fixture ה־Demo וה־planner מחזיר `null` בכל אחת (B31–B35).

## 18. Reactivation

A3 **צורך** את הכרעת A0 ולא מגדיר אותה מחדש:

- חזרה בתוך חלון 15 השניות → **אותו id** → שקט (B37, B39).
- מעבר לחלון → **instance id חדש** ו־lifecycle חוזר ל־NEW → רשאי להשמיע פעם אחת (B38, B40).

בדיקה סטטית אוכפת שהמילים `REACTIVATION_WINDOW_MS`/`15000` אינן מופיעות ב־planner כלל (B41). ‏`active→cleared` שקט, ואין "all clear" (B36).

## 19. Global Mute

כפתור יחיד, גלובלי, משפיע על שני ה־cues. ‏`aria-pressed` מדווח אותו. לחיצה כשהקול פעיל: ‏`setMuted(true)` + `stopAllCues()` — גם ה־cue שכרגע מתנגן נקטע. נבדק: ‏C11–C13, ‏C24–C29.

## 20. סכמת localStorage

```
industrial-ops-audio-v1  =  {"v":1,"muted":false}
```

זה כל מה שנשמר. הטוען מקבל אך ורק `v===1` + ‏`muted` בוליאני; ‏JSON פגום, גרסה זרה, ‏`"true"` כמחרוזת, שדה חסר או storage חסום — כולם קוראים כברירת מחדל ולעולם לא זורקים (B63–B68). **לא נשמרים:** alert ids, היסטוריית השמעה, מצב הרשאה (B69). המפתח קיים במודול אחד בלבד (A41).

## 21. טיפול ב־Autoplay

`AudioContext` נוצר עצל; אם הדפדפן מחזיק אותו `suspended`, זה מה שמוצג. ‏`resumeAudio()` נקרא **רק** מתוך לחיצת המשתמש, לעולם לא מ־effect, ולעולם לא זורק. ‏`muted:false` ב־localStorage אינו מרמז דבר על זמינות — הבדיקה C10 אוכפת את האינווריאנט הזה בדפדפן: ‏`label === 'READY'` ⇐ ‏`engineState === 'running'`.

## 22. SOUND BLOCKED

לפני כל אינטראקציה הקונסולה מציגה **BLOCKED / חסום**, לא READY — נמדד בדפדפן (C04) ומופיע ב־10 מהצילומים. הצבע רק מחזק את המילה; המצב עצמו הוא טקסט (A30, §58).

## 23. Resume / Unlock

| מצב בלחיצה | מה קורה |
|---|---|
| MUTED | ‏`muted=false` → נשמר → `resumeAudio()` → ‏READY רק אם ה־context באמת רץ |
| READY | ‏`muted=true` → נשמר → `stopAllCues()` → ‏MUTED |
| BLOCKED / ERROR | ‏`resumeAudio()` — הכפתור הוא ENABLE; אם נכשל, המצב נשאר כן |

נבדק: ‏C08 (‏BLOCKED→READY אחרי gesture אמיתי), ‏C58 (ללא WebAudio הלחיצה לא מזייפת התאוששות).

## 24. התנהגות בטאב מוסתר

`document.hidden` פירושו **NO AUDIO OUTPUT**, לא רק "לא להתחיל חדש":

- effect ייעודי על מעבר `true→false` קורא `stopAllCues()`.
- ה־planner **ממשיך לעכל** התראות בזמן הסתרה, ולכן הן נספרות כמטופלות.

נמדד בדפדפן: ‏DANGER cue מתנגן (`activeNodes=2`) → מעבר ל־hidden → **`activeNodes=0`** (C30–C31). התראה שהגיעה בזמן הסתרה → 0 cues (C32).

## 25. אין Backlog בחזרה

חזרה ל־visible אינה משמיעה דבר (C33), וההתראה החדשה **הבאה** נשמעת פעם אחת (C34). זה לא מנגנון נפרד אלא תוצאה של האידמפוטנטיות: כשה־effect רץ מחדש, כל ה־ids כבר ב־book.

## 26. תוצאות StrictMode

האפליקציה רצה תחת `<StrictMode>`, ולכן כל בדיקות הדפדפן הן בדיקות StrictMode.

| דרישה | תוצאה |
|---|---|
| אין AudioContext כפול | `contexts === 1` אחרי mount (C03), אחרי ניווט הלוך־חזור (C38), ואחרי 3 סבבים נוספים (C41) |
| אין cue כפול ב־mount | ‏0 cues בפתיחת Demo ובפתיחת Live (C02, C15) |
| ‏cleanup לא מנגן | ‏0 cues לאורך כל ה־churn (C42) |
| ‏mode switch שקט | ‏B07–B11 בלוגיקה |
| ‏listener לא נרשם פעמיים | ה־listener נרשם על ה־context עצמו בתוך `initAudioEngine` האידמפוטנטי, לא פר־hook |

**הערה על הפתרון:** הניסיון הראשון סנכרן את מצב המנוע ל־state דרך `useEffect`, ו־lint פסל אותו (`react-hooks/set-state-in-effect`). לא החלשתי את הכלל — עברתי ל־`useSyncExternalStore`, שהוא הדפוס הנכון לקריאת store חיצוני ב־React 19 ובטוח תחת StrictMode מעצם הגדרתו.

## 27. התנהגות Demo

Demo משתמש באותו מנוע. ה־fixture הוא seed שקט: ‏0 cues בפתיחה (C02), גם אחרי reload (C05). ה־Demo נשאר מסומן `DEMO DATA — DESIGN PREVIEW` כפי שהיה; קול אינו הופך Demo ל־Live.

## 28. Demo↔Live

מעבר mode הוא גבול אתחול: ה־book נושא את ה־mode שלו, ו־book ממצב אחר נזרק ונבנה מחדש כ־baseline (B07–B08). זה גם פותר את התנגשות ה־ids: אותו id בדיוק בשני המצבים אינו משתיק אחד את השני (B09–B11). ה־Mute נשאר גלובלי בשני המצבים — זה מכוון.

## 29. DANGER בזמן Resolve/Reopen

תרחיש חובה, נבדק מקצה לקצה (C45–C49): דיאלוג Resolve פתוח, הערה כתובה למחצה, ואז DANGER חדשה →

- **cue אחד** בלבד;
- הדיאלוג **נשאר פתוח**;
- ההערה **נשמרת מילה במילה**;
- ה־selection **לא זזה**;
- ‏Escape עדיין סוגר נקי.

## 30. הוכחה שאין שינוי selection

C48 משווה `.io2-ab-id` לפני ואחרי ה־cue — זהה. ‏C52 משווה selection לפני ואחרי mute/unmute — זהה.

## 31. הוכחה שאין שינוי Risk

C50 מצלם את כל תאי ה־RISK בפס לפני ואחרי toggle — זהים. בנוסף בדיקה סטטית: ה־hook לא מייבא שום engine/selector/storage ולא קורא לשום פעולה תפעולית (A18–A19).

## 32. הוכחה שאין שינוי Lifecycle

C51 (מוני ה־lifecycle זהים), ‏C53 (רשימת ההתראות זהה), ‏C54 (מספר שורות ה־log זהה), ‏A19 (אין קריאה ל־acknowledge/review/resolve/reopen מהשכבה הקולית).

## 33. הוכחה שאין Camera↔Radar association

השכבה הקולית מקבלת שני שדות מכל התראה — `id` ו־`severity` (ועוד `active`/`observedFromSessionStart`). אין בה מושג של מצלמה, רדאר, track, target, pair או אחוז. ‏A18 אוכף שאין ייבוא של שכבת הראיות, ו־A21 שהזהות היא `alert.id` בלבד. הסוויטות של A1/A2, שכן בודקות את כללי היושר האלה, נשארו ירוקות במלואן.

## 34. הוכחה שאין Reminder

`setInterval` אינו מופיע באף אחד מחמשת קבצי השכבה הקולית (A22), ואין קבוע של מרווח תזכורת בשום מקום. אחרי cue אין דבר שמתוזמן.

## 35. הוכחה שאין loop

אין `loop` ואין מקור מתמשך (A23). כל oscillator נוצר עם `start(t)` ו־`stop(t+d)` מפורשים ומתנתק ב־`onended`; ‏`activeNodes` חוזר ל־0 אחרי כל cue (נמדד ב־C31, ‏C43).

## 36. הוכחה שאין Notification API

A05 סורק את כל קבצי השכבה + הדשבורד ומוודא שאין `Notification.requestPermission` ואין `new Notification`.

## 37. תוצאות כל ה־Gates

| Gate | Baseline (לפני A3) | אחרי A3 |
|---|---|---|
| `npm run build` | GREEN | **GREEN** |
| lint scoped (`src/concepts src/design-lab`) | 4 errors / 0 warnings | **4 / 0** — אותן 4 ב־`concepts/data/` |
| `phase-h-qa.mjs` | 92/93 | **92/93** — אותו כשל היסטורי ב־`/design-lab` |
| `phase-prime-verify.mjs` | 30/30 | **30/30** |
| `phase-prime-noregress.mjs` | no regressions | **no regressions** |
| `phase-a0-alerts-verify.mjs` | 64/64 | **64/64** |
| `phase-a1-command-center-verify.mjs` | 89/89 | **89/89** |
| `phase-a1-1-height-verify.mjs` | 53/53 | **53/53** |
| `phase-a2-operational-workflow-verify.mjs` | 245/245 | **245/245** |
| `phase-a3-audio-verify.mjs` | — | **207/207** |

אף בדיקה לא נמחקה ואף אחת לא הוחלשה.

## 38. מספר בדיקות A3

**207** — ‏45 סטטיות (A), ‏75 לוגיות ב־Node (B), ‏79 בדפדפן (C), ‏8 על ה־production build (D).

## 39. הוכחת cue במוני הדפדפן

לא הסתמכתי על "שמעתי צליל". המנוע מגדיל מונה בדיוק בנקודת `osc.start()`, והבדיקות קוראות אותו:

| תרחיש | הוכחה |
|---|---|
| ‏ALERT חדשה | `alertCues: 0 → 1` (C16) |
| ‏DANGER חדשה | `dangerCues: 0 → 1` (C18) |
| ‏polling חוזר | ‏`alertCues` נשאר 1 (C17) |
| ‏batch מעורב | ‏`{alert:0, danger:1}` (C21–C22) |
| ‏Demo בפתיחה | ‏`{0,0}` (C02) |
| מושתק | ‏`{0,0}` למרות שהשורה מופיעה (C25–C26) |
| ‏hidden | ‏`{0,0}` (C32) |
| מחוץ ל־OPS | המונים ללא שינוי (C37) |

בנוסף, כל אחד מ־26 הצילומים רושם ב־manifest את המונים שהיו באותו רגע — כך שגם התמונות נושאות את ההוכחה שהן עצמן לא יכולות לתת.

## 40. גובה — לפני ואחרי

נמדד ב־`phase-a1-1-measure.mjs` **ללא שינוי בכלי** (`measure-a2.json` מול `measure-a3.json`):

| קונפיגורציה | A2 | A3 | הפרש | התראות גלויות | Alert list | Feed |
|---|---|---|---|---|---|---|
| 1920 he demo compact | 459 | **459** | **0** | 6 → 6 | 368 | 401 |
| 1920 en demo compact | 530 | **530** | **0** | 5 → 5 | 368 | 401 |
| 1920 he demo comfort | 569 | **569** | **0** | 6 → 6 | 400 | 401 |
| 1920 en demo comfort | 640 | **640** | **0** | 5 → 5 | 400 | 401 |
| 1920 he live compact | 143 | **143** | **0** | 1 → 1 | 53 | 175 |
| 1920 he live comfort | 207 | **207** | **0** | 1 → 1 | 59 | 175 |
| 1366 he demo compact | 1162 | **1178** | **+16** | 5 → 5 | 310 | 321 |
| 1366 en demo compact | 1270 | **1287** | **+17** | 4 → 4 | 310 | 321 |
| 1366 he demo comfort | 1282 | **1298** | **+16** | 5 → 5 | 344 | 321 |
| 1366 en demo comfort | 1397 | **1430** | **+33** | 4 → 4 | 344 | 321 |
| 1366 he live compact | 789 | **789** | **0** | 1 → 1 | 53 | 191 |
| 1366 he live comfort | 887 | **887** | **0** | 1 → 1 | 59 | 191 |

**‏Action Bar:** ‏44px ב־1920 ו־60px ב־1366 — ללא שינוי, בתוך התקציב (C62). **‏Feed:** זהה בכל קונפיגורציה. **התראות גלויות:** ללא שינוי (6/5/6/5 ב־1920, ‏5/4/5/4 ב־1366). **‏Horizontal overflow:** ‏0 בשני ה־viewports (C63).

**מיקום ה־control:** בתוך `.io2-strip-mode`. ב־1920 האשכול גדל **לרוחב** (369→474px) והגובה נשאר 53px — אפס עלות.

**התוספת ב־1366 — מדידה מבודדת, מדווחת ביושר:** ב־≤1500px האשכול הוא תא grid ברוחב קבוע (324px). ב־**Demo** יושבים בו גם SYS MODE, גם ערך המצב ב־21px, וגם התג `DEMO DATA — DESIGN PREVIEW` — והתוכן כבר ממלא את הרוחב. כל תוספת גורמת לגלישה לשורה אחת נוספת: האשכול עולה מ־55px ל־72px. הרווחתי חלק מזה ע"י `row-gap: 2px; column-gap: 10px` באותו breakpoint (spacing בלבד — **אפס נגיעה בטיפוגרפיה**), מה שהוריד את האנגלית משלוש שורות לשתיים (144→128px בפס).

**ב־Live התוספת היא 0 בדיוק** — אין תג DEMO, והכול נשאר בשורה אחת. במילים אחרות: העלות היחידה היא ‏16–33px, רק ב־Demo, רק ב־1366, על מסמך של ~2000px (‏0.8%–1.5%).

## 41. צילומים

`hackathon/artifacts/industrial-ops-phase-a3/shots/` — **26 צילומים** + `manifest.json`.

| קבוצה | מה מכוסה |
|---|---|
| 1920 he | ‏BLOCKED התחלתי · READY · MUTED · MUTED שורד reload · התראה נבחרת · דיאלוג Resolve עם ה־control · ‏ERROR ללא WebAudio · 4 תקריבים של האשכול |
| 1920 en | ‏BLOCKED · READY · MUTED · ERROR · comfort |
| 1366 | ‏he: ‏BLOCKED/READY/MUTED + דיאלוג · ‏en: ‏READY/MUTED/ERROR |
| Live | ‏1920 he blocked+ready, ‏1366 he blocked |

**לא זויפה חומרה:** צילומי Live מציגים את המצב האמיתי של המחשב הזה (אין מצלמה, רדאר מנותק). כל מצבי ה־DANGER מצולמים ב־Demo, עם התג DEMO גלוי.

## 42. בעיות שנותרו

1. **‏16–33px ב־1366 ב־Demo** (סעיף 40) — מדווח, לא מוסתר. ניתן לאפס אותו לחלוטין רק ע"י ויתור על התג `SND` באותו breakpoint או העברת ה־control לפוטר; שניהם דורשים את אישורך.
2. **טבעת פוקוס כחולה בלחיצת עכבר** — מגיעה מכלל גלובלי ב־`src/index.css:91-93` (`button:focus { outline: 2px solid #0071e3 }`) שחל על **כל** כפתור בקונסולה, כולל כפתורי ה־Action Bar של A2. ה־control יורש בדיוק את אותה התנהגות; התיקון היה מחייב נגיעה בקובץ גלובלי מחוץ ל־scope.
3. **הסלמת same-id אינה נגישה במנוע** (סעיף 16) — הכלל קיים כהגנה ונבדק ב־Node בלבד.
4. **מונה `contexts` הוא per page load** — ניווט SPA שומר אותו על 1; ריענון מלא מתחיל מ־1 מחדש. זו התנהגות נכונה, לא דליפה.

## 43. סיכונים ל־CAL

- **`GATE_POINT`/`FENCE_LINE_Y` מכוילים ל־1920×1080 בעוד ה־Dahua על סאב־סטרים** (‏H1 ב־CLAUDE.md) — כיול יזיז את מה שנחשב `approaching_gate`, ולכן ישנה **אילו** התראות נוצרות. השכבה הקולית תשמיע את מה שהמנוע ייצר; אם הכיול יגרום לזרם התראות חדש, זה יישמע. שווה לבדוק את קצב ה־cues מיד אחרי כיול.
- **התראות שמשנות discriminator** (למשל `track:N:state`) — כל שינוי התנהגות פותח id חדש ולכן cue. אם CAL יוסיף אזורי סיכון, כדאי לוודא שהם לא מייצרים ריצוד ids.
- **`REACTIVATION_WINDOW_MS = 15000`** נשאר הגבול היחיד בין "אותו אירוע" ל"אירוע חדש" — כל שינוי שלו ישנה מיד את קצב הצלילים.

## 44. אישור: לא התחלתי CAL

לא נגעתי ב־`calibration.json`, ‏`GATE_POINT`, ‏`FENCE_LINE_Y`, כיול שער/גדר/סצנה או אזורי סיכון.

## 45. אישור: לא התחלתי OPT

אין `Open in OPT`, אין ניווט ב־double-click או Enter, אין query params של הקשר, אין ניווט track/target.

## 46. אישור: לא שיניתי Backend / API / Auth / routes / database / Risk Logic / thresholds

`python/**` ללא שינוי (‏`server.py` נותר מ־2026-07-20, ‏`analysis.py` מ־2026-07-10), ‏`.env` ללא שינוי (2026-07-18), אין endpoint חדש, אין route חדש, ‏`AuthContext.jsx` ללא שינוי מ־2025, ‏`users.json` ללא שינוי, ספי 40/75 ללא שינוי, ‏YOLO ללא שינוי.

## 47. אישור: לא שיניתי קונספטים אחרים

`Fusion Prime`, ‏`Minimal Command`, ‏`Sentinel 3D`, ‏`Neural Fusion` ו־`design-lab` — אפס שינוי; אומת ב־`LastWriteTime` ובשלוש סוויטות (`phase-prime-verify` 30/30, ‏`phase-prime-noregress` ללא רגרסיות, ‏`phase-h-qa` 92/93).

---

# תוספת — 12 הסעיפים של הנחיית האישור

## ת1. כיצד `__IO2_AUDIO_STATS__` מוגבל ל־DEV/TEST

המונים הפנימיים של המנוע קיימים תמיד; ה־**mirror** ל־window נכתב מאחורי שער שנכתב inline דווקא כדי שה־build יוכל לקפל אותו לקבוע:

```js
function mirrorStats() {
  if (typeof window === 'undefined') return          // Node מחזיר כאן, לפני import.meta.env
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') return
  window.__IO2_AUDIO_STATS__ = { ... }
}
```

סדר שתי השורות מכוון: שער ה־window ראשון, כי ל־Node אין `import.meta.env` כלל (B71–B73 מוודאים שייבוא ב־Node לא נוגע בשום API של דפדפן).

## ת2. הוכחה שהוא אינו קיים ב־Production

שתי הוכחות בלתי תלויות, שתיהן ב־section D של הסוויטה:

1. **סטטית:** ‏`npm run build` ואז סריקת כל ה־chunks תחת `dist/assets/` — ‏**0 מופעים** של המחרוזת `__IO2_AUDIO_STATS__` (D01). לא "מוגדר וריק" — פשוט לא קיים.
2. **בזמן ריצה:** ‏`vite preview` על ה־build, התחברות, ניווט ל־OPS — ‏`typeof window.__IO2_AUDIO_STATS__ === 'undefined'` (D04), גם **אחרי** לחיצה על ה־control (D07). ה־control עצמו עובד שם במלואו: מרונדר (D03), הפס עדיין 12 ילדים (D05), והלחיצה מגיעה ל־READY (D06), ללא שגיאות (D08).

בנוסף A16 אוכף שאף מודול מוצר (planner/hook/control/prefs/dashboard/AlertList/ActionBar) אינו מזכיר את הגלובל, ו־A17 שאפילו המנוע רק **כותב** אותו ולעולם לא קורא ממנו — כלומר מחיקת ה־instrumentation לא יכולה לשנות התנהגות.

## ת3. התנהגות cue פעיל ב־`document.hidden`

הכלל הוא NO AUDIO OUTPUT. ‏effect ייעודי:

```js
useEffect(() => { if (!documentVisible) stopAllCues() }, [documentVisible])
```

`stopAllCues` מבטל תזמונים, מוריד gain ל־0 תוך 20ms ועוצר את ה־oscillator ב־+30ms — עצירה מיידית בלי קליק.

## ת4. הוכחה ש־stopAllCues מופעל במעבר ל־hidden

C30–C31, נמדד בתוך הדפדפן בלולאה צמודה: ‏DANGER cue מתחיל → `activeNodes = 2` → ‏`document.hidden = true` + `visibilitychange` → תוך 250ms → **`activeNodes = 0`**. ה־planner ממשיך לעכל בזמן ההסתרה, ולכן אין backlog (C32–C33).

## ת5. טיפול ב־AudioContext statechange

`initAudioEngine` רושם listener יחיד על ה־context עצמו:

```js
stateListener = () => setState(stateFromContext())
ctx.addEventListener('statechange', stateListener)
```

הוא נרשם **פעם אחת** (‏`initAudioEngine` אידמפוטנטי) ומוסר רק ב־`disposeAudioEngine`. הצריכה ב־React היא `useSyncExternalStore` — לא effect שמסנכרן state, ולכן אין subscription כפול תחת StrictMode ואין setState-in-effect.

## ת6. הוכחה ש־READY משקף תמיד `running`

`soundDisplayState` מחזיר READY **רק** על `engineState === 'running'` — כל שאר המצבים נופלים ל־BLOCKED או ERROR, וברירת המחדל היא BLOCKED (B52–B58). בדפדפן, C10 בודק את האינווריאנט ישירות מול ה־DOM: אם התווית READY, אז `AudioContext.state === 'running'`. ‏C04 מראה שלפני gesture התווית היא BLOCKED, ו־C08 שהיא הופכת ל־READY רק אחרי resume מאומת.

## ת7. התנהגות ביציאה אמיתית מ־OPS

ניווט SPA ל־INV: ‏`unsubscribe()` + `stopAllCues()` ב־cleanup. אחרי היציאה — **`activeNodes = 0`** (C36), ונתונים חדשים לגמרי (mode→DANGER + track חדש) שמגיעים בזמן שהמסך לא מותקן **אינם מגדילים אף מונה** (C37). ה־context נשאר בחיים אך פסיבי.

## ת8. התנהגות בחזרה ל־OPS

ה־book הוא `useRef` פר־instance, ולכן חזרה ל־OPS מתחילה מ־book חדש = baseline שקט. בנוסף, ה־arming לא מתרחש עד שהמערכת יודעת מה קורה בעולם. **התוצאה:** ‏`dangerCues`/`alertCues` ללא שינוי בחזרה (C39), וההתראה החדשה **הבאה** נשמעת פעם אחת בדיוק (C40).

**זה היה הבאג האמיתי של השלב.** הגרסה הראשונה כן השמיעה בחזרה ל־OPS. הסיבה: שכבת הנתונים מחזירה `EMPTY_SNAPSHOT` ברגע ה־mount וממלאת אותו רק ב־poll הבא, ורשימת ההתראות מקופלת ב־commit מאוחר יותר מה־snapshot שיצר אותה. כך התאונה: הקול נחמש על הרשימה הישנה, ואז ה־DANGER שכבר רץ בעולם נכנס כ"חדש". התיקון נשען על מרקר אמיתי של השכבה — ‏`vm.link.lastSuccessAt`, שזז רק כש־`/status` באמת ענה — ודורש **שני** מעברים על אותה תשובה לפני חימוש, כדי שהרשימה תספיק להדביק את הנתון. אין בזה שום קבוע זמן שרירותי.

## ת9. מספר AudioContexts אחרי כניסות/יציאות

`contexts === 1` אחרי mount (C03), אחרי סבב יציאה־וחזרה (C38), ואחרי **3 סבבים נוספים** (C41). המונה עולה רק בבנייה אמיתית של context.

## ת10. אימות דליפת listeners/subscriptions

- ה־`statechange` listener נרשם על ה־context בתוך `initAudioEngine` האידמפוטנטי — לכן מספרו כמספר ה־contexts, כלומר 1.
- מנויי React מנוקים דרך ה־unsubscribe של `useSyncExternalStore`.
- ‏`activeNodes === 0` אחרי כל ה־churn (C43), ואין ולו page error אחד לאורך כל הרצף (C44) — כולל היעדר unhandled rejection מ־`resume()`/`play()`.
- אין timers כלל: ‏A08 אוכף שאין `setTimeout`/`setInterval` במנוע.

## ת11. הוכחה שאין cue מחוץ ל־OPS

C37: אחרי יציאה מ־OPS, מוזרקים `mode: DANGER` ו־track חדש, ממתינים 3 שניות — ‏`alertCues` ו־`dangerCues` **זהים** לערכיהם לפני היציאה. אין מי שיאזין: ה־hook לא מותקן.

## ת12. הוכחה שאין backlog אחרי חזרה

C39 (חזרה = 0 cues נוספים) ו־C40 (רק האירוע החדש שאחריה מפיק cue אחד). אותו כלל נבדק גם למסלול ה־hidden (C33–C34) ולמסלול ה־unmute (C27–C29).

---

## Definition of Done — מצב

| דרישה | מצב |
|---|---|
| ‏ALERT חדשה → cue אחד | ✅ C16 |
| ‏DANGER חדשה → cue מובחן אחד | ✅ C18 |
| טעינה ראשונה / reload / demo seed שקטים | ✅ C02, C05, B02 |
| ‏mode switch שקט | ✅ B07–B08 |
| ‏poll חוזר לא מכפיל | ✅ C17 |
| ‏batch מאוגד, DANGER גובר | ✅ C21–C22 |
| ‏Global Mute עובד ונשמר | ✅ C11–C14 |
| ‏BLOCKED כן, ‏READY רק כשרץ | ✅ C04, C10 |
| ‏statechange משתקף | ✅ ת5, ‏B50–B58 |
| ‏cue פעיל נעצר ב־hidden | ✅ C30–C31 |
| אין backlog | ✅ C33, C39 |
| יציאה מ־OPS מכבה קול | ✅ C36–C37 |
| חזרה = baseline שקט | ✅ C39 |
| ניווט חוזר לא יוצר contexts/listeners | ✅ C41–C43 |
| ‏instrumentation נעדר מ־Production | ✅ D01, D04, D07 |
| אין Reminder / loop / Notification | ✅ A22, A23, A05 |
| אין שינוי Risk / Lifecycle / Selection | ✅ C50–C53 |
| אין שורת layout חדשה | ✅ C60, D05 |
| כל שערי A0–A3 ירוקים | ✅ סעיף 37 |

**Phase A3 הושלם. לא התחלתי CAL, ‏OPT או Backend.**
