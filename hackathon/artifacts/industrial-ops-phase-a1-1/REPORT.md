# Phase A1.1 — Height & Scroll Optimization · דוח סיום

**תאריך:** 2026-08-05 · **מסך:** `/concepts/industrial/dashboard` · **סוג:** Patch חזותי בלבד

---

## 1. סיכום השינוי

צומצמה גלילת העמוד ב־OPS על ידי **הקטנת גובה רשימת ההתראות והידוק מרווחים אנכיים בלבד** — בדיוק השיטה שההנחיה מתירה (§2), ולא מעבר לה.

ארבעה שינויים בקובץ CSS אחד:

1. **גובה רשימת ההתראות** ירד בכל ארבע נקודות ההגדרה: `512→368` (בסיס), `460→420` (comfort), `396→310` (‏≤1500px), `400→310` (‏≤820px גובה), ובנוסף נוספה הגדרת comfort ייעודית לשני ה־breakpoints הצרים (`344`).
2. **padding אנכי בפאנלים** ‏`12→9` ב־compact ו־`16→12` ב־comfort — **padding אופקי לא נגע**, ולכן אף שורה לא שינתה נקודת שבירה.
3. **המרווח בין כותרת פאנל לתוכן** ‏`10→8` (compact) ו־`12→10` (comfort).
4. **padding אנכי בשני תאי ה־Decision Band** ‏`10→8` / `10` (comfort) — לפי ההיתר המפורש ב־§9.

שלושת האחרונים רוכזו לשלושה משתני CSS מקומיים (`--io2-panel-pad-y`, `--io2-panel-gap`, `--io2-band-pad-y`) כדי שתקציב הגובה יישב במקום אחד.

**מה לא נעשה:** לא הוקטן גופן, לא שונה line-height, לא הוסר מידע, לא נוספה יכולת, לא שונה A0, לא שונה סדר או מבנה ה־Grid, לא נוגע ב־JSX כלל.

### שינוי אחד שנוסה, נמדד ובוטל

נוסה **repack של שורות ה־Grid ב־≤1500px** — הוצאת ה־Feed מפריסה על שתי שורות והעלאת System Health לצד Areas. הוא הוחזר **88px** בלבד, שינה את סדר הפאנלים המאושר, **והוציא את Areas מתחת לקיפול במצב Live** שבו הפריסה הייתה תקינה מלכתחילה. השינוי בוטל במלואו והנימוק תועד בהערה בקוד. `grid-template-areas` זהה היום לחלוטין למה שהיה לפני A1.1 — ובדיקה 09 מוודאת זאת אוטומטית.

---

## 2. גיבוי

| | |
|---|---|
| **נתיב מלא** | `C:\Users\SADAB\Desktop\ATAPIS-backups\hackathon-before-phaseA1-1-20260805-204202.zip` |
| **גודל** | 97.21 MB · 653 entries |
| **הוחרגו** | `node_modules`, `dist`, `venv`, `.venv`, `__pycache__`, `.vite`, `cache`, `.cache`, `logs`, `run-logs`, `outputs` |
| **אומת** | 0 מופעים של node_modules / dist / venv בארכיון; 163 קבצי `industrial-ops` נמצאים בו |

**ארבעת הגיבויים הקודמים לא נדרסו** — `hackathon-src-backup-20260729`, `hackathon-before-patch01-20260803`, `hackathon-before-phaseA0-20260804`, `hackathon-before-phaseA1-20260805` כולם במקומם.

---

## 3. רשימת הקבצים ששונו

**קובץ מקור אחד. זהו.**

| קובץ | שינוי |
|---|---|
| `src/concepts/industrial-ops/industrial.css` | 4 שינויי גובה/מרווח + 3 משתנים מקומיים + הערות |

**קבצי כלי חדשים** (אינם חלק מהמוצר):

| קובץ | תפקיד |
|---|---|
| `scripts/phase-a1-1-measure.mjs` | מדידת Before/After — 12 קונפיגורציות |
| `scripts/phase-a1-1-height-verify.mjs` | 53 בדיקות A1.1 |
| `scripts/phase-a1-1-screenshots.mjs` | 21 צילומי QA + manifest |
| `artifacts/industrial-ops-phase-a1-1/industrial.a1-baseline.css.txt` | עותק ה־CSS מלפני ה־Patch, שנשלף מהגיבוי — משמש בסיס להשוואה בבדיקות |

