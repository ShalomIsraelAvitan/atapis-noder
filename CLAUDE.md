# CLAUDE.md — זיכרון פרויקט והנחיות עבודה

> קובץ זה הוא מקור האמת עבור Claude בכל שיחה על הפרויקט.
> נכתב על סמך סריקה מלאה של הקוד, ההגדרות והלוגים בתאריך 2026-07-10.
> **עודכן 2026-07-20** לאחר מעבר למחשב חדש + מיזם תחזוקה (פרק 19).
> **עודכן 2026-07-29** — סבב שדרוג העיצובים (פרק 20) + אימות חומרה של ה־LD2450 בחיבור ישיר.
> כל עובדה כאן אומתה מול הקבצים עצמם; מידע לא ודאי מסומן **[דורש אימות]**.
> אסור להכניס לקובץ זה סיסמאות, כתובות RTSP מלאות או פרטי התחברות.

---

## 1. Project Overview

- **שם:** ATAPIS — Autonomous Threat Assessment & Perimeter Intelligence System.
- **מטרה:** זיהוי אדם/אובייקט באזור מאובטח (גדר, שער, שטח היקפי), מעקב אחר תנועתו, ניתוח התנהגות, שילוב נתוני מצלמה ורדאר, חישוב Risk Score דינמי והצגה בזמן אמת ב־Dashboard.
- **הבעיה:** מערכות מצלמה רגילות מזהות "אדם בתמונה" אך לא מבינות כוונה. המערכת מוסיפה הקשר: מהירות, כיוון, שהייה, קרבה לגדר/שער, נשק, ונתוני מרחק/מהירות מרדאר.
- **החידוש:** שילוב (Fusion) בין זיהוי וידאו + מעקב + ניתוח התנהגות לבין רדאר 24GHz (מרחק/זווית/מהירות), עם מצב מערכת גלובלי: SAFE / ALERT / DANGER.
- **מצב נוכחי:** MVP מתקדם בשלב אינטגרציית חומרה. התוכנה שלמה ברובה; החיבור היציב לרדאר האמיתי ולמצלמת ה־Dahua בשטח עדיין בתהליך אימות.
- **תוצאה רצויה:** דמו יציב לשופטים — מצלמה חיה עם Bounding Boxes, רדאר חי (או Simulator כגיבוי), Risk מתעדכן ומצב מערכת משתנה בהתאם לתרחיש.

---

## 2. System Architecture

הארכיטקטורה **בפועל** (כפי שנמצאה בקוד — לא המתוכננת):

- **מצלמות:** שני מקורות — Webcam מקומית (cv2, index 0/1) ומצלמת Dahua ב־RTSP דרך `LatestFrameRTSPReader` (thread ייעודי, שומר רק פריים אחרון, reconnect כל 3 שניות).
- **זיהוי אדם:** Ultralytics YOLO `yolov8n.pt`, class 0, conf 0.50.
- **זיהוי נשק:** מודל שני. אין `weapon_best.pt` מקומי — נטען מ־HuggingFace cache (`Subh775/Threat-Detection-YOLOv8n`). conf 0.40.
- **Tracking:** שיוך לפי ציון משוקלל 0.7·IoU + 0.3·קרבת מרכזים, Track ID פנימי, עד 10 פריימים החמצה.
- **Behavior + Risk:** ב־`analysis.py` — מצבים, צבירת סיכון, דעיכה, ספים גלובליים (פירוט בפרק 9).
- **רדאר HLK-LD2450:** `RadarDataProvider` ב־thread daemon — פותח Serial, מפענח מסגרות בינאריות (`AA FF 03 00 ... 55 CC`) **וגם** שורות JSON, מסנן, מחשב radar_risk לכל מטרה. reconnect אוטומטי כל שנייה. singleton משותף.
- **חיבור פיזי:** מתאם USB-to-TTL עם צ'יפ CH343 על COM14 (מהלוגים). ESP32 מופיע בפרויקט רק כבקר זמזם/LED (`security.ino`) — **אין בריפו קוד ESP32 שקורא LD2450**.
- **Sensor Fusion:** סקלרי בלבד — `combine_camera_risk_and_radar_risk()` משלב שני מספרי סיכון. **אין** שיוך מרחבי בין מטרת רדאר ל־Track של מצלמה.
- **Backend:** Flask יחיד על פורט 5000 (server.py) — מגיש גם את ה־build של ה־Frontend מ־`python/dist/`.
- **Frontend:** React 19 + Vite (פורט 5173 בפיתוח). התקשורת: **HTTP polling כל ~1 שנייה + MJPEG בתגי `<img>`. אין WebSocket/Socket.IO.**
- **Arduino/ESP32 זמזם:** השרת שולח פקודת `ALERT` ב־Serial (9600) במצבי ALERT/DANGER.

### תרשים זרימה (בפועל)

```
Webcam (cv2 index 0/1) ──────────────────┐
Dahua RTSP → LatestFrameRTSPReader ──────┤  (thread, latest-frame, reconnect)
                                         ▼
        server.py :: gen_frames(source)   ← לולאה לכל לקוח HTTP שצופה בזרם
                                         ▼
   analysis.py :: analyze_frame_for_source(source, frame, radar_targets)
        ├─ YOLO person (yolov8n.pt, conf 0.50)
        ├─ YOLO weapon (HF cache, conf 0.40)
        ├─ Tracking (IoU + מרכזים) → Behavior → Risk per-track
        ├─ radar payload (מוזרק מהשרת / provider משותף / mock)
        └─ fused_risk = combine(camera_risk, radar_risk) → SAFE/ALERT/DANGER
                                         ▼
        MJPEG (פריים מנותח) + STATUS / CAMERA_STATUS גלובליים
                                         ▼
   Frontend (CameraRoom.jsx) — polling: /status, /api/radar/live,
   /api/cameras/status, /api/arduino-messages + שני תגי <img> ל־MJPEG

Thread מקביל קבוע:
LD2450 → COM14 (Serial) → RadarDataProvider._reader_loop
       → פענוח בינארי/JSON → סינון → radar_risk → payload משותף

Thread מקביל: Arduino reader (מרחק מחיישן אולטרסוני, 9600 baud)
Subprocess לפי דרישה: scenario_video_analysis.py (ניתוח וידאו שהועלה + ffmpeg)
```

---

## 3. Project Structure

**חשוב: הפרויקט הפעיל נמצא ב־`hackathon/`. תיקיית השורש `ATAPIS/` מכילה שאריות (עותקי מודלים ו־data שנוצרו מהרצה עם CWD שגוי).**

```
ATAPIS/
├── .venv/                      ← venv שבור (אין Flask/pyserial) — לא להשתמש!
├── yolov8n.pt, yolov8m.pt, yolov8n-pose.pt, data/  ← שאריות CWD שגוי
└── hackathon/                  ← הפרויקט האמיתי
```

