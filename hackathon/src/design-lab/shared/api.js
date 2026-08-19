// Design Lab API layer.
// Unlike the legacy pages (hardcoded localhost), the lab resolves the backend
// from the current hostname so it also works over the LAN (M2 stays untouched
// in the legacy code).
export const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000`

export const ENDPOINTS = {
  status: `${API_BASE}/status`,
  radarLive: `${API_BASE}/api/radar/live`,
  camerasStatus: `${API_BASE}/api/cameras/status`,
  arduinoMessages: `${API_BASE}/api/arduino-messages`,
}

export const streamUrl = (source, version = 0) =>
  `${API_BASE}/video_feed/${source}?v=${version}`

const FETCH_TIMEOUT_MS = 2500

export async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}
