# Phase A2 — Operational Alert Workflow & Operator Actions · דוח סיום

**תאריך:** 2026-08-09 · **מסך:** `/concepts/industrial/dashboard` · **Frontend-only · Session-local · Not server-persisted**

---

## 1. סיכום

מסך OPS הפך ממערכת צפייה למערכת טיפול. מפעיל בוחר התראה ומבצע עליה `Acknowledge → Start Review → Resolve → Reopen`, כל פעולה נרשמת ב־action log עם מי ביצע ומתי, Resolve דורש סיבה מתוך חמש מאושרות והערה רשות, ו־Resolve/Reopen דורשים אישור בדיאלוג. הכול נשמר ב־sessionStorage ושורד רענון באותה לשונית; ב־Demo ה־fixture הפך ל־seed התחלתי בלבד, כך שפעולות מפעיל אינן נדרסות ברינדור הבא.

**הפעולות אינן בתוך שורת ההתראה.** הן יושבות ב־Operational Action Bar חדש, בין ה־Decision Block ל־Grid, בגובה קבוע של 44–60px. שורת ההתראה **אינה משנה גובה** כשהיא נבחרת — נמדד בדפדפן, לא רק בקוד.

**שני תיקונים חוסמים בוצעו לפני כל השאר**, שניהם תיקוני אמת ולא פיצ'רים:

1. **יעד Reopen נקבע לפי `alert.owner` בלבד.** הקוד הקיים העדיף את המפעיל הנוכחי (`who || alert.owner`), כלומר כל משתמש מחובר היה גורם ל־RESOLVED לחזור ל־IN REVIEW — טענה שמישהו כבר טיפל, שלא הייתה נכונה. בנוסף Reopen כבר **אינו יוצר owner**.
2. **חומרת אזור עוקבת אחרי התנאי, לא אחרי הטיפול.** אזור נצבע לפי כל ההתראות שבהן `active === true`, ללא תלות ב־lifecycle. נשק שעדיין על המצלמה והמפעיל סגר את הטיפול בו — האזור נשאר DANGER.

---

## 2. גיבוי

| | |
|---|---|
| **נתיב מלא** | `C:\Users\SADAB\Desktop\ATAPIS-backups\hackathon-before-phaseA2-20260809-201021.zip` |
| **גודל** | 99.69 MB |
| **הוחרגו** | `node_modules`, `dist`, `venv`, `.venv`, `__pycache__`, `.vite`, `cache`, `.cache`, `logs`, `run-logs`, `outputs`, `*.pyc` |

**כל חמשת הגיבויים הקודמים נשמרו:** `hackathon-src-backup-20260729`, `hackathon-before-patch01-20260803`, `hackathon-before-phaseA0-20260804`, `hackathon-before-phaseA1-20260805`, `hackathon-before-phaseA1-1-20260805`.

לא הועתקו credentials לגיבוי־דיווח ולא ללוג.

---

## 3. קבצים חדשים

| קובץ | תפקיד |
|---|---|
| `src/concepts/industrial-ops/components/OperationalActionBar.jsx` | הנתיב הראשי לפעולות; זהות ההתראה + הפעולות החוקיות + SESSION-LOCAL |
| `src/concepts/industrial-ops/components/AlertActionDialogs.jsx` | `ResolveAlertDialog` + `ReopenAlertDialog` על `<dialog>` נטיבי |
| `src/concepts/industrial-ops/components/AlertContextMenu.jsx` | תפריט הקשר — נתיב משני, אותו dispatcher |
| `src/concepts/industrial-ops/components/alertLabels.js` | אוצר המילים (lifecycle / reasons / actions / source) — מקור אחד |
| `src/concepts/industrial-ops/components/alertPresentation.jsx` | שורת הזהות המשותפת לבר, לדיאלוגים ולתפריט |
| `src/concepts/industrial-ops/operatorLog.js` | פעולות מפעיל כשורות יומן + מיזוג ישר (טהור, Node-testable) |
| `scripts/phase-a2-operational-workflow-verify.mjs` | 245 בדיקות בשלוש שכבות |
| `scripts/phase-a2-screenshots.mjs` | 29 צילומי QA + manifest |

## 4. קבצים ששונו

**כל 15 הקבצים תחת `src/concepts/industrial-ops/`. אפס קבצים משותפים.**

