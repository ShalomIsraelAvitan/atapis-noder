import { useConcept } from '../../useConcept'
import { UsersManager } from '../../domain/UsersManager'
import { UserDetailsPane } from '../../domain/UserDetailsPane'

// Sentinel: crew access — the shared user manager inside a floating glass panel,
// with a details pane filling the previously-empty space.
export default function SentinelAdmin({ vm }) {
  const { t } = useConcept()
  return (
    <div className="s32-page s32-admin">
      <header className="s32-head">
        <div>
          <p className="s32-eyebrow" dir="ltr">CREW</p>
          <h1 className="s32-title">{t('Crew access', 'גישת צוות')}</h1>
        </div>
      </header>
      <div className="dm-admin-split">
        <section className="s32-card">
          <UsersManager vm={vm} onSelect={(u) => vm.setSelectedUserId(u.id)} selectedId={vm.selectedUser?.id} />
        </section>
        <aside className="dm-admin-split-side">
          <section className="s32-card" aria-label={t('User details', 'פרטי משתמש')}>
            <span className="s32-hud-title" dir="ltr">{t('USER DETAILS', 'פרטי משתמש')}</span>
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
