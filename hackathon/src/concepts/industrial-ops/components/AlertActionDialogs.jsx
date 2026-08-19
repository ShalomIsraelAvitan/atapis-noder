// Resolve / Reopen confirmation dialogs (Phase A2).
//
// Built on the native <dialog> element for three reasons that matter here:
//
//   1. `shouldIgnoreShortcut` in shortcuts.js already suppresses "/" and the
//      Alt+n navigation for anything inside a <dialog>, so the screen's global
//      keys cannot fire while an operator is typing a resolve note — with no
//      change to any shared file.
//   2. showModal() puts the dialog in the top layer and makes the rest of the
//      page inert: focus containment and Escape come from the platform rather
//      than from a hand-rolled trap that has to be kept correct.
//   3. It is an overlay, so it adds nothing to the document's height and cannot
//      reflow the grid underneath.
//
// The platform is NOT trusted to keep React in step with it, though. Both
// `cancel` (Escape) and `close` are handled explicitly, so a dialog dismissed by
// the browser always clears the pending action, restores focus and leaves the
// alert untouched. Escape never mutates anything.

import { useEffect, useRef, useState } from 'react'
import { useConcept } from '../../useConcept'
import { RESOLVE_NOTE_MAX, RESOLVE_REASONS, reopenTargetLifecycle } from '../alerts.js'
import { areaName } from '../areas.js'
import { AlertIdentity } from './alertPresentation.jsx'
import { LIFECYCLE_LABEL, RESOLVE_REASON_LABEL, pickLabel } from './alertLabels.js'

// The cap now lives in alerts.js (Phase A3.2): the note gained a second way in
// through the Notes dialog, and one field must not have two limits. It is
// imported rather than re-exported so this file keeps exporting only components.

/**
 * Opens a native modal on mount and keeps React in step with every way it can
 * close: Escape, the platform's own close event, Cancel and Confirm.
 *
 * REACT OWNS THE TEARDOWN, deliberately. The obvious implementation — close the
 * element on unmount and let the `close` event tell React — does not work:
 * `HTMLDialogElement.close()` fires its event ASYNCHRONOUSLY, so under React's
 * StrictMode double-invocation (effect → cleanup → effect) the cleanup's close
 * event arrives after the dialog has already been re-opened, and is then read as
 * a dismissal. The dialog closes itself the instant it appears.
 *
 * So every dismissal path calls `onDismiss` directly, the element is simply
 * unmounted, and focus is restored here rather than left to the platform's
 * close-time behaviour. Escape is prevented for the same reason: React, not the
 * browser, decides when this component goes away.
 *
 * Nothing on any of these paths mutates an alert. Escape and Cancel are always
 * inert; only the confirm button acts.
 */
