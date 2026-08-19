import { useConcept } from '../../useConcept'
import { UsersManager } from '../../domain/UsersManager'
import { UserDetailsPane } from '../../domain/UserDetailsPane'

// Industrial: the densest, most operational Admin of all concepts.
export default function IndustrialAdmin({ vm }) {
  const { t } = useConcept()
  return (
    <div className="io2-page io2-admin">
      <div className="io2-strip" dir="ltr">
        <div className="io2-strip-mode">
          <span className="io2-strip-label">ADMIN</span>
          <span className="io2-strip-modeval io2-strip-modeval--sm">{t('PERSONNEL CONTROL', 'בקרת כוח אדם')}</span>
        </div>
        <div className="io2-strip-cell"><span className="io2-strip-label">TOTAL</span><span className="io2-strip-value">{vm.stats.total}</span></div>
        <div className="io2-strip-cell"><span className="io2-strip-label">ADMIN</span><span className="io2-strip-value">{vm.stats.admins}</span></div>
        <div className="io2-strip-cell"><span className="io2-strip-label">PENDING</span><span className={`io2-strip-value ${vm.stats.pending ? 'dm-tone-alert' : ''}`}>{vm.stats.pending}</span></div>
      </div>
      <div className="dm-admin-split">
        <section className="io2-panel">
          <UsersManager vm={vm} className="io2-users" onSelect={(u) => vm.setSelectedUserId(u.id)} selectedId={vm.selectedUser?.id} />
        </section>
        <aside className="dm-admin-split-side">
          <section className="io2-panel" aria-label={t('User details', 'פרטי משתמש')}>
            <h2 className="io2-panel-title" dir="ltr">[ USER DETAILS ]</h2>
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
