# analysis.py - Advanced Behavioral Engine V3.1
# Drop-in replacement for the user's current file structure
# Adds:
# - robust model init with Hugging Face auto-download fallback for weapon model
# - optional sensor fusion hooks for MCU distance/PIR/tamper inputs
# - safer weapon-to-person association
# - slightly improved track association without changing public entrypoint

from ultralytics import YOLO
import cv2
import time
import math
import threading
from collections import deque

try:
    from huggingface_hub import hf_hub_download
except Exception:
    hf_hub_download = None

try:
    from ld2450_reader import get_shared_radar_provider, load_radar_config
except Exception:
    get_shared_radar_provider = None
    load_radar_config = None

# =========================
# CONFIG
# =========================

FENCE_LINE_Y = 600
GATE_POINT = (960, 1080)  # gate point for 1920x1080 default view
MAX_MISSES = 10

LOITER_TIME_THRESHOLD = 15
RISK_DECAY_PER_SECOND = 0.85
SUSPICIOUS_CONTEXT_DECAY_PER_SECOND = 1.0

APPROACH_SPEED_THRESHOLD = 40
RUN_THRESHOLD = 120
STAND_THRESHOLD = 15

WEAPON_TIMEOUT = 3

GLOBAL_ALERT_THRESHOLD = 40
GLOBAL_DANGER_THRESHOLD = 75

SPEED_WINDOW_SECONDS = 1.0

# --- profile ---
PROFILE = "perimeter"  # "perimeter" or "factory"
PROFILES = {
    "factory": {
        "run_risk": 3,
        "approach_risk": 10,
        "loiter_risk": 15,
        "near_fence_risk_per_sec": 1.5,
        "near_gate_risk_per_sec": 2.5,
        "loiter_risk_per_sec": 1.0,
        "gate_loiter_risk_per_sec": 1.75,
        "weapon_floor_risk": 70,
        "weapon_risk_per_sec": 18,
        "weapon_approach_risk_per_sec": 25,
        "running_is_suspicious": False,
    },
    "perimeter": {
        "run_risk": 8,
        "approach_risk": 15,
        "loiter_risk": 20,
        "near_fence_risk_per_sec": 3.0,
        "near_gate_risk_per_sec": 4.5,
        "loiter_risk_per_sec": 1.5,
        "gate_loiter_risk_per_sec": 2.5,
        "weapon_floor_risk": 85,
        "weapon_risk_per_sec": 25,
        "weapon_approach_risk_per_sec": 40,
        "running_is_suspicious": True,
    },
}

# --- detector settings ---
PERSON_CONF = 0.50
WEAPON_CONF = 0.40
TRACK_MATCH_IOU_THRESHOLD = 0.30
WEAPON_PERSON_IOU_THRESHOLD = 0.15
MAX_CENTER_DISTANCE_FOR_MATCH = 180.0
FENCE_BAND_PX = 120
NEAR_GATE_RADIUS_PX = 240
WEAPON_CONFIRM_FRAMES = 2
SHOW_DEBUG_OVERLAY_ON_CAMERA = False

# --- weapon model source ---
# 1) if local ./weapon_best.pt exists, it will be used
# 2) otherwise, if huggingface_hub is installed and internet is available,
#    the code will download a ready model from HF cache.
WEAPON_MODEL_LOCAL_PATH = "weapon_best.pt"
WEAPON_MODEL_HF_REPO = "Subh775/Threat-Detection-YOLOv8n"
WEAPON_MODEL_HF_FILENAME = "weights/best.pt"

# =========================
# GLOBAL STATE
# =========================

tracks = {}
_next_track_id = 1
_person_model = None
_weapon_model = None
_weapon_model_error = None  # full details stay server-side only, never sent to API/UI
_weapon_model_load_attempted = False
_models_init_lock = threading.Lock()
_previous_global_mode = "SAFE"
_recent_events = deque(maxlen=25)
DEFAULT_SOURCE_ID = "default"
_source_contexts = {}
_source_contexts_lock = threading.Lock()
_analysis_lock = threading.Lock()

# Optional external sensor state
sensor_state = {
    "distance_m": None,
    "pir": False,
    "tamper": False,
    "last_update": 0.0,
}
SENSOR_TTL_SECONDS = 2.5
SENSOR_DISTANCE_ALERT_M = 2.5
SENSOR_DISTANCE_DANGER_M = 1.2

_radar_provider = None


def _new_source_context():
    return {
        "tracks": {},
        "next_track_id": 1,
        "previous_global_mode": "SAFE",
    }


def _get_source_context(source_id):
    source_key = str(source_id or DEFAULT_SOURCE_ID)
    with _source_contexts_lock:
        context = _source_contexts.get(source_key)
        if context is None:
            context = _new_source_context()
            _source_contexts[source_key] = context
        return context


def _sync_default_globals(source_context):
    global tracks, _next_track_id, _previous_global_mode
    tracks = source_context["tracks"]
    _next_track_id = int(source_context["next_track_id"])
    _previous_global_mode = source_context["previous_global_mode"]


def reset_analysis_context(source_id=DEFAULT_SOURCE_ID):
    source_key = str(source_id or DEFAULT_SOURCE_ID)
    with _source_contexts_lock:
        _source_contexts[source_key] = _new_source_context()
        context = _source_contexts[source_key]

    if source_key == DEFAULT_SOURCE_ID:
        _sync_default_globals(context)

