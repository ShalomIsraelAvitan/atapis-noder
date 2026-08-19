import { useConcept } from '../useConcept'

// Real client-side filters over the persisted detections list.
export function InvestigationFilters({ filters, className = '' }) {
  const { t, lang } = useConcept()
  return (
    <div className={`dm-filters ${className}`}>
      <label className="dm-filter">
        <span>{t('Search', 'חיפוש')}</span>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => filters.setSearch(e.target.value)}
          placeholder={t('context, motion, weapon…', 'הקשר, תנועה, נשק…')}
          dir="ltr"
        />
      </label>
      <label className="dm-filter">
        <span>{t('Mode', 'מצב')}</span>
        <select value={filters.mode} onChange={(e) => filters.setMode(e.target.value)} dir="ltr">
          {filters.modeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="dm-filter">
        <span>{t('Source', 'מקור')}</span>
        <select value={filters.source} onChange={(e) => filters.setSource(e.target.value)} dir="ltr">
          {filters.sourceOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="dm-filter">
        <span>{t('Range', 'טווח')}</span>
        <select value={filters.range} onChange={(e) => filters.setRange(e.target.value)} dir="ltr">
          {filters.rangeOptions.map((option) => (
            <option key={option.id} value={option.id}>{lang === 'he' ? option.he : option.en}</option>
          ))}
        </select>
      </label>
      <label className="dm-filter dm-filter--risk">
        <span>{t('Min risk', 'סיכון מינ׳')} <b dir="ltr">{filters.minRisk}</b></span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={filters.minRisk}
          onChange={(e) => filters.setMinRisk(Number(e.target.value))}
          dir="ltr"
        />
      </label>
    </div>
  )
}
