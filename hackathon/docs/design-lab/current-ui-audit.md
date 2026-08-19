# ATAPIS — Current UI Audit (Design Lab, 2026-07-14)

מסמך זה מתעד את מצב ה־Frontend הקיים כבסיס לארבע חלופות העיצוב של Design Lab.
כל העובדות אומתו מול הקוד ומול המערכת הרצה (backend :5000 + Vite :5173, סימולטור רדאר פעיל).

## 1. מבנה ה־Frontend

```
hackathon/
├── index.html                 ← נקודת כניסה של Vite
├── vite.config.js             ← מינימלי (רק plugin-react, בלי proxy)
├── eslint.config.js           ← eslint 9 + react-hooks + react-refresh
└── src/
    ├── main.jsx               ← ReactDOM.createRoot + index.css
    ├── App.jsx                ← BrowserRouter + כל ה־Routes
    ├── index.css              ← design tokens גלובליים ([data-theme])
    ├── App.css                ← מעטפת layout
    ├── context/
    │   ├── AuthContext.jsx    ← login/logout מול /api/login, localStorage
    │   └── ThemeContext.jsx   ← dark/light על document.documentElement
    ├── components/
    │   ├── Navbar.jsx         ← ניווט עליון קבוע
    │   ├── ProtectedRoute.jsx ← redirect ל־/login כשלא מחוברים
    │   ├── AdminRoute.jsx
    │   └── *Card.jsx          ← 8 כרטיסים לא מנותבים (שאריות scaffolding)
    └── pages/
        ├── Landing, Login, Signup, Rooms, History, Settings, Admin
        ├── CameraRoom.jsx     ← ★ הדשבורד הפעיל (1,292 שורות)
        ├── CameraRoom.css     ← ~1,500 שורות
        └── CameraDashboard.jsx ← לא מנותב (קוד מת)
```

Routes פעילים: `/`, `/login`, `/signup`, `/rooms`, `/camera/:roomId` (הדשבורד), `/history`, `/settings`, `/admin`, `*`→`/`.

## 2. טכנולוגיות

| שכבה | טכנולוגיה | גרסה |
|---|---|---|
| UI | React | 19.2 |
| Routing | react-router-dom | 7.9 |
| Build | Vite + @vitejs/plugin-react | 7.2 / 5.1 |
| Styling | CSS ידני, קובץ פר־עמוד/רכיב | — |
| אנימציות | CSS transitions בלבד | — |
| 3D / Canvas / charts | אין | — |
| בדיקות | אין test runner; יש `npm run lint` | — |
| צילומי מסך / e2e | אין (Playwright יתווסף כ־devDependency ל־Design Lab) | — |

## 3. רכיבים מרכזיים ב־CameraRoom (הדשבורד הפעיל)

- **שני פאנלי מצלמה** (`renderCameraPanel('webcam'|'dahua')`) — MJPEG ב־`<img>`, badges חיבור/מצב, מטריקות (persons/weapon/risk), placeholder בניתוק + Retry.
- **Radar / Sensor Dashboard** — רשימת key/value ארוכה: status, mode, camera/radar/fused risk, profile, radar link/status/provider/targets/latency, sensor distance.
- **Radar Targets** — כרטיס לכל מטרה: distance/speed/direction/angle/resolution/valid + risk badge.
- **Radar Map** — DIVים ממוקמים באחוזים (לא Canvas): x_mm על ±3000, y_mm על 0–8000 (`getRadarMapPosition`, CameraRoom.jsx:564).
- **Scenario Video Analysis** (טאב שני) — upload, progress polling, video player, history.
- קוד מת: בלוק `{false && ...}` (שורות 788–833) שמפנה למשתנים שאינם קיימים.

## 4. איך מתקבלים הנתונים

**הכול HTTP polling — אין WebSocket/SSE.** בסיס: `API_BASE_URL = 'http://localhost:5000'` קשיח, משוכפל ב־3 קבצים (CameraRoom.jsx:5, AuthContext.jsx:5, Rooms.jsx:20).

| נתון | Endpoint | קצב | שדות בשימוש |
|---|---|---|---|
| וידאו מצלמה | `GET /video_feed/webcam`, `/video_feed/dahua` | MJPEG רציף | פריים מנותח עם bounding boxes |
| מצב גלובלי + Risk | `GET /status` | 1s | `mode` (SAFE/ALERT/DANGER), `max_risk`, `camera_risk`, `radar_risk`, `fused_risk`, `has_person`, `person_count`, `has_weapon`, `weapon_type`, `motion`, `profile`, `distance`, `context`, `tracks[]` (id, state, risk, speed, has_weapon, zone, approaching_gate, bbox), `radar` (מוטמע) |
| רדאר | `GET /api/radar/live` | 1s | `provider` (ld2450/mock), `radar_status`, `radar_connected`, `scenario`, `targets_count`, `max_radar_risk`, `last_update_ms`, `last_error`, `targets[]` (x_mm, y_mm, distance_mm, angle_deg, speed_cm_s, direction, approaching_gate, confidence, radar_risk, valid) |
| מצלמות | `GET /api/cameras/status` | 1s | פר מקור: `connected`, `status`, `last_error`, `mode`, `fused_risk`, `person_count`, `has_weapon`, `weapon_detection_available`, `weapon_detection_status`, `context`; dahua גם `subtype`, `last_frame_time` |
| Arduino | `GET /api/arduino-messages` | 1s | `messages[{time,message}]` — נרשם ל־console בלבד, לא מוצג ב־UI |

