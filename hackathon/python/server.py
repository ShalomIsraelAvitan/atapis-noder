# server.py
from flask import Flask, Response, jsonify, render_template, send_from_directory, request
from flask_cors import CORS
import cv2
import time
import threading
import os
import json
import subprocess
import sys
import uuid
import serial
import serial.tools.list_ports
import numpy as np
from datetime import datetime
from werkzeug.utils import secure_filename

from analysis import analyze_frame, analyze_frame_for_source, reset_analysis_context
from camera_sources import (
    LatestFrameRTSPReader,
    build_dahua_config_from_env,
    install_stderr_credential_filter,
    load_env_file,
    sanitize_error_message,
    test_rtsp_connection,
)

try:
    from ld2450_reader import (
        get_available_scenarios as get_available_radar_scenarios,
        get_live_radar_payload,
        load_radar_config,
        save_radar_config,
    )
except Exception:
    get_available_radar_scenarios = None
    get_live_radar_payload = None
    load_radar_config = None
    save_radar_config = None

app = Flask(__name__)
# Enable CORS for all routes (API, status, video_feed, etc.)
CORS(
    app,
    resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type"],
        }
    },
)

# Create directories for data storage
BASE_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.dirname(BASE_DIR)
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")
DATA_DIR = "data"
IMAGES_DIR = os.path.join(DATA_DIR, "images")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
MONITORING_FILE = os.path.join(DATA_DIR, "monitoring.json")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
UPLOADS_DIR = os.path.join(OUTPUTS_DIR, "uploads")
SCENARIO_SCRIPT = os.path.join(BASE_DIR, "scenario_video_analysis.py")
ALLOWED_SCENARIO_EXTENSIONS = {"mp4", "avi", "mov", "m4v"}
SCENARIO_FRAME_SKIP = 2
SCENARIO_MAX_WIDTH = 960
SCENARIO_PROGRESS_POLL_INTERVAL_SECONDS = 0.5
SCENARIO_HISTORY_LIMIT = 30

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
load_env_file(ENV_PATH, override=False)


def _camera_credential_secrets():
    config = build_dahua_config_from_env()
    return [config.get("password", ""), config.get("username", "")]


# Installed before any capture is opened so no credential can reach a log file.
install_stderr_credential_filter(_camera_credential_secrets)

scenario_jobs = {}
scenario_jobs_lock = threading.Lock()


def _blank_radar_payload():
    return {
        "enabled": False,
        "mode": "ld2450",
        "provider": "ld2450",
        "scenario": "idle",
        "radar_connected": False,
        "radar_status": "DISCONNECTED",
        "last_update_ms": None,
        "targets_count": 0,
        "targets": [],
        "max_radar_risk": 0,
        "confidence": 0.0,
        "last_error": None,
        "timestamp": None,
    }


def _get_live_radar_snapshot(now=None):
    if callable(get_live_radar_payload):
        try:
            payload = get_live_radar_payload(now=now)
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass
    return _blank_radar_payload()


def _default_camera_status(source_name, status="inactive", context="Initializing...", connected=False, last_error=None):
    return {
        "source": source_name,
        "status": status,
        "connected": connected,
        "last_error": last_error,
        "has_person": False,
        "identity": None,
        "motion": None,
        "confidence": 0.0,
        "context": context,
        "mode": "SAFE",
        "camera_mode": "SAFE",
        "max_risk": 0,
        "camera_risk": 0,
        "radar_risk": 0,
        "fused_risk": 0,
        "last_update": None,
        "detections": [],
        "distance": None,
        "profile": "perimeter",
        "person_count": 0,
        "person_boxes": [],
        "has_weapon": False,
        "weapon_type": None,
        "weapon_confidence": 0.0,
        "weapon_boxes": [],
        "weapon_detection_available": None,
        "weapon_detection_status": "unknown",
        "tracks": [],
        "radar": _blank_radar_payload(),
    }

# נפתח את המצלמה פעם אחת (0 = המצלמה הראשונה במערכת)
camera = None
camera_lock = threading.Lock()
last_camera_error = None
dahua_reader = None
dahua_reader_lock = threading.Lock()

# סטטוס גלובלי (אם תרצה להשתמש ב-/status)
STATUS = _default_camera_status("webcam", status="active", context="Initializing webcam stream...", connected=False)
CAMERA_STATUS = {
    "webcam": _default_camera_status("webcam", status="active", context="Initializing webcam stream...", connected=False),
    "dahua": _default_camera_status("dahua", status="disconnected", context="Initializing Dahua RTSP stream...", connected=False),
}
status_lock = threading.Lock()

# Arduino communication
arduino = None
arduino_lock = threading.Lock()
last_arduino_alert_time = 0
ARDUINO_ALERT_COOLDOWN = 10  # 10 seconds cooldown between alerts
arduino_alert_active = False  # Track if alert is currently active (5 seconds duration)
arduino_alert_start_time = 0  # When current alert started
ARDUINO_ALERT_DURATION = 5  # Alert duration in seconds (matches Arduino code)
distance_value = None
arduino_messages = []  # Store Arduino serial messages for frontend
MAX_ARDUINO_MESSAGES = 100  # Keep last 100 messages

# Track detection states to save images for alerts/danger
alert_detected = False
danger_detected = False
last_alert_time = 0
last_danger_time = 0
ALERT_COOLDOWN = 15  # Save alert image every 15 seconds max
DANGER_COOLDOWN = 10  # Save danger image every 10 seconds max
CAMERA_ALERT_STATE = {
    "webcam": {"alert_detected": False, "danger_detected": False, "last_alert_time": 0.0, "last_danger_time": 0.0},
    "dahua": {"alert_detected": False, "danger_detected": False, "last_alert_time": 0.0, "last_danger_time": 0.0},
}


def _is_allowed_scenario_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_SCENARIO_EXTENSIONS


def _scenario_output_paths(original_filename):
    safe_name = secure_filename(original_filename or "")
    if not safe_name:
        safe_name = "scenario_video.mp4"

    stem, _ = os.path.splitext(safe_name)
    if not stem:
        stem = "scenario_video"

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    uploaded_name = f"upload_{timestamp}_{safe_name}"
    output_filename = f"analyzed_{stem}.mp4"
    summary_filename = f"analyzed_{stem}.json"
    progress_filename = f".scenario_progress_{timestamp}_{stem}.json"
    log_filename = f".scenario_log_{timestamp}_{stem}.txt"

    return {
        "safe_name": safe_name,
        "uploaded_path": os.path.join(UPLOADS_DIR, uploaded_name),
        "output_filename": output_filename,
        "output_path": os.path.join(OUTPUTS_DIR, output_filename),
        "summary_path": os.path.join(OUTPUTS_DIR, summary_filename),
        "progress_path": os.path.join(OUTPUTS_DIR, progress_filename),
        "log_path": os.path.join(OUTPUTS_DIR, log_filename),
    }


def _read_json_file(path):
    if not path or not os.path.exists(path):
        return None

    try:
        with open(path, "r", encoding="utf-8") as json_file:
            return json.load(json_file)
    except (OSError, json.JSONDecodeError):
        return None


def _remove_file_if_exists(path):
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


def _cleanup_scenario_artifacts(paths, include_output=False):
    cleanup_paths = [
        paths.get("uploaded_path"),
        paths.get("progress_path"),
        paths.get("log_path"),
    ]
    if include_output:
        cleanup_paths.extend([paths.get("output_path"), paths.get("summary_path")])

    for path in cleanup_paths:
        _remove_file_if_exists(path)


def _update_scenario_job(job_id, **updates):
    with scenario_jobs_lock:
        job = scenario_jobs.get(job_id)
        if job is not None:
            job.update(updates)


def _get_scenario_job(job_id):
    with scenario_jobs_lock:
        job = scenario_jobs.get(job_id)
        return dict(job) if job is not None else None


def _scenario_video_url(host_base_url, output_filename):
    return f"{host_base_url}/api/scenario-outputs/{output_filename}?t={int(time.time())}"


def _scenario_history_paths(output_filename):
    safe_output_filename = secure_filename(output_filename or "")
    if not safe_output_filename or safe_output_filename != output_filename:
        return None

    if not safe_output_filename.startswith("analyzed_") or not safe_output_filename.lower().endswith(".mp4"):
        return None

    stem, _ = os.path.splitext(safe_output_filename)
    return {
        "output_filename": safe_output_filename,
        "output_path": os.path.join(OUTPUTS_DIR, safe_output_filename),
        "summary_path": os.path.join(OUTPUTS_DIR, f"{stem}.json"),
    }


