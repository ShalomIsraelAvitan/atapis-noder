"""Radar simulator utilities for synthetic HLK-LD2450-style target data.

The simulator intentionally exposes a small provider-like API so the project
can later swap this module with a UART/serial-backed radar implementation
without changing the camera analysis pipeline.
"""

from __future__ import annotations

import copy
import json
import math
import os
import time


CONFIG_FILENAME = "radar_config.json"
CONFIG_PATH = os.path.join(os.path.dirname(__file__), CONFIG_FILENAME)

DEFAULT_RADAR_CONFIG = {
    "radar_enabled": True,
    "radar_mode": "simulator",
    "scenario": "approaching_gate",
    "max_targets": 3,
    "update_rate_hz": 10,
    "danger_speed_mm_s": 1200,
    "alert_speed_mm_s": 600,
    "gate_distance_alert_mm": 3000,
    "fence_distance_alert_mm": 2000,
    "noise_enabled": True,
    "show_debug_overlay_on_camera": False,
}

RADAR_SCENARIOS = (
    "idle",
    "walking_parallel",
    "approaching_gate",
    "running_to_gate",
    "loitering_near_fence",
    "multiple_targets",
    "noisy_false_positive",
)


def _clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def get_default_radar_config():
    return copy.deepcopy(DEFAULT_RADAR_CONFIG)


def get_available_scenarios():
    return list(RADAR_SCENARIOS)


def merge_radar_config(config):
    merged = get_default_radar_config()
    if isinstance(config, dict):
        merged.update(config)

    if merged.get("scenario") not in RADAR_SCENARIOS:
        merged["scenario"] = DEFAULT_RADAR_CONFIG["scenario"]

    merged["radar_enabled"] = bool(merged.get("radar_enabled", True))
    merged["radar_mode"] = str(merged.get("radar_mode", "simulator") or "simulator")
    merged["max_targets"] = int(_clamp(int(merged.get("max_targets", 3) or 3), 0, 8))
    merged["update_rate_hz"] = int(_clamp(int(merged.get("update_rate_hz", 10) or 10), 1, 60))
    merged["danger_speed_mm_s"] = int(_clamp(int(merged.get("danger_speed_mm_s", 1200) or 1200), 100, 10000))
    merged["alert_speed_mm_s"] = int(_clamp(int(merged.get("alert_speed_mm_s", 600) or 600), 50, 9000))
    merged["gate_distance_alert_mm"] = int(
        _clamp(int(merged.get("gate_distance_alert_mm", 3000) or 3000), 500, 12000)
    )
    merged["fence_distance_alert_mm"] = int(
        _clamp(int(merged.get("fence_distance_alert_mm", 2000) or 2000), 500, 12000)
    )
    merged["noise_enabled"] = bool(merged.get("noise_enabled", True))
    merged["show_debug_overlay_on_camera"] = bool(merged.get("show_debug_overlay_on_camera", False))
    return merged


def load_radar_config(config_path=CONFIG_PATH):
    if not os.path.exists(config_path):
        return get_default_radar_config()

    try:
        with open(config_path, "r", encoding="utf-8") as config_file:
            return merge_radar_config(json.load(config_file))
    except (OSError, ValueError, TypeError):
        return get_default_radar_config()


def save_radar_config(config, config_path=CONFIG_PATH):
    merged = merge_radar_config(config)
    temp_path = f"{config_path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as config_file:
        json.dump(merged, config_file, indent=2)
    os.replace(temp_path, config_path)
    return merged