| קובץ | תפקיד | מי מייבא / תלוי בו | סטטוס |
|---|---|---|---|
| `hackathon/python/server.py` | **נקודת הכניסה.** Flask, MJPEG streams, סטטוסים, Arduino, users, scenario jobs | run-dev.ps1 מריץ אותו; מייבא analysis, camera_sources, ld2450_reader | פעיל |
| `hackathon/python/analysis.py` | מנוע YOLO + Tracking + Behavior + Risk + Fusion | server.py, scenario_video_analysis.py | פעיל |
| `hackathon/python/camera_sources.py` | קורא RTSP ב־thread, טעינת .env, sanitization של secrets | server.py | פעיל |
| `hackathon/python/ld2450_reader.py` | קורא הרדאר האמיתי (Serial, thread, פענוח, סינון) + fallback ל־mock | server.py, analysis.py | פעיל |
| `hackathon/python/radar_simulator.py` | סימולטור 7 תרחישים (idle, approaching_gate, running_to_gate...) | ld2450_reader.py (רק כש־RADAR_USE_MOCK=true) | פעיל כ־fallback |
| `hackathon/python/scenario_video_analysis.py` | ניתוח וידאו שהועלה, רץ כ־subprocess + ffmpeg transcode | server.py (subprocess) | פעיל |
| `hackathon/python/radar_config.json` | הגדרות רדאר (פורט, baud, mock, ספים) — נדרס ע"י env | ld2450_reader.py | פעיל |
| `hackathon/python/requirements.txt` | תלויות Python | — | פעיל |
| `hackathon/python/server2.py` | גרסה פרימיטיבית ישנה של השרת | אף אחד | **legacy — לא בשימוש** |
| `hackathon/python/pose_motion_demo.py`, `test_video.py` | סקריפטי ניסוי | אף אחד | דמו/ניסוי |
| `hackathon/python/templates/index.html`, `response_lan.html`, `video.bin` | שאריות | — | legacy |
| `hackathon/python/venv/` | venv שלישי — **חסר huggingface_hub** | — | לא להשתמש |
| `hackathon/python/dist/` | build של ה־Frontend ש־Flask מגיש בפורט 5000 | server.py | פעיל |
| `hackathon/python/yolov8n.pt` | מודל זיהוי אנשים | analysis.py (נתיב יחסי ל־CWD!) | פעיל |
| `hackathon/python/yolov8n-pose.pt` | מודל pose | רק pose_motion_demo.py | דמו |
| `hackathon/src/pages/CameraRoom.jsx` | עמוד הדשבורד הראשי (1,291 שורות): streams, radar map, risk, upload | App.jsx (route `/camera/:roomId`) | פעיל |
| `hackathon/src/pages/CameraRoom.css` | עיצוב הדשבורד, כולל תיקוני responsive | CameraRoom.jsx | פעיל |
| `hackathon/src/App.jsx` + `src/pages/*` | routing, login, admin, history, settings | main.jsx | פעיל |
| `hackathon/security/security.ino` | ESP32/Arduino: חיישן מרחק אולטרסוני + זמזם/LED לפקודת ALERT. **לא קורא LD2450!** | השרת מדבר איתו ב־Serial 9600 | פעיל [דורש אימות חומרה] |
| `hackathon/run-dev.ps1` | הפעלת Backend+Frontend לפיתוח + health checks | — | פעיל, הדרך הרשמית |
| `hackathon/run-prod.ps1`, `start-server.bat/.sh`, `setup-new-machine.ps1` | סקריפטי הרצה/התקנה נוספים | — | [דורש אימות] |
| `hackathon/.env` | secrets: פרטי Dahua + הגדרות LD2450 | camera_sources.load_env_file, ld2450_reader | פעיל, מוחרג מ־git |
| `hackathon/.env.example` | תבנית env (מכיל IP אמיתי של המצלמה — לנקות בהזדמנות) | — | פעיל |
| `hackathon/.venv/` | **ה־venv הנכון והשלם** | run-dev.ps1 | פעיל ★ |
| `weapon_best.pt` | מודל נשק | analysis.py מחפש אותו | **לא קיים** — נטען מ־HF cache |

---

## 4. How to Run the Project

**נתיב הפרויקט הנוכחי (מחשב SADAB, אומת 2026-07-20):** `C:\Users\SADAB\Desktop\ATAPIS`

**הדרך הרשמית והמאומתת (פיתוח):**

```powershell
cd C:\Users\SADAB\Desktop\ATAPIS\hackathon
.\run-dev.ps1            # Backend על :5000 + Vite על :5173, עם health checks
# .\run-dev.ps1 -OpenBrowser   # גם פותח דפדפן
```

**הרצה ידנית של ה־Backend בלבד:**

```powershell
# חובה: ה-venv של hackathon + CWD בתוך python/ (נתיבים יחסיים תלויים בזה!)
cd C:\Users\SADAB\Desktop\ATAPIS\hackathon\python
..\.venv\Scripts\python.exe server.py
```

**Frontend בלבד:**

```powershell
cd C:\Users\SADAB\Desktop\ATAPIS\hackathon
npm run dev              # Vite dev server על http://localhost:5173
```

### Dev מול Production — ההבדל ותהליך סנכרון ה־dist

| | Dev | Production |
|---|---|---|
| פקודה | `.\run-dev.ps1` | `.\run-prod.ps1` |
| מי מגיש את ה־UI | Vite על **:5173** (HMR, מהקוד ב־`src/`) | Flask על **:5000** מתוך `python/dist/` |
| מתי ה־UI מתעדכן | מיידית עם כל שמירה | רק אחרי build+סנכרון |
| Backend | Flask :5000 בשני המצבים | |

**סנכרון dist (השאלה הפתוחה נסגרה 2026-07-20):** `run-prod.ps1` הוא המנגנון הרשמי והיחיד — הוא מריץ `npm run build` (יוצר `hackathon/dist/`), מוחק את `hackathon/python/dist/`, מעתיק `dist → python/dist`, ואז מפעיל את השרת. **אין סנכרון אוטומטי:** עריכת קוד ב־`src/` לא משנה את מה ש־Flask מגיש עד ריצת `run-prod.ps1`. זה בדיוק מה שגרם לכך שעד 2026-07-20 פורט 5000 הגיש build מ־21/06 בלי הקונספטים ובלי חיווי C1.
**כלל:** לעולם לא לבנות/להעתיק ידנית במסלול אחר — כדי לא ליצור שוב פער בין `dist` ל־`python/dist`.

**מעבר Simulator ↔ Real Radar** (שני מקומות, env גובר):

```
hackathon/.env:                RADAR_USE_MOCK=true|false
hackathon/python/radar_config.json:  "RADAR_USE_MOCK": true|false
# או בזמן ריצה: PUT /api/radar-config  (אבל env ימשיך לדרוס אחרי restart!)
```

**בדיקת מצלמת RTSP (השרת חייב לרוץ):**

```powershell
curl http://127.0.0.1:5000/api/cameras/dahua/test     # פותח RTSP וקורא פריים אחד
curl http://127.0.0.1:5000/api/cameras/status
```

**בדיקת רדאר:**

```powershell
curl http://127.0.0.1:5000/api/radar/live             # payload חי כולל last_error
```

בדיקת רדאר עצמאית ללא השרת — אין סקריפט כזה בריפו כרגע. **[דורש אימות — סקריפט הבדיקה ההיסטורי לא נמצא בפרויקט]**

**עצירה תקינה:** סגירת חלונות ה־PowerShell ש־run-dev.ps1 פתח, או `Ctrl+C` בהרצה ידנית. ה־threads הם daemon וה־Serial נסגר ב־`_close_serial`. אין endpoint ייעודי ל־shutdown.

**כניסה ל־UI לבדיקות:** משתמש `admin` (הסיסמה בקובץ `data/users.json` — לא לכתוב אותה כאן). עמוד הדשבורד: `/camera/1`.

---

## 5. Environment and Dependencies

- **Python:** ‏3.10.1 במחשב הנוכחי (`C:\Users\SADAB\AppData\Local\Programs\Python\Python310`). ה־venv נוצר במקור על 3.10.10 — אותו ABI‏ (cp310), כל החבילות תקינות.
- **תיקון המעבר (2026-07-13):** ה־venv הועתק מהמחשב הישן ו־`pyvenv.cfg` הצביע על `C:\Users\user\...` ולכן `python.exe` לא רץ כלל. תוקן ע"י עדכון שורת `home =` בלבד. **אין ליצור venv חדש ואין "לתקן" שוב את pyvenv.cfg.**
- **סביבות virtualenv — יש שלוש, רק אחת תקינה:**

| venv | מצב |
|---|---|
| `hackathon/.venv` | ★ השלמה והעובדת היחידה — Flask 3.1.2, flask-cors, pyserial 3.5, huggingface_hub 1.6.0, ultralytics 8.3.239, opencv 4.12, torch 2.9.1+cpu. אומת בריצה 2026-07-20 |
| `hackathon/python/venv` | חסר huggingface_hub → מודל נשק ייכשל → אפס זיהויים |
| `ATAPIS/.venv` (root) | חסרים Flask/pyserial → השרת לא עולה בכלל |

