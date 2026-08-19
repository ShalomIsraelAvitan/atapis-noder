import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAtapisData, demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'
import { AnimatedNumber, ModeBadge, StatusDot } from '../../design-lab/shared/status-primitives'
import { backendDotState, riskTone } from '../../design-lab/shared/adapter'
import { useConcept } from '../useConcept'
import { useDensity } from '../useDensity'
import ConceptSwitcher from '../ConceptSwitcher'
import './prime.css'

// Fusion Prime shell — the mature blend (fusion-prime-decision.md):
// clean Minimal-style top bar + a persistent bottom command strip carrying the
// live system state (Industrial's "state always visible", quiet execution).
// The strip owns its own useAtapisData poll so it stays live on every page;
// on dashboard/camera this is a second poller — accepted, same cost as a
// second browser tab, and keeps page view models self-contained.
export default function PrimeShell() {
  const { dir, t } = useConcept()
  const { density } = useDensity()
  const { conceptId } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const base = `/concepts/${conceptId}`
  const demoOpts = demoOptionsFromLocation(location.search)
  const { snapshot, backendStatus } = useAtapisData(demoOpts)

  const items = [
    { to: `${base}/dashboard`, en: 'Command', he: 'פיקוד' },
    { to: `${base}/camera/1`, en: 'Optics', he: 'אופטיקה', match: `${base}/camera` },
    { to: `${base}/history`, en: 'Investigation', he: 'חדר חקירה' },
    { to: `${base}/about`, en: 'System', he: 'המערכת' },
    { to: `${base}/settings`, en: 'Settings', he: 'הגדרות' },
  ]
  if (user?.role === 'admin') items.push({ to: `${base}/admin`, en: 'Access', he: 'גישה' })

  return (
    <div className="design-lab-scope concepts-scope c-prime" data-density={density} dir={dir}>
      <header className="pp-nav">
        <span className="pp-brand" dir="ltr">ATAPIS <em>FUSION PRIME</em></span>
        <nav className="pp-nav-links" aria-label={t('Primary', 'ניווט ראשי')}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={`${item.to}${location.search}`}
              className={({ isActive }) =>
                `pp-nav-link ${isActive || (item.match && location.pathname.startsWith(item.match)) ? 'is-active' : ''}`
              }
            >
              {t(item.en, item.he)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="pp-main">
        <Outlet />
      </main>

      <footer className="pp-strip" aria-label={t('System state', 'מצב מערכת')}>
        <div className="pp-strip-inner">
          {/* No demo chip here: the page-level indicator already states it once,
              and a second amber-weight chip on every screen competes with ALERT. */}
          <ModeBadge mode={snapshot.mode} />
          <span className="pp-strip-risk" dir="ltr">
            <AnimatedNumber
              value={snapshot.risks.fused}
              className={`pp-strip-num dm-tone-${riskTone(snapshot.risks.fused)}`}
            />
            <span className="pp-strip-label">FUSED</span>
          </span>
          <span className="pp-strip-kv" dir="ltr">CAM {snapshot.risks.camera}</span>
          <span className="pp-strip-kv" dir="ltr">RDR {snapshot.risks.radar}</span>
          <span className="pp-strip-kv" dir="ltr">PERSONS {snapshot.personCount}</span>
          <span className={`pp-strip-kv ${snapshot.hasWeapon ? 'dm-tone-danger' : ''}`} dir="ltr">
            WPN {snapshot.hasWeapon ? 'POS' : 'NEG'}
          </span>
          <span className="pp-strip-dots">
            <StatusDot state={backendDotState(backendStatus)} label={t('Backend', 'שרת')} />
            <StatusDot
              state={snapshot.radar.connected ? 'ok' : 'err'}
              label={`${t('Radar', 'רדאר')}${snapshot.radar.provider ? ` (${snapshot.radar.provider})` : ''}`}
            />
          </span>
        </div>
      </footer>

      {/* isDemo is deliberately not forwarded: the switcher is Design-Lab chrome
          and its demo chip only repeats what the page already says. */}
      <ConceptSwitcher />
    </div>
  )
}
