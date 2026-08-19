import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useConcept } from '../useConcept'
import { useDensity } from '../useDensity'
import ConceptSwitcher from '../ConceptSwitcher'
import './neural.css'
import { demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'

// Neural Fusion shell — floating node dock connected by a flow line.
export default function NeuralShell() {
  const { dir, t } = useConcept()
  const { density } = useDensity()
  const { conceptId } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const base = `/concepts/${conceptId}`
  const isDemo = demoOptionsFromLocation(location.search).demo === 'forced'

  const items = [
    { to: `${base}/dashboard`, en: 'Fusion', he: 'היתוך' },
    { to: `${base}/camera/1`, en: 'Vision', he: 'ראייה', match: `${base}/camera` },
    { to: `${base}/history`, en: 'Narrative', he: 'נרטיב' },
    { to: `${base}/about`, en: 'Journey', he: 'מסע' },
    { to: `${base}/settings`, en: 'Signals', he: 'אותות' },
  ]
  if (user?.role === 'admin') items.push({ to: `${base}/admin`, en: 'Access', he: 'גישה' })

  return (
    <div className="design-lab-scope concepts-scope c-neural" data-density={density} dir={dir}>
      <nav className="nf2-dock" aria-label={t('Primary', 'ניווט ראשי')}>
        <span className="nf2-dock-brand" dir="ltr">ATAPIS</span>
        <div className="nf2-dock-line" aria-hidden="true" />
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={`${item.to}${location.search}`}
            className={({ isActive }) =>
              `nf2-dock-node ${isActive || (item.match && location.pathname.startsWith(item.match)) ? 'is-active' : ''}`
            }
          >
            <span className="nf2-dock-dot" aria-hidden="true" />
            <span className="nf2-dock-label">{t(item.en, item.he)}</span>
          </NavLink>
        ))}
      </nav>
      <main className="nf2-main">
        <Outlet />
      </main>
      <ConceptSwitcher isDemo={isDemo} />
    </div>
  )
}