| קובץ | שינוי |
|---|---|
| `alerts.js` | `reopenTargetLifecycle(alert)` חדש; `reopenAlert` מכריע לפי `alert.owner` בלבד ואינו כותב owner |
| `alertSelectors.js` | תיקון חומרת אזור; `activeConditionAlerts`, `legalActionsFor`, `ALERT_ACTIONS`, `blockingFilterAxes`, `FILTER_AXIS_UNBLOCK`, `unblockFilterPatch` |
| `alertStorage.js` | ציר `activity` נוסף ל־filters הנשמרים (שדה שכבר היה במודל) |
| `useAlertSelection.js` | `canonicalAlertState` מיוצא; פרמטר `seed`; איפוס mode ברמת render; `firstSnapshotRef` מודע־mode |
| `useIndustrialOpsCommandCenter.js` | הסרת מעקף ה־fixture; העברת ארבע הפעולות; `legalActions`/`selectedOutsideFilter`/`blockingAxes`/`unblockFilters`; `splitSessionLog` מכבד `entry.areaId` |
| `views/IndustrialDashboard.jsx` | Action Bar, דיאלוגים, תפריט, dispatcher יחיד, מיזוג יומן המפעיל |
| `components/AlertList.jsx` | `onContextMenu` + Shift+F10; הסרת שורת ה־line3 שגדלה בבחירה |
| `components/AlertFilters.jsx` | תווית `ALL OPEN` / `כל הפתוחות` |
| `industrial.css` | סגנונות בר/דיאלוג/תפריט/יומן־מפעיל; תקרת comfort 420→400 |
| `scripts/phase-a1-command-center-verify.mjs` | חיזוק בלבד: ניסוח 23 + הוספת 23d/23e |
| `scripts/phase-a1-1-height-verify.mjs` | חיזוק בלבד: השוואת טיפוגרפיה כ־multiset + רצפת 10.5px לטיפוגרפיה חדשה |

---

## 5. Demo — Canonical Seed

בנקודה אחת בלבד נבנה state:

```js
export function canonicalAlertState(isDemo, persisted = null) {
  const base = createInitialPersistedState()
  return {
    ...createInitialAlertState(),
    isDemo: Boolean(isDemo),
    alerts: persisted?.alerts || base.alerts,
    selection: { ...INITIAL_SELECTION, ...(persisted?.selection || {}) },
    filters: { ...DEFAULT_FILTERS, ...(persisted?.filters || {}) },
  }
}
```

`initialStateFor` קורא `loadState`; אם יש — משחזר דרך הפונקציה הזאת, אם אין — מזין את ה־fixture **דרך אותה פונקציה**. לכן seed טרי ו־session משוחזר הם אותו state shape **מעצם הבנייה**, לא מכוח בדיקה. ה־seed מועבר כפונקציה ונקרא רק כשהאחסון ריק.

בדיקות **B72–B78** מוכיחות: אותם מפתחות ב־state, ב־selection וב־filters, גם מול session live ריק; `isDemo` נוסע בתוך ה־state; קבוצת המסננים הנשמרת זהה לקבוצה שבזמן ריצה.

## 6. Demo persistence

| תרחיש | תוצאה | בדיקה |
|---|---|---|
| לשונית חדשה | fixture נקי, `actionLog` ריק | C51 |
| פעולת מפעיל | נשמרת מיד | C48 |
| רענון אותה לשונית | lifecycle + owner + actionLog משוחזרים | C48–C50 |
| Round-trip אחסון | reason, note, owner, לוג — הכול שורד | B79–B85 |
| StrictMode | **לוג של פעולה אחת, לא שתיים** | C50 |

## 7. מעבר Demo↔Live

| מעבר | תוצאה | בדיקה |
|---|---|---|
| Demo → Live | state של live בלבד; אף התראת demo לא נכנסת; אף `DEMO-AREA-*` | C52–C54 |
| Live → Demo | demo מוזרע מחדש בשלמותו; כל התראה `isDemo:true` | C55–C57 |
| רענון מיד אחרי מעבר | ה־mode הנכון משוחזר | C58 |
| כל אחד קורא רק את שלו | live מסרב state של demo ולהפך | B86–B88 |

**ה־invariant המחייב** — שלא יהיה commit שבו state של mode אחד נשמר תחת mode אחר — נאכף בכך שהאיפוס הוא **ברמת render ולא ב־effect**:

```js
if (state.isDemo !== Boolean(isDemo)) {
  setState(initialStateFor(isDemo, storageKey, seed))
}
```

