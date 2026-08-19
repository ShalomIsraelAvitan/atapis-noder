# Phase A0 — Data Foundations · מפרט מחייב

**תאריך:** 2026-08-04 · **Scope:** `src/concepts/industrial-ops/` בלבד — לוגיקה ונתונים, ללא שינוי UI.

מסמך זה מגדיר את כללי הזהות, ה־deduplication, מחזור החיים והאחסון **לפני** המימוש. הקוד חייב לתאום אותו.

---

## 0. ארבעה צירים בלתי תלויים

הבלבול הנפוץ ביותר במערכות התראה הוא ערבוב של ציר אחד באחר. במימוש הזה יש **ארבעה** צירים נפרדים, ולכל אחד שדה משלו:

| ציר | שדה | ערכים | מי קובע |
|---|---|---|---|
| **חומרה** | `severity` | `info` · `alert` · `danger` | הנתון מה־Backend |
| **מצב התנאי** | `active` / `clearedAt` | התנאי מתקיים כרגע / הפסיק | מנוע ההתראות מה־snapshot |
| **מחזור חיים תפעולי** | `lifecycle` | `NEW` · `ACKNOWLEDGED` · `IN_REVIEW` · `RESOLVED` | פעולת מפעיל בלבד |
| **מצב המקור** | `sourceState` | `LIVE` · `DISCONNECTED` · `STALE` · `DISABLED` · `ERROR` · `UNKNOWN` | סטטוס החיישן |

**כלל־על:** התראה שהתנאי שלה חדל להתקיים (`active: false`) **אינה** משנה `lifecycle`. התראת `NEW` שנעלמה נשארת `NEW` — היא קרתה, ואיש לא טיפל בה. רק מפעיל משנה `lifecycle`.

---

## 1. מודל האזורים

### Live — אזור יחיד, mapping מוצהר

המיפוי **מוצהר בקוד ואינו נגזר אוטומטית** מהנתונים:

| מקור אמיתי | מזהה מוצהר |
|---|---|
| `snapshot.cameras.webcam` | `CAM-01` |
| `snapshot.cameras.dahua` | `CAM-02` |
| הרדאר היחיד (`snapshot.radar`) | `RDR-01` |

```
AREA-01 · "Primary Site" / "אתר ראשי"
  deploymentMode: 'single-area'
  isDemo: false
  cameras: [CAM-01(webcam), CAM-02(dahua)]
  radars:  [RDR-01]
  primaryCameraId: null      ← אין source of truth. לא ממציאים.
```

**אין** שמות כמו "מגדל צפוני" / "שער מערבי" ב־Live. אזור נוסף ייווצר רק אם יתווסף לקובץ התצורה במפורש, או בעתיד מ־`/api/areas` (לא ממומש כעת).

### Demo — ריבוי אזורים מותר

כל אזור Demo נושא `isDemo: true`, מזהה בתחילית `DEMO-`, ומקורות Mock בלבד. המודל תומך ב־N אזורים כדי שהמעבר ל־`/api/areas` יהיה החלפת מקור נתונים בלבד.

### resolveAreaId — חיפוש, לא ניחוש

`resolveAreaIdForSource(areas, { sourceType, sourceKey })` מחזיר `areaId` **רק** כשהמקור מופיע במיפוי המוצהר, אחרת `null`. אין fallback ל"אזור הראשון".

---

## 2. cameraId אינו ידוע — כלל מחייב

ה־Backend אינו מציין איזו מצלמה יצרה אירוע: `/status` מאחד את המקורות לתמונת מצב גלובלית (`_build_global_status_snapshot`), ו־`track` אינו נושא `cameraId`.

לכן להתראת מצלמה:

```
sourceType: 'camera'
sourceId: null
cameraSourceKnown: false
```

**אסור:** להסיק CAM-01/CAM-02, להצמיד את המצלמה הראשית כמקור, לסנן tracks לפי מצלמה, או להעביר cameraId ל־OPT.
כשיהיה `sourceKey` אמיתי — `cameraIdForSourceKey()` כבר מוכן למפות אותו.

התראות רדאר **כן** מקבלות `sourceId: 'RDR-01'`, כי קיים בדיוק רדאר אחד מוצהר.

---

## 3. מקור ההתראות — snapshot, לא הפיד הקיים

המנוע צורך **snapshots** (‏`adaptSnapshot`), לא את `vm.alerts`.

הסיבה: `vm.alerts` הוא יומן מעברים (`useAtapisData.js:69-91`) — הוא יורה פעם אחת במעבר ואין לו מושג "התנאי עדיין מתקיים". בלי הערכת תנאי לכל poll אי אפשר לעדכן `lastSeenAt`, אי אפשר לזהות שהתנאי חדל, ואי אפשר לטפל בכניסה לדף כשהמערכת כבר ב־DANGER.