function useNativeModal(onDismiss) {
  const ref = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    // The control that opened the dialog, so focus can go back to it. Captured
    // once: StrictMode runs this effect twice, and by the second pass the active
    // element is already inside the dialog.
    if (!openerRef.current) openerRef.current = document.activeElement
    if (!el.open) el.showModal()
    return () => {
      const opener = openerRef.current
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  const bind = {
    // Escape.
    onCancel: (event) => {
      event.preventDefault()
      onDismiss()
    },
    // Anything that closes the element without going through React.
    onClose: () => onDismiss(),
    // A stray click on the backdrop must not confirm anything, and must not
    // throw away a half-written note either. It does nothing at all.
    onClick: (event) => event.stopPropagation(),
    close: () => onDismiss(),
  }
  return [ref, bind]
}

function DialogFrame({ className, titleId, descId, children, bind, dialogRef }) {
  return (
    <dialog
      className={`io2-dialog ${className}`}
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={bind.onCancel}
      onClose={bind.onClose}
    >
      <div className="io2-dialog-body" onClick={bind.onClick}>{children}</div>
    </dialog>
  )
}

// ---------------------------------------------------------------- Resolve ----

export function ResolveAlertDialog({ alert, area, onConfirm, onDismiss }) {
  const { t, lang } = useConcept()
  // Fresh per mount, so reopening always gives a clean form and a poll tick can
  // never wipe what the operator has typed.
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [ref, bind] = useNativeModal(onDismiss)

  // The alert is looked up by the parent on every render, so if the condition
  // clears or returns while the dialog is open the warning below follows it.
  useEffect(() => {
    if (!alert && ref.current?.open) ref.current.close()
  }, [alert, ref])

  if (!alert) return null

  const valid = RESOLVE_REASONS.includes(reason)
  const trimmed = note.trim()

  const confirm = () => {
    if (!valid) return
    // Whitespace-only is not a note.
    onConfirm(reason, trimmed || null)
  }

  return (
    <DialogFrame
      className="io2-dialog--resolve"
      titleId="io2-resolve-title"
      descId="io2-resolve-desc"
      bind={bind}
      dialogRef={ref}
    >
      <h2 className="io2-dialog-title" id="io2-resolve-title">
        [ {t('RESOLVE ALERT', 'סגירת התראה')} ]
      </h2>

      <div className="io2-dialog-identity" id="io2-resolve-desc">
        <AlertIdentity alert={alert} area={area} t={t} lang={lang} />
      </div>

      {alert.active ? (
        <p className="io2-dialog-warn" role="note">
          <strong>{t('THE SOURCE CONDITION IS STILL ACTIVE', 'תנאי המקור עדיין פעיל')}</strong>
          <span>
            {t('Resolving closes the operator workflow only. It does not indicate that the detected condition has disappeared.',
              'סגירת ההתראה מסיימת את תהליך הטיפול המקומי בלבד. היא אינה מעידה שהזיהוי או האיום נעלמו.')}
          </span>
        </p>
      ) : null}

      <label className="io2-dialog-field">
        <span className="io2-dialog-label">
          {t('Reason', 'סיבה')} <span className="io2-dialog-req">{t('required', 'חובה')}</span>
        </span>
        <select
          className="io2-dialog-select"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          autoFocus
        >
          <option value="">{t('— select a reason —', '— בחר סיבה —')}</option>
          {RESOLVE_REASONS.map((value) => (
            <option key={value} value={value}>{pickLabel(RESOLVE_REASON_LABEL, value, lang)}</option>
          ))}
        </select>
      </label>

      <label className="io2-dialog-field">
        <span className="io2-dialog-label">
          {t('Note', 'הערה')} <span className="io2-dialog-opt">{t('optional', 'רשות')}</span>
          <span className="io2-dialog-count"><bdi dir="ltr">{note.length}/{RESOLVE_NOTE_MAX}</bdi></span>
        </span>
        <textarea
          className="io2-dialog-note"
          rows={3}
          maxLength={RESOLVE_NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <p className="io2-dialog-local">
        {t('This workflow state is stored only in this browser tab session. It is not sent to the server.',
          'מצב הטיפול נשמר בלשונית הדפדפן הזאת בלבד ואינו נשלח לשרת.')}
      </p>

      <div className="io2-dialog-actions">
        <button type="button" className="io2-dialog-cancel" onClick={bind.close}>
          {t('CANCEL', 'ביטול')}
        </button>
        <button
          type="button"
          className="io2-dialog-confirm"
          data-io2-confirm="resolve"
          disabled={!valid}
          onClick={confirm}
        >
          {t('RESOLVE ALERT', 'סגור התראה')}
        </button>
      </div>
    </DialogFrame>
  )
}

// ----------------------------------------------------------------- Reopen ----

export function ReopenAlertDialog({ alert, area, onConfirm, onDismiss }) {
  const { t, lang } = useConcept()
  const [ref, bind] = useNativeModal(onDismiss)

  useEffect(() => {
    if (!alert && ref.current?.open) ref.current.close()
  }, [alert, ref])

  if (!alert) return null

  // Decided by the ownership the alert already had — not by whoever is pressing
  // the button. The destination is stated before the operator commits.
  const target = reopenTargetLifecycle(alert)

  return (
    <DialogFrame
      className="io2-dialog--reopen"
      titleId="io2-reopen-title"
      descId="io2-reopen-desc"
      bind={bind}
      dialogRef={ref}
    >
      <h2 className="io2-dialog-title" id="io2-reopen-title">
        [ {t('REOPEN ALERT', 'פתיחת התראה מחדש')} ]
      </h2>

      <div className="io2-dialog-identity" id="io2-reopen-desc">
        <AlertIdentity alert={alert} area={area} t={t} lang={lang} />
      </div>

      <dl className="io2-dialog-prev">
        <dt>{t('Resolved as', 'נסגרה כ')}</dt>
        <dd>
          {alert.resolveReason
            ? pickLabel(RESOLVE_REASON_LABEL, alert.resolveReason, lang)
            : t('— none recorded —', '— לא נרשמה —')}
        </dd>
        <dt>{t('Note', 'הערה')}</dt>
        <dd>{alert.resolveNote || t('— none —', '— אין —')}</dd>
        <dt>{t('Previous owner', 'בעלות קודמת')}</dt>
        <dd>
          {alert.owner?.name
            ? <bdi dir="ltr">{alert.owner.name}</bdi>
            : t('— none —', '— אין —')}
        </dd>
      </dl>

      <p className="io2-dialog-target" data-io2-reopen-target={target || ''}>
        {t('Will reopen to', 'תיפתח מחדש למצב')}{' '}
        <strong>{pickLabel(LIFECYCLE_LABEL, target, lang)}</strong>
        {' — '}
        {alert.owner?.name
          ? t('the alert already had an owner.', 'להתראה כבר הייתה בעלות.')
          : t('no previous owner was recorded, so it returns to acknowledged rather than to review.',
            'לא נרשמה בעלות קודמת, ולכן היא חוזרת למצב "אושרה" ולא ל"בטיפול".')}
      </p>

      <p className="io2-dialog-local">
        {t('This workflow state is stored only in this browser tab session. It is not sent to the server.',
          'מצב הטיפול נשמר בלשונית הדפדפן הזאת בלבד ואינו נשלח לשרת.')}
      </p>

      <div className="io2-dialog-actions">
        <button type="button" className="io2-dialog-cancel" onClick={onDismiss} autoFocus>
          {t('CANCEL', 'ביטול')}
        </button>
        <button
          type="button"
          className="io2-dialog-confirm"
          data-io2-confirm="reopen"
          onClick={onConfirm}
        >
          {t('REOPEN ALERT', 'פתח מחדש')}
        </button>
      </div>
    </DialogFrame>
  )
}

// ------------------------------------------------------------------ Notes ----

/**
 * Who actually resolved this alert (§51).
 *
 * Read out of the action log rather than from `alert.owner`: owner is whoever
 * pressed Start Review, and the operator who reviews an incident is not
 * necessarily the one who closes it. If the log does not name anybody, this
 * returns null and the dialog says so — it does not fall back to the owner, and
 * it certainly does not name whoever is looking at the screen now.
 */
function resolvedBy(alert) {
  const log = Array.isArray(alert?.actionLog) ? alert.actionLog : []
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i]?.action === 'resolve') return log[i].operatorName || null
  }
  return null
}

