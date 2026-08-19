# Phase A3.1 — OPS Cleanup, Readability Redesign & System Health Relocation · דוח סיום

**תאריך:** 2026-08-10 · **Scope:** `src/concepts/industrial-ops/` + `scripts/` בלבד · **מקור:** `d:\פרומטים\A3.1.txt` (94 סעיפים)

---

## 1. סיכום A3.1

מסך OPS ירד מתשעה פאנלים לשישה. שלוש הטבלאות שהתחרו על תשומת הלב — ‏`CAMERA TRACKS`, ‏`RADAR TARGETS`, ‏`SYSTEM HEALTH` — כבר לא מוצגות שם; ‏System Health עבר ל־Configuration כלשונית רביעית, ושתי הטבלאות האחרות פשוט הפסיקו להיות טבלאות על המסך הזה. **אף פיסת נתונים לא נמחקה:** ה־tracks וה־targets ממשיכים להזין את מנוע ההתראות, את מפת הרדאר, את ה־Source Evidence ואת ה־Risk Factors — הוכח בבדיקות, לא הובטח.

השטח שהתפנה חולק מחדש ב־grid חדש של 12 עמודות, והטיפוגרפיה עברה מעבר מבוקר של הגדלות בלבד. ‏**אף `font-size` בקונספט לא הוקטן** — נאכף פר־סלקטור מול קובץ ה־CSS שקדם ל־A1.1.

---

## 2. גיבוי

```
C:\Users\SADAB\Desktop\ATAPIS-backups\hackathon-before-phaseA3-1-20260810-212838.zip
106.74 MB · 757 entries · 200 קבצי src
```

**Exclusions:** ‏`node_modules`, ‏`dist`, ‏`venv`, ‏`.venv`, ‏`__pycache__`, ‏`.vite`, ‏`cache`, ‏`.cache`, ‏`logs`, ‏`run-logs`, ‏`outputs`, ‏`*.pyc` — אומת בתוך ה־zip: ‏0 רשומות `node_modules`, ‏0 רשומות `logs/`.
**כל שבעת הגיבויים הקודמים נשמרו** (‏8 בסך הכול בתיקייה).

## 3. קבצים חדשים

| קובץ | תפקיד |
|---|---|
| `src/concepts/industrial-ops/components/SystemHealthPanel.jsx` | ‏System Health ב־Configuration — עוטף את אותו `SensorHealth` |
| `scripts/phase-a3-1-ops-cleanup-verify.mjs` | סוויטת A3.1 — 159 בדיקות |
| `scripts/phase-a3-1-measure.mjs` | מדידת 13 מדדים × 8 קונפיגורציות |
| `scripts/phase-a3-1-screenshots.mjs` | 35 צילומי QA |

## 4. קבצים ששונו

| קובץ | השינוי |
|---|---|
| `views/IndustrialDashboard.jsx` | הוסרו 3 סקציות + 3 imports שהתייתרו. אפס שינוי אחר. |
| `views/IndustrialSettings.jsx` | לשונית `health` בסוף רשימת ה־Tabs + מסלול full-width לתוכן שלה |
| `industrial.css` | grid חדש ×3 breakpoints · תקרות feed/alerts/areas/log · ‏~30 הגדלות טיפוגרפיה · סגנונות ה־System Health tab |
| `scripts/phase-a1-command-center-verify.mjs` | ‏45 ו־39b עודכנו (חיזוק — ראה §64) |
| `scripts/phase-a1-1-height-verify.mjs` | ‏01/02/05/06/09/10/11 עודכנו (חיזוק) |
| `scripts/phase-a2-operational-workflow-verify.mjs` | ‏C34 ו־C88 עודכנו (חיזוק) |

**לא נגעתי:** ‏`IndustrialShell.jsx`, ‏`alerts.js`, ‏`alertSelectors.js`, ‏`alertStorage.js`, ‏`useAlertSelection.js`, ‏`useIndustrialOpsCommandCenter.js`, ‏`operatorLog.js`, ‏`audioCuePlanner.js`, ‏`operationalSoundEngine.js`, ‏`useOperationalAudio.js`, ‏`reasons.js`, ‏`OpsTargetsTable.jsx`, ‏`OpsTracksTable.jsx`, כל הרכיבים המשותפים, ‏`python/**`, ‏`.env`, וכל קונספט אחר.