# =========================
# INIT
# =========================


def _resolve_weapon_model_path():
    import os

    if os.path.exists(WEAPON_MODEL_LOCAL_PATH):
        return WEAPON_MODEL_LOCAL_PATH

    if hf_hub_download is None:
        raise FileNotFoundError(
            "weapon_best.pt not found locally, and huggingface_hub is not installed. "
            "Install it with: pip install huggingface_hub"
        )

    return hf_hub_download(
        repo_id=WEAPON_MODEL_HF_REPO,
        filename=WEAPON_MODEL_HF_FILENAME,
    )


def _init_models():
    """Load the person model (required) and the weapon model (optional).

    A weapon-model failure must never disable person detection: it is caught,
    logged once, and weapon detection is marked unavailable for this process.
    """
    global _person_model, _weapon_model, _weapon_model_error, _weapon_model_load_attempted

    with _models_init_lock:
        if _person_model is None:
            _person_model = YOLO("yolov8n.pt")

        if _weapon_model is None and not _weapon_model_load_attempted:
            _weapon_model_load_attempted = True
            try:
                weapon_model_path = _resolve_weapon_model_path()
                _weapon_model = YOLO(weapon_model_path)
                _weapon_model_error = None
            except Exception as exc:
                _weapon_model = None
                _weapon_model_error = f"{type(exc).__name__}: {exc}"
                print(
                    "WARNING: weapon detection disabled - person detection continues. "
                    f"Weapon model load failed: {_weapon_model_error}"
                )


# =========================
# OPTIONAL SENSOR HOOK
# =========================


def update_sensor_state(payload):
    """
    Optional external hook for MCU/gateway.
    Example:
        update_sensor_state({"distance_m": 1.8, "pir": True, "tamper": False})
    """
    sensor_state["distance_m"] = payload.get("distance_m")
    sensor_state["pir"] = bool(payload.get("pir", False))
    sensor_state["tamper"] = bool(payload.get("tamper", False))
    sensor_state["last_update"] = time.time()


# =========================
# UTILS
# =========================


def _profile_cfg():
    return PROFILES.get(PROFILE, PROFILES["perimeter"])


def _get_center(bbox):
    x, y, w, h = bbox
    return x + w / 2.0, y + h / 2.0


def _bbox_area(bbox):
    return max(0, bbox[2]) * max(0, bbox[3])


def _normalize(dx, dy):
    mag = math.hypot(dx, dy)
    if mag == 0:
        return 0.0, 0.0
    return dx / mag, dy / mag


def _euclidean(p1, p2):
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def _compute_speed(history, now):
    recent = [p for p in history if now - p[2] <= SPEED_WINDOW_SECONDS]
    if len(recent) < 2:
        return 0.0

    x0, y0, t0 = recent[0]
    x1, y1, t1 = recent[-1]

    dt = t1 - t0
    if dt <= 0:
        return 0.0

    return math.hypot(x1 - x0, y1 - y0) / dt


def _vector_to_gate(center):
    gx, gy = GATE_POINT
    dx = gx - center[0]
    dy = gy - center[1]
    return _normalize(dx, dy)


def _distance_to_gate(center):
    return _euclidean(center, GATE_POINT)


# =========================
# SENSOR FUSION / RADAR
# =========================


def _clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def _mode_from_risk(risk):
    if risk >= GLOBAL_DANGER_THRESHOLD:
        return "DANGER"
    if risk >= GLOBAL_ALERT_THRESHOLD:
        return "ALERT"
    return "SAFE"


def combine_camera_risk_and_radar_risk(camera_risk, radar_risk, radar_confidence=1.0):
    radar_confidence = _clamp(float(radar_confidence), 0.0, 1.0)
    effective_radar_risk = float(radar_risk) * (0.30 + (0.70 * radar_confidence))

    if camera_risk >= GLOBAL_DANGER_THRESHOLD and effective_radar_risk >= 45:
        fused_risk = max(float(camera_risk), effective_radar_risk, 90.0)
    elif camera_risk >= GLOBAL_ALERT_THRESHOLD and effective_radar_risk >= 25:
        fused_risk = max(float(camera_risk), float(camera_risk) + (effective_radar_risk * 0.25), 60.0)
    elif camera_risk < GLOBAL_ALERT_THRESHOLD and effective_radar_risk >= 60:
        fused_risk = max(float(camera_risk), 42.0 + (effective_radar_risk * 0.35))
    else:
        fused_risk = max(float(camera_risk), (float(camera_risk) * 0.80) + (effective_radar_risk * 0.65))

    return int(round(_clamp(fused_risk, 0.0, 100.0)))


def _get_radar_provider():
    global _radar_provider

    if get_shared_radar_provider is None:
        return None

    if _radar_provider is None:
        try:
            _radar_provider = get_shared_radar_provider()
        except Exception:
            _radar_provider = False

    return _radar_provider if _radar_provider is not False else None


