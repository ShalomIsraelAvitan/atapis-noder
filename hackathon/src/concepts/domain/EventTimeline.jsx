import { useConcept } from '../useConcept'
import { riskTone } from '../../design-lab/shared/adapter'

// Vertical (or horizontal) event timeline over adaptDetection() items.
//
// IMPORTANT: this component intentionally has NO internal max-height / overflow.
// The hosting panel owns scrolling — adding a scroller here would create a
// fourth nested scroll context (the concepts already have scroll-in-scroll
// traps we are trying to relieve, not add to).
export function EventTimeline({ events, selectedId, onSelect, limit = null, variant = 'vertical', className = '' }) {
  const { t } = useConcept()
  const list = limit ? events.slice(0, limit) : events

  if (!list.length) {
    return <p className="dm-empty">{t('No events recorded.', 'לא נרשמו אירועים.')}</p>
  }

  // Group by day so a long list reads as a diary, not an undifferentiated run.
  const days = []
  for (const event of list) {
    const label = event.dateLabel || '—'
    let bucket = days.find((d) => d.label === label)
    if (!bucket) {
      bucket = { label, items: [] }
      days.push(bucket)
    }
    bucket.items.push(event)
  }

  return (
    <div className={`dm-timeline dm-timeline--${variant} ${className}`}>
      {days.map((day) => (
        <section key={day.label} className="dm-timeline-day">
          <h4 className="dm-timeline-daylabel" dir="ltr">{day.label}</h4>
          <ol className="dm-timeline-track">
            {day.items.map((event) => {
              const active = selectedId != null && event.id === selectedId
              const Tag = onSelect ? 'button' : 'div'
              return (
                <li key={event.id} className={`dm-timeline-item ${active ? 'is-selected' : ''}`}>
                  <Tag
                    type={onSelect ? 'button' : undefined}
                    className="dm-timeline-node"
                    onClick={onSelect ? () => onSelect(event) : undefined}
                    aria-pressed={onSelect ? active : undefined}
                  >
                    <span className={`dm-timeline-dot dm-timeline-dot--${riskTone(event.fusedRisk)}`} aria-hidden="true" />
                    <span className="dm-timeline-time" dir="ltr">{event.timeLabel}</span>
                    <span className="dm-timeline-label">
                      {event.mode}
                      {event.context ? ` · ${event.context}` : ''}
                      {event.hasWeapon ? ` · ${t('weapon', 'נשק')}` : ''}
                    </span>
                    <span className={`dm-timeline-risk dm-tone-${riskTone(event.fusedRisk)}`} dir="ltr">
                      {event.fusedRisk}
                    </span>
                  </Tag>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