## 5. CAMERA TRACKS — הסרה

הוסרה הסקציה כולה מ־`IndustrialDashboard.jsx`, יחד עם ה־import של `OpsTracksTable` ועם `.io2-a-tracks` מה־CSS ומכל `grid-template-areas`. אין כותרת, אין טבלה, אין scrollbar, אין placeholder ואין משבצת grid שמורה (A01, ‏A05–A07, ‏C02, ‏C06). ‏**הרכיב עצמו נשמר** ולא שונה (§52 — העדפת שינוי מינימלי).

## 6. RADAR TARGETS — הסרה

זהה: סקציה, import, ‏`.io2-a-targets`, ושם ה־area — כולם ירדו (A02, ‏C01). לשונית `RADAR` בתוך Visual Feed נשארה, ‏Radar Plot נשאר ומרונדר ב־679×497 (C14–C15), ‏`CLOSING` ולוגיקת הרדאר ללא שינוי.

## 7. SYSTEM HEALTH — הסרה מ־OPS

הוסרה הסקציה ו־import של `SensorHealth` (A03–A04, ‏C03). עברה ל־Configuration — §29 להלן.

## 8. הוכחה שהנתונים נשארו

לא הסתפקתי בהצהרה:

| מה | הוכחה |
|---|---|
| ‏Camera tracks | ‏`Source Evidence` מציג `#7 · approaching · 150 px/s · נשק NEG · סיכון מצלמה 47` (C11); מזהי מסלול על ההתראות (C13) |
| ‏Radar targets | ‏Radar Plot מרונדר (C14), בגודל שמיש (C15), עם 0 פידים של מצלמה (C16) |
| מנוע ההתראות | עדיין גוזר מועמדים מ־tracks ו־targets ונושא `trackId`/`targetId` (B04–B05) |
| ‏Risk Factors | ‏3 גורמים מרונדרים בפועל (C09) |
| ‏System Decision | מרונדר (C12) |
| הרכיבים | ‏`OpsTargetsTable`/`OpsTracksTable` קיימים ולא שונו (B01–B03, ‏A1 39c) |
| ‏`buildIndustrialReasons` | לא נגעתי (B06) |

## 9-10. ה־Grid החדש של OPS — Desktop (≥1501px)

```
'areas areas areas feed feed feed feed feed alerts alerts alerts alerts'
'factors factors factors factors factors factors timeline timeline timeline timeline timeline timeline'
'log log log log log log log log log log log log'
```

בדיוק כפי ש־§21 מגדיר: ‏Areas 3/12 · Visual Feed 5/12 · Operational Alerts 4/12 · Risk Factors 6/12 · Risk/Time 6/12 · Session Log 12/12. נאכף בבדיקות A15–A18, וחוקיות ה־grid (מלבנים, שורות שוות, אפס תאים ריקים) ב־A12–A14.

## 11. Grid ב־1366 (≤1500px)

```
'alerts alerts alerts alerts alerts alerts feed feed feed feed feed feed'
'areas areas areas areas areas areas factors factors factors factors factors factors'
'timeline ×12'
'log ×12'
```

זהו redesign ולא כיווץ: ‏Alerts ו־Feed ראשונים, ‏Areas ו־Risk Factors חולקים את הבנד השני, ואז Risk/Time ו־Log ברוחב מלא (A19–A21). ב־A3 ה־Feed נאלץ להשתרע על שתי שורות כדי לקבל גובה; עכשיו הוא לא צריך.

## 12. סדר ≤1200px

```
alerts · feed · areas · factors · timeline · log
```

עמודה אחת, כל הפאנלים ברוחב מלא (A22).

## 13. Visual Feed — לפני/אחרי

