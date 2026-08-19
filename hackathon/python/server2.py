from flask import Flask, Response, jsonify, request, render_template
import cv2
import threading
import time

from analysis import analyze_frame  # זה המודול שאתה מממש

app = Flask(__name__)

# מצלמה
camera = cv2.VideoCapture(0)

# סטטוס גלובלי של המערכת
STATUS = {
    "has_person": False,
    "identity": None,
    "motion": None,
    "confidence": 0.0,
    "context": "Initializing...",
    "mode": "SAFE",
    "last_update": None,
    "sensors": {}  # כאן נשמור טלמטריה מהמיקרו בקר אם יש
}

status_lock = threading.Lock()

def gen_frames():
    """
    גנרטור שמחזיר פריימים כ-MJPEG לוידאו,
    ובתוך כדי זה מריץ את מודל ה-AI ומעדכן STATUS.
    """
    global STATUS

    while True:
        success, frame = camera.read()
        if not success:
            break

        # מריצים ניתוח פריים (YOLO + Face + Pose)
        annotated_frame, status = analyze_frame(frame)

        # מעדכנים סטטוס גלובלי
        with status_lock:
            STATUS.update(status)
            STATUS["last_update"] = time.time()

        # מקודדים ל-JPEG
        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        if not ret:
            continue
        jpg_bytes = buffer.tobytes()

        # מחזירים כזרם MJPEG
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpg_bytes + b'\r\n')

@app.route("/")
def index():
    # דף HTML בסיסי (נשתמש ב-template תכף)
    return render_template("index.html")

@app.route("/video_feed")
def video_feed():
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/status")
def status():
    with status_lock:
        return jsonify(STATUS)

@app.route("/api/telemetry", methods=["POST"])
def telemetry():
    """
    נקודת קצה שהמיקרו בקר יכול לשלוח אליה נתוני סנסורים.
    לדוגמה:
    {
      "distance": 3.5,
      "imu": {"roll": 0.1, "pitch": -0.2, "yaw": 0.0}
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    with status_lock:
        STATUS["sensors"] = data
    return jsonify({"ok": True})

if __name__ == "__main__":
    # host='0.0.0.0' כדי שיהיה נגיש מהרשת
    app.run(host="127.0.0.1", port=5000, debug=True)
