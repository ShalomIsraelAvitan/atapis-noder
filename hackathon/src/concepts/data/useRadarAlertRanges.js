import { useEffect, useState } from 'react'
import { API_BASE, fetchJson } from '../../design-lab/shared/api'

// Reads the configured alert distances once (GET /api/radar-config, the same
// endpoint the settings page uses) so a plot can draw the fence threshold at its
// real value instead of a hardcoded guess.
//
// Only fence_distance_alert_mm is exposed: the backend compares it directly
// against a target's distance_mm from the sensor, so it is a true radius. The
// gate threshold is deliberately not returned — it is combined with an angle
// test, and the gate itself has no position in radar space.
export function useRadarAlertRanges() {
  const [ranges, setRanges] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchJson(`${API_BASE}/api/radar-config`)
      .then((data) => {
        const fenceMm = Number(data?.config?.fence_distance_alert_mm)
        if (!cancelled && Number.isFinite(fenceMm)) setRanges({ fenceMm })
      })
      .catch(() => {
        // Absent config simply means no threshold ring is drawn.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return ranges
}
