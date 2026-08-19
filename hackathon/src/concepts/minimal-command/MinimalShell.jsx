import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useConcept } from '../useConcept'
import { useDensity } from '../useDensity'
import ConceptSwitcher from '../ConceptSwitcher'
import { useLocation } from 'react-router-dom'
import './minimal.css'
import { demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'

// Minimal Command shell — narrow top bar, few items, clear hierarchy.
function MinimalNav() {
  const { t } = useConcept()
  const { conceptId } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const base = `/concepts/${conceptId}`

  const items = [
    { to: `${base}/dashboard`, en: 'Dashboard', he: 'דשבורד' },
    { to: `${base}/camera/1`, en: 'Camera', he: 'מצלמה', match: `${base}/camera` },
    { to: `${base}/history`, en: 'Investigation', he: 'חדר חקירה' },
    { to: `${base}/about`, en: 'About', he: 'אודות' },
    { to: `${base}/settings`, en: 'Settings', he: 'הגדרות' },
  ]
  if (user?.role === 'admin') items.push({ to: `${base}/admin`, en: 'Admin', he: 'ניהול' })

  return (
    <header className="mn-nav">
      <span className="mn-brand" dir="ltr">ATAPIS</span>
      <nav className="mn-nav-links" aria-label={t('Primary', 'ניווט ראשי')}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={`${item.to}${location.search}`}
            className={({ isActive }) =>
              `mn-nav-link ${isActive || (item.match && location.pathname.startsWith(item.match)) ? 'is-active' : ''}`
            }
          >
            {t(item.en, item.he)}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

export default function MinimalShell() {
  const { dir } = useConcept()
  const { density } = useDensity()
  const location = useLocation()
  const isDemo = demoOptionsFromLocation(location.search).demo === 'forced'
  return (
    <div className="design-lab-scope concepts-scope c-minimal" data-density={density} dir={dir}>
      <MinimalNav />
      <main className="mn-main">
        <Outlet />
      </main>
      <ConceptSwitcher isDemo={isDemo} />
    </div>
  )
}