| | A3 | A3.1 |
|---|---|---|
| רוחב הפאנל (1920) | 844px | **703px** |
| גובה הפאנל (1920 he demo) | 536px | **578px** |
| גוף ה־Feed (1920) | 820×401 | **679×403** |
| גוף ה־Feed (1920 live) | 820×175 | **679×210** |
| תקרת המדיה | 380px | **520px** |
| ‏`.dm-radarplot` | 38vh | **46vh** |
| ‏Radar Plot בפועל | — | **679×497** |

**דיווח ביושר — כאן ההנחיה מתנגשת עם עצמה.** ‏§21 קובע במפורש ‏Feed = 5/12, ו־§25/§26 קובעים Areas = 3/12 ו־Alerts = 4/12. שלושת המספרים מסתכמים ל־12 בדיוק, ולכן אין דרגת חופש. ב־A3 ה־Feed קיבל 6/12 (844px). המשמעות: **ה־Feed צר יותר ב־141px מאשר ב־A3**, ומכיוון שהמדיה שומרת יחס תצוגה, הגובה השימושי נשאר ~403px ולא הגיע לשאיפת §23 (‏460–540px). כדי להגיע לשם ה־Feed היה צריך 6–7 עמודות — כלומר לקחת מ־Areas או מ־Alerts, בניגוד ל־§25/§26.

**מה כן השתפר:** תקרת המדיה הוכפלה כמעט (380→520), ‏Radar Plot גדל ל־46vh ומרונדר ב־497px גובה, מצב `CAMERA UNAVAILABLE` הוגדל (כותרת 15→17px, ‏padding 14→18px), ובמצב Live גוף ה־Feed גדל מ־175 ל־210px. **בחרתי לכבד את החלוקה המפורשת של §21 ולדווח את הפער, ולא לשנות אותה על דעת עצמי.**

## 14. Areas — לפני/אחרי

| | A3 | A3.1 |
|---|---|---|
| רוחב (1920) | 281px | **422px** (+50%) |
| גובה (1920 he demo) | 536px | **578px** |
| גובה (1366 he demo) | 219px | **284px** (+30%) |
| ‏Area name | 13px | **15px** |
| ‏Severity | 11px | **12px** |
| ‏Area ID / meta | 11px | **12px** |
| ‏Sensor chips | 10.5px | **11px**, padding 2→3px |
| ‏padding בשורה | 8×10px | **11×12px** |
| ‏`max-height` הרשימה | 300 / 200 (1366) | **300 / 260** |

## 15. Operational Alerts — לפני/אחרי

| | A3 | A3.1 |
|---|---|---|
| רוחב | 562px | 562px (4/12 בשני השלבים) |
| ‏Alert message (line 1) | 13px | **14px** |
| ‏Metadata (line 2) | 11px | **12px** |
| ‏Severity | 11px | **12px** |
| ‏SESSION-LOCAL | 10.5px | **11px** |
| ‏DEMO marker | 10.5px | **11px** |
| ‏padding בשורה | 7×9px | **10×11px** |
| ‏`max-height` | 368 / 400 comfort | **408 / 440** |

## 16. מספר ההתראות הגלויות

| | A3 | A3.1 | יעד A3.1 |
|---|---|---|---|
| 1920 he | 6 | **6** | 4–5 או יותר ✅ |
| 1920 en | 5 | **4** | 4–5 ✅ |
| 1366 he | 5 | **4** | 3–4 ✅ |
| 1366 en | 4 | **3** | 3–4 ✅ |

השורות גבוהות יותר, ולכן אותו חלון מציג פחות — במכוון (§28: קריאות לפני מספר שורות). היתר במרחק גלילה פנימית אחת, ונבדק שהיא עובדת (C28).

## 17. Alert row height

53px → **65px** (עברית), ‏78px → **94px** (אנגלית, שתי שורות). ‏**בחירה לא משנה גובה** — נמדד על אותה שורה לפני ואחרי בחירה, בארבע קונפיגורציות (C26), ואין אף `<button>` בתוך שורה (C27).

## 18-20. Typography

**~30 הגדלות, אפס הקטנות.** עיקרי השינוי:

