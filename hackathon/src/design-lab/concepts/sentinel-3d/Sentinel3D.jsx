import { Component, Suspense, lazy, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DesignLabLayout from '../../DesignLabLayout'
import { useAtapisData, demoOptionsFromLocation } from '../../shared/useAtapisData'
import { useLab } from '../../shared/useLab'
import { CameraFeed } from '../../shared/CameraFeed'
import { AnimatedNumber, ModeBadge, StatusDot } from '../../shared/status-primitives'
import { riskTone, radarMapPosition, formatDistance, formatSpeed, backendDotState } from '../../shared/adapter'
import './sentinel-3d.css'

// three.js chunk loads only when this concept is opened AND WebGL is available.
const SentinelScene = lazy(() => import('./Scene'))

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// 2D top-view fallback when WebGL is unavailable or the scene crashes.
function Fallback2D({ radar }) {
  return (
    <div className="s3-fallback" dir="ltr">
      <p className="s3-fallback-note">3D unavailable on this device — showing 2D operational view.</p>
      <svg viewBox="0 0 300 220" className="s3-fallback-svg" role="img" aria-label="2D radar view">
        <rect width="300" height="220" fill="#06080c" />
        {[60, 110, 160].map((r) => (
          <path key={r} d={`M ${150 - r} 205 A ${r} ${r} 0 0 1 ${150 + r} 205`} fill="none" stroke="#1d3050" />
        ))}
        <line x1="40" y1="205" x2="260" y2="205" stroke="#3d5a86" />
        <rect x="138" y="198" width="24" height="7" fill="#5a6b8c" />
        {radar.targets.map((target) => {
          const { xRatio, yRatio } = radarMapPosition(target)
          const x = 150 + xRatio * 130
          const y = 205 - yRatio * 180
          const tone = riskTone(target.risk)
          const color = tone === 'danger' ? '#f0402e' : tone === 'alert' ? '#f5a623' : '#34c76f'
          return (
            <g key={target.id}>
              <circle cx={x} cy={y} r="5" fill={color} />
              <text x={x + 9} y={y + 4} fill="#8fa3c8" fontSize="10" fontFamily="monospace">T{target.id}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Inner({ snapshot, backendStatus, isDemo, alerts }) {
  const { t } = useLab()
  const [selectedId, setSelectedId] = useState(null)
  const [cameraMode, setCameraMode] = useState('overview')
  const [source, setSource] = useState('webcam')
  const [feedOpen, setFeedOpen] = useState(true)
  const hasWebgl = useMemo(() => webglAvailable(), [])
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  const camera = snapshot.cameras[source]
  const selected =
    snapshot.radar.targets.find((target) => target.id === selectedId) || null

  const selectTarget = (id) => {
    setSelectedId(id)
    if (id !== null) setCameraMode('focus')
  }

  return (
    <div className="s3-page">
      <div className="s3-stage">
        {hasWebgl ? (
          <SceneErrorBoundary fallback={<Fallback2D radar={snapshot.radar} />}>
            <Suspense fallback={<div className="s3-loading" dir="ltr">Loading 3D scene…</div>}>
              <SentinelScene
                radar={snapshot.radar}
                selectedId={selectedId}
                onSelect={selectTarget}
                cameraMode={cameraMode}
                animate={!reducedMotion}
              />
            </Suspense>
          </SceneErrorBoundary>
        ) : (
          <Fallback2D radar={snapshot.radar} />
        )}

        <p className="s3-disclaimer" dir="ltr">
          OPERATIONAL VISUALIZATION — NOT GEO-ACCURATE
        </p>

        {/* HUD: top-left — system state */}
        <section className="s3-hud s3-hud-state" aria-label={t('System state', 'מצב מערכת')}>
          <div className="s3-hud-row">
            <ModeBadge mode={snapshot.mode} />
            <span className="s3-risk" dir="ltr">
              <AnimatedNumber value={snapshot.risks.fused} className={`s3-risk-num s3-tone-${riskTone(snapshot.risks.fused)}`} />
              <span className="s3-risk-label">FUSED</span>
            </span>
          </div>
          <div className="s3-hud-grid" dir="ltr">
            <span>CAM {snapshot.risks.camera}</span>
            <span>RDR {snapshot.risks.radar}</span>
            <span>PERSONS {snapshot.personCount}</span>
            <span className={snapshot.hasWeapon ? 's3-tone-danger' : ''}>
              WEAPON {camera.weaponDetectionAvailable === false ? 'N/A' : snapshot.hasWeapon ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="s3-hud-links" dir="ltr">
            <StatusDot state={backendDotState(backendStatus)} label="Backend" />
            <StatusDot state={camera.connected ? 'ok' : 'err'} label="Camera" />
            <StatusDot
              state={snapshot.radar.connected ? 'ok' : 'err'}
              label={`Radar ${snapshot.radar.provider ? `(${snapshot.radar.provider})` : ''}`}
            />
          </div>
        </section>

        {/* HUD: top-right — live camera window */}
        <section className={`s3-hud s3-hud-camera ${feedOpen ? '' : 'is-collapsed'}`}
          aria-label={t('Live camera', 'מצלמה חיה')}>
          <div className="s3-hud-camera-bar" dir="ltr">
            <div className="s3-source-tabs">
              {['webcam', 'dahua'].map((name) => (
                <button
                  key={name}
                  type="button"
                  className={source === name ? 'is-active' : ''}
                  onClick={() => setSource(name)}
                >
                  {name === 'webcam' ? 'LOCAL' : 'DAHUA'}
                </button>
              ))}
            </div>
            <button type="button" className="s3-collapse" onClick={() => setFeedOpen((open) => !open)}
              aria-expanded={feedOpen}>
              {feedOpen ? '—' : '+'}
            </button>
          </div>
          {feedOpen ? (
            <CameraFeed source={source} active cameraStatus={camera} isDemo={isDemo} />
          ) : null}
        </section>

        {/* HUD: bottom-left — targets + view mode */}
        <section className="s3-hud s3-hud-targets" aria-label={t('Radar targets', 'מטרות רדאר')}>
          <div className="s3-hud-row">
            <span className="s3-hud-title" dir="ltr">
              TARGETS {snapshot.radar.targetsCount}
            </span>
            <div className="s3-view-toggle" dir="ltr">
              <button
                type="button"
                className={cameraMode === 'overview' ? 'is-active' : ''}
                onClick={() => setCameraMode('overview')}
              >
                {t('Overview', 'מבט־על')}
              </button>
              <button
                type="button"
                className={cameraMode === 'focus' ? 'is-active' : ''}
                onClick={() => setCameraMode('focus')}
                disabled={!snapshot.radar.targets.length}
              >
                {t('Focus', 'מיקוד')}
              </button>
            </div>
          </div>
          {snapshot.radar.targets.length ? (
            <ul className="s3-target-list" dir="ltr">
              {snapshot.radar.targets.map((target) => (
                <li key={target.id}>
                  <button
                    type="button"
                    className={selectedId === target.id ? 'is-active' : ''}
                    onClick={() => selectTarget(target.id)}
                  >
                    <span className={`s3-target-chip s3-tone-${riskTone(target.risk)}`}>T{target.id}</span>
                    <span>{formatDistance(target.distanceMm)}</span>
                    <span>{formatSpeed(target.speedCmS)}</span>
                    <span>{Math.round(target.angleDeg)}°</span>
                    <span className="s3-target-dir">{target.direction}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="s3-empty" dir="ltr">
              {snapshot.radar.connected ? 'NO ACTIVE TARGETS' : `RADAR ${snapshot.radar.status}`}
            </p>
          )}
          {selected ? (
            <p className="s3-selected" dir="ltr">
              T{selected.id}: {selected.approachingGate ? 'APPROACHING GATE · ' : ''}
              risk {selected.risk} · conf {(selected.confidence * 100).toFixed(0)}%
            </p>
          ) : null}
        </section>

        {/* HUD: bottom-right — alerts */}
        <section className="s3-hud s3-hud-alerts" aria-label={t('Recent alerts', 'התראות אחרונות')}>
          <span className="s3-hud-title" dir="ltr">{t('ALERTS', 'התראות')}</span>
          {alerts.length ? (
            <ul dir="ltr">
              {alerts.slice(0, 3).map((alert) => (
                <li key={alert.id} className={`s3-alert--${alert.severity}`}>
                  <span className="s3-alert-time">{alert.time}</span>
                  {alert.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="s3-empty" dir="ltr">{t('None', 'אין')}</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default function Sentinel3D() {
  const location = useLocation()
  const data = useAtapisData(demoOptionsFromLocation(location.search))
  return (
    <DesignLabLayout isDemo={data.isDemo}>
      <Inner {...data} />
    </DesignLabLayout>
  )
}
