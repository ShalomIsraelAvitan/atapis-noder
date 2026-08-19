"""LD2450 radar provider with optional mock fallback.

This module keeps radar IO on a background thread so camera analysis and RTSP
streaming never block on serial reads.
"""

from __future__ import annotations

import copy
import json
import math
import os
import threading
import time

import serial

try:
    from radar_simulator import RadarSimulator, get_available_scenarios as _get_mock_scenarios
except Exception:
    RadarSimulator = None
    _get_mock_scenarios = None


CONFIG_FILENAME = "radar_config.json"
CONFIG_PATH = os.path.join(os.path.dirname(__file__), CONFIG_FILENAME)

DEFAULT_RADAR_CONFIG = {
    "LD2450_ENABLED": True,
    "LD2450_PORT": "",
    "LD2450_BAUD": 256000,
    "RADAR_USE_MOCK": False,
    "show_debug_overlay_on_camera": False,
    "scenario": "approaching_gate",
    "update_rate_hz": 10,
    "noise_enabled": True,
    "max_targets": 3,
    "gate_distance_alert_mm": 3000,
    "fence_distance_alert_mm": 2000,
    "min_distance_mm": 80,
    "max_distance_mm": 10000,
    "max_speed_cm_s": 1200,
    "alert_speed_cm_s": 60,
    "danger_speed_cm_s": 120,
    "max_lateral_mm": 6000,
    "max_forward_mm": 10000,
}

PERSISTED_CONFIG_KEYS = (
    "LD2450_ENABLED",
    "LD2450_PORT",
    "LD2450_BAUD",
    "RADAR_USE_MOCK",
    "show_debug_overlay_on_camera",
    "scenario",
    "update_rate_hz",
    "noise_enabled",
    "max_targets",
    "gate_distance_alert_mm",
    "fence_distance_alert_mm",
    "min_distance_mm",
    "max_distance_mm",
    "max_speed_cm_s",
    "alert_speed_cm_s",
    "danger_speed_cm_s",
    "max_lateral_mm",
    "max_forward_mm",
)

LD2450_BINARY_HEADER = b"\xAA\xFF\x03\x00"
LD2450_BINARY_FOOTER = b"\x55\xCC"
LD2450_BINARY_TARGET_COUNT = 3
LD2450_BINARY_TARGET_SIZE = 8
LD2450_BINARY_PAYLOAD_SIZE = LD2450_BINARY_TARGET_COUNT * LD2450_BINARY_TARGET_SIZE

_shared_provider = None
_shared_provider_lock = threading.Lock()


def _as_bool(value, default=False):
    if value is None:
        return bool(default)
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return bool(default)


def _safe_int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def _clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def _get_mock_scenario_list():
    if callable(_get_mock_scenarios):
        try:
            return list(_get_mock_scenarios())
        except Exception:
            return []
    return []


def get_available_scenarios():
    return _get_mock_scenario_list()


def get_default_radar_config():
    return copy.deepcopy(DEFAULT_RADAR_CONFIG)