**אף קובץ JSX לא שונה.** אף קובץ משותף לא שונה. אף קונספט אחר לא שונה.

---

## 4. אישור שלא נוספו יכולות חדשות

לא נוסף אף רכיב, prop, state, hook, event handler, endpoint או התנהגות. השינוי כולו הוא ערכי `max-height`, `padding` ו־`gap` בגיליון סגנון אחד. כל מה שהמסך עושה — הוא עשה גם אתמול.

---

## 5. מדידות Before / After — 1920×1080

מצב הדמו (‏12 התראות ב־fixture, חיווי DANGER חדשה מוצג). כל המספרים בפיקסלים.

| קונפיגורציה | גובה מסמך | גלילת עמוד | התראות גלויות | גובה רשימת התראות | גובה Visual Feed | תחילת הפאנלים התחתונים | Areas ללא גלילה |
|---|---|---|---|---|---|---|---|
| **he · compact** (ברירת מחדל) | 1672 → **1494** | 592 → **414** | 9 → **6** | 512 → **368** | 401 → **401** | 999 → **839** | ✔ → ✔ |
| en · compact | 1743 → **1565** | 663 → **485** | 7 → **5** | 512 → **368** | 401 → **401** | 1052 → **892** | ✔ → ✔ |
| he · comfort | 1700 → **1624** | 620 → **544** | 7 → **6** | 460 → **420** | 401 → **401** | 965 → **911** | ✔ → ✔ |
| en · comfort | 1771 → **1695** | 691 → **615** | 5 → **5** | 460 → **420** | 401 → **401** | 1018 → **964** | ✔ → ✔ |
| he · live · compact | 1208 → **1154** | 128 → **74** | 1 → 1 | 53 → 53 | 175 → 151 * | 524 → **489** | ✔ → ✔ |
| he · live · comfort | 1274 → **1218** | 194 → **138** | 1 → 1 | 59 → 59 | 175 → 151 * | 542 → **509** | ✔ → ✔ |

\* ב־Live אין מצלמה מחוברת, ולכן המספר הזה הוא גובה **מסך ה־CAMERA UNAVAILABLE**, לא גובה וידאו. הוא ירד ב־24px בגלל ה־padding המהודק, והצילום מוכיח שהוא נשאר קריא במלואו (כותרת, טבלת CAMERA/SOURCE/STATE/LAST RX, טקסט השגיאה האמיתי, OPEN RADAR, נסה שוב, וההערה שהרדאר אינו נפתח אוטומטית).

---

## 6. מדידות Before / After — 1366×768

| קונפיגורציה | גובה מסמך | גלילת עמוד | התראות גלויות | גובה רשימת התראות | גובה Visual Feed | תחילת הפאנלים התחתונים | Areas ללא גלילה |
|---|---|---|---|---|---|---|---|
| **he · compact** (ברירת מחדל) | 2011 → **1869** | 1243 → **1101** | 7 → **5** | 400 → **310** | 321 → **321** | 1179 → **1065** | ✘ → ✘ |
| en · compact | 2119 → **1977** | 1351 → **1209** | 5 → **4** | 400 → **310** | 321 → **321** | 1287 → **1173** | ✘ → ✘ |
| he · comfort | 2163 → **1989** | 1395 → **1221** | 7 → **5** | 460 → **344** | 321 → **321** | 1271 → **1131** | ✘ → ✘ |
| en · comfort | 2278 → **2104** | 1510 → **1336** | 5 → **4** | 460 → **344** | 321 → **321** | 1379 → **1239** | ✘ → ✘ |
| he · live · compact | 1548 → **1496** | 780 → **728** | 1 → 1 | 53 → 53 | 191 → 151 * | 710 → **686** | ✔ → ✔ |
| he · live · comfort | 1652 → **1594** | 884 → **826** | 1 → 1 | 59 → 59 | 191 → 151 * | 754 → **730** | ✔ → ✔ |

