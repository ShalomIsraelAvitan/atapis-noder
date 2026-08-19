import os
import re
import threading
import time
from datetime import datetime
from urllib.parse import quote

import cv2


DEFAULT_RTSP_PORT = 554
DEFAULT_DAHUA_CHANNEL = 1
DEFAULT_DAHUA_SUBTYPE = 1
DEFAULT_RECONNECT_DELAY_S = 3.0
DEFAULT_FFMPEG_CAPTURE_OPTIONS = "rtsp_transport;tcp"


def load_env_file(env_path, override=False):
    if not env_path or not os.path.exists(env_path):
        return False

    try:
        with open(env_path, "r", encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue

                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")

                if not key:
                    continue

                if override or key not in os.environ:
                    os.environ[key] = value
        return True
    except OSError:
        return False


def _safe_int(value, default):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError, AttributeError):
        return default


def build_dahua_config_from_env():
    return {
        "host": (os.getenv("DAHUA_HOST") or "").strip(),
        "port": _safe_int(os.getenv("DAHUA_PORT"), DEFAULT_RTSP_PORT),
        "username": (os.getenv("DAHUA_USERNAME") or "").strip(),
        "password": os.getenv("DAHUA_PASSWORD") or "",
        "channel": _safe_int(os.getenv("DAHUA_CHANNEL"), DEFAULT_DAHUA_CHANNEL),
        "subtype": _safe_int(os.getenv("DAHUA_SUBTYPE"), DEFAULT_DAHUA_SUBTYPE),
    }


def sanitize_camera_name(name):
    sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(name or "camera")).strip("_")
    return sanitized or "camera"


def mask_secret(secret):
    secret = str(secret or "")
    if not secret:
        return ""
    if len(secret) <= 2:
        return "*" * len(secret)
    return f"{secret[0]}***{secret[-1]}"


def build_dahua_rtsp_url(config):
    username = quote(str(config.get("username", "")), safe="")
    password = quote(str(config.get("password", "")), safe="")
    host = str(config.get("host", "")).strip()
    port = _safe_int(config.get("port"), DEFAULT_RTSP_PORT)
    channel = _safe_int(config.get("channel"), DEFAULT_DAHUA_CHANNEL)
    subtype = _safe_int(config.get("subtype"), DEFAULT_DAHUA_SUBTYPE)

    return (
        f"rtsp://{username}:{password}@{host}:{port}/cam/realmonitor"
        f"?channel={channel}&subtype={subtype}"
    )


def get_sanitized_dahua_config(config):
    return {
        "host": str(config.get("host", "")).strip(),
        "port": _safe_int(config.get("port"), DEFAULT_RTSP_PORT),
        "channel": _safe_int(config.get("channel"), DEFAULT_DAHUA_CHANNEL),
        "subtype": _safe_int(config.get("subtype"), DEFAULT_DAHUA_SUBTYPE),
        "username": str(config.get("username", "")).strip(),
        "password_masked": mask_secret(config.get("password", "")),
    }


def sanitize_rtsp_url(rtsp_url):
    if not rtsp_url:
        return ""
    # Redact the whole userinfo section: neither the username nor the password
    # may reach a log, an API payload or the dashboard.
    return re.sub(r"(rtsp://)[^/@\s]+(@)", r"\1[REDACTED]\2", str(rtsp_url))


def sanitize_error_message(message, secrets=None):
    sanitized = str(message or "").strip()
    if not sanitized:
        return None

    for secret in secrets or []:
        secret = str(secret or "")
        if not secret:
            continue
        sanitized = sanitized.replace(secret, "***")
        sanitized = sanitized.replace(quote(secret, safe=""), "***")

    sanitized = sanitize_rtsp_url(sanitized)
    return sanitized


