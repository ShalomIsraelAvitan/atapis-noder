import { useEffect, useState } from 'react'
import { API_BASE, fetchJson } from '../../design-lab/shared/api'

const POLL_MS = 5000

// GET /api/arduino-status → {connected, port, message}
export function useArduinoSensor({ demo = 'auto' } = {}) {
  const [state, setState] = useState({ connected: null, port: null, message: null })

  useEffect(() => {
    if (demo === 'forced') {
      setState({ connected: true, port: 'DEMO', message: 'Demo sensor link' })
      return undefined
    }
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchJson(`${API_BASE}/api/arduino-status`)
        if (!cancelled) setState({ connected: Boolean(data.connected), port: data.port || null, message: data.message || null })
      } catch {
        if (!cancelled) setState({ connected: null, port: null, message: 'unreachable' })
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [demo])

  return state
}
