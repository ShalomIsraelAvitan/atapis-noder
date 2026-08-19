import { useEffect, useRef, useState } from 'react'
import { streamUrl } from './api'

/**
 * Single MJPEG camera feed with connection state handling.
 * Only mounts the <img> stream while `active` is true and not in demo mode —
 * every mounted MJPEG stream costs a full YOLO analysis loop on the backend
 * (issue H4), so concepts must render exactly one active feed at a time.
 *
 * Visual styling is left to each concept via the parent container;
 * this component only provides structure + `dl-feed-*` state classes.
 */
export function CameraFeed(props) {
  // Remount on source/active change so connection state resets naturally.
  return <CameraFeedInner key={`${props.source}-${props.active}`} {...props} />
}

function CameraFeedInner({ source, active, cameraStatus, isDemo, labels = {}, enableSnapshotCapture = false }) {
  const [version, setVersion] = useState(0)
  const [imgState, setImgState] = useState('loading') // loading | live | error
  const retryTimerRef = useRef(null)

  const text = {
    connecting: labels.connecting || 'Connecting to camera…',
    unavailable: labels.unavailable || 'CAMERA UNAVAILABLE',
    retry: labels.retry || 'Retry',
    demo: labels.demo || 'DEMO FEED — DESIGN PREVIEW',
    off: labels.off || 'Feed paused',
  }

  useEffect(() => () => clearTimeout(retryTimerRef.current), [])

  const retry = () => {
    setImgState('loading')
    setVersion((v) => v + 1)
  }

  if (!active) {
    return (
      <div className="dl-feed dl-feed--off">
        <p>{text.off}</p>
      </div>
    )
  }

  if (isDemo) {
    // Demo mode: no real stream exists. Draw a clearly-labeled schematic frame
    // (never presented as real footage).
    return (
      <div className="dl-feed dl-feed--demo" dir="ltr">
        <svg viewBox="0 0 640 360" className="dl-feed-demo-svg" role="img" aria-label={text.demo}>
          <rect x="0" y="0" width="640" height="360" fill="currentColor" opacity="0.06" />
          <line x1="0" y1="250" x2="640" y2="250" stroke="currentColor" opacity="0.35" strokeDasharray="8 6" />
          <rect x="300" y="120" width="90" height="180" fill="none" stroke="#34c76f" strokeWidth="2.5" />
          <text x="300" y="112" fill="#34c76f" fontSize="14" fontFamily="monospace">ID:7 person</text>
          <circle cx="345" cy="150" r="14" fill="none" stroke="currentColor" opacity="0.5" />
          <line x1="345" y1="164" x2="345" y2="240" stroke="currentColor" opacity="0.5" strokeWidth="2" />
        </svg>
        <span className="dl-feed-demo-tag">{text.demo}</span>
      </div>
    )
  }

  const disconnected = cameraStatus && cameraStatus.connected === false && imgState !== 'live'

  return (
    <div className="dl-feed" data-state={disconnected ? 'disconnected' : imgState}>
      <img
        src={streamUrl(source, version)}
        alt={`${source} live feed`}
        className="dl-feed-img"
        // Opt-in only: crossOrigin changes how the browser fetches the stream,
        // so it is never applied to feeds that do not need canvas capture.
        crossOrigin={enableSnapshotCapture ? 'anonymous' : undefined}
        onLoad={() => setImgState('live')}
        onError={() => {
          setImgState('error')
          clearTimeout(retryTimerRef.current)
          retryTimerRef.current = setTimeout(retry, 4000)
        }}
      />
      {imgState !== 'live' && (
        <div className="dl-feed-overlay" dir="ltr">
          {disconnected || imgState === 'error' ? (
            <>
              <p className="dl-feed-overlay-title">{text.unavailable}</p>
              {cameraStatus?.lastError ? (
                <p className="dl-feed-overlay-detail">{cameraStatus.lastError}</p>
              ) : null}
              <button type="button" onClick={retry}>{text.retry}</button>
            </>
          ) : (
            <p className="dl-feed-overlay-title dl-feed-overlay-loading">{text.connecting}</p>
          )}
        </div>
      )}
    </div>
  )
}