def _list_scenario_history(host_base_url, limit=SCENARIO_HISTORY_LIMIT):
    history_items = []

    try:
        filenames = os.listdir(OUTPUTS_DIR)
    except OSError:
        return []

    for filename in filenames:
        if not filename.startswith("analyzed_") or not filename.endswith(".json"):
            continue

        summary_path = os.path.join(OUTPUTS_DIR, filename)
        summary = _read_json_file(summary_path)
        if summary is None:
            continue

        output_filename = summary.get("output_filename")
        if not output_filename:
            output_filename = f"{os.path.splitext(filename)[0]}.mp4"

        output_path = os.path.join(OUTPUTS_DIR, output_filename)
        if not os.path.exists(output_path):
            continue

        timestamp_source_path = output_path if os.path.exists(output_path) else summary_path
        analyzed_at = summary.get("analyzed_at")
        if not analyzed_at:
            analyzed_at = datetime.fromtimestamp(os.path.getmtime(timestamp_source_path)).isoformat()

        history_items.append(
            {
                "id": output_filename,
                "source_filename": summary.get("source_filename") or output_filename,
                "output_filename": output_filename,
                "video_url": _scenario_video_url(host_base_url, output_filename),
                "analyzed_at": analyzed_at,
                "file_size_bytes": os.path.getsize(output_path),
                "summary": summary,
            }
        )

    history_items.sort(
        key=lambda item: item.get("analyzed_at") or "",
        reverse=True,
    )
    return history_items[:limit]


def _tail_text_file(path, max_chars=4000):
    if not path or not os.path.exists(path):
        return ""

    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as log_file:
            content = log_file.read().strip()
            return content[-max_chars:]
    except OSError:
        return ""


def _radar_config_supported():
    return (
        callable(load_radar_config)
        and callable(save_radar_config)
        and callable(get_available_radar_scenarios)
    )


def _radar_config_response():
    if not _radar_config_supported():
        return {
            "success": False,
            "error": "Radar configuration support is unavailable. Running in camera-only mode.",
            "available_scenarios": [],
            "config": None,
        }

    config = load_radar_config()
    return {
        "success": True,
        "available_scenarios": get_available_radar_scenarios(),
        "config": config,
    }


def _get_dahua_config():
    load_env_file(ENV_PATH, override=True)
    return build_dahua_config_from_env()


def _is_dahua_config_complete(config):
    return bool(
        (config or {}).get("host")
        and (config or {}).get("username")
        and (config or {}).get("password")
    )


def _sanitize_dahua_error(message):
    config = _get_dahua_config()
    return sanitize_error_message(
        message,
        secrets=[config.get("password", "")],
    )


def _ensure_dahua_reader(start_if_needed=True):
    global dahua_reader

    config = _get_dahua_config()
    if not _is_dahua_config_complete(config):
        return None

    with dahua_reader_lock:
        config_signature = (
            config.get("host"),
            config.get("port"),
            config.get("username"),
            config.get("password"),
            config.get("channel"),
            config.get("subtype"),
        )

        current_signature = None
        if dahua_reader is not None:
            current_status = dahua_reader.get_status()
            current_signature = (
                current_status.get("host"),
                current_status.get("port"),
                current_status.get("username"),
                config.get("password"),
                current_status.get("channel"),
                current_status.get("subtype"),
            )

        if dahua_reader is None or current_signature != config_signature:
            if dahua_reader is not None:
                try:
                    dahua_reader.stop()
                except Exception:
                    pass

            dahua_reader = LatestFrameRTSPReader("dahua", config)

        else:
            dahua_reader.update_config(config)

        if start_if_needed and dahua_reader is not None:
            dahua_reader.start()

        return dahua_reader


def _restart_dahua_reader():
    reader = _ensure_dahua_reader(start_if_needed=False)
    if reader is None:
        return None
    reader.reconnect()
    return reader


def _build_detection_payload(status, source_name):
    detections = []

    for person_box in status.get("person_boxes", []):
        detections.append(
            {
                "class": "person",
                "label": "person",
                "score": person_box.get("confidence", status.get("confidence", 0.5)),
                "bbox": person_box.get("bbox", [0, 0, 100, 100]),
                "source": source_name,
            }
        )

    for weapon_box in status.get("weapon_boxes", []):
        detections.append(
            {
                "class": "weapon",
                "label": weapon_box.get("type", status.get("weapon_type", "weapon")),
                "score": weapon_box.get("confidence", status.get("weapon_confidence", 0.5)),
                "bbox": weapon_box.get("bbox", [0, 0, 100, 100]),
                "source": source_name,
            }
        )

    if detections:
        return detections

    if status.get("has_person"):
        for _ in range(int(status.get("person_count", 0) or 0)):
            detections.append(
                {
                    "class": "person",
                    "label": "person",
                    "score": status.get("confidence", 0.5),
                    "bbox": [0, 0, 100, 100],
                    "source": source_name,
                }
            )

    if status.get("has_weapon"):
        detections.append(
            {
                "class": "weapon",
                "label": status.get("weapon_type", "weapon"),
                "score": status.get("weapon_confidence", 0.5),
                "bbox": [0, 0, 100, 100],
                "source": source_name,
            }
        )

    return detections


def _build_global_status_snapshot():
    snapshots = list(CAMERA_STATUS.values())
    radar_snapshot = _get_live_radar_snapshot()
    if not snapshots:
        snapshot = _default_camera_status("webcam", status="inactive", context="No camera sources configured.", connected=False)
        snapshot["distance"] = distance_value
        snapshot["radar"] = radar_snapshot
        snapshot["radar_risk"] = radar_snapshot.get("max_radar_risk", 0)
        return snapshot

    dominant_snapshot = max(
        snapshots,
        key=lambda item: (
            int(item.get("fused_risk", 0) or 0),
            int(item.get("camera_risk", 0) or 0),
            str(item.get("last_update") or ""),
        ),
    )
    global_snapshot = dict(dominant_snapshot)
    global_snapshot["source"] = dominant_snapshot.get("source")
    global_snapshot["status"] = "active" if any(item.get("connected") for item in snapshots) else "inactive"
    global_snapshot["distance"] = distance_value
    global_snapshot["radar"] = radar_snapshot
    global_snapshot["radar_risk"] = int(
        radar_snapshot.get("max_radar_risk", global_snapshot.get("radar_risk", 0)) or 0
    )
    global_snapshot["cameras"] = {
        name: {
            "connected": bool(snapshot.get("connected")),
            "status": snapshot.get("status"),
            "mode": snapshot.get("mode"),
            "person_count": snapshot.get("person_count", 0),
            "has_weapon": snapshot.get("has_weapon", False),
            "fused_risk": snapshot.get("fused_risk", 0),
        }
        for name, snapshot in CAMERA_STATUS.items()
    }
    return global_snapshot


def _handle_alert_logic(source_name, annotated_frame, status):
    global arduino_alert_active, arduino_alert_start_time, last_arduino_alert_time

    current_time = time.time()
    source_alert_state = CAMERA_ALERT_STATE.setdefault(
        source_name,
        {"alert_detected": False, "danger_detected": False, "last_alert_time": 0.0, "last_danger_time": 0.0},
    )
    mode = status.get("mode", "SAFE")

    if arduino_alert_active:
        elapsed = current_time - arduino_alert_start_time
        if elapsed >= ARDUINO_ALERT_DURATION:
            arduino_alert_active = False
            print(f"Alert duration completed ({ARDUINO_ALERT_DURATION}s)")

    if mode == "DANGER":
        if current_time - source_alert_state["last_danger_time"] >= DANGER_COOLDOWN:
            save_detection_image(annotated_frame, status, source_name)
            source_alert_state["last_danger_time"] = current_time
            source_alert_state["danger_detected"] = True

        if not arduino_alert_active and current_time - last_arduino_alert_time >= ARDUINO_ALERT_COOLDOWN:
            print(f"DANGER detected on {source_name}. Sending alert command to Arduino.")
            if send_arduino_command("ALERT"):
                arduino_alert_active = True
                arduino_alert_start_time = current_time
                last_arduino_alert_time = current_time
    elif mode == "ALERT":
        if current_time - source_alert_state["last_alert_time"] >= ALERT_COOLDOWN:
            save_detection_image(annotated_frame, status, source_name)
            source_alert_state["last_alert_time"] = current_time
            source_alert_state["alert_detected"] = True

        if not arduino_alert_active and current_time - last_arduino_alert_time >= ARDUINO_ALERT_COOLDOWN:
            print(f"ALERT detected on {source_name}. Sending alert command to Arduino.")
            if send_arduino_command("ALERT"):
                arduino_alert_active = True
                arduino_alert_start_time = current_time
                last_arduino_alert_time = current_time
    else:
        source_alert_state["alert_detected"] = False
        source_alert_state["danger_detected"] = False