‏`Areas ללא גלילה` הוא ✘ ב־Demo גם לפני וגם אחרי — ב־1366 הפריסה היא שתי עמודות ו־Areas יושב **מתחת** ל־Alerts לפי ה־Grid שאושר ב־A1. ההנחיה (§6) מאפשרת זאת במפורש: "Areas יכול להופיע מיד לאחריהם".

---

## 7. מספר ההתראות הגלויות — לפני ואחרי

היעד החדש: **5–6 ב־1920**, **4–5 ב־1366** (מחליף את 8–12 / 6–8 של A1).

| רזולוציה | שפה · density | לפני | אחרי | ביעד |
|---|---|---|---|---|
| 1920×1080 | he · compact | 9 | **6** | ✔ |
| 1920×1080 | he · comfort | 7 | **6** | ✔ |
| 1920×1080 | en · compact | 7 | **5** | ✔ |
| 1920×1080 | en · comfort | 5 | **5** | ✔ |
| 1366×768 | he · compact | 7 | **5** | ✔ |
| 1366×768 | he · comfort | 7 | **5** | ✔ |
| 1366×768 | en · compact | 5 | **4** | ✔ |
| 1366×768 | en · comfort | 5 | **4** | ✔ |

**כל שמונה הקונפיגורציות ביעד.**

הבדל השפות אינו באג: הודעה באנגלית ארוכה יותר ונשברת לשתי שורות, ולכן שורת התראה באנגלית היא 78–103px מול 53–78px בעברית. גובה קבוע בפיקסלים מניב לכן מספר שורות שונה. הגבהים כוילו כך שהקצה התחתון (אנגלית) עדיין נופל בתוך היעד, ולא רק הקצה הנוח (עברית).

---

## 8. גובה רשימת ההתראות — לפני ואחרי

| breakpoint | density | לפני | אחרי |
|---|---|---|---|
| בסיס (≥1501px) | compact | 512px | **368px** |
| בסיס (≥1501px) | comfort | 460px | **420px** |
| ‏≤1500px | compact | 396px | **310px** |
| ‏≤1500px | comfort | 460px (יורש) | **344px** (חדש, ייעודי) |
| ‏≤820px גובה | compact | 400px | **310px** |
| ‏≤820px גובה | comfort | 460px (יורש) | **344px** (חדש, ייעודי) |

**גלילה פנימית אחת בלבד** — לא פוצלה, לא הוקננה. יתר ההתראות זמינות בה.

---

## 9. גובה Visual Feed — לפני ואחרי

| מצב | לפני | אחרי |
|---|---|---|
| 1920 · demo (feed מרונדר) | 401px | **401px — ללא שינוי** |
| 1366 · demo (feed מרונדר) | 321px | **321px — ללא שינוי** |
| 1920/1366 · live (מסך CAMERA UNAVAILABLE) | 175 / 191px | 151px |

**גובה ה־feed עצמו לא הוקטן כלל.** התקרה ‏(`380px` בבסיס, `300px` ב־≤1500) לא נגעה. ההקטנה היחידה היא במסך ההיעדר, כתוצאה עקיפה של ה־padding — והוא נשאר מלא וקריא. בדיקות 14 מאמתות רצפת גובה של 320px ב־1920 ו־260px ב־1366.

---

## 10. גלילת העמוד — לפני ואחרי

| רזולוציה · מצב | לפני | אחרי | שינוי |
|---|---|---|---|
| **1920 · he compact · demo** | 592px | **414px** | **−178px · −30%** |
| 1920 · en compact · demo | 663px | **485px** | −178px · −27% |
| 1920 · he comfort · demo | 620px | **544px** | −76px · −12% |
| **1920 · he compact · live** | 128px | **74px** | **−54px · −42%** |
| **1366 · he compact · demo** | 1243px | **1101px** | **−142px · −11%** |
| 1366 · he comfort · demo | 1395px | **1221px** | −174px · −12% |
| 1366 · en comfort · demo | 1510px | **1336px** | −174px · −12% |
| **1366 · he compact · live** | 780px | **728px** | −52px · −7% |

### מה הושג מול היעד, בכנות

