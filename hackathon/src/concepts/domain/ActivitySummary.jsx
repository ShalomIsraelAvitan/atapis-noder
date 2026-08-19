import { useConcept } from '../useConcept'

// Deterministic summary generated from system data only.
// Deliberately labeled "Automated System Summary" — NOT AI-generated.
export function ActivitySummary({ summary, className = '' }) {
  const { t, lang } = useConcept()
  return (
    <div className={`dm-summary ${className}`}>
      <span className="dm-summary-tag">{t('Automated System Summary', 'סיכום מערכת אוטומטי')}</span>
      {summary.length ? (
        <ul className="dm-summary-list">
          {summary.map((pair, index) => (
            <li key={index}>{lang === 'he' ? pair[1] : pair[0]}</li>
          ))}
        </ul>
      ) : (
        <p className="dm-empty">{t('Nothing to report.', 'אין מה לדווח.')}</p>
      )}
    </div>
  )
}
