import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, fetchJson } from '../../design-lab/shared/api'
import { demoDetections } from './demoExtras'

const POLL_MS = 10000

export function detectionImageUrl(filename) {
  return filename ? `${API_BASE}/api/images/${encodeURIComponent(filename)}` : null
}

// Normalized event object from a raw /api/detections item.
export function adaptDetection(raw, index) {
  const ts = raw.timestamp ? new Date(raw.timestamp) : null
  return {
    id: raw.filename ? `${raw.filename}-${index}` : `event-${raw.timestamp || index}`,
    filename: raw.filename || null,
    imageUrl: detectionImageUrl(raw.filename),
    timestamp: ts,
    timeLabel: ts ? ts.toLocaleTimeString('en-GB') : '—',
    dateLabel: ts ? ts.toLocaleDateString('en-GB') : '—',
    source: raw.source || 'webcam',
    motion: raw.motion || null,
    mode: raw.mode || 'SAFE',
    context: raw.context || null,
    cameraRisk: Number(raw.camera_risk) || 0,
    radarRisk: Number(raw.radar_risk) || 0,
    fusedRisk: Number(raw.fused_risk) || Number(raw.camera_risk) || 0,
    personCount: Number(raw.person_count) || 0,
    hasWeapon: Boolean(raw.has_weapon),
    weaponType: raw.weapon_type || null,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    radar: raw.radar || null,
    raw,
  }
}

/**
 * Persistent event history from GET /api/detections (data/monitoring.json).
 * Real data whenever the backend is reachable; forced-demo mode serves a
 * clearly-labeled synthetic list instead.
 */
export function useDetections({ demo = 'auto' } = {}) {
  const [detections, setDetections] = useState([])
  const [status, setStatus] = useState('loading') // loading | ok | error | demo
  const [error, setError] = useState(null)
  const failuresRef = useRef(0)

  const load = useCallback(async () => {
    if (demo === 'forced') {
      setDetections(demoDetections().map(adaptDetection))
      setStatus('demo')
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/api/detections`)
      const list = Array.isArray(data) ? data : []
      setDetections(list.map(adaptDetection))
      setStatus('ok')
      setError(null)
      failuresRef.current = 0
    } catch (err) {
      failuresRef.current += 1
      if (failuresRef.current >= 2) {
        setStatus('error')
        setError(err.message)
      }
    }
  }, [demo])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const clearHistory = useCallback(async () => {
    if (demo === 'forced') return { success: false, error: 'Demo mode' }
    try {
      const response = await fetch(`${API_BASE}/api/detections`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.success !== false) {
        setDetections([])
        return { success: true }
      }
      return { success: false, error: data.error || `HTTP ${response.status}` }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [demo])

  const stats = useMemo(() => {
    const total = detections.length
    let persons = 0
    let weapons = 0
    let danger = 0
    let alert = 0
    for (const d of detections) {
      persons += d.personCount
      if (d.hasWeapon) weapons += 1
      if (d.mode === 'DANGER') danger += 1
      else if (d.mode === 'ALERT') alert += 1
    }
    return { total, persons, weapons, danger, alert }
  }, [detections])

  return { detections, stats, status, error, reload: load, clearHistory, isDemo: status === 'demo' }
}