/**
 * [ RESOLVE NOTES ] — the record left when the alert was closed (Phase A3.2).
 *
 * Resolve writes a reason and an optional note, and until now both disappeared
 * from view the moment the alert left the open list. This dialog is where they
 * are read afterwards.
 *
 * The asymmetry between the two fields is the point, not an oversight:
 *
 *   REASON is read-only (§52). It is the stated grounds on which an incident was
 *   closed. Editing that after the fact rewrites what the closure MEANT, which is
 *   a materially larger claim than fixing a sentence, and this phase does not
 *   open it.
 *
 *   NOTE is editable (§53). It is the operator's own prose, it is the field most
 *   likely to be typed in a hurry, and correcting it changes no decision.
 *
 * Both live in the same session-local state as everything else on this screen.
 * The dialog says so on every render — never on success only — because a record
 * an operator can read back looks persistent, and this one is not.
 */
export function AlertNotesDialog({ alert, area, onSaveNote, onDismiss }) {
  const { t, lang } = useConcept()
  const [ref, bind] = useNativeModal(onDismiss)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const noteRef = useRef(null)

  useEffect(() => {
    if (!alert && ref.current?.open) ref.current.close()
  }, [alert, ref])

  // Focus moves to the textarea when edit mode opens, so a keyboard operator who
  // activated the pencil is not left with focus on a button that just vanished.
  useEffect(() => {
    if (editing && noteRef.current) noteRef.current.focus()
  }, [editing])

  if (!alert) return null

  const who = resolvedBy(alert)
  const none = t('— none —', '— אין —')

  const startEdit = () => {
    setDraft(alert.resolveNote || '')
    setEditing(true)
  }

  const cancelEdit = () => {
    // Explicitly drops the draft. §71: Cancel mutates nothing.
    setDraft('')
    setEditing(false)
  }

  const save = () => {
    // The engine trims and normalizes whitespace-only to null as well; doing it
    // here too keeps the two from disagreeing about what was just saved.
    onSaveNote(alert.id, draft.trim() || null)
    setEditing(false)
  }

  return (
    <DialogFrame
      className="io2-dialog--notes"
      titleId="io2-notes-title"
      descId="io2-notes-desc"
      bind={bind}
      dialogRef={ref}
    >
      <h2 className="io2-dialog-title" id="io2-notes-title">
        [ {t('RESOLVE NOTES', 'הערות סגירה')} ]
      </h2>

      <div className="io2-dialog-identity" id="io2-notes-desc">
        <AlertIdentity alert={alert} area={area} t={t} lang={lang} />
      </div>

      <dl className="io2-dialog-prev">
        <dt>{t('Alert ID', 'מזהה התראה')}</dt>
        <dd><bdi dir="ltr" data-io2-notes-alertid>{alert.id}</bdi></dd>

        <dt>{t('Area', 'אזור')}</dt>
        <dd>{area ? `${areaName(area, lang)} · ` : ''}<bdi dir="ltr">{alert.areaId}</bdi></dd>

        <dt>{t('Resolved at', 'נסגרה בשעה')}</dt>
        <dd>
          {Number.isFinite(alert.resolvedAt)
            ? <bdi dir="ltr">{new Date(alert.resolvedAt).toLocaleString()}</bdi>
            : none}
        </dd>

        <dt>{t('Resolved by', 'נסגרה על ידי')}</dt>
        <dd>{who ? <bdi dir="ltr">{who}</bdi> : t('— not recorded —', '— לא נרשם —')}</dd>

        {/* Read-only, and labelled read-only rather than merely rendered as
            text: an operator must be able to tell the difference between a
            field this dialog will not edit and one it forgot to offer. */}
        <dt>{t('Resolve Reason', 'סיבת הסגירה')}</dt>
        <dd data-io2-notes-reason data-io2-readonly="true">
          {alert.resolveReason
            ? pickLabel(RESOLVE_REASON_LABEL, alert.resolveReason, lang)
            : t('— none recorded —', '— לא נרשמה —')}
          <span className="io2-notes-ro">{t('READ ONLY', 'לקריאה בלבד')}</span>
        </dd>
      </dl>

      <div className="io2-notes-field">
        <div className="io2-notes-head">
          <span className="io2-dialog-label">{t('Resolve Note', 'הערת סגירה')}</span>
          {!editing ? (
            // A real button with a real accessible name — not a clickable span
            // (§68). The glyph is decorative and hidden from the accessibility
            // tree, so the label is the only thing announced.
            <button
              type="button"
              className="io2-notes-edit"
              data-io2-notes-edit
              onClick={startEdit}
              aria-label={t('Edit resolve note', 'ערוך את הערת הסגירה')}
              title={t('Edit resolve note', 'ערוך את הערת הסגירה')}
            >
              <span aria-hidden="true">✎</span>
            </button>
          ) : (
            <span className="io2-dialog-count">
              <bdi dir="ltr">{draft.length}/{RESOLVE_NOTE_MAX}</bdi>
            </span>
          )}
        </div>

        {editing ? (
          <textarea
            ref={noteRef}
            className="io2-dialog-note"
            data-io2-notes-textarea
            rows={4}
            maxLength={RESOLVE_NOTE_MAX}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : (
          <p className="io2-notes-body" data-io2-notes-body>
            {alert.resolveNote || t('— no note was written —', '— לא נכתבה הערה —')}
          </p>
        )}
      </div>

      {/* §57, verbatim. No "saved", no "synced", no server. */}
      <p className="io2-dialog-local">
        <bdi dir="ltr">SESSION-LOCAL · NOT SERVER-PERSISTED</bdi>{' — '}
        {t('This note is stored only in this browser tab session. It is not sent to the server.',
          'ההערה נשמרת בלשונית הדפדפן הזאת בלבד ואינה נשלחת לשרת.')}
      </p>

      <div className="io2-dialog-actions">
        {editing ? (
          <>
            <button type="button" className="io2-dialog-cancel" data-io2-notes-canceledit onClick={cancelEdit}>
              {t('CANCEL', 'ביטול')}
            </button>
            <button
              type="button"
              className="io2-dialog-confirm"
              data-io2-confirm="save-note"
              onClick={save}
            >
              {t('SAVE', 'שמור')}
            </button>
          </>
        ) : (
          <button type="button" className="io2-dialog-cancel" onClick={bind.close} autoFocus>
            {t('CLOSE', 'סגור')}
          </button>
        )}
      </div>
    </DialogFrame>
  )
}