def _show_debug_overlay_on_camera(provider=None):
    if provider not in (None, False):
        provider_config = getattr(provider, "config", None)
        if isinstance(provider_config, dict):
            return bool(provider_config.get("show_debug_overlay_on_camera", SHOW_DEBUG_OVERLAY_ON_CAMERA))

    if callable(load_radar_config):
        try:
            config = load_radar_config()
            if isinstance(config, dict):
                return bool(config.get("show_debug_overlay_on_camera", SHOW_DEBUG_OVERLAY_ON_CAMERA))
        except Exception:
            pass

    return SHOW_DEBUG_OVERLAY_ON_CAMERA


def _empty_radar_payload(now=None, enabled=False, mode="camera_only", scenario="idle"):
    return {
        "enabled": enabled,
        "mode": mode,
        "provider": mode,
        "scenario": scenario,
        "radar_connected": False,
        "radar_status": "DISCONNECTED" if enabled else "DISABLED",
        "last_update_ms": None,
        "targets_count": 0,
        "targets": [],
        "max_radar_risk": 0,
        "confidence": 0.0,
        "show_debug_overlay_on_camera": SHOW_DEBUG_OVERLAY_ON_CAMERA,
        "timestamp": time.time() if now is None else now,
    }


def _direction_from_speed_cm_s(speed_cm_s):
    speed_value = float(speed_cm_s or 0.0)
    if speed_value <= -10.0:
        return "approaching"
    if speed_value >= 10.0:
        return "receding"
    return "stationary"


def _estimate_radar_target_risk(target):
    distance_mm = float(target.get("distance_mm", 0.0) or 0.0)
    speed_cm_s = float(target.get("speed_cm_s", 0.0) or 0.0)
    abs_speed_cm_s = abs(speed_cm_s)
    resolution_mm = float(target.get("resolution_mm", 0.0) or 0.0)
    approaching = speed_cm_s < -10.0
    angle_deg = abs(float(target.get("angle_deg", 0.0) or 0.0))

    risk = 0.0
    if distance_mm <= 2000.0:
        risk += 24.0
    if distance_mm <= 3000.0 and angle_deg <= 45.0:
        risk += 18.0
    if abs_speed_cm_s >= 60.0:
        risk += 16.0
    if abs_speed_cm_s >= 120.0:
        risk += 22.0
    if approaching:
        risk += 14.0
    if distance_mm <= 1500.0:
        risk += 10.0
    if resolution_mm >= 250.0:
        risk += 6.0
    return int(round(_clamp(risk, 0.0, 100.0)))


def _normalize_external_radar_target(raw_target, now, fallback_id):
    if not isinstance(raw_target, dict):
        return None

    target_id = int(raw_target.get("id", raw_target.get("radar_id", fallback_id)) or fallback_id)
    x_mm = int(round(float(raw_target.get("x_mm", 0.0) or 0.0)))
    y_mm = int(round(float(raw_target.get("y_mm", 0.0) or 0.0)))
    distance_mm = raw_target.get("distance_mm")
    if distance_mm is None:
        distance_mm = int(round(math.hypot(x_mm, y_mm)))
    else:
        distance_mm = int(round(float(distance_mm or 0.0)))

    angle_deg = raw_target.get("angle_deg")
    if angle_deg is None:
        angle_deg = round(math.degrees(math.atan2(x_mm, max(y_mm, 1))), 1)
    else:
        angle_deg = round(float(angle_deg or 0.0), 1)

    speed_cm_s = raw_target.get("speed_cm_s")
    if speed_cm_s is None:
        speed_cm_s = float(raw_target.get("speed_mm_s", 0.0) or 0.0) / 10.0
    speed_cm_s = float(speed_cm_s or 0.0)

    speed_mm_s = raw_target.get("speed_mm_s")
    if speed_mm_s is None:
        speed_mm_s = speed_cm_s * 10.0
    speed_mm_s = float(speed_mm_s or 0.0)

    normalized = {
        "id": target_id,
        "radar_id": target_id,
        "x_mm": x_mm,
        "y_mm": y_mm,
        "distance_mm": distance_mm,
        "angle_deg": angle_deg,
        "speed_cm_s": int(round(speed_cm_s)),
        "speed_mm_s": int(round(speed_mm_s)),
        "resolution_mm": int(round(float(raw_target.get("resolution_mm", 0.0) or 0.0))),
        "timestamp": float(raw_target.get("timestamp", now) or now),
        "valid": bool(raw_target.get("valid", True)),
        "direction": str(raw_target.get("direction", _direction_from_speed_cm_s(speed_cm_s))),
        "approaching_gate": bool(
            raw_target.get(
                "approaching_gate",
                speed_cm_s < -10.0 and angle_deg <= 45.0 and distance_mm <= 6000,
            )
        ),
        "confidence": float(raw_target.get("confidence", 0.95) or 0.95),
    }
    normalized["radar_risk"] = int(raw_target.get("radar_risk", _estimate_radar_target_risk(normalized)) or 0)

    if not normalized["valid"] or normalized["distance_mm"] <= 0:
        return None
    return normalized