- **Backend framework:** Flask + flask-cors. **Frontend:** React 19 + Vite 7 + react-router-dom.
- **קובץ תלויות:** `hackathon/python/requirements.txt` (flask, opencv-python, ultralytics, flask-cors, numpy, pyserial, huggingface-hub — ללא נעילת גרסאות).
- **מודלים נדרשים:** `yolov8n.pt` (קיים ב־`python/`), מודל נשק (מ־HF cache: `Subh775/Threat-Detection-YOLOv8n`, קובץ `weights/best.pt`).
- **ffmpeg** נדרש ב־PATH לניתוח וידאו שהועלה (transcode ל־H.264). **מותקן ואומת 2026-07-20:** FFmpeg 8.1.2 (Gyan build) דרך `winget install --id Gyan.FFmpeg`, ב־`%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_...\ffmpeg-8.1.2-full_build\bin`, נוסף ל־User PATH. נבדק transcode מלא מול `scenario_video_analysis.py`. ‏(שים לב: טרמינל שנפתח לפני ההתקנה לא יראה אותו — צריך חלון חדש.)
- **משתני סביבה** (ב־`hackathon/.env`, שמות בלבד — בלי ערכים):

```
DAHUA_HOST, DAHUA_PORT, DAHUA_USERNAME, DAHUA_PASSWORD, DAHUA_CHANNEL, DAHUA_SUBTYPE
LD2450_PORT, LD2450_BAUD, LD2450_ENABLED, RADAR_USE_MOCK
ARDUINO_PORT   ← אופציונלי, נוסף 2026-07-20 (ראה פרק 6)
```

---

## 6. Hardware Components

| רכיב | פרטים מאומתים | הערות |
|---|---|---|
| מצלמת Dahua | RTSP פורט 554, channel 1, **subtype 1 (סאב־סטרים!)** | רזולוציית הסאב־סטרים **[דורש אימות]** — טיפוסית 704×480. משפיע על כיול גדר/שער (פרק 9) |
| רדאר HLK-LD2450 | 24GHz, עד 3 מטרות, מסגרת בינארית `AA FF 03 00 ... 55 CC`, 8 bytes למטרה, signed-15bit | baud מקורי של הרכיב: 256000. **נבדק בהצלחה 2026-07-29 — ראה להלן** |
| מתאם USB-to-TTL | בלוגים ההיסטוריים (2026-07-20) הופיע צ'יפ **CH343** על **COM14**. **בבדיקה של 2026-07-29 שימש מתאם CH340 על COM9** | מספר ה־COM וסוג הצ'יפ משתנים בין חיבורים ובין מתאמים |
| ESP32-S3 N16R8 | קיים בפרויקט לפי התיעוד; בריפו יש רק את `security.ino` (זמזם+LED+חיישן מרחק, Serial 9600) | **אין קוד ESP32 ל־LD2450 בריפו.** לאחר בדיקת 2026-07-29 ידוע שחיבור ישיר עובד; האם הטופולוגיה הסופית תהיה ישירה או דרך ESP32 — **[דורש הכרעה]** |
| Baud Rate רדאר | הקונפיגורציה של המערכת מוגדרת כרגע **115200** (.env + radar_config.json); ברירת המחדל בקוד וב־.env.example היא **256000**. **הבדיקה העצמאית של 2026-07-29 עבדה ב־256000** | ⚠️ ראה Known Issues C3 — אין לשנות את הקונפיגורציה בלי אישור |
| חיווט TX/RX/GND, מתחים | תועד ליחידה שנבדקה — ראה טבלת הצבעים למטה | ✅ ליחידה הספציפית בלבד |

### ✅ אימות חומרה — LD2450 בחיבור ישיר (2026-07-29)

**מה אומת בפועל:**
- ה־LD2450 חובר **ישירות** למתאם **CH340 USB-TTL** (ללא ESP32 באמצע) ונקרא בהצלחה.
- החיבור שנבדק: **COM9 בקצב 256000 baud**.
- התקבלו **מסגרות בינאריות אמיתיות** מהחיישן, ומהן פוענחו מטרות עם **X / Y / distance / angle / speed**.
- מסקנה: **טופולוגיית החיבור הישיר ל־USB-TTL מאומתת**, ופורמט המסגרות תואם את מה שהקוד מצפה לו.

**מה עדיין לא אומת:**
- ⚠️ **שילוב הרדאר האמיתי בתוך אפליקציית Flask עדיין דורש אימות.** הבדיקה הייתה עצמאית (standalone), לא דרך `ld2450_reader.py` בתוך השרת הרץ.
- הערך **115200** עשוי להיות רלוונטי **רק לטופולוגיית ESP32 bridge** — הוא **לא** היה הקצב של החיבור הישיר שנבדק בהצלחה.

**⚠️ אין לשנות `.env`, מספר COM או Baud של המערכת ללא אישור מפורש של המשתמש.** הבדיקה מוכיחה שהחיבור הישיר עובד ב־256000, אך היא **אינה** אישור אוטומטי לשנות את הקונפיגורציה הפעילה.

#### צבעי חיווט — ליחידת הרדאר הספציפית שנבדקה

| פונקציה | צבע חוט |
|---|---|
| GND | צהוב |
| TX | לבן |
| RX | אדום |
| 5V | שחור |

> ⚠️ **אלה צבעי היחידה המסוימת של המשתמש שנבדקה ב־2026-07-29 — ולא תקן אוניברסלי ל־LD2450.**
> יחידות אחרות (ואפילו אותה יחידה עם מקטע כבל אחר) עשויות להשתמש בצבעים שונים לגמרי.
> הצבעים כאן חורגים מהמוסכמה הנפוצה (שחור=GND, אדום=מתח), ולכן **חובה לאמת מול היחידה עצמה לפני כל חיבור** ולא להסתמך על הטבלה הזו ליחידה אחרת.

### ⚠️ ARDUINO_PORT מול LD2450_PORT — הפרדה מחייבת (נקבע 2026-07-20)

| | `LD2450_PORT` | `ARDUINO_PORT` |
|---|---|---|
| שייך ל | **רדאר** LD2450 דרך מתאם USB-TTL **CH343** | ESP32/Arduino של הזמזם+LED (`security.ino`) |
| ערך נוכחי | COM14 (ב־.env) | לא מוגדר — אין לוח מחובר |
| Baud | 115200 (ראה C3) | 9600 |

**כללים מחייבים בקוד:**
- **ה־CH343 שייך לרדאר.** אסור לזהות אותו כ־Arduino — הוא מופיע ב־`ARDUINO_DESCRIPTION_BLOCKLIST` ב־server.py, ולא ב־hints.
- פורט שמוגדר כ־`LD2450_PORT` (או ב־radar_config.json) **לעולם** לא ייבחר כ־Arduino, גם אם הוגדר במפורש ב־`ARDUINO_PORT`.
- Arduino נבחר **רק** אם `ARDUINO_PORT` הוגדר במפורש, **או** אם זוהה תיאור התקן חד־משמעי (arduino/ch340/ch341/esp32/cp210) שאינו CH343.
- **אין סריקה עיוורת** של COM3–COM7 (זו הייתה הסיבה שהשרת "מצא Arduino" על Intel AMT SOL).
- ‏`Intel AMT / SOL` ו־Bluetooth חסומים מפורשות.
- `ARDUINO_PORT=none` מכבה את הזיהוי לגמרי.
- אין Arduino מזוהה → `arduino=None`, הודעה חד־פעמית, השרת ממשיך לרוץ.

**תקלות חיבור נפוצות:**
- `PermissionError / Access denied` — הפורט תפוס (Serial Monitor של Arduino IDE או סקריפט בדיקה). מאז תיקון H2 השרת עצמו כבר לא תופס פורטים זרים.
- baud שגוי → הפורט נפתח "בהצלחה" אבל אף מסגרת לא מפוענחת → radar_connected=false לנצח.
- מספר COM משתנה אחרי ניתוק/חיבור — לעדכן ב־.env.
- ב־2026-07-10 לא היה אף פורט COM מחובר למחשב (נבדק).

---

## 7. Camera Pipeline

