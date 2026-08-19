import { useId, useMemo, useState } from 'react'
import { useConcept } from '../../useConcept'
import { areaName } from '../areas.js'
import { matchesAreaQuery } from '../alertSelectors.js'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// [ AREAS ] — every configured area, always. Quiet areas are never hidden; they
// sink to the bottom, so the operator can always see the whole site.
//
// An area's severity comes ONLY from conditions that still hold and that nobody
// has closed (alertSelectors::areaOperationalSummary). An INFO contact does not
// light a zone up, and a RESOLVED alert does not keep it lit.
//
// Phase A3.2 adds a search box and lets the list use the panel's full height.
//
// The search is a DISPLAY FILTER and nothing else (§12). It lives in local state
// here rather than in the command centre on purpose: everything the hook exposes
// is operational state that other panels read, and a box an operator is typing in
// is neither. It cannot move the selection, change a severity, alter a count or
// touch an area's lifecycle — it decides which rows are painted, per render.
//
// Consequently a selected area that the query hides STAYS SELECTED (§12). The
// list says so rather than letting the selection look lost, because silently
// deselecting would mean the feed and the log changed what they show because
// somebody typed.

function Val({ children }) {
  return <bdi dir="ltr" className="io2-val">{children}</bdi>
}

function agoLabel(ms, now, t) {
  if (!ms) return t('no active events', 'אין אירועים פעילים')
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`
}

// One compact health chip per declared sensor. `MOCK` is grey, never green:
// synthetic data must not read as a working sensor.
function SensorChip({ id, state, connected, isReal }) {
  const tone = !isReal ? 'mock' : connected ? 'ok' : 'down'
  return (
    <span className={`io2-area-chip io2-area-chip--${tone}`} dir="ltr" title={`${id} · ${state}`}>
      <span className="io2-area-chip-id">{id}</span>
      <span className="io2-area-chip-state">{state}</span>
    </span>
  )
}

export function AreaList({ rows, selectedAreaId, onSelect, singleArea, now }) {
  const { t, lang } = useConcept()
  const [query, setQuery] = useState('')
  const searchId = useId()

  // No debounce (§10). The list is a handful of declared areas held in memory,
  // so filtering costs nothing and a delay would only make the box feel broken.
  const visible = useMemo(
    () => rows.filter((row) => matchesAreaQuery(row.area, query)),
    [rows, query]
  )

  if (!rows.length) {
    return <p className="io2-empty">{t('No areas configured', 'לא מוגדרים אזורים')}</p>
  }

  const filtering = query.trim().length > 0
  const selectedHidden = filtering && selectedAreaId &&
    rows.some((row) => row.areaId === selectedAreaId) &&
    !visible.some((row) => row.areaId === selectedAreaId)

  return (
    <div className="io2-areas">
      {/* Real-time, no submit button (§10). A search input rather than a text
          input so the platform gives it the clear affordance for free. */}
      <div className="io2-area-search">
        <label className="io2-area-search-label" htmlFor={searchId}>
          {t('FIND AREA', 'איתור אזור')}
        </label>
        <input
          id={searchId}
          type="search"
          className="io2-area-search-input"
          data-io2-area-search
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Name or ID', 'שם או מזהה')}
          autoComplete="off"
        />
      </div>

      {filtering ? (
        <p className="io2-area-search-state" aria-live="polite">
          <bdi dir="ltr">{visible.length}/{rows.length}</bdi>{' '}
          {t('AREAS SHOWN — DISPLAY FILTER ONLY', 'אזורים מוצגים — סינון תצוגה בלבד')}
        </p>
      ) : null}

      {selectedHidden ? (
        // The selection is deliberately untouched, so the panel says where it
        // went instead of leaving the operator to conclude it was cleared.
        <p className="io2-area-search-kept">
          {t('THE SELECTED AREA IS HIDDEN BY THIS SEARCH — IT IS STILL SELECTED',
            'האזור הנבחר מוסתר על ידי החיפוש — הבחירה נשמרה')}
        </p>
      ) : null}

      {singleArea ? (
        // Stated out loud so one row never reads as a truncated or broken list.
        <p className="io2-area-deploy" dir="ltr" title={t(
          'This deployment declares one area. No other area exists in the live configuration.',
          'הפריסה הזו מגדירה אזור אחד. אין אזור נוסף בתצורה החיה.'
        )}>
          {t('SINGLE-AREA DEPLOYMENT', 'פריסת אזור יחיד')}
        </p>
      ) : null}

      {filtering && !visible.length ? (
        <p className="io2-empty io2-area-empty">
          {t('NO AREA MATCHES THIS SEARCH', 'אין אזור התואם לחיפוש')}
        </p>
      ) : null}

      <ul className="io2-area-list">
        {visible.map((row) => {
          const selected = row.areaId === selectedAreaId
          return (
            <li key={row.areaId}>
              <button
                type="button"
                className={`io2-area-row io2-area-row--${row.severity.toLowerCase()} ${selected ? 'is-selected' : ''}`}
                onClick={() => onSelect(row.areaId)}
                aria-current={selected ? 'true' : undefined}
              >
                <span className="io2-area-head">
                  <span className={`io2-area-sev io2-area-sev--${row.severity.toLowerCase()}`} dir="ltr">
                    {row.severity}
                  </span>
                  <span className="io2-area-name">{areaName(row.area, lang)}</span>
                  <Val>{row.areaId}</Val>
                  {row.isDemo ? <DemoModeBadge when /> : null}
                </span>

                <span className="io2-area-meta" dir="ltr">
                  <span className="io2-area-count" title={t('Active alerts', 'התראות פעילות')}>
                    {row.activeCount} {t('ACTIVE', 'פעילות')}
                  </span>
                  {row.newCount > 0 ? (
                    <span className="io2-area-new" title={t('Unacknowledged', 'ללא אישור קבלה')}>
                      {row.newCount} NEW
                    </span>
                  ) : null}
                  <span className="io2-area-time">{agoLabel(row.lastEventAt, now, t)}</span>
                </span>

                <span className="io2-area-sensors">
                  {row.cameras.map((cam) => <SensorChip key={cam.id} {...cam} />)}
                  {row.radars.map((rdr) => <SensorChip key={rdr.id} {...rdr} />)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
