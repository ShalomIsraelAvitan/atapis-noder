import { Link, useLocation, useParams } from 'react-router-dom'
import { CONCEPT_LIST } from './registry'
import { useConcept } from './useConcept'
import { DemoModeBadge } from './domain/DemoModeBadge'

// Global concept switcher: keeps the current page, roomId and query string —
// only the concept segment changes. Pure links = full keyboard support.
export default function ConceptSwitcher({ isDemo = false }) {
  const { conceptId } = useParams()
  const location = useLocation()
  const { t, toggleLang, lang } = useConcept()

  // /concepts/<id>/<rest...> → keep <rest> + search
  const rest = location.pathname.split('/').slice(3).join('/') || 'dashboard'

  return (
    <nav className="cs-bar" aria-label={t('Concept switcher', 'החלפת קונספט')} dir="ltr">
      <Link to={`/design-lab/compare`} className="cs-home" title={t('Comparison Center', 'מרכז השוואה')}>
        {t('Compare', 'השוואה')}
      </Link>
      <DemoModeBadge when={isDemo} variant="bar" className="cs-demo" />
      {CONCEPT_LIST.map((concept) => {
        const active = concept.id === conceptId
        return (
          <Link
            key={concept.id}
            to={`/concepts/${concept.id}/${rest}${location.search}`}
            className={`cs-link ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            title={lang === 'he' ? concept.descriptionHe : concept.description}
          >
            {concept.name}
          </Link>
        )
      })}
      <button type="button" className="cs-lang" onClick={toggleLang}
        aria-label={t('Switch interface language', 'החלפת שפת ממשק')}>
        {lang === 'he' ? 'EN' : 'עב'}
      </button>
    </nav>
  )
}
