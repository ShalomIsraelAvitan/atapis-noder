import { useConcept } from '../../useConcept'
import { UsersManager } from '../../domain/UsersManager'
import { UserDetailsPane } from '../../domain/UserDetailsPane'

// Prime access control: Industrial's full table + Minimal's clarity — the
// shared UsersManager already carries both (stats, pending approvals, inline
// actions, full ConfirmDialog). A details pane fills the empty column: clicking
// a row inspects that user (with honest "not recorded by the backend" notes).
export default function PrimeAdmin({ vm }) {
  const { t } = useConcept()
  // With a single account there is nothing to choose between, so the pane shows
  // it rather than asking the operator to click the only row. Derived, not
  // stored: with several users the normal selection applies, and with none the
  // pane keeps its honest empty state.
  const onlyUser = vm.users.length === 1 ? vm.users[0] : null
  const detailUser = vm.selectedUser || onlyUser

  return (
    <div className="pp-page pp-admin">
      <header className="pp-head">
        <div>
          <p className="pp-eyebrow" dir="ltr">ACCESS</p>
          <h1 className="pp-title">{t('Access control', 'בקרת גישה')}</h1>
        </div>
      </header>
      <div className="pp-admin-layout">
        <section className="pp-card">
          <UsersManager vm={vm} onSelect={(u) => vm.setSelectedUserId(u.id)} selectedId={detailUser?.id} />
        </section>
        <aside className="pp-admin-side">
          <section className="pp-card" aria-label={t('User details', 'פרטי משתמש')}>
            <h2 className="dm-subtitle">{t('User details', 'פרטי משתמש')}</h2>
            <UserDetailsPane
              user={detailUser}
              currentUser={vm.currentUser}
              busy={vm.busyId !== null}
              onEdit={(u) => { vm.setEditing(u); vm.setAdding(false) }}
              onDelete={(u) => vm.actions.requestDelete(u)}
              onClose={vm.selectedUser ? () => vm.setSelectedUserId(null) : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
