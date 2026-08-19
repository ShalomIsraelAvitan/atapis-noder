// Industrial Ops — the shared alert identity line (Phase A2).
//
// The words live in alertLabels.js; this file is only the components that render
// them, so the action bar, both confirmation dialogs and the context menu all
// present an alert identically.

import {
  conditionLabel, lifecycleLabel, severityLabel, sourceLabel,
} from './alertLabels.js'

/** An identifier or number, isolated so RTL text cannot reverse it. */
export function Val({ children, title }) {
  return <bdi dir="ltr" className="io2-val" title={title}>{children}</bdi>
}

/**
 * The identity line every operator surface shares.
 *
 * The alert id is long by design — it encodes area, source, kind and instance —
 * so it is allowed to truncate VISUALLY, through CSS, with the full value in the
 * title and in aria-label. The value itself is never shortened: Copy Alert ID
 * copies the whole thing and nothing in the model is altered.
 *
 * Severity, lifecycle and condition are three separate chips on purpose. They
 * are independent axes: an alert can be DANGER, RESOLVED and still ACTIVE at the
 * same time, and collapsing any two of them into one badge would hide exactly
 * the case an operator most needs to see.
 */
export function AlertIdentity({ alert, area, t, lang, areaLabel }) {
  if (!alert) return null
  return (
    <>
      <span className={`io2-ab-sev io2-ab-sev--${alert.severity}`} dir="ltr">
        {severityLabel(alert, t)}
      </span>
      <span className="io2-ab-area">{areaLabel || (area ? area.name : alert.areaId)}</span>
      <span className="io2-ab-id" title={alert.id} aria-label={`Alert ID ${alert.id}`}>
        <Val>{alert.id}</Val>
      </span>
      <span className={`io2-ab-life io2-ab-life--${String(alert.lifecycle).toLowerCase()}`}>
        {lifecycleLabel(alert, lang)}
      </span>
      <span className={`io2-ab-cond ${alert.active ? 'is-active' : 'is-cleared'}`}>
        {conditionLabel(alert, t)}
      </span>
      <span className="io2-ab-src">{sourceLabel(alert, t)}</span>
      {alert.trackId !== null && alert.trackId !== undefined ? (
        <Val>#{alert.trackId}</Val>
      ) : null}
      {alert.targetId !== null && alert.targetId !== undefined ? (
        <Val>T{alert.targetId}</Val>
      ) : null}
      {alert.owner?.name ? (
        <span className="io2-ab-owner">
          {t('SESSION OWNER', 'בעלות בסשן')} <Val>{alert.owner.name}</Val>
        </span>
      ) : null}
    </>
  )
}