def compute_radar_risk(target, active_targets_count, config, dwell_time_s=0.0):
    """Return a 0-100 risk score for a simulated radar target."""

    speed_mm_s = abs(float(target.get("speed_mm_s", 0.0)))
    confidence = _clamp(float(target.get("confidence", 0.0)), 0.0, 1.0)
    distance_mm = abs(float(target.get("distance_mm", 0.0)))
    direction = str(target.get("direction", "unknown"))
    approaching_gate = bool(target.get("approaching_gate", False))

    risk = 0.0

    if approaching_gate:
        if speed_mm_s >= config["danger_speed_mm_s"]:
            risk += 58.0
        elif speed_mm_s >= config["alert_speed_mm_s"]:
            risk += 34.0
        else:
            risk += 20.0

        if distance_mm <= config["gate_distance_alert_mm"]:
            risk += 12.0

    if direction == "stationary" and distance_mm <= config["fence_distance_alert_mm"]:
        risk += 8.0

    if dwell_time_s >= 8.0 and distance_mm <= config["fence_distance_alert_mm"]:
        risk += 24.0
    elif dwell_time_s >= 4.0 and distance_mm <= config["fence_distance_alert_mm"]:
        risk += 12.0

    if active_targets_count > 1:
        risk += 8.0 + max(0, active_targets_count - 2) * 5.0

    if direction == "parallel" and speed_mm_s >= config["alert_speed_mm_s"]:
        risk += 6.0

    confidence_scale = 0.35 + (0.65 * confidence)
    risk *= confidence_scale

    return int(round(_clamp(risk, 0.0, 100.0)))


