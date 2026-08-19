# Fusion Prime — Inheritance Decision (Phase E, 2026-07-18)

כיוון הירושה אושר מראש (2026-07-16); מסמך זה מקבע *מה בדיוק* יורש כל דף,
בהתבסס על עמודת Fusion Prime ב-`concept-page-matrix.md` ועל ממצאי Phase D
(`phase-d-review.md`). לא זוהו שתי חלופות UX שונות מהותית — אין צורך בעצירה.

## עקרון-על

Fusion Prime הוא **השילוב הבשל**, לא קונספט חמישי מנותק: בהירות Minimal כבסיס
לכל דף, עומק מרחבי של Sentinel רק היכן שהוא מוכיח ערך (התאום), צפיפות
Industrial רק בטבלאות נתונים, וסיפור ההיתוך של Neural רק כהסבר — לא כקישוט.
Motion: cinematic בתאום הדיגיטלי בלבד; כל השאר subtle. צבע accent: זהב מאופק
על גרפיט (נבדל מכל ארבעת הבסיסים).

## החלטות פר דף

| דף | יורש מ- | מימוש |
|---|---|---|
| **Shell** | Minimal (top bar) + Industrial (מצב תמידי) | Top bar נקי + **command strip תחתון קבוע** עם ModeBadge, סיכון ממוזג/מצלמה/רדאר, אנשים, נשק, חיוויי Backend/Radar. ה-strip ניזון מ-`useAtapisData` ברמת השלד (poller שני בדפי dashboard/camera — עלות מקובלת, זהה לטאב נוסף; מתועד) |
| **Dashboard** | Minimal (hero) + Sentinel (תאום) + Industrial (טבלה) + Neural (Why) | Hero מצב+risk → שורת תאום קומפקטי (Scene הקיים, lazy, fallback 2D) לצד פיד מצלמה חי (מותר — רק route אחד mounted בכל רגע, H4 נשמר) → TargetsTable מתחת עם בחירה מסונכרנת טבלה↔תאום → Why This Risk + sparkline (RiskTimelineChart session) + התראות + חיבורים + סיכום אוטומטי בצד/מתחת |
| **Camera** | Minimal (פיד מקסימלי) + Industrial (טבלאות צמודות) | פיד גדול + בורר מקור; evidence strip = התראות סשן קומפקטיות מעל הטבלאות; תחתית: TargetsTable (בחירה → כרטיס מיקוד) + TracksTable; רail צד: Why / מיקוד מטרה |
| **Investigation** | Neural (ציר) + Minimal (split) + Industrial (פעולות) | RiskTimelineChart scope="events" (vm.riskSeries — נתונים אמיתיים) עליון → פילטרים → EventList לצד EventDetails (ראיות+סיבות) → **פעולות**: Reload + Clear History אמיתי מאחורי ConfirmDialog מלא |
| **About** | Minimal (נרטיב) בסדר הפרימיום | בעיה → פתרון (innovation) → ארכיטקטורה+flow → עמודי היכולת → MVP → חזון; טיפוגרפיה גדולה, מפריד זהב |
| **Settings** | Minimal + "שיפורי ולידציה" | אותו מבנה נקי + **פאנל בדיקות תצורה** display-only הנגזר מה-draft: baud חריג (115200/256000 — סתירת C3 מוצגת כהערה, לא משונה), פורמט COM, ספי מהירות הפוכים, טווח קצב עדכון. אזהרות ייעוץ בלבד — זרימת השמירה וה-contract לא משתנים |
| **Admin** | Industrial (טבלה) + Minimal (בהירות) + ConfirmDialog | `UsersManager` המשותף (כבר כולל טבלה מלאה, pending, ConfirmDialog) בעטיפת Prime נקייה |

## מה בפירוש לא

- אין endpoint חדש, אין שינוי Backend/Risk/API contracts.
- אין 3D מחוץ לתאום שבדשבורד.
- אין נתוני demo שאינם מסומנים; אין "AI summary" (רק ה-ActivitySummary הדטרמיניסטי המסומן).
- ה-placeholder הזמני (`PrimeComingSoon`) נמחק עם המימוש — הוא היה stub של אותו סשן, לא קוד קיים.
