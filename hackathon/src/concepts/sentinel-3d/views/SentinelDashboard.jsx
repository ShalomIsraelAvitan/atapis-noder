import { lazy, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useConcept } from '../../useConcept'
import { AnimatedNumber, ModeBadge, StatusDot } from '../../../design-lab/shared/status-primitives'
import { riskTone, backendDotState, formatDistance, formatSpeed } from '../../../design-lab/shared/adapter'
import { Scene3D } from '../../../design-lab/shared/webgl'
import { useReducedMotion } from '../../../design-lab/shared/useReducedMotion'
import { RadarPlot } from '../../domain/RadarPlot'
import { OpenAlerts } from '../../domain/OpenAlerts'
import { WhyThisRisk } from '../../domain/WhyThisRisk'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Reuses the proven Design Lab digital-twin scene (three.js chunk loads only here).
const SentinelScene = lazy(() => import('../../../design-lab/concepts/sentinel-3d/Scene'))

function Fallback2D({ radar }) {
  return (
    <div className="s32-fallback" dir="ltr">
      <p>3D unavailable — 2D operational view.</p>
      <RadarPlot radar={radar} variant="arcs" />
    </div>
  )
}

// Sentinel dashboard: the digital twin IS the page; HUD panels float around it.
export default function SentinelDashboard({ vm }) {
  const { t } = useConcept()
  const { conceptId } = useParams()
  const [selectedId, setSelectedId] = useState(null)
  const [cameraMode, setCameraMode] = useState('overview')
  const reducedMotion = useReducedMotion()

  const selectTarget = (id) => {
    setSelectedId(id)
    if (id !== null) setCameraMode('focus')
  }

  return (
    <div className="s32-stage-page">
      <div className="s32-stage">
        <Scene3D
          fallback={<Fallback2D radar={vm.snapshot.radar} />}
          loading={<div className="s32-loading" dir="ltr">Loading digital twin…</div>}
        >
          <SentinelScene
            radar={vm.snapshot.radar}
            selectedId={selectedId}
            onSelect={selectTarget}
            cameraMode={cameraMode}
            animate={!reducedMotion}
          />
        </Scene3D>

        <p className="s32-disclaimer" dir="ltr">OPERATIONAL VISUALIZATION — NOT GEO-ACCURATE</p>

        {/* HUD: state */}
        <section className="s32-hud s32-hud-state" aria-label={t('System state', 'מצב מערכת')}>
          <DemoModeBadge when={vm.isDemo} />
          <div className="s32-hud-row">
            <ModeBadge mode={vm.snapshot.mode} />
            <span className="s32-risk" dir="ltr">
              <AnimatedNumber value={vm.snapshot.risks.fused} className={`s32-risk-num dm-tone-${riskTone(vm.snapshot.risks.fused)}`} />
              <span className="s32-risk-label">FUSED</span>
            </span>
          </div>
          <div className="s32-hud-grid" dir="ltr">
            <span>CAM {vm.snapshot.risks.camera}</span>
            <span>RDR {vm.snapshot.risks.radar}</span>
            <span>PERSONS {vm.snapshot.personCount}</span>
            <span className={vm.snapshot.hasWeapon ? 'dm-tone-danger' : ''}>
              WPN {vm.snapshot.cameras.webcam.weaponDetectionAvailable === false ? 'N/A' : vm.snapshot.hasWeapon ? 'POS' : 'NEG'}
            </span>
          </div>
          <div className="s32-hud-links" dir="ltr">
            <StatusDot state={backendDotState(vm.backendStatus)} label="Backend" />
            <StatusDot state={vm.snapshot.radar.connected ? 'ok' : 'err'}
              label={`Radar${vm.snapshot.radar.provider ? ` (${vm.snapshot.radar.provider})` : ''}`} />
            <StatusDot state={vm.sensor?.connected === true ? 'ok' : 'off'} label="Sensor" />
          </div>
          <Link to={`/concepts/${conceptId}/camera/${vm.roomId}`} className="s32-hud-cta">
            {t('Open optics station', 'לעמדת האופטיקה')}
          </Link>
        </section>

        {/* HUD: targets */}
        <section className="s32-hud s32-hud-targets" aria-label={t('Targets', 'מטרות')}>
          <div className="s32-hud-row">
            <span className="s32-hud-title" dir="ltr">TARGETS {vm.snapshot.radar.targetsCount}</span>
            <div className="s32-view-toggle" dir="ltr">
              <button type="button" className={cameraMode === 'overview' ? 'is-active' : ''}
                onClick={() => setCameraMode('overview')}>
                {t('Overview', 'מבט־על')}
              </button>
              <button type="button" className={cameraMode === 'focus' ? 'is-active' : ''}
                onClick={() => setCameraMode('focus')} disabled={!vm.snapshot.radar.targets.length}>
                {t('Focus', 'מיקוד')}
              </button>
            </div>
          </div>
          {vm.snapshot.radar.targets.length ? (
            <ul className="s32-target-list" dir="ltr">
              {vm.snapshot.radar.targets.map((target) => (
                <li key={target.id}>
                  <button type="button" className={selectedId === target.id ? 'is-active' : ''}
                    onClick={() => selectTarget(target.id)}>
                    <span className={`dm-tone-${riskTone(target.risk)}`}>T{target.id}</span>
                    <span>{formatDistance(target.distanceMm)}</span>
                    <span>{formatSpeed(target.speedCmS)}</span>
                    <span>{target.direction}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="s32-empty" dir="ltr">
              {vm.snapshot.radar.connected ? 'NO ACTIVE TARGETS' : `RADAR ${vm.snapshot.radar.status}`}
            </p>
          )}
        </section>

        {/* HUD: why + alerts */}
        <section className="s32-hud s32-hud-why" aria-label={t('Why this risk', 'למה הסיכון')}>
          <span className="s32-hud-title" dir="ltr">{t('WHY THIS RISK?', 'למה הסיכון?')}</span>
          <WhyThisRisk reasons={vm.reasons.slice(0, 4)} contributions={null} />
        </section>

        <section className="s32-hud s32-hud-alerts" aria-label={t('Alerts', 'התראות')}>
          <span className="s32-hud-title" dir="ltr">{t('ALERTS', 'התראות')}</span>
          <OpenAlerts alerts={vm.alerts} limit={3} variant="compact" />
        </section>
      </div>
    </div>
  )
}
