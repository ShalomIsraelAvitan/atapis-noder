import { lazy } from 'react'
import { useConcept } from '../../useConcept'
import { CameraFeed } from '../../../design-lab/shared/CameraFeed'
import { riskTone, formatDistance, formatSpeed } from '../../../design-lab/shared/adapter'
import { Scene3D } from '../../../design-lab/shared/webgl'
import { useReducedMotion } from '../../../design-lab/shared/useReducedMotion'
import { RadarPlot } from '../../domain/RadarPlot'
import { WhyThisRisk } from '../../domain/WhyThisRisk'
import { TracksTable } from '../../domain/TracksTable'
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

// Sentinel camera: the digital twin stays as backdrop, the live feed floats
// as a glass panel above it, and selecting a radar target opens its focus card.
export default function SentinelCamera({ vm }) {
  const { t } = useConcept()
  const target = vm.selectedTarget
  const reducedMotion = useReducedMotion()

  return (
    <div className="s32-stage-page">
      <div className="s32-stage">
        <Scene3D
          fallback={<Fallback2D radar={vm.snapshot.radar} />}
          loading={<div className="s32-loading" dir="ltr">Loading digital twin…</div>}
        >
          <SentinelScene
            radar={vm.snapshot.radar}
            selectedId={vm.selectedTargetId}
            onSelect={vm.setSelectedTargetId}
            cameraMode={target ? 'focus' : 'overview'}
            animate={!reducedMotion}
          />
        </Scene3D>

        <p className="s32-disclaimer" dir="ltr">OPERATIONAL VISUALIZATION — NOT GEO-ACCURATE</p>

        <section className="s32-hud s32-hud-camera" aria-label={t('Optics', 'אופטיקה')}>
          <DemoModeBadge when={vm.isDemo} />
          <div className="s32-cam-bar" dir="ltr">
            <span className="s32-hud-title">OPTICS · ROOM {vm.roomId}</span>
            <div className="s32-source-tabs">
              {['webcam', 'dahua'].map((name) => (
                <button
                  key={name}
                  type="button"
                  className={vm.source === name ? 'is-active' : ''}
                  onClick={() => vm.setSource(name)}
                >
                  {name === 'webcam' ? 'LOCAL' : 'DAHUA'}
                </button>
              ))}
            </div>
          </div>
          <CameraFeed source={vm.source} active cameraStatus={vm.camera} isDemo={vm.isDemo} />
        </section>

        <section className="s32-hud s32-hud-focus" aria-label={t('Target focus', 'מיקוד מטרה')}>
          {target ? (
            <>
              <div className="s32-hud-row">
                <span className="s32-hud-title" dir="ltr">TARGET T{target.id}</span>
                <button type="button" className="dm-btn" onClick={() => vm.setSelectedTargetId(null)}>
                  {t('Close', 'סגירה')}
                </button>
              </div>
              <dl className="dm-eventmeta" dir="ltr">
                <div><dt>Distance</dt><dd>{formatDistance(target.distanceMm)}</dd></div>
                <div><dt>Speed</dt><dd>{formatSpeed(target.speedCmS)}</dd></div>
                <div><dt>Angle</dt><dd>{target.angleDeg}°</dd></div>
                <div><dt>Direction</dt><dd>{target.direction}</dd></div>
                <div><dt>Confidence</dt><dd>{Math.round(target.confidence * 100)}%</dd></div>
                <div><dt>Radar risk</dt><dd className={`dm-tone-${riskTone(target.risk)}`}>{target.risk}</dd></div>
              </dl>
            </>
          ) : (
            <>
              <span className="s32-hud-title" dir="ltr">{t('WHY THIS RISK?', 'למה הסיכון?')}</span>
              <WhyThisRisk reasons={vm.reasons.slice(0, 4)} contributions={null} />
            </>
          )}
        </section>

        <section className="s32-hud s32-hud-tracks" aria-label={t('Tracked persons', 'אנשים במעקב')}>
          <span className="s32-hud-title" dir="ltr">{t('TRACKED PERSONS', 'אנשים במעקב')}</span>
          <TracksTable snapshot={vm.snapshot} />
        </section>
      </div>
    </div>
  )
}
