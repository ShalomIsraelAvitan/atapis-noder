import { Link, useParams } from 'react-router-dom'
import { useConcept } from '../../useConcept'
import { AnimatedNumber } from '../../../design-lab/shared/status-primitives'
import { modeTone } from '../../../design-lab/shared/adapter'
import { WhyThisRisk } from '../../domain/WhyThisRisk'
import { OpenAlerts } from '../../domain/OpenAlerts'
import { RiskTimelineChart } from '../../domain/RiskTimelineChart'
import { TargetsTable } from '../../domain/TargetsTable'
import { ActivitySummary } from '../../domain/ActivitySummary'
import { RiskDecisionHeader } from '../../domain/RiskDecisionHeader'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

function PipelineNode({ id, title, value, sub, active, tone }) {
  return (
    <div className={`nf2-node ${active ? 'is-active' : ''} ${tone ? `nf2-node--${tone}` : ''}`} data-node={id}>
      <span className="nf2-node-title" dir="ltr">{title}</span>
      <span className="nf2-node-value" dir="ltr">{value}</span>
      {sub ? <span className="nf2-node-sub" dir="ltr">{sub}</span> : null}
    </div>
  )
}

// Neural: the fusion pipeline IS the dashboard —
// Camera → Detection → Behavior ↘
//                                Fusion → Risk Decision
// Radar  ————————————————————— ↗
export default function NeuralDashboard({ vm }) {
  const { t } = useConcept()
  const { conceptId } = useParams()
  const s = vm.snapshot
  const tone = modeTone(s.mode)
  const camActive = s.cameras.webcam.connected || s.cameras.dahua.connected || s.hasPerson
  const behavior = s.tracks[0]?.state || s.motion || null

  return (
    <div className={`nf2-page nf2-dashboard nf2-mode-${tone}`}>
      <header className="nf2-head">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <p className="nf2-eyebrow" dir="ltr">ATAPIS · SENSOR FUSION</p>
          <h1 className="nf2-title">{t('One decision from many signals', 'החלטה אחת מאותות רבים')}</h1>
        </div>
        <Link to={`/concepts/${conceptId}/camera/${vm.roomId}`} className="nf2-cta">
          {t('Open vision core', 'לליבת הראייה')}
        </Link>
      </header>

      <RiskDecisionHeader snapshot={vm.snapshot} linkage={vm.linkage} className="nf2-decision" />

      <section className="nf2-pipeline" aria-label={t('Fusion pipeline', 'צינור ההיתוך')}>
        <svg className="nf2-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 16 22 C 30 22 32 22 46 22" className={`nf2-wire ${camActive ? 'is-on' : ''}`} />
          <path d="M 62 22 C 72 22 74 34 82 44" className={`nf2-wire ${camActive ? 'is-on' : ''}`} />
          <path d="M 16 78 C 40 78 60 70 82 54" className={`nf2-wire ${s.radar.targets.length ? 'is-on' : ''}`} />
          <path d="M 90 49 C 94 49 95 49 98 49" className={`nf2-wire is-on nf2-wire--${tone}`} />
        </svg>

        <div className="nf2-lane nf2-lane-camera">
          <PipelineNode
            id="camera"
            title="CAMERA"
            value={camActive ? (s.personCount ? `${s.personCount} person` : 'watching') : 'offline'}
            sub={`risk ${s.risks.camera}`}
            active={camActive}
          />
          <PipelineNode
            id="behavior"
            title="BEHAVIOR"
            value={behavior || '—'}
            sub={s.hasWeapon ? 'weapon' : s.tracks[0]?.zone || null}
            active={Boolean(behavior)}
            tone={s.hasWeapon ? 'danger' : undefined}
          />
        </div>

        <div className="nf2-lane nf2-lane-radar">
          <PipelineNode
            id="radar"
            title="RADAR"
            value={s.radar.connected ? `${s.radar.targetsCount} targets` : s.radar.status}
            sub={`risk ${s.risks.radar}${s.radar.provider ? ` · ${s.radar.provider}` : ''}`}
            active={s.radar.targets.length > 0}
          />
        </div>

        <div className="nf2-lane nf2-lane-decision">
          <div className={`nf2-decision nf2-decision--${tone}`}>
            <span className="nf2-node-title" dir="ltr">RISK DECISION</span>
            <AnimatedNumber value={s.risks.fused} className="nf2-decision-num" />
            <span className={`dm-mode dl-mode dl-mode--${tone}`} dir="ltr">{s.mode}</span>
          </div>
        </div>
      </section>

      <div className="nf2-grid">
        <section className="nf2-card" aria-label={t('Why this risk', 'למה הסיכון')}>
          <h2 className="dm-subtitle">{t('Why this risk?', 'למה הסיכון הזה?')}</h2>
          <WhyThisRisk reasons={vm.reasons} contributions={vm.contributions} />
        </section>

        <section className="nf2-card" aria-label={t('Threat narrative', 'נרטיב איום')}>
          <h2 className="dm-subtitle">{t('Threat narrative', 'נרטיב איום')}</h2>
          <OpenAlerts alerts={vm.alerts} limit={7} />
        </section>

        <section className="nf2-card" aria-label={t('Targets', 'מטרות')}>
          <h2 className="dm-subtitle">
            {t('Active targets', 'מטרות פעילות')}{' '}
            <span className="nf2-muted" dir="ltr">{s.radar.status}</span>
          </h2>
          <TargetsTable radar={s.radar} variant="cards" />
        </section>

        <section className="nf2-card nf2-span2" aria-label={t('Risk over time', 'סיכון לאורך זמן')}>
          <RiskTimelineChart samples={vm.timeline.samples} scope="session" />
        </section>

        <section className="nf2-card" aria-label={t('Summary', 'סיכום')}>
          <ActivitySummary summary={vm.summary} />
        </section>
      </div>
    </div>
  )
}