| | A3 | A3.1 |
|---|---|---|
| `.io2-panel-title` | 15px | **16px** |
| `.io2-panel-note` | 11px | **11.5px** |
| `.io2-alert-line1` | 13px | **14px** |
| `.io2-alert-line2` | 11px | **12px** |
| `.io2-area-name` | 13px | **15px** |
| `.io2-rf-text` | 13px | **14px** |
| `.io2-rf-risk` | 13px | **15px** |
| `.io2-rf-sum dd` | 15px | **17px** |
| `.dm-health-row` | 13px | **14px** |
| ‏Session log message | 13px | **14px** |
| `.io2-strip-label` | 8.5px | **10px** |
| ‏Radar plot labels | 8.5–10px | **10–11px** |
| ‏Chart ticks | 10px | **11px** |

**מיקרו־טיפוגרפיה (§33):** ‏8.5px נעלם מ־OPS (הפס העליון ומפת הרדאר הועלו ל־10px). נותרו בקונספט **שתי** הצהרות מתחת ל־10px — ‏`.io2-rail-foot` (10px, קישוט "REV 2.6 /// PERIMETER" ברכיב צר) ו־`.io2-about-doc` (9.5px, בעמוד המפרט, מחוץ ל־OPS). נבדק ורשום (A28–A29).

**אכיפה:** ‏A1.1 בדיקה 01 משווה **פר־סלקטור** מול קובץ ה־CSS שקדם ל־A1.1 ונכשלת על כל הקטנה יחידה; ‏A3.1 בדיקה A23 עושה זאת מול תשעה עוגנים תפעוליים, ו־A24 דורשת שכולם באמת גדלו. אין `scale`, אין `zoom`, אין `font-size: reset` (A25–A27).

## 21. Risk Factors — לפני/אחרי

רוחב 421px → **844px** ב־1920 (מ־3/12 ל־6/12). ‏labels 13→14, ‏risk 13→15, ‏summary dd 15→17, ‏dt 10.5→11, ‏padding 6×8→8×10, ‏gap 3→4. **אף factor חדש לא נוסף** ו־`buildRiskReasons` לא שונה.

## 22. Risk / Time — לפני/אחרי

רוחב 422px → **844px** ב־1920, ‏567 → **1135** ב־1366 (רוחב מלא). ‏Chart ticks 10→11px, ‏reference labels 10→11px. אין metric חדש.

## 23. Session Log — לפני/אחרי

רוחב 1126px → **1689px** ב־1920 (‏8/12 → 12/12), ‏567 → **1135** ב־1366. ‏message 13→14px, ‏time 12→12.5px, ‏`max-height` ב־1366 עלה 220→240. ‏`ALL AREAS` / `SELECTED AREA` נשמרו. כללי ה־timestamp של ה־Controller לא נגעתי בהם.

## 24-25. גובה וגלילה — לפני/אחרי

| קונפיגורציה | scroll A3 → A3.1 | doc A3 → A3.1 |
|---|---|---|
| 1920 he demo | 459 → **484** (+25) | 1539 → 1564 |
| 1920 en demo | 530 → **537** (+7) | 1610 → 1617 |
| 1920 he live | 143 → **142** (−1) | 1223 → 1222 |
| 1920 en live | 142 → **141** (−1) | 1222 → 1221 |
| 1366 he demo | 1178 → **1148** (−30) | 1946 → 1916 |
| 1366 en demo | 1287 → **1293** (+6) | 2055 → 2061 |
| 1366 he live | 789 → **771** (−18) | 1557 → 1539 |
| 1366 en live | 788 → **787** (−1) | 1556 → 1555 |

חמש קונפיגורציות ירדו, שלוש עלו ב־6–25px. התוספת היא תוצאה ישירה של שורות התראה גבוהות ב־12–16px וחלון רשימה גדול ב־40px — כלומר בדיוק המסחר ש־§50 מאשר. **אפס horizontal overflow בכל שמונה** (C22, ‏C39).