def merge_radar_config(config):
    merged = get_default_radar_config()
    if isinstance(config, dict):
        merged.update(config)
        legacy_aliases = {
            "LD2450_ENABLED": config.get("LD2450_ENABLED", config.get("radar_enabled")),
            "LD2450_PORT": config.get("LD2450_PORT", config.get("ld2450_port")),
            "LD2450_BAUD": config.get("LD2450_BAUD", config.get("ld2450_baud")),
            "RADAR_USE_MOCK": config.get("RADAR_USE_MOCK", config.get("radar_use_mock")),
        }
        for key, value in legacy_aliases.items():
            if value not in (None, ""):
                merged[key] = value

    env_overrides = {
        "LD2450_PORT": os.getenv("LD2450_PORT"),
        "LD2450_BAUD": os.getenv("LD2450_BAUD"),
        "LD2450_ENABLED": os.getenv("LD2450_ENABLED"),
        "RADAR_USE_MOCK": os.getenv("RADAR_USE_MOCK"),
    }
    for key, value in env_overrides.items():
        if value not in (None, ""):
            merged[key] = value

    merged["LD2450_ENABLED"] = _as_bool(merged.get("LD2450_ENABLED"), True)
    merged["RADAR_USE_MOCK"] = _as_bool(merged.get("RADAR_USE_MOCK"), False)
    merged["show_debug_overlay_on_camera"] = _as_bool(
        merged.get("show_debug_overlay_on_camera"),
        False,
    )
    merged["LD2450_PORT"] = str(merged.get("LD2450_PORT", "") or "").strip()
    merged["LD2450_BAUD"] = _safe_int(merged.get("LD2450_BAUD"), 256000)
    merged["update_rate_hz"] = _clamp(_safe_int(merged.get("update_rate_hz"), 10), 1, 60)
    merged["max_targets"] = _clamp(_safe_int(merged.get("max_targets"), 3), 1, 3)
    merged["gate_distance_alert_mm"] = _clamp(
        _safe_int(merged.get("gate_distance_alert_mm"), 3000),
        500,
        20000,
    )
    merged["fence_distance_alert_mm"] = _clamp(
        _safe_int(merged.get("fence_distance_alert_mm"), 2000),
        500,
        20000,
    )
    merged["min_distance_mm"] = _clamp(
        _safe_int(merged.get("min_distance_mm"), 80),
        0,
        5000,
    )
    merged["max_distance_mm"] = _clamp(
        _safe_int(merged.get("max_distance_mm"), 10000),
        500,
        30000,
    )
    merged["max_speed_cm_s"] = _clamp(
        _safe_int(merged.get("max_speed_cm_s"), 1200),
        50,
        5000,
    )
    merged["alert_speed_cm_s"] = _clamp(
        _safe_int(merged.get("alert_speed_cm_s"), 60),
        10,
        5000,
    )
    merged["danger_speed_cm_s"] = _clamp(
        _safe_int(merged.get("danger_speed_cm_s"), 120),
        10,
        5000,
    )
    merged["max_lateral_mm"] = _clamp(
        _safe_int(merged.get("max_lateral_mm"), 6000),
        500,
        30000,
    )
    merged["max_forward_mm"] = _clamp(
        _safe_int(merged.get("max_forward_mm"), 10000),
        500,
        30000,
    )
    merged["noise_enabled"] = _as_bool(merged.get("noise_enabled"), True)

    scenarios = get_available_scenarios()
    if scenarios:
        requested_scenario = str(merged.get("scenario", DEFAULT_RADAR_CONFIG["scenario"]) or "")
        if requested_scenario not in scenarios:
            merged["scenario"] = DEFAULT_RADAR_CONFIG["scenario"]
        else:
            merged["scenario"] = requested_scenario
    else:
        merged["scenario"] = str(merged.get("scenario", "live") or "live")

    merged["radar_mode"] = "mock" if merged["RADAR_USE_MOCK"] else "ld2450"
    merged["radar_enabled"] = bool(merged["LD2450_ENABLED"])
    return merged


def load_radar_config(config_path=CONFIG_PATH):
    if not os.path.exists(config_path):
        return merge_radar_config({})

    try:
        with open(config_path, "r", encoding="utf-8") as config_file:
            return merge_radar_config(json.load(config_file))
    except (OSError, ValueError, TypeError):
        return merge_radar_config({})


def save_radar_config(config, config_path=CONFIG_PATH):
    merged = merge_radar_config(config)
    payload = {key: merged.get(key) for key in PERSISTED_CONFIG_KEYS}
    temp_path = f"{config_path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as config_file:
        json.dump(payload, config_file, indent=2)
    os.replace(temp_path, config_path)
    return merge_radar_config(payload)


def _decode_signed_15bit(low_byte, high_byte):
    raw_value = int(low_byte) | (int(high_byte) << 8)
    sign = -1 if raw_value & 0x8000 else 1
    magnitude = raw_value & 0x7FFF
    return sign * magnitude