def process_status_update(source_name, annotated_frame, status, connected, last_error=None):
    status_payload = dict(status or {})
    status_payload["source"] = source_name
    status_payload["connected"] = bool(connected)
    status_payload["last_error"] = last_error
    status_payload["last_update"] = time.strftime("%H:%M:%S")
    status_payload["distance"] = distance_value
    status_payload["status"] = "active" if connected else "disconnected"
    status_payload["detections"] = _build_detection_payload(status_payload, source_name)

    with status_lock:
        CAMERA_STATUS[source_name] = {**_default_camera_status(source_name), **status_payload}
        STATUS.clear()
        STATUS.update(_build_global_status_snapshot())

    if connected:
        _handle_alert_logic(source_name, annotated_frame, status_payload)

    return status_payload


def _build_camera_status_response():
    with status_lock:
        webcam_snapshot = dict(
            CAMERA_STATUS.get(
                "webcam",
                _default_camera_status(
                    "webcam",
                    status="inactive",
                    context="Webcam status is unavailable.",
                    connected=False,
                ),
            )
        )
        dahua_snapshot = dict(
            CAMERA_STATUS.get(
                "dahua",
                _default_camera_status(
                    "dahua",
                    status="disconnected",
                    context="Dahua RTSP status is unavailable.",
                    connected=False,
                ),
            )
        )

    webcam_payload = {
        "connected": bool(webcam_snapshot.get("connected")),
        "status": webcam_snapshot.get("status") or "inactive",
        "last_error": webcam_snapshot.get("last_error"),
        "mode": webcam_snapshot.get("mode", "SAFE"),
        "camera_mode": webcam_snapshot.get("camera_mode", "SAFE"),
        "max_risk": webcam_snapshot.get("max_risk", 0),
        "camera_risk": webcam_snapshot.get("camera_risk", 0),
        "radar_risk": webcam_snapshot.get("radar_risk", 0),
        "fused_risk": webcam_snapshot.get("fused_risk", 0),
        "last_update": webcam_snapshot.get("last_update"),
        "has_person": webcam_snapshot.get("has_person", False),
        "person_count": webcam_snapshot.get("person_count", 0),
        "has_weapon": webcam_snapshot.get("has_weapon", False),
        "weapon_detection_available": webcam_snapshot.get("weapon_detection_available"),
        "weapon_detection_status": webcam_snapshot.get("weapon_detection_status", "unknown"),
        "context": webcam_snapshot.get("context"),
    }

    dahua_config = _get_dahua_config()
    dahua_reader_instance = _ensure_dahua_reader(start_if_needed=True)
    reader_status = dahua_reader_instance.get_status() if dahua_reader_instance is not None else {}

    dahua_payload = {
        "connected": bool(reader_status.get("connected", dahua_snapshot.get("connected"))),
        "status": reader_status.get("status") or dahua_snapshot.get("status") or "disconnected",
        "host": dahua_config.get("host"),
        "port": dahua_config.get("port"),
        "channel": dahua_config.get("channel"),
        "subtype": dahua_config.get("subtype"),
        "last_error": reader_status.get("last_error") or dahua_snapshot.get("last_error"),
        "last_frame_time": reader_status.get("last_frame_time"),
        "frames_received": reader_status.get("frames_received", 0),
        "backend": reader_status.get("backend"),
        "mode": dahua_snapshot.get("mode", "SAFE"),
        "camera_mode": dahua_snapshot.get("camera_mode", "SAFE"),
        "max_risk": dahua_snapshot.get("max_risk", 0),
        "camera_risk": dahua_snapshot.get("camera_risk", 0),
        "radar_risk": dahua_snapshot.get("radar_risk", 0),
        "fused_risk": dahua_snapshot.get("fused_risk", 0),
        "last_update": dahua_snapshot.get("last_update"),
        "has_person": dahua_snapshot.get("has_person", False),
        "person_count": dahua_snapshot.get("person_count", 0),
        "has_weapon": dahua_snapshot.get("has_weapon", False),
        "weapon_detection_available": dahua_snapshot.get("weapon_detection_available"),
        "weapon_detection_status": dahua_snapshot.get("weapon_detection_status", "unknown"),
        "context": dahua_snapshot.get("context"),
    }

    if not _is_dahua_config_complete(dahua_config):
        dahua_payload["connected"] = False
        dahua_payload["status"] = "disconnected"
        dahua_payload["last_error"] = dahua_payload.get("last_error") or "Dahua RTSP configuration is incomplete."

    return {
        "webcam": webcam_payload,
        "dahua": dahua_payload,
    }


def _run_scenario_video_analysis(job_id, paths, host_base_url):
    source_path = paths["uploaded_path"]
    output_path = paths["output_path"]
    summary_path = paths["summary_path"]
    progress_path = paths["progress_path"]
    log_path = paths["log_path"]

    for stale_path in (output_path, summary_path, progress_path, log_path):
        _remove_file_if_exists(stale_path)

    command = [
        sys.executable,
        SCENARIO_SCRIPT,
        source_path,
        "--output",
        output_path,
        "--summary",
        summary_path,
        "--progress",
        progress_path,
        "--frame-skip",
        str(SCENARIO_FRAME_SKIP),
        "--max-width",
        str(SCENARIO_MAX_WIDTH),
    ]

    _update_scenario_job(
        job_id,
        status="processing",
        stage="Queued",
        progress_percent=0,
        started_at=datetime.now().isoformat(),
    )

    try:
        with open(log_path, "w", encoding="utf-8", errors="ignore") as log_file:
            process = subprocess.Popen(
                command,
                cwd=BASE_DIR,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                text=True,
            )

            while True:
                progress = _read_json_file(progress_path)
                if progress:
                    _update_scenario_job(
                        job_id,
                        status=progress.get("status", "processing"),
                        stage=progress.get("stage", "Processing"),
                        progress_percent=int(progress.get("progress_percent", 0)),
                        frames_total=progress.get("frames_total"),
                        frames_read=progress.get("frames_read"),
                        frames_analyzed=progress.get("frames_analyzed"),
                        frame_skip=progress.get("frame_skip", SCENARIO_FRAME_SKIP),
                        output_width=progress.get("output_width"),
                        output_height=progress.get("output_height"),
                    )

                return_code = process.poll()
                if return_code is not None:
                    break

                time.sleep(SCENARIO_PROGRESS_POLL_INTERVAL_SECONDS)

        progress = _read_json_file(progress_path)
        if progress:
            _update_scenario_job(
                job_id,
                status=progress.get("status", "processing"),
                stage=progress.get("stage", "Processing"),
                progress_percent=int(progress.get("progress_percent", 0)),
                frames_total=progress.get("frames_total"),
                frames_read=progress.get("frames_read"),
                frames_analyzed=progress.get("frames_analyzed"),
                frame_skip=progress.get("frame_skip", SCENARIO_FRAME_SKIP),
                output_width=progress.get("output_width"),
                output_height=progress.get("output_height"),
            )

        if return_code != 0:
            error_output = _tail_text_file(log_path) or "Video analysis failed."
            raise RuntimeError(error_output)

        if not os.path.exists(output_path):
            raise RuntimeError("Scenario analysis completed without creating an output video.")

        summary = _read_json_file(summary_path)
        if summary is None:
            raise RuntimeError("Scenario analysis completed without creating a summary file.")

        _update_scenario_job(
            job_id,
            status="completed",
            stage="Completed",
            progress_percent=100,
            summary=summary,
            video_url=_scenario_video_url(host_base_url, paths["output_filename"]),
            output_filename=paths["output_filename"],
            finished_at=datetime.now().isoformat(),
        )
    except Exception as exc:
        _cleanup_scenario_artifacts(paths, include_output=True)
        _update_scenario_job(
            job_id,
            status="failed",
            stage="Failed",
            error=str(exc),
            finished_at=datetime.now().isoformat(),
        )
    finally:
        _cleanup_scenario_artifacts(paths, include_output=False)