**ב־1920 היעד התפעולי הושג במלואו.** §5 דורש שהמפעיל יראה יחד, ללא גלילה: פס הסטטוס, System Decision, Source Evidence, חיווי DANGER, Operational Alerts, Visual Feed ו־Areas. **כל השבעה נמצאים מעל הקיפול** — הפאנלים התחתונים מתחילים ב־839px מתוך 1080 (בדיקה 13 מאמתת). במצב Live, שהוא המצב האמיתי של המערכת, הגלילה היא **74px** — כלומר המסך כמעט נכנס בשלמותו.

**יעד ה־200–300px ב־1920 לא הושג במלואו במצב Demo: התוצאה היא 414px.** להלן החשבון המדויק, כדי שההחלטה תהיה שלך ולא שלי:

```
פריסה קבועה שלא ניתן לצמצם בלי לפגוע בעקרונות :  432px
  שוליים חיצוניים של שכבת הקונספטים (קובץ משותף)    74
  padding עליון + שמירת מקום לפס התחתון             66
  פס הסטטוס בן 12 התאים                             55
  חיווי DANGER חדשה (קיים רק כשיש כזו)              40
  System Decision + Source Evidence                193
  מרווחי Grid                                        4

שכבה עליונה  (Areas | Visual Feed | Operational Alerts) :  486px
  ← הרצפה כאן היא ה-FEED, לא רשימת ההתראות.
    תוכן ה-feed דורש 486px, ולכן הקטנת הרשימה מתחת
    ל-320px לא מורידה אף פיקסל מגובה השכבה.

שני פאנלי השורות התחתונות (מונע ע"י Risk Factors ו-System Health) :  ~530px
  ← תוכן אמיתי. צמצום מכאן = הסרת מידע.
------------------------------------------------------------
                                              סה"כ  ~1448px
                                        חלון התצוגה  1080px
                                      גלילת עמוד      ~368-414px
```

הדרכים היחידות שנותרו לרדת ל־300 הן: להקטין את ה־Visual Feed מתחת לגודל שימושי, להסיר את חיווי ה־DANGER, או לגרוע פאנל תחתון. **שלושתן אסורות במפורש** (§8, §11, §13). לכן נעצרתי כאן ומדווח את המספר, כפי ש־§5 מורה.

**ב־1366×768 הצמצום הוא 11%–12% בלבד, וזה פחות ממה שהמילה "משמעותי" ב־§23.4 מבקשת.** הסיבה: בפריסת שתי העמודות של 1366 יש **חמש** שורות Grid במקום ארבע, ותשעת הפאנלים מכילים יחד ~1870px של תוכן אמיתי בחלון של 768px. רשימת ההתראות היא רק 310px מתוכם. שיטת ה־Patch שההנחיה עצמה הגדירה — "הקטנת גובה רשימת ההתראות והידוק מרווחים **בלבד**" (§2) — מיצתה את עצמה כאן. כל צעד נוסף דורש שינוי פריסה, שהוא מחוץ לתחום ה־Patch הזה.

**הדרישה התפעולית של §6 ב־1366 כן מתקיימת:** פס הסטטוס, חיווי DANGER, System Decision, Operational Alerts ו־Visual Feed כולם נראים בקיפול או בסביבתו (ראה `shots/1366-he-demo-compact.png`), ו־Areas מיד אחריהם.

---

## 11. מדוע הפתרון אינו פוגע בקריאות

- **הטקסט לא נגע.** ‏105 הצהרות `font-size` ו־3 הצהרות `line-height` זהות בייט־לבייט לקובץ שלפני ה־Patch (בדיקות 01–03).
- **שורת ההתראה לא נדחסה.** מבנה שלוש השורות נשמר במלואו; מה שהשתנה הוא **כמה שורות נראות בבת אחת**, לא כמה מידע יש בכל שורה. זו בדיוק ההנחיה של §10: "המטרה היא להציג פחות התראות בו־זמנית, לא לדחוס כל התראה".
- **ה־padding שהוקטן הוא אנכי בלבד.** ‏`12px 12px` הפך ל־`9px 12px`. הרוחב הפנימי לא זז, ולכן אף מילה לא שינתה נקודת שבירה ואף עמודה לא הצטמצמה.
- **9px ו־8px אינם צפופים.** הם עדיין גדולים מגובה שורת הטקסט הקטן ביותר במסך, ושומרים על הפרדה ויזואלית ברורה בין כותרת הפאנל לתוכן.
- **אין ellipsis חדש, אין חיתוך.** בדיקה 24 מאמתת שאף שורת התראה אינה נחתכת על ידי הפריסה ההדוקה.

