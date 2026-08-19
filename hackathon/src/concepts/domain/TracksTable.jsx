import { riskTone } from '../../design-lab/shared/adapter'
import { useConcept } from '../useConcept'

// Tracked persons (camera pipeline) with behavior states.
// Speed stays in px/s: there is no calibration to convert image motion to ground
// speed, so a m/s column here would be fabricated.
// scrollProps is opt-in (default null → markup identical for every other concept).
// uncalibratedRefNote (opt-in, default null): marks a track whose
// `approaching_gate` flag comes from the uncalibrated image-space GATE_POINT, so
// a concept can avoid presenting it as a surveyed gate. { label, title }.
export function TracksTable({ snapshot, className = '', scrollProps = null, uncalibratedRefNote = null }) {
  const { t } = useConcept()
  const camera = snapshot.cameras.webcam.connected || snapshot.cameras.dahua.connected

  if (!snapshot.tracks.length) {
    return (
      <p className={`dm-empty ${className}`} dir="ltr">
        {camera || snapshot.hasPerson
          ? t('No tracked persons', 'אין אנשים במעקב')
          : t('Camera disconnected', 'מצלמה מנותקת')}
      </p>
    )
  }

  return (
    <div className={`dm-table-scroll ${className}`} {...(scrollProps || {})}>
      <table className="dm-table" dir="ltr" style={{ '--dm-cols': 6 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>{t('Behavior', 'התנהגות')}</th>
            <th>{t('Speed px/s', 'מהירות px/s')}</th>
            <th>{t('Zone', 'אזור')}</th>
            <th>{t('Weapon', 'נשק')}</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.tracks.map((track) => (
            <tr key={track.id}>
              <td>#{track.id}</td>
              <td className={track.hasWeapon ? 'dm-tone-danger' : ''}>
                {track.state}
                {uncalibratedRefNote && track.approachingGate ? (
                  <span className="io2-uncal" title={uncalibratedRefNote.title}>{uncalibratedRefNote.label}</span>
                ) : null}
              </td>
              <td>{Math.round(track.speed)}</td>
              <td>{track.zone || '—'}</td>
              <td className={track.hasWeapon ? 'dm-tone-danger' : ''}>{track.hasWeapon ? t('Yes', 'כן') : t('No', 'לא')}</td>
              <td className={`dm-tone-${riskTone(track.risk)}`}>{track.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
