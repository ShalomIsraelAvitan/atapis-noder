# Smart Security System

A modern security monitoring system with camera detection, Arduino integration, and user management.

## New Machine Setup

If you want to move this project to another Windows machine, use:

- `setup-new-machine.ps1`
- `SETUP_NEW_MACHINE.md`

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd python
pip install -r requirements.txt
```

### 2. Start the Python Server

**Windows:**
```bash
start-server.bat
```

**Linux/Mac:**
```bash
chmod +x start-server.sh
./start-server.sh
```

**Or manually:**
```bash
cd python
python server.py
```

The server will start on `http://localhost:5000`

### 3. Install Frontend Dependencies

```bash
npm install
```

### 4. Start the Frontend

```bash
npm run dev
```

The frontend will start on `http://localhost:5173` (or another port if 5173 is busy)

## Default Login Credentials

- **Username:** `admin`
- **Password:** `Aa123456`

## Features

- Real-time camera detection with YOLO
- Person and weapon detection
- Motion analysis (standing, walking, running)
- Arduino integration (light and beeper alerts)
- Distance sensor readings
- User management with role-based access
- Detection history with image storage
- Dark/Light theme support

## Arduino Setup

1. Upload `security/security.ino` to your Arduino
2. Connect Arduino to your computer
3. The server will automatically detect and connect to Arduino
4. When alerts are detected, Arduino will activate light and beeper

## Troubleshooting

### Server Connection Refused

If you see `ERR_CONNECTION_REFUSED`:
- Make sure the Python server is running
- Check that port 5000 is not in use by another application
- Verify Python dependencies are installed: `pip install -r python/requirements.txt`

### Arduino Not Connecting

- Check Arduino is connected via USB
- Verify the correct port in Arduino IDE
- The server will continue without Arduino if not found