def _payload_from_external_radar(radar_targets, now, debug_overlay_enabled):
    if radar_targets is None:
        return None

    if isinstance(radar_targets, dict):
        normalized_targets = []
        for index, target in enumerate(radar_targets.get("targets", []), start=1):
            normalized_target = _normalize_external_radar_target(target, now, index)
            if normalized_target is not None:
                normalized_targets.append(normalized_target)

        payload = dict(radar_targets)
        payload["targets"] = normalized_targets
        payload.setdefault("enabled", True)
        payload.setdefault("mode", payload.get("provider", "ld2450"))
        payload.setdefault("provider", payload.get("mode", "ld2450"))
        payload.setdefault("scenario", "live")
        payload.setdefault("radar_connected", bool(payload.get("radar_connected", True)))
        payload.setdefault(
            "radar_status",
            "OK" if payload.get("radar_connected", True) else "DISCONNECTED",
        )
        payload.setdefault("last_update_ms", 0 if payload.get("radar_connected") else None)
        payload["targets_count"] = len(normalized_targets)
        payload["max_radar_risk"] = max(
            (int(target.get("radar_risk", 0) or 0) for target in normalized_targets),
            default=int(payload.get("max_radar_risk", 0) or 0),
        )
        payload["confidence"] = max(
            (float(target.get("confidence", 0.0) or 0.0) for target in normalized_targets),
            default=float(payload.get("confidence", 0.0) or 0.0),
        )
        payload["show_debug_overlay_on_camera"] = debug_overlay_enabled
        payload.setdefault("timestamp", now)
        return payload

    normalized_targets = []
    if isinstance(radar_targets, (list, tuple)):
        for index, target in enumerate(radar_targets, start=1):
            normalized_target = _normalize_external_radar_target(target, now, index)
            if normalized_target is not None:
                normalized_targets.append(normalized_target)

    return {
        "enabled": True,
        "mode": "ld2450",
        "provider": "ld2450",
        "scenario": "live",
        "radar_connected": True,
        "radar_status": "OK",
        "last_update_ms": 0,
        "targets_count": len(normalized_targets),
        "targets": normalized_targets,
        "max_radar_risk": max(
            (int(target.get("radar_risk", 0) or 0) for target in normalized_targets),
            default=0,
        ),
        "confidence": max(
            (float(target.get("confidence", 0.0) or 0.0) for target in normalized_targets),
            default=0.0,
        ),
        "show_debug_overlay_on_camera": debug_overlay_enabled,
        "timestamp": now,
    }


def _get_radar_payload(frame_shape, camera_tracks, now, radar_targets=None):
    provider = _get_radar_provider()
    debug_overlay_enabled = _show_debug_overlay_on_camera(provider)
    external_payload = _payload_from_external_radar(radar_targets, now, debug_overlay_enabled)
    if external_payload is not None:
        return external_payload
    if provider is None:
        payload = _empty_radar_payload(now=now)
        payload["show_debug_overlay_on_camera"] = debug_overlay_enabled
        return payload

    try:
        payload = provider.generate_targets(frame_shape=frame_shape, camera_tracks=camera_tracks, now=now)
    except Exception:
        payload = _empty_radar_payload(now=now)
        payload["show_debug_overlay_on_camera"] = debug_overlay_enabled
        return payload

    if not isinstance(payload, dict):
        payload = _empty_radar_payload(now=now)
        payload["show_debug_overlay_on_camera"] = debug_overlay_enabled
        return payload

    payload.setdefault("enabled", False)
    payload.setdefault("mode", "ld2450")
    payload.setdefault("provider", payload.get("mode", "ld2450"))
    payload.setdefault("scenario", "idle")
    payload.setdefault("radar_connected", False)
    payload.setdefault("radar_status", "DISCONNECTED")
    payload.setdefault("last_update_ms", None)
    payload.setdefault("targets_count", len(payload.get("targets", [])))
    payload.setdefault("targets", [])
    payload.setdefault("max_radar_risk", 0)
    payload.setdefault("confidence", 0.0)
    payload["show_debug_overlay_on_camera"] = debug_overlay_enabled
    payload.setdefault("timestamp", now)
    payload["targets_count"] = len(payload.get("targets", []))
    return payload


def _radar_color_for_risk(risk):
    if risk >= GLOBAL_DANGER_THRESHOLD:
        return (0, 0, 255)
    if risk >= GLOBAL_ALERT_THRESHOLD:
        return (0, 165, 255)
    return (0, 255, 0)


def _draw_translucent_panel(frame, top_left, bottom_right, fill_color=(18, 24, 38), alpha=0.45):
    overlay = frame.copy()
    cv2.rectangle(overlay, top_left, bottom_right, fill_color, -1)
    cv2.addWeighted(overlay, alpha, frame, 1.0 - alpha, 0, frame)
    cv2.rectangle(frame, top_left, bottom_right, (110, 110, 110), 1)


