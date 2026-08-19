import { useConcept } from '../../useConcept'
import { riskTone } from '../../../design-lab/shared/adapter'
import { InvestigationFilters } from '../../domain/InvestigationFilters'
import { EventDetails } from '../../domain/EventDetails'
import { eventReasons } from '../../data/useInvestigationViewModel'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Neural: threat narrative — a vertical reason-chain timeline.
export default function NeuralInvestigation({ vm }) {
  const { t } = useConcept()

  return (
    <div className="nf2-page nf2-invest">
      <header className="nf2-head">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <p className="nf2-eyebrow" dir="ltr">THREAT NARRATIVE</p>
          <h1 className="nf2-title">{t('Investigation Room', 'חדר חקירה')}</h1>
          <p className="nf2-muted nf2-sub">
            {t(
              'Every recorded event, unfolded into the signal chain that produced its risk.',
              'כל אירוע שנרשם, פרוש לשרשרת האותות שיצרה את הסיכון שלו.'
            )}
          </p>
        </div>
      </header>

      <section className="nf2-card" aria-label={t('Filters', 'סינון')}>
        <InvestigationFilters filters={vm.filters} />
      </section>

      {vm.status === 'error' ? (
        <p className="dm-feedback is-err" dir="ltr">{t('Event store unreachable.', 'מאגר האירועים לא נגיש.')}</p>
      ) : null}

      <div className="nf2-invest-layout">
        <ol className="nf2-timeline" aria-label={t('Event timeline', 'ציר אירועים')}>
          {vm.filtered.slice(0, 60).map((event) => {
            const tone = riskTone(event.fusedRisk)
            const reasons = eventReasons(event, t)
            const selected = vm.selected?.id === event.id
            return (
              <li key={event.id} className={`nf2-tl-item nf2-tl--${tone} ${selected ? 'is-selected' : ''}`}>
                <button type="button" className="nf2-tl-btn" onClick={() => vm.setSelectedId(event.id)}>
                  <span className="nf2-tl-time" dir="ltr">{event.dateLabel} · {event.timeLabel}</span>
                  <span className={`nf2-tl-mode dm-tone-${tone}`} dir="ltr">{event.mode} · {event.fusedRisk}</span>
                  <span className="nf2-tl-chain" dir="ltr">
                    {reasons.slice(0, 3).map((reason) => (
                      <span key={reason.key} className={`nf2-tl-link nf2-tl-link--${reason.severity}`}>
                        {reason.text}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            )
          })}
          {!vm.filtered.length ? (
            <li className="dm-empty">{t('No events match the current filters.', 'אין אירועים התואמים לסינון.')}</li>
          ) : null}
        </ol>

        <section className="nf2-card nf2-invest-details" aria-label={t('Fusion explanation', 'הסבר ההיתוך')}>
          <EventDetails event={vm.selected} isDemo={vm.isDemo} />
        </section>
      </div>
    </div>
  )
}