**‏Top strip:** ‏55 → 58px (‏+3, מהעלאת התוויות ל־10px). **‏Decision band:** ‏189 → 189px, ללא שינוי.

## 26. Action Bar — regression

‏44px ב־1920 ו־60px ב־1366 — **ללא שינוי**, בתוך התקציב. הפעולות עדיין מוצעות ועובדות (C51–C53), ‏Context Menu נפתח (C54), הדיאלוגים עובדים (A2 245/245).

## 27. Sound Control — regression

נשאר בתוך אשכול `SYS MODE` (C55), הפס עדיין **12 ילדים** (C56), המצב אמיתי (C57), ופתיחת המסך המעוצב מחדש עדיין **שקטה** (C58). סוויטת A3 עברה 207/207 ללא שינוי.

## 28. Decision / Source Evidence — regression

הלוגיקה, הפרדת המקורות, ייחוס הסיכון וההקשר הנבחר — ללא נגיעה. הגובה זהה (189px). הקריאות שופרה רק דרך הטיפוגרפיה הכללית.

## 29. לשונית System Health החדשה

ב־Configuration, מציגה את אותו `SensorHealth` עם 6 שורות תת־מערכת (שרת / מצלמה / מודל נשק / רדאר / חיישן מרחק / בקר), בתוספת שורת **COVERAGE** שמפרידה בין "הקישור עונה" לבין "יש כיסוי בפריפריה", ושורת שגיאת רדאר מתקפלת. רוחב מלא, ללא horizontal overflow ב־4 הקונפיגורציות.

## 30. סדר ה־Tabs הסופי

```
RADAR · OPERATOR · GENERAL · SYSTEM HEALTH (בריאות מערכת)
```

שלוש הראשונות שמרו את מקומן בדיוק; החדשה נוספה בסוף (A38, ‏C34–C35). ‏tab bar אחד בלבד (A40), עם `role="tablist"`/`role="tab"`/`aria-selected` הקיימים (A39), ‏focusable ונפתחת ב־Enter (C43–C44).

## 31. System Health — Source of Truth

```
useDashboardViewModel()  →  useFreshness()  →  <SensorHealth>
```

**בדיוק אותה שרשרת שהאכילה את הפאנל ב־OPS.** אין מנוע בריאות שני: ‏A31–A33 מאמתות שהרכיב, ה־view model וה־freshness זהים; ‏A34 מאמתת שהפאנל לא גוזר מצב משלו; ‏A35 שהוא לא ממציא timestamp; ‏A44 שהוא לא פותח בקשה משלו.

## 32. הוכחה שאין duplicate polling

| מדידה | תוצאה |
|---|---|
| ‏Configuration פתוח, הלשונית סגורה, 3 שניות | ‏**0** קריאות `/status`, ‏0 רדאר (C45) |
| הלשונית פתוחה, 5 שניות | ‏**≤9** `/status` — לולאה אחת ב־1Hz + הקריאה המיידית, כפול StrictMode (C46) |
| ארבעת ה־endpoints | נעים יחד כמחזור אחד, פער ≤2 (C47) |
| יציאה מהלשונית | ‏**0** קריאות נוספות (C48) |
| שלושה מחזורי פתיחה/סגירה | ‏**0** דליפה (C49) |

הפאנל מותקן רק כשהלשונית פעילה, והדשבורד הוא route אחר שאינו מותקן במקביל — ולכן זו לולאה אחת בכל רגע נתון, לא שתיים.

## 33-34. Live / Demo

**‏Live:** במחשב הזה אין מצלמה ואין רדאר, וזה בדיוק מה שהלשונית מציגה — ‏`מצלמה DOWN`, ‏`רדאר DISCONNECTED`, ‏`חיישן מרחק UNAVAILABLE`, ‏`בקר NOT FOUND`, ‏`מודל נשק UNKNOWN`, וכיסוי `NO SENSOR COVERAGE`. אין `OK` שאין מאחוריו מידע (C41), ואין timestamp מומצא — שורה ללא זמן אמיתי מדפיסה `—` (C42).
**‏Demo:** סימוני DEMO/MOCK נשמרו במלואם; ‏`MOCK` נשאר אפור ולעולם לא ירוק.