- **פתיחת RTSP:** `camera_sources.py :: _open_rtsp_capture` — URL נבנה מ־env, ניסיון CAP_FFMPEG עם `rtsp_transport;tcp` ו־timeouts של 5 שניות, ואז backend ברירת מחדל.
- **קריאת פריימים:** `LatestFrameRTSPReader._reader_loop` — thread ייעודי, שומר תמיד רק את הפריים האחרון (מונע lag), reconnect כל 3 שניות.
- **הפעלת YOLO:** `server.py :: gen_frames()` קורא `analysis.py :: analyze_frame_for_source` על כל פריים שנמשך. ה־inference בפועל ב־`_analyze_frame_with_context`.
- **Tracking:** `_associate_tracks` (analysis.py) — ציון 0.7·IoU + 0.3·קרבת מרכזים, סף 0.30.
- **ציור Boxes:** בתוך `_analyze_frame_with_context` על עותק הפריים — אדם במלבן ירוק + `ID:n person`, נשק במלבן אדום + `WEAPON`.
- **הגעה ל־Dashboard:** JPEG → MJPEG ב־`/video_feed/webcam` ו־`/video_feed/dahua` → תגי `<img>` ב־CameraRoom.jsx.
- **נקי או מנותח:** מוצג הפריים **המנותח**. ⚠️ חריג: אם `analyze_frame_for_source` זורק חריגה, ה־except ב־gen_frames מציג את הפריים **הנקי** וממשיך לשדר — השגיאה מופיעה רק ב־`/api/cameras/status` (שדה `last_error`) ובטרמינל. מאז תיקון C1 (2026-07-10) כשל **מודל הנשק** כבר אינו מגיע למסלול הזה — הוא מטופל בתוך analysis.py וזיהוי האנשים ממשיך.
- **סטטוס מודל נשק:** הסטטוס המוחזר מ־analysis כולל `weapon_detection_available` (bool) ו־`weapon_detection_status` (`"ok"` / `"model_load_failed"`; ב־server ברירת מחדל `"unknown"` עד הניתוח הראשון). פרטי החריגה המלאים נשארים בלוג השרת בלבד. ה־UI מציג "Unavailable" במדד Weapon כשהמודל לא זמין.
- **Thresholds:** `PERSON_CONF = 0.50`, `WEAPON_CONF = 0.40` (analysis.py).
- **רזולוציית עבודה:** הפריים מנותח ברזולוציה המקורית של המקור (אין resize בזרם החי). רזולוציית ה־Dahua בפועל **[דורש אימות]**. בניתוח וידאו שהועלה יש הקטנה ל־960px רוחב ו־frame skip 2.
- **ניתוק מצלמה:** מוצג placeholder ("CAMERA UNAVAILABLE" / "DAHUA RTSP CAMERA UNAVAILABLE") + reconnect אוטומטי; `reset_analysis_context(source)` מאפס את ה־tracks.
- ⚠️ כל לקוח HTTP שפותח את הזרם מקבל generator עצמאי → שני צופים = ניתוח כפול של אותו מקור (ראה H4).

## 8. Radar Pipeline

- **פתיחת COM:** `ld2450_reader.py :: _ensure_serial_open` — non-blocking (`timeout=0`).
- **קביעת הפורט:** `LD2450_PORT` — env גובר על `radar_config.json` (דרך `merge_radar_config`). בקונפיגורציה: COM14. (בבדיקה העצמאית של 2026-07-29 שימש COM9 — ראה פרק 6.)
- **Baud:** `LD2450_BAUD` — בקונפיגורציה 115200; ברירת מחדל בקוד 256000; **החיבור הישיר אומת ב־256000** (2026-07-29). ⚠️ ראה C3 — אין לשנות בלי אישור.
- **קריאת Bytes:** `_reader_loop` ב־thread daemon בשם `ld2450_reader` — עד 1024 bytes לקריאה, buffer מצטבר.
- **פענוח:** שני מסלולים —
  - **בינארי:** `_extract_binary_targets` / `_parse_binary_frame` — header `AA FF 03 00`, footer `55 CC`, 3 מטרות × 8 bytes, פענוח signed-15bit (`_decode_signed_15bit`).
  - **JSON:** `_extract_json_payload` — שורות שמתחילות ב־`{` עם מערך `targets` (מתאים ל־ESP32 שמשדר JSON).
- **שדות מוחזרים לכל מטרה:** `id/radar_id, x_mm, y_mm, distance_mm, angle_deg, speed_cm_s, speed_mm_s, resolution_mm, direction (approaching/receding/stationary), approaching_gate, confidence, radar_risk, timestamp, valid`.
- **מסננים בפועל** (`_is_reasonable_target`, ערכים מ־merge_radar_config):

```
min_distance_mm = 80        (לא 150 — הערך ההיסטורי מסקריפט הבדיקה הישן)
max_distance_mm = 10000     (לא 6000)
max_speed_cm_s  = 1200      (לא 700)
max_lateral_mm  = 6000, max_forward_mm = 10000
אין סינון זווית מפורש (MAX_ANGLE_DEG לא קיים בקוד הפעיל; זווית ≤45° משמשת רק לחישוב risk)
```

- **לשרת ול־Dashboard:** payload singleton → `get_live_radar_payload()` → endpoint `/api/radar/live` (polling כל שנייה) + מוזרק ל־`analyze_frame` כ־`radar_targets` לצורך fusion.
- **Radar Map:** ב־CameraRoom.jsx — DIVים ממוקמים באחוזים (`getRadarMapPosition`), טווח תצוגה ±3m לרוחב × 8m לעומק. לא Canvas.
- **אמיתי או מדומה:** נקבע ע"י `RADAR_USE_MOCK` (כרגע false = אמיתי). ה־payload כולל שדה `provider` ("ld2450" / "mock") ו־`radar_status` ("OK" / "MOCK" / "DISCONNECTED" / "DISABLED" / "ERROR") — כך אפשר לדעת תמיד מה המקור.
- **מעבר Simulator↔Real:** שינוי הדגל ב־.env/config; ה־provider מזהה שינוי config לפי mtime ומתחבר מחדש בלי restart.

## 9. Behavior and Risk Engine

הכול ב־`analysis.py`, פרופיל פעיל: `PROFILE = "perimeter"`.

**סיווג תנועה** (מהירות בפיקסלים/שנייה על חלון של 1.0s):
- `standing` < 15 ; `walking` 15–120 ; `running` ≥ 120 (`STAND_THRESHOLD`, `RUN_THRESHOLD`).

**מצבים:** `detected, running, loitering, gate_loitering, approaching, armed`.
- `approaching_gate`: dot(heading, כיוון־לשער) > 0.70 וגם מהירות > 40 (`APPROACH_SPEED_THRESHOLD`).
- `loitering`: באזור גדר מעל 15 שניות (`LOITER_TIME_THRESHOLD`); בשער מעל 7.5 שניות.
- `armed`: נשק שויך ל־Track (מרכז הנשק בתוך תיבת האדם או IoU > 0.15), נדרשים **2 פריימים** לאישור (`WEAPON_CONFIRM_FRAMES`), פג אחרי 3 שניות (`WEAPON_TIMEOUT`).

**תוספות חד־פעמיות במעבר מצב** (`_apply_state_risk`):
- running: **+8** ; approaching: **+15**.
- ⚠️ `loiter_risk: 20` מוגדר בקונפיג אך **לא מיושם בשום מקום בקוד** — loitering צובר סיכון רק דרך הקצב לשנייה.

**צבירה רציפה (לשנייה, `_update_risk`):**
- אזור גדר: +3.0 ; אזור שער: +4.5 ; loitering בגדר: +1.5 נוסף ; loitering בשער: +2.5 נוסף.
- נשק: רצפת סיכון **85** (`weapon_floor_risk`) + **25/ש'** ; נשק+approaching: **+40/ש'** נוסף.
- sensor boost (hook ל־MCU: distance/PIR/tamper) — קיים בקוד אך לא מוזן כיום.

**Risk Decay:** `risk *= 0.85^dt` (`RISK_DECAY_PER_SECOND`) — אבל בהקשר חשוד (גדר/שער/נשק/approaching) המקדם הוא 1.0 = **אין דעיכה**.

**ספים גלובליים:** ALERT ≥ **40**, DANGER ≥ **75** (`GLOBAL_ALERT_THRESHOLD`, `GLOBAL_DANGER_THRESHOLD`). המצב נקבע לפי `fused_risk`.

**Fusion** (`combine_camera_risk_and_radar_risk`): רדאר משוקלל לפי confidence (0.30+0.70·conf); מצלמה≥75 + רדאר≥45 → מינימום 90; מצלמה≥40 + רדאר≥25 → מינימום 60; מצלמה<40 + רדאר≥60 → מינימום 42+0.35·רדאר; אחרת max(camera, 0.8·camera+0.65·radar).