אילו האיפוס היה ב־effect, היה קיים render מחויב אחד שבו ה־state מכיל את המצב הקודם בעוד ה־prop כבר מתאר את החדש — וה־effect של `saveState` היה כותב אותו לאחסון של ה־mode השגוי. React מריץ מחדש מיד ומשליך את הרינדור, ולכן שום effect אינו רואה את הצירוף המעורב.

## 8. תוצאות Strict Mode

האפליקציה רצה תחת `<StrictMode>` ב־`main.jsx`, ולכן **כל בדיקות הדפדפן הן בדיקות StrictMode**.

| | |
|---|---|
| Demo→Live, Live→Demo | ✔ C52–C58 |
| אין render loop | ✔ הדפוס מתייצב במעבר אחד; אין stack overflow ואין freeze |
| אין warning חדש | ✔ C59 — 0 שגיאות קונסולה מלבד `Failed to fetch` הקיים |
| אין seed כפול | ✔ ה־fixture הוא singleton במודול; C51 |
| אין הכפלת action log | ✔ C50 — לוג באורך 1 אחרי פעולה אחת |

**באג אמיתי ש־StrictMode חשף ותוקן:** המימוש הראשון סגר את ה־`<dialog>` ב־cleanup והסתמך על אירוע `close` כדי לעדכן את React. אבל `close()` משגר את האירוע **אסינכרונית**, ולכן ב־StrictMode (effect → cleanup → effect) האירוע של ה־cleanup הגיע אחרי שהדיאלוג כבר נפתח מחדש ונקרא כביטול — הדיאלוג נסגר ברגע שנפתח. התיקון: **React הוא הבעלים של הפירוק** — כל נתיב סגירה קורא ל־`onDismiss` ישירות, האלמנט פשוט מוסר, והפוקוס מוחזר במפורש ל־opener שנתפס פעם אחת.

## 9. לוגיקת Reopen ownership

```js
export function reopenTargetLifecycle(alert) {
  if (!alert || alert.lifecycle !== LIFECYCLE.RESOLVED) return null
  return alert.owner ? LIFECYCLE.IN_REVIEW : LIFECYCLE.ACKNOWLEDGED
}
```

`reopenAlert` משתמש בה, ו־`operator` נרשם ב־actionLog בלבד. **הפונקציה אינה מקבלת operator כלל** — כך אי אפשר להשתמש בו בטעות.

| דרישה | בדיקה |
|---|---|
| RESOLVED עם owner → IN REVIEW | B07 |
| RESOLVED בלי owner → ACKNOWLEDGED | B08 |
| משתמש מחובר בלי owner קודם → עדיין ACKNOWLEDGED | **B09** |
| Reopen אינו יוצר owner | **B10** |
| Reopen נרשם ב־actionLog | B11 |
| הדיאלוג מציג בדיוק את מה שיקרה | B12, C41 |

## 10. תיקון Area Severity

```js
const holding = activeConditionAlerts(alerts).filter((a) => a.areaId === area.id)  // התמונה בשטח
const mine    = operationalAlerts(alerts).filter((a) => a.areaId === area.id)      // התמונה על השולחן
```

`severity` מגיע מ־`holding` (‏`active === true`, כל lifecycle). המונים ו־`bestLifecycleRank` נשארים על `mine`. INFO עדיין לא מקדם אזור.

**B62–B71** מכסים: active DANGER בכל אחד מארבעת ה־lifecycles → DANGER; cleared → מפסיק להשפיע; active ALERT + RESOLVED → ALERT; lifecycle לעולם לא משנה חומרה כשהתנאי מתקיים; והמיון בפאנל האזורים עדיין מעלה את האזור לראש.

## 11-12. Operational Action Bar — מיקום וגובה

בין `</DecisionBlock>` ל־`<div className="io2-grid">`, בדיוק לפי הסדר שנדרש (A08 מאמת את הסדר בקוד; C02 מאמת בדפדפן שהוא מחוץ לרשימה).

| viewport / density | גובה נמדד |
|---|---|
| 1920 · compact/comfort · he | **44px** |
| 1920 · compact · en (מצב ארוך) | **60px** |
| 1366 · כל השילובים | **60px** |

**44–60px בכל 8 השילובים** (C89 ×8). ה־CSS מצהיר `min-height: 44px; max-height: 60px` (A09).

## 13. Lifecycle actions

`NEW → [Acknowledge, Start Review, Resolve]` · `ACKNOWLEDGED → [Start Review, Resolve]` · `IN REVIEW → [Resolve]` · `RESOLVED → [Reopen]`. מקור אחד — `legalActionsFor` — שגם הבר וגם התפריט צורכים (B41–B45, C11/C14/C19/C38).