## 35-38. Camera / Radar / Alerts / Risk

מצלמה: ‏one-feed-max, ‏ALL CAMERAS מאפס פידים (C32), ‏Camera unavailable כנה, ‏fallback עדיין display-only. רדאר: ‏Plot, ‏CLOSING ולוגיקה ללא שינוי. התראות: ‏lifecycle, ‏filters, ‏counts, ‏search, ‏selection, ‏outside-filter, ‏Action Bar, ‏Context Menu, דיאלוגים — כולם עברו ב־A2 245/245. ‏Risk: אפס שינוי ל־thresholds, ‏Fused Risk או `buildRiskReasons`.

## 39. Audio A3 — regression

207/207. ‏Sound Control, ‏READY/MUTED/BLOCKED/ERROR, ‏Global Mute, ‏localStorage, ‏hidden, ‏no-backlog, ‏no-reminder, ‏no-loop — כולם ללא שינוי.

## 40-41. RTL / English

נבדק ב־4 קונפיגורציות של OPS ו־4 של Configuration, בשתי השפות: אפס horizontal overflow, לשונית מתורגמת, ‏12 ילדים בפס. באנגלית שורות ההתראה גבוהות יותר (94px מול 65px) ולכן מוצגות פחות — נלקח בחשבון ביעדים.

## 42-43. QA 1920 / 1366

35 צילומים ב־`artifacts/industrial-ops-phase-a3-1/shots/` + manifest: ‏OPS ב־1920/1366 × he/en × demo/live (כולל full-page), תקריבים של Areas, ‏Visual Feed, ‏Operational Alerts, ‏Decision/Evidence, ‏Action Bar, ‏Risk Factors, ‏Risk/Time, ‏Session Log, וכל ארבע לשוניות ה־Configuration. **לא זויפה חומרה.**

## 44. תוצאות כל ה־Gates

| Gate | לפני A3.1 | אחרי A3.1 |
|---|---|---|
| `npm run build` | GREEN | **GREEN** |
| lint scoped | 4 / 0 | **4 / 0** (אותן 4 ב־`concepts/data/`) |
| `phase-h-qa` | 92/93 | **92/93** (אותו כשל היסטורי) |
| `phase-prime-verify` | 30/30 | **30/30** |
| `phase-prime-noregress` | no regressions | **no regressions** |
| `phase-a0-alerts-verify` | 64/64 | **64/64** |
| `phase-a1-command-center-verify` | 89/89 | **90/90** ↑ |
| `phase-a1-1-height-verify` | 53/53 | **54/54** ↑ |
| `phase-a2-operational-workflow-verify` | 245/245 | **245/245** |
| `phase-a3-audio-verify` | 207/207 | **207/207** |
| `phase-a3-1-ops-cleanup-verify` | — | **159/159** |

## 45. מספר בדיקות A3.1

**159** — ‏44 סטטיות (A), ‏6 לוגיות (B), ‏109 בדפדפן (C).

## 46. Screenshots

35, ראה §42-43.

## 47. בעיות שנותרו

1. **‏Visual Feed צר יותר מב־A3** (844→703px) והגובה השימושי נשאר ~403px, מתחת לשאיפת §23. הסיבה אריתמטית ומדווחת ב־§13: ‏3+5+4=12. **דורש את הכרעתך** אם להעדיף Feed 6/12 על חשבון Areas או Alerts.
2. **שטח פנוי מתחת ל־Feed ול־Areas ב־1920** — שלושת פאנלי הבנד העליון מיושרים לגובה על ידי ה־grid, וה־Alert list (408px) הוא הגבוה בהם. זו התנהגות שהייתה גם ב־A3 (‏Feed 536 מול גוף 401), אך היא בולטת יותר עכשיו.
3. **רווח חסר בשורת שגיאת הרדאר** — ‏`שגיאת רדארCOM14 לא זמין`. מקורו ב־`domain/SensorHealth.jsx` המשותף, קדם ל־A3.1, ולא נגעתי בו (§55).
4. **`.io2-about-doc` נשאר 9.5px** — בעמוד המפרט, מחוץ ל־OPS.
5. **גלילה עלתה ב־6–25px בשלוש קונפיגורציות** — מסחר מודע לטובת קריאות (§50), מדווח במספרים ב־§24.

