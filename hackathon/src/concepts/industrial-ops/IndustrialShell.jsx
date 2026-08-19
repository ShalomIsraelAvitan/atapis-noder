import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useConcept } from '../useConcept'
import { useDensity } from '../useDensity'
import ConceptSwitcher from '../ConceptSwitcher'
import './industrial.css'
import { demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'
import { FOCUS_REGIONS, focusRegion, shouldIgnoreShortcut } from './shortcuts'

const SWITCHER_KEY = 'io2-switcher-open'

// Industrial Ops shell — fixed operational sidebar, keyboard section shortcuts
// (Alt+1..6), system designation always visible at the top of the rail.
export default function IndustrialShell() {
  const { dir, t } = useConcept()
  const { density } = useDensity()
  const { conceptId } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const base = `/concepts/${conceptId}`
  const isDemo = demoOptionsFromLocation(location.search).demo === 'forced'

  const items = [
    { key: '1', to: `${base}/dashboard`, code: 'OPS', en: 'Operations', he: 'מבצעים' },
    { key: '2', to: `${base}/camera/1`, code: 'OPT', en: 'Optical', he: 'אופטי', match: `${base}/camera` },
    { key: '3', to: `${base}/history`, code: 'INV', en: 'Investigation', he: 'חקירה' },
    { key: '4', to: `${base}/about`, code: 'DOC', en: 'System brief', he: 'מפרט' },
    { key: '5', to: `${base}/settings`, code: 'CFG', en: 'Config', he: 'תצורה' },
  ]
  if (user?.role === 'admin') items.push({ key: '6', to: `${base}/admin`, code: 'ADM', en: 'Admin', he: 'ניהול' })

  // An explicit user choice always wins. With no stored choice, the preview
  // switcher starts collapsed on screens where it would otherwise sit on top of
  // the dashboard.
  const [switcherOpen, setSwitcherOpen] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SWITCHER_KEY)
      if (stored === 'open') return true
      if (stored === 'closed') return false
    } catch {
      /* private mode: fall through to the size heuristic */
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return !window.matchMedia('(max-width: 1500px), (max-height: 820px)').matches
    }
    return true
  })

  const toggleSwitcher = useCallback(() => {
    setSwitcherOpen((open) => {
      const next = !open
      try {
        sessionStorage.setItem(SWITCHER_KEY, next ? 'open' : 'closed')
      } catch {
        /* private mode: the toggle still works for this view */
      }
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return
      if (shouldIgnoreShortcut(event)) return

      if (event.key === '0') {
        event.preventDefault()
        toggleSwitcher()
        return
      }

      const region = FOCUS_REGIONS[event.key]
      if (region) {
        if (focusRegion(region)) event.preventDefault()
        return
      }

      const item = items.find((i) => i.key === event.key)
      if (item) {
        event.preventDefault()
        navigate(`${item.to}${location.search}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, location.search, user?.role, toggleSwitcher])

  return (
    <div
      className={`design-lab-scope concepts-scope c-industrial ${switcherOpen ? '' : 'io2-cs-collapsed'}`}
      data-density={density}
      dir={dir}
    >
      <div className="io2-frame">
        <aside className="io2-rail">
          <div className="io2-rail-brand" dir="ltr">
            <span className="io2-rail-sys">ATAPIS</span>
            <span className="io2-rail-unit">UNIT / D-01</span>
          </div>
          <nav className="io2-rail-nav" aria-label={t('Primary', 'ניווט ראשי')}>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={`${item.to}${location.search}`}
                className={({ isActive }) =>
                  `io2-rail-link ${isActive || (item.match && location.pathname.startsWith(item.match)) ? 'is-active' : ''}`
                }
                title={`${t(item.en, item.he)} — Alt+${item.key}`}
              >
                <span className="io2-rail-code" dir="ltr">{item.code}</span>
                <span className="io2-rail-label">{t(item.en, item.he)}</span>
                <kbd dir="ltr">⌥{item.key}</kbd>
              </NavLink>
            ))}
          </nav>
          <p className="io2-rail-foot" dir="ltr">REV 2.6 /// PERIMETER</p>
        </aside>
        <main className="io2-main">
          <Outlet />
        </main>
      </div>
      {/* Design preview control, not operational UI: collapsible so it can never
          sit on top of the bottom operational bar. */}
      <button
        type="button"
        className="io2-cs-toggle"
        onClick={toggleSwitcher}
        aria-expanded={switcherOpen}
        aria-controls="io2-concept-switcher"
        title={`${t('Design preview switcher', 'בורר תצוגות עיצוב')} — Alt+0`}
        dir="ltr"
      >
        DESIGN {switcherOpen ? '▾' : '▴'}
      </button>
      {switcherOpen ? (
        <div id="io2-concept-switcher" className="io2-cs-host">
          <ConceptSwitcher isDemo={isDemo} />
        </div>
      ) : null}
    </div>
  )
}
