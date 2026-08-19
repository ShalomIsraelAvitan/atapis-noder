import { riskTone } from '../../design-lab/shared/adapter'
import { useConcept } from '../useConcept'

// Investigation event list. variant: 'list' | 'table' | 'timeline'.
export function EventList({ events, selectedId, onSelect, variant = 'list', limit = 200, className = '' }) {
  const { t } = useConcept()
  const shown = events.slice(0, limit)

  if (!events.length) {
    return <p className={`dm-empty ${className}`}>{t('No events match the current filters.', 'אין אירועים התואמים לסינון הנוכחי.')}</p>
  }

  if (variant === 'table') {
    return (
      <div className={`dm-table-scroll dm-events-table ${className}`}>
        <table className="dm-table" dir="ltr" style={{ '--dm-cols': 10 }}>
          <thead>
            <tr>
              <th>{t('Time', 'זמן')}</th>
              <th>{t('Mode', 'מצב')}</th>
              <th>{t('Context', 'הקשר')}</th>
              <th>{t('Motion', 'תנועה')}</th>
              <th>{t('Persons', 'אנשים')}</th>
              <th>{t('Weapon', 'נשק')}</th>
              <th>{t('Source', 'מקור')}</th>
              <th>Cam</th>
              <th>Rdr</th>
              <th>Fused</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((event) => (
              <tr
                key={event.id}
                className={selectedId === event.id ? 'is-selected' : ''}
                onClick={() => onSelect(event.id)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelect(event.id) }}
              >
                <td>{event.dateLabel} {event.timeLabel}</td>
                <td className={`dm-tone-${riskTone(event.fusedRisk)}`}>{event.mode}</td>
                <td>{event.context || '—'}</td>
                <td>{event.motion || '—'}</td>
                <td>{event.personCount}</td>
                <td className={event.hasWeapon ? 'dm-tone-danger' : ''}>{event.hasWeapon ? 'YES' : '—'}</td>
                <td>{event.source}</td>
                <td>{event.cameraRisk}</td>
                <td>{event.radarRisk}</td>
                <td className={`dm-tone-${riskTone(event.fusedRisk)}`}>{event.fusedRisk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <ol className={`dm-events dm-events--${variant} ${className}`}>
      {shown.map((event) => (
        <li key={event.id}>
          <button
            type="button"
            className={`dm-event ${selectedId === event.id ? 'is-selected' : ''}`}
            onClick={() => onSelect(event.id)}
          >
            <span className="dm-event-time" dir="ltr">{event.dateLabel} · {event.timeLabel}</span>
            <span className={`dm-event-mode dm-tone-${riskTone(event.fusedRisk)}`} dir="ltr">{event.mode}</span>
            <span className="dm-event-desc" dir="ltr">
              {event.context || event.motion || '—'}
              {event.hasWeapon ? ' · WEAPON' : ''}
            </span>
            <span className="dm-event-risk" dir="ltr">{event.fusedRisk}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