**B46** מוכיח שאין כפתור מת: כל פעולה שה־UI מציע אכן משנה את ההתראה במנוע.

`runAlertAction(action, alertId)` הוא ה־dispatcher היחיד; Acknowledge/Start Review מיידיים, Resolve/Reopen פותחים אישור (A04–A07 סטטי, C70 בדפדפן).

## 14. Ownership

`Start Review` בלבד יוצר owner, מתוך המשתמש המחובר בפועל (`user.id` / `user.username` מ־`AuthContext`, כפי שכבר הועבר מ־A1). `Acknowledge` **אינו** מקבע בעלות (B30). אין נעילה, אין token, אין סנכרון בין דפדפנים, ואף פעולה אינה נחסמת בגלל owner. הבר מציג `SESSION OWNER · <שם>` (C20).

## 15-17. Resolve — flow, reasons, note

דיאלוג חובה (C21). מציג את שורת הזהות המלאה: ID / אזור / חומרה / lifecycle / condition / owner / source / Track-Target, וכל מזהה ב־`<bdi dir="ltr">`.

חמש סיבות בדיוק — `false_alarm, no_threat, handled, sensor_issue, other` — נטענות מ־`RESOLVE_REASONS` המיובא ולא מוקלדות מחדש (C24). **הכפתור disabled עד בחירת סיבה** (C23); זה מה שהופך את ה־no-op השקט של `resolveAlert` על סיבה לא חוקית לבלתי־נגיש מה־UI, בזמן ש־B17/B18 מוכיחות את ההגנה במנוע עצמו.

הערה רשות, `maxLength = 500` (‏`RESOLVE_NOTE_MAX`, C27), trim, ורווחים בלבד → `null` (C35). ללא HTML, ללא markdown, ללא שליחה לשרת.

## 18. אזהרת Condition Active

כאשר `alert.active === true` הדיאלוג מציג בלוק אדום: **"תנאי המקור עדיין פעיל — סגירת ההתראה מסיימת את תהליך הטיפול המקומי בלבד. היא אינה מעידה שהזיהוי או האיום נעלמו."** ‏(C25–C26). ה־Resolve עדיין אפשרי — False Alarm הוא תרחיש לגיטימי.

## 19. Reopen

דיאלוג חובה (C39). מציג זהות, את הסיבה/ההערה/הבעלים הקודמים, ואת **מצב היעד מראש** (C41–C42), שנקבע לפי הבעלות הקודמת בלבד.

## 20. התנהגות Escape / Cancel

| | |
|---|---|
| Escape סוגר | C28 |
| Escape אינו משנה דבר | C29 |
| הפוקוס חוזר לכפתור שפתח | C30 |
| פתיחה חוזרת נותנת טופס נקי | C31 |
| Cancel סוגר בלי לשנות | C32 |
| Backdrop click אינו מאשר ואינו סוגר | לפי מימוש — `stopPropagation`, ללא light-dismiss |

## 21. Context Menu

נתיב **משני**; כל פעולה בו קיימת גם כפתור בבר (C63). נפתח ב־right-click (C60) וב־Shift+F10 (C69), בוחר קודם את השורה שעליה נפתח (C62), מציג רק פעולות חוקיות + `COPY ALERT ID` עם ה־ID **המלא** (C64–C65), נצמד לתוך ה־viewport (C66), נסגר ב־Escape/מחוץ/גלילה/resize ומחזיר פוקוס לשורה (C67–C68), ומוסיף **0 לגובה המסמך** (C61).

## 22. Session Log — Operator Actions

`operatorLogEntries` משטח את ה־actionLog של כל ההתראות לשורות `source: 'operator'`, ‏`kind: 'operator'`, עם `SESSION-LOCAL` בטקסט (B89–B96, C45–C46). ה־`areaId` נלקח **מההתראה עצמה** — ערך מהמודל המוצהר, לא הסקה ממקור.

אירועי Camera/Radar/System/Controller נשארים בדיוק כפי שהיו (C47). המיזוג הוא **לתצוגה בלבד**; הפיד הגולמי לא נגע, והפס התחתון ממשיך לקרוא אותו ישירות.

## 23. טיפול ב־Timestamp של Controller

**אין timestamp מומצא. בשום מצב.**

