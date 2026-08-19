import { useConcept } from '../../useConcept'
import { InvestigationFilters } from '../../domain/InvestigationFilters'
import { EventList } from '../../domain/EventList'
import { EventDetails } from '../../domain/EventDetails'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Industrial: operations investigation — dense audit table + inline drilldown.
export default function IndustrialInvestigation({ vm }) {
  const { t } = useConcept()

  return (
    <div className="io2-page io2-invest">
      <div className="io2-strip" dir="ltr">
        <div className="io2-strip-mode">
          <span className="io2-strip-label">INVESTIGATION</span>
          <span className="io2-strip-modeval io2-strip-modeval--sm">{t('AUDIT TRAIL', 'נתיב ביקורת')}</span>
          <DemoModeBadge when={vm.isDemo} />
        </div>
        <div className="io2-strip-cell"><span className="io2-strip-label">EVENTS</span><span className="io2-strip-value">{vm.stats.total}</span></div>
        <div className="io2-strip-cell"><span className="io2-strip-label">FILTERED</span><span className="io2-strip-value">{vm.filtered.length}</span></div>
        <div className="io2-strip-cell"><span className="io2-strip-label">WEAPONS</span><span className="io2-strip-value dm-tone-danger">{vm.stats.weapons}</span></div>
        <div className="io2-strip-cell"><span className="io2-strip-label">DANGER</span><span className="io2-strip-value dm-tone-danger">{vm.stats.danger}</span></div>
        <div className="io2-strip-cell"><span className="io2-strip-label">ALERT</span><span className="io2-strip-value dm-tone-alert">{vm.stats.alert}</span></div>
      </div>

      <section className="io2-panel" aria-label={t('Filters', 'סינון')}>
        <h2 className="io2-panel-title" dir="ltr">[ QUERY ]</h2>
        <InvestigationFilters filters={vm.filters} />
      </section>

      {vm.status === 'error' ? (
        <p className="dm-feedback is-err" dir="ltr">EVENT STORE UNREACHABLE</p>
      ) : null}

      <div className="io2-invest-grid">
        <section className="io2-panel io2-invest-table" aria-label={t('Event table', 'טבלת אירועים')}>
          <h2 className="io2-panel-title" dir="ltr">[ EVENT TABLE ]</h2>
          <EventList
            events={vm.filtered}
            selectedId={vm.selected?.id}
            onSelect={vm.setSelectedId}
            variant="table"
            limit={150}
          />
        </section>
        <section className="io2-panel" aria-label={t('Event record', 'רשומת אירוע')}>
          <h2 className="io2-panel-title" dir="ltr">[ EVENT RECORD ]</h2>
          <EventDetails event={vm.selected} isDemo={vm.isDemo} />
        </section>
      </div>
    </div>
  )
}
