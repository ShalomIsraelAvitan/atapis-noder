# ATAPIS

Autonomous Threat Assessment & Perimeter Intelligence System. The repository
contains a React/Vite operator console and a Flask/YOLO backend with camera,
LD2450 radar, risk, and sensor-fusion integrations.

## First runnable slice: offline operator demo

The fastest supported path exercises the Industrial Ops workflow with the
built-in, clearly labelled synthetic scenario. It does not require Python,
models, credentials, a camera, a radar, or an Arduino.

Prerequisites: Node.js 20+ and npm.

```bash
cd hackathon
npm ci
npm run demo
```

Vite opens:

```text
http://localhost:5173/concepts/industrial/dashboard?demo=1
```

Demo access is enabled only by Vite's `demo` mode and only when the explicit
`demo=1` query parameter is present. Normal live routes still use backend
authentication. Production-like verification is available with:

```bash
npm run build:demo
npm run preview -- --open /concepts/industrial/dashboard?demo=1
```

## What is already present

- React 19/Vite console with the approved Industrial Ops command-center flow.
- Synthetic multi-area alerts and SAFE/ALERT/DANGER transitions.
- Flask APIs, MJPEG camera streams, YOLO person/weapon analysis and tracking.
- LD2450 reader plus radar simulator, Arduino signaling and scenario uploads.
- Verification suites for the implemented OPS phases.

## What still needs live wiring

- A machine-specific `.env` created from `hackathon/.env.example`.
- Python 3.10+ dependencies and locally available model weights/cache.
- Camera/RTSP, LD2450 and optional Arduino device validation.
- Removal of hard-coded legacy API origins and a production authentication
  design before any real deployment.
- A live end-to-end smoke test covering backend health, camera/radar status and
  the selected operator workflow.

Detailed Windows development and production commands are in
[`hackathon/README_RUN.md`](hackathon/README_RUN.md).
