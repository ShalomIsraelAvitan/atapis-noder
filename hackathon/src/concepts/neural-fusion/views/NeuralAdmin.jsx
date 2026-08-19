import { useConcept } from '../../useConcept'
import { UsersManager } from '../../domain/UsersManager'
import { UserDetailsPane } from '../../domain/UserDetailsPane'

// Neural: access graph — who is connected to the system, with a details pane.
export default function NeuralAdmin({ vm }) {
  const { t } = useConcept()
  return (
    <div className="nf2-page nf2-admin">
      <header className="nf2-head">
        <div>
          <p className="nf2-eyebrow" dir="ltr">ACCESS</p>
          <h1 className="nf2-title">{t('Access control', 'בקרת גישה')}</h1>
        </div>
      </header>
      <div className="dm-admin-split">
        <section className="nf2-card">
          <UsersManager vm={vm} onSelect={(u) => vm.setSelectedUserId(u.id)} selectedId={vm.selectedUser?.id} />
        </section>
        <aside className="dm-admin-split-side">
          <section className="nf2-card" aria-label={t('User details', 'פרטי משתמש')}>
            <h2 className="dm-subtitle">{t('User details', 'פרטי משתמש')}</h2>
            <UserDetailsPane
              user={vm.selectedUser}
              currentUser={vm.currentUser}
              busy={vm.busyId !== null}
              onEdit={(u) => { vm.setEditing(u); vm.setAdding(false) }}
              onDelete={(u) => vm.actions.requestDelete(u)}
              onClose={() => vm.setSelectedUserId(null)}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
