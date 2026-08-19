import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import DesignLabLayout from '../../DesignLabLayout'
import { useAtapisData, demoOptionsFromLocation } from '../../shared/useAtapisData'
import { useLab } from '../../shared/useLab'
import { CameraFeed } from '../../shared/CameraFeed'
import { riskTone, radarMapPosition, formatDistance, formatSpeed } from '../../shared/adapter'
import './industrial-ops.css'

function LinkCell({ ok, label, detail }) {
  return (
    <div className="io-link" dir="ltr">
      <span className={`io-link-state ${ok ? 'is-ok' : 'is-down'}`}>{ok ? 'LINK' : 'DOWN'}</span>
      <span className="io-link-label">{label}</span>
      {detail ? <span className="io-link-detail">{detail}</span> : null}
    </div>
  )
}

// Orthographic top-view radar plot: hard grid, square markers.
function OpsRadarMap({ radar, selectedId, onSelect }) {
  return (
    <div className="io-map" dir="ltr">
      <svg viewBox="0 0 320 240" className="io-map-svg" role="img" aria-label="Radar plot">
        <rect width="320" height="240" fill="#0d0d0d" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`h${i}`} x1="0" y1={40 + i * 40} x2="320" y2={40 + i * 40} stroke="#1d1d1d" />
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={`v${i}`} x1={40 + i * 40} y1="0" x2={40 + i * 40} y2="240" stroke="#1d1d1d" />
        ))}
        <line x1="160" y1="0" x2="160" y2="240" stroke="#2e2e2e" />
        <rect x="150" y="228" width="20" height="8" fill="#eaeaea" />
        <text x="176" y="236" fill="#6a6a6a" fontSize="9" fontFamily="monospace">RDR-01</text>
        {[60, 120, 180].map((d, i) => (
          <g key={d}>
            <line x1="0" y1={228 - d} x2="320" y2={228 - d} stroke="#242424" strokeDasharray="3 5" />
            <text x="4" y={224 - d} fill="#4d4d4d" fontSize="8" fontFamily="monospace">{(i + 1) * 2 + 'M'}</text>
          </g>
        ))}
        {radar.targets.map((target) => {
          const { xRatio, yRatio } = radarMapPosition(target)
          const x = 160 + xRatio * 150
          const y = 228 - yRatio * 208
          const tone = riskTone(target.risk)
          return (
            <g
              key={target.id}
              className="io-map-target"
              onClick={() => onSelect(target.id)}
              role="button"
              tabIndex={-1}
            >
              {selectedId === target.id ? (
                <rect x={x - 10} y={y - 10} width="20" height="20" fill="none" stroke="#eaeaea" strokeDasharray="3 2" />
              ) : null}
              <rect x={x - 5} y={y - 5} width="10" height="10" className={`io-map-dot io-fill-${tone}`} />
              <text x={x + 9} y={y + 4} fill="#8a8a8a" fontSize="9" fontFamily="monospace">
                T{target.id}
              </text>
            </g>
          )
        })}
        {!radar.targets.length ? (
          <text x="160" y="120" fill="#4d4d4d" fontSize="11" fontFamily="monospace" textAnchor="middle">
            {radar.connected ? '[ NO CONTACTS ]' : `[ RADAR ${radar.status} ]`}
          </text>
        ) : null}
      </svg>
    </div>
  )
}

