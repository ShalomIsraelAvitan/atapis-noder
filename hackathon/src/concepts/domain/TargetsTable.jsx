import { riskTone, formatDistance, formatSpeed } from '../../design-lab/shared/adapter'
import { useConcept } from '../useConcept'

// Active radar targets. variant: 'table' (dense) | 'cards' (airier).
//
// Opt-in header overrides (defaults reproduce the original output exactly, so
// every other concept renders unchanged):
//   closingHeader  — rename the approaching_gate column. The backend flag means
//                    "closing on the RADAR SENSOR, within ±45deg, under ~6 m"
//                    (ld2450_reader.py::_parse_binary_frame); it involves no gate
//                    coordinate and no calibration, so a concept that refuses to
//                    imply one can relabel it.
//   confHeader     — spell out that Conf is radar DETECTION confidence, never an
//                    association confidence.
export function TargetsTable({
  radar,
  selectedId = null,
  onSelect,
  variant = 'table',
  className = '',
  closingHeader = null,
  confHeader = null,
  scrollProps = null,
  directionHeader = null,
}) {
  const { t } = useConcept()

  if (!radar.targets.length) {
    return (
      <p className={`dm-empty ${className}`} dir="ltr">
        {radar.connected ? t('No active targets', 'אין מטרות פעילות') : `RADAR ${radar.status}`}
      </p>
    )
  }

  if (variant === 'cards') {
    return (
      <ul className={`dm-targets-cards ${className}`} dir="ltr">
        {radar.targets.map((target) => (
          <li key={target.id}>
            <button
              type="button"
              className={`dm-target-card ${selectedId === target.id ? 'is-selected' : ''}`}
              onClick={onSelect ? () => onSelect(target.id) : undefined}
              disabled={!onSelect}
            >
              <span className={`dm-target-id dm-tone-${riskTone(target.risk)}`}>T{target.id}</span>
              <span>{formatDistance(target.distanceMm)}</span>
              <span>{formatSpeed(target.speedCmS)}</span>
              <span className="dm-target-dir">{target.direction}</span>
              <span className={`dm-tone-${riskTone(target.risk)}`}>{target.risk}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className={`dm-table-scroll ${className}`} {...(scrollProps || {})}>
      <table className="dm-table" dir="ltr" style={{ '--dm-cols': 8 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>{t('Distance', 'מרחק')}</th>
            <th>{t('Speed', 'מהירות')}</th>
            <th>{t('Angle', 'זווית')}</th>
            <th title={directionHeader ? 'Raw radar radial motion direction, as reported per target.' : undefined}>
              {directionHeader || t('Direction', 'כיוון')}
            </th>
            <th title={closingHeader ? 'Radar-only filtered condition: target closing toward the radar sensor, within the configured angle and range. Not a gate association.' : undefined}>
              {closingHeader || t('Gate', 'שער')}
            </th>
            <th title={confHeader ? 'Radar detection confidence, per target. Not an association confidence.' : undefined}>
              {confHeader || 'Conf'}
            </th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {radar.targets.map((target) => (
            <tr
              key={target.id}
              className={selectedId === target.id ? 'is-selected' : ''}
              onClick={onSelect ? () => onSelect(target.id) : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onKeyDown={onSelect ? (e) => { if (e.key === 'Enter') onSelect(target.id) } : undefined}
            >
              <td>T{target.id}</td>
              <td>{formatDistance(target.distanceMm)}</td>
              <td>{formatSpeed(target.speedCmS)}</td>
              <td>{Math.round(target.angleDeg)}°</td>
              <td>{target.direction}</td>
              <td>{target.approachingGate ? <span className="dm-tone-alert">{closingHeader ? 'YES' : 'APPR'}</span> : '—'}</td>
              <td>{Math.round((target.confidence || 0) * 100)}%</td>
              <td className={`dm-tone-${riskTone(target.risk)}`}>{target.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
