import { riskTone } from '../../../design-lab/shared/adapter'
import { useConcept } from '../../useConcept'
import { UNCALIBRATED_TITLE } from '../reasons.js'

// Camera tracks, reduced to the command-centre decision:
// Track ID · Behaviour · Weapon · Risk.
//
// Deliberately absent:
//   - px/s. Image-space speed is not ground speed, and there is no calibration
//     to convert it. It belongs on the investigation screen, not in a decision.
//   - the behaviour `zone`. This table is already scoped to the selected area,
//     so a second, unrelated notion of "zone" from the vision engine would read
//     as a location claim it cannot support.
//   - any camera id. Tracks carry none, and the backend never says which camera
//     produced one, so there is nothing honest to filter or label by.
//
// Local table rather than a prop on the shared domain/TracksTable, so the four
// other concepts cannot be affected at all.

export function OpsTracksTable({ snapshot, scrollProps = null }) {
  const { t, lang } = useConcept()
  const cameraUp = snapshot.cameras.webcam.connected || snapshot.cameras.dahua.connected

  if (!snapshot.tracks.length) {
    return (
      <p className="dm-empty" dir="ltr">
        {cameraUp || snapshot.hasPerson
          ? t('No tracked persons', 'אין אנשים במעקב')
          : t('Camera disconnected', 'מצלמה מנותקת')}
      </p>
    )
  }

  return (
    <div className="dm-table-scroll" {...(scrollProps || {})}>
      <table className="dm-table" dir="ltr" style={{ '--dm-cols': 4 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>{t('Behavior', 'התנהגות')}</th>
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
                {/* The engine's approach flag is measured against an uncalibrated
                    image-space point, so it is never printed as a surveyed gate. */}
                {track.approachingGate ? (
                  <span className="io2-uncal" title={UNCALIBRATED_TITLE[lang === 'he' ? 'he' : 'en']}>
                    {t('REF · UNCAL', 'ייחוס · ללא כיול')}
                  </span>
                ) : null}
              </td>
              <td className={track.hasWeapon ? 'dm-tone-danger' : ''}>
                {track.hasWeapon ? t('Yes', 'כן') : t('No', 'לא')}
              </td>
              <td className={`dm-tone-${riskTone(track.risk)}`}>{track.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