def redact_credentials(text, secrets=None):
    """Strip camera credentials out of an arbitrary text blob."""
    redacted = str(text)
    for secret in secrets or []:
        secret = str(secret or "")
        # Short values are skipped: replacing them would corrupt unrelated text.
        if len(secret) < 3:
            continue
        redacted = redacted.replace(secret, "[REDACTED]")
        quoted = quote(secret, safe="")
        if quoted != secret:
            redacted = redacted.replace(quoted, "[REDACTED]")
    return sanitize_rtsp_url(redacted)


_credential_filter_lock = threading.Lock()
_credential_filter_installed = False


def install_stderr_credential_filter(secrets_provider=None):
    """Redact camera credentials from everything written to stderr.

    OpenCV/FFmpeg write some errors straight to file descriptor 2 from native
    code, so they never pass through Python logging and cannot be sanitized at
    the call site. Replacing fd 2 with a pipe lets every byte - Python and
    native alike - be filtered before it reaches the real stderr. Nothing is
    dropped; only credentials are replaced.
    """
    global _credential_filter_installed

    with _credential_filter_lock:
        if _credential_filter_installed:
            return False

        try:
            original_stderr_fd = os.dup(2)
            read_fd, write_fd = os.pipe()
            os.dup2(write_fd, 2)
            os.close(write_fd)
        except OSError:
            return False

        def _write_through(raw_line):
            try:
                secrets = list(secrets_provider() or []) if secrets_provider else []
            except Exception:
                secrets = []

            cleaned = redact_credentials(raw_line.decode("utf-8", errors="replace"), secrets)
            try:
                os.write(original_stderr_fd, cleaned.encode("utf-8", errors="replace"))
            except OSError:
                pass

        def _pump():
            pending = b""
            while True:
                try:
                    chunk = os.read(read_fd, 65536)
                except OSError:
                    break
                if not chunk:
                    break

                pending += chunk
                parts = pending.split(b"\n")
                pending = parts.pop()
                for line in parts:
                    _write_through(line + b"\n")

            if pending:
                _write_through(pending)

        threading.Thread(target=_pump, name="stderr_credential_filter", daemon=True).start()
        _credential_filter_installed = True
        return True


def _set_capture_options(cap):
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass

    for prop_name, value in (
        ("CAP_PROP_OPEN_TIMEOUT_MSEC", 5000),
        ("CAP_PROP_READ_TIMEOUT_MSEC", 5000),
    ):
        prop = getattr(cv2, prop_name, None)
        if prop is None:
            continue
        try:
            cap.set(prop, value)
        except Exception:
            pass


def _open_rtsp_capture(rtsp_url):
    os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", DEFAULT_FFMPEG_CAPTURE_OPTIONS)

    backends = []
    ffmpeg_backend = getattr(cv2, "CAP_FFMPEG", None)
    if ffmpeg_backend is not None:
        backends.append(ffmpeg_backend)
    backends.append(None)

    attempts = []
    for backend in backends:
        backend_label = "CAP_FFMPEG" if backend is not None else "default"
        try:
            cap = cv2.VideoCapture(rtsp_url, backend) if backend is not None else cv2.VideoCapture(rtsp_url)
            _set_capture_options(cap)
            if cap and cap.isOpened():
                return cap, None, backend_label

            attempts.append(f"{backend_label}: open failed")
            if cap:
                cap.release()
        except Exception as exc:
            attempts.append(f"{backend_label}: {exc}")

    return None, "; ".join(attempts) or "RTSP capture open failed", None


def test_rtsp_connection(config):
    secrets = [config.get("password", ""), build_dahua_rtsp_url(config)]
    rtsp_url = build_dahua_rtsp_url(config)
    cap = None

    try:
        cap, error_message, backend_label = _open_rtsp_capture(rtsp_url)
        if cap is None:
            return {
                "success": False,
                "connected": False,
                "frame_read": False,
                "backend": backend_label,
                "sanitized_error": sanitize_error_message(error_message, secrets=secrets),
            }

        connected = cap.isOpened()
        ok, frame = cap.read()
        frame_read = bool(ok and frame is not None)
        error_message = None if frame_read else "RTSP stream opened but no frame could be read."
        return {
            "success": bool(connected and frame_read),
            "connected": bool(connected),
            "frame_read": frame_read,
            "backend": backend_label,
            "sanitized_error": sanitize_error_message(error_message, secrets=secrets),
        }
    except Exception as exc:
        return {
            "success": False,
            "connected": False,
            "frame_read": False,
            "backend": None,
            "sanitized_error": sanitize_error_message(exc, secrets=secrets),
        }
    finally:
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass


