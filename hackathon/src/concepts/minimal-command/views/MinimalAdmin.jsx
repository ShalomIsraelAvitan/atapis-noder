import { useConcept } from '../../useConcept'
import { UsersManager } from '../../domain/UsersManager'
import { UserDetailsPane } from '../../domain/UserDetailsPane'

export default function MinimalAdmin({ vm }) {
  const { t } = useConcept()
  return (
    <div className="mn-page mn-admin">
      <header>
        <h1 className="mn-title">{t('Administration', 'ניהול')}</h1>
        <p className="mn-muted">{t('User accounts and approvals.', 'חשבונות משתמשים ואישורים.')}</p>
      </header>
      <div className="mn-admin-layout">
        <UsersManager vm={vm} onSelect={(u) => vm.setSelectedUserId(u.id)} selectedId={vm.selectedUser?.id} />
        <aside className="mn-admin-side">
          <h2 className="dm-subtitle">{t('User details', 'פרטי משתמש')}</h2>
          <UserDetailsPane
            user={vm.selectedUser}
            currentUser={vm.currentUser}
            busy={vm.busyId !== null}
            onEdit={(u) => { vm.setEditing(u); vm.setAdding(false) }}
            onDelete={(u) => vm.actions.requestDelete(u)}
            onClose={() => vm.setSelectedUserId(null)}
          />
        </aside>
      </div>
    </div>
  )
}