---

## 12. הוכחה שלא הוקטן font-size

עותק מדויק של `industrial.css` מלפני ה־Patch נשלף מקובץ הגיבוי ונשמר כ־`artifacts/industrial-ops-phase-a1-1/industrial.a1-baseline.css.txt`. הבדיקות משוות מולו:

```
PASS  01 - every font-size declaration is unchanged from the pre-A1.1 file  -- 105 declarations, identical
PASS  02 - no font-size was reduced
PASS  03 - no line-height was changed  -- 3 before / 3 after
```

זו השוואה למקור ולא הצהרה: אילו הייתי מקטין ולו הצהרה אחת, בדיקה 01 הייתה נכשלת. בנוסף, בדיקות A1 המקוריות 45/45b/45c ממשיכות לעבור — עוגני הטיפוגרפיה המאושרים (15px כותרות, 11px subcaption, 13px טקסט ראיות/גורמים/פס) במקומם, ורצפת ה־8.5px של המסך לא נפרצה.

---

## 13. הוכחה שאין scale או zoom

```
PASS  04 - no scale, no zoom, no font-size reset
```

הבדיקה סורקת את הגיליון כולו אחר `transform: scale`, `zoom:` ו־`font-size: inherit|0|unset|initial`. אפס מופעים. בדיקת A1 המקורית 46 בודקת את אותו הדבר וממשיכה לעבור.

---

## 14. הוכחה שלא הוסר מידע מהתראות

```
PASS  23 - the alert row still carries severity, area, message, source, time, lifecycle, SESSION-LOCAL
          {"severity":true,"area":true,"message":true,"source":true,"time":true,
           "lifecycle":true,"sessionLocal":true,"clipped":false}
PASS  24 - no alert row is clipped by the tighter layout
PASS  25 - still no camera id claimed as an alert source
PASS  26 - still no pair/association vocabulary on the page
```

וכן, מבדיקות A1 שממשיכות לעבור: כל שורה שמציגה lifecycle מציגה גם `SESSION-LOCAL` (בדיקה 49), מקור מצלמה לא ידוע מוצג במפורש כ"מקור המצלמה אינו מזוהה" (בדיקה 32), ואף שורה לא טוענת `CAM-01`/`CAM-02` כמקור התראה (בדיקה 07).

---

## 15. הוכחה שאין nested scroll

```
PASS  15 - nothing inside the alert list scrolls on its own  -- 0 nested
PASS  16 - the alert list is genuinely scrollable
PASS  17 - the alert list does not trap the wheel (overscroll chains to the page)  -- auto
PASS  18 - the alert list is the top band's single scroll region
PASS  19 - with the list scrolled to its end the wheel scrolls the page  -- pageY 400
```

בדיקה 19 היא בדיקת התנהגות ולא בדיקת CSS: הרשימה נגללת עד סופה, הגלגלת מופעלת מעליה, ונמדד שהעמוד עצמו זז. אין scroll trapping.

**גילוי מלא:** ב־≤1500px קיימת גלילה פנימית שנייה — `.io2-area-list` — אך היא **קיימת מ־A1 ולא נוצרה כאן**, היא באזור אחר במסך (‏Areas), ואינה מקוננת בתוך רשימת ההתראות. §8 מתיר גלילה פנימית ב־Areas כשאין חלופה; במסך של 768px גובה אין.

---

## 16. הוכחה שאין horizontal overflow

נמדד בשמונה viewports:

```
PASS  35 - no horizontal overflow @1920x1080  -- 0px
PASS  35 - no horizontal overflow @1600x900   -- 0px
PASS  35 - no horizontal overflow @1440x900   -- 0px
PASS  35 - no horizontal overflow @1366x768   -- 0px
PASS  35 - no horizontal overflow @1280x720   -- 0px
PASS  35 - no horizontal overflow @1024x768   -- 0px
PASS  35 - no horizontal overflow @768x1024   -- 0px
PASS  35 - no horizontal overflow @390x844    -- 0px
PASS  36 - worst-case horizontal overflow across every viewport  -- 0px
```