class RadarSimulator:
    """Synthetic radar provider with stable target ids and scenario loops."""

    def __init__(self, config_path=CONFIG_PATH):
        self.config_path = config_path
        self.config = load_radar_config(self.config_path)
        self._config_mtime = self._get_config_mtime()
        self._scenario_started_at = time.time()
        self._last_update_ts = 0.0
        self._target_memory = {}
        self._last_payload = self._empty_payload(self._scenario_started_at)

    def _get_config_mtime(self):
        try:
            return os.path.getmtime(self.config_path)
        except OSError:
            return None

    def _config_signature(self, config):
        if not isinstance(config, dict):
            return ()
        return (
            config.get("radar_enabled"),
            config.get("radar_mode"),
            config.get("scenario"),
            config.get("max_targets"),
            config.get("update_rate_hz"),
            config.get("danger_speed_mm_s"),
            config.get("alert_speed_mm_s"),
            config.get("gate_distance_alert_mm"),
            config.get("fence_distance_alert_mm"),
            config.get("noise_enabled"),
        )

    def _empty_payload(self, now=None):
        now = time.time() if now is None else now
        return {
            "enabled": bool(self.config.get("radar_enabled", False)),
            "mode": self.config.get("radar_mode", "simulator"),
            "scenario": self.config.get("scenario", "idle"),
            "targets": [],
            "max_radar_risk": 0,
            "confidence": 0.0,
            "timestamp": now,
        }

    def _reload_config_if_needed(self):
        new_mtime = self._get_config_mtime()
        if new_mtime == self._config_mtime:
            return

        previous_signature = self._config_signature(self.config)
        self.config = load_radar_config(self.config_path)
        self._config_mtime = new_mtime

        if self._config_signature(self.config) != previous_signature:
            self.reset()

    def reset(self):
        self._scenario_started_at = time.time()
        self._last_update_ts = 0.0
        self._target_memory = {}
        self._last_payload = self._empty_payload(self._scenario_started_at)

    def _apply_noise(self, radar_id, x_mm, y_mm, elapsed_s):
        if not self.config.get("noise_enabled", True):
            return x_mm, y_mm

        base_jitter = 55.0
        x_jitter = math.sin((elapsed_s * 1.7) + radar_id) * base_jitter
        y_jitter = math.cos((elapsed_s * 1.3) + (radar_id * 0.5)) * base_jitter
        return x_mm + x_jitter, y_mm + y_jitter

    def _scenario_idle(self, elapsed_s):
        return []

    def _scenario_walking_parallel(self, elapsed_s):
        cycle = 12.0
        phase = (elapsed_s % cycle) / cycle
        x_mm = -1800.0 + (phase * 3600.0)
        y_mm = 2500.0 + math.sin(elapsed_s * 1.4) * 120.0
        return [
            {
                "radar_id": 1,
                "x_mm": x_mm,
                "y_mm": y_mm,
                "confidence": 0.94,
                "direction_hint": "parallel",
                "speed_hint_mm_s": 420.0,
            }
        ]

    def _scenario_approaching_gate(self, elapsed_s):
        cycle = 8.0
        phase = (elapsed_s % cycle) / cycle
        x_mm = 900.0 - (phase * 650.0)
        y_mm = 6200.0 - (phase * 3800.0)
        return [
            {
                "radar_id": 1,
                "x_mm": x_mm,
                "y_mm": y_mm,
                "confidence": 0.92,
                "direction_hint": "approaching",
                "speed_hint_mm_s": 850.0,
            }
        ]

    def _scenario_running_to_gate(self, elapsed_s):
        cycle = 5.0
        phase = (elapsed_s % cycle) / cycle
        x_mm = 1400.0 - (phase * 1300.0)
        y_mm = 7000.0 - (phase * 5600.0)
        return [
            {
                "radar_id": 1,
                "x_mm": x_mm,
                "y_mm": y_mm,
                "confidence": 0.97,
                "direction_hint": "approaching",
                "speed_hint_mm_s": 1650.0,
            }
        ]

    def _scenario_loitering_near_fence(self, elapsed_s):
        x_mm = 1450.0 + (math.sin(elapsed_s * 0.7) * 110.0)
        y_mm = 1700.0 + (math.cos(elapsed_s * 0.9) * 80.0)
        return [
            {
                "radar_id": 1,
                "x_mm": x_mm,
                "y_mm": y_mm,
                "confidence": 0.89,
                "direction_hint": "stationary",
                "speed_hint_mm_s": 90.0,
            }
        ]

    def _scenario_multiple_targets(self, elapsed_s):
        approach_phase = (elapsed_s % 9.0) / 9.0
        parallel_phase = (elapsed_s % 11.0) / 11.0
        return [
            {
                "radar_id": 1,
                "x_mm": 700.0 - (approach_phase * 500.0),
                "y_mm": 6100.0 - (approach_phase * 3600.0),
                "confidence": 0.95,
                "direction_hint": "approaching",
                "speed_hint_mm_s": 780.0,
            },
            {
                "radar_id": 2,
                "x_mm": -1700.0 + (parallel_phase * 3200.0),
                "y_mm": 2800.0 + (math.sin(elapsed_s) * 150.0),
                "confidence": 0.88,
                "direction_hint": "parallel",
                "speed_hint_mm_s": 480.0,
            },
            {
                "radar_id": 3,
                "x_mm": -900.0 + (math.sin(elapsed_s * 0.8) * 90.0),
                "y_mm": 1900.0 + (math.cos(elapsed_s * 0.5) * 75.0),
                "confidence": 0.84,
                "direction_hint": "stationary",
                "speed_hint_mm_s": 65.0,
            },
        ]

    def _scenario_noisy_false_positive(self, elapsed_s):
        return [
            {
                "radar_id": 91,
                "x_mm": math.sin(elapsed_s * 2.4) * 2500.0,
                "y_mm": 4300.0 + (math.cos(elapsed_s * 2.0) * 900.0),
                "confidence": 0.28,
                "direction_hint": "uncertain",
                "speed_hint_mm_s": 260.0,
            }
        ]

    def _build_scenario_targets(self, scenario, elapsed_s):
        scenario_builders = {
            "idle": self._scenario_idle,
            "walking_parallel": self._scenario_walking_parallel,
            "approaching_gate": self._scenario_approaching_gate,
            "running_to_gate": self._scenario_running_to_gate,
            "loitering_near_fence": self._scenario_loitering_near_fence,
            "multiple_targets": self._scenario_multiple_targets,
            "noisy_false_positive": self._scenario_noisy_false_positive,
        }

        builder = scenario_builders.get(scenario, self._scenario_approaching_gate)
        targets = builder(elapsed_s)

        if scenario == "noisy_false_positive" and not self.config.get("noise_enabled", True):
            return []

        max_targets = int(self.config.get("max_targets", 3) or 3)
        return targets[:max_targets] if max_targets >= 0 else targets

    def _determine_direction(self, previous_state, current_state, fallback_direction):
        if not previous_state:
            return fallback_direction

        distance_delta = previous_state["distance_mm"] - current_state["distance_mm"]
        lateral_delta = current_state["x_mm"] - previous_state["x_mm"]
        forward_delta = current_state["y_mm"] - previous_state["y_mm"]

        if distance_delta > 120.0:
            return "approaching"
        if distance_delta < -120.0:
            return "departing"
        if abs(lateral_delta) > abs(forward_delta):
            return "parallel"
        if abs(lateral_delta) < 90.0 and abs(forward_delta) < 90.0:
            return "stationary"
        return fallback_direction

    def generate_targets(self, frame_shape=None, camera_tracks=None, now=None):
        del frame_shape
        del camera_tracks

        self._reload_config_if_needed()
        now = time.time() if now is None else now

        if not self.config.get("radar_enabled", True):
            payload = self._empty_payload(now)
            self._last_payload = payload
            return payload

        if self.config.get("radar_mode") != "simulator":
            payload = self._empty_payload(now)
            payload["enabled"] = True
            self._last_payload = payload
            return payload

        update_interval = 1.0 / max(1, int(self.config.get("update_rate_hz", 10) or 10))
        if self._last_update_ts and (now - self._last_update_ts) < update_interval:
            return copy.deepcopy(self._last_payload)

        elapsed_s = now - self._scenario_started_at
        raw_targets = self._build_scenario_targets(self.config.get("scenario", "approaching_gate"), elapsed_s)
        finalized_targets = []
        active_ids = set()

        for raw_target in raw_targets:
            radar_id = int(raw_target.get("radar_id", 0) or 0)
            active_ids.add(radar_id)

            x_mm, y_mm = self._apply_noise(
                radar_id,
                float(raw_target.get("x_mm", 0.0)),
                max(300.0, float(raw_target.get("y_mm", 0.0))),
                elapsed_s,
            )
            distance_mm = math.hypot(x_mm, y_mm)
            angle_deg = math.degrees(math.atan2(x_mm, max(y_mm, 1.0)))
            previous_state = self._target_memory.get(radar_id)

            if previous_state:
                dt = max(now - previous_state["timestamp"], 1e-3)
                speed_mm_s = math.hypot(
                    x_mm - previous_state["x_mm"],
                    y_mm - previous_state["y_mm"],
                ) / dt
            else:
                speed_mm_s = float(raw_target.get("speed_hint_mm_s", 0.0))

            current_state = {
                "x_mm": x_mm,
                "y_mm": y_mm,
                "distance_mm": distance_mm,
                "timestamp": now,
            }
            direction = self._determine_direction(
                previous_state,
                current_state,
                str(raw_target.get("direction_hint", "unknown")),
            )

            approach_hint = str(raw_target.get("direction_hint", "")).lower() == "approaching"
            approaching_gate = (
                (direction == "approaching" or approach_hint)
                and abs(angle_deg) <= 45.0
                and distance_mm <= max(
                    self.config["gate_distance_alert_mm"] * 2.5,
                    7500,
                )
            )

            near_fence = distance_mm <= self.config["fence_distance_alert_mm"]
            if previous_state and near_fence and previous_state.get("near_fence"):
                loiter_started_at = previous_state.get("loiter_started_at", now)
            elif near_fence:
                loiter_started_at = now
            else:
                loiter_started_at = None

            dwell_time_s = (now - loiter_started_at) if loiter_started_at else 0.0
            confidence = _clamp(float(raw_target.get("confidence", 0.0)), 0.0, 1.0)

            target = {
                "radar_id": radar_id,
                "x_mm": int(round(x_mm)),
                "y_mm": int(round(y_mm)),
                "distance_mm": int(round(distance_mm)),
                "angle_deg": round(angle_deg, 1),
                "speed_mm_s": round(speed_mm_s, 1),
                "direction": direction,
                "approaching_gate": approaching_gate,
                "radar_risk": 0,
                "confidence": round(confidence, 2),
                "timestamp": now,
            }
            target["radar_risk"] = compute_radar_risk(
                target,
                active_targets_count=len(raw_targets),
                config=self.config,
                dwell_time_s=dwell_time_s,
            )

            self._target_memory[radar_id] = {
                **current_state,
                "near_fence": near_fence,
                "loiter_started_at": loiter_started_at,
            }
            finalized_targets.append(target)

        stale_ids = [radar_id for radar_id in self._target_memory if radar_id not in active_ids]
        for radar_id in stale_ids:
            self._target_memory.pop(radar_id, None)

        payload = {
            "enabled": True,
            "mode": self.config.get("radar_mode", "simulator"),
            "scenario": self.config.get("scenario", "approaching_gate"),
            "targets": finalized_targets,
            "max_radar_risk": max((target["radar_risk"] for target in finalized_targets), default=0),
            "confidence": round(max((target["confidence"] for target in finalized_targets), default=0.0), 2),
            "timestamp": now,
        }

        self._last_update_ts = now
        self._last_payload = copy.deepcopy(payload)
        return payload
