// NEW DANGER — the compact indicator in the alerts panel header (A3.1.1).
//
// Phase A2 announced a new DANGER with a full-width red band above the grid.
// It worked, and it cost roughly fifty pixels of the screen permanently: the
// band reserved its place, and when it appeared it pushed the whole command
// grid further down on a screen whose first job is showing the feed. A3.1.1
// replaces the band with a chip beside the panel title.
//
// Nothing about the AWARENESS changes, and that is the point (§46):
//   1. the DANGER cue still fires when sound is READY (useOperationalAudio),
//   2. the alert still rises to the top of the list under the existing sort,
//   3. this chip appears — and it appears whether sound is READY, MUTED,
//      BLOCKED or in ERROR, because it is driven by the alert state and knows
//      nothing about audio at all (§47).
//
// The screen still does NOT move on its own. `aria-live="assertive"` is what
// reaches a screen-reader user without stealing focus, and the selection only
// changes when the operator presses this button — there is no auto-jump.
//
// The unseen rule is NOT reimplemented here: `computeUnseenDanger` in
// alertSelectors.js is the only place that decides what counts as unseen, and
// this component renders what it was handed.

import { useConcept } from '../../useConcept'

export function NewDangerBadge({ count = 0, onGo }) {
  const { t } = useConcept()
  if (!count) return null

  const label = t('NEW DANGER', 'סכנה חדשה')
  return (
    <button
      type="button"
      className="io2-new-danger"
      data-io2-new-danger={count}
      onClick={onGo}
      aria-live="assertive"
      title={t(
        'A new DANGER alert has not been opened yet. Selecting it never happens on its own.',
        'התראת סכנה חדשה טרם נפתחה. הבחירה בה לעולם אינה מתבצעת מאליה.'
      )}
    >
      <span className="io2-new-danger-dot" aria-hidden="true" />
      <span className="io2-new-danger-label">{label}</span>
      {count > 1 ? (
        <>
          <span className="io2-new-danger-sep" aria-hidden="true">·</span>
          <bdi dir="ltr" className="io2-new-danger-count">{count}</bdi>
        </>
      ) : null}
    </button>
  )
}