בנוסף, `phase-h-qa.mjs` בודק `no h-overflow concepts/industrial/dashboard` בשמונה viewports באופן עצמאי — ועובר.

---

## 17. הוכחה שה־Grid נשאר חוקי

```
PASS  07 - every grid row still declares the same column count
PASS  08 - every grid area is still a contiguous rectangle
PASS  09 - the panel layout itself is unchanged (no area was moved or reordered)
```

בדיקה 09 היא החזקה מבין השלוש: היא משווה את **כל** בלוקי ה־`grid-template-areas` מול הקובץ שלפני ה־Patch ודורשת זהות מוחלטת. כלומר — לא רק שה־Grid חוקי, אלא שהוא **לא זז בכלל**. שלוש הפריסות (‏12 עמודות בדסקטופ, שתי עמודות ב־≤1500px, עמודה אחת ב־≤1200px) זהות לחלוטין למה שאושר ב־A1. בדיקות A1 המקוריות 42/43 בודקות אותו דבר וממשיכות לעבור.

---

## 18. תוצאות כל הבדיקות

| Gate | Baseline (לפני A1.1) | אחרי A1.1 | מצב |
|---|---|---|---|
| `npm run build` | ירוק | **ירוק** | ✔ |
| lint scoped (`src/concepts` + `src/design-lab`) | 4 שגיאות, 0 אזהרות | **4 שגיאות, 0 אזהרות** | ✔ ללא הרעה |
| `phase-h-qa.mjs` | 92/93 | **92/93** | ✔ (אותו כשל fetch ותיק ב־`/design-lab`) |
| `phase-prime-verify.mjs` | 30/30 | **30/30** | ✔ |
| `phase-prime-noregress.mjs` | ללא רגרסיות | **ללא רגרסיות** | ✔ |
| `phase-a0-alerts-verify.mjs` | 64/64 | **64/64** | ✔ |
| `phase-a1-command-center-verify.mjs` | 87/87 | **87/87** | ✔ |
| `phase-a1-1-height-verify.mjs` | — | **53/53** | ✔ חדש |

**לא נמחקה ולא הוחלשה אף בדיקה.** בדיקות A0 ו־A1 רצו כמות שהן, ללא שינוי, ועברו במלואן.

15 הדרישות של §24 מכוסות: מספר התראות ב־1920 (בדיקה 10 ×4), ב־1366 (בדיקה 10 ×4), ‏max-height (11), אין שינוי font-size (01–03), אין scale (04), אין zoom (04), אין horizontal overflow (35–36), אין scroll trapping (17, 19), אין nested scroll (15, 18), חיווי DANGER ללא גובה כשמוסתר (20), ‏Areas בשכבה העליונה (13), ‏Visual Feed בגודל שימושי (14), תוכן ההתראה שלם (23–26), ‏87 בדיקות A1, ‏64 בדיקות A0.

---

## 19. נתיבי צילומי המסך

`hackathon/artifacts/industrial-ops-phase-a1-1/shots/` — 21 צילומים + `manifest.json` עם המטא־דאטה של כל אחד.

### 1920×1080

| קובץ | density | מצב | גלילה | התראות גלויות |
|---|---|---|---|---|
| `1920-he-live-compact.png` | compact | live | 98px | 1 |
| `1920-en-live-compact.png` | compact | live | 97px | 1 |
| `1920-he-demo-compact.png` | compact | demo | 414px | 6 |
| `1920-en-demo-compact.png` | compact | demo | 485px | 5 |
| `1920-he-demo-danger.png` | compact | demo | 450px | 6 |
| `1920-he-demo-many-alerts.png` | compact | demo | 414px | 6 |
| `1920-he-demo-areas-alerts-feed-together.png` | compact | demo | 414px | 6 |
| `1920-he-demo-comfort.png` | comfort | demo | 544px | 6 |
| `1920-he-demo-new-danger-notice.png` | compact | demo | 398px | 6 |
| `1920-he-live-camera-unavailable.png` | compact | live | 98px | 1 |
| `1920-he-live-radar-tab.png` | compact | live | 445px | 1 |

