README — איך להריץ את הפרויקט (Dev + Prod)

קודם כל — הנחות יסוד
- מערכת ההפעלה: Windows (PowerShell)
- Python 3.10+ מותקן
- Node.js + npm מותקן
- אם תרצה להריץ את ה-YOLO/ultralytics: ודא שקבצי המודל נמצאים בתיקיית `python/` (למשל `yolov8n.pt`, `yolov8n-pose.pt`).
- מצלמה מחוברת אם תרצה לבדוק את `/video_feed` מקומית.

1) הפעלת סביבה ו-Backend (פייתון) — פיתוח מקומי

# יצירת ו-activation של virtualenv (אם לא קיים)
Set-Location 'C:\Users\user\Desktop\hacaton2\hackathon'
python -m venv .venv
C:\Users\user\Desktop\hacaton2\hackathon\.venv\Scripts\Activate.ps1

# התקנת תלויות פייתון
pip install -r python\requirements.txt

# הפעלת השרת (מנהל Flask)
Set-Location 'C:\Users\user\Desktop\hacaton2\hackathon\python'
C:\Users\user\Desktop\hacaton2\hackathon\.venv\Scripts\python.exe server.py

הערות:
- השרת מאזין כברירת מחדל על `http://0.0.0.0:5000` (נגיש דרך `http://127.0.0.1:5000`).
- אם אין Arduino מחובר, הקוד ידפיס הודעה וממשיך לעבוד בלי-Arduino.

2) הפעלת ה-Frontend בפיתוח (Vite - hot reload)

# התקנת חבילות Node (מפעם לפעם או בפעם הראשונה)
Set-Location 'C:\Users\user\Desktop\hacaton2\hackathon'
npm install

# הרצה בפיתוח (hot reload)
npm run dev

# פתיחת הדפדפן
http://localhost:5173/

כניסה (login) עבור בדיקות:
- Username: admin
- Password: Aa123456

3) בדיקת הזרם וה-API מהרצת הדפדפן
- וודא שה-Backend רץ (פורט 5000) וה-Frontend רץ (פורט 5173).
- בדוק את נקודות הקצה:
  - `http://127.0.0.1:5000/status` — שיחזיר JSON של סטטוס המערכת.
  - `http://127.0.0.1:5000/video_feed` — MJPEG (Content-Type: multipart/x-mixed-replace; boundary=frame) המתנגן בתוך תג `<img>`.
- ב-UI: עבור ל-`/camera/1` (או בחר Room) כדי לצפות בזרם וב-bounding boxes.

4) הרצה לפרודקשן — build של ה-frontend + serve עם Flask

A) אפשרות מהירה — להריץ preview של Vite:
Set-Location 'C:\Users\user\Desktop\hacaton2\hackathon'
npm run build
npm run preview
# זה מריץ שרת שמשרת את ה-build (נוח לבדיקה מקומית בלי להגדיר Flask)

B) הדרך הנוחה לפריסה — Flask משרת את ה-build:
1. בצע build:
Set-Location 'C:\Users\user\Desktop\hacaton2\hackathon'
npm run build

2. העתק/העבר את תיקיית `dist/` לתוך `python/` (או תעדכן את `server.py` שיגיש את `dist/` ישירות).
   דוגמה להעתקה:
Copy-Item -Path .\dist -Destination .\python\dist -Recurse -Force

3. אפשרות לשנות את `python/server.py` כדי להגיש את `dist` (דוגמה לשימוש ב-send_from_directory):

# בקובץ server.py - הוספה ל-EOF לפני app.run או במקום המתאים
from flask import send_from_directory

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    dist_dir = os.path.join(os.path.dirname(__file__), 'dist')
    if path != '' and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')

# ואז להריץ server.py כפי שעשית קודם — ה-Flask ישמש גם כשרת הסטטי.

5) הרצת השרתים ברקע ב-Windows (דוגמה)
# הפעלת backend בחלון משלו (נסתר):
Start-Process -FilePath 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe' -ArgumentList "-NoProfile -Command Set-Location -Path 'C:\Users\user\Desktop\hacaton2\hackathon\python'; C:\Users\user\Desktop\hacaton2\hackathon\.venv\Scripts\python.exe server.py" -WindowStyle Hidden

# לעצירת תהליך (לדוגמה בעזרת PID):
Stop-Process -Id <PID>

6) טרבלשוטינג נפוץ
- אם `/video_feed` לא נטען:
  - וודא שמצלמה מחוברת ולא תפוסה על ידי תוכנה אחרת.
  - בדוק לוגים בחלון ה-Backend — מודולים של ultralytics עשויים להדפיס שגיאות אם חסרים מודלים.
- אם ה-serial לא מתחבר (Arduino): סגור את ה-Serial Monitor ב-Arduino IDE, או שחרר פורט COM שכל תוכנה אחרת תופסת.
- אם `npm run dev` לא זמין: ודא ש-node ו-npm מותקנים ותואמים.

7) שימושים נוספים ושיפורים מומלצים
- באם תרצה, אני יכול:
  - להוסיף את קוד ההגשה של `dist` ל-`server.py` אוטומטית.
  - לשנות זמנית את `AuthContext` כדי לאפשר auto-login בזמן פיתוח.
  - להכין קובץ `start-server.bat` או `run-dev.ps1` שיורץ את כל מה שצריך בהרצה יחידה.

8) מיקום הקבצים החשובים
- Backend: `python/server.py` (Flask + video streaming)
- Frontend root: `index.html`, `src/`, `package.json`, `vite.config.js`
- מודלים: `python/yolov8n.pt`, `python/yolov8n-pose.pt`

אם תרצה שאעדכן עכשיו את `server.py` כדי להגיש את תיקיית ה-`dist` באופן אוטומטי לאחר `npm run build`, או שאיצור `start-server.bat`/`run-dev.ps1`, אמור ואעשה.
---

## Dahua RTSP quick test

PowerShell network test:

```powershell
Test-NetConnection 194.3.195.20 -Port 554
```

VLC test URL:

```text
rtsp://shalom:shalom123%21@194.3.195.20:554/cam/realmonitor?channel=1&subtype=1
```

Run backend:

```powershell
Set-Location 'C:\Users\user\Desktop\HACATON3\hackathon\python'
python server.py
```

Open dashboard:

```text
http://localhost:5000
```

Check streams and camera APIs:

```text
http://localhost:5000/video_feed
http://localhost:5000/video_feed/webcam
http://localhost:5000/video_feed/dahua
http://localhost:5000/status
http://localhost:5000/api/cameras/status
http://localhost:5000/api/cameras/dahua/test
```
