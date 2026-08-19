// [ SELECTED ALERT ] — the operator's actions, inside the alerts panel (A3.1.1).
//
// Phase A2 put these controls in a full-width bar under the decision band. That
// bar was correct about one thing and wrong about another. It was right that the
// actions must NOT live in the alert row: a row that grows when it is selected
// pushes every row below it down, and a list where picking an item moves the
// list is a list an operator cannot aim at. It was wrong to be a separate strip
// across the page — together with the decision band above it, the operator had
// to scroll past several hundred pixels of summary before reaching the feed.
//
// So the controls move INTO the panel they act on, as a fixed region between the
// filters and the list. The alert row is still untouched (§14 of A3.1.1), and
// the actions are still rendered exactly once, for the selected alert only.
//
// This component performs no lifecycle logic. It renders the actions the engine
// declared legal and calls back with an action id — every transition rule lives
// in alerts.js and nowhere else.
//
// What it deliberately does NOT repeat: the area, the source, the track/target
// id and the message. All four are on the selected row itself, one line away.
// Duplicating them here would spend the panel's height saying twice what it
// already says once, in the narrowest column on the screen.
//
// PHASE A3.2 — CONDITION STATE IS GONE FROM THIS BOX, AND ONLY FROM THIS BOX.
//
// The chip that printed CONDITION ACTIVE / CONDITION CLEARED here was removed by
// §60. `alert.active` and `alert.clearedAt` are untouched in the model, and every
// consumer of them still works exactly as before (§61): area severity is computed
// from conditions that still hold, the resolve dialog still warns when the source
// condition is active, the CLEARED filter still filters, and the A0 four-axis
// model is unchanged. This is a presentation removal — nothing downstream of it
// learned anything new.
//
// Two secondary actions arrived in its place. Both are deliberately styled below
// the lifecycle actions in the visual order (§67): OPTICAL is navigation and
// NOTES is history, and neither is a step in handling the alert.

import { useConcept } from '../../useConcept'
import { ACTION_LABEL, lifecycleLabel, pickLabel, severityLabel } from './alertLabels.js'

/** An identifier, isolated so RTL text cannot reverse it. */
function Val({ children, title }) {
  return <bdi dir="ltr" className="io2-val" title={title}>{children}</bdi>
}

