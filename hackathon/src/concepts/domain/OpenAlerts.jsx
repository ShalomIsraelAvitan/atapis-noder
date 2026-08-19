import { useConcept } from '../useConcept'

// Session-derived alert feed (mode changes, weapon, radar link, person count).
// variant: 'list' | 'compact'
// showMeta (opt-in, default off → markup unchanged for every existing caller):
//   renders the alert's source tag and tags the row with its event kind, so a
//   dense operational log can tell camera, radar, controller and system events
//   apart instead of relying on the message wording.
export function OpenAlerts({ alerts, limit = 8, variant = 'list', className = '', showMeta = false }) {
  const { t } = useConcept()

  if (!alerts.length) {
    return <p className={`dm-empty ${className}`}>{t('No alerts this session', 'אין התראות בסשן הנוכחי')}</p>
  }

  return (
    <ol className={`dm-alerts dm-alerts--${variant} ${className}`} dir="ltr">
      {alerts.slice(0, limit).map((alert) => (
        <li
          key={alert.id}
          className={`dm-alert dm-alert--${alert.severity}${
            showMeta && alert.kind ? ` dm-alert--k-${alert.kind}` : ''
          }`}
        >
          <span className="dm-alert-time">{alert.time}</span>
          {showMeta ? <span className="dm-alert-src">{(alert.source || 'system').toUpperCase()}</span> : null}
          <span className="dm-alert-msg">{alert.message}</span>
        </li>
      ))}
    </ol>
  )
}