**radar_risk לכל מטרה** (`_compute_radar_risk`): מרחק ≤2000מ"מ +24; זווית≤45° ומרחק≤3000 +18; מהירות≥60 סמ"ש +16; ≥120 +22; מתקרב +14; ≤1500מ"מ +10; resolution≥250 +6.

**⚠️ ערכים תלויי רזולוציה — מכוילים ל־1920×1080:**
```
FENCE_LINE_Y = 600
GATE_POINT   = (960, 1080)
FENCE_BAND_PX = 120, NEAR_GATE_RADIUS_PX = 240
```
ה־Dahua מוגדרת על subtype=1 (סאב־סטרים, כנראה ~704×480) → GATE_POINT מחוץ לפריים → `approaching_gate` ו־`near_gate` לא יופעלו לעולם על ה־Dahua עד כיול מחדש. **אין לשנות ערכים אלה בלי לדעת את הרזולוציה בפועל.**

---

## 10. What Currently Works

> **מצב החומרה — עודכן 2026-07-29.**
> **ב־2026-07-20 נמצא:** אין מצלמת USB, אין רדאר, אין USB-TTL, אין ESP32; פורט ה־COM היחיד היה COM3 = Intel AMT SOL (וירטואלי). ה־Dahua לא הייתה נגישה מהרשת (ping ו־port 554 נכשלו).
> **ב־2026-07-29 המצב השתנה חלקית:** ה־LD2450 **כן** חובר ונבדק בהצלחה — ישירות למתאם CH340 על COM9 ב־256000 baud, עם מסגרות בינאריות אמיתיות שפוענחו למטרות (ראה פרק 6). **הבדיקה הייתה עצמאית, מחוץ לאפליקציה** — אין עדיין אימות של הרדאר בתוך Flask.
> יתר רכיבי החומרה (מצלמת USB, ESP32/Arduino, נגישות ה־Dahua) לא נבדקו מחדש ונשארים במצב של 2026-07-20.

| רכיב | סטטוס | הערות |
|---|---|---|
| Backend (Flask) | ✅ אומת במחשב זה (2026-07-20) | עולה נקי דרך run-dev ו־run-prod; 34/34 בדיקות smoke עברו |
| Frontend build + production | ✅ אומת במחשב זה (2026-07-20) | `npm run build` ירוק; Flask :5000 מגיש dist עדכני |
| Dashboard (React) | עובד | polling 1s, שני פאנלי מצלמה, radar map, upload, history |
| Design Lab + 5 Concepts | ✅ נטענים ב־production | ראה פרק 19 |
| RTSP Stream (Dahua) | ⚠️ דורש אימות חומרה/רשת | הקוד תקין ו־reconnect פועל; המצלמה לא נגישה מהמחשב הזה |
| Person Detection | ⚠️ לא ניתן לאמת במחשב זה | אומת 2026-07-10 עם webcam חיה במחשב הקודם. כאן **אין מצלמה כלל** — ממתין לחיבור |
| Weapon Detection | ❌ המודל חסר במחשב זה | אין `weapon_best.pt` מקומי **ואין HF cache** (`~\.cache\huggingface` לא קיים). תיקון C1 מבטיח שזיהוי אנשים ימשיך; המדד יציג "Unavailable". המשתמש יעתיק את המודל מהמחשב הישן |
| Tracking + Track IDs | עובד | |
| Behavior Analysis | עובד חלקית | כיול גדר/שער שגוי לרזולוציית Dahua (H1); loiter_risk לא מיושם |
| Risk Engine + SAFE/ALERT/DANGER | עובד | |
| Radar Simulator | עובד | 7 תרחישים, מופעל רק עם RADAR_USE_MOCK=true |
| Real Radar Serial Input | ⚠️ **אומת בבדיקה עצמאית (2026-07-29); אינטגרציה מלאה באפליקציה עדיין דורשת אימות** | קריאה ישירה מ־USB-TTL (CH340, COM9, 256000) הצליחה והחזירה מסגרות אמיתיות. **טרם נבדק דרך `ld2450_reader.py` בתוך Flask הרץ** |
| LD2450 Parser | ✅ **אומת מול מסגרות בינאריות אמיתיות (2026-07-29)** | פוענחו מטרות עם X/Y/distance/angle/speed מהחיישן הפיזי |
| Sensor Fusion | עובד חלקית | סקלרי בלבד; אין שיוך מרחבי (H3) |
| Radar Map | עובד | מוצג נכון מ־payload; תוכן אמיתי תלוי ברדאר |
| Video Upload Analysis | ✅ מסלול ה־transcode אומת (2026-07-20) | ffmpeg 8.1.2 מותקן; `_transcode_to_browser_format` נבדק על קליפ סינתטי והפיק mp4 קריא |
| Responsive Layout | עובד חלקית | תוקן בקוד ברובו (overflow/height/media queries) — דורש אימות ויזואלי ב־100% zoom |
| Arduino זמזם/ALERT | דורש אימות חומרה | אין לוח מחובר. מאז תיקון H2 (2026-07-20) השרת מדווח "Arduino disconnected" ואינו תופס פורטים זרים |

---

## 11. Known Issues

### Critical

**C1 — כשל מודל נשק משתיק את כל הזיהוי (כולל אנשים) בלי חיווי ב־UI — ✅ Resolved (2026-07-10)**
- היה: `_init_models` טען את שני המודלים ללא הפרדה; כשל נשק הפיל את `analyze_frame` כל פריים; `gen_frames` שידר פריים נקי בשקט.
- התיקון: טעינה מופרדת תחת `_models_init_lock`; מודל נשק מנוסה פעם אחת לכל תהליך; בכשל — אזהרה חד־פעמית ללוג השרת בלבד, `weapon_detection_available: false` + `weapon_detection_status: "model_load_failed"` בסטטוס (בלי פרטי חריגה פנימיים), inference נשק מדולג, וה־UI מציג "Unavailable". כשל מודל האנשים נותר פטלי במכוון.
- אומת בזמן ריצה (2026-07-10): שרת אמיתי + webcam חיה עם כשל נשק מדומה — `has_person: true` תוך `weapon_detection_available: false`; ניסיון טעינה אחד בלבד על פני פריימים מרובים. ה־Dahua משתמשת באותו מסלול קוד (לא אומתה חיה בנפרד).
- קבצים ששונו: `analysis.py`, `server.py`, `CameraRoom.jsx` (6 שורות ב־server, ~2 ב־JSX).

**C2 — שלוש סביבות venv, רק `hackathon/.venv` שלמה**
- השפעה: קריסת שרת (root venv) או אובדן מודל נשק (python/venv) לפי הסביבה שנבחרה.
- פתרון: לתקנן על `hackathon/.venv`; מחיקת האחרות רק באישור.
- סטטוס: פתוח.

**C3 — סתירת Baud: הקונפיגורציה מוגדרת 115200, החיבור הישיר אומת ב־256000 — ⚠️ פתוח, אך כבר לא שאלה תיאורטית**
- קבצים: `.env`, `radar_config.json` (115200) מול `.env.example` וברירת המחדל בקוד (256000).
- **עודכן 2026-07-29 — מה שכבר ידוע בוודאות:**
  - **חיבור ישיר של LD2450 ל־USB-TTL אומת ב־256000** (CH340, COM9, מסגרות בינאריות אמיתיות שפוענחו). זו כבר לא השערה.
  - **115200 נשאר אפשרי רק לטופולוגיית bridge/controller** (למשל ESP32 שמשדר JSON) — הוא לא היה הקצב של החיבור הישיר שעבד.
- **מה שעדיין חסום:** אין הכרעה איזו טופולוגיה תהיה הפעילה במערכת המורכבת, ואין עדיין אימות של הרדאר בתוך Flask.
- **⚠️ אין לשנות את הקונפיגורציה הפעילה (`.env` / `radar_config.json`) עד שהטופולוגיה הפעילה תיקבע ותאושר במפורש.** העובדה שהחיבור הישיר עובד ב־256000 אינה, כשלעצמה, אישור לשנות את ההגדרות.
- סטטוס: פתוח — **[דורש הכרעת טופולוגיה + אישור משתמש]**.

