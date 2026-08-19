import { useEffect, useMemo, useRef, useState } from 'react'
import { ENDPOINTS, fetchJson } from './api'
import { adaptSnapshot, EMPTY_SNAPSHOT } from './adapter'
import { demoRawSnapshot } from './demoData'

const POLL_INTERVAL_MS = 1000
const OFFLINE_AFTER_FAILURES = 5
const MAX_ALERTS = 50

// Backend link state: 'connecting' (first load) → 'ok' | 'reconnecting' | 'offline'
function linkStateFor(failures, hasEverSucceeded) {
  if (failures === 0) return 'ok'
  if (failures < OFFLINE_AFTER_FAILURES) return hasEverSucceeded ? 'reconnecting' : 'connecting'
  return 'offline'
}

function nowLabel() {
  return new Date().toLocaleTimeString('en-GB')
}

// Transport-level truth about the backend link, independent of React renders.
// source: which pipeline produced the snapshot currently on screen.
const INITIAL_LINK = {
  lastSuccessAt: null,
  lastFailureAt: null,
  failures: 0,
  source: 'live',
}

/**
 * Single shared data source for every Design Lab concept.
 * Polls /status, /api/radar/live, /api/cameras/status and /api/arduino-messages
 * once per second in one cycle, adapts them into a normalized snapshot and
 * derives an alert feed from state transitions.
 *
 * options.demo:  'off' | 'auto' | 'forced'  (auto = demo only while backend offline)
 * options.demoPhase: freeze the demo timeline on one phase (for screenshots)
 */