**ספי מצב (תצוגה בלבד, נקבעים בשרת):** risk ≥ 75 → DANGER, ≥ 40 → ALERT, אחרת SAFE.

**מצבי התנהגות ב־tracks:** `detected`, `running`, `loitering`, `gate_loitering`, `approaching`, `armed` (+ `idle`). מגיעים מוכנים מהשרת — ה־Frontend לא מחשב דבר.

## 5. בעיות Responsive קיימות

- תוקנו ברובן בקוד (CLAUDE.md L1): `overflow-y: visible` על העמוד, `max-height: none` על עמודות, 7 media queries (1920+, 1440–1919, 1024–1439, 768–1023, \u200E<767, \u200E<480, \u200E<1100).
- הבעיה ההיסטורית: **Radar Map ונתוני חיישן "נעלמים" במסך מלא** — העמודה הימנית (`minmax(340px,1fr)`) נדחפה מתחת ל־fold כשהמצלמות תפסו גובה, וגלילת העמוד נחסמה. הפתרון הקיים מסתמך על גלילת עמוד; **דורש אימות ויזואלי ב־100% zoom** — ייבדק ב־Playwright בכל 6 הרזולוציות.
- עמוד יחיד ארוך מאוד: ב־1366×768 המשתמש חייב לגלול הרבה כדי להגיע לרדאר — בעיה מבנית שהעיצובים החדשים צריכים לפתור (רדאר לצד המצלמה, לא מתחתיה).

## 6. רכיבים לשימוש חוזר ב־Design Lab

- דפוס ה־polling וה־MJPEG של CameraRoom (ייעטף ב־hook משותף `useAtapisData`).
- `getRadarMapPosition` — לוגיקת המיפוי x_mm/y_mm (תועתק ל־adapter, לא תיובא מהעמוד).
- design tokens גלובליים (`--bg-*`, `--text-*`, `--glass-*`) — כבסיס ניטרלי בלבד; לכל קונספט tokens משלו.
- `ProtectedRoute` — עוטף גם את נתיבי ה־Design Lab.
- מנגנון placeholder + retry של המצלמות (ישוכתב כרכיב `CameraFeed` משותף).

## 7. רכיבים שאסור לשנות

- `python/server.py`, `python/analysis.py`, `python/ld2450_reader.py`, `python/radar_simulator.py` — וכל חוזה ה־API.
- ערכי Risk, ספי ALERT/DANGER, פירוש המצבים — תצוגה בלבד.
- `CameraRoom.jsx` / `CameraRoom.css` — הדשבורד הפעיל נשאר כפי שהוא עד בחירת עיצוב.
- נתיב `/camera/:roomId`, מערכת ההתחברות, `data/users.json`.
- `App.jsx` — נגיעה מינימלית בלבד (הוספת נתיבי lazy).

## 8. צווארי בקבוק בביצועים

- **H4 (החמור ביותר):** כל `<img>` שפותח MJPEG יוצר generator עצמאי בשרת → ניתוח YOLO כפול לאותו מקור. שני פאנלים ב־CameraRoom = 2 זרמים; כל טאב נוסף מכפיל. ⇒ ב־Design Lab: מסך הבית לא פותח זרמים כלל, ובכל קונספט mounted רק זרם אחד שנבחר.
- 4 בקשות polling נפרדות כל שנייה מכל טאב פתוח (אין דדופליקציה) ⇒ ה־hook המשותף מרכז אותן לסבב אחד.
- Radar Map ב־DIVים עם style חדש כל שנייה — זול יחסית, אבל כל רינדור עמוד מלא (state יחיד גדול) גורר re-render של כל הדשבורד בכל poll.
- אין React.memo/useMemo כמעט בכלל; ב־1s polling זה נסבל אך לא לחינם.

## 9. RTL

- **אין תמיכה כלל**: אין `dir` attribute, אין לוגיקת שפה, אין טקסט עברי ב־src, ה־CSS משתמש ב־left/right פיזיים (לא logical properties).
- ⇒ ב־Design Lab: toggle HE/EN עם `dir` על מעטפת ה־lab, CSS logical properties, ו־`dir="ltr"` נקודתי על ערכים טכניים (קואורדינטות, יחידות, IDs).

## 10. הערות סביבה בזמן ה־audit

- המחשב ללא חומרה: אין webcam, אין רדאר פיזי, Dahua לא נגישה, מודל נשק חסר (HF cache ריק) ⇒ המצלמות במצב disconnected אמיתי; הרדאר מוזן מ־Simulator (מאושר זמנית, `provider: "mock"`, תרחישים אמיתיים מהשרת).
- `weapon_detection_available: false` צפוי — ה־UI מציג "Unavailable" (תיקון C1).