- `sessionEntryEpoch` מחזיר epoch **רק** כשה־id נושא אותו (רשומות שה־adapter גזר). לרשומת בקר — `null` (B97–B99).
- המיזוג **אינו** נותן זמן לרשומה חסרת זמן, **אינו** יורש זמן משכנה, ו**אינו** קורא ל־`Date.now()` (B100).
- רשומה חסרת זמן **שומרת על מיקומה בסדר המקור שלה** ואינה משובצת כרונולוגית לפי זמן מומצא (B101–B102).
- לפעולת מפעיל **יש** זמן אמיתי — רגע הלחיצה (B94).

## 24. ALL OPEN

`ALL ACTIVE` → **`ALL OPEN`** / `כל הפעילות` → **`כל הפתוחות`**. תווית בלבד; ה־id הפנימי `LIFECYCLE_FILTERS.ALL_ACTIVE`, הלוגיקה והמונים ללא שינוי (A17–A18). מסנן ה־Condition נשאר נפרד ובלתי תלוי (B61).

הסיבה: "פעיל" הוא ציר התנאי; הטאב הזה הוא ציר ה־lifecycle. מילה אחת לשני מושגים היא בדיוק איך הם מתערבבים.

## 25. Selected alert outside filter

הבחירה נשארת (A0 מחפש את ה־id במודל המלא ולא ברשימה המסוננת). הבר מציג `OUTSIDE CURRENT FILTER` (C15) וכפתור `SHOW ALERT` שמשחרר **רק את הצירים החוסמים** (B47–B53, C16), ומשאיר כל מסנן אחר בדיוק כפי שהמפעיל קבע. `lifecycle` משתחרר ל־`ALL` ולא לברירת המחדל `ALL_ACTIVE`, שעדיין מסתירה RESOLVED.

## 26. DANGER חדשה בזמן טיפול

הדיאלוג נשאר פתוח, ההערה שנכתבה נשארת, ה־Notice נשאר גלוי, והבחירה לא זזה (C72–C76). מובטח מבנית: ה־state של הדיאלוג הוא `{type, alertId}` וה־alert נשלף טרי בכל render, כך ש־poll מעדכן את התוכן בלי לפרק את הרכיב.

## 27. הוכחה: active DANGER + RESOLVED נשאר DANGER

**שלוש הוכחות בלתי תלויות:**

- **לוגיקה — B65:** `areaOperationalSummary` על התראה `severity:danger, active:true, lifecycle:RESOLVED` מחזיר `DANGER`. ‏B69 מוסיף ש־`activeCount === 0` — שתי השאלות נשארות נפרדות.
- **דפדפן — C86:** חומרות האזורים **זהות** לפני ואחרי Resolve אמיתי בדפדפן. ‏C82/C83/C87: lifecycle=RESOLVED, condition=ACTIVE, severity=DANGER בו־זמנית.
- **צילום — `1920-he-active-danger-resolved-area-still-danger.png`:** הבר מציג `סכנה · נסגרה · התנאי פעיל`, ו־`DEMO-AREA-02` בפאנל האזורים עדיין **DANGER**.

## 28. הוכחה: Resolve אינו משנה Risk

`C84` — `SYS MODE` ללא שינוי. `C85` — `FUSED RISK` ללא שינוי. ‏B22/B23 — severity ו־active של ההתראה עצמה ללא שינוי. אף קוד ב־A2 אינו נוגע ב־snapshot, ב־thresholds או בחישוב סיכון.

## 29. הוכחה: אין owner מומצא ב־Reopen

`B10` — `reopenAlert` על התראה חסרת owner, עם operator מחובר, מחזיר `owner === null`. `B09` — היעד נשאר ACKNOWLEDGED. החתימה `reopenTargetLifecycle(alert)` אינה מקבלת operator כלל (A16).

## 30. הוכחה: אין timestamp מומצא ל־Controller

`B98` (אין epoch מ־id של בקר) · `B100` (המיזוג משאיר `at` ריק) · `B101` (הרשומה נשארת במקומה, לא משובצת לפי זמן מומצא). אין `Date.now()` ב־`operatorLog.js` בנתיב הזה.

## 31. הוכחה: אין Backend persistence

אין קריאת רשת חדשה בכל A2. הכול ב־`sessionStorage` תחת מפתח A0 הקיים. כל alert נושא `persisted: false, sessionLocal: true` וה־storage אוכף זאת מחדש בשחזור (B85). הבר מציג `SESSION-LOCAL · NOT SERVER-PERSISTED` בכל מצב (C06), והדיאלוגים אומרים שהמצב נשמר בלשונית הזאת בלבד ואינו נשלח לשרת. שום מחרוזת "Saved"/"Synced"/"Server updated" אינה מופיעה.