def _camera_candidates():
    candidates = []

    if os.name == "nt" and hasattr(cv2, "CAP_DSHOW"):
        candidates.extend(
            [
                (0, cv2.CAP_DSHOW, "DirectShow camera 0"),
                (1, cv2.CAP_DSHOW, "DirectShow camera 1"),
            ]
        )

    candidates.extend(
        [
            (0, None, "Default camera 0"),
            (1, None, "Default camera 1"),
        ]
    )
    return candidates


def _open_camera_capture():
    global last_camera_error

    attempts = []
    for camera_index, backend, label in _camera_candidates():
        try:
            capture = (
                cv2.VideoCapture(camera_index, backend)
                if backend is not None
                else cv2.VideoCapture(camera_index)
            )
            if not capture or not capture.isOpened():
                attempts.append(f"{label}: open failed")
                if capture:
                    capture.release()
                continue

            ok, frame = capture.read()
            if ok and frame is not None:
                print(f"Camera connected via {label}")
                last_camera_error = None
                return capture

            attempts.append(f"{label}: read failed")
            capture.release()
        except Exception as exc:
            attempts.append(f"{label}: {exc}")

    last_camera_error = "; ".join(attempts) if attempts else "No camera candidates were available."
    print(f"Camera initialization failed: {last_camera_error}")
    return None


def _ensure_camera():
    global camera

    with camera_lock:
        if camera is not None and camera.isOpened():
            return camera

        camera = _open_camera_capture()
        return camera


def _reset_camera():
    global camera

    with camera_lock:
        try:
            if camera is not None:
                camera.release()
        except Exception:
            pass

        camera = _open_camera_capture()
        return camera


def _camera_placeholder_frame(message):
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    frame[:] = (20, 24, 32)

    cv2.putText(
        frame,
        "CAMERA UNAVAILABLE",
        (80, 180),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.4,
        (0, 165, 255),
        3,
    )
    cv2.putText(
        frame,
        message[:90],
        (80, 250),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 255, 255),
        2,
    )
    cv2.putText(
        frame,
        "Check Windows camera permissions, close other camera apps, or try another USB camera.",
        (80, 310),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (180, 180, 180),
        2,
    )
    return frame


def _dahua_placeholder_frame(message):
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    frame[:] = (18, 22, 30)

    cv2.putText(
        frame,
        "DAHUA RTSP CAMERA UNAVAILABLE",
        (60, 170),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.1,
        (0, 165, 255),
        3,
    )
    cv2.putText(
        frame,
        (message or "No frame received from the RTSP stream.")[:96],
        (60, 240),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (255, 255, 255),
        2,
    )
    cv2.putText(
        frame,
        "Check RTSP URL, network route, port 554, username/password, subtype.",
        (60, 300),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.64,
        (180, 180, 180),
        2,
    )
    return frame


# Descriptions that identify a real Arduino/ESP board. CH343 is deliberately
# absent: in this system the CH343 USB-to-TTL adapter belongs to the LD2450
# radar, so it must never be claimed as an Arduino.
ARDUINO_DESCRIPTION_HINTS = ("arduino", "ch340", "ch341", "esp32", "esp-32", "cp210")

# Never probe these, whatever they are called. Intel AMT exposes a virtual
# serial port (SOL) that answers on open and is not a microcontroller.
ARDUINO_DESCRIPTION_BLOCKLIST = ("active management", "sol ", "(sol)", "ch343", "bluetooth")


def _normalized_port_name(port_name):
    return str(port_name or "").strip().upper()


def _radar_reserved_ports():
    """COM ports owned by the radar, which the Arduino must never touch."""
    reserved = set()
    for env_name in ("LD2450_PORT", "RADAR_PORT"):
        reserved.add(_normalized_port_name(os.getenv(env_name)))

    if load_radar_config is not None:
        try:
            reserved.add(_normalized_port_name((load_radar_config() or {}).get("LD2450_PORT")))
        except Exception:
            pass

    reserved.discard("")
    return reserved


def _select_arduino_port():
    """Pick the Arduino port explicitly, or not at all.

    Returns (port_name, reason). No blind scanning of COM3-COM7: probing ports
    by opening them is what previously grabbed the Intel AMT virtual port and
    could equally grab the radar's adapter.
    """
    reserved = _radar_reserved_ports()

    configured = (os.getenv("ARDUINO_PORT") or "").strip()
    if configured:
        if configured.lower() in ("none", "off", "disabled"):
            return None, "ARDUINO_PORT is disabled by configuration"
        if _normalized_port_name(configured) in reserved:
            return None, f"ARDUINO_PORT {configured} is reserved for the radar - refusing to open it"
        return configured, f"using configured ARDUINO_PORT {configured}"

    try:
        ports = list(serial.tools.list_ports.comports())
    except Exception as exc:
        return None, f"could not enumerate serial ports ({exc})"

    for port in ports:
        description = (port.description or "").lower()
        if _normalized_port_name(port.device) in reserved:
            continue
        if any(blocked in description for blocked in ARDUINO_DESCRIPTION_BLOCKLIST):
            continue
        if any(hint in description for hint in ARDUINO_DESCRIPTION_HINTS):
            return port.device, f"auto-detected Arduino/ESP device on {port.device}"

    return None, "no Arduino/ESP device detected (set ARDUINO_PORT to select one explicitly)"


def init_arduino():
    """Initialize Arduino serial connection.

    Never falls back to opening arbitrary ports: the radar's port and unrelated
    virtual ports must stay untouched. A missing board is a normal state.
    """
    global arduino
    try:
        arduino_port, reason = _select_arduino_port()
        if arduino_port is None:
            print(f"Arduino disconnected - {reason}. Continuing without Arduino support.")
            arduino = None
            return False

        print(f"Arduino port selection: {reason}")

        if arduino_port:
            try:
                # Try to close port if it's already open
                try:
                    if arduino and arduino.is_open:
                        arduino.close()
                except:
                    pass
                
                # Open the port
                arduino = serial.Serial(arduino_port, 9600, timeout=1)
                time.sleep(2)  # Wait for Arduino to initialize
                print(f"✓✓✓ Arduino connected on {arduino_port} ✓✓✓")
                # Clear any existing data in buffer
                arduino.reset_input_buffer()
                arduino.reset_output_buffer()
                # Send a test command to verify connection
                try:
                    arduino.write(b"LIGHT_ON\n")
                    time.sleep(0.5)
                    arduino.write(b"LIGHT_OFF\n")
                except:
                    pass  # Test command failed but connection is OK
                return True
            except serial.SerialException as e:
                error_msg = str(e)
                arduino = None
                if "Access is denied" in error_msg or "Permission denied" in error_msg:
                    print(f"Arduino access denied on {arduino_port} - the port is held by another program.")
                    print("  → Close any serial monitor using it, then call /api/arduino-reconnect.")
                elif "could not open port" in error_msg.lower():
                    print(f"Arduino port unavailable - {arduino_port} does not exist or is unplugged.")
                else:
                    print(f"Arduino disconnected - could not open {arduino_port}: {error_msg}")
                return False
            except Exception as e:
                arduino = None
                print(f"Arduino disconnected - unexpected error on {arduino_port}: {e}")
                return False
        else:
            arduino = None
            print("Arduino disconnected - no port selected. Continuing without Arduino support.")
            return False
    except Exception as e:
        arduino = None
        print(f"Arduino disconnected - error during initialization: {e}")
        print("Continuing without Arduino support.")
        return False


def read_arduino_distance():
    """Read distance from Arduino and capture all serial messages"""
    global distance_value, arduino, arduino_messages
    if arduino is None or not arduino.is_open:
        return None
    
    try:
        with arduino_lock:
            # Read all available lines to get the latest distance and messages
            latest_distance = None
            while arduino.in_waiting > 0:
                try:
                    line = arduino.readline().decode('utf-8', errors='ignore').strip()
                    if not line:
                        continue
                    
                    # Store all messages for frontend
                    timestamp = time.strftime("%H:%M:%S")
                    arduino_messages.append({
                        "time": timestamp,
                        "message": line
                    })
                    # Keep only last MAX_ARDUINO_MESSAGES
                    if len(arduino_messages) > MAX_ARDUINO_MESSAGES:
                        arduino_messages.pop(0)
                    
                    # Arduino sends distance in format: "XXXcm" or debug messages
                    if 'cm' in line and not line.startswith('CMD:') and not 'ALERT activated' in line:
                        try:
                            distance_str = line.replace('cm', '').strip()
                            # Remove any non-numeric characters except decimal point
                            distance_str = ''.join(c for c in distance_str if c.isdigit() or c == '.')
                            if distance_str:
                                latest_distance = float(distance_str)
                                distance_value = latest_distance
                        except (ValueError, AttributeError):
                            pass
                except Exception as e:
                    # Skip malformed lines
                    continue
            
            if latest_distance is not None:
                return latest_distance
    except Exception as e:
        print(f"Error reading Arduino: {e}")
    
    return distance_value  # Return last known value


