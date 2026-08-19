import { useConcept } from '../../useConcept'
import { InvestigationFilters } from '../../domain/InvestigationFilters'
import { EventList } from '../../domain/EventList'
import { EventDetails } from '../../domain/EventDetails'
import { RadarPlot } from '../../domain/RadarPlot'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Adapts a persisted event's raw radar snapshot (snake_case API fields) into
// the shape RadarPlot expects — same field mapping EventDetails uses inline.
function replayRadar(event) {
  const targets = Array.isArray(event?.radar?.targets) ? event.radar.targets : []
  return {
    connected: true,
    status: event?.radar?.radar_status || 'OK',
    targets: targets.map((target, index) => ({
      id: target.id ?? target.radar_id ?? index,
      xMm: Number(target.x_mm) || 0,
      yMm: Number(target.y_mm) || 0,
      risk: Number(target.radar_risk) || 0,
    })),
  }
}

// Sentinel: spatial replay — the event list feeds a top-down site plot of
// the target's recorded position, next to the full evidence panel.
export default function SentinelInvestigation({ vm }) {
  const { t } = useConcept()
  const replay = replayRadar(vm.selected)

  return (
    <div className="s32-page s32-invest">
      <header className="s32-head">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <p className="s32-eyebrow" dir="ltr">SPATIAL REPLAY</p>
          <h1 className="s32-title">{t('Investigation Room', 'חדר חקירה')}</h1>
        </div>
      </header>

      <section className="s32-card" aria-label={t('Filters', 'סינון')}>
        <InvestigationFilters filters={vm.filters} />
      </section>

      {vm.status === 'error' ? (
        <p className="dm-feedback is-err" dir="ltr">{t('Event store unreachable.', 'מאגר האירועים לא נגיש.')}</p>
      ) : null}

      <div className="s32-invest-layout">
        <section className="s32-card s32-invest-list" aria-label={t('Events', 'אירועים')}>
          <EventList events={vm.filtered} selectedId={vm.selectedId} onSelect={vm.setSelectedId} variant="list" />
        </section>

        <div className="s32-invest-replay">
          <section className="s32-card s32-replay-stage" aria-label={t('Site replay', 'שחזור אתר')}>
            <span className="s32-hud-title" dir="ltr">SITE REPLAY</span>
            {vm.selected ? (
              <RadarPlot radar={replay} variant="grid" />
            ) : (
              <p className="dm-empty">{t('Select an event to replay its recorded position.', 'בחרו אירוע לשחזור המיקום שנרשם.')}</p>
            )}
          </section>
          <section className="s32-card" aria-label={t('Event details', 'פרטי אירוע')}>
            <EventDetails event={vm.selected} isDemo={vm.isDemo} />
          </section>
        </div>
      </div>
    </div>
  )
}