class LatestFrameRTSPReader:
    def __init__(self, camera_name, config, reconnect_delay_s=DEFAULT_RECONNECT_DELAY_S):
        self.camera_name = sanitize_camera_name(camera_name)
        self._config = dict(config or {})
        self._reconnect_delay_s = max(1.0, float(reconnect_delay_s or DEFAULT_RECONNECT_DELAY_S))
        self._status_lock = threading.Lock()
        self._frame_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = None
        self._capture = None
        self._latest_frame = None
        self._frames_received = 0
        self._status = {
            "connected": False,
            "status": "disconnected",
            "last_error": None,
            "last_frame_time": None,
            "frames_received": 0,
            "backend": None,
        }

    def _clear_latest_frame(self):
        with self._frame_lock:
            self._latest_frame = None

    def _rtsp_url(self):
        return build_dahua_rtsp_url(self._config)

    def _sanitize_error(self, message):
        return sanitize_error_message(
            message,
            secrets=[self._config.get("password", ""), self._rtsp_url()],
        )

    def update_config(self, config):
        self._config = dict(config or {})

    def start(self):
        if self._thread is not None and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._reader_loop, name=f"{self.camera_name}_rtsp_reader", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        self._thread = None
        self._release_capture()
        self._clear_latest_frame()
        with self._status_lock:
            self._status["connected"] = False
            self._status["status"] = "disconnected"

    def reconnect(self):
        self.stop()
        self.start()

    def _release_capture(self):
        if self._capture is not None:
            try:
                self._capture.release()
            except Exception:
                pass
            self._capture = None

    def _set_status(self, **updates):
        with self._status_lock:
            self._status.update(updates)

    def _reader_loop(self):
        while not self._stop_event.is_set():
            self._set_status(connected=False, status="reconnecting")
            capture, error_message, backend_label = _open_rtsp_capture(self._rtsp_url())
            if capture is None:
                self._clear_latest_frame()
                self._set_status(
                    connected=False,
                    status="disconnected",
                    backend=backend_label,
                    last_error=self._sanitize_error(error_message),
                )
                self._stop_event.wait(self._reconnect_delay_s)
                continue

            self._capture = capture
            self._set_status(
                connected=True,
                status="active",
                backend=backend_label,
                last_error=None,
            )

            while not self._stop_event.is_set():
                try:
                    ok, frame = capture.read()
                except Exception as exc:
                    ok = False
                    frame = None
                    error_message = exc

                if not ok or frame is None:
                    self._clear_latest_frame()
                    self._set_status(
                        connected=False,
                        status="reconnecting",
                        last_error=self._sanitize_error(error_message or "RTSP frame read failed."),
                    )
                    break

                frame_time = time.time()
                with self._frame_lock:
                    self._latest_frame = frame.copy()
                self._frames_received += 1
                self._set_status(
                    connected=True,
                    status="active",
                    last_error=None,
                    last_frame_time=frame_time,
                    frames_received=self._frames_received,
                )

            self._release_capture()
            if not self._stop_event.is_set():
                self._stop_event.wait(self._reconnect_delay_s)

        self._release_capture()

    def get_latest_frame(self):
        with self._frame_lock:
            if self._latest_frame is None:
                return None
            return self._latest_frame.copy()

    def get_status(self):
        with self._status_lock:
            status = dict(self._status)

        last_frame_time = status.get("last_frame_time")
        if last_frame_time:
            status["last_frame_time"] = datetime.fromtimestamp(last_frame_time).strftime("%H:%M:%S")

        status.update(get_sanitized_dahua_config(self._config))
        return status
