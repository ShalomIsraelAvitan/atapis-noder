import { useConcept } from '../useConcept'

// Details inspector for a selected user. Fills the empty space on Admin pages
// that today show only a stat row + a short table.
//
// HONESTY: the backend user record persists only id / username / email / role /
// createdAt (see /api/users). Fields an operator might expect — last login,
// recent activity, failed logins, 2FA, per-camera permissions — are NOT
// recorded anywhere, so they are shown as a labeled "Not recorded by the
// backend" note rather than invented. Do not fabricate an audit trail here.
export function UserDetailsPane({ user, currentUser, busy = false, onEdit, onDelete, onClose, className = '' }) {
  const { t } = useConcept()

  if (!user) {
    return (
      <div className={`dm-userdetails dm-userdetails--empty ${className}`}>
        <p className="dm-empty">{t('Select a user to see details.', 'בחר משתמש להצגת פרטים.')}</p>
      </div>
    )
  }

  const isSelf = currentUser?.id === user.id
  const fields = [
    { key: 'id', label: t('ID', 'מזהה'), value: String(user.id), ltr: true },
    { key: 'username', label: t('Username', 'שם משתמש'), value: user.username, ltr: true },
    { key: 'email', label: t('Email', 'אימייל'), value: user.email || '—', ltr: true },
    { key: 'role', label: t('Role', 'תפקיד'), value: user.role, ltr: true, role: true },
    {
      key: 'created',
      label: t('Created', 'נוצר'),
      value: user.createdAt ? new Date(user.createdAt).toLocaleString('en-GB') : '—',
      ltr: true,
    },
  ]

  // Everything the backend does not store, stated plainly rather than faked.
  const unrecorded = [
    t('Last login', 'התחברות אחרונה'),
    t('Recent activity', 'פעילות אחרונה'),
    t('Failed logins', 'ניסיונות כושלים'),
    t('Two-factor auth', 'אימות דו־שלבי'),
    t('Camera permissions', 'הרשאות מצלמה'),
  ]

  return (
    <div className={`dm-userdetails ${className}`}>
      <div className="dm-userdetails-head">
        <div>
          <span className="dm-userdetails-name" dir="ltr">
            {user.username}
            {isSelf ? <span className="dm-you-badge">{t('you', 'את/ה')}</span> : null}
          </span>
          <span className={`dm-role dm-role--${user.role}`}>{user.role}</span>
        </div>
        {onClose ? (
          <button type="button" className="dm-btn" onClick={onClose} aria-label={t('Close', 'סגירה')}>
            ✕
          </button>
        ) : null}
      </div>

      <dl className="dm-userdetails-kv">
        {fields.map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd dir={field.ltr ? 'ltr' : undefined}>
              {field.role ? <span className={`dm-role dm-role--${user.role}`}>{field.value}</span> : field.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="dm-userdetails-note">
        <span className="dm-userdetails-note-label">{t('Not recorded by the backend', 'לא נרשם ב־Backend')}</span>
        <span className="dm-userdetails-note-list" dir="auto">{unrecorded.join(' · ')}</span>
      </div>

      {(onEdit || onDelete) ? (
        <div className="dm-userdetails-actions">
          {onEdit ? (
            <button type="button" className="dm-btn" disabled={busy} onClick={() => onEdit(user)}>
              {t('Edit', 'עריכה')}
            </button>
          ) : null}
          {onDelete && !isSelf ? (
            <button type="button" className="dm-btn dm-btn--danger" disabled={busy} onClick={() => onDelete(user)}>
              {t('Delete', 'מחיקה')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
