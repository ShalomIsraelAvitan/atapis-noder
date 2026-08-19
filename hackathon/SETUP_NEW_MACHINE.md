# New Machine Setup

Use this guide when you want to move the project to another Windows machine.

## What to copy

Copy the full `hackathon/` folder.

Do not rely on these folders being portable between machines:

- `.venv`
- `python/venv`
- `node_modules`
- `logs`
- `run-logs`

These are especially important to keep because the app uses them at runtime:

- `python/yolov8n.pt`
- `python/yolov8n-pose.pt`
- `python/radar_config.json`
- `data/` if you want to keep users, detections, and monitoring history
- `.env` if you already have working Dahua / radar settings

## Install before first run

Install these on the target machine:

- Python 3.10 or newer
- Node.js + npm if you want frontend development or a fresh frontend build
- FFmpeg only if you plan to use scenario video analysis export
- Camera / Arduino / radar drivers if you use that hardware

## Fastest setup

From PowerShell:

```powershell
Set-Location "C:\path\to\hackathon"
powershell -ExecutionPolicy Bypass -File .\setup-new-machine.ps1
```

If you only want the backend:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-new-machine.ps1 -BackendOnly
```

## What the script does

The setup script:

- checks that Python is installed and is at least version 3.10
- creates a fresh `.venv` in the project root if needed
- upgrades `pip`
- installs `python/requirements.txt`
- copies `.env.example` to `.env` if `.env` is missing
- installs frontend dependencies with `npm install` unless `-BackendOnly` is used
- warns if optional runtime pieces are still missing

## Important notes

### 1. Weapon model fallback

The backend looks for `python/weapon_best.pt`.

If that file is missing, the code falls back to downloading the model with `huggingface_hub` on first run. That means:

- internet access is needed on the first backend start, or
- you should place `weapon_best.pt` manually in `python/`

### 2. Dahua and radar settings

The app reads `.env` from the project root. Review these values before live use:

- `DAHUA_HOST`
- `DAHUA_PORT`
- `DAHUA_USERNAME`
- `DAHUA_PASSWORD`
- `DAHUA_CHANNEL`
- `DAHUA_SUBTYPE`
- `LD2450_PORT`
- `LD2450_BAUD`
- `LD2450_ENABLED`
- `RADAR_USE_MOCK`

### 3. Arduino is optional

If Arduino is not connected, the backend continues without it. You only need to worry about it if you want the alert light / beeper integration.

### 4. FFmpeg is optional

FFmpeg is not required for the live dashboard itself.

It is only needed for scenario video analysis export, where the backend converts the analyzed video to a browser-friendly MP4.

## Start the project after setup

For development:

```powershell
.\run-dev.ps1
```

For a production-style local run:

```powershell
.\run-prod.ps1
```

Backend only:

```powershell
Set-Location .\python
& ..\.venv\Scripts\python.exe .\server.py
```

## Quick verification checklist

After startup, check:

- `http://127.0.0.1:5000/status`
- `http://localhost:5173/` in dev mode
- `http://localhost:5000/` in production-style mode
- `http://127.0.0.1:5000/video_feed` if you expect webcam streaming
- `http://127.0.0.1:5000/api/cameras/dahua/test` if you use Dahua RTSP

## Common problems

### `python` command not found

Install Python and make sure it is added to `PATH`.

### `npm` command not found

Install Node.js and npm.

### `weapon_best.pt` missing and no internet

Place the file manually in `python/weapon_best.pt`.

### `ffmpeg` not found

Install FFmpeg and add it to `PATH` if you use scenario analysis export.

### Camera or serial device not detected

Make sure the hardware is connected and not locked by another application.