### 1366×768

| קובץ | density | מצב | גלילה | התראות גלויות |
|---|---|---|---|---|
| `1366-he-live-compact.png` | compact | live | 728px | 1 |
| `1366-en-live-compact.png` | compact | live | 727px | 1 |
| `1366-he-demo-compact.png` | compact | demo | 1101px | 5 |
| `1366-en-demo-compact.png` | compact | demo | 1209px | 4 |
| `1366-he-demo-danger.png` | compact | demo | 1104px | 5 |
| `1366-he-demo-many-alerts.png` | compact | demo | 1101px | 5 |
| `1366-he-demo-comfort.png` | comfort | demo | 1221px | 5 |
| `1366-he-demo-new-danger-notice.png` | compact | demo | 1093px | 5 |
| `1366-he-live-camera-unavailable.png` | compact | live | 728px | 1 |
| `1366-he-live-radar-tab.png` | compact | live | 823px | 1 |

**לא זויפה חומרה חיה.** אין מצלמה ואין רדאר מחוברים למחשב הזה, ולכן צילומי ה־Live מציגים `CAMERA UNAVAILABLE` ו־`RADAR DISCONNECTED` — כי זה מה שהמערכת מדווחת. תרחישי DANGER מצולמים רק ב־Demo, ותגי הדמו נראים בהם.

קבצי המדידה: `measure-before-full.json` (הרצה על ה־CSS מלפני ה־Patch), `measure-after.json`, ‏`measure-before.json` (מטריצה מוקדמת וצרה יותר).

---

## 20. בעיות שנותרו

1. **‏1366×768 ירד ב־11% בלבד** (1243→1101). זו המגבלה של שיטת ה־Patch שההנחיה הגדירה, כמפורט בסעיף 10. אם חשוב להוריד עוד — נדרש שינוי פריסה ב־≤1500px, שהוא **חורג מ־A1.1** וטעון החלטה נפרדת שלך.

2. **‏1920 comfort ירד ב־12% בלבד** (620→544). הסיבה זהה: ב־comfort שורת התראה גבוהה יותר, ולכן אותן 5–6 שורות דורשות 420px במקום 368px. אפשר להוריד ל־5 שורות בעברית (‏−60px) — אך אז אנגלית יורדת ל־4 ויוצאת מהיעד. בחרתי לכבד את היעד.

3. **פאנל Areas (וב־1366 גם Visual Feed) מכיל מרווח ריק בתחתיתו.** גובה שורת Grid נקבע לפי הפאנל הגבוה בה, ו־Areas נמוך מ־Alerts. זה קיים מ־A1 ולא נוצר כאן; ב־1366 ה־Patch דווקא **צמצם** את החלל בפאנל ה־Feed מ־402px ל־313px.

4. **לשונית RADAR ב־Live ב־1920 מגדילה את הגלילה ל־445px** (מפת הרדאר גבוהה מהפריים: `max-height: 38vh`). התנהגות קיימת מ־A1; לא נגעתי בה כי §4.3 אוסר לשנות את לשונית ה־Radar.

5. **כשל ותיק אחד ב־`phase-h-qa.mjs`** — לוג fetch-abort ב־`/design-lab`. קיים מלפני A0, לא קשור ל־A1.1.

---

## 21. השפעה צפויה על Phase A2

**זו הנקודה החשובה ביותר להמשך, ולכן במספרים:**

