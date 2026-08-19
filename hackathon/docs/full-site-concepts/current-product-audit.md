# ATAPIS — Current Product Audit (Full-Site Concepts, 2026-07-16)

אומת בשתי דרכים: קריאת קוד מלאה + הרצה חיה בדפדפן (Playwright, אפס שגיאות Console בכל הדפים).
סביבת האימות: backend :5000 (סימולטור רדאר פעיל, מאושר זמנית), Vite :5173, ללא חומרת מצלמה/רדאר.

## טבלת דפים

| Page | Current Route | Current Features | Data Source | Existing Problems | Must Preserve |
|---|---|---|---|---|---|
| About / Landing | `/` (public) | Hero, Mission, 4 feature cards, Technology, CTA; מוני סטטיסטיקה מונפשים (IntersectionObserver); CTA מתחלף לפי auth | סטטי בלבד (אין API) | סטטיסטיקות מומצאות (99.9% uptime, 1000+ sites) — הוחלט (2026-07-16) לא להעתיקן לקונספטים אלא להציג מסגור MVP כן; טקסט גנרי "Smart Security" ללא אזכור ATAPIS/רדאר/fusion | העמוד עצמו נשאר ללא שינוי; הטקסטים הלא־מספריים משמשים בסיס ל־About החדש |
| Dashboard | `/rooms` | כרטיס חדר יחיד (קשיח: Main Area, 2 cameras), poll כל 5s, מציג status/person_count/weapon/mode/motion, ניווט ל־`/camera/1` | `GET /status` | לא באמת Dashboard — אין risk breakdown, אין radar, אין alerts, אין timeline; "2 Camera" קשיח | הנתיב וההתנהגות כברירת מחדל |
| Camera Room | `/camera/:roomId` | הדשבורד המבצעי המלא (1,292 שורות): 2 זרמי MJPEG, סטטוסים, radar map, targets, scenario upload+history | `/status`, `/api/radar/live`, `/api/cameras/status`, `/api/arduino-messages`, `/video_feed/*`, scenario endpoints | H4 (ניתוח כפול פר צופה), עמוד ארוך, API base קשיח | **הכול** — זה המסך הפעיל למשתמש הקצה |
| History | `/history` | סטטיסטיקות (159 detections, 139 persons, 41 weapons), גריד כרטיסי אירוע עם תמונות snapshot, Clear History (confirm), poll 10s | `GET /api/detections` (persisted `data/monitoring.json`, cap 1000, כל אירוע: timestamp, mode, camera/radar/fused risk, motion, context, weapon, radar snapshot מלא, filename) + `GET /api/images/<f>` + `DELETE /api/detections` | אין פילטרים/חיפוש/טווח תאריכים; אין פרטי אירוע מורחבים; אין timeline; העמוד עמוס (795 כרטיסים ב-DOM) | ה־endpoints; היכולת לנקות; **159 אירועים אמיתיים + תמונות = הבסיס ל־Investigation Room** |
| Settings | `/settings` | 3 טאבים: General (toggles מקומיים בלבד — פייק), Radar (**אמיתי**: GET/PUT `/api/radar-config` — LD2450_ENABLED/PORT/BAUD, RADAR_USE_MOCK, scenario, update_rate, ספי מהירות/מרחק, debug overlay), Profile (updateUser אמיתי) | `/api/radar-config`, `PUT /api/users/:id` | General מציג בקרות שלא עושות דבר + "System Information" קשיח (v1.0.0, 2.4GB storage); סיסמה נוכחית לא מאומתת | מפתחות השדות של radar-config בדיוק; זרימת השמירה |
| Admin | `/admin` (AdminRoute) | CRUD משתמשים מלא ואמיתי: רשימה, Add, Edit (username/email/role), Approve pending, Delete/Reject (window.confirm), סטטיסטיקות | `GET/POST /api/users`, `PUT/DELETE /api/users/:id` | אין audit log; אין הרשאות בצד שרת (כל קריאה פתוחה); confirm של הדפדפן בלבד | כל הפעולות; חסימת self-delete |
| Login/Signup | `/login`, `/signup` | login אמיתי (403 ל-pending), signup→pending; "Remember me"+"Forgot password" מתים | `POST /api/login`, `POST /api/users` | auth ללא token; סיסמאות plaintext בשרת (C4 ידוע) | זרימת ההתחברות וה-localStorage keys (`user`, `isAuthenticated`) |
| Design Lab | `/design-lab/*` | 4 קונספטים סביב מסך המצלמה + שכבת נתונים משותפת + demo mode | דרך `design-lab/shared/*` | — | **הכול; שינויים רק backward-compatible** |

## חוזי נתונים זמינים (ל-view models)

| צורך | מקור אמיתי | הערות |
|---|---|---|
| Mode/risks/tracks/motion/context | `GET /status` (1s) | קיים ב־useAtapisData |
| Radar targets/status/provider/**confidence** | `GET /api/radar/live` | confidence: גלובלי + פר־מטרה — **אמיתי**; אין fused/camera confidence → "Confidence metric not yet available" |
| מצלמות (connected/last_error/weapon_detection_available) | `GET /api/cameras/status` | קיים |
| אירועים היסטוריים + evidence | `GET /api/detections` + `/api/images/<f>` | **פרסיסטנטי, 159 אמיתיים**; DELETE קיים |
| Risk-over-time | אין endpoint | Session ring buffer מסומן "Current Session" (מתאפס ב-reload) + נקודות אירועי detections אמיתיים |
| Alerts log | אין endpoint | נגזרת session (שינויי mode/weapon/radar) — קיימת ב-useAtapisData |
| Sensor health | `GET /api/arduino-status` + distance ב-/status + radar last_error | |
| Radar config | `GET/PUT /api/radar-config` | ממופה מלא ב-Settings הקיים |
| Users | `/api/users*` דרך AuthContext | |
| System logs / health endpoint | אין | יוצג Planned/Unavailable |
| AI summary | אין אינטגרציה | "Automated System Summary" דטרמיניסטי בלבד |

## placeholders/קוד מת (לא נוגעים, מתועד)
General settings tab; System Information קשיח; Remember me/Forgot password; 8 קובצי `*Card.jsx` לא מנותבים; `CameraDashboard.jsx` (TF.js, לא מנותב); `server2.py`.

## החלטות פתוחות שנסגרו
- About = מסגור MVP כן (CLAUDE.md כמקור עובדות) — אישור משתמש 2026-07-16.
- Fusion Prime inheritance — אושר, מימוש ברצף.
- RADAR_USE_MOCK=true זמני (מקורי: false) — אושר; ישוחזר בסוף.