## 48. החלטות עיצוב שנדרשו במהלך העבודה

- **תקרת רשימת ההתראות הועלתה 368→408px.** בלי זה אנגלית ב־1920 הציגה 3 התראות, מתחת לרצפה המאושרת של 4. ה־חלון עוקב אחרי השורות, לא להפך.
- **‏`.io2-strip-label` הועלה 8.5→10px** ו־letter-spacing הוקטן מעט כדי לא להרחיב את התאים. השורה שמסבירה איזה מספר הוא CAM RISK ואיזה RDR RISK לא צריכה להיות מיקרו־טיפוגרפיה.
- **‏System Health קיבל מסלול full-width נפרד** ב־Configuration במקום להידחס לחצי מה־grid הדו־טורי — הוא טבלה רחבה, לא טופס.
- **הפאנל מותקן רק כשהלשונית פעילה** — כך אין polling כשמפעיל קורא את טופס הרדאר.
- **נוספה שורת COVERAGE** לפאנל, מבוססת על `fresh.faults` הקיים: היא מפרידה בין "השרת ענה" לבין "יש כיסוי", וזו הבחנה שכבר קיימת ב־`useFreshness` ולא הומצאה כאן.
- **‏`OpsTargetsTable`/`OpsTracksTable` לא נמחקו** (§52 — שינוי מינימלי).

## 49. סיכונים ל־CAL0

- **‏`GATE_POINT`/`FENCE_LINE_Y` מכוילים ל־1920×1080 בעוד ה־Dahua על סאב־סטרים** (‏H1) — כיול ישנה אילו התראות נוצרות, ולכן ישפיע ישירות על מספר השורות ברשימה ועל קצב ה־cues הקוליים. שווה למדוד מחדש את שתי המדידות האלה אחרי CAL0.
- **הרשימה כבר מציגה 3–4 שורות באנגלית** — כל התראה חדשה שכיול יוסיף תדחוף את היתר לגלילה מהר יותר מבעבר.
- **‏Radar Plot גדל ל־46vh** — אם CAL0 יוסיף שכבת שער/גדר לפלט, יש לו עכשיו יותר מקום, אבל גם יותר מה להסתיר אם השכבה תצויר בלי כיול.

## 50. אישור: לא שיניתי Backend

`python/**` ללא שינוי — ‏`server.py` מ־2026-07-20, ‏`analysis.py` מ־2026-07-10, ‏`ld2450_reader.py`, ‏`radar_simulator.py` ללא נגיעה.

## 51. אישור: לא שיניתי API / routes / Auth / database

אין endpoint חדש, אין route חדש, ‏`AuthContext.jsx` ללא שינוי, ‏`users.json` ללא שינוי, ‏`.env` ללא שינוי.

## 52. אישור: לא שיניתי Risk Logic

ספי 40/75, ‏Fused Risk, ‏`buildRiskReasons`, ‏behavior rules, ‏scoring, ‏weapon/running/loitering/approaching — אפס שינוי.

## 53. אישור: לא שיניתי Lifecycle

‏Alert identity, ‏fingerprint, ‏reactivation, ‏lifecycle, ‏owner, ‏Resolve, ‏Reopen, ‏Area Severity, ‏Demo persistence, ‏sessionStorage — אפס שינוי (a0 64/64, ‏a2 245/245).

## 54. אישור: לא שיניתי Audio semantics

‏planner, ‏engine, ‏mute, ‏sound state — אפס שינוי (a3 207/207).

## 55-56. אישור: לא התחלתי CAL ולא OPT

אין `calibration.json`, אין Gate/Fence calibration, אין נורמליזציית קואורדינטות, אין `Open in OPT`, אין ניווט track/target.

