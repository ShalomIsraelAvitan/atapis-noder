import { useEffect, useRef } from 'react'
import { useConcept } from '../../useConcept'
import { areaName } from '../areas.js'
import { LIFECYCLE } from '../alerts.js'
import { LIFECYCLE_FILTERS } from '../alertSelectors.js'
import { shouldIgnoreShortcut } from '../shortcuts.js'

// Filter strip above the alert list.
//
// The counts come from alertSelectors::lifecycleCounts and are computed with
// every filter applied EXCEPT the lifecycle filter itself. That is the whole
// point: picking "NEW" must not zero the other tabs, or the strip would lie
// about what is behind them.

const TABS = [
  // "OPEN", not "ACTIVE": this tab is about the LIFECYCLE axis — alerts nobody
  // has closed yet. "Active" belongs to the condition axis below, and one word
  // meaning two different things on the same panel is how the two get confused.
  { id: LIFECYCLE_FILTERS.ALL_ACTIVE, en: 'ALL OPEN', he: 'כל הפתוחות' },
  { id: LIFECYCLE.NEW, en: 'NEW', he: 'חדשות' },
  { id: LIFECYCLE.ACKNOWLEDGED, en: 'ACK', he: 'אושרו' },
  { id: LIFECYCLE.IN_REVIEW, en: 'IN REVIEW', he: 'בטיפול' },
  { id: LIFECYCLE.RESOLVED, en: 'RESOLVED', he: 'נסגרו' },
]

const SEVERITIES = [
  { id: 'ALL', en: 'ALL SEV', he: 'כל החומרות' },
  { id: 'danger', en: 'DANGER', he: 'DANGER' },
  { id: 'alert', en: 'ALERT', he: 'ALERT' },
  { id: 'info', en: 'INFO', he: 'INFO' },
]

const SOURCES = [
  { id: 'ALL', en: 'ALL SRC', he: 'כל המקורות' },
  { id: 'camera', en: 'CAMERA', he: 'מצלמה' },
  { id: 'radar', en: 'RADAR', he: 'רדאר' },
  { id: 'system', en: 'SYSTEM', he: 'מערכת' },
]

const ACTIVITY = [
  { id: 'ALL', en: 'ANY STATE', he: 'כל המצבים' },
  { id: 'ACTIVE', en: 'CONDITION HOLDS', he: 'התנאי מתקיים' },
  { id: 'CLEARED', en: 'CONDITION CLEARED', he: 'התנאי חדל' },
]

export function AlertFilters({ filters, counts, areas, onChange, onSearch, onReset }) {
  const { t, lang } = useConcept()
  const searchRef = useRef(null)

  // "/" focuses search — but never while the operator is already typing, and
  // never on a key repeat or mid-IME-composition. shouldIgnoreShortcut is the
  // same guard the Alt+n shortcuts use, imported rather than reimplemented.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/') return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (shouldIgnoreShortcut(event)) return
      event.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onSearchKeyDown = (event) => {
    if (event.key !== 'Escape') return
    // Escape leaves the field: it clears the query if there is one, otherwise it
    // just gives focus back. It never touches anything outside this input.
    if (filters.query) onSearch('')
    else event.currentTarget.blur()
  }

  const areaOptions = [{ id: 'ALL', label: t('ALL AREAS', 'כל האזורים') }]
    .concat(areas.map((a) => ({ id: a.id, label: `${areaName(a, lang)} · ${a.id}` })))

  const filtered = filters.areaId !== 'ALL' || filters.severity !== 'ALL' ||
    filters.sourceType !== 'ALL' || filters.activity !== 'ALL' || Boolean(filters.query)

  return (
    <div className="io2-filters">
      <div className="io2-filter-tabs" role="tablist" aria-label={t('Lifecycle filter', 'סינון מחזור חיים')}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filters.lifecycle === tab.id}
            className={`io2-filter-tab ${filters.lifecycle === tab.id ? 'is-active' : ''}`}
            onClick={() => onChange({ lifecycle: tab.id })}
          >
            <span className="io2-filter-tab-label">{t(tab.en, tab.he)}</span>
            <bdi dir="ltr" className="io2-filter-count">{counts[tab.id] ?? 0}</bdi>
          </button>
        ))}
      </div>

      <div className="io2-filter-row">
        <label className="io2-filter-field">
          <span className="io2-filter-legend">{t('AREA', 'אזור')}</span>
          <select value={filters.areaId} onChange={(e) => onChange({ areaId: e.target.value })}>
            {areaOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>

        <label className="io2-filter-field">
          <span className="io2-filter-legend">{t('SEVERITY', 'חומרה')}</span>
          <select value={filters.severity} onChange={(e) => onChange({ severity: e.target.value })}>
            {SEVERITIES.map((o) => <option key={o.id} value={o.id}>{t(o.en, o.he)}</option>)}
          </select>
        </label>

        <label className="io2-filter-field">
          <span className="io2-filter-legend">{t('SOURCE', 'מקור')}</span>
          <select value={filters.sourceType} onChange={(e) => onChange({ sourceType: e.target.value })}>
            {SOURCES.map((o) => <option key={o.id} value={o.id}>{t(o.en, o.he)}</option>)}
          </select>
        </label>

        <label className="io2-filter-field">
          <span className="io2-filter-legend">{t('CONDITION', 'מצב התנאי')}</span>
          <select value={filters.activity} onChange={(e) => onChange({ activity: e.target.value })}>
            {ACTIVITY.map((o) => <option key={o.id} value={o.id}>{t(o.en, o.he)}</option>)}
          </select>
        </label>

        <label className="io2-filter-search">
          <span className="io2-filter-legend">{t('SEARCH', 'חיפוש')}</span>
          <input
            ref={searchRef}
            type="search"
            dir="ltr"
            value={filters.query}
            placeholder={t('alert / area / #track / T-target   [ / ]', 'התראה / אזור / #מסלול / T-מטרה   [ / ]')}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            aria-label={t('Search alerts', 'חיפוש התראות')}
          />
        </label>

        {filtered ? (
          <button type="button" className="io2-filter-reset" onClick={onReset}>
            {t('RESET', 'איפוס')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
