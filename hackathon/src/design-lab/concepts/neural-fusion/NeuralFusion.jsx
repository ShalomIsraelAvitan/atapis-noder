import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DesignLabLayout from '../../DesignLabLayout'
import { useAtapisData, demoOptionsFromLocation } from '../../shared/useAtapisData'
import { useLab } from '../../shared/useLab'
import { CameraFeed } from '../../shared/CameraFeed'
import { AnimatedNumber, ModeBadge, StatusDot } from '../../shared/status-primitives'
import { modeTone, riskTone, formatDistance, formatSpeed, backendDotState } from '../../shared/adapter'
import './neural-fusion.css'

// Builds the "Why this risk?" narrative strictly from data the system reports.
function buildReasons(snapshot, t) {
  const reasons = []
  if (snapshot.hasPerson) {
    reasons.push({ key: 'person', severity: 'info', text: t('Person detected', 'זוהה אדם') })
  }
  for (const track of snapshot.tracks) {
    if (track.state === 'running') {
      reasons.push({ key: `run-${track.id}`, severity: 'alert', text: t(`Track #${track.id} running`, `מעקב \u200E#${track.id}\u200E בריצה`) })
    }
    if (track.state === 'approaching' || track.approachingGate) {
      reasons.push({ key: `appr-${track.id}`, severity: 'alert', text: t(`Track #${track.id} approaching gate`, `מעקב \u200E#${track.id}\u200E מתקרב לשער`) })
    }
    if (track.state === 'loitering' || track.state === 'gate_loitering') {
      reasons.push({
        key: `loiter-${track.id}`,
        severity: 'alert',
        text: t(
          `Track #${track.id} loitering${track.zone ? ` (${track.zone})` : ''}`,
          `מעקב \u200E#${track.id}\u200E משתהה${track.zone ? ` (${track.zone})` : ''}`
        ),
      })
    }
    if (track.hasWeapon || track.state === 'armed') {
      reasons.push({ key: `armed-${track.id}`, severity: 'danger', text: t(`Track #${track.id} armed — weapon detected`, `מעקב \u200E#${track.id}\u200E חמוש — זוהה נשק`) })
    }
  }
  for (const target of snapshot.radar.targets) {
    if (target.direction === 'approaching') {
      reasons.push({
        key: `radar-${target.id}`,
        severity: target.approachingGate ? 'alert' : 'info',
        text: t(
          `Radar T${target.id} closing at ${formatSpeed(target.speedCmS)} (${formatDistance(target.distanceMm)})`,
          `רדאר T${target.id} מתקרב ב־${formatSpeed(target.speedCmS)} (${formatDistance(target.distanceMm)})`
        ),
      })
    }
  }
  return reasons
}

// Radar targets on the ring: bearing = angle_deg (0° straight ahead → 12 o'clock),
// radial position = distance (closer target sits closer to the core).
function ringPlacement(target, index) {
  const angleRad = ((target.angleDeg * 2.2) - 90) * (Math.PI / 180)
  const distRatio = Math.min(Math.max(target.distanceMm / 8000, 0), 1)
  const radius = 34 + distRatio * 14 + (index % 2) * 1.5 // % of stage
  return {
    left: `${50 + Math.cos(angleRad) * radius}%`,
    top: `${50 + Math.sin(angleRad) * radius}%`,
  }
}

function FlowLine({ path, active, tone = 'base' }) {
  return (
    <g className={`nf-flow ${active ? 'is-active' : ''} nf-flow--${tone}`}>
      <path d={path} className="nf-flow-rail" />
      <path d={path} className="nf-flow-dash" />
    </g>
  )
}

