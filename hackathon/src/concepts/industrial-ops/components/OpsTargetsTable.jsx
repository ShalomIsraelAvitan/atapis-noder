import { riskTone, formatDistance } from '../../../design-lab/shared/adapter'
import { useConcept } from '../../useConcept'

// Radar targets, reduced to what a command-centre decision actually needs:
// ID · Distance · Radial direction · Closing · Risk.
//
// Angle and detection confidence are NOT deleted from the system — they are
// still in the payload and still belong on the optical/investigation screen.
// They are simply not part of the first decision, and a denser table is a table
// nobody reads under load.
//
// This is a LOCAL table rather than a `columns` prop on the shared
// domain/TargetsTable: the shared component feeds four other concepts, and not
// touching it is a stronger no-regression guarantee than any default value.
//
// CLOSING keeps its Patch-01 meaning: the target is closing on the RADAR SENSOR,
// inside the configured cone and range. There is no gate in that computation and
// no camera-radar calibration in the system, so the tooltip says so.

const CLOSING_TITLE = {
  en: 'Radar-only: closing on the radar sensor, within the configured angle and range. Not a gate — no gate calibration exists.',
  he: 'רדאר בלבד: סגירת מרחק אל חיישן הרדאר, בתוך הזווית והטווח המוגדרים. לא שער — אין במערכת כיול שער.',
}

export function OpsTargetsTable({ radar, scrollProps = null }) {
  const { t, lang } = useConcept()

  if (!radar?.targets?.length) {
    return (
      <p className="dm-empty" dir="ltr">
        {radar?.connected ? t('No active targets', 'אין מטרות פעילות') : `RADAR ${radar?.status || 'UNKNOWN'}`}
      </p>
    )
  }

  return (
    <div className="dm-table-scroll" {...(scrollProps || {})}>
      <table className="dm-table" dir="ltr" style={{ '--dm-cols': 5 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>{t('Distance', 'מרחק')}</th>
            <th title="Raw radar radial motion direction, as reported per target.">
              {t('RADIAL DIR', 'כיוון רדיאלי')}
            </th>
            <th title={CLOSING_TITLE[lang === 'he' ? 'he' : 'en']}>CLOSING</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {radar.targets.map((target) => (
            <tr key={target.id}>
              <td>T{target.id}</td>
              <td>{formatDistance(target.distanceMm)}</td>
              <td>{target.direction}</td>
              <td>{target.approachingGate ? <span className="dm-tone-alert">YES</span> : '—'}</td>
              <td className={`dm-tone-${riskTone(target.risk)}`}>{target.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