def send_arduino_command(command):
    """Send command to Arduino with detailed debugging"""
    global arduino, last_arduino_alert_time
    if arduino is None or not arduino.is_open:
        print(f"❌ Arduino not connected, cannot send command: {command}")
        return False
    
    try:
        with arduino_lock:
            print(f"\n🔵 [DEBUG] Preparing to send command: '{command}'")
            print(f"🔵 [DEBUG] Arduino port: {arduino.port}, is_open: {arduino.is_open}")
            print(f"🔵 [DEBUG] Bytes in waiting (before): {arduino.in_waiting}")
            
            # Don't flush input buffer - it might clear incoming data
            # Just wait a tiny bit to ensure previous operations are done
            time.sleep(0.1)
            
            # Send command with both \r\n for maximum compatibility
            command_bytes = f"{command}\r\n".encode('utf-8')
            print(f"🔵 [DEBUG] Command bytes: {command_bytes} (hex: {command_bytes.hex()})")
            
            bytes_written = arduino.write(command_bytes)
            arduino.flush()  # Ensure command is sent immediately
            
            print(f"🔵 [DEBUG] Bytes written: {bytes_written}")
            print(f"🔵 [DEBUG] Bytes in waiting (after send): {arduino.in_waiting}")
            
            # Wait a bit to ensure Arduino receives it
            time.sleep(0.1)
            
            # Try to read any immediate response
            if arduino.in_waiting > 0:
                response = arduino.readline().decode('utf-8', errors='ignore').strip()
                print(f"🔵 [DEBUG] Arduino response: '{response}'")
            
            print(f"✅ Sent command to Arduino: '{command}' ({bytes_written} bytes)")
            return True
    except Exception as e:
        print(f"❌ Error sending command to Arduino: {e}")
        import traceback
        traceback.print_exc()
        return False


def arduino_reader_thread():
    """Background thread to continuously read distance from Arduino"""
    global distance_value
    while True:
        if arduino and arduino.is_open:
            read_arduino_distance()
        time.sleep(0.5)  # Read every 500ms