**C4 — Secrets בלוגים ובקבצים — ✅ חלקית Resolved (2026-07-20)**
- **תוקן — דליפת credentials ללוגים:** נוסף `install_stderr_credential_filter` ב־`camera_sources.py`, מותקן ב־`server.py` לפני פתיחת מצלמה כלשהי. הוא מחליף את fd 2 בצינור ומסנן כל שורה לפני שהיא מגיעה ל־stderr האמיתי — כך נתפסות גם כתיבות native של OpenCV/FFmpeg שלא עוברות דרך Python logging. שום הודעה אינה מושתקת; רק ה־credentials מוחלפים. בנוסף `sanitize_rtsp_url` מסתיר כעת את כל ה־userinfo (`rtsp://[REDACTED]@host`) ולא רק את הסיסמה.
- **תוקן — לוגים ישנים:** שני הלוגים שהכילו URL מלא נוקו. נוצרו גרסאות מסוננות ומצומצמות ב־`logs/redacted/` (‏194MB → 38KB), והגלמיים נמחקו. סריקה חוזרת של הפרויקט, הגיבויים וה־scratchpad: 0 מופעים לא מסוננים.
- **תוקן — .gitignore:** נוספו `run-logs/`, ‏`**/data/users.json`, ‏`**/data/monitoring.json`, ‏`**/data/images/`, ‏`python/outputs/` — ספציפי בכוונה, כדי לא להסתיר templates/seeds עתידיים תחת data/.
- **נותר פתוח:** `data/users.json` מכיל סיסמאות plaintext; סיסמת אדמין ברירת מחדל קשיחה ב־server.py; `.env.example` מכיל IP אמיתי.
- **פרטי ההתחברות למצלמה נשארו ללא שינוי לפי בקשת המשתמש** — הטיפול היה במניעת חשיפה בלבד. אין לשנות/להעביר/להחליף אותם.

### High

**H1 — כיול גדר/שער ל־1920×1080 בעוד ה־Dahua על סאב־סטרים** — `analysis.py:31-32`. approaching/near_gate לא יופעלו על ה־Dahua. פתרון: כיול יחסי לרזולוציה. פתוח.

**H2 — `init_arduino` עלול לתפוס את פורט הרדאר — ✅ Resolved (2026-07-20)**
- היה: סריקה עיוורת של COM3–COM7 בפתיחת פורט בפועל. במחשב הנוכחי היא תפסה את **COM3 = Intel AMT SOL** והכריזה "Arduino connected" — false positive מלא.
- התיקון (`server.py`): ‏`_select_arduino_port()` חדש — ‏`ARDUINO_PORT` מפורש (כולל `none` לכיבוי), החרגת `LD2450_PORT`/`RADAR_PORT` ו־`radar_config.json`, blocklist ל־CH343/AMT-SOL/Bluetooth, **ביטול מוחלט של הסריקה העיוורת**, וכשל שתמיד מותיר `arduino=None` עם הודעה ברורה וחד־פעמית (`Arduino disconnected` / `port unavailable` / `access denied`).
- אומת ב־9 בדיקות: AMT COM3 לא נבחר; CH343 לא נבחר (גם כשאין LD2450_PORT מוגדר); `ARDUINO_PORT` על פורט הרדאר נדחה; CP210 אמיתי עדיין מזוהה; אין קריסה ללא חומרה; ובריצה חיה COM3 נשאר חופשי.

**H3 — Sensor Fusion סקלרי בלבד** — אין שיוך מטרת רדאר ל־Track מצלמה, אין התאמת קואורדינטות. פונקציונלי ל־MVP; לתאם ציפיות. פתוח.

**H4 — כל צופה בזרם מפעיל ניתוח כפול** — `gen_frames` הוא generator פר־בקשה על אותו source_context; שני טאבים = YOLO כפול + עיוות tracking. פתרון עתידי: thread ניתוח יחיד פר־מקור. פתוח.

### Medium

**M1 — נתיבים יחסיים תלויי CWD** (`data`, `yolov8n.pt`, `weapon_best.pt`) — כבר גרם לשכפול קבצים ב־3 מקומות. פתרון: עיגון ל־`__file__`.
**M2 — `API_BASE_URL` קשיח `http://localhost:5000`** ב־CameraRoom.jsx — אין גישה ממחשבים אחרים ברשת.
**M3 — קוד מת:** server2.py, `_legacy_gen_frames`, פאנל `{false && ...}`, templates/. לא למחוק בלי אישור.
**M4 — מודל הנשק תלוי במטמון HF** — מחיקת המטמון תגרור ניסיון הורדה מהאינטרנט בעלייה. פתרון: העתקה מקומית ל־`python/weapon_best.pt` (מהמטמון, לא הורדה).
**M5 — env דורס בשקט את radar_config.json** — שינוי פורט מה־UI נשמר אך נדרס אחרי restart.

### Low

**L1 — Responsive Layout** — תוקן ברובו בקוד (overflow-y:visible, height:auto, 7 media queries; radar map ב־DIV אחוזים). נותר אימות ויזואלי ב־100% zoom.
**L2 —** requirements בלי נעילת גרסאות; שגיאות הרשאה של ultralytics settings בלוגים; קבצים שבורים (`annotated_out.mp4` בן 258B, `yolov8n.pt...partial`).

### Tooling

**T1 — אין Git במחשב, והפרויקט אינו Git repository (אומת 2026-07-29)**
- `git` אינו מותקן (הפקודה אינה מזוהה), ואין תיקיית `.git` בפרויקט.
- **המשמעות המעשית:** `git diff`, `git commit`, `git status` ו־rollback **אינם זמינים**. אין רשת ביטחון לשחזור אחרי שינוי שגוי, ואי אפשר להפיק `git diff --stat` לדוחות — במקומו יש לדווח רשימת קבצים משינוי בפועל (למשל לפי `LastWriteTime`).
- **כלל מחייב:** לפני שינוי רחב יש **ליצור ZIP backup** של התיקיות הרלוונטיות. התקנת Git היא אפשרות לגיטימית — אך **רק לאחר אישור מפורש של המשתמש** (התקנת תוכנה נופלת תחת פרק 14).
- סטטוס: פתוח (החלטת כלים, לא באג).

---

## 12. Current Development Priorities

> **עודכן 2026-07-20.** הושלמו: תיקנון סביבה (1), הפרדת מודל הנשק (3, ‏C1), סנכרון dist, הגנת פורט הרדאר ו־secrets בלוגים (9, ‏H2+C4), התקנת ffmpeg.
> **חוסם עיקרי כעת: אין חומרה מחוברת ואין קובץ מודל נשק במחשב הזה.** סעיפים 2, 4, 5, 6, 7 ממתינים לחיבור פיזי של מצלמה/רדאר.


1. תיקנון סביבה: `hackathon/.venv` בלבד; המערכת עולה נקי דרך run-dev.ps1. *(C2)*
2. אימות זיהוי אנשים חי מה־Dahua + חשיפת `last_error` של הניתוח ב־Dashboard. *(C1)*
3. הפרדת טעינת מודל הנשק ממודל האנשים (fault-tolerant) + עותק מקומי מהמטמון. *(C1, M4)*
4. חיבור הרדאר האמיתי: הכרעת baud (256000/115200), אימות מסגרות, עדכון config. *(C3)*
5. חיווי ברור ב־UI לאיזה מקור רדאר פעיל (provider כבר קיים ב־payload).
6. אימות נתוני רדאר חיים ב־Radar Map + תיקון API_BASE_URL לגישה מרחוק. *(M2)*
7. Fusion מרחבי ראשוני + כיול FENCE_LINE_Y/GATE_POINT יחסי לרזולוציה. *(H1, H3)*
8. אימות Responsive ב־100% zoom ותיקוני שאריות. *(L1)*
9. ניקוי Secrets מלוגים + הגנת פורט הרדאר מ־init_arduino + Health endpoint. *(C4, H2)*
10. הכנת דמו יציב לשופטים: תרחיש simulator מלוטש + וידאו מוקלט כגיבוי + מעבר חי לרדאר אמיתי.

---

## 13. Coding Rules