function Inner({ snapshot, backendStatus, isDemo, alerts }) {
  const { t } = useLab()
  const [source, setSource] = useState('webcam')
  const [focusId, setFocusId] = useState(null)
  const camera = snapshot.cameras[source]
  const tone = modeTone(snapshot.mode)
  const reasons = useMemo(() => buildReasons(snapshot, t), [snapshot, t])
  const focusTarget = snapshot.radar.targets.find((target) => target.id === focusId) || null

  const camActive = camera.connected || snapshot.hasPerson
  const radarActive = snapshot.radar.connected && snapshot.radar.targets.length > 0

  return (
    <div className={`nf-page nf-mode-${tone}`}>
      <header className="nf-header">
        <div>
          <p className="nf-eyebrow" dir="ltr">ATAPIS · SENSOR FUSION</p>
          <h1>{t('One decision from many signals', 'החלטה אחת מאותות רבים')}</h1>
        </div>
        <div className="nf-header-status" dir="ltr">
          <StatusDot state={backendDotState(backendStatus)} label="Backend" />
          <ModeBadge mode={snapshot.mode} />
        </div>
      </header>

      <div className="nf-body">
        {/* Fusion stage */}
        <div className="nf-stage">
          <svg className="nf-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <FlowLine path="M 8 30 C 24 30 30 44 42 48" active={camActive} />
            <FlowLine path="M 8 70 C 24 70 30 56 42 52" active={radarActive} />
            <FlowLine path="M 58 50 C 70 50 76 50 92 50" active={camActive || radarActive} tone={tone} />
          </svg>

          {/* input nodes */}
          <div className="nf-node nf-node-camera" data-active={camActive}>
            <span className="nf-node-title" dir="ltr">VISION</span>
            <span className="nf-node-value" dir="ltr">
              {camera.connected ? `${snapshot.personCount} person` : String(camera.status).toUpperCase()}
            </span>
            <span className="nf-node-sub" dir="ltr">risk {snapshot.risks.camera}</span>
          </div>
          <div className="nf-node nf-node-radar" data-active={radarActive}>
            <span className="nf-node-title" dir="ltr">RADAR</span>
            <span className="nf-node-value" dir="ltr">
              {snapshot.radar.connected ? `${snapshot.radar.targetsCount} targets` : snapshot.radar.status}
            </span>
            <span className="nf-node-sub" dir="ltr">
              risk {snapshot.risks.radar}{snapshot.radar.provider ? ` · ${snapshot.radar.provider}` : ''}
            </span>
          </div>

          {/* core: camera feed wrapped in the radar ring */}
          <div className="nf-core">
            <div className="nf-ring" aria-hidden="true" />
            <div className="nf-ring nf-ring-outer" aria-hidden="true" />
            {snapshot.radar.targets.map((target, index) => (
              <button
                key={target.id}
                type="button"
                className={`nf-ring-target nf-ring-target--${riskTone(target.risk)} ${focusId === target.id ? 'is-focus' : ''}`}
                style={ringPlacement(target, index)}
                onClick={() => setFocusId(focusId === target.id ? null : target.id)}
                aria-label={`Radar target ${target.id}`}
                dir="ltr"
              >
                T{target.id}
              </button>
            ))}
            <div className="nf-core-feed">
              <div className="nf-core-bar" dir="ltr">
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
              <CameraFeed source={source} active cameraStatus={camera} isDemo={isDemo} />
            </div>
          </div>

          {/* decision node */}
          <div className={`nf-node nf-node-decision nf-node-decision--${tone}`} data-active>
            <span className="nf-node-title" dir="ltr">FUSED RISK</span>
            <AnimatedNumber value={snapshot.risks.fused} className="nf-decision-number" />
            <span className="nf-node-sub" dir="ltr">{snapshot.mode}</span>
          </div>
        </div>

        {/* Right rail: narrative + focus */}
        <aside className="nf-rail">
          <section className="nf-card" aria-labelledby="nf-why">
            <h2 id="nf-why">{t('Why this risk?', 'למה הסיכון הזה?')}</h2>
            {reasons.length ? (
              <ul className="nf-reasons">
                {reasons.map((reason) => (
                  <li key={reason.key} className={`nf-reason nf-reason--${reason.severity}`}>
                    {reason.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nf-quiet">{t('No active risk factors. Perimeter quiet.', 'אין גורמי סיכון פעילים. ההיקף שקט.')}</p>
            )}
          </section>

          {focusTarget ? (
            <section className="nf-card nf-focus" aria-label={t('Target focus', 'מיקוד מטרה')}>
              <div className="nf-focus-head">
                <h2 dir="ltr">TARGET T{focusTarget.id}</h2>
                <button type="button" className="nf-focus-close" onClick={() => setFocusId(null)}>
                  {t('Close', 'סגירה')}
                </button>
              </div>
              <dl className="nf-focus-grid" dir="ltr">
                <div><dt>Distance</dt><dd>{formatDistance(focusTarget.distanceMm)}</dd></div>
                <div><dt>Speed</dt><dd>{formatSpeed(focusTarget.speedCmS)}</dd></div>
                <div><dt>Angle</dt><dd>{focusTarget.angleDeg}°</dd></div>
                <div><dt>Direction</dt><dd>{focusTarget.direction}</dd></div>
                <div><dt>X / Y</dt><dd>{focusTarget.xMm} / {focusTarget.yMm} mm</dd></div>
                <div><dt>Confidence</dt><dd>{Math.round(focusTarget.confidence * 100)}%</dd></div>
                <div><dt>Gate</dt><dd>{focusTarget.approachingGate ? 'APPROACHING' : '—'}</dd></div>
                <div><dt>Radar risk</dt><dd className={`nf-tone-${riskTone(focusTarget.risk)}`}>{focusTarget.risk}</dd></div>
              </dl>
            </section>
          ) : (
            <section className="nf-card nf-timeline" aria-labelledby="nf-narrative">
              <h2 id="nf-narrative">{t('Threat narrative', 'נרטיב איום')}</h2>
              {alerts.length ? (
                <ol className="nf-events" dir="ltr">
                  {alerts.slice(0, 8).map((alert) => (
                    <li key={alert.id} className={`nf-event nf-event--${alert.severity}`}>
                      <span className="nf-event-time">{alert.time}</span>
                      <span>{alert.message}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="nf-quiet">{t('Nothing yet — events will appear here as risk evolves.', 'עדיין כלום — אירועים יופיעו כאן כשהסיכון ישתנה.')}</p>
              )}
            </section>
          )}

          <section className="nf-card" dir="ltr">
            <dl className="nf-meta">
              <div><dt>Behavior</dt><dd>{snapshot.tracks[0]?.state || snapshot.motion || '—'}</dd></div>
              <div><dt>Weapon</dt><dd className={snapshot.hasWeapon ? 'nf-tone-danger' : ''}>
                {camera.weaponDetectionAvailable === false ? 'Unavailable' : snapshot.hasWeapon ? snapshot.weaponType || 'Detected' : 'None'}
              </dd></div>
              <div><dt>Zone</dt><dd>{snapshot.tracks[0]?.zone || '—'}</dd></div>
              <div><dt>Sensor</dt><dd>{snapshot.distanceCm !== null ? `${Math.round(snapshot.distanceCm)} cm` : 'N/A'}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default function NeuralFusion() {
  const location = useLocation()
  const data = useAtapisData(demoOptionsFromLocation(location.search))
  return (
    <DesignLabLayout isDemo={data.isDemo}>
      <Inner {...data} />
    </DesignLabLayout>
  )
}