def save_detection_image(frame, status, source_name):
    """Save detection image with timestamp"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"detection_{timestamp}.jpg"
        filepath = os.path.join(IMAGES_DIR, filename)
        
        cv2.imwrite(filepath, frame)
        
        # Save detection metadata
        detection_data = {
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
            "source": source_name,
            "motion": status.get("motion"),
            "mode": status.get("mode"),
            "camera_mode": status.get("camera_mode"),
            "context": status.get("context"),
            "confidence": status.get("confidence", 0.0),
            "camera_risk": status.get("camera_risk", 0),
            "radar_risk": status.get("radar_risk", 0),
            "fused_risk": status.get("fused_risk", status.get("max_risk", 0)),
            "person_count": status.get("person_count", 0),
            "has_weapon": status.get("has_weapon", False),
            "weapon_type": status.get("weapon_type"),
            "radar": status.get("radar", {}),
        }
        
        # Load existing monitoring data
        monitoring_data = load_monitoring_data()
        monitoring_data["detections"].append(detection_data)
        
        # Keep only last 1000 detections
        if len(monitoring_data["detections"]) > 1000:
            monitoring_data["detections"] = monitoring_data["detections"][-1000:]
        
        save_monitoring_data(monitoring_data)
        
    except Exception as e:
        print(f"Error saving detection image: {e}")


def load_monitoring_data():
    """Load monitoring data from file"""
    try:
        if os.path.exists(MONITORING_FILE):
            with open(MONITORING_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading monitoring data: {e}")
    
    return {"detections": []}


def save_monitoring_data(data):
    """Save monitoring data to file"""
    try:
        with open(MONITORING_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving monitoring data: {e}")


def _legacy_gen_frames():
    """
    גנרטור שמוציא פריימים כ-MJPEG.
    הוא נקרא רק כשיש קליינט שמבקש /video_feed,
    ולכן הסטרים מתחיל כשאתה פותח את הדף.
    """
    global STATUS

    while True:
        active_camera = _ensure_camera()
        if active_camera is None:
            success = False
            frame = None
            annotated_frame = _camera_placeholder_frame(last_camera_error or "No camera frames are available.")
            status = {
                "status": "camera_unavailable",
                "mode": "SAFE",
                "camera_mode": "SAFE",
                "max_risk": 0,
                "camera_risk": 0,
                "radar_risk": 0,
                "fused_risk": 0,
                "tracks": [],
                "has_person": False,
                "person_count": 0,
                "person_boxes": [],
                "has_weapon": False,
                "weapon_type": None,
                "weapon_confidence": 0.0,
                "weapon_boxes": [],
                "motion": None,
                "confidence": 0.0,
                "context": last_camera_error or "Camera unavailable",
                "radar": STATUS.get("radar", {}),
            }
        else:
            success, frame = active_camera.read()
            if not success or frame is None:
                _reset_camera()
                annotated_frame = _camera_placeholder_frame("Camera frame read failed. Retrying capture backend.")
                status = {
                    "status": "camera_unavailable",
                    "mode": "SAFE",
                    "camera_mode": "SAFE",
                    "max_risk": 0,
                    "camera_risk": 0,
                    "radar_risk": 0,
                    "fused_risk": 0,
                    "tracks": [],
                    "has_person": False,
                    "person_count": 0,
                    "person_boxes": [],
                    "has_weapon": False,
                    "weapon_type": None,
                    "weapon_confidence": 0.0,
                    "weapon_boxes": [],
                    "motion": None,
                    "confidence": 0.0,
                    "context": "Camera frame read failed. Retrying capture backend.",
                    "radar": STATUS.get("radar", {}),
                }

        # מריצים את המוח – ניתוח הפריים
        if success and frame is not None:
            annotated_frame, status = analyze_frame(
                frame,
                radar_targets=_get_live_radar_snapshot(),
            )

        # מעדכן סטטוס גלובלי (למי שירצה /status)
        global alert_detected, danger_detected, last_alert_time, last_danger_time
        current_time = time.time()
        
        with status_lock:
            STATUS.update(status)
            STATUS["status"] = status.get("status", "active")
            STATUS["last_update"] = time.strftime("%H:%M:%S")
            
            # Read distance from Arduino
            distance = read_arduino_distance()
            if distance is not None:
                STATUS["distance"] = distance
            
            # Create detections array for frontend using actual bounding boxes
            detections = []
            
            # Add person detections with real bounding boxes
            person_boxes = status.get("person_boxes", [])
            for person_box in person_boxes:
                detections.append({
                    "class": "person",
                    "label": "person",
                    "score": person_box.get("confidence", status.get("confidence", 0.5)),
                    "bbox": person_box.get("bbox", [0, 0, 100, 100])
                })
            
            # Add weapon detections with real bounding boxes
            weapon_boxes = status.get("weapon_boxes", [])
            for weapon_box in weapon_boxes:
                detections.append({
                    "class": "weapon",
                    "label": weapon_box.get("type", status.get("weapon_type", "weapon")),
                    "score": weapon_box.get("confidence", status.get("weapon_confidence", 0.5)),
                    "bbox": weapon_box.get("bbox", [0, 0, 100, 100])
                })
            
            # Fallback: if no boxes but has person/weapon, create placeholder
            if len(detections) == 0:
                if status.get("has_person"):
                    person_count = status.get("person_count", 0)
                    for i in range(person_count):
                        detections.append({
                            "class": "person",
                            "label": "person",
                            "score": status.get("confidence", 0.5),
                            "bbox": [0, 0, 100, 100]  # Placeholder if no boxes
                        })
                
                if status.get("has_weapon"):
                    detections.append({
                        "class": "weapon",
                        "label": status.get("weapon_type", "weapon"),
                        "score": status.get("weapon_confidence", 0.5),
                        "bbox": [0, 0, 100, 100]
                    })
            
            STATUS["detections"] = detections
            
            # Save images for ALERT and DANGER modes
            mode = status.get("mode", "SAFE")
            
            # Debug: Print mode status (throttled to avoid spam)
            if not hasattr(gen_frames, 'frame_count'):
                gen_frames.frame_count = 0
            gen_frames.frame_count += 1
            if gen_frames.frame_count % 30 == 0:  # Print every 30 frames (about once per second)
                print(f"Mode: {mode}, Person: {status.get('has_person', False)}, Motion: {status.get('motion', 'None')}, Weapon: {status.get('has_weapon', False)}")
            
            # Check if current alert is still active (5 seconds duration)
            global arduino_alert_active, arduino_alert_start_time
            if arduino_alert_active:
                elapsed = current_time - arduino_alert_start_time
                if elapsed >= ARDUINO_ALERT_DURATION:
                    arduino_alert_active = False
                    print(f"✅ Alert duration completed ({ARDUINO_ALERT_DURATION}s)")
            
            if mode == "DANGER":
                # Save danger images more frequently
                if current_time - last_danger_time >= DANGER_COOLDOWN:
                    save_detection_image(annotated_frame, status, "webcam")
                    last_danger_time = current_time
                    danger_detected = True
                
                # Trigger Arduino alert for DANGER - only if no alert is active and cooldown passed
                global last_arduino_alert_time
                if not arduino_alert_active and current_time - last_arduino_alert_time >= ARDUINO_ALERT_COOLDOWN:
                    print(f"🚨 DANGER detected! Sending ALERT command to Arduino...")
                    if send_arduino_command("ALERT"):
                        arduino_alert_active = True
                        arduino_alert_start_time = current_time
                        last_arduino_alert_time = current_time
                elif arduino_alert_active:
                    remaining = ARDUINO_ALERT_DURATION - (current_time - arduino_alert_start_time)
                    if int(remaining) % 2 == 0:  # Print every 2 seconds
                        print(f"🚨 DANGER detected but alert already active ({remaining:.1f}s remaining)")
                else:
                    remaining = ARDUINO_ALERT_COOLDOWN - (current_time - last_arduino_alert_time)
                    if int(remaining) % 5 == 0:  # Print every 5 seconds to avoid spam
                        print(f"🚨 DANGER detected but cooldown active ({remaining:.1f}s remaining)")
                    
            elif mode == "ALERT":
                # Save alert images with cooldown
                if current_time - last_alert_time >= ALERT_COOLDOWN:
                    save_detection_image(annotated_frame, status, "webcam")
                    last_alert_time = current_time
                    alert_detected = True
                
                # Trigger Arduino alert for ALERT - only if no alert is active and cooldown passed
                if not arduino_alert_active and current_time - last_arduino_alert_time >= ARDUINO_ALERT_COOLDOWN:
                    print(f"⚠️ ALERT detected! Sending ALERT command to Arduino...")
                    if send_arduino_command("ALERT"):
                        arduino_alert_active = True
                        arduino_alert_start_time = current_time
                        last_arduino_alert_time = current_time
                elif arduino_alert_active:
                    remaining = ARDUINO_ALERT_DURATION - (current_time - arduino_alert_start_time)
                    if int(remaining) % 2 == 0:  # Print every 2 seconds
                        print(f"⚠️ ALERT detected but alert already active ({remaining:.1f}s remaining)")
                else:
                    remaining = ARDUINO_ALERT_COOLDOWN - (current_time - last_arduino_alert_time)
                    if int(remaining) % 5 == 0:  # Print every 5 seconds to avoid spam
                        print(f"⚠️ ALERT detected but cooldown active ({remaining:.1f}s remaining)")
            else:
                # Reset flags when mode is SAFE
                if alert_detected or danger_detected:
                    alert_detected = False
                    danger_detected = False

        # מקודד את הפריים ל-JPEG
        ret, buffer = cv2.imencode(".jpg", annotated_frame)
        if not ret:
            continue
        jpg_bytes = buffer.tobytes()

        # מחזיר כ-MJPEG stream
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpg_bytes + b"\r\n"
        )


def gen_frames(source_name="webcam"):
    """Stream analyzed MJPEG frames for a specific camera source."""
    source_key = "dahua" if str(source_name or "").lower() == "dahua" else "webcam"
    frame_counter_attr = f"{source_key}_frame_count"

    while True:
        read_arduino_distance()

        frame = None
        annotated_frame = None
        connected = False
        last_error = None
        status = _default_camera_status(source_key)

        if source_key == "webcam":
            active_camera = _ensure_camera()
            if active_camera is None:
                last_error = last_camera_error or "No camera frames are available."
                annotated_frame = _camera_placeholder_frame(last_error)
                status.update(
                    {
                        "status": "camera_unavailable",
                        "context": last_error,
                        "radar": CAMERA_STATUS.get("webcam", {}).get("radar", _blank_radar_payload()),
                    }
                )
                reset_analysis_context("webcam")
            else:
                try:
                    success, frame = active_camera.read()
                except Exception as exc:
                    success = False
                    frame = None
                    last_error = str(exc)

                if not success or frame is None:
                    _reset_camera()
                    last_error = last_error or "Camera frame read failed. Retrying capture backend."
                    annotated_frame = _camera_placeholder_frame(last_error)
                    status.update(
                        {
                            "status": "camera_unavailable",
                            "context": last_error,
                            "radar": CAMERA_STATUS.get("webcam", {}).get("radar", _blank_radar_payload()),
                        }
                    )
                    reset_analysis_context("webcam")
                else:
                    connected = True
        else:
            dahua_config = _get_dahua_config()
            if not _is_dahua_config_complete(dahua_config):
                last_error = "Dahua RTSP configuration is incomplete."
                annotated_frame = _dahua_placeholder_frame(last_error)
                status.update(
                    {
                        "status": "disconnected",
                        "context": last_error,
                        "radar": CAMERA_STATUS.get("dahua", {}).get("radar", _blank_radar_payload()),
                    }
                )
                reset_analysis_context("dahua")
            else:
                reader = _ensure_dahua_reader(start_if_needed=True)
                reader_status = reader.get_status() if reader is not None else {}
                connected = bool(reader_status.get("connected"))
                last_error = reader_status.get("last_error")
                frame = reader.get_latest_frame() if reader is not None else None

                if frame is None:
                    waiting_message = last_error or (
                        "Waiting for the first Dahua RTSP frame."
                        if connected
                        else "No frame received from the RTSP stream."
                    )
                    annotated_frame = _dahua_placeholder_frame(waiting_message)
                    status.update(
                        {
                            "status": reader_status.get("status", "disconnected"),
                            "context": waiting_message,
                            "radar": CAMERA_STATUS.get("dahua", {}).get("radar", _blank_radar_payload()),
                        }
                    )
                    if not connected:
                        reset_analysis_context("dahua")
                else:
                    connected = True

        if frame is not None:
            try:
                annotated_frame, status = analyze_frame_for_source(
                    source_key,
                    frame,
                    radar_targets=_get_live_radar_snapshot(),
                )
            except Exception as exc:
                last_error = sanitize_error_message(exc) or "Frame analysis failed."
                annotated_frame = frame.copy()
                status = _default_camera_status(
                    source_key,
                    status="analysis_error",
                    context=last_error,
                    connected=connected,
                    last_error=last_error,
                )

        status_payload = process_status_update(
            source_key,
            annotated_frame,
            status,
            connected=connected,
            last_error=last_error,
        )

        if not hasattr(gen_frames, frame_counter_attr):
            setattr(gen_frames, frame_counter_attr, 0)
        setattr(gen_frames, frame_counter_attr, getattr(gen_frames, frame_counter_attr) + 1)
        if getattr(gen_frames, frame_counter_attr) % 60 == 0:
            print(
                f"[{source_key}] status={status_payload.get('status')} "
                f"mode={status_payload.get('mode')} "
                f"person={status_payload.get('has_person')} "
                f"weapon={status_payload.get('has_weapon')}"
            )

        ret, buffer = cv2.imencode(".jpg", annotated_frame)
        if not ret:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
        )


@app.route("/api/scenario-analysis", methods=["POST"])
def scenario_analysis():
    """Queue an uploaded video for asynchronous scenario analysis."""
    uploaded_video = request.files.get("video")
    if uploaded_video is None:
        return jsonify({"success": False, "error": "No video file was provided."}), 400

    if not uploaded_video.filename:
        return jsonify({"success": False, "error": "Please choose a video file before starting analysis."}), 400

    if not _is_allowed_scenario_file(uploaded_video.filename):
        return jsonify({
            "success": False,
            "error": "Unsupported file type. Please upload an MP4, AVI, MOV, or M4V video.",
        }), 400

    paths = _scenario_output_paths(uploaded_video.filename)
    uploaded_path = paths["uploaded_path"]
    job_id = uuid.uuid4().hex
    host_base_url = request.host_url.rstrip("/")

    try:
        uploaded_video.save(uploaded_path)
        if not os.path.exists(uploaded_path) or os.path.getsize(uploaded_path) == 0:
            _cleanup_scenario_artifacts(paths, include_output=True)
            return jsonify({"success": False, "error": "The uploaded video could not be saved or is empty."}), 400

        with scenario_jobs_lock:
            scenario_jobs[job_id] = {
                "job_id": job_id,
                "status": "queued",
                "stage": "Uploading completed, waiting to start",
                "progress_percent": 0,
                "created_at": datetime.now().isoformat(),
                "started_at": None,
                "finished_at": None,
                "source_filename": paths["safe_name"],
                "output_filename": paths["output_filename"],
                "summary": None,
                "video_url": None,
                "error": None,
                "frames_total": 0,
                "frames_read": 0,
                "frames_analyzed": 0,
                "frame_skip": SCENARIO_FRAME_SKIP,
                "max_width": SCENARIO_MAX_WIDTH,
                "output_width": None,
                "output_height": None,
            }

        worker = threading.Thread(
            target=_run_scenario_video_analysis,
            args=(job_id, paths, host_base_url),
            daemon=True,
        )
        worker.start()

        return jsonify({
            "success": True,
            "job_id": job_id,
            "status": "queued",
            "stage": "Uploading completed, waiting to start",
            "progress_percent": 0,
            "output_filename": paths["output_filename"],
            "status_url": f"{host_base_url}/api/scenario-analysis/{job_id}",
            "frame_skip": SCENARIO_FRAME_SKIP,
            "max_width": SCENARIO_MAX_WIDTH,
        }), 202
    except Exception as exc:
        _cleanup_scenario_artifacts(paths, include_output=True)
        return jsonify({"success": False, "error": f"Unexpected scenario analysis error: {exc}"}), 500


@app.route("/api/scenario-analysis/<job_id>", methods=["GET"])
def scenario_analysis_status(job_id):
    """Return the current status of an asynchronous scenario analysis job."""
    job = _get_scenario_job(job_id)
    if job is None:
        return jsonify({"success": False, "error": "Scenario analysis job was not found."}), 404

    return jsonify({"success": True, **job})


@app.route("/api/scenario-history", methods=["GET"])
def scenario_history():
    """Return saved scenario analysis results for replay in the dashboard."""
    host_base_url = request.host_url.rstrip("/")
    history = _list_scenario_history(host_base_url)
    return jsonify({"success": True, "history": history})


@app.route("/api/scenario-history/<path:output_filename>", methods=["DELETE"])
def delete_scenario_history_item(output_filename):
    """Delete a saved scenario analysis result and its rendered video."""
    paths = _scenario_history_paths(output_filename)
    if paths is None:
        return jsonify({"success": False, "error": "Invalid scenario history item."}), 400

    output_exists = os.path.exists(paths["output_path"])
    summary_exists = os.path.exists(paths["summary_path"])
    if not output_exists and not summary_exists:
        return jsonify({"success": False, "error": "Scenario history item was not found."}), 404

    _remove_file_if_exists(paths["output_path"])
    _remove_file_if_exists(paths["summary_path"])

    with scenario_jobs_lock:
        stale_job_ids = [
            job_id
            for job_id, job in scenario_jobs.items()
            if job.get("output_filename") == paths["output_filename"]
            and job.get("status") not in {"queued", "processing"}
        ]
        for job_id in stale_job_ids:
            scenario_jobs.pop(job_id, None)

    return jsonify({"success": True, "deleted_id": paths["output_filename"]})


@app.route("/api/scenario-outputs/<path:filename>", methods=["GET"])
def get_scenario_output(filename):
    """Serve analyzed scenario videos from the outputs directory."""
    response = send_from_directory(OUTPUTS_DIR, filename)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve the built frontend from `python/dist` when available.
    Falls back to template rendering or the local `python/index.html` file.
    """
    dist_dir = os.path.join(os.path.dirname(__file__), 'dist')
    # If a production build exists, serve it
    if os.path.exists(dist_dir):
        requested = os.path.join(dist_dir, path)
        if path and os.path.exists(requested):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, 'index.html')

    # Otherwise try normal template rendering
    try:
        return render_template('index.html')
    except Exception:
        try:
            return send_from_directory(os.path.dirname(__file__), 'index.html')
        except Exception as e:
            return jsonify({'error': 'Index not found', 'detail': str(e)}), 500


