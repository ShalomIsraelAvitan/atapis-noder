import { StatusDot } from '../../design-lab/shared/status-primitives'
import { useConcept } from '../useConcept'
import { connectionRows } from '../data/connectionRows'

// One combined connection + sensor panel. Lets a concept collapse the separate
// StatusBoard and SensorHealth panels into a single card (this directly relieves
// Industrial's "four scrollbars in one panel" problem). StatusBoard and
// SensorHealth are kept as-is — five views still import them. The pure row
// builder lives in ../data/connectionRows.
export function ConnectionHealth({ snapshot, backendStatus, sensor, variant = 'list', className = '' }) {
  const { t } = useConcept()
  const rows = connectionRows(snapshot, backendStatus, sensor, t)
  return (
    <ul className={`dm-conn dm-conn--${variant} ${className}`}>
      {rows.map((row) => (
        <li key={row.key} className="dm-conn-row">
          <StatusDot state={row.state} label={row.label} />
          <span className="dm-conn-detail" dir="ltr">{row.detail}</span>
        </li>
      ))}
      {snapshot.radar.lastError ? (
        <li className="dm-conn-row dm-conn-row--error">
          <span className="dm-conn-label">{t('Radar error', 'שגיאת רדאר')}</span>
          <span className="dm-conn-detail" dir="ltr">{snapshot.radar.lastError}</span>
        </li>
      ) : null}
    </ul>
  )
}
