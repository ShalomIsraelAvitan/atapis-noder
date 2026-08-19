import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useConcept } from '../useConcept'
import { useDensity } from '../useDensity'
import ConceptSwitcher from '../ConceptSwitcher'
import './sentinel.css'
import { demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'

// Sentinel 3D shell — floating spatial dock at the top center.
export default function SentinelShell() {
  const { dir, t } = useConcept()
  const { density } = useDensity()
  const { conceptId } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const base = `/concepts/${conceptId}`
  const isDemo = demoOptionsFromLocation(location.search).demo === 'forced'

  const items = [
    { to: `${base}/dashboard`, en: 'Twin', he: 'תאום' },
    { to: `${base}/camera/1`, en: 'Optics', he: 'אופטיקה', match: `${base}/camera` },
    { to: `${base}/history`, en: 'Replay', he: 'שחזור' },
    { to: `${base}/about`, en: 'System', he: 'מערכת' },
    { to: `${base}/settings`, en: 'Console', he: 'קונסולה' },
  ]
  if (user?.role === 'admin') items.push({ to: `${base}/admin`, en: 'Crew', he: 'צוות' })

  return (
    <div className="design-lab-scope concepts-scope c-sentinel" data-density={density} dir={dir}>
      <nav className="s32-dock" aria-label={t('Primary', 'ניווט ראשי')} dir="ltr">
        <span className="s32-dock-brand">ATAPIS · SENTINEL</span>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={`${item.to}${location.search}`}
            className={({ isActive }) =>
              `s32-dock-link ${isActive || (item.match && location.pathname.startsWith(item.match)) ? 'is-active' : ''}`
            }
          >
            {t(item.en, item.he)}
          </NavLink>
        ))}
      </nav>
      <main className="s32-main">
        <Outlet />
      </main>
      <ConceptSwitcher isDemo={isDemo} />
    </div>
  )
}
