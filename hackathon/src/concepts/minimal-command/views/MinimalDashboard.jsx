import { Link, useParams } from 'react-router-dom'
import { useConcept } from '../../useConcept'
import { SystemMode } from '../../domain/SystemMode'
import { RiskSummary } from '../../domain/RiskSummary'
import { RiskDecisionHeader } from '../../domain/RiskDecisionHeader'
import { ContactPairCard } from '../../domain/ContactPairCard'
import { StatusBoard } from '../../domain/StatusBoard'
import { RiskTimelineChart } from '../../domain/RiskTimelineChart'
import { RadarPlot } from '../../domain/RadarPlot'
import { TargetsTable } from '../../domain/TargetsTable'
import { OpenAlerts } from '../../domain/OpenAlerts'
import { WhyThisRisk } from '../../domain/WhyThisRisk'
import { ActivitySummary } from '../../domain/ActivitySummary'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

export default function MinimalDashboard({ vm }) {
  const { t } = useConcept()
  const { conceptId } = useParams()
  const camera = vm.snapshot.cameras.webcam.connected
    ? vm.snapshot.cameras.webcam
    : vm.snapshot.cameras.dahua
  const featuredPair = (vm.candidatePairs || [])[0] || null

  return (
    <div className="mn-page mn-dashboard">
      <header className="mn-hero">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <SystemMode snapshot={vm.snapshot} />
        </div>
        <RiskSummary snapshot={vm.snapshot} className="mn-hero-risks" />
      </header>

      <RiskDecisionHeader snapshot={vm.snapshot} linkage={vm.linkage} className="mn-decision" />

      <div className="mn-grid">
        <section className="mn-card mn-span2" aria-label={t('Risk over time', 'סיכון לאורך זמן')}>
          <RiskTimelineChart samples={vm.timeline.samples} scope="session" />
        </section>

        <section className="mn-card" aria-label={t('System health', 'תקינות מערכת')}>
          <h2 className="dm-subtitle">{t('Connections', 'חיבורים')}</h2>
          <StatusBoard snapshot={vm.snapshot} backendStatus={vm.backendStatus} sensor={vm.sensor} />
        </section>

        <section className="mn-card" aria-label={t('Camera summary', 'תקציר מצלמה')}>
          <h2 className="dm-subtitle">{t('Camera', 'מצלמה')}</h2>
          <dl className="mn-kv" dir="ltr">
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
          <Link to={`/concepts/${conceptId}/camera/${vm.roomId}`} className="mn-cta">
            {t('Open camera room', 'פתיחת חדר מצלמה')}
          </Link>
        </section>

        <section className="mn-card" aria-label={t('Radar', 'רדאר')}>
          <div className="mn-card-head">
            <h2 className="dm-subtitle">{t('Radar', 'רדאר')}</h2>
            <span className="mn-muted" dir="ltr">
              {vm.snapshot.radar.status}
              {vm.snapshot.radar.provider ? ` · ${vm.snapshot.radar.provider}` : ''}
              {` · ${vm.snapshot.radar.targetsCount} ${t('targets', 'מטרות')}`}
            </span>
          </div>
          <RadarPlot radar={vm.snapshot.radar} variant="arcs" />
          <TargetsTable radar={vm.snapshot.radar} variant="cards" />
        </section>

        <section className="mn-card" aria-label={t('Contact pair', 'זוג מגע')}>
          <h2 className="dm-subtitle">{t('Contact pair', 'זוג מגע')}</h2>
          {featuredPair ? (
            <ContactPairCard pair={featuredPair} />
          ) : (
            <p className="dm-empty">{t('No active contacts.', 'אין מגעים פעילים.')}</p>
          )}
        </section>

        <section className="mn-card" aria-label={t('Why this risk', 'למה הסיכון')}>
          <h2 className="dm-subtitle">{t('Why this risk?', 'למה הסיכון הזה?')}</h2>
          <WhyThisRisk reasons={vm.reasons} contributions={vm.contributions} />
        </section>

        <section className="mn-card" aria-label={t('Alerts', 'התראות')}>
          <h2 className="dm-subtitle">{t('Open alerts', 'התראות פתוחות')}</h2>
          <OpenAlerts alerts={vm.alerts} limit={5} />
        </section>

        <section className="mn-card mn-span2" aria-label={t('Summary', 'סיכום')}>
          <ActivitySummary summary={vm.summary} />
        </section>
      </div>
    </div>
  )
}
