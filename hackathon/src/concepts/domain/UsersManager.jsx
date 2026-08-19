import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { useConcept } from '../useConcept'

function UserForm({ initial, onSubmit, onCancel, submitLabel, withPassword = false, withRole = true }) {
  const { t } = useConcept()
  const [values, setValues] = useState({
    username: initial?.username || '',
    email: initial?.email || '',
    role: initial?.role && initial.role !== 'pending' ? initial.role : 'user',
    password: '',
  })
  const [error, setError] = useState(null)

  const submit = (event) => {
    event.preventDefault()
    if (!values.username.trim()) return setError(t('Username is required', 'שם משתמש נדרש'))
    if (withPassword && values.password.length < 6) {
      return setError(t('Password must be at least 6 characters', 'סיסמה חייבת להכיל לפחות 6 תווים'))
    }
    setError(null)
    const payload = { username: values.username.trim(), email: values.email.trim(), role: values.role }
    if (withPassword) payload.password = values.password
    onSubmit(payload)
  }

  return (
    <form className="dm-userform" onSubmit={submit}>
      <label>
        <span>{t('Username', 'שם משתמש')}</span>
        <input dir="ltr" value={values.username} onChange={(e) => setValues({ ...values, username: e.target.value })} />
      </label>
      <label>
        <span>{t('Email', 'אימייל')}</span>
        <input dir="ltr" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
      </label>
      {withPassword ? (
        <label>
          <span>{t('Password', 'סיסמה')}</span>
          <input dir="ltr" type="password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} />
        </label>
      ) : null}
      {withRole ? (
        <label>
          <span>{t('Role', 'תפקיד')}</span>
          <select dir="ltr" value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value })}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>
      ) : null}
      {error ? <p className="dm-form-error" role="alert">{error}</p> : null}
      <div className="dm-form-actions">
        <button type="button" className="dm-btn" onClick={onCancel}>{t('Cancel', 'ביטול')}</button>
        <button type="submit" className="dm-btn dm-btn--primary">{submitLabel}</button>
      </div>
    </form>
  )
}

// Full admin user management — table, pending approvals, add/edit forms,
// confirm dialog for destructive actions. All actions hit /api/users for real.
export function UsersManager({ vm, onSelect, selectedId, className = '' }) {
  const { t } = useConcept()
  const { users, pendingUsers, currentUser, stats, feedback, busyId, confirm, setConfirm, editing, setEditing, adding, setAdding, actions } = vm

  return (
    <div className={`dm-users ${className}`}>
      <div className="dm-users-stats" dir="ltr">
        <div className="dm-stat"><b>{stats.total}</b><span>{t('Total', 'סה״כ')}</span></div>
        <div className="dm-stat"><b>{stats.admins}</b><span>Admins</span></div>
        <div className="dm-stat"><b>{stats.regular}</b><span>Users</span></div>
        <div className={`dm-stat ${stats.pending ? 'dm-stat--attention' : ''}`}><b>{stats.pending}</b><span>Pending</span></div>
      </div>

      {feedback ? (
        <p className={`dm-feedback ${feedback.ok ? 'is-ok' : 'is-err'}`} role="status">{feedback.message}</p>
      ) : null}

      {pendingUsers.length ? (
        <section className="dm-users-pending">
          <h3 className="dm-subtitle">{t('Pending approval', 'ממתינים לאישור')}</h3>
          <ul>
            {pendingUsers.map((user) => (
              <li key={user.id} className="dm-pending-row">
                <span dir="ltr">{user.username} · {user.email || '—'}</span>
                <span className="dm-pending-actions">
                  <button type="button" className="dm-btn dm-btn--primary" disabled={busyId === user.id}
                    onClick={() => actions.approve(user)}>
                    {t('Approve', 'אישור')}
                  </button>
                  <button type="button" className="dm-btn dm-btn--danger" disabled={busyId === user.id}
                    onClick={() => actions.requestDelete(user, true)}>
                    {t('Reject', 'דחייה')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="dm-users-toolbar">
        <button type="button" className="dm-btn dm-btn--primary" onClick={() => { setAdding(true); setEditing(null) }}>
          + {t('Add user', 'הוספת משתמש')}
        </button>
      </div>

      {adding ? (
        <UserForm
          submitLabel={t('Create', 'יצירה')}
          withPassword
          onCancel={() => setAdding(false)}
          onSubmit={(payload) => actions.addUser(payload)}
        />
      ) : null}

      {editing ? (
        <UserForm
          initial={editing}
          submitLabel={t('Save', 'שמירה')}
          onCancel={() => setEditing(null)}
          onSubmit={(payload) => actions.saveEdit(payload)}
        />
      ) : null}

      <div className="dm-table-scroll">
        <table className="dm-table dm-users-table" dir="ltr" style={{ '--dm-cols': 6 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('Username', 'שם משתמש')}</th>
              <th>{t('Email', 'אימייל')}</th>
              <th>{t('Role', 'תפקיד')}</th>
              <th>{t('Created', 'נוצר')}</th>
              <th>{t('Actions', 'פעולות')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className={onSelect && selectedId === user.id ? 'is-selected' : ''}
                tabIndex={onSelect ? 0 : undefined}
                onClick={onSelect ? () => onSelect(user) : undefined}
                onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(user) } } : undefined}
              >
                <td>{user.id}</td>
                <td>
                  {user.username}
                  {currentUser?.id === user.id ? <span className="dm-you-badge">{t('you', 'את/ה')}</span> : null}
                </td>
                <td>{user.email || '—'}</td>
                <td><span className={`dm-role dm-role--${user.role}`}>{user.role}</span></td>
                <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                <td className="dm-users-actions">
                  <button type="button" className="dm-btn" disabled={busyId === user.id}
                    onClick={(e) => { e.stopPropagation(); setEditing(user); setAdding(false) }}>
                    {t('Edit', 'עריכה')}
                  </button>
                  {currentUser?.id !== user.id ? (
                    <button type="button" className="dm-btn dm-btn--danger" disabled={busyId === user.id}
                      onClick={(e) => { e.stopPropagation(); actions.requestDelete(user) }}>
                      {t('Delete', 'מחיקה')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} busy={busyId !== null} />
    </div>
  )
}