- **תקציב הגובה של השכבה העליונה ב־1920 מוצה כמעט לחלוטין.** השכבה עומדת על 486px, והרצפה שלה היא ה־Visual Feed (‏486px). כלומר: **כל פיקסל שיתווסף לשורת ההתראה יתורגם ישירות לגלילת עמוד** ברגע שרשימת ההתראות תעבור את 486px.
- **A2 מוסיף כפתורי פעולה לשורה הנבחרת** (‏Acknowledge / Start Review / Resolve / Reopen). שורת פעולה מוסיפה בערך 28–34px לשורה **הנבחרת בלבד**. בגובה הנוכחי (368px) זה יוריד את מספר השורות הגלויות מ־6 ל־5 בעברית ומ־5 ל־4 באנגלית — כלומר **אנגלית תצא מהיעד של 5–6**.
- **המלצתי ל־A2:** להציג את כפתורי הפעולה **מחוץ לרשימה** — בשורה קבועה מתחת לרשימה או בסמוך ל־Decision Block — ולא בתוך שורת ההתראה. כך גובה השורה נשאר קבוע, מספר השורות הגלויות נשמר, וגם לא נוצר "ריצוד" שבו בחירת שורה מזיזה את כל מה שמתחתיה. זו החלטה שכדאי לקבל **לפני** שכותבים את A2, לא אחריה.
- **‏Resolve Dialog / Context Menu / Reopen Confirmation** הם overlay ואינם משפיעים על גובה העמוד.
- שלושת משתני ה־CSS שהוספתי (`--io2-panel-pad-y`, `--io2-panel-gap`, `--io2-band-pad-y`) נותנים ל־A2 נקודת כוונון אחת אם יידרש איזון מחדש.
- `scripts/phase-a1-1-measure.mjs` נשאר בריפו: אפשר להריץ אותו אחרי A2 ולקבל את אותה טבלת Before/After בדיוק.

---

## 22. אישור מפורש: לא התחלתי את Phase A2

**לא התחלתי את Phase A2 ולא מימשתי דבר מרשימת §20.**

לא נוספו: ‏Acknowledge, ‏Start Review, ‏Resolve, ‏Reopen, כפתורי פעולה, ‏Resolve dialog, אישור Reopen, תפריט הקשר, ‏Shift+F10, ‏Open in OPT, דאבל־קליק, ‏Enter ל־OPT, קול, ‏WebAudio, ‏Global Mute, תזכורת, הרשאות, תפקידי operator/supervisor, ‏persistence בשרת, ‏Alert API, ‏Areas API, ‏Full History, או התראות בקר.

**עצרתי.**

---

## 23. אישור מפורש: מה לא שונה

לא שונו, בשום צורה:

| | |
|---|---|
| **Backend** | `python/**` כולו — `server.py`, `analysis.py`, `ld2450_reader.py`, `radar_simulator.py` |
| **API ו־routes** | אף endpoint, אף contract, אף route ב־`ConceptsApp.jsx` |
| **‏A0 logic** | `alerts.js`, `areas.js`, `alertStorage.js`, `alertSelectors.js`, `demoAlerts.js`, `useAlertSelection.js` — לא נפתחו לעריכה. לא נמצא בהם באג במהלך העבודה |
| **‏Lifecycle** | ‏NEW / ACKNOWLEDGED / IN REVIEW / RESOLVED — ללא נגיעה |
| **‏Risk Logic ו־thresholds** | ‏40 / 75 ללא שינוי; אין חישוב סיכון ב־Frontend |
| **‏Credentials** | ‏`.env`, `radar_config.json`, פרטי Dahua, ‏COM, ‏Baud — לא נפתחו, לא הועתקו, לא הודפסו לדוח או ללוג |
| **‏OPT** | `useMonitoringViewModel.js`, `IndustrialCamera.jsx` — ללא שינוי |
| **קבצים משותפים** | `useDashboardViewModel.js`, `CameraFeed.jsx`, `TargetsTable.jsx`, `TracksTable.jsx`, `OpenAlerts.jsx`, `concepts-base.css`, `ConceptSwitcher.jsx`, `AuthContext` |
| **‏`IndustrialShell.jsx`** | ללא שינוי |
| **קונספטים אחרים** | ‏Fusion Prime, ‏Minimal Command, ‏Sentinel 3D, ‏Neural Fusion, ‏design-lab prototypes — ללא שינוי (מאומת ע"י `phase-prime-verify` 30/30 ו־`phase-prime-noregress`) |
| **‏Demo fixture** | ‏12 ההתראות, ‏`isDemo`, הפרדת Demo/Live — ללא שינוי |
| **‏sessionStorage** | סכימה, גרסה, ‏selection, filters — ללא שינוי |
| **מודלים / YOLO / סקריפטי הרצה** | ללא נגיעה |

**סה"כ: קובץ מקור אחד שונה בפרויקט כולו — `industrial.css`.**