- לפני שינוי קוד — לקרוא את כל הקבצים הרלוונטיים בפועל, לא מהזיכרון.
- אין שכתוב רחב, מחיקת קוד, החלפת Framework או שינוי מבנה GUI ללא אישור מפורש.
- אין להוסיף dependency, להוריד מודל AI, או להתקין חבילות ללא הסבר ואישור.
- אין לשנות ערכי Risk (ספים, תוספות, decay) ללא אישור.
- אין לשנות `FENCE_LINE_Y` / `GATE_POINT` בלי לדעת את רזולוציית הזרם בפועל.
- אין לשנות כתובות מצלמה, פורטי COM או Baud Rate ללא אישור.
- אין למחוק את Radar Simulator — הוא מנגנון ההדגמה והגיבוי של ה־MVP.
- אין לחשוף Secrets בקוד, בלוגים, בתיעוד או בתשובות. להשתמש ב־`sanitize_error_message` הקיים.
- שינוי קטן וממוקד בכל פעם; להציג diff לפני שינוי משמעותי.
- אחרי כל שינוי — להריץ בדיקה ולהסביר למשתמש איך לוודא שהתיקון הצליח.
- לשמור תאימות לאחור; להעדיף תיקון מינימלי על refactor.
- להוסיף טיפול בשגיאות ו־Logging ברור בכל קוד חדש.
- בספק — לעצור ולשאול.

## 14. Forbidden Actions Without Approval

- `git reset`, `git clean`, מחיקת תיקיות או קבצים.
- מחיקת מודלים (.pt) או ה־HF cache.
- שינוי `data/users.json` או מבנה הנתונים.
- שינוי רחב בארכיטקטורה; החלפת Backend (Flask) או Frontend (React/Vite).
- החלפת מודל YOLO (yolov8n → אחר) או מודל הנשק.
- שינוי ערכי Risk, ספי ALERT/DANGER, פרופילים.
- שינוי פורט המצלמה / COM Port / Baud Rate / כתובות ב־.env.
- מעבר Real↔Simulator (שינוי `RADAR_USE_MOCK`).
- התקנת חבילות מערכת או פקודות Administrator.
- שינוי או העלאת Firmware ל־ESP32.
- חשיפת Secrets; פרסום קוד או מידע מחוץ לסביבה המקומית.

## 15. Testing Checklist (אחרי כל שינוי)

- [ ] `run-dev.ps1` עולה ללא שגיאה; Backend עונה על `http://127.0.0.1:5000/status`.
- [ ] Dashboard נפתח (5173 או 5000) והתחברות עובדת.
- [ ] `/video_feed/dahua` ו־`/video_feed/webcam` מציגים תמונה.
- [ ] Person Detection: Bounding Boxes + Track IDs מוצגים ויציבים.
- [ ] Risk Score ומצב SAFE/ALERT/DANGER מתעדכנים בתנועה.
- [ ] המערכת ממשיכה לזהות אנשים גם כשמודל הנשק לא זמין (אחרי תיקון C1) + מוצגת אזהרה.
- [ ] `GET /api/radar/live` — `radar_status` הגיוני, אין `last_error` בלתי צפוי, אין Access denied.
- [ ] Simulator עובד (`RADAR_USE_MOCK=true`) ו־Real mode עובד כשהחומרה מחוברת.
- [ ] Radar Map מתעדכן בהתאם ל־targets.
- [ ] אין חסימת UI; אין קריסת Backend בניתוק מצלמה או רדאר (placeholder + reconnect).
- [ ] אין זליגת threads (בדיקה: restart נקי, אין תהליכי python יתומים).
- [ ] `grep` על הלוגים החדשים לא מוצא סיסמאות או URL מלא של RTSP.
- [ ] התצוגה תקינה ב־100% zoom כולל גלילה.

## 16. How Claude Should Respond in Future Tasks

1. להסביר בקצרה מה הובן מהבקשה.
2. לציין אילו קבצים ייבדקו — ולקרוא אותם בפועל.
3. להסביר את סיבת הבעיה (root cause), לא רק את התסמין.
4. להציע תיקון מינימלי + לציין אילו קבצים ישתנו.
5. להציג תכנית בדיקה.
6. לבקש אישור לפני שינוי רחב, מסוכן או כזה שברשימת פרק 14.
7. לבצע את השינוי → להציג diff → להריץ בדיקות.
8. לדווח בכנות: מה הצליח, מה נכשל, מה לא אומת.

## 17. Open Questions — דורש אימות

- ~~**Baud נכון לרדאר**~~ — **נענה חלקית 2026-07-29:** לחיבור **ישיר** ל־USB-TTL הקצב הוא **256000** (אומת בפועל). 115200 נשאר רלוונטי רק לטופולוגיית bridge. נותר פתוח: איזו טופולוגיה תהיה הפעילה, ומתי לעדכן את הקונפיגורציה (ראה C3).
- **טופולוגיית הרדאר:** חיבור ישיר ל־USB-TTL **אומת שהוא עובד** (2026-07-29). עדיין לא הוכרע אם המערכת הסופית תשתמש בו או ב־ESP32-S3 כ־bridge; קוד ה־ESP32 ל־LD2450 לא נמצא בריפו — אם קיים, לצרפו.
- **אינטגרציית הרדאר בתוך Flask** — הבדיקה שהצליחה הייתה עצמאית. טרם אומת ש־`ld2450_reader.py` קורא את החיישן בהצלחה בתוך השרת הרץ.
- **רזולוציית ה־Dahua בפועל** על subtype=1 (משפיע על כיול FENCE_LINE_Y/GATE_POINT).
- **מיקום השער והגדר בפריים** של המצלמה המותקנת — נדרש לכיול מחדש.
- **מספר COM עדכני** — ב־.env מוגדר COM14; בבדיקה של 2026-07-29 הרדאר נקרא בפועל מ־**COM9** (מתאם CH340). **אין לעדכן את .env בלי אישור מפורש** — ראה C3 ופרק 6.
- ~~**סנכרון `python/dist`**~~ — **נסגר 2026-07-20:** `run-prod.ps1` הוא המנגנון היחיד (build → מחיקה → העתקה). ראה פרק 4.
- ~~**run-prod.ps1**~~ — **אומת 2026-07-20**, עובד מקצה לקצה. `start-server.bat` / `setup-new-machine.ps1` עדיין לא נבדקו.
- **ה־ESP32 של הזמזם** — האם מחובר ועובד (בלוגים "Arduino not found").
- **תרחישי ההדגמה לשופטים** — אילו תרחישים בדיוק יוצגו ומה סדר ההדגמה.
- **סקריפט הבדיקה ההיסטורי של הרדאר** (עם ספי 150/6000/65°/700) — לא נמצא בריפו.

## 19. Design Lab ו־Full-Site Concepts (נבנו 2026-07-14 → 2026-07-18)

שתי שכבות UI **נוספות** שאינן משנות את האתר הפעיל. אומת 2026-07-20 שכולן נטענות מה־build של production.

**א. Design Lab** — `hackathon/src/design-lab/` — 4 חלופות עיצוב לדשבורד + מרכז השוואה:

| נתיב | תיאור |
|---|---|
| `/design-lab` | עמוד בית להשוואה |
| `/design-lab/compare` | **Comparison Center** — 5 כרטיסי קונספט + השוואה לפי עמוד (SVG סטטי, בלי polling) |
| `/design-lab/minimal-command` | מינימלי ונקי |
| `/design-lab/sentinel-3d` | תלת־ממד (R3F/three.js, lazy) |
| `/design-lab/industrial-ops` | תעשייתי/מבצעי |
| `/design-lab/neural-fusion` | דגש על "למה" — הסבר הסיכון |

**ב. Full-Site Concepts** — `hackathon/src/concepts/` — 5 חוויות מוצר **מלאות**, 6 עמודים כל אחת (dashboard / camera / investigation / about / settings / admin), תחת `/concepts/:conceptId/*` מאחורי `ProtectedRoute`:
`minimal-command`, `industrial-ops`, `neural-fusion`, `sentinel`, `fusion-prime`.

