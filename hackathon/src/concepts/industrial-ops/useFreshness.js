import { useEffect, useState } from 'react'

// Data-freshness for the Industrial OPS screen.
//
// Honesty rules this file exists to enforce:
//  - Age is measured from real transport events only (a successful /status read,
//    a radar payload timestamp). A React render never refreshes anything.
//  - A failed poll ages the data; it does not reset it.
//  - Each source ages independently: the radar does not become fresh because the
//    backend answered.
//  - Demo/mock snapshots are generated locally, so they are never reported as a
//    successful live read.
//  - The backend gives us receive time, not sensor measurement time, so every
//    label says RX / LAST SUCCESS — never "measured at".

const STALE_AFTER_MS = 3000
const TICK_MS = 1000

export const DATA_STATES = {
  LIVE: 'LIVE',
  DEMO: 'DEMO',
  DEMO_OFFLINE: 'DEMO · OFFLINE',
  RECONNECTING: 'RECONNECTING',
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONNECTING',
}

function ageLabel(ms) {
  if (ms === null || ms === undefined) return null
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function clockLabel(epochMs) {
  if (!epochMs) return null
  return new Date(epochMs).toLocaleTimeString('en-GB')
}

/**
 * @param vm dashboard view model (needs backendStatus, isDemo, link, snapshot)
 * @param options.forcedDemo true when ?demo=1 drives the screen
 */
export function useFreshness(vm, { forcedDemo = false } = {}) {
  // Re-render on a timer so displayed ages advance while the data does not.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const link = vm.link || { lastSuccessAt: null, failures: 0, source: 'live' }
  const backendStatus = vm.backendStatus
  const radar = vm.snapshot.radar

  // --- global data state -----------------------------------------------------
  let dataState
  let dataTone
  if (forcedDemo) {
    dataState = DATA_STATES.DEMO
    dataTone = 'demo'
  } else if (vm.isDemo) {
    // auto fallback: the backend is down and the screen is running on a local
    // narrative — say both halves out loud.
    dataState = DATA_STATES.DEMO_OFFLINE
    dataTone = 'danger'
  } else if (backendStatus === 'ok') {
    dataState = DATA_STATES.LIVE
    dataTone = 'live'
  } else if (backendStatus === 'offline') {
    dataState = DATA_STATES.OFFLINE
    dataTone = 'danger'
  } else if (backendStatus === 'reconnecting') {
    dataState = DATA_STATES.RECONNECTING
    dataTone = 'alert'
  } else {
    dataState = DATA_STATES.CONNECTING
    dataTone = 'alert'
  }

  // --- backend freshness (real successful reads only) ------------------------
  const backendAgeMs = link.lastSuccessAt === null ? null : now - link.lastSuccessAt
  const backendStale = backendAgeMs !== null && backendAgeMs > STALE_AFTER_MS

  // --- radar freshness (independent of the backend poll) ---------------------
  // radar.lastUpdateMs is the age of the payload the backend published. While the
  // link is down the backend keeps republishing an empty payload, so that number
  // only means "data" when the radar is actually connected.
  const radarConnected = Boolean(radar.connected)
  const radarAgeMs = radarConnected && typeof radar.lastUpdateMs === 'number' ? radar.lastUpdateMs : null
  const radarStale = radarAgeMs !== null && radarAgeMs > STALE_AFTER_MS
  const radarMock = /MOCK|DEMO/i.test(String(radar.status || '')) || radar.provider === 'demo'

  let radarState
  if (!radar.enabled) radarState = 'DISABLED'
  else if (radarMock) radarState = 'MOCK'
  else if (!radarConnected) radarState = String(radar.status || 'DISCONNECTED').toUpperCase()
  else if (radarStale) radarState = 'STALE'
  else radarState = 'OK'

  // --- camera freshness ------------------------------------------------------
  const cams = vm.snapshot.cameras
  const cameraConnected = Boolean(cams.webcam.connected || cams.dahua.connected)
  const cameraLastFrame = cams.dahua.connected
    ? cams.dahua.lastFrameTime || cams.dahua.lastUpdate
    : cams.webcam.lastFrameTime || cams.webcam.lastUpdate

  // --- operational coverage --------------------------------------------------
  // A responding backend is a DATA LINK fact, not proof that the perimeter is
  // being watched. Coverage is judged from the sensors themselves, so the screen
  // can never claim "all systems nominal" while the radar is disconnected.
  const controllerConnected = vm.sensor?.connected === true
  const controllerKnown = vm.sensor?.connected !== undefined && vm.sensor?.connected !== null

  const faults = []
  if (!cameraConnected) faults.push({ key: 'camera', label: 'CAMERA DOWN', he: 'מצלמה מנותקת', critical: true })
  if (!radar.enabled) faults.push({ key: 'radar', label: 'RADAR DISABLED', he: 'רדאר מושבת', critical: true })
  else if (!radarConnected) faults.push({ key: 'radar', label: `RADAR ${radarState}`, he: `רדאר ${radarState}`, critical: true })
  else if (radarStale) faults.push({ key: 'radar', label: 'RADAR STALE', he: 'רדאר לא עדכני', critical: false })
  if (controllerKnown && !controllerConnected) {
    faults.push({ key: 'controller', label: 'CONTROLLER NOT FOUND', he: 'בקר לא נמצא', critical: false })
  }

  const sensorsDown = faults.filter((f) => f.critical && (f.key === 'camera' || f.key === 'radar')).length
  const backendDown = backendStatus === 'offline'

  // systemState is the full phrase for the bar; systemStateShort fits a strip cell.
  let systemState
  let systemStateShort
  let systemTone
  if (backendDown) {
    systemState = 'BACKEND OFFLINE'
    systemStateShort = 'OFFLINE'
    systemTone = 'danger'
  } else if (sensorsDown >= 2) {
    systemState = 'NO SENSOR COVERAGE'
    systemStateShort = 'NO COVERAGE'
    systemTone = 'danger'
  } else if (faults.length) {
    systemState = 'COVERAGE DEGRADED'
    systemStateShort = 'DEGRADED'
    systemTone = 'alert'
  } else {
    systemState = 'ALL SYSTEMS NOMINAL'
    systemStateShort = 'NOMINAL'
    systemTone = 'safe'
  }

  // Data link state, worded so it cannot be read as "everything is fine".
  const linkState =
    backendStatus === 'ok' ? 'LINK LIVE' : backendStatus === 'offline' ? 'LINK OFFLINE' : `LINK ${String(backendStatus).toUpperCase()}`

  return {
    now,
    dataState,
    dataTone,
    isDemo: Boolean(vm.isDemo),

    // Received by the backend, not measured by a sensor — labels must say so.
    lastSuccessAt: link.lastSuccessAt,
    lastSuccessLabel: clockLabel(link.lastSuccessAt),
    backendAgeMs,
    backendAgeLabel: ageLabel(backendAgeMs),
    backendStale,
    failures: link.failures || 0,

    radarState,
    radarAgeMs,
    radarAgeLabel: ageLabel(radarAgeMs),
    radarStale,
    radarMock,
    radarConnected,

    cameraConnected,
    cameraLastFrame: cameraLastFrame || null,

    // System state (subsystem health) — deliberately separate from the threat
    // state (SAFE/ALERT/DANGER) and from the data state (LIVE/DEMO/MOCK).
    systemState,
    systemStateShort,
    systemTone,
    linkState,
    faults,
    controllerConnected,
  }
}
