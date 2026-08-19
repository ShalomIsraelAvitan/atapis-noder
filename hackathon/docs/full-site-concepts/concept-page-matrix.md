# Concept × Page Matrix (2026-07-16)

מוכיח שוני **מבני והתנהגותי** בין חמשת הקונספטים — לא צבעים בלבד.
כל הקונספטים חולקים: view models, domain components, נתונים, מצבי קצה, סמנטיקת SAFE/ALERT/DANGER.

| ממד | Minimal Command | Sentinel 3D | Industrial Ops | Neural Fusion | Fusion Prime |
|---|---|---|---|---|---|
| **Navigation** | Top bar צר, 6 פריטי טקסט, active קו תחתון | Floating dock צף בתחתית־מרכז, אייקון+תווית, זכוכית | Sidebar מבצעי קבוע משמאל־לוגי, קיצורי מקלדת (1–6), system state תמיד גלוי בראשו | Node dock אנכי צף בצד, נקודות מחוברות בקו זרימה | Top bar נקי + command strip תחתון עם מצב מערכת מתמיד |
| **Dashboard layout** | עמודה ממורכזת: מילת מצב ענקית → מצלמה+risk → שורת מדדים | סצנת תאום דיגיטלי במרכז המסך, פאנלי HUD בפינות | Grid 12 עמודות עם קווי הפרדה: status strip עליון, רדאר+טבלת מטרות שמאל, מצלמה+tracks ימין, event log+ticker תחתון | ליבת fusion רדיאלית (מצלמה במרכז, טבעת רדאר) + קווי זרימה לצומת החלטה + Why panel | Hero מצב+risk, תאום דיגיטלי קומפקטי לצד מצלמה, טבלת מטרות מתחת, Why This Risk בצד |
| **Camera layout** | מצלמה מקסימלית, בורר מקור עדין, מדדים מתחת | מצלמה כפאנל צף מעל הסצנה + מיקוד מטרה בסצנה | מצלמה בעמודת ימין עם טבלת tracks צמודה, רדאר plot משמאל | מצלמה בליבה עם שכבת targets רדיאלית ו-narrative צמוד | מצלמה גדולה + evidence strip + targets טבלה תחתונה |
| **Investigation (History) layout** | Split view: רשימת אירועים שמאל / אירוע נבחר+snapshot ימין | Spatial replay: תצוגת אתר עם מיקום המטרה + פאנל אירוע | טבלת אירועים צפופה עם פילטרים בשורה קבועה + audit trail; שורה נבחרת נפתחת inline | שרשרת סיבות: timeline אנכי עם קווי זרימה בין אירועים + fusion explanation לאירוע | Timeline עליון + evidence panel + סיבות + פעולות |
| **About layout** | סיפור מוצר אנכי נקי, טיפוגרפיה גדולה | ארכיטקטורת מערכת אינטראקטיבית סביב סצנה/דיאגרמה מרחבית | Technical product brief: מסמך מפרט עם סעיפים ממוספרים ו-hr | מסע sensor-fusion מונפש: שלבי הזרימה נחשפים בגלילה | נרטיב פרימיום: בעיה→פתרון→ארכיטקטורה→MVP→חזון |
| **Settings layout** | טופס עמודה אחת, sections מופרדים ברווח | פאנלים צפים מעל רקע שקט (ללא 3D!) | טאבים טכניים צפופים + טבלת ערכים נוכחיים | כרטיסי זכוכית מקובצים לפי חיישן | הגרסה הנקייה של Minimal עם שיפורי ולידציה |
| **Admin layout** | טבלה נקייה + פעולות מינימליות | כרטיסי משתמשים צפים + פאנל פעולה | **הצפוף ביותר**: טבלה מלאה, bulk visual, סטטיסטיקות, פעולות inline, audit הערות | גרף קשרים ויזואלי קל + טבלה | טבלת Industrial + בהירות Minimal + ConfirmDialog מלא |
| **Motion level** | Subtle: fade/translate ≤250ms, מספרים מתגלגלים | Cinematic בדשבורד/מצלמה (תנועת מצלמת סצנה); subtle בשאר | 80–160ms snap, אפס דקורציה, הדגשת alert בלבד | Data-flow: dash animations, פעימות לאורך קווים | מבוקר: cinematic רק בתאום הדיגיטלי, השאר subtle |
| **Density** | נמוכה | בינונית | גבוהה | בינונית, גבוהה ב-Focus | בינונית-גבוהה |
| **Main visualization** | מספר risk גדול + קשתות רדאר מינימליות | תאום דיגיטלי 3D (fallback 2D) | טבלאות + radar plot אורתוגרפי | קווי זרימת fusion + טבעת רדיאלית | תאום קומפקטי + sparkline risk + טבלאות |
| **Mobile behavior** | עמודה אחת, מדדים 2×N | סצנה הופכת ל-2D סטטי, HUD נערם | sidebar → שורת טאבים עליונה, טבלאות → כרטיסים | ליבה נערמת אנכית, קווים מוסתרים | תאום מוסתר, נשאר hero+כרטיסים |

## עוגני שוני נוספים
- בחירת מטרה: Minimal אין / Sentinel בסצנה / Industrial בשורת טבלה / Neural בנקודת טבעת / Prime בטבלה+תאום.
- הצגת התראות: שורה יחידה מתחלפת / HUD צף / ticker+log / narrative מצטבר / רשימה ממוינת עם actions.
- ‏RTL: כל החמישה — עברית ברירת מחדל בסביבת ‎/concepts‎, ערכים טכניים LTR.