## 32. הוכחה: אין permissions

`A12` — אחרי הסרת הערות, אין ב־UI של ה־workflow אף `role ===`, `isAdmin`, `user.role`, `unauthorized`, `supervisor` או `permissionDenied`. כל משתמש מחובר מבצע את כל הפעולות.

## 33. הוכחה: אין Camera↔Radar association

`C91` — אין Pair/Combined/Matched/Confirmed בעמוד המרונדר. `C92`/`C94` — אף התראת מצלמה, ואף שורת הזהות בבר, אינה טוענת `CAM-0n` כמקור. `C93` — Fused Risk עדיין נושא ייחוס ל־Backend. הכלל מרוכז ב־`sourceLabel` ב־`alertLabels.js`, כך שכל ארבעת המשטחים יורשים אותו.

---

## 34. תוצאות כל ה־Gates

| Gate | Baseline (לפני A2) | אחרי A2 | מצב |
|---|---|---|---|
| `npm run build` | ירוק | **ירוק** | ✔ |
| lint scoped | 4 errors / 0 warnings | **4 / 0** | ✔ ללא הרעה |
| `phase-h-qa.mjs` | 92/93 | **92/93** | ✔ (אותו כשל fetch ותיק ב־`/design-lab`) |
| `phase-prime-verify.mjs` | 30/30 | **30/30** | ✔ |
| `phase-prime-noregress.mjs` | ללא רגרסיות | **ללא רגרסיות** | ✔ |
| `phase-a0-alerts-verify.mjs` | 64/64 | **64/64** | ✔ |
| `phase-a1-command-center-verify.mjs` | 87/87 | **89/89** | ✔ חוזק |
| `phase-a1-1-height-verify.mjs` | 53/53 | **53/53** | ✔ חוזק |
| `phase-a2-operational-workflow-verify.mjs` | — | **245/245** | ✔ חדש |

**אף בדיקה לא נמחקה ולא הוחלשה.** שתי בדיקות עודכנו, שתיהן לחיזוק:

- **A1 בדיקה 23** — הניסוח "cleared **and resolved**" הפך ל"cleared" (הכלל הישן היה שגוי), ונוספו **23d** (‏active DANGER + RESOLVED ⇒ אזור DANGER) ו־**23e** (ובכל זאת מחוץ למניין העבודה). ‏87 → 89.
- **A1.1 בדיקות 01–03** — ההשוואה לטיפוגרפיה של הקובץ שלפני A1.1 הייתה לפי **אינדקס**, ולכן כל הוספת CSS באמצע הקובץ הייתה מפילה אותה בלי לומר דבר על הגדלים. הוחלפה בהכלת **multiset** — חזקה יותר, כי היא מזהה כל הקטנה/הסרה/החלפה ואינה תלויה בסדר — **ונוספה רצפה חדשה:** כל font-size שנוסף מאז חייב להיות ≥ 10.5px. 18 הצהרות נוספו, הקטנה שביניהן 10.5px.

**245 בדיקות A2** מכסות את 113 התרחישים של §48: מעברי lifecycle (15), מפעיל (8), Demo state (13), דיאלוגים (12), חומרת אזור (7), מסננים (10), יומן (10), Action Bar (11), תפריט (8), גובה (10), יושרה (9) — ועוד.

## 35. מספר בדיקות A2

**245** — 18 סטטיות · 90 לוגיות · 137 בדפדפן.

## 36. Height — A1.1 מול A2

מדידה ב־`phase-a1-1-measure.mjs` **ללא שינוי**:

| קונפיגורציה | גלילה A1.1 → A2 | התראות גלויות | Alert list | Action Bar | Feed | פאנלים תחתונים |
|---|---|---|---|---|---|---|
| 1920 he compact demo | 414 → **459** (+45) | 6 → **6** | 368 | 44 | 401 → 401 | 839 → 884 |
| 1920 en compact demo | 485 → **530** (+45) | 5 → **5** | 368 | 60 | 401 → 401 | 892 → 937 |
| 1920 he comfort demo | 544 → **569** (+25) | 6 → **6** | 420 → **400** | 44 | 401 → 401 | 911 → 936 |
| 1920 en comfort demo | 615 → **640** (+25) | 5 → **5** | 420 → **400** | 44 | 401 → 401 | 964 → 989 |
| 1920 he live | 74 → **143** | 1 → 1 | 53 | 44 | 151 → 175 * | 489 → 557 |
| 1366 he compact demo | 1101 → **1162** (+61) | 5 → **5** | 310 | 60 | 321 → 321 | 1065 → 1126 |
| 1366 en compact demo | 1209 → **1270** (+61) | 4 → **4** | 310 | 60 | 321 → 321 | 1173 → 1234 |
| 1366 he comfort demo | 1221 → **1282** (+61) | 5 → **5** | 344 | 60 | 321 → 321 | 1131 → 1192 |
| 1366 he live | 728 → **789** | 1 → 1 | 53 | 60 | 151 → 191 * | 686 → 747 |

