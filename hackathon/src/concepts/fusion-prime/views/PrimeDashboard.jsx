import { lazy, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useConcept } from '../../useConcept'
import { CameraFeed } from '../../../design-lab/shared/CameraFeed'
import { Scene3D } from '../../../design-lab/shared/webgl'
import { useReducedMotion } from '../../../design-lab/shared/useReducedMotion'
import { buildOperatorSentence } from '../../data/riskDecision'
import { useRadarAlertRanges } from '../../data/useRadarAlertRanges'
import { RiskDecisionHeader } from '../../domain/RiskDecisionHeader'
import { RiskSummary } from '../../domain/RiskSummary'
import { ContactPairCard } from '../../domain/ContactPairCard'
import { StatusBoard } from '../../domain/StatusBoard'
import { RiskTimelineChart } from '../../domain/RiskTimelineChart'
import { RadarPlot } from '../../domain/RadarPlot'
import { TargetsTable } from '../../domain/TargetsTable'
import { OpenAlerts } from '../../domain/OpenAlerts'
import { WhyThisRisk } from '../../domain/WhyThisRisk'
import { ActivitySummary } from '../../domain/ActivitySummary'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Compact digital twin — reuses the proven Sentinel scene chunk (loads lazily,
// only on this page). Cinematic motion is allowed HERE ONLY (decision doc).
const SentinelScene = lazy(() => import('../../../design-lab/concepts/sentinel-3d/Scene'))

// Prime dashboard: Minimal's hero clarity, Sentinel's compact twin beside the
// live camera, Industrial's targets table below (selection synced twin<->table),
// Neural's "Why this risk" as the explanatory side panel.
export default function PrimeDashboard({ vm }) {
  const { t } = useConcept()
  const { conceptId } = useParams()
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState('command') // command | detailed
  const reducedMotion = useReducedMotion()
  const camera = vm.snapshot.cameras.webcam.connected
    ? vm.snapshot.cameras.webcam
    : vm.snapshot.cameras.dahua
  const source = vm.snapshot.cameras.webcam.connected ? 'webcam' : 'dahua'

  const alertRanges = useRadarAlertRanges()

  const fallback2d = (
    <RadarPlot
      radar={vm.snapshot.radar}
      variant="arcs"
      alertRanges={alertRanges}
      className="pp-twin-fallback"
    />
  )

  // The pair to feature: the one whose radar target is selected, else the first
  // (a linked candidate sorts first). Selecting T1 <-> Track #7 is a UI action
  // on a candidate pair, not an assertion that the two are the same subject.
  const pairs = vm.candidatePairs || []
  const featuredPair =
    pairs.find((p) => selectedId != null && p.radarTargetId === selectedId) || pairs[0] || null

  const sentence = useMemo(
    () => buildOperatorSentence(vm.snapshot, { linkage: vm.linkage, pair: featuredPair }),
    [vm.snapshot, vm.linkage, featuredPair]
  )

  return (
    <div className="pp-page pp-dashboard">
      <header className="pp-command-head">
        <RiskDecisionHeader
          snapshot={vm.snapshot}
          linkage={vm.linkage}
          sentence={sentence}
          className="pp-decision"
        />
        <div className="pp-command-aside">
          <RiskSummary snapshot={vm.snapshot} className="pp-hero-risks" />
          <div className="pp-viewtoggle" role="tablist" aria-label={t('Dashboard view', 'תצוגת דשבורד')}>
            <button type="button" role="tab" aria-selected={view === 'command'}
              className={view === 'command' ? 'is-active' : ''} onClick={() => setView('command')}>
              {t('Command', 'פיקוד')}
            </button>
            <button type="button" role="tab" aria-selected={view === 'detailed'}
              className={view === 'detailed' ? 'is-active' : ''} onClick={() => setView('detailed')}>
              {t('Detailed', 'מפורט')}
            </button>
          </div>
          <DemoModeBadge when={vm.isDemo} />
        </div>
      </header>

      <div className="pp-stage-row">
        <section className="pp-card pp-twin" aria-label={t('Digital twin', 'תאום דיגיטלי')}>
          <div className="pp-card-head">
            <h2 className="dm-subtitle">{t('Site twin', 'תאום האתר')}</h2>
            <span className="pp-muted" dir="ltr">
              {vm.snapshot.radar.status}
              {vm.snapshot.radar.provider ? ` · ${vm.snapshot.radar.provider}` : ''}
            </span>
          </div>
          <div className="pp-twin-stage">
            <Scene3D
              fallback={fallback2d}
              loading={<p className="pp-twin-loading" dir="ltr">Loading twin…</p>}
            >
              <SentinelScene
                radar={vm.snapshot.radar}
                selectedId={selectedId}
                onSelect={setSelectedId}
                cameraMode={selectedId !== null ? 'focus' : 'overview'}
                animate={!reducedMotion}
              />
            </Scene3D>
          </div>
          <p className="pp-twin-note" dir="ltr">OPERATIONAL VISUALIZATION — NOT GEO-ACCURATE</p>
        </section>

        <section className="pp-card pp-feed" aria-label={t('Live camera', 'מצלמה חיה')}>
          <div className="pp-card-head">
            <h2 className="dm-subtitle">{t('Live camera', 'מצלמה חיה')}</h2>
            <Link to={`/concepts/${conceptId}/camera/${vm.roomId}`} className="pp-cta">
              {t('Open optics', 'לעמדת האופטיקה')}
            </Link>
          </div>
          <CameraFeed source={source} active cameraStatus={camera} isDemo={vm.isDemo} />
          <dl className="pp-kv" dir="ltr">
            <div><dt>{t('Persons', 'אנשים')}</dt><dd>{vm.snapshot.personCount}</dd></div>
            <div><dt>{t('Behavior', 'התנהגות')}</dt><dd>{vm.snapshot.tracks[0]?.state || vm.snapshot.motion || '—'}</dd></div>
            <div>
              <dt>{t('Weapon', 'נשק')}</dt>
              <dd className={vm.snapshot.hasWeapon ? 'dm-tone-danger' : ''}>
                {camera.weaponDetectionAvailable === false
                  ? t('Unavailable', 'לא זמין')
                  : vm.snapshot.hasWeapon ? t('Detected', 'זוהה') : t('None', 'אין')}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="pp-command-row">
        <section className="pp-card" aria-label={t('Featured contact', 'מגע נבחר')}>
          <div className="pp-card-head">
            <h2 className="dm-subtitle">{t('Contact pair', 'זוג מגע')}</h2>
            {featuredPair && featuredPair.source.camera && featuredPair.source.radar ? (
              <span className="pp-muted" dir="ltr">CAM #{featuredPair.cameraTrackId} · RDR T{featuredPair.radarTargetId}</span>
            ) : null}
          </div>
          {featuredPair ? (
            <ContactPairCard pair={featuredPair} onSelect={(p) => setSelectedId(p.radarTargetId)} />
          ) : (
            <p className="dm-empty">{t('No active contacts.', 'אין מגעים פעילים.')}</p>
          )}
        </section>

        <section className="pp-card" aria-label={t('Why this risk', 'למה הסיכון')}>
          <h2 className="dm-subtitle">{t('Why this risk?', 'למה הסיכון הזה?')}</h2>
          <WhyThisRisk reasons={vm.reasons} contributions={vm.contributions} />
        </section>
      </div>

      {view === 'detailed' ? (
        <>
          <section className="pp-card" aria-label={t('Radar targets', 'מטרות רדאר')}>
            <div className="pp-card-head">
              <h2 className="dm-subtitle">{t('Radar targets', 'מטרות רדאר')}</h2>
              <span className="pp-muted" dir="ltr">{vm.snapshot.radar.targetsCount} {t('targets', 'מטרות')}</span>
            </div>
            <TargetsTable radar={vm.snapshot.radar} selectedId={selectedId} onSelect={setSelectedId} variant="table" />
          </section>

          <div className="pp-grid">
            <section className="pp-card" aria-label={t('Risk over time', 'סיכון לאורך זמן')}>
              <RiskTimelineChart samples={vm.timeline.samples} scope="session" />
            </section>

            <section className="pp-card" aria-label={t('Alerts', 'התראות')}>
              <h2 className="dm-subtitle">{t('Session alerts', 'התראות הסשן')}</h2>
              <OpenAlerts alerts={vm.alerts} limit={6} />
            </section>

            <section className="pp-card" aria-label={t('Connections', 'חיבורים')}>
              <h2 className="dm-subtitle">{t('Connections', 'חיבורים')}</h2>
              <StatusBoard snapshot={vm.snapshot} backendStatus={vm.backendStatus} sensor={vm.sensor} />
            </section>

            <section className="pp-card pp-span2" aria-label={t('Summary', 'סיכום')}>
              <ActivitySummary summary={vm.summary} />
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