### משפחות תנאים ממומשות ב־A0

| # | משפחה | תנאי (מה־snapshot) | sourceType | kind | severity |
|---|---|---|---|---|---|
| 1 | נשק על מסלול | `track.hasWeapon` או `state==='armed'` | camera | `weapon` | danger |
| 2 | נשק ללא מסלול | `snapshot.hasWeapon` ואין track נושא נשק | camera | `weapon` | danger |
| 3 | התנהגות | `track.state ∈ {running, approaching, loitering, gate_loitering}` | camera | `behavior` | alert |
| 4 | נוכחות | `track` קיים ואינו נכנס ל־3 | camera | `person` | info |
| 5 | קישור רדאר | הרדאר אינו מחובר / מושבת / STALE | radar | `connection` | alert |
| 6 | מטרה סוגרת | `target.direction==='approaching'` | radar | `target` | alert אם `approachingGate`, אחרת info |
| 7 | מצב מערכת | `snapshot.mode !== 'SAFE'` | system | `mode` | לפי mode |

**גבול מוצהר של A0:** הודעות הבקר (`/api/arduino-messages`) אינן חלק מה־snapshot המנורמל ולכן אינן מיוצרות כהתראות בשלב זה. יתווסף כשיחובר מקור.

---

## 4. Fingerprint ו־deduplication

`Date.now()` **אינו** מזהה. הזהות היא `fingerprint` דטרמיניסטי; ה־`id` הוא מפתח מופע.

```
fingerprint = [areaId, sourceType, kind, discriminator].join('|')
id          = `${fingerprint}#${instanceSeq}`      ← מופע; עולה רק ב־reactivation
```

| משפחה | discriminator | דוגמה |
|---|---|---|
| נשק על מסלול | `track:<id>` | `AREA-01\|camera\|weapon\|track:7` |
| נשק ללא מסלול | `track:none` | `AREA-01\|camera\|weapon\|track:none` |
| התנהגות | `track:<id>:<state>` | `AREA-01\|camera\|behavior\|track:7:running` |
| נוכחות | `track:<id>` | `AREA-01\|camera\|person\|track:7` |
| קישור רדאר | `RDR-01:<linkState>` | `AREA-01\|radar\|connection\|RDR-01:DISCONNECTED` |
| מטרה סוגרת | `RDR-01:target:<id>` | `AREA-01\|radar\|target\|RDR-01:target:1` |
| מצב מערכת | `<mode>` | `AREA-01\|system\|mode\|DANGER` |

**שתי החלטות מכוונות:**
- מצב החיבור נכלל ב־fingerprint → `DISCONNECTED` ואחריו `STALE` הן שתי התראות. כך נדרש במפורש בהנחיה.
- ה־mode נכלל ב־fingerprint → **ALERT → DANGER יוצר התראה חדשה**, וההתראה של ALERT נסגרת (`active:false`). היסטוריית ההסלמה נשמרת במקום להיעלם בעדכון־במקום.
- `behavior` כולל את ה־state → מעבר `running` → `loitering` הוא אירוע נפרד. זו התנהגות מכוונת: שינוי התנהגות הוא אירוע תפעולי.

---

## 5. פתיחה · עדכון · סגירה · הפעלה מחדש

לכל poll: בונים את קבוצת המועמדים מה־snapshot, ואז:

| מצב | פעולה |
|---|---|
| fingerprint לא קיים | **פתיחה** — alert חדש, `lifecycle: NEW`, `firstSeenAt = lastSeenAt = now`, `instanceSeq: 1` |
| קיים ו־`active` | **עדכון** — `lastSeenAt = now`; ריענון `message` ו־`sourceEvidence`. `lifecycle`, `owner`, `firstSeenAt` **לא נוגעים** |
| קיים אך `cleared`, והפער `≤ REACTIVATION_WINDOW_MS` | **הפעלה מחדש של אותו מופע** — `clearedAt = null`, `lastSeenAt = now`, `reactivationCount++`. אותו `id`, אותו `lifecycle` |
| קיים אך `cleared`, והפער `> REACTIVATION_WINDOW_MS` | **מופע חדש** — `instanceSeq++`, ‏`id` חדש, `lifecycle: NEW`. הישן נשאר בהיסטוריה |
| קיים ו־`active` אך אינו במועמדים | **סגירה** — `clearedAt = now`, `active = false`. **`lifecycle` לא משתנה** |

### REACTIVATION_WINDOW_MS = 15000

קבוע יחיד ומיוצא. הנימוק: ה־poll הוא 1s ו־STALE של הרדאר הוא 3s (`useFreshness.js`), כך שהבהוב רגעי חייב להיבלע; פער של 15s כבר אינו רעש אלא אירוע נפרד.
⚠️ **זהו ערך שנבחר הנדסית, לא ערך שמגיע ממקור אמת מבצעי.** מסומן לאישור. הוא **אינו** ה־reminder interval מסעיף 28 של ההנחיה — זה לא ממומש כלל.

### כניסה לדף כשהמערכת כבר ב־DANGER

התראה נפתחת עם `firstSeenAt = now` ועם `observedFromSessionStart: true`. אין ידיעה מתי התנאי באמת התחיל, ולכן השדה נקרא `firstSeenAt` — **נראה לראשונה**, לא "החל". ה־UI יציג זאת ככזה.

### נשק שנשאר מזוהה לאורך polls

fingerprint זהה → התראה אחת, `lastSeenAt` מתקדם. גם 20 polls = alert אחד.

### רדאר שמתנתק, מתחבר ומתנתק שוב

התנתקות ראשונה פותחת `...|RDR-01:DISCONNECTED`. חיבור סוגר אותה. התנתקות שנייה: אם בתוך 15s — הפעלה מחדש של אותו מופע; אם אחרי — מופע חדש עם `NEW`.

---

## 6. קיבוץ — מה מותר ומה אסור

`areaId` הוא **הקשר תפעולי בלבד**. הוא אינו מוכיח ששני מקורות זיהו את אותו אירוע.

- התראת מצלמה נשארת התראת מצלמה. התראת רדאר נשארת התראת רדאר. התראת מערכת נשארת התראת מערכת.
- **אין מיזוג לפי אזור. אין association לפי זמן. אין Pair Risk. אין Matched/Associated/Confirmed. אין אחוזי התאמה. אין קו Camera↔Radar.**
- `Fused Risk` נשאר אך ורק `snapshot.risks.fused` מה־Backend.

`otherActiveEvidenceInArea` הוא מערך **מזהי התראות אחרות פעילות באותו אזור**, מחושב לתצוגה בלבד, בניסוח העתידי:
`Other active evidence in this area — not associated` / `ראיות פעילות נוספות באזור — ללא שיוך`.

קיבוץ אמיתי רק כאשר ה־Backend יחזיר `eventId` / `alertGroupId`. ב־Demo בלבד מותר `demoScenarioId`, מסומן.

---

## 7. מחזור חיים מקומי

```
NEW ──ack──> ACKNOWLEDGED ──review──> IN_REVIEW ──resolve──> RESOLVED
 │                 │                      │                     │
 └────review───────┘                      │                     │
 └────resolve──────────────────────────────┘                    │
                                    reopen (owner?IN_REVIEW:ACK) ┘
