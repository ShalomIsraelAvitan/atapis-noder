import { useConcept } from '../../useConcept'
import { areaName } from '../areas.js'

// A new DANGER while the operator is working another incident.
//
// The screen does NOT move. Losing the context somebody is mid-investigation on,
// because a different zone escalated, is how an operator loses both incidents.
// The alert rises to the top of the list, this notice appears, and the switch
// happens only when the operator asks for it.
//
// This notice is visual. `aria-live="assertive"` is what makes it reach a
// screen-reader user without stealing focus. Since Phase A3 a matching audio cue
// may also fire, but that is decided independently in useOperationalAudio.js —
// this component neither plays nor knows about sound.

function clockLabel(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString('en-GB')
}

export function NewDangerNotice({ alert, area, count, onGo }) {
  const { t, lang } = useConcept()
  if (!alert) return null

  return (
    <div className="io2-danger-notice" role="alert" aria-live="assertive">
      <span className="io2-danger-tag" dir="ltr">DANGER</span>
      <span className="io2-danger-body">
        <span className="io2-danger-area">{area ? areaName(area, lang) : alert.areaId}</span>
        <span className="io2-danger-sep">·</span>
        <bdi dir="ltr" className="io2-val">{clockLabel(alert.firstSeenAt)}</bdi>
        <span className="io2-danger-sep">·</span>
        <span className="io2-danger-msg">{lang === 'he' ? alert.messageHe : alert.message}</span>
        {count > 1 ? (
          <span className="io2-danger-more">+{count - 1}</span>
        ) : null}
      </span>
      <button type="button" className="io2-danger-go" onClick={onGo}>
        {t('GO TO DANGER', 'עבור להתראה')}
      </button>
    </div>
  )
}
