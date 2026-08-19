import { useConcept } from '../../useConcept'
import { InvestigationFilters } from '../../domain/InvestigationFilters'
import { EventList } from '../../domain/EventList'
import { EventDetails } from '../../domain/EventDetails'
import { RiskTimelineChart } from '../../domain/RiskTimelineChart'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Minimal interpretation: clean split view — list / selected event.
export default function MinimalInvestigation({ vm }) {
  const { t } = useConcept()

  return (
    <div className="mn-page mn-invest">
      <header className="mn-invest-head">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <h1 className="mn-title">{t('Investigation Room', 'חדר חקירה')}</h1>
          <p className="mn-muted mn-invest-sub">
            {t(
              'Camera, radar, targets and risk — centered around every recorded event.',
              'חדר החקירה מרכז את נתוני המצלמה, הרדאר, המטרות ורמת הסיכון סביב כל אירוע שאותר במערכת.'
            )}
          </p>
        </div>
        <div className="mn-invest-stats" dir="ltr">
          <span>{vm.stats.total} {t('events', 'אירועים')}</span>
          <span className="dm-tone-danger">{vm.stats.weapons} {t('weapons', 'נשק')}</span>
          <span className="dm-tone-alert">{vm.stats.danger + vm.stats.alert} ALERT+</span>
        </div>
      </header>

      <div className="mn-card">
        <InvestigationFilters filters={vm.filters} />
      </div>

      {vm.status === 'error' ? (
        <p className="dm-feedback is-err" dir="ltr">{t('Backend unreachable — event history unavailable.', 'השרת לא נגיש — היסטוריית אירועים לא זמינה.')}</p>
      ) : null}

      <div className="mn-invest-grid">
        <section className="mn-card mn-invest-list" aria-label={t('Events', 'אירועים')}>
          <EventList
            events={vm.filtered}
            selectedId={vm.selected?.id}
            onSelect={vm.setSelectedId}
            variant="list"
            limit={80}
          />
        </section>
        <section className="mn-card mn-invest-details" aria-label={t('Event details', 'פרטי אירוע')}>
          <EventDetails event={vm.selected} isDemo={vm.isDemo} />
        </section>
      </div>

      <section className="mn-card" aria-label={t('Risk across events', 'סיכון על פני אירועים')}>
        <RiskTimelineChart samples={vm.riskSeries} scope="events" />
      </section>
    </div>
  )
}