class RadarDataProvider:
    """Background LD2450 serial reader with optional mock fallback."""

    def __init__(self, config_path=CONFIG_PATH):
        self.config_path = config_path
        self.config = load_radar_config(self.config_path)
        self._config_mtime = self._get_config_mtime()
        self._config_signature = self._current_config_signature()
        self._lock = threading.Lock()
        self._serial_lock = threading.Lock()
        self._serial = None
        self._buffer = bytearray()
        self._last_error = None
        self._mock_provider = None
        self._last_payload = self._empty_payload(status="DISCONNECTED")
        self._stop_event = threading.Event()
        self._thread = threading.Thread(
            target=self._reader_loop,
            name="ld2450_reader",
            daemon=True,
        )
        self._thread.start()

    def _get_config_mtime(self):
        try:
            return os.path.getmtime(self.config_path)
        except OSError:
            return None

    def _current_config_signature(self):
        cfg = self.config or {}
        return (
            cfg.get("LD2450_ENABLED"),
            cfg.get("LD2450_PORT"),
            cfg.get("LD2450_BAUD"),
            cfg.get("RADAR_USE_MOCK"),
            cfg.get("scenario"),
            cfg.get("update_rate_hz"),
            cfg.get("noise_enabled"),
            cfg.get("show_debug_overlay_on_camera"),
        )

    def _reload_config_if_needed(self):
        new_mtime = self._get_config_mtime()
        if new_mtime == self._config_mtime:
            return

        self.config = load_radar_config(self.config_path)
        new_signature = self._current_config_signature()
        self._config_mtime = new_mtime

        if new_signature != self._config_signature:
            self._config_signature = new_signature
            self._buffer = bytearray()
            self._last_error = None
            self._close_serial()
            if self._mock_provider is not None:
                try:
                    self._mock_provider.reset()
                except Exception:
                    pass

    def _empty_payload(
        self,
        now=None,
        *,
        connected=False,
        enabled=None,
        status="DISCONNECTED",
        targets=None,
        provider=None,
        scenario=None,
        last_error=None,
    ):
        current_time = time.time() if now is None else now
        enabled_value = self.config.get("LD2450_ENABLED", True) if enabled is None else enabled
        provider_name = provider or ("mock" if self.config.get("RADAR_USE_MOCK") else "ld2450")
        scenario_name = scenario
        if scenario_name is None:
            scenario_name = self.config.get("scenario", "live" if provider_name == "ld2450" else "idle")
        normalized_targets = list(targets or [])
        max_risk = max((int(target.get("radar_risk", 0) or 0) for target in normalized_targets), default=0)
        confidence = max((float(target.get("confidence", 0.0) or 0.0) for target in normalized_targets), default=0.0)
        return {
            "enabled": bool(enabled_value),
            "mode": provider_name,
            "provider": provider_name,
            "scenario": scenario_name,
            "radar_connected": bool(connected),
            "radar_status": str(status or "DISCONNECTED"),
            "last_update_ms": 0 if connected else None,
            "targets_count": len(normalized_targets),
            "targets": normalized_targets,
            "max_radar_risk": max_risk,
            "confidence": round(confidence, 2),
            "show_debug_overlay_on_camera": bool(
                self.config.get("show_debug_overlay_on_camera", False)
            ),
            "timestamp": current_time,
            "last_error": last_error,
        }

    def _payload_with_dynamic_age(self, payload, now=None):
        current_time = time.time() if now is None else now
        cloned = copy.deepcopy(payload or self._empty_payload(now=current_time))
        timestamp = cloned.get("timestamp")
        if timestamp is None:
            cloned["last_update_ms"] = None
        else:
            cloned["last_update_ms"] = int(max(0.0, (current_time - float(timestamp)) * 1000.0))
        cloned["targets_count"] = len(cloned.get("targets", []))
        cloned.setdefault("radar_connected", False)
        cloned.setdefault("radar_status", "DISCONNECTED")
        cloned.setdefault("enabled", bool(self.config.get("LD2450_ENABLED", True)))
        cloned.setdefault("mode", "mock" if self.config.get("RADAR_USE_MOCK") else "ld2450")
        cloned.setdefault("provider", cloned.get("mode"))
        cloned.setdefault(
            "show_debug_overlay_on_camera",
            bool(self.config.get("show_debug_overlay_on_camera", False)),
        )
        return cloned

    def get_latest_payload(self, now=None):
        with self._lock:
            payload = copy.deepcopy(self._last_payload)
        return self._payload_with_dynamic_age(payload, now=now)

    def generate_targets(self, frame_shape=None, camera_tracks=None, now=None):
        del frame_shape
        del camera_tracks
        return self.get_latest_payload(now=now)

    def _close_serial(self):
        with self._serial_lock:
            if self._serial is not None:
                try:
                    self._serial.close()
                except Exception:
                    pass
                self._serial = None

    def _ensure_serial_open(self):
        with self._serial_lock:
            if self._serial is not None and getattr(self._serial, "is_open", False):
                return True

            port_name = str(self.config.get("LD2450_PORT", "") or "").strip()
            if not port_name:
                self._last_error = "LD2450_PORT is not configured."
                self._set_payload(
                    self._empty_payload(
                        status="DISCONNECTED",
                        connected=False,
                        last_error=self._last_error,
                    )
                )
                return False

            try:
                self._serial = serial.Serial(
                    port=port_name,
                    baudrate=int(self.config.get("LD2450_BAUD", 256000)),
                    timeout=0,
                    write_timeout=0,
                )
                self._serial.reset_input_buffer()
                self._buffer = bytearray()
                self._last_error = None
                return True
            except Exception as exc:
                self._serial = None
                self._last_error = str(exc)
                self._set_payload(
                    self._empty_payload(
                        status="DISCONNECTED",
                        connected=False,
                        last_error=self._last_error,
                    )
                )
                return False

    def _set_payload(self, payload):
        with self._lock:
            self._last_payload = payload

    def _ensure_mock_provider(self):
        if self._mock_provider is None and RadarSimulator is not None:
            self._mock_provider = RadarSimulator(self.config_path)
        return self._mock_provider

    def _reader_loop(self):
        reconnect_delay = 1.0
        while not self._stop_event.is_set():
            self._reload_config_if_needed()
            now = time.time()

            if not self.config.get("LD2450_ENABLED", True):
                self._close_serial()
                self._set_payload(
                    self._empty_payload(
                        now=now,
                        connected=False,
                        enabled=False,
                        status="DISABLED",
                        provider="mock" if self.config.get("RADAR_USE_MOCK") else "ld2450",
                    )
                )
                time.sleep(0.25)
                continue

            if self.config.get("RADAR_USE_MOCK", False):
                self._close_serial()
                mock_provider = self._ensure_mock_provider()
                if mock_provider is None:
                    self._set_payload(
                        self._empty_payload(
                            now=now,
                            connected=False,
                            status="ERROR",
                            provider="mock",
                            scenario=self.config.get("scenario", "idle"),
                            last_error="Mock mode is enabled but radar_simulator is unavailable.",
                        )
                    )
                    time.sleep(0.5)
                    continue

                try:
                    mock_payload = mock_provider.generate_targets(now=now)
                    normalized_payload = self._normalize_mock_payload(mock_payload, now=now)
                    self._set_payload(normalized_payload)
                except Exception as exc:
                    self._set_payload(
                        self._empty_payload(
                            now=now,
                            connected=False,
                            status="ERROR",
                            provider="mock",
                            scenario=self.config.get("scenario", "idle"),
                            last_error=str(exc),
                        )
                    )
                time.sleep(1.0 / max(1, int(self.config.get("update_rate_hz", 10))))
                continue

            if not self._ensure_serial_open():
                time.sleep(reconnect_delay)
                continue

            try:
                with self._serial_lock:
                    serial_port = self._serial
                    waiting_bytes = int(getattr(serial_port, "in_waiting", 0) or 0)
                    read_size = min(max(waiting_bytes, 1), 1024)
                    chunk = serial_port.read(read_size) if serial_port is not None else b""
            except Exception as exc:
                self._last_error = str(exc)
                self._close_serial()
                self._set_payload(
                    self._empty_payload(
                        now=now,
                        connected=False,
                        status="DISCONNECTED",
                        last_error=self._last_error,
                    )
                )
                time.sleep(reconnect_delay)
                continue

            if not chunk:
                current_payload = self.get_latest_payload(now=now)
                if not current_payload.get("radar_connected"):
                    current_payload["radar_status"] = "DISCONNECTED"
                self._set_payload(current_payload)
                time.sleep(0.01)
                continue

            self._buffer.extend(chunk)
            json_payload = self._extract_json_payload(now=now)
            if json_payload is not None:
                self._set_payload(json_payload)
                time.sleep(0.002)
                continue

            parsed_targets = self._extract_binary_targets(now=now)
            if parsed_targets is None:
                time.sleep(0.002)
                continue

            payload = self._empty_payload(
                now=now,
                connected=True,
                status="OK",
                targets=parsed_targets,
                provider="ld2450",
                scenario="live",
                last_error=None,
            )
            self._set_payload(payload)

    def _extract_json_payload(self, now=None):
        current_time = time.time() if now is None else now
        parsed_payload = None

        while True:
            newline_index = self._buffer.find(b"\n")
            if newline_index < 0:
                if len(self._buffer) > 4096:
                    self._buffer = self._buffer[-2048:]
                return parsed_payload

            raw_line = bytes(self._buffer[:newline_index]).strip()
            del self._buffer[: newline_index + 1]
            if not raw_line:
                continue
            if not raw_line.startswith(b"{"):
                continue

            try:
                payload = json.loads(raw_line.decode("utf-8", "ignore"))
            except (ValueError, UnicodeDecodeError):
                continue

            normalized_payload = self._normalize_json_payload(payload, now=current_time)
            if normalized_payload is not None:
                parsed_payload = normalized_payload

    def _normalize_json_payload(self, payload, now=None):
        current_time = time.time() if now is None else now
        if not isinstance(payload, dict):
            return None

        normalized_targets = []
        for index, raw_target in enumerate(payload.get("targets", []), start=1):
            if not isinstance(raw_target, dict):
                continue

            target_id = int(raw_target.get("id", raw_target.get("radar_id", index)) or index)
            x_mm = int(round(float(raw_target.get("x_mm", 0.0) or 0.0)))
            y_mm = int(round(float(raw_target.get("y_mm", 0.0) or 0.0)))
            distance_mm = raw_target.get("distance_mm")
            if distance_mm is None:
                distance_mm = math.hypot(x_mm, y_mm)
            angle_deg = raw_target.get("angle_deg")
            if angle_deg is None:
                angle_deg = math.degrees(math.atan2(x_mm, max(y_mm, 1)))
            speed_cm_s = int(round(float(raw_target.get("speed_cm_s", 0.0) or 0.0)))
            resolution_mm = int(round(float(raw_target.get("resolution_mm", 0.0) or 0.0)))
            direction = self._direction_from_speed(speed_cm_s)

            target = {
                "id": target_id,
                "radar_id": target_id,
                "x_mm": x_mm,
                "y_mm": y_mm,
                "distance_mm": int(round(float(distance_mm or 0.0))),
                "angle_deg": round(float(angle_deg or 0.0), 1),
                "speed_cm_s": speed_cm_s,
                "speed_mm_s": int(speed_cm_s * 10),
                "resolution_mm": resolution_mm,
                "timestamp": current_time,
                "valid": True,
                "direction": direction,
                "approaching_gate": direction == "approaching",
                "confidence": 0.95,
            }
            if not self._is_reasonable_target(target):
                continue
            target["radar_risk"] = self._compute_radar_risk(target)
            normalized_targets.append(target)

        payload_timestamp = payload.get("timestamp_ms")
        if payload_timestamp is not None:
            try:
                payload_timestamp = current_time - max(0.0, (time.monotonic() * 1000.0 - float(payload_timestamp)) / 1000.0)
            except (TypeError, ValueError):
                payload_timestamp = current_time
        else:
            payload_timestamp = current_time

        return self._empty_payload(
            now=payload_timestamp,
            connected=True,
            status="OK",
            targets=normalized_targets,
            provider="ld2450",
            scenario="live",
            last_error=None,
        )

    def _extract_binary_targets(self, now=None):
        current_time = time.time() if now is None else now
        parsed_targets = None

        while True:
            header_index = self._buffer.find(LD2450_BINARY_HEADER)
            if header_index < 0:
                if len(self._buffer) > 4096:
                    self._buffer = self._buffer[-256:]
                return parsed_targets

            if header_index > 0:
                del self._buffer[:header_index]

            footer_index = self._buffer.find(LD2450_BINARY_FOOTER, len(LD2450_BINARY_HEADER))
            if footer_index < 0:
                if len(self._buffer) > 4096:
                    self._buffer = self._buffer[-256:]
                return parsed_targets

            frame = bytes(self._buffer[: footer_index + len(LD2450_BINARY_FOOTER)])
            del self._buffer[: footer_index + len(LD2450_BINARY_FOOTER)]

            frame_targets = self._parse_binary_frame(frame, now=current_time)
            if frame_targets is not None:
                parsed_targets = frame_targets

    def _parse_binary_frame(self, frame, now=None):
        current_time = time.time() if now is None else now
        if not frame.startswith(LD2450_BINARY_HEADER) or not frame.endswith(LD2450_BINARY_FOOTER):
            return None

        payload_bytes = frame[len(LD2450_BINARY_HEADER) : -len(LD2450_BINARY_FOOTER)]
        if len(payload_bytes) < LD2450_BINARY_PAYLOAD_SIZE:
            return None

        payload_bytes = payload_bytes[:LD2450_BINARY_PAYLOAD_SIZE]
        targets = []
        for target_index in range(LD2450_BINARY_TARGET_COUNT):
            offset = target_index * LD2450_BINARY_TARGET_SIZE
            chunk = payload_bytes[offset : offset + LD2450_BINARY_TARGET_SIZE]
            target = self._parse_target_chunk(target_index + 1, chunk, current_time)
            if target is not None:
                targets.append(target)
        return targets

    def _parse_target_chunk(self, target_id, chunk, timestamp):
        if len(chunk) != LD2450_BINARY_TARGET_SIZE:
            return None

        x_mm = _decode_signed_15bit(chunk[0], chunk[1])
        y_mm = _decode_signed_15bit(chunk[2], chunk[3])
        speed_cm_s = _decode_signed_15bit(chunk[4], chunk[5])
        resolution_mm = int(chunk[6]) | (int(chunk[7]) << 8)

        if x_mm == 0 and y_mm == 0 and speed_cm_s == 0 and resolution_mm == 0:
            return None

        distance_mm = int(round(math.hypot(x_mm, y_mm)))
        angle_deg = round(math.degrees(math.atan2(x_mm, max(y_mm, 1))), 1)
        direction = self._direction_from_speed(speed_cm_s)
        approaching_gate = (
            direction == "approaching"
            and abs(angle_deg) <= 45.0
            and distance_mm <= max(int(self.config.get("gate_distance_alert_mm", 3000)) * 2, 6000)
        )

        target = {
            "id": int(target_id),
            "radar_id": int(target_id),
            "x_mm": int(x_mm),
            "y_mm": int(y_mm),
            "distance_mm": int(distance_mm),
            "angle_deg": angle_deg,
            "speed_cm_s": int(speed_cm_s),
            "speed_mm_s": int(speed_cm_s * 10),
            "resolution_mm": int(resolution_mm),
            "timestamp": timestamp,
            "valid": True,
            "direction": direction,
            "approaching_gate": approaching_gate,
            "confidence": 0.95,
        }

        if not self._is_reasonable_target(target):
            return None

        target["radar_risk"] = self._compute_radar_risk(target)
        return target

    def _normalize_mock_payload(self, payload, now=None):
        current_time = time.time() if now is None else now
        mock_targets = []
        raw_targets = payload.get("targets", []) if isinstance(payload, dict) else []
        for index, target in enumerate(raw_targets, start=1):
            target_id = int(target.get("radar_id", index) or index)
            speed_mm_s = float(target.get("speed_mm_s", 0.0) or 0.0)
            speed_cm_s = int(round(speed_mm_s / 10.0))
            normalized_target = {
                "id": target_id,
                "radar_id": target_id,
                "x_mm": int(round(float(target.get("x_mm", 0.0) or 0.0))),
                "y_mm": int(round(float(target.get("y_mm", 0.0) or 0.0))),
                "distance_mm": int(round(float(target.get("distance_mm", 0.0) or 0.0))),
                "angle_deg": round(float(target.get("angle_deg", 0.0) or 0.0), 1),
                "speed_cm_s": speed_cm_s,
                "speed_mm_s": int(round(speed_mm_s)),
                "resolution_mm": int(round(float(target.get("resolution_mm", 0.0) or 0.0))),
                "timestamp": float(target.get("timestamp", current_time) or current_time),
                "valid": bool(target.get("valid", True)),
                "direction": str(target.get("direction", self._direction_from_speed(speed_cm_s))),
                "approaching_gate": bool(target.get("approaching_gate", False)),
                "confidence": float(target.get("confidence", 0.9) or 0.9),
                "radar_risk": int(target.get("radar_risk", 0) or 0),
            }
            if self._is_reasonable_target(normalized_target):
                mock_targets.append(normalized_target)

        return self._empty_payload(
            now=current_time,
            connected=True,
            status="MOCK",
            targets=mock_targets,
            provider="mock",
            scenario=str(payload.get("scenario", self.config.get("scenario", "idle"))),
        )

    def _direction_from_speed(self, speed_cm_s):
        speed_value = float(speed_cm_s or 0.0)
        if speed_value <= -10.0:
            return "approaching"
        if speed_value >= 10.0:
            return "receding"
        return "stationary"

    def _is_reasonable_target(self, target):
        if not target:
            return False

        distance_mm = float(target.get("distance_mm", 0.0) or 0.0)
        speed_cm_s = abs(float(target.get("speed_cm_s", 0.0) or 0.0))
        x_mm = abs(float(target.get("x_mm", 0.0) or 0.0))
        y_mm = float(target.get("y_mm", 0.0) or 0.0)

        if distance_mm <= 0.0:
            return False
        if distance_mm < float(self.config.get("min_distance_mm", 80)):
            return False
        if distance_mm > float(self.config.get("max_distance_mm", 10000)):
            return False
        if speed_cm_s > float(self.config.get("max_speed_cm_s", 1200)):
            return False
        if x_mm > float(self.config.get("max_lateral_mm", 6000)):
            return False
        if y_mm < 0.0 or y_mm > float(self.config.get("max_forward_mm", 10000)):
            return False
        return bool(target.get("valid", True))

    def _compute_radar_risk(self, target):
        distance_mm = float(target.get("distance_mm", 0.0) or 0.0)
        speed_cm_s = float(target.get("speed_cm_s", 0.0) or 0.0)
        abs_speed_cm_s = abs(speed_cm_s)
        resolution_mm = float(target.get("resolution_mm", 0.0) or 0.0)
        approaching = speed_cm_s < -10.0
        near_gate = abs(float(target.get("angle_deg", 0.0) or 0.0)) <= 45.0

        risk = 0.0
        if distance_mm <= float(self.config.get("fence_distance_alert_mm", 2000)):
            risk += 24.0
        if near_gate and distance_mm <= float(self.config.get("gate_distance_alert_mm", 3000)):
            risk += 18.0
        if abs_speed_cm_s >= float(self.config.get("alert_speed_cm_s", 60)):
            risk += 16.0
        if abs_speed_cm_s >= float(self.config.get("danger_speed_cm_s", 120)):
            risk += 22.0
        if approaching:
            risk += 14.0
        if distance_mm <= 1500.0:
            risk += 10.0
        if resolution_mm >= 250.0:
            risk += 6.0
        return int(round(_clamp(risk, 0.0, 100.0)))


def get_shared_radar_provider():
    global _shared_provider
    with _shared_provider_lock:
        if _shared_provider is None:
            _shared_provider = RadarDataProvider()
        return _shared_provider


def get_live_radar_payload(now=None):
    return get_shared_radar_provider().get_latest_payload(now=now)