def _draw_global_status_overlay(frame, global_mode, camera_risk, radar_risk, fused_risk):
    color = _radar_color_for_risk(fused_risk)
    lines = [
        f"GLOBAL: {global_mode}",
        f"CAMERA RISK: {int(round(camera_risk))}",
        f"RADAR RISK: {int(round(radar_risk))}",
        f"FUSED RISK: {int(round(fused_risk))}",
        f"PROFILE: {PROFILE}",
    ]

    for index, line in enumerate(lines):
        cv2.putText(
            frame,
            line,
            (30, 50 + (index * 32)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.82 if index == 0 else 0.72,
            color if index == 0 else (255, 255, 255),
            2,
        )


def _draw_radar_status_panel(frame, radar_payload):
    height, width = frame.shape[:2]
    panel_width = min(340, max(250, width // 4))
    panel_height = 118
    x1 = max(20, width - panel_width - 20)
    y1 = 28
    x2 = width - 20
    y2 = min(height - 20, y1 + panel_height)

    _draw_translucent_panel(frame, (x1, y1), (x2, y2))

    status_label = radar_payload.get("radar_status", "DISCONNECTED")
    lines = [
        f"RADAR LINK: {status_label}",
        f"Provider: {radar_payload.get('provider', radar_payload.get('mode', 'ld2450'))}",
        f"Targets: {len(radar_payload.get('targets', []))}",
        f"Max Radar Risk: {int(radar_payload.get('max_radar_risk', 0) or 0)}",
    ]

    for index, line in enumerate(lines):
        cv2.putText(
            frame,
            line,
            (x1 + 12, y1 + 24 + (index * 24)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.56,
            (255, 255, 255),
            2 if index == 0 else 1,
        )


def _draw_radar_minimap(frame, radar_payload):
    targets = radar_payload.get("targets", [])
    if not targets:
        return

    height, width = frame.shape[:2]
    panel_width = min(360, max(280, width // 3))
    panel_height = min(220, max(170, height // 4))
    x1 = max(20, width - panel_width - 20)
    y1 = max(160, height - panel_height - 24)
    x2 = width - 20
    y2 = height - 24

    _draw_translucent_panel(frame, (x1, y1), (x2, y2), fill_color=(16, 18, 30), alpha=0.52)

    radar_origin = (x1 + (panel_width // 2), y2 - 26)
    radar_range_x_mm = 3000.0
    radar_range_y_mm = 8000.0
    map_top = y1 + 16
    map_left = x1 + 16
    map_right = x2 - 16
    map_bottom = y2 - 48

    cv2.rectangle(frame, (map_left, map_top), (map_right, map_bottom), (70, 80, 100), 1)
    cv2.circle(frame, radar_origin, 6, (255, 200, 0), -1)
    cv2.putText(
        frame,
        "RADAR",
        (radar_origin[0] - 26, radar_origin[1] + 18),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        (255, 255, 255),
        1,
    )

    for depth_ratio in (0.25, 0.5, 0.75):
        line_y = int(map_bottom - ((map_bottom - map_top) * depth_ratio))
        cv2.line(frame, (map_left, line_y), (map_right, line_y), (50, 58, 78), 1)

    for index, target in enumerate(targets[:3]):
        x_mm = float(target.get("x_mm", 0.0))
        y_mm = float(target.get("y_mm", 0.0))
        px = int(_clamp(radar_origin[0] + ((x_mm / radar_range_x_mm) * ((map_right - map_left) / 2.0)), map_left, map_right))
        py = int(_clamp(map_bottom - ((y_mm / radar_range_y_mm) * (map_bottom - map_top)), map_top, map_bottom))
        color = _radar_color_for_risk(float(target.get("radar_risk", 0.0)))
        cv2.circle(frame, (px, py), 6, color, -1)
        cv2.circle(frame, (px, py), 10, color, 1)

        distance_m = float(target.get("distance_mm", 0.0)) / 1000.0
        speed_m_s = float(target.get("speed_mm_s", 0.0)) / 1000.0
        text_y = map_bottom + 18 + (index * 34)

        cv2.putText(
            frame,
            f"Radar ID: {target.get('radar_id', '?')}  Distance: {distance_m:.1f}m",
            (x1 + 14, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.46,
            (255, 255, 255),
            1,
        )
        cv2.putText(
            frame,
            f"Speed: {speed_m_s:.2f}m/s  Direction: {target.get('direction', 'unknown')}",
            (x1 + 14, text_y + 16),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.44,
            color,
            1,
        )


# =========================
# TRACK CREATION
# =========================


def _create_track(bbox, t):
    cx, cy = _get_center(bbox)
    return {
        "bbox": bbox,
        "history": deque([(cx, cy, t)], maxlen=200),
        "first_seen": t,
        "last_seen": t,
        "prev_update": t,
        "state": "detected",
        "state_since": t,
        "risk": 0.0,
        "time_in_zone": 0.0,
        "time_near_gate": 0.0,
        "has_weapon": False,
        "weapon_last_seen": None,
        "weapon_hits": 0,
        "missed": 0,
        "motion": None,
        "speed": 0.0,
        "heading": (0.0, 0.0),
        "approaching_gate": False,
        "zone": "outside",
        "sensor_boost": 0.0,
    }


# =========================
# IOU
# =========================


def _iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
    yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    union = _bbox_area(boxA) + _bbox_area(boxB) - inter
    if union == 0:
        return 0.0
    return inter / union


# =========================
# TRACK ASSOCIATION
# =========================


def _match_score(det_bbox, tr_bbox):
    iou_score = _iou(det_bbox, tr_bbox)
    dist = _euclidean(_get_center(det_bbox), _get_center(tr_bbox))
    dist_score = max(0.0, 1.0 - dist / MAX_CENTER_DISTANCE_FOR_MATCH)
    return 0.7 * iou_score + 0.3 * dist_score


def _associate_tracks(detections, frame_time, source_context):
    tracks_state = source_context["tracks"]

    assigned_track_ids = set()
    assigned_det_ids = set()
    candidates = []

    for di, det in enumerate(detections):
        for tid, tr in tracks_state.items():
            score = _match_score(det["bbox"], tr["bbox"])
            if score >= TRACK_MATCH_IOU_THRESHOLD:
                candidates.append((score, di, tid))

    candidates.sort(reverse=True, key=lambda x: x[0])

    for score, di, tid in candidates:
        if di in assigned_det_ids or tid in assigned_track_ids:
            continue

        det = detections[di]
        tr = tracks_state[tid]
        tr["bbox"] = det["bbox"]
        cx, cy = _get_center(det["bbox"])
        tr["history"].append((cx, cy, frame_time))
        tr["last_seen"] = frame_time
        tr["missed"] = 0
        assigned_det_ids.add(di)
        assigned_track_ids.add(tid)
        _update_behavior(tr, frame_time)

    for di, det in enumerate(detections):
        if di in assigned_det_ids:
            continue
        tid = source_context["next_track_id"]
        source_context["next_track_id"] += 1
        tracks_state[tid] = _create_track(det["bbox"], frame_time)

    for tid in list(tracks_state.keys()):
        if tid not in assigned_track_ids:
            tracks_state[tid]["missed"] += 1
            if tracks_state[tid]["missed"] > MAX_MISSES:
                del tracks_state[tid]


# =========================
# BEHAVIOR ENGINE
# =========================


def _sensor_fresh(now):
    return (now - sensor_state["last_update"]) <= SENSOR_TTL_SECONDS


def _compute_sensor_boost(tr, now):
    if not _sensor_fresh(now):
        return 0.0

    boost = 0.0
    if tr["zone"] not in ("fence", "gate"):
        return 0.0

    dist = sensor_state.get("distance_m")
    if dist is not None:
        if dist <= SENSOR_DISTANCE_DANGER_M:
            boost += 18.0
        elif dist <= SENSOR_DISTANCE_ALERT_M:
            boost += 8.0

    if sensor_state.get("pir", False):
        boost += 5.0

    if sensor_state.get("tamper", False):
        boost += 10.0

    return boost


def _is_suspicious_perimeter_context(tr):
    return tr["zone"] in ("fence", "gate") or tr["approaching_gate"] or tr["has_weapon"]


def _update_behavior(tr, now):
    cfg = _profile_cfg()

    dt = now - tr["prev_update"]
    tr["prev_update"] = now

    speed = _compute_speed(tr["history"], now)
    tr["speed"] = speed

    if speed < STAND_THRESHOLD:
        motion = "standing"
    elif speed < RUN_THRESHOLD:
        motion = "walking"
    else:
        motion = "running"

    tr["motion"] = motion

    if len(tr["history"]) >= 2:
        x0, y0, _ = tr["history"][-2]
        x1, y1, _ = tr["history"][-1]
        heading = _normalize(x1 - x0, y1 - y0)
        tr["heading"] = heading

        center = (x1, y1)
        gate_vec = _vector_to_gate(center)
        dot = heading[0] * gate_vec[0] + heading[1] * gate_vec[1]
        tr["approaching_gate"] = dot > 0.70 and speed > APPROACH_SPEED_THRESHOLD

    # Fence / gate logic
    x, y, w, h = tr["bbox"]
    bottom = y + h
    center = _get_center(tr["bbox"])
    near_fence = bottom > (FENCE_LINE_Y - FENCE_BAND_PX)
    near_gate = _distance_to_gate(center) <= NEAR_GATE_RADIUS_PX

    if near_gate:
        tr["zone"] = "gate"
        tr["time_near_gate"] += dt
        tr["time_in_zone"] += dt
    elif near_fence:
        tr["zone"] = "fence"
        tr["time_in_zone"] += dt
        tr["time_near_gate"] = 0.0
    else:
        tr["zone"] = "outside"
        tr["time_in_zone"] = 0.0
        tr["time_near_gate"] = 0.0

    prev_state = tr["state"]
    new_state = "detected"

    if motion == "running" and cfg["running_is_suspicious"]:
        new_state = "running"

    if near_fence and tr["time_in_zone"] > LOITER_TIME_THRESHOLD:
        new_state = "loitering"

    if tr["approaching_gate"]:
        new_state = "approaching"

    if near_gate and tr["time_near_gate"] > (LOITER_TIME_THRESHOLD / 2.0):
        new_state = "gate_loitering"

    if tr["has_weapon"]:
        new_state = "armed"

    if new_state != prev_state:
        tr["state"] = new_state
        tr["state_since"] = now
        _apply_state_risk(tr, new_state)

    _update_risk(tr, dt, now)


def _apply_state_risk(tr, state):
    cfg = _profile_cfg()
    if state == "running":
        tr["risk"] += cfg["run_risk"]
    elif state == "approaching":
        tr["risk"] += cfg["approach_risk"]


def _update_risk(tr, dt, now):
    cfg = _profile_cfg()
    decay_per_second = (
        SUSPICIOUS_CONTEXT_DECAY_PER_SECOND
        if _is_suspicious_perimeter_context(tr)
        else RISK_DECAY_PER_SECOND
    )

    if decay_per_second < 1.0:
        tr["risk"] *= pow(decay_per_second, dt)

    if tr["zone"] == "fence":
        tr["risk"] += cfg["near_fence_risk_per_sec"] * dt
        if tr["time_in_zone"] > LOITER_TIME_THRESHOLD:
            tr["risk"] += cfg["loiter_risk_per_sec"] * dt
    elif tr["zone"] == "gate":
        tr["risk"] += cfg["near_gate_risk_per_sec"] * dt
        if tr["time_near_gate"] > (LOITER_TIME_THRESHOLD / 2.0):
            tr["risk"] += cfg["gate_loiter_risk_per_sec"] * dt

    tr["sensor_boost"] = _compute_sensor_boost(tr, now)
    tr["risk"] += tr["sensor_boost"] * dt

    if tr["has_weapon"]:
        tr["risk"] = max(tr["risk"], cfg["weapon_floor_risk"])
        tr["risk"] += cfg["weapon_risk_per_sec"] * dt

        if tr["approaching_gate"]:
            tr["risk"] += cfg["weapon_approach_risk_per_sec"] * dt

        if tr["weapon_last_seen"] and now - tr["weapon_last_seen"] > WEAPON_TIMEOUT:
            tr["has_weapon"] = False
            tr["weapon_hits"] = 0
            if tr["state"] == "armed":
                tr["state"] = "detected"
                tr["state_since"] = now

    tr["risk"] = min(100, max(0, tr["risk"]))


# =========================
# WEAPON ASSOCIATION
# =========================


def _weapon_center_inside_person(weapon_bbox, person_bbox):
    wx, wy, ww, wh = weapon_bbox
    px, py, pw, ph = person_bbox
    wcx = wx + ww / 2.0
    wcy = wy + wh / 2.0
    return px <= wcx <= px + pw and py <= wcy <= py + ph


def _associate_weapons(weapon_boxes, now, source_context):
    cfg = _profile_cfg()
    tracks_state = source_context["tracks"]

    for w in weapon_boxes:
        best_tid = None
        best_score = 0.0

        for tid, tr in tracks_state.items():
            score = _iou(w["bbox"], tr["bbox"])
            if _weapon_center_inside_person(w["bbox"], tr["bbox"]):
                score = max(score, 0.70)

            if score > best_score:
                best_score = score
                best_tid = tid

        if best_tid is not None and best_score > WEAPON_PERSON_IOU_THRESHOLD:
            tr = tracks_state[best_tid]
            tr["weapon_last_seen"] = now
            tr["weapon_hits"] += 1
            if tr["weapon_hits"] >= WEAPON_CONFIRM_FRAMES:
                tr["has_weapon"] = True
                tr["risk"] = max(tr["risk"], cfg["weapon_floor_risk"])
                tr["state"] = "armed"
                tr["state_since"] = now


# =========================
# MAIN ENTRY
# =========================


def _analyze_frame_with_context(source_id, frame, source_context, radar_targets=None):
    _init_models()
    now = time.time()
    debug_overlays_enabled = _show_debug_overlay_on_camera(_get_radar_provider())
    tracks_state = source_context["tracks"]

    annotated = frame.copy()

    # ===== Person detection =====
    results = _person_model(frame, conf=PERSON_CONF, verbose=False)
    person_boxes = []

    for box in results[0].boxes:
        if int(box.cls[0]) == 0:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
            conf = float(box.conf[0]) if hasattr(box, "conf") else 0.0
            bbox = [int(x1), int(y1), int(x2 - x1), int(y2 - y1)]
            person_boxes.append({"bbox": bbox, "confidence": conf})

    # ===== Weapon detection (optional - skipped when the model is unavailable) =====
    weapon_boxes = []

    if _weapon_model is not None:
        weapon_results = _weapon_model(frame, conf=WEAPON_CONF, verbose=False)

        for box in weapon_results[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
            conf = float(box.conf[0]) if hasattr(box, "conf") else 0.0
            bbox = [int(x1), int(y1), int(x2 - x1), int(y2 - y1)]
            weapon_boxes.append({"bbox": bbox, "conf": conf})

            cv2.rectangle(
                annotated,
                (int(x1), int(y1)),
                (int(x2), int(y2)),
                (0, 0, 255),
                2,
            )
            cv2.putText(
                annotated,
                "WEAPON" if not debug_overlays_enabled else f"WEAPON {conf:.2f}",
                (int(x1), int(y1) - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2,
            )

    _associate_tracks(person_boxes, now, source_context)
    _associate_weapons(weapon_boxes, now, source_context)

    # ===== Draw reference lines =====
    if debug_overlays_enabled:
        cv2.line(
            annotated,
            (0, FENCE_LINE_Y),
            (annotated.shape[1], FENCE_LINE_Y),
            (255, 255, 0),
            2,
        )
        cv2.circle(annotated, (int(GATE_POINT[0]), int(GATE_POINT[1])), 8, (255, 0, 255), -1)

    # ===== Draw tracks =====
    max_risk = 0
    track_payload = []

    for tid, tr in tracks_state.items():
        x, y, w, h = tr["bbox"]
        risk = int(tr["risk"])
        max_risk = max(max_risk, risk)

        color = (0, 255, 0)
        if debug_overlays_enabled:
            if risk >= 75:
                color = (0, 0, 255)
            elif risk >= 40:
                color = (0, 165, 255)

        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)

        label = f"ID:{tid} person"
        if debug_overlays_enabled:
            label = f"ID:{tid} {tr['state']} R:{risk}"
        cv2.putText(
            annotated,
            label,
            (x, max(20, y - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2,
        )

        # Movement trail drawing removed intentionally.
        # The system still keeps movement history internally for speed, direction,
        # approaching-gate logic and risk calculation, but it no longer draws
        # the green path/trajectory on the video frame.

        track_payload.append(
            {
                "id": tid,
                "state": tr["state"],
                "risk": round(tr["risk"], 2),
                "speed": round(tr["speed"], 2),
                "has_weapon": tr["has_weapon"],
                "zone": tr["zone"],
                "approaching_gate": tr["approaching_gate"],
                "sensor_boost": round(tr["sensor_boost"], 2),
                "bbox": tr["bbox"],
            }
        )

    # ===== Global state =====
    camera_risk = int(max_risk)
    camera_mode = _mode_from_risk(camera_risk)
    radar_payload = _get_radar_payload(
        annotated.shape,
        track_payload,
        now,
        radar_targets=radar_targets,
    )
    radar_risk = int(round(radar_payload.get("max_radar_risk", 0) or 0))
    radar_confidence = float(radar_payload.get("confidence", 0.0) or 0.0)
    debug_overlays_enabled = bool(
        radar_payload.get("show_debug_overlay_on_camera", debug_overlays_enabled)
    )

    fused_risk = combine_camera_risk_and_radar_risk(
        camera_risk,
        radar_risk,
        radar_confidence if radar_payload.get("enabled") else 0.0,
    )
    global_mode = _mode_from_risk(fused_risk)
    source_context["previous_global_mode"] = global_mode

    if debug_overlays_enabled:
        _draw_global_status_overlay(
            annotated,
            global_mode=global_mode,
            camera_risk=camera_risk,
            radar_risk=radar_risk,
            fused_risk=fused_risk,
        )
        _draw_radar_status_panel(annotated, radar_payload)
        _draw_radar_minimap(annotated, radar_payload)

    # sensor overlay
    if debug_overlays_enabled and _sensor_fresh(now):
        sensor_text = (
            f"SENSOR dist={sensor_state['distance_m']} pir={int(sensor_state['pir'])} "
            f"tamper={int(sensor_state['tamper'])}"
        )
        cv2.putText(
            annotated,
            sensor_text,
            (30, 215),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.62,
            (255, 255, 255),
            2,
        )

    highest_risk_track = max(tracks_state.values(), key=lambda tr: tr["risk"], default=None)
    dominant_motion = highest_risk_track["motion"] if highest_risk_track else None
    dominant_state = highest_risk_track["state"] if highest_risk_track else "idle"
    if dominant_state == "idle" and radar_payload.get("targets"):
        dominant_state = f"radar_{radar_payload.get('scenario', 'activity')}"
    has_weapon = any(tr["has_weapon"] for tr in tracks_state.values()) or bool(weapon_boxes)
    weapon_confidence = max((w["conf"] for w in weapon_boxes), default=0.0)

    return annotated, {
        "source": str(source_id or DEFAULT_SOURCE_ID),
        "mode": global_mode,
        "camera_mode": camera_mode,
        "max_risk": int(fused_risk),
        "camera_risk": int(camera_risk),
        "radar_risk": int(radar_risk),
        "fused_risk": int(fused_risk),
        "profile": PROFILE,
        "tracks": track_payload,
        "has_person": bool(person_boxes),
        "person_count": len(person_boxes),
        "person_boxes": person_boxes,
        "has_weapon": has_weapon,
        "weapon_type": "weapon" if weapon_boxes else None,
        "weapon_confidence": round(weapon_confidence, 4),
        "weapon_detection_available": _weapon_model is not None,
        "weapon_detection_status": "ok" if _weapon_model is not None else "model_load_failed",
        "weapon_boxes": [
            {
                "bbox": w["bbox"],
                "confidence": round(w["conf"], 4),
                "type": "weapon",
            }
            for w in weapon_boxes
        ],
        "motion": dominant_motion,
        "confidence": round(max((p["confidence"] for p in person_boxes), default=0.0), 4),
        "context": dominant_state,
        "radar": radar_payload,
        "sensor": {
            "fresh": _sensor_fresh(now),
            "distance_m": sensor_state["distance_m"],
            "pir": sensor_state["pir"],
            "tamper": sensor_state["tamper"],
        },
    }


def analyze_frame_for_source(source_id, frame, radar_targets=None):
    source_context = _get_source_context(source_id)
    with _analysis_lock:
        annotated, status = _analyze_frame_with_context(
            source_id,
            frame,
            source_context,
            radar_targets=radar_targets,
        )

    if str(source_id or DEFAULT_SOURCE_ID) == DEFAULT_SOURCE_ID:
        _sync_default_globals(source_context)

    return annotated, status


def analyze_frame(frame, radar_targets=None):
    return analyze_frame_for_source(DEFAULT_SOURCE_ID, frame, radar_targets=radar_targets)