## 57. אישור: לא שיניתי קונספטים אחרים

`Fusion Prime`, ‏`Minimal Command`, ‏`Sentinel 3D`, ‏`Neural Fusion`, ‏`design-lab` — אפס שינוי (prime 30/30, ‏noregress נקי, ‏h-qa 92/93).

---

## §64/§66 — עדכון בדיקות קיימות (חיזוק, לא עקיפה)

| בדיקה | היה | עכשיו |
|---|---|---|
| ‏A1 45 | ‏`.io2-panel-title == 15px` וכו' — **נעיצה** לערך מדויק | ‏**רצפה**: אף גודל מאושר לא יורד מתחת לערך של A1. נכשל על הקטנה, שותק על הגדלה |
| ‏A1 39b | "OPS מרנדר את הטבלאות המצומצמות שלו" | "OPS לא מרנדר אף טבלת contacts" **+ 39c חדשה**: הרכיבים המצומצמים עדיין קיימים |
| ‏A1.1 01/02 | ‏multiset של ערכי font-size | ‏**פר־סלקטור** מול קובץ ה־baseline — מזהה איזה כלל הוקטן, חסין לשינויי סדר ולהוספות |
| ‏A1.1 05/06 | תקרה 420px | תקרה 440px (‏re-base מוצהר) + נשמרה הדרישה שהתקרה עדיין נמוכה מלפני A1.1 |
| ‏A1.1 09 | "הפריסה לא השתנתה" | ‏**אף area לא שמור לפאנל שהוסר** + 09b: גם כללי ה־grid-area נעלמו |
| ‏A1.1 10 | ‏5–6 / 4–5 בדיוק | ‏≥4 / ≥3 (יעדי A3.1; יותר מותר) |
| ‏A1.1 11 | ‏368px | ‏408px |
| ‏A2 C34 | "גובה המסמך חזר למקום" | ‏**אף פאנל לא עשה reflow** — הבר, פאנל ההתראות והרשימה שומרים גובה. הסיבה: Resolve כותב שורה ליומן, והיומן ברוחב מלא כבר לא בתקרת הגלילה שלו |
| ‏A2 C88 | ‏5–6 / 4–5 | ‏≥4 / ≥3 |

אף בדיקה לא נמחקה; שתיים נוספו (‏A1 39c, ‏A1.1 09b).

---

## Definition of Done — מצב

| דרישה | מצב |
|---|---|
| ‏OPS לא מציג CAMERA TRACKS / RADAR TARGETS / SYSTEM HEALTH | ✅ C01–C03 |
| ‏Configuration מציג RADAR / OPERATOR / GENERAL / SYSTEM HEALTH | ✅ C33–C35 |
| ‏Source of Truth יחיד | ✅ A31–A34 |
| אין duplicate polling | ✅ C45–C49 |
| אין blank areas | ✅ A14, ‏A08–A09 |
| ‏Grid חולק מחדש | ✅ A15–A22 |
| ‏Areas גדול וברור יותר | ✅ C17 |
| ‏Visual Feed | ⚠️ תקרה וגובה Live גדלו; **הרוחב קטן** — ראה §13 |
| ‏Operational Alerts קריאים יותר | ✅ §15, C21 |
| ‏Risk Factors / Risk-Time גדולים יותר | ✅ C18–C19 |
| ‏Session Log full-width | ✅ C23 |
| טיפוגרפיה לא הוקטנה בשום מקום | ✅ A23, A1.1 01 |
| טיפוגרפיה מבצעית הוגדלה | ✅ A24 |
| אין scale / zoom / h-overflow | ✅ A25–A27, C22 |
| ‏1366 נשאר תפעולי | ✅ §11, C25 |
| ‏Camera/Radar data + Plot נשארו | ✅ §8 |
| ‏Decision/Evidence + Workflow + Audio נשארו | ✅ §26–§28, §39 |
| כל ה־Gates ירוקים | ✅ §44 |

**Phase A3.1 הושלם. לא התחלתי CAL0, ‏CAL1, ‏CAL2, ‏OPT או Backend.**