export function SelectedAlertActions({
  alert,
  legalActions = [],
  outsideFilter = false,
  onAction,
  onShowAlert,
  optical = null,
  onOptical,
  // Whether the resolve record exists to be read. Passed in as a boolean rather
  // than derived here from `alert.lifecycle`, so this component still imports
  // nothing from the alert engine and cannot form an opinion about lifecycle —
  // the Phase A2 rule that keeps every transition decision in one place.
  canShowNotes = false,
  onNotes,
}) {
  const { t, lang } = useConcept()

  // The region keeps its place whether or not something is selected, so the
  // filters above it and the list below it never move when the operator picks
  // an alert. Same reasoning as the row height rule, one level up.
  if (!alert) {
    return (
      <section className="io2-sel-actions io2-sel-actions--empty" aria-label={t('Selected alert', 'התראה נבחרת')}>
        <h3 className="io2-sel-title" dir="ltr">[ {t('SELECTED ALERT', 'התראה נבחרת')} ]</h3>
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
    <section className="io2-sel-actions" aria-label={t('Selected alert', 'התראה נבחרת')}>
      <div className="io2-sel-head">
        <h3 className="io2-sel-title" dir="ltr">[ {t('SELECTED ALERT', 'התראה נבחרת')} ]</h3>
        {/* Stated on every render, never on success only: this workflow is held
            in this browser tab and nowhere else. Compact here rather than a bar
            of its own — the wording is unabbreviated in the panel caption. */}
        <span className="io2-ab-local" title={t(
          'This workflow state is stored only in this browser tab session.',
          'מצב הטיפול נשמר בלשונית הדפדפן הזאת בלבד.'
        )}>
          <bdi dir="ltr">SESSION-LOCAL</bdi>
        </span>
      </div>

      {/* Severity, id and lifecycle. The CONDITION chip that used to complete
          this row was removed by A3.2 §60 — see the file header. The condition
          axis itself is unchanged and is still stated where it changes a
          decision: the resolve dialog warns when the source condition is still
          active, and the CLEARED filter still selects on it. */}
      <div className="io2-ab-identity io2-sel-identity">
        <span className={`io2-ab-sev io2-ab-sev--${alert.severity}`} dir="ltr">
          {severityLabel(alert, t)}
        </span>
        <span className="io2-ab-id" title={alert.id} aria-label={`Alert ID ${alert.id}`}>
          <Val>{alert.id}</Val>
        </span>
        <span className={`io2-ab-life io2-ab-life--${String(alert.lifecycle).toLowerCase()}`}>
          {lifecycleLabel(alert, lang)}
        </span>
        {alert.owner?.name ? (
          <span className="io2-ab-owner">
            {t('SESSION OWNER', 'בעלות בסשן')} <Val>{alert.owner.name}</Val>
          </span>
        ) : null}
      </div>

      {/* An operator's own action can push the alert they are working on out of
          the filtered list. The selection deliberately stays put, so the panel
          has to say why the row vanished instead of letting it look lost. */}
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

      <div className="io2-ab-actions io2-sel-buttons">
        {/* Lifecycle actions first (§67): these are the operator's job. */}
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

        {/* OPTICAL — navigation, not a lifecycle step.
            `disabled` is the real HTML attribute: it cannot be clicked, it is not
            in the tab order, and nothing here turns it back into an action (§34).

            The explanation is carried by a plain <span> AROUND the button rather
            than on the button itself. A disabled control receives no pointer
            events, so its own `title` never opens — the wrapper is the element
            the pointer actually reaches. It is exactly what §69 allows and
            nothing more: no onClick, no role, no tabIndex, no href. It cannot be
            activated by any means. The same sentence is also given to assistive
            technology through `aria-describedby`, since a tooltip is not an
            accessible name. */}
        {optical ? (
          <span
            className="io2-ab-btnwrap"
            title={optical.enabled
              ? t(`Open the optical station on ${optical.cameraId}`,
                  `פתח את העמדה האופטית במצלמה ${optical.cameraId}`)
              : t('CAMERA SOURCE NOT IDENTIFIED FOR THIS ALERT',
                  'מקור המצלמה של התראה זו לא זוהה')}
          >
            {/* `data-io2-secondary`, NOT `data-io2-action`. That attribute marks
                the LIFECYCLE actions the engine declared legal, and several
                checks read every one of them to assert what a given lifecycle
                offers. OPTICAL moves the operator to another screen and NOTES
                opens a record — neither is a transition, and tagging them as one
                would make those checks quietly wrong. */}
            <button
              type="button"
              className="io2-ab-btn io2-ab-btn--secondary io2-ab-btn--optical"
              data-io2-secondary="optical"
              data-io2-optical-enabled={optical.enabled ? 'true' : 'false'}
              data-io2-optical-reason={optical.reason || ''}
              disabled={!optical.enabled}
              aria-describedby={optical.enabled ? undefined : 'io2-optical-why'}
              onClick={() => { if (optical.enabled) onOptical?.(optical) }}
            >
              {t('OPTICAL', 'אופטי')}
            </button>
          </span>
        ) : null}

        {/* NOTES — only once there is something to read (§49). Before RESOLVED
            there is no reason and no note, so the button would open an empty
            dialog and imply the fields exist. The RESOLVED test itself is made
            by the caller; see `canShowNotes` above. */}
        {canShowNotes ? (
          <button
            type="button"
            className="io2-ab-btn io2-ab-btn--secondary io2-ab-btn--notes"
            data-io2-secondary="notes"
            onClick={() => onNotes?.(alert.id)}
          >
            {t('NOTES', 'הערות')}
          </button>
        ) : null}
      </div>

      {/* The same sentence for assistive technology, referenced by the button's
          aria-describedby. Visually hidden rather than laid out: the region has
          one fixed clipped height (§64 / A3.1.1 §15), and a two-line explanation
          that appears and disappears with the selection would either push the
          buttons out of the box or force it to grow with the lifecycle — which
          §64 forbids outright. Sighted operators get the identical wording from
          the wrapper's tooltip. */}
      {optical && !optical.enabled ? (
        <span id="io2-optical-why" className="io2-sr-only">
          {t('CAMERA SOURCE NOT IDENTIFIED FOR THIS ALERT',
            'מקור המצלמה של התראה זו לא זוהה')}
        </span>
      ) : null}
    </section>
  )
}