export function useAtapisData({ demo = 'auto', demoPhase = null } = {}) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [backendStatus, setBackendStatus] = useState('connecting')
  const [isDemo, setIsDemo] = useState(demo === 'forced')
  const [alerts, setAlerts] = useState([])
  // Real transport markers. `lastSuccessAt` moves only when /status actually
  // answered — never on a render, a failed poll, or a synthetic demo tick — so
  // consumers can show a data age that cannot lie.
  const [link, setLink] = useState(INITIAL_LINK)

  const failuresRef = useRef(0)
  const everSucceededRef = useRef(false)
  const prevRef = useRef({ mode: 'SAFE', hasWeapon: false, radarConnected: null, personCount: 0 })
  const seenArduinoRef = useRef(new Set())
  const demoStartRef = useRef(null)
  const alertsRef = useRef([])

  useEffect(() => {
    let cancelled = false
    let timer = null

    // `source` and `kind` are additive: consumers that read only
    // id/time/severity/message are unaffected.
    const pushAlert = (severity, message, source = 'system', kind = 'system') => {
      alertsRef.current = [
        { id: `${Date.now()}-${alertsRef.current.length}`, time: nowLabel(), severity, message, source, kind },
        ...alertsRef.current,
      ].slice(0, MAX_ALERTS)
    }

    const deriveAlerts = (next) => {
      const prev = prevRef.current
      if (next.mode !== prev.mode) {
        const severity = next.mode === 'DANGER' ? 'danger' : next.mode === 'ALERT' ? 'alert' : 'info'
        pushAlert(severity, `System mode ${prev.mode} -> ${next.mode}`, 'system', 'mode')
      }
      if (next.hasWeapon && !prev.hasWeapon) {
        pushAlert('danger', `Weapon detected${next.weaponType ? `: ${next.weaponType}` : ''}`, 'camera', 'weapon')
      }
      if (prev.radarConnected !== null && next.radar.connected !== prev.radarConnected) {
        pushAlert(next.radar.connected ? 'info' : 'alert',
          next.radar.connected ? 'Radar link restored' : 'Radar link lost', 'radar', 'connection')
      }
      if (next.personCount > prev.personCount) {
        pushAlert('info', `Person detected (count: ${next.personCount})`, 'camera', 'person')
      }
      prevRef.current = {
        mode: next.mode,
        hasWeapon: next.hasWeapon,
        radarConnected: next.radar.connected,
        personCount: next.personCount,
      }
    }

    const applyDemoTick = () => {
      if (demoStartRef.current === null) demoStartRef.current = Date.now()
      const elapsed = (Date.now() - demoStartRef.current) / 1000
      const raw = demoRawSnapshot(elapsed, demoPhase)
      const next = adaptSnapshot(raw)
      deriveAlerts(next)
      if (!cancelled) {
        setSnapshot(next)
        setAlerts(alertsRef.current)
        setIsDemo(true)
        // A demo tick is generated locally: it is never a successful backend
        // read, so lastSuccessAt must not move here.
        setLink((prev) => (prev.source === 'demo' ? prev : { ...prev, source: 'demo' }))
        // Forced demo is a self-contained preview narrative — the backend link
        // indicator is part of the scenario, not a real connectivity claim.
        if (demo === 'forced') setBackendStatus('ok')
      }
    }

    const poll = async () => {
      if (demo === 'forced') {
        applyDemoTick()
        return
      }

      const [statusRes, radarRes, camerasRes, arduinoRes] = await Promise.allSettled([
        fetchJson(ENDPOINTS.status),
        fetchJson(ENDPOINTS.radarLive),
        fetchJson(ENDPOINTS.camerasStatus),
        fetchJson(ENDPOINTS.arduinoMessages),
      ])

      if (cancelled) return

      const statusOk = statusRes.status === 'fulfilled'
      if (statusOk) {
        failuresRef.current = 0
        everSucceededRef.current = true
        const next = adaptSnapshot({
          status: statusRes.value,
          radar: radarRes.status === 'fulfilled' ? radarRes.value : null,
          cameras: camerasRes.status === 'fulfilled' ? camerasRes.value : null,
        })
        if (arduinoRes.status === 'fulfilled' && Array.isArray(arduinoRes.value?.messages)) {
          for (const msg of arduinoRes.value.messages) {
            const key = `${msg.time}-${msg.message}`
            if (seenArduinoRef.current.has(key)) continue
            seenArduinoRef.current.add(key)
            if (seenArduinoRef.current.size > 400) {
              seenArduinoRef.current = new Set([...seenArduinoRef.current].slice(-200))
            }
            if (typeof msg.message === 'string' && msg.message.includes('ALERT')) {
              alertsRef.current = [
                {
                  id: `ard-${key}`,
                  time: msg.time,
                  severity: 'alert',
                  message: `Arduino: ${msg.message}`,
                  source: 'controller',
                  kind: 'controller',
                },
                ...alertsRef.current,
              ].slice(0, MAX_ALERTS)
            }
          }
        }
        deriveAlerts(next)
        setSnapshot(next)
        setAlerts(alertsRef.current)
        setIsDemo(false)
        setBackendStatus('ok')
        setLink({ lastSuccessAt: Date.now(), lastFailureAt: null, failures: 0, source: 'live' })
      } else {
        failuresRef.current += 1
        const linkState = linkStateFor(failuresRef.current, everSucceededRef.current)
        setBackendStatus(linkState)
        // A failed poll ages the data — it never refreshes it.
        setLink((prev) => ({ ...prev, lastFailureAt: Date.now(), failures: failuresRef.current }))
        if (linkState === 'offline' && demo === 'auto') {
          applyDemoTick()
        }
      }
    }

    poll()
    timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [demo, demoPhase])

  return useMemo(
    () => ({ snapshot, backendStatus, isDemo, alerts, link }),
    [snapshot, backendStatus, isDemo, alerts, link]
  )
}

// Reads demo configuration from the URL (?demo=1&phase=approach).
export function demoOptionsFromLocation(search) {
  const params = new URLSearchParams(search)
  const demoParam = params.get('demo')
  return {
    demo: demoParam === '1' || demoParam === 'true' ? 'forced' : 'auto',
    demoPhase: params.get('phase'),
  }
}
