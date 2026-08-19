import { useConcept } from '../../useConcept'

// The one audio control in the console (Phase A3).
//
// It says what is actually true, which matters more than looking tidy: a browser
// that has not yet allowed audio reads BLOCKED, never READY, and pressing the
// control is the user gesture that can change that. The four states are carried
// by the text itself, not by colour alone — an operator who cannot distinguish
// amber from green still has to be able to tell a muted console from a live one.
//
// It lives inside the SYS MODE cluster rather than in a strip cell of its own:
// below 1500px the strip becomes a seven-column grid whose row arithmetic
// depends on the child count, so a thirteenth child would cost a row of height
// the layout budget does not have.

const LABELS = {
  READY: { en: 'READY', he: 'פעיל' },
  MUTED: { en: 'MUTED', he: 'מושתק' },
  BLOCKED: { en: 'BLOCKED', he: 'חסום' },
  ERROR: { en: 'ERROR', he: 'שגיאה' },
}

const TITLES = {
  READY: ['Alert sounds are on — click to mute', 'התראות קוליות פעילות — לחיצה להשתקה'],
  MUTED: ['Alert sounds are muted — click to unmute', 'התראות קוליות מושתקות — לחיצה להפעלה'],
  BLOCKED: [
    'The browser has not allowed audio yet — click to enable',
    'הדפדפן טרם איפשר צליל — לחיצה להפעלה',
  ],
  ERROR: [
    'Audio is unavailable in this browser — alerts remain visual',
    'הצליל אינו זמין בדפדפן זה — ההתראות נשארות חזותיות',
  ],
}

export function SoundControl({ state, muted, onToggle }) {
  const { t, lang } = useConcept()
  const key = LABELS[state] ? state : 'ERROR'
  const label = LABELS[key]
  const title = t(TITLES[key][0], TITLES[key][1])

  return (
    <button
      type="button"
      className={`io2-sound io2-sound--${key.toLowerCase()}`}
      // Pressed = muted: the toggle's "on" position is the operator having
      // silenced the console, which is the state worth announcing.
      aria-pressed={Boolean(muted)}
      aria-label={t(`Alert sound: ${label.en}`, `צליל התראה: ${label.he}`)}
      title={title}
      onClick={onToggle}
      data-io2-sound-state={key}
    >
      {/* The tag is a strip label like SYS MODE or FUSED RISK beside it, so it
          reuses that class rather than declaring a second micro-type size. */}
      <span className="io2-strip-label" dir="ltr">SND</span>
      <span className="io2-sound-val">
        <bdi dir={lang === 'he' ? 'rtl' : 'ltr'}>{lang === 'he' ? label.he : label.en}</bdi>
      </span>
    </button>
  )
}
