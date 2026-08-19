import { useState } from 'react'
import { useConcept } from '../../useConcept'
import { RiskTimelineChart } from '../../domain/RiskTimelineChart'
import { InvestigationFilters } from '../../domain/InvestigationFilters'
import { EventTimeline } from '../../domain/EventTimeline'
import { EventDetails } from '../../domain/EventDetails'
import { ConfirmDialog } from '../../domain/ConfirmDialog'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Writes out the fields already loaded for this event. Local export of local
// data — the backend has no report endpoint, so it is labeled as an export,
// not as a generated report.
function exportEvent(event) {
  const blob = new Blob([JSON.stringify(event, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `atapis-event-${event.id}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// Prime investigation: recorded-events risk timeline on top (real persisted
// data), filters, then Minimal's split list/details — plus real actions:
// reload and Clear History behind a full ConfirmDialog (actual DELETE).
export default function PrimeInvestigation({ vm }) {
  const { t } = useConcept()
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const requestClear = () => {
    setConfirm({
      title: 'Clear event history',
      titleHe: 'ניקוי היסטוריית אירועים',
      body: `This permanently deletes all ${vm.stats.total} recorded detections and their evidence snapshots from the server. This cannot be undone.`,
      bodyHe: `פעולה זו מוחקת לצמיתות את כל ${vm.stats.total} הזיהויים שנרשמו ואת תמונות הראיה שלהם מהשרת. לא ניתן לשחזר.`,
      confirmLabel: 'Delete all events',
      confirmLabelHe: 'מחיקת כל האירועים',
      danger: true,
      onConfirm: async () => {
        setBusy(true)
        const result = await vm.clearHistory()
        setBusy(false)
        setConfirm(null)
        setFeedback(
          result.success
            ? { ok: true, message: t('History cleared.', 'ההיסטוריה נוקתה.') }
            : { ok: false, message: result.error || t('Clear failed.', 'הניקוי נכשל.') }
        )
      },
    })
  }

  return (
    <div className="pp-page pp-invest">
      <header className="pp-head">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <p className="pp-eyebrow" dir="ltr">INVESTIGATION</p>
          <h1 className="pp-title">{t('Investigation Room', 'חדר חקירה')}</h1>
        </div>
        <div className="pp-actions">
          <button type="button" className="dm-btn" onClick={vm.reload}>{t('Reload', 'רענון')}</button>
          <button
            type="button"
            className="dm-btn dm-btn--danger"
            onClick={requestClear}
            disabled={vm.isDemo || !vm.stats.total}
          >
            {t('Clear history', 'ניקוי היסטוריה')}
          </button>
        </div>
      </header>

      <section className="pp-card" aria-label={t('Risk over recorded events', 'סיכון על פני אירועים')}>
        <RiskTimelineChart samples={vm.riskSeries} scope="events" />
      </section>

      <section className="pp-card" aria-label={t('Filters', 'סינון')}>
        <InvestigationFilters filters={vm.filters} />
      </section>

      {feedback ? (
        <p className={`dm-feedback ${feedback.ok ? 'is-ok' : 'is-err'}`} role="status">{feedback.message}</p>
      ) : null}
      {vm.status === 'error' ? (
        <p className="dm-feedback is-err" dir="ltr">{t('Event store unreachable.', 'מאגר האירועים לא נגיש.')}</p>
      ) : null}

      <div className="pp-invest-layout">
        <section className="pp-card pp-invest-list" aria-label={t('Events', 'אירועים')}>
          <EventTimeline
            events={vm.filtered}
            selectedId={vm.selectedId}
            onSelect={(event) => vm.setSelectedId(event.id)}
          />
        </section>
        <section className="pp-card pp-invest-detail" aria-label={t('Evidence', 'ראיות')}>
          <div className="pp-card-head">
            <h2 className="dm-subtitle">{t('Event record', 'רשומת אירוע')}</h2>
            {vm.selected ? (
              <button type="button" className="dm-btn" onClick={() => exportEvent(vm.selected)}>
                {t('Export event', 'ייצוא אירוע')}
              </button>
            ) : null}
          </div>
          <EventDetails event={vm.selected} isDemo={vm.isDemo} showSourceTabs />
        </section>
      </div>

      <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} busy={busy} />
    </div>
  )
}