@app.route("/video_feed")
def video_feed():
    # כאן הדפדפן מבקש את הסטרים – וזה מה שמפעיל את gen_frames()
    return Response(
        gen_frames("webcam"),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/video_feed/webcam")
def video_feed_webcam():
    return Response(
        gen_frames("webcam"),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/video_feed/dahua")
def video_feed_dahua():
    return Response(
        gen_frames("dahua"),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/status")
def status():
    # נקודת קצה למידע JSON (לא חובה, אבל שימושי לפרונטנד)
    with status_lock:
        payload = dict(STATUS)
    payload["radar"] = _get_live_radar_snapshot()
    payload["radar_risk"] = int(
        payload["radar"].get("max_radar_risk", payload.get("radar_risk", 0)) or 0
    )
    return jsonify(payload)


@app.route("/api/cameras/status", methods=["GET"])
def camera_status():
    return jsonify(_build_camera_status_response())


@app.route("/api/radar/live", methods=["GET"])
def radar_live_status():
    return jsonify(_get_live_radar_snapshot())


@app.route("/api/cameras/dahua/reconnect", methods=["POST"])
def reconnect_dahua_camera():
    config = _get_dahua_config()
    if not _is_dahua_config_complete(config):
        return jsonify(
            {
                "success": False,
                "message": "Dahua RTSP configuration is incomplete.",
                "status": _build_camera_status_response().get("dahua", {}),
            }
        ), 400

    try:
        reset_analysis_context("dahua")
        reader = _restart_dahua_reader()
        return jsonify(
            {
                "success": reader is not None,
                "message": "Dahua RTSP reconnect requested.",
                "status": _build_camera_status_response().get("dahua", {}),
            }
        )
    except Exception as exc:
        return jsonify(
            {
                "success": False,
                "message": "Dahua RTSP reconnect failed.",
                "status": _build_camera_status_response().get("dahua", {}),
                "sanitized_error": _sanitize_dahua_error(exc),
            }
        ), 500


@app.route("/api/cameras/dahua/test", methods=["GET"])
def test_dahua_camera():
    config = _get_dahua_config()
    if not _is_dahua_config_complete(config):
        return jsonify(
            {
                "success": False,
                "connected": False,
                "frame_read": False,
                "sanitized_error": "Dahua RTSP configuration is incomplete.",
            }
        ), 400

    test_result = test_rtsp_connection(config)
    test_result.update(
        {
            "host": config.get("host"),
            "port": config.get("port"),
            "channel": config.get("channel"),
            "subtype": config.get("subtype"),
        }
    )
    return jsonify(test_result), (200 if test_result.get("success") else 503)


@app.route("/api/radar-config", methods=["GET"])
def get_radar_config():
    payload = _radar_config_response()
    status_code = 200 if payload.get("success") else 503
    return jsonify(payload), status_code


@app.route("/api/radar-config", methods=["PUT"])
def update_radar_config():
    if not _radar_config_supported():
        return jsonify({
            "success": False,
            "error": "Radar configuration support is unavailable. Running in camera-only mode.",
        }), 503

    request_data = request.json if isinstance(request.json, dict) else {}
    updates = request_data.get("config") if isinstance(request_data.get("config"), dict) else request_data

    current_config = load_radar_config()
    current_config.update(updates or {})

    try:
        saved_config = save_radar_config(current_config)
    except Exception as exc:
        return jsonify({
            "success": False,
            "error": f"Radar configuration could not be saved: {exc}",
        }), 500

    return jsonify({
        "success": True,
        "config": saved_config,
        "available_scenarios": get_available_radar_scenarios(),
    })


@app.route("/api/test-alert", methods=["POST", "GET"])
def test_alert():
    """Test endpoint to manually trigger alert"""
    try:
        result = send_arduino_command("ALERT")
        if result:
            return jsonify({"success": True, "message": "ALERT command sent to Arduino"})
        else:
            return jsonify({"success": False, "message": "Arduino not connected"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/arduino-messages", methods=["GET"])
def get_arduino_messages():
    """Get Arduino serial messages for frontend console"""
    global arduino_messages
    with arduino_lock:
        # Return messages in reverse order (newest first)
        messages = list(reversed(arduino_messages[-50:]))  # Last 50 messages
        return jsonify({"messages": messages})


@app.route("/api/arduino-status", methods=["GET"])
def arduino_status():
    """Get Arduino connection status"""
    global arduino
    is_connected = arduino is not None and arduino.is_open if arduino else False
    port = arduino.port if arduino and arduino.is_open else None
    return jsonify({
        "connected": is_connected,
        "port": port,
        "message": f"Arduino connected on {port}" if is_connected else "Arduino not connected"
    })


@app.route("/api/arduino-reconnect", methods=["POST"])
def arduino_reconnect():
    """Manually reconnect to Arduino"""
    global arduino
    try:
        # Close existing connection if any
        if arduino and arduino.is_open:
            arduino.close()
        
        # Try to reconnect
        result = init_arduino()
        if result:
            return jsonify({"success": True, "message": f"Arduino connected on {arduino.port}"})
        else:
            return jsonify({"success": False, "message": "Failed to connect to Arduino. Check if it's connected and drivers are installed."}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/arduino-debug", methods=["GET", "POST"])
def arduino_debug():
    """Debug endpoint to test Arduino communication"""
    global arduino, arduino_messages
    debug_info = {
        "arduino_connected": arduino is not None and arduino.is_open if arduino else False,
        "arduino_port": arduino.port if arduino and arduino.is_open else None,
        "bytes_in_waiting": arduino.in_waiting if arduino and arduino.is_open else 0,
        "recent_messages": list(reversed(arduino_messages[-10:])),  # Last 10 messages
        "test_command_result": None
    }
    
    # If POST, also try sending a test command
    if request.method == "POST":
        test_cmd = request.json.get("command", "LIGHT_ON") if request.json else "LIGHT_ON"
        debug_info["test_command"] = test_cmd
        debug_info["test_command_result"] = send_arduino_command(test_cmd)
    
    return jsonify(debug_info)


@app.route("/api/detections")
def get_detections():
    """Get all saved detections"""
    monitoring_data = load_monitoring_data()
    # Return in reverse chronological order
    detections = monitoring_data.get("detections", [])
    detections.reverse()  # Most recent first
    return jsonify(detections)


@app.route("/api/images/<filename>")
def get_image(filename):
    """Serve saved detection images"""
    return send_from_directory(IMAGES_DIR, filename)


@app.route("/api/detections", methods=["DELETE"])
def clear_detections():
    """Clear all detection history and images"""
    try:
        # Clear monitoring data
        save_monitoring_data({"detections": []})
        
        # Clear all images
        if os.path.exists(IMAGES_DIR):
            for filename in os.listdir(IMAGES_DIR):
                file_path = os.path.join(IMAGES_DIR, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
        
        return jsonify({"success": True, "message": "All detection history cleared"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def load_users():
    """Load users from file"""
    try:
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                users = json.load(f)
                # Ensure we have at least the admin user
                if not any(u.get("username") == "admin" for u in users):
                    admin_user = {
                        "id": 1,
                        "username": "admin",
                        "password": "Aa123456",
                        "role": "admin",
                        "email": "admin@smartsecurity.com",
                        "createdAt": datetime.now().isoformat()
                    }
                    users.append(admin_user)
                    save_users(users)
                return users
    except Exception as e:
        print(f"Error loading users: {e}")
    
    # Return default admin user if file doesn't exist
    default_users = [
        {
            "id": 1,
            "username": "admin",
            "password": "Aa123456",
            "role": "admin",
            "email": "admin@smartsecurity.com",
            "createdAt": datetime.now().isoformat()
        }
    ]
    # Save default users
    try:
        save_users(default_users)
    except:
        pass
    return default_users


def save_users(users_data):
    """Save users to file"""
    try:
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving users: {e}")


@app.route("/api/users", methods=["GET"])
def get_users():
    """Get all users"""
    users = load_users()
    # Remove passwords from response
    safe_users = [{k: v for k, v in user.items() if k != "password"} for user in users]
    return jsonify(safe_users)


@app.route("/api/users", methods=["POST"])
def create_user():
    """Create a new user"""
    data = request.json
    users = load_users()
    
    # Check if username or email exists
    if any(u["username"] == data.get("username") for u in users):
        return jsonify({"success": False, "error": "Username already exists"}), 400
    
    if any(u["email"] == data.get("email") for u in users):
        return jsonify({"success": False, "error": "Email already exists"}), 400
    
    new_user = {
        "id": max([u["id"] for u in users], default=0) + 1,
        "username": data.get("username"),
        "password": data.get("password"),
        "email": data.get("email"),
        "role": data.get("role", "pending"),
        "createdAt": datetime.now().isoformat()
    }
    
    users.append(new_user)
    save_users(users)
    
    safe_user = {k: v for k, v in new_user.items() if k != "password"}
    return jsonify({"success": True, "user": safe_user})


@app.route("/api/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    """Update a user"""
    data = request.json
    users = load_users()
    
    user_index = next((i for i, u in enumerate(users) if u["id"] == user_id), None)
    if user_index is None:
        return jsonify({"success": False, "error": "User not found"}), 404
    
    # Update user
    for key, value in data.items():
        if key != "id" and key != "password" or value:  # Allow password updates
            users[user_index][key] = value
    
    save_users(users)
    
    safe_user = {k: v for k, v in users[user_index].items() if k != "password"}
    return jsonify({"success": True, "user": safe_user})


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    """Delete a user"""
    users = load_users()
    users = [u for u in users if u["id"] != user_id]
    save_users(users)
    return jsonify({"success": True})


@app.route("/api/login", methods=["POST"])
def login():
    """Login endpoint"""
    try:
        if not request.json:
            print("Login attempt: No JSON data provided")
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        data = request.json
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        
        print(f"Login attempt for username: {username}")
        
        if not username or not password:
            return jsonify({"success": False, "error": "Username and password are required"}), 400
        
        users = load_users()
        print(f"Loaded {len(users)} users from file")
        
        user = next((u for u in users if u.get("username", "").strip() == username and u.get("password", "").strip() == password), None)
        
        if not user:
            print(f"Login failed: Invalid credentials for {username}")
            return jsonify({"success": False, "error": "Invalid username or password"}), 401
        
        if user.get("role") == "pending":
            print(f"Login failed: Account {username} is pending approval")
            return jsonify({"success": False, "error": "Your account is pending approval"}), 403
        
        safe_user = {k: v for k, v in user.items() if k != "password"}
        print(f"Login successful for user: {username}")
        return jsonify({"success": True, "user": safe_user})
    except Exception as e:
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": "Server error during login"}), 500


if __name__ == "__main__":
    # Initialize data files if they don't exist
    if not os.path.exists(MONITORING_FILE):
        save_monitoring_data({"detections": []})
    
    # Initialize users file with default admin if it doesn't exist
    if not os.path.exists(USERS_FILE):
        default_users = [
            {
                "id": 1,
                "username": "admin",
                "password": "Aa123456",
                "role": "admin",
                "email": "admin@smartsecurity.com",
                "createdAt": datetime.now().isoformat()
            }
        ]
        save_users(default_users)
    
    # Initialize Arduino connection
    if init_arduino():
        # Start background thread to read distance
        arduino_thread = threading.Thread(target=arduino_reader_thread, daemon=True)
        arduino_thread.start()

    try:
        _ensure_dahua_reader(start_if_needed=True)
    except Exception as exc:
        print(f"Dahua RTSP reader initialization skipped: {_sanitize_dahua_error(exc) or 'unknown error'}")
    
    # 0.0.0.0 כדי שיהיה אפשר להתחבר גם ממכשירים אחרים ברשת
    # Disable debug mode to prevent dual-process issue with serial ports
    # Debug mode causes Flask to run two processes, which causes COM port conflicts
    app.run(host="0.0.0.0", port=5000, debug=False)