```

| פעולה | ממצב | למצב | נשמר |
|---|---|---|---|
| `acknowledge` | NEW | ACKNOWLEDGED | `acknowledgedAt`, מפעיל |
| `startReview` | NEW, ACKNOWLEDGED | IN_REVIEW | `reviewStartedAt`, `ownerId`, `ownerName` |
| `resolve` | כל מצב ≠ RESOLVED | RESOLVED | `resolvedAt`, `resolveReason`, `resolveNote`, מפעיל |
| `reopen` | RESOLVED | IN_REVIEW אם יש בעלים, אחרת ACKNOWLEDGED | `reopenedAt`, מפעיל |

מעבר לא חוקי מוחזר כ־no-op (אותו אובייקט), ללא זריקת חריגה.

סיבות סגירה מאושרות: `false_alarm` · `no_threat` · `handled` · `sensor_issue` · `other`.

כל פעולה מוסיפה רשומה ל־`actionLog`: `{ at, action, from, to, operatorId, operatorName, reason?, note? }`.

**בעלות מקומית לסשן בלבד.** אין נעילה, אין סנכרון בין משתמשים, אין concurrency. `ownerName` נלקח מהמשתמש המחובר בסשן הנוכחי.

**אין הרשאות ב־A0.** אין חסימת Resolve/Reopen לפי role, ואין `Unauthorized` / `Permission denied` / `Supervisor required` / `Backend enforced`.

### סימון אמינות

כל התראה נושאת קבוע `persisted: false` ו־`sessionLocal: true`. ה־UI העתידי יציג תמיד `SESSION-LOCAL · NOT SERVER-PERSISTED`. אין להציג פעולה כאילו נשמרה בשרת.

---

## 8. מודל ה־Alert

```js
{
  id, fingerprint, instanceSeq,
  areaId, areaIsDemo,
  severity,            // info | alert | danger
  kind,                // weapon | behavior | person | connection | target | mode
  sourceType,          // camera | radar | system
  sourceId,            // 'RDR-01' | null
  cameraSourceKnown,   // false בכל התראת מצלמה כיום
  sourceState,         // LIVE | DISCONNECTED | STALE | DISABLED | ERROR | UNKNOWN
  message, messageHe,
  trackId, targetId,   // null כשלא רלוונטי
  firstSeenAt, lastSeenAt, clearedAt, active,
  observedFromSessionStart, reactivationCount,
  lifecycle, owner: { id, name } | null,
  acknowledgedAt, reviewStartedAt, resolvedAt, reopenedAt,
  resolveReason, resolveNote,
  actionLog: [],
  sourceEvidence: [],              // ראיות של המקור הזה בלבד
  otherActiveEvidenceInArea: [],   // מזהי התראות אחרות באזור — ללא שיוך
  persisted: false, sessionLocal: true,
  isDemo, demoScenarioId,
}
```

---

## 9. sessionStorage

```
key    : industrial-ops-alert-state-v1
schema : { v: 1, savedAt, isDemo, alerts[], selection{}, filters{} }
```

- **sessionStorage בלבד** — לא localStorage. רענון באותה לשונית משמר; לשונית חדשה מתחילה נקי.
- `deserializeState` **לעולם אינו זורק**: JSON פגום, `v` שונה, שדות חסרים או צורה לא צפויה → `null`, והקורא מתחיל ממצב ריק.
- אם `isDemo` השמור שונה מהנוכחי → המצב נזרק. כך נתוני Demo ו־Live לעולם אינם מתערבבים.
- כל גישה ל־storage עטופה ב־`try/catch` (מצב פרטי / storage חסום).
- `alerts` מסוננות לפני שמירה: RESOLVED ישנות נשמרות עד תקרה, כדי שהמצב לא יגדל ללא גבול.

מה נשמר: `alerts` (כולל lifecycle, owner, resolveReason, actionLog) · `selectedAreaId` · `selectedAlertId` · `lastSelectedCameraId` (בחירת UI בלבד — **לא** מקור התראה) · `filters` · `searchQuery`.

---

## 10. Selection

1. ברירת מחדל: ההתראה **הפעילה** החמורה ביותר. DANGER לפני ALERT; NEW לפני ACKNOWLEDGED לפני IN_REVIEW; באותה רמה — החדשה יותר.
2. RESOLVED לעולם אינה ברירת מחדל.
3. אין התראות פעילות → נשארים באזור האחרון שנבחר; אם אין — האזור היחיד/הראשון.
4. **DANGER חדשה אינה משנה את הבחירה.** היא עולה לראש המיון ומרימה `hasUnseenDanger` + `unseenDangerAlertId`. ההחלפה רק בפעולה מפורשת של המפעיל.
5. ההתראה הנבחרת שנפתרה — **נשארת נבחרת**. אין העברה אוטומטית.
6. `selected` נפרד לחלוטין מ־keyboard focus (ה־focus אינו במודול הזה).

---

## 11. מסננים, חיפוש ומונים

מסננים: `lifecycle` · `areaId` · `severity` · `sourceType` · `activity` (active|cleared|all) · טקסט חופשי.

`ALL_ACTIVE` = `NEW ∪ ACKNOWLEDGED ∪ IN_REVIEW`. ‏`RESOLVED` אינו נכלל ואינו מעמיס על הרשימה הפעילה.

**מונים:** מחושבים מהמערך לאחר יישום כל המסננים **פרט למסנן ה־lifecycle עצמו**. אחרת בחירת `NEW` הייתה מאפסת את שאר המונים — מונה מטעה.

חיפוש: case-insensitive, על `id`, `fingerprint`, `areaId`, שם האזור (שתי השפות), `message`/`messageHe`, `sourceId`, `trackId` (`#7` / `7`), `targetId` (`T1` / `1`). מספרים ומזהים נשמרים כפי שהם.

---

## 12. גבולות A0

**לא ממומש בשלב זה:** Grid חדש · פאנל Areas חזותי · Operational Alerts UI · Visual Feed · Radar כלשונית · ALL CAMERAS · Context Menu · Resolve Dialog · Banner · WebAudio · Global Mute · קיצורי A/R/M · OPT context · Backend/API/DB/permissions/persistence שרתית · reminder interval · View Full Alert History.

**חיבור ל־UI:** לא בוצע. אף רכיב קיים לא ייבא את המודולים החדשים, ולכן ה־Baseline החזותי לא יכול להשתנות. האימות כולו דרך `scripts/phase-a0-alerts-verify.mjs`.
