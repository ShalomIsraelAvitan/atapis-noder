// [ OPERATIONAL ACTIONS ] — the primary path for acting on an alert (Phase A2).
//
// Why the actions live HERE and not on the alert row:
//
//   Putting buttons in the row would make the row grow when it is selected, and
//   a list where picking an item pushes everything below it down is a list an
//   operator cannot aim at. Phase A1.1 also spent the screen's remaining height
//   budget; a per-row action strip would spend it again, several times over.
//   So the row stays exactly what it was, and the selected alert gets one fixed
//   bar directly under the decision band.
//
// This component performs no lifecycle logic. It renders the actions the engine
// says are legal and calls back with an action id — the transition rules live in
// alerts.js and nowhere else.
//
// Height: the bar keeps a stable minimum so the screen does not jump between
// "nothing selected" and "an alert selected", and is allowed to grow to the
// approved ceiling on narrow viewports rather than shrink its type.

import { useConcept } from '../../useConcept'
import { AlertIdentity } from './alertPresentation.jsx'
import { ACTION_LABEL, pickLabel } from './alertLabels.js'

export function OperationalActionBar({
  alert,
  area,
  legalActions = [],
  outsideFilter = false,
  onAction,
  onShowAlert,
}) {
  const { t, lang } = useConcept()

  if (!alert) {
    return (
      <section className="io2-actionbar io2-actionbar--empty" aria-label={t('Operational actions', 'פעולות מבצעיות')}>
        <h2 className="io2-ab-title">[ {t('OPERATIONAL ACTIONS', 'פעולות מבצעיות')} ]</h2>
        <p className="io2-ab-empty">
          <span className="io2-ab-empty-title">{t('NO ALERT SELECTED', 'לא נבחרה התראה')}</span>
          <span className="io2-ab-empty-hint">
            {t('Select an alert to begin operational handling.',
              'בחר התראה כדי להתחיל טיפול מבצעי.')}
          </span>
        </p>
      </section>
    )
  }

  return (
    <section className="io2-actionbar" aria-label={t('Operational actions', 'פעולות מבצעיות')}>
      <h2 className="io2-ab-title">[ {t('OPERATIONAL ACTIONS', 'פעולות מבצעיות')} ]</h2>

      <div className="io2-ab-identity">
        <AlertIdentity alert={alert} area={area} t={t} lang={lang} />
      </div>

      {outsideFilter ? (
        <span className="io2-ab-outside">
          <span className="io2-ab-outside-tag">
            {t('OUTSIDE CURRENT FILTER', 'מחוץ למסנן הנוכחי')}
          </span>
          <button type="button" className="io2-ab-show" onClick={onShowAlert}>
            {t('SHOW ALERT', 'הצג התראה')}
          </button>
        </span>
      ) : null}

      {/* Stated on every render, never on success only: this workflow is stored
          in this browser tab and nowhere else. */}
      <span className="io2-ab-local" title={t(
        'This workflow state is stored only in this browser tab session.',
        'מצב הטיפול נשמר בלשונית הדפדפן הזאת בלבד.'
      )}>
        <bdi dir="ltr">SESSION-LOCAL · NOT SERVER-PERSISTED</bdi>
      </span>

      <div className="io2-ab-actions">
        {legalActions.map((action) => (
          <button
            key={action}
            type="button"
            className={`io2-ab-btn io2-ab-btn--${action}`}
            data-io2-action={action}
            onClick={() => onAction(action, alert.id)}
          >
            {pickLabel(ACTION_LABEL, action, lang)}
          </button>
        ))}
      </div>
    </section>
  )
}