- שכבת נתונים משותפת: `design-lab/shared/useAtapisData.js` + `concepts/data/*`. ‏`?demo=1&phase=approach` מפעיל תרחיש דמו מסומן בצד הלקוח.
- תיעוד ומעקב שלבים: `hackathon/docs/full-site-concepts/implementation-status.md` — **לקרוא אותו לפני שמניחים ששלב כלשהו הושלם.**
- **אף קונספט לא קודם לברירת מחדל.** `/` נשאר ה־Landing הישן, והדשבורד הפעיל `/camera/:roomId` לא נגעו בו. המשתמש עדיין לא בחר מנצח — אין לקדם אף קונספט בלי אישור מפורש.
- סקריפטים: `scripts/phase-d-screenshots.mjs` (30 צילומים), `scripts/phase-h-qa.mjs` (QA אוטומטי).
- ידוע ולא תוקן: אזהרת chunk >500kB על `Scene-*.js` (three.js המשותף) — קיימת מראש ואינה כשל build.

---

## 18. Update Policy

יש לעדכן את CLAUDE.md כאשר: נוסף רכיב חדש; השתנתה הארכיטקטורה; השתנתה פקודת ההפעלה; תוקנה תקלה מרכזית (לעדכן את פרק 11 ואת פרק 10); נוסף מודל; השתנה חיבור חומרה (COM/baud/טופולוגיה); השתנו ערכי Risk; נוסף משתנה סביבה; נוסף מצב עבודה; הוחלף Simulator בחיישן אמיתי; רכיב שינה סטטוס ("לא עובד" ↔ "עובד").

**אין לעדכן את הקובץ עם מידע שלא אומת מול הקוד או ההרצה בפועל. מידע לא ודאי מסומן תמיד [דורש אימות].**

---

## 20. Design Upgrade Status — 2026-07-29

**מצב כללי:**

- חמשת הקונספטים המלאים (`src/concepts/`) עברו **סבב שדרוג כללי** (ראה פרק 19).
- **העבודה הנוכחית מוגבלת ל־Fusion Prime ול־Industrial Ops בלבד.**
- **Fusion Prime הוא המועמד המוביל למוצר הסופי — אך הוא לא קודם לנתיב ברירת המחדל.** `/` נשאר ה־Landing הישן ו־`/camera/:roomId` נשאר הדשבורד הפעיל.
- **Industrial Ops הוא המועמד המבצעי השני.**
- **Fusion Prime Phase 1 ו־Phase 1.1 הושלמו מבחינה טכנית** (בדיקות ירוקות — ראה להלן).
- **Industrial Ops Phase 2 טרם התחיל** וממתין לאישור מפורש.
- **Minimal Command, Sentinel 3D, Neural Fusion ו־Comparison Center מוקפאים** — אין לגעת בהם ואין לבטל עבודה קיימת שלהם.
- **כל שינוי ברכיב משותף חייב להיות Opt-in, וברירת המחדל שלו חייבת לשמור את יתר הקונספטים ללא שינוי** — לא רק בקוד אלא גם בפלט המרונדר בפועל.

### Sensor-association honesty rules

כללים מחייבים. הם משקפים את מה שה־Backend באמת עושה, ואין לרכך אותם:

- **אין Backend spatial association** בין Camera Track לבין Radar Target. `combine_camera_risk_and_radar_risk()` מקבל שני מספרים בלבד, ו־`radar_simulator.py` מוחק במפורש את `camera_tracks` שהוא מקבל.
- **Live מציג `CP-nn — Unverified` בלבד, ללא אחוז.**
- **Demo בלבד רשאי להציג `FC-nn` ואחוז** — ותמיד לצד `DemoModeBadge` צמוד.
- **רק `snapshot.risks.fused` שמגיע מה־Backend ייקרא "Fused Risk".**
- **`pairRisk` או `max-of-sources` לעולם לא ייקראו "Fused Risk"** — הם מוצגים תמיד עם תווית מקור מפורשת.
- **אין לצייר קו Camera↔Radar.**
- **אין לצייר Gate במפת הרדאר** ללא כיול ומערכת קואורדינטות אמיתית.
- **אין לייחס בוודאות את המרחק או המהירות של T1 ל־Track מסוים במצב Live** — רק תחת מסגור של זוג מועמדים.

> הרקע הטכני: אין בפרויקט קליברציה, homography או מסגרת ייחוס משותפת בין פיקסלים של המצלמה למילימטרים של הרדאר. שיוך גיאומטרי אינו ניתן לחישוב, ולכן כל הצגה שלו תהיה המצאה.

### Fusion Prime current status

מה קיים בפועל ב־`src/concepts/fusion-prime/` (אומת בקוד ובריצה):

- **Decision header** — משפט החלטה תפעולי בראש מסך הפיקוד (`buildOperatorSentence` ב־`data/riskDecision.js`), במבנה של משפטים: מה קורה → מה הרדאר מדווח → מצב השיוך.
- **Candidate Pair / Demo Fused Contact** — `CP-nn — Unverified` ב־Live; `FC-nn` + אחוז רק ב־Demo, עם `DemoModeBadge` צמוד.
- **3-level settings:** `Operator` / `Security Calibration` / `Engineering` — דרך `RADAR_GROUPS_V2` ו־`groupLayout="three-way"`.
- **`LD2450_ENABLED` מוגבל למנהל במבנה החדש** — מפעיל רגיל אינו יכול להשבית חישת רדאר. (במבנה ה־legacy, שיתר הקונספטים משתמשים בו, ההתנהגות לא השתנתה.)
- **בדיקות חיבור — שמות שתואמים למה שה־endpoint באמת עושה:**
  - **Check Live Radar Data** → `GET /api/radar/live` — **קורא מצב קיים בלבד**.
  - **Check Camera Status** → `GET /api/cameras/status` — **קורא מצב קיים בלבד**.
  - **Test Dahua Connection** → `GET /api/cameras/dahua/test` — **היחיד שפותח חיבור אמיתי** (פותח RTSP וקורא פריים). לכן הוא היחיד שנקרא "Test".
  - כולן מופעלות **בלחיצת משתמש בלבד**, ואף אחת לא רצה אוטומטית.
- **Full Screen** עם feature detection, טיפול בדחיית ה־promise, ויציאה מפורשת.
- **Snapshot אמיתי בלבד** — לכידת הפריים הנוכחי בפועל. כאשר CORS או Canvas אינם מאפשרים לכידה, מוצג **"Snapshot unavailable"** ואין הצלחה מזויפת; זרם הווידאו אינו נפגע.
- **Event Timeline, Camera/Radar/Fusion tabs, ו־local event export** בחדר החקירה. ה־export הוא ייצוא מקומי של שדות שכבר נטענו — לא דוח שנוצר בשרת.
- **Compact ו־Comfort שונים בפועל רק ב־Fusion Prime כרגע.** בשאר הקונספטים אין עדיין CSS שמגיב ל־`[data-density]`, ולכן שני המצבים מרונדרים אצלם זהים.
- **רכיבים משותפים מופעלים רק באמצעות props מפורשים** — `groupLayout`, `sentence`, `showSourceTabs`, `showExample`, `animateFlow`, `alertRanges`. ברירת המחדל של כולם משחזרת את ההתנהגות הקודמת במדויק.

**בסיס הבדיקות (Baseline) נכון ל־2026-07-29:**

| בדיקה | תוצאה |
|---|---|
| `npm run build` | ✅ green |
| `npm run lint` | **4 שגיאות baseline קיימות בלבד** (ב־`concepts/data/`) — אין להחמיר |
| `node scripts/phase-h-qa.mjs` | **92/93** — הכישלון היחיד הוא לוג fetch-abort ישן ב־`/admin` |
| `node scripts/phase-prime-verify.mjs` | **30/30** |
| `node scripts/phase-prime-noregress.mjs` | **20/20** |

### Industrial Ops approved typography baseline

**הטיפוגרפיה הנוכחית במסך Industrial Ops OPS / מבצעים היא Baseline מאושר ונעול.**

יש לשמור ללא שינוי על:

- גדלי הכותרות הראשיות;
- כותרות הפאנלים;
- כותרות הטבלאות;
- טקסט רגיל;
- מספרים וערכים;
- ‏`line-height` שנועד לקריאות.

**אסור:**

- להקטין;
- לנרמל;
- לאפס;
- להחליף;
- או לעקוף את ערכי ה־`font-size` הקיימים.

**אין לפתור בעיות מקום או Responsive באמצעות הקטנת טקסט.**
יש להתאים סביבו **Grid, spacing, padding, dimensions, wrapping ו־overflow**.

**שינוי טיפוגרפיה מותר רק באישור מפורש של המשתמש.**
