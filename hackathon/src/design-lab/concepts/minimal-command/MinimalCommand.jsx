import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import DesignLabLayout from '../../DesignLabLayout'
import { useAtapisData, demoOptionsFromLocation } from '../../shared/useAtapisData'
import { useLab } from '../../shared/useLab'
import { CameraFeed } from '../../shared/CameraFeed'
import { AnimatedNumber, StatusDot } from '../../shared/status-primitives'
import { modeTone, riskTone, radarMapPosition, formatDistance, formatSpeed, backendDotState } from '../../shared/adapter'
import './minimal-command.css'

// Radar rendered as a quiet quarter-arc field — dots only, no chrome.
function MinimalRadar({ radar }) {
  return (
    <svg viewBox="0 0 200 150" className="mc-radar-svg" role="img" aria-label="Radar map" dir="ltr">
      {[45, 85, 125].map((r) => (
        <path
          key={r}
          d={`M ${100 - r} 140 A ${r} ${r} 0 0 1 ${100 + r} 140`}
          fill="none"
          className="mc-radar-arc"
        />
      ))}
      <line x1="100" y1="140" x2="100" y2="10" className="mc-radar-axis" />
      <circle cx="100" cy="140" r="3" className="mc-radar-origin" />
      {radar.targets.map((target) => {
        const { xRatio, yRatio } = radarMapPosition(target)
        const x = 100 + xRatio * 88
        const y = 140 - yRatio * 125
        return (
          <g key={target.id}>
            <circle cx={x} cy={y} r="4.5" className={`mc-radar-dot mc-tone-${riskTone(target.risk)}`} />
            <text x={x + 8} y={y + 3} className="mc-radar-label">{target.id}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Metric({ label, children, tone }) {
  return (
    <div className={`mc-metric ${tone ? `mc-metric--${tone}` : ''}`}>
      <span className="mc-metric-label">{label}</span>
      <span className="mc-metric-value">{children}</span>
    </div>
  )
}

function Inner({ snapshot, backendStatus, isDemo, alerts }) {
  const { t } = useLab()
  const [source, setSource] = useState('webcam')
  const camera = snapshot.cameras[source]
  const tone = modeTone(snapshot.mode)
  const primaryTrack = snapshot.tracks.length
    ? snapshot.tracks.reduce((a, b) => (b.risk > a.risk ? b : a))
    : null
  const latestAlert = alerts[0] || null

  const behaviorLabel = primaryTrack
    ? primaryTrack.state
    : snapshot.motion || t('No activity', 'אין פעילות')

  return (
    <div className={`mc-page mc-mode-${tone}`}>
      <header className="mc-header">
        <div className="mc-header-left">
          <p className="mc-eyebrow" dir="ltr">ATAPIS · PERIMETER</p>
          <h1 className="mc-mode-word" dir="ltr" aria-live="polite">{snapshot.mode}</h1>
        </div>
        <div className="mc-header-status" dir="ltr">
          <StatusDot state={backendDotState(backendStatus)} label={t('Backend', 'שרת')} />
          <StatusDot state={camera.connected ? 'ok' : 'err'} label={t('Camera', 'מצלמה')} />
          <StatusDot state={snapshot.radar.connected ? 'ok' : 'err'}
            label={`${t('Radar', 'רדאר')}${snapshot.radar.provider ? ` · ${snapshot.radar.provider}` : ''}`} />
          <StatusDot state={snapshot.distanceCm !== null ? 'ok' : 'off'} label={t('Sensor', 'חיישן')} />
        </div>
      </header>

      <div className="mc-main">
        <section className="mc-camera" aria-label={t('Live camera', 'מצלמה חיה')}>
          <div className="mc-camera-top" dir="ltr">
            <div className="mc-source-tabs" role="tablist" aria-label="Camera source">
              {['webcam', 'dahua'].map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={source === name}
                  className={`mc-source-tab ${source === name ? 'is-active' : ''}`}
                  onClick={() => setSource(name)}
                >
                  {name === 'webcam' ? 'Local' : 'Dahua'}
                </button>
              ))}
            </div>
            <span className="mc-camera-note">
              {camera.personCount > 0
                ? `${camera.personCount} person${camera.personCount > 1 ? 's' : ''} in frame`
                : t('No person in frame', 'אין אדם בפריים')}
              {camera.weaponDetectionAvailable === false ? ' · weapon model unavailable' : ''}
            </span>
          </div>
          <CameraFeed source={source} active cameraStatus={camera} isDemo={isDemo} />
        </section>

        <aside className="mc-side">
          <div className="mc-risk-block">
            <span className="mc-metric-label">{t('Fused risk', 'סיכון ממוזג')}</span>
            <AnimatedNumber value={snapshot.risks.fused} className={`mc-risk-number mc-tone-${riskTone(snapshot.risks.fused)}`} />
            <div className="mc-risk-sub" dir="ltr">
              <span>CAM <AnimatedNumber value={snapshot.risks.camera} /></span>
              <span>RDR <AnimatedNumber value={snapshot.risks.radar} /></span>
            </div>
          </div>

          <div className="mc-radar-block">
            <div className="mc-block-head">
              <span className="mc-metric-label">{t('Radar', 'רדאר')}</span>
              <span className="mc-radar-status" dir="ltr">
                {snapshot.radar.status}
                {snapshot.radar.targetsCount ? ` · ${snapshot.radar.targetsCount} ${t('targets', 'מטרות')}` : ''}
              </span>
            </div>
            {snapshot.radar.connected || snapshot.radar.targets.length ? (
              <MinimalRadar radar={snapshot.radar} />
            ) : (
              <div className="mc-radar-empty" dir="ltr">
                <p>RADAR OFFLINE</p>
                {snapshot.radar.lastError ? <span>{snapshot.radar.lastError}</span> : null}
              </div>
            )}
            {snapshot.radar.targets.slice(0, 3).map((target) => (
              <div key={target.id} className="mc-target-row" dir="ltr">
                <span className="mc-target-id">#{target.id}</span>
                <span>{formatDistance(target.distanceMm)}</span>
                <span>{formatSpeed(target.speedCmS)}</span>
                <span className={`mc-target-dir mc-target-dir--${target.direction}`}>{target.direction}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="mc-footer">
        <div className="mc-metrics">
          <Metric label={t('Behavior', 'התנהגות')} tone={primaryTrack?.hasWeapon ? 'danger' : undefined}>
            <span dir="ltr">{behaviorLabel}</span>
          </Metric>
          <Metric label={t('Persons', 'אנשים')}>
            <AnimatedNumber value={snapshot.personCount} />
          </Metric>
          <Metric
            label={t('Weapon', 'נשק')}
            tone={snapshot.hasWeapon ? 'danger' : undefined}
          >
            <span dir="ltr">
              {snapshot.cameras[source].weaponDetectionAvailable === false
                ? t('Unavailable', 'לא זמין')
                : snapshot.hasWeapon
                  ? snapshot.weaponType || t('Detected', 'זוהה')
                  : t('None', 'אין')}
            </span>
          </Metric>
          <Metric label={t('Track speed', 'מהירות מעקב')}>
            <span dir="ltr">{primaryTrack ? `${Math.round(primaryTrack.speed)} px/s` : '—'}</span>
          </Metric>
          <Metric label={t('Zone', 'אזור')}>
            <span dir="ltr">{primaryTrack?.zone || '—'}</span>
          </Metric>
        </div>
        <div className="mc-alert-line" aria-live="polite" dir="ltr">
          {latestAlert ? (
            <span key={latestAlert.id} className={`mc-alert mc-alert--${latestAlert.severity}`}>
              <span className="mc-alert-time">{latestAlert.time}</span>
              {latestAlert.message}
            </span>
          ) : (
            <span className="mc-alert mc-alert--quiet">{t('No recent alerts', 'אין התראות אחרונות')}</span>
          )}
        </div>
      </footer>
    </div>
  )
}

export default function MinimalCommand() {
  const location = useLocation()
  const data = useAtapisData(demoOptionsFromLocation(location.search))
  return (
    <DesignLabLayout isDemo={data.isDemo}>
      <Inner {...data} />
    </DesignLabLayout>
  )
}
