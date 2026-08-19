import { useEffect, useRef, useState } from 'react'

// Local, session-only risk timeline sampled from the shared 1s snapshot poll.
// There is NO historical risk endpoint on the backend — this buffer is always
// labeled "Current Session" and legitimately resets on reload (documented).
const MAX_SAMPLES = 600 // ~10 minutes at 1s

export function useRiskTimeline(snapshot, { enabled = true } = {}) {
  const bufferRef = useRef([])
  const [samples, setSamples] = useState([])
  const lastUpdateRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    // one sample per snapshot tick (snapshot object identity changes each poll)
    const now = Date.now()
    if (lastUpdateRef.current && now - lastUpdateRef.current < 500) return
    lastUpdateRef.current = now
    bufferRef.current = [
      ...bufferRef.current,
      {
        t: now,
        fused: snapshot.risks.fused,
        camera: snapshot.risks.camera,
        radar: snapshot.risks.radar,
        mode: snapshot.mode,
      },
    ].slice(-MAX_SAMPLES)
    setSamples(bufferRef.current)
  }, [snapshot, enabled])

  return {
    samples,
    scope: 'session', // consumers must label this "Current Session"
    isEmpty: samples.length < 2,
  }
}