**התוספת היא הבר עצמו:** ‏+45px ב־1920 (44px + תפר 1px) ו־+61px ב־1366 (60px + 1px). **בתוך תקציב ה־≤60px** שהוגדר.

\* ב־Live אין מצלמה, ולכן הערך הזה הוא גובה מסך `CAMERA UNAVAILABLE`, שגודלו נגזר מטקסט השגיאה שה־backend מדווח באותו רגע. הוא נמדד 175px גם ב־baseline של A1.1 לפני ה־patch — התנודה הזאת אינה תוצאה של A2.

**הערת מדידה ביושר:** בהרצה של `phase-a1-1-measure.mjs` השורה `1366 en comfort` מדווחת 4 התראות; בהרצות מסוימות היא מדדה 3. הסיבה היא שהסקריפט מנווט בין 12 קונפיגורציות **באותה לשונית**, וב־A2 מצב ה־Demo נשמר בין ניווטים (זו הדרישה של §21). אימות עם **session נקי לכל קונפיגורציה** — C88 ×8 — מראה שכל שמונה השילובים בטווח.

## 37. מספר Alerts גלויים

| | יעד | תוצאה |
|---|---|---|
| 1920 · he/en · compact/comfort | 5–6 | **6 / 5 / 6 / 5** ✔ |
| 1366 · he/en · compact/comfort | 4–5 | **5 / 4 / 5 / 4** ✔ |

נמדד ב־session נקי לכל שילוב (C88).

## 38. נתיבי צילומים

`hackathon/artifacts/industrial-ops-phase-a2/shots/` — **29 צילומים** + `manifest.json` (viewport, שפה, density, live/demo, גלילה, התראות גלויות, גובה בר, lifecycle לכל צילום).

**1920 עברית (13):** new-selected · acknowledged · selected-outside-filter · in-review-with-owner · resolve-dialog-active-condition-warning · resolve-dialog-filled · resolved · reopen-dialog · session-log-operator-action · context-menu · new-danger-during-resolve-dialog · **active-danger-resolved-area-still-danger** · demo-persisted-after-reload

**1920 אנגלית (7):** new-selected · in-review · resolve-dialog · resolved · reopen-dialog · many-alerts-with-action-bar · comfort-action-bar
**1920 Live (1):** live-action-bar

**1366 (8):** new-action-bar · in-review · resolve-dialog · resolved · many-alerts · context-menu · en-action-bar-long-state · **active-danger-resolved-lifecycle**

לא זויפה חומרה: צילומי ה־Live מציגים `CAMERA UNAVAILABLE` ו־`RADAR DISCONNECTED` כי זה מה שהמחשב הזה מדווח; כל מצבי ה־DANGER מצולמים ב־Demo ונושאים תגי DEMO.

## 39. בעיות שנותרו

1. **הוסרה שורת "ראיות פעילות נוספות באזור" משורת ההתראה הנבחרת.** ‏§31 מחייב שגובה השורה יהיה זהה נבחרת ולא־נבחרת, ונמדד בדפדפן; השורה הזאת (מ־A1) הוסיפה 19px לשורה הנבחרת בלבד. **המידע לא ירד מהמסך** — אותו הקשר, באותו ניסוח `NOT ASSOCIATED`, נמצא ב־Decision Block שכבר מקבל אותו. נדרש אישורך שהמסחר הזה מקובל.
2. **תקרת comfort ב־1920 ירדה 420→400.** כתוצאה מ־(1) השורות התקצרו והחלון הראה 7 התראות במקום 5–6. התוצאה: פחות גלילה, לא יותר.
3. **‏1366 נשאר סביב 1162–1397px גלילה.** זה מצב A1.1 בתוספת הבר; לא נעשה ניסיון לשפר מעבר לכך, כי §42 קובע ש־A1.1 הוא ה־Baseline.
4. **`otherEvidenceCount` הוסר כ־prop** מ־`AlertList`; `cc.otherEvidence` עדיין מוזן ל־Decision Block ללא שינוי.
5. **כשל ותיק אחד ב־`phase-h-qa.mjs`** — לוג fetch-abort ב־`/design-lab`, קיים מלפני A0, לא נגעתי בו לפי §1.

