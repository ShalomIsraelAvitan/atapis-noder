# ATAPIS Design Lab — Design Directions (2026-07-14)

ארבעה קונספטים לדשבורד ATAPIS. כולם צורכים את אותם נתונים דרך שכבת Data Adapter משותפת
(`src/design-lab/shared/`), אך נבדלים מהותית במבנה, בהיררכיה, בטיפוגרפיה ובשפת התנועה.

## עקרונות Skills מנחים פר־קונספט

| קונספט | Skills מנחים | קו מנחה |
|---|---|---|
| Minimal Command | minimalist-ui, high-end-visual-design, emil-design-eng, impeccable polish/distill | "פחות אבל מדויק" — טיפוגרפיה חזקה, צבע רק לסיכון, אנימציות ≤250ms ease-out |
| Sentinel 3D | emil-design-eng, animation-vocabulary, apple-design, impeccable delight/audit | Digital Twin מופשט; motion עם משמעות מרחבית; ביצועים לפני אפקטים |
| Industrial Ops | industrial-brutalist-ui (מצב Tactical Telemetry Dark), design-taste-frontend, impeccable bolder/critique, review-animations | Grid קשיח, mono, 90°, צפיפות גבוהה, אנימציות חדות ≤160ms |
| Neural Fusion | high-end-visual-design, design-taste-frontend, emil-design-eng, impeccable delight/polish | עומק שכבתי, קווי זרימת נתונים, "Why this risk?" — קולנועי אך קריא |

## טבלת בידול — 12 ממדים

| ממד | Minimal Command | Sentinel 3D | Industrial Ops | Neural Fusion |
|---|---|---|---|---|
| **מבנה העמוד** | עמודה מרכזית ממורכזת: מצלמה גדולה + רצועת מדדים אחת + רדאר צד | סצנת 3D ממלאת את המסך; פאנלים צפים בפינות (HUD) | Grid בלוקים קשיח 12 עמודות עם קווי הפרדה גלויים; פס מצב עליון מלא | שכבות רדיאליות סביב מרכז — מצלמה בליבה, רדאר כטבעת, מנועים כצמתים |
| **היררכיית מידע** | מצב המערכת ← מצלמה ← risk ← רדאר; מעט מאוד פריטים | המרחב עצמו הוא ההיררכיה: קרוב לשער = חשוב; פאנלים משניים | הכול שווה־ערך וזמין בבת אחת (cockpit); פס המצב שולט | סיפור ה־fusion: קלט (מצלמה/רדאר) ← מיזוג ← החלטה (risk) |
| **מיקום המצלמה** | מרכז, האלמנט הגדול ביותר | פאנל צף בפינה + סמל מצלמה בתוך הסצנה | עמודה ימנית, כרטיס בגובה קבוע בתוך ה־grid | הליבה במרכז העיגול, עם glow לפי מצב |
| **מיקום הרדאר** | פאנל צד ימין לצד המצלמה, תמיד נראה | הסצנה כולה היא הרדאר (קונוס סריקה + מטרות במרחב) | עמודה שמאלית: מפה + טבלת מטרות מלאה | טבעת רדיאלית סביב המצלמה; מטרות כנקודות על הטבעת |
| **סוג ניווט** | אין ניווט פנימי — מסך יחיד ממוקד | מתגי מצלמה Overview/Focus + בחירת מטרה בסצנה | טאבים טכניים בפס העליון + קיצורי מקלדת | בחירת target פותחת Focus panel; ניווט בלחיצה על צמתים |
| **צפיפות מידע** | נמוכה (5–7 פריטים גלויים) | בינונית — הסצנה + 3 פאנלים | גבוהה — טבלאות, timeline, ticker, הכול גלוי | בינונית־נמוכה בברירת מחדל; גבוהה במצב Focus |
| **טיפוגרפיה** | Grotesk נקי, מספרים גדולים דקים, tracking רחב ל־labels | טכנית עדינה על HUD, מספרים tabular; אותיות קטנות | Mono בלבד (uppercase), כותרות ענק שחורות, clamp() | Grotesk + mono לערכים; כותרות בינוניות, דגש על קשרים לא על טקסט |
| **שפת אנימציה** | fade/translate עדינים 200ms ease-out; מספרים מתגלגלים | תנועת מטרות אינטרפולציה בסצנה; מעברי מצלמה 800ms; דופק לפי מצב | ללא ease כמעט — snap 120ms; הבהוב סטטוס יחיד; ticker ליניארי | קווי SVG עם dash-flow; פעימת נתונים ממקור ל־fusion; עומק parallax עדין |
| **הצגת התראות** | שורת סטטוס אחת מתחלפת בעדינות | Banner צף עליון + הדגשת המטרה בסצנה | Event ticker רץ + טבלת timeline עם חותמות זמן mono | Threat Narrative — רשימת סיבות מצטברת ("Why this risk?") |
| **הצגת מצב סיכון** | מילה אחת גדולה (SAFE/ALERT/DANGER) + מספר; צבע רק כאן | צבע הסביבה בסצנה (אזורים) + טבעת מצב סביב הפאנל | בלוק ענק בפס העליון + פסי אזהרה אלכסוניים ב־DANGER | ליבת ה־fusion משנה צבע/עוצמת glow; המספר במרכז הצומת |
| **בחירת מטרה** | אין (רשימה סטטית קטנה) | לחיצה על מטרה בסצנה ← מעבר מצלמה ל־Focus | שורה בטבלת המטרות ← הדגשה במפה | לחיצה על נקודה בטבעת ← Focus panel עם כל הנתונים והסיבות |
| **יחס ויזואלי/טבלאי** | 80/20 ויזואלי | 90/10 ויזואלי | 30/70 טבלאי | 70/30 ויזואלי, טבלאי בתוך Focus |

## מה משותף (בכוונה)

- אותם נתונים חיים מאותם endpoints, דרך `useAtapisData` יחיד.
- אותם מצבי קצה: loading / offline / camera disconnected / radar disconnected / backend reconnecting / demo.
- אותה סמנטיקת צבעי סיכון (ירוק/ענבר/אדום מגיעים מהשרת דרך mode בלבד — אין פירוש מקומי).
- `prefers-reduced-motion`, ניווט מקלדת, `dir` RTL/LTR.
- זרם MJPEG אחד mounted לכל היותר בכל רגע (בורר webcam/dahua).

## סיכוני עיצוב שסומנו מראש

- Sentinel 3D: אסור שייראה כמו משחק — geometry מופשטת, בלי טקסטורות; תווית "Operational visualization — not geo-accurate".
- Industrial Ops: אסור neon/cyberpunk — אין glow גורף, terminal-green רק באלמנט יחיד אם בכלל.
- Neural Fusion: אסור עומס חלקיקים — חלקיקים רק על קווי הזרימה, צפיפות נמוכה, נכבים ב־reduced-motion.
- Minimal Command: אסור שיהפוך "ריק" — היררכיה טיפוגרפית חזקה במקום קישוט.
