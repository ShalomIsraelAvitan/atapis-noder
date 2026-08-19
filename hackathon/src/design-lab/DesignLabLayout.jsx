import { Link, useLocation } from 'react-router-dom'
import { LabProvider } from './shared/LabContext'
import { useLab } from './shared/useLab'
import './shared/motion-tokens.css'
import './design-lab-base.css'

const CONCEPTS = [
  { slug: 'minimal-command', name: 'Minimal Command', nameHe: 'פיקוד מינימלי' },
  { slug: 'sentinel-3d', name: 'Sentinel 3D', nameHe: 'סנטינל תלת־ממד' },
  { slug: 'industrial-ops', name: 'Industrial Ops', nameHe: 'תפעול תעשייתי' },
  { slug: 'neural-fusion', name: 'Neural Fusion', nameHe: 'היתוך עצבי' },
]

function SwitcherBar({ isDemo }) {
  const { t, toggleLang, lang } = useLab()
  const location = useLocation()

  return (
    <nav className="dl-switcher" aria-label={t('Design Lab navigation', 'ניווט מעבדת עיצוב')} dir="ltr">
      <Link to="/design-lab" className="dl-switcher-home">
        {t('Lab', 'מעבדה')}
      </Link>
      {isDemo ? <span className="dl-switcher-demo">DEMO DATA — DESIGN PREVIEW</span> : null}
      {CONCEPTS.map((concept) => {
        const path = `/design-lab/${concept.slug}`
        const active = location.pathname === path
        return (
          <Link
            key={concept.slug}
            to={`${path}${location.search}`}
            className={`dl-switcher-link ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {concept.name}
          </Link>
        )
      })}
      <button type="button" className="dl-switcher-lang" onClick={toggleLang}
        aria-label={t('Switch interface language', 'החלפת שפת ממשק')}>
        {lang === 'en' ? 'עב' : 'EN'}
      </button>
    </nav>
  )
}

function LayoutInner({ children, isDemo }) {
  const { dir } = useLab()
  return (
    <div className="design-lab-scope dl-root" dir={dir}>
      {children}
      <SwitcherBar isDemo={isDemo} />
    </div>
  )
}

// Wraps every Design Lab screen: language/RTL context, demo banner and the
// floating concept switcher (so you can compare designs without going home).
export default function DesignLabLayout({ children, isDemo = false }) {
  return (
    <LabProvider>
      <LayoutInner isDemo={isDemo}>{children}</LayoutInner>
    </LabProvider>
  )
}