## 40. סיכונים ל־A3

- **תקציב הגובה מוצה כמעט לחלוטין.** ‏A3 (‏Sound/Global Mute) חייב להיות **כפתור בתוך פס קיים** ולא פס נוסף. הבר של A2 כבר תופס 44–60px.
- **מדיניות autoplay:** צליל לא ינוגן לפני אינטראקציה של המשתמש בדף. חמ״ל שמריץ מסך ללא נגיעה לא ישמע דבר — חובה חיווי `SOUND BLOCKED` אמיתי ולא הצהרת `SOUND ON` שקרית.
- **תזכורת חוזרת עדיין ללא source of truth** (§49) — לא מומשה, ולא לקבוע ערך שרירותי ב־A3.
- **‏`<dialog>` נטיבי:** הלקח מ־A2 — אירוע `close` אסינכרוני. כל overlay עתידי חייב שה־React יהיה הבעלים של הפירוק.
- **‏Demo persistence משנה את כלי המדידה:** כל סקריפט מדידה עתידי צריך context נקי לכל קונפיגורציה, אחרת הוא מודד את המצב שהשאירה הקונפיגורציה הקודמת.

## 41-44. אישורים מפורשים

**41. לא התחלתי A3.** אין Sound, אין WebAudio, אין Global Mute, אין reminder, אין mute preference.

**42. לא התחלתי Calibration.** אין gate calibration, אין fence calibration, אין `calibration.json`, אין נגיעה ב־`GATE_POINT`/`FENCE_LINE_Y`, אין UI כיול.

**43. לא התחלתי OPT.** אין Open in OPT, אין ניווט בדאבל־קליק, אין Enter ל־OPT, אין query params, אין העברת הקשר מצלמה/track/target. ‏`Enter` נותר במכוון לא־מקושר.

**44. לא שיניתי Backend / API / Auth / routes / database / Risk Logic / thresholds.** ‏`python/**` כולו, ‏`server.py`, ‏`analysis.py`, ‏`ld2450_reader.py`, ‏`radar_simulator.py`, ‏`.env`, ‏`radar_config.json`, ‏COM, ‏Baud, ‏credentials, ‏`users.json`, מודלי YOLO, ספי 40/75 — לא נפתחו לעריכה. אף route ואף endpoint לא נגע.

**45. לא שיניתי קונספטים אחרים ולא קבצים משותפים.** אומת בזמני שינוי הקבצים: `IndustrialShell.jsx`, ‏`OpenAlerts.jsx`, ‏`TargetsTable.jsx`, ‏`TracksTable.jsx`, ‏`ConfirmDialog.jsx`, ‏`CameraFeed.jsx`, ‏`useDashboardViewModel.js`, ‏`useMonitoringViewModel.js`, ‏`AuthContext.jsx`, ‏`concepts-base.css`, ‏`ConceptsApp.jsx`, ‏`ConceptSwitcher.jsx`, ‏`shortcuts.js`, ‏`demoAlerts.js`, ‏`areas.js` — **כולם ללא שינוי**. ‏Fusion Prime, ‏Minimal Command, ‏Sentinel 3D, ‏Neural Fusion ו־design-lab מאומתים ע"י `phase-prime-verify` 30/30 ו־`phase-prime-noregress`.

---

## Definition of Done

| דרישה | מצב |
|---|---|
| Select → Acknowledge → Start Review → Resolve → Reopen | ✔ |
| lifecycle / owner / actionLog נשמרים | ✔ |
| Demo נשמר אחרי רענון באותה לשונית | ✔ |
| Demo ו־Live אינם מתערבבים | ✔ |
| Reopen מכבד owner קודם בלבד | ✔ |
| Resolve דורש reason | ✔ |
| Resolve/Reopen דורשים confirmation | ✔ |
| Escape אינו גורם mutation | ✔ |
| Dialog state ו־React state מסונכרנים | ✔ |
| Controller timestamps אינם מומצאים | ✔ |
| Area Severity נאמנה לאיום הפעיל | ✔ |
| DANGER חדשה אינה חוטפת selection | ✔ |
| Action Bar אינו מגדיל Alert rows | ✔ |
| גובה בתוך תקציב A1.1 + הבר | ✔ |
| כל Baseline tests עוברים | ✔ |
