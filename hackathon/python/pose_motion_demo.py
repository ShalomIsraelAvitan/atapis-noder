from ultralytics import YOLO
import cv2
import time
import math
from collections import deque

# כמה פריימים אחורה לשמור להערכת מהירות
HISTORY_LEN = 10

# ספי מהירות לפיקסלים לשנייה (צריך לכוון לפי המצלמה/מרחק)
STAND_THRESHOLD = 20     # מתחת לזה נחשב עומד
RUN_THRESHOLD = 100      # מעל זה נחשב רץ, באמצע הולך

def compute_speed(history):
    """
    history - deque של (x, y, t)
    מחזיר מהירות בפיקסלים לשנייה
    """
    if len(history) < 2:
        return 0.0

    x0, y0, t0 = history[0]
    x1, y1, t1 = history[-1]

    dt = t1 - t0
    if dt <= 0:
        return 0.0

    dx = x1 - x0
    dy = y1 - y0
    dist = math.sqrt(dx*dx + dy*dy)
    return dist / dt

def classify_speed(speed):
    """
    מקבל מהירות בפיקסלים לשנייה
    מחזיר: "עומד" / "הולך" / "רץ"
    """
    if speed < STAND_THRESHOLD:
        return "standing"
    elif speed < RUN_THRESHOLD:
        return "going"
    else:
        return "running"

def main():
    # מודל פוז קטן ומהיר
    model = YOLO("yolov8n-pose.pt")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Cannot open camera")
        return

    # נשמור היסטוריה של מרכז הגוף
    center_history = deque(maxlen=HISTORY_LEN)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # מריצים את מודל הפוז
        results = model(frame, conf=0.5, verbose=False)
        res = results[0]

        motion_label = "No person identified"

        if res.keypoints is not None and len(res.keypoints) > 0:
            # ניקח את האדם הראשון בפריים
            kps = res.keypoints.xy[0].cpu().numpy()  # [num_kps, 2]

            # לפי COCO: 11 = left hip, 12 = right hip (0-based)
            # אם משהו לא עובד, אפשר לקחת ממוצע של כל הנקודות
            try:
                left_hip = kps[11]
                right_hip = kps[12]
                cx = (left_hip[0] + right_hip[0]) / 2.0
                cy = (left_hip[1] + right_hip[1]) / 2.0
            except Exception:
                # fallback - ממוצע של כל הנקודות
                cx = kps[:, 0].mean()
                cy = kps[:, 1].mean()

            t = time.time()
            center_history.append((cx, cy, t))

            # מחשבים מהירות וסיווג
            speed = compute_speed(center_history)
            motion_label = classify_speed(speed)

            # מציירים נקודה על מרכז הגוף
            cv2.circle(frame, (int(cx), int(cy)), 5, (0, 255, 255), -1)

            # מציירים גם שלד של האדם
            annotated = res.plot()  # YOLO מחזיר פריים עם שלד מצויר
            frame = annotated

            # כותבים את המהירות והסטטוס על המסך
            text = f"{motion_label} | {speed:.1f}px/s"
            cv2.putText(frame, text, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
        else:
            # אם אין אדם, אפשר לנקות היסטוריה
            center_history.clear()

        cv2.imshow("Pose motion demo", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