function Inner({ snapshot, backendStatus, isDemo, alerts }) {
  const { t } = useLab()
  const [source, setSource] = useState('webcam')
  const [selectedId, setSelectedId] = useState(null)
  const camera = snapshot.cameras[source]
  const tone = riskTone(snapshot.risks.fused)

  return (
    <div className={`io-page io-mode-${tone}`}>
      {/* Top status bar */}
      <header className="io-topbar" dir="ltr">
        <div className={`io-mode-block io-mode-block--${tone}`} aria-live="polite">
          <span className="io-mode-label">SYS MODE</span>
          <span className="io-mode-value">{snapshot.mode}</span>
        </div>
        <div className="io-topbar-cell io-topbar-risks">
          <span>CAM RISK <b className={`io-tone-${riskTone(snapshot.risks.camera)}`}>{String(snapshot.risks.camera).padStart(2, '0')}</b></span>
          <span>RDR RISK <b className={`io-tone-${riskTone(snapshot.risks.radar)}`}>{String(snapshot.risks.radar).padStart(2, '0')}</b></span>
          <span>FUSED <b className={`io-tone-${tone}`}>{String(snapshot.risks.fused).padStart(2, '0')}</b></span>
        </div>
        <div className="io-topbar-cell io-topbar-links">
          <LinkCell ok={backendStatus === 'ok'} label="BACKEND" detail={backendStatus.toUpperCase()} />
          <LinkCell ok={camera.connected} label="CAMERA" detail={source.toUpperCase()} />
          <LinkCell
            ok={snapshot.radar.connected}
            label="RADAR"
            detail={snapshot.radar.provider ? snapshot.radar.provider.toUpperCase() : snapshot.radar.status}
          />
          <LinkCell ok={snapshot.distanceCm !== null} label="SENSOR"
            detail={snapshot.distanceCm !== null ? `${Math.round(snapshot.distanceCm)}CM` : 'N/A'} />
        </div>
        <div className="io-topbar-cell io-topbar-meta">
          <span>PROFILE / {String(snapshot.profile || 'N-A').toUpperCase()}</span>
          <span>CONTACTS / {snapshot.radar.targetsCount}</span>
          <span>PERSONS / {snapshot.personCount}</span>
          <span className={snapshot.hasWeapon ? 'io-tone-danger' : ''}>
            WEAPON / {camera.weaponDetectionAvailable === false ? 'N-A' : snapshot.hasWeapon ? 'POS' : 'NEG'}
          </span>
        </div>
      </header>

      {/* Main grid */}
      <div className="io-main">
        <section className="io-panel io-panel-radar" aria-label={t('Radar', 'רדאר')}>
          <h2 className="io-panel-title" dir="ltr">[ RADAR PLOT ]</h2>
          <OpsRadarMap radar={snapshot.radar} selectedId={selectedId} onSelect={setSelectedId} />
          <h2 className="io-panel-title" dir="ltr">[ CONTACT TABLE ]</h2>
          <div className="io-table-scroll">
            <table className="io-table" dir="ltr">
              <thead>
                <tr>
                  <th>ID</th><th>DIST</th><th>SPD</th><th>ANG</th><th>DIR</th><th>GATE</th><th>RISK</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.radar.targets.length ? (
                  snapshot.radar.targets.map((target) => (
                    <tr
                      key={target.id}
                      className={selectedId === target.id ? 'is-selected' : ''}
                      onClick={() => setSelectedId(target.id)}
                    >
                      <td>T{target.id}</td>
                      <td>{formatDistance(target.distanceMm)}</td>
                      <td>{formatSpeed(target.speedCmS)}</td>
                      <td>{Math.round(target.angleDeg)}°</td>
                      <td>{target.direction.slice(0, 4).toUpperCase()}</td>
                      <td className={target.approachingGate ? 'io-tone-alert' : ''}>
                        {target.approachingGate ? 'APPR' : '—'}
                      </td>
                      <td className={`io-tone-${riskTone(target.risk)}`}>{target.risk}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="io-table-empty">NO ACTIVE CONTACTS</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="io-panel io-panel-camera" aria-label={t('Camera', 'מצלמה')}>
          <div className="io-panel-title-row" dir="ltr">
            <h2 className="io-panel-title">[ OPTICAL / {source.toUpperCase()} ]</h2>
            <div className="io-source-switch">
              {['webcam', 'dahua'].map((name) => (
                <button
                  key={name}
                  type="button"
                  className={source === name ? 'is-active' : ''}
                  onClick={() => setSource(name)}
                >
                  {name === 'webcam' ? 'CAM-01' : 'CAM-02'}
                </button>
              ))}
            </div>
          </div>
          <CameraFeed source={source} active cameraStatus={camera} isDemo={isDemo} />
          <h2 className="io-panel-title" dir="ltr">[ TRACK TABLE ]</h2>
          <div className="io-table-scroll">
            <table className="io-table" dir="ltr">
              <thead>
                <tr><th>TRK</th><th>STATE</th><th>SPD PX/S</th><th>ZONE</th><th>WPN</th><th>RISK</th></tr>
              </thead>
              <tbody>
                {snapshot.tracks.length ? (
                  snapshot.tracks.map((track) => (
                    <tr key={track.id}>
                      <td>#{track.id}</td>
                      <td className={track.hasWeapon ? 'io-tone-danger' : ''}>{String(track.state).toUpperCase()}</td>
                      <td>{Math.round(track.speed)}</td>
                      <td>{track.zone ? String(track.zone).toUpperCase() : '—'}</td>
                      <td className={track.hasWeapon ? 'io-tone-danger' : ''}>{track.hasWeapon ? 'POS' : 'NEG'}</td>
                      <td className={`io-tone-${riskTone(track.risk)}`}>{track.risk}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="io-table-empty">
                      {camera.connected ? 'NO TRACKED PERSONS' : `CAMERA ${String(camera.status).toUpperCase()}`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="io-panel io-panel-events" aria-label={t('Event log', 'יומן אירועים')}>
          <h2 className="io-panel-title" dir="ltr">[ EVENT LOG ]</h2>
          <ol className="io-events" dir="ltr">
            {alerts.length ? (
              alerts.slice(0, 14).map((alert) => (
                <li key={alert.id} className={`io-event io-event--${alert.severity}`}>
                  <span className="io-event-time">{alert.time}</span>
                  <span className="io-event-msg">{alert.message.toUpperCase()}</span>
                </li>
              ))
            ) : (
              <li className="io-event io-event--empty">
                <span className="io-event-msg">LOG EMPTY — SYSTEM NOMINAL</span>
              </li>
            )}
          </ol>
        </section>
      </div>

      {/* Alert ticker */}
      <footer className="io-ticker" dir="ltr" aria-hidden="true">
        <span className="io-ticker-tag">LIVE</span>
        <div className="io-ticker-track">
          <span className="io-ticker-text">
            {(alerts.length ? alerts.slice(0, 6) : [{ id: 'x', time: '', message: 'ALL SYSTEMS NOMINAL' }])
              .map((alert) => `${alert.time ? alert.time + ' ' : ''}${alert.message.toUpperCase()}`)
              .join('  ///  ')}
            {'  ///  '}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default function IndustrialOps() {
  const location = useLocation()
  const data = useAtapisData(demoOptionsFromLocation(location.search))
  return (
    <DesignLabLayout isDemo={data.isDemo}>
      <Inner {...data} />
    </DesignLabLayout>
  )
}
