import { useCallback, useRef, useState } from 'react'
import { useConcept } from '../../useConcept'
import { areaName } from '../areas.js'
import { LIFECYCLE } from '../alerts.js'

// [ OPERATIONAL ALERTS ] — the operational centre of the screen.
//
// Two honesty rules are enforced in the markup itself, not left to a caller:
//
//  1. A camera alert prints CAMERA SOURCE NOT IDENTIFIED. The backend merges all
//     camera sources into one global snapshot and tracks carry no camera id, so
//     naming CAM-01 would be a guess presented as a fact. A radar alert MAY show
//     RDR-01, because exactly one radar is declared per area.
//  2. Each row is one source. Camera, radar and system alerts never merge, and
//     other open alerts in the same area appear as "not associated" context.
//
// Lifecycle is displayed but never acted on here — the actions are Phase A2.
// Every row that shows a lifecycle also shows SESSION-LOCAL, because none of it
// is stored on the server.

const LIFECYCLE_LABEL = {
  [LIFECYCLE.NEW]: { en: 'NEW', he: 'חדשה' },
  [LIFECYCLE.ACKNOWLEDGED]: { en: 'ACK', he: 'אושרה' },
  [LIFECYCLE.IN_REVIEW]: { en: 'IN REVIEW', he: 'בטיפול' },
  [LIFECYCLE.RESOLVED]: { en: 'RESOLVED', he: 'נסגרה' },
}

function Val({ children }) {
  return <bdi dir="ltr" className="io2-val">{children}</bdi>
}

// The row shows a compact age and carries the precise wording in its tooltip.
// The distinction matters and is never dropped: this is when the SESSION first
// saw the condition, not when the condition began — the backend does not report
// that, and the tooltip says so.
function seenLabel(alert, now, t) {
  const fmt = (s) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`)
  const first = fmt(Math.max(0, Math.round((now - (alert.firstSeenAt || now)) / 1000)))
  if (!alert.active && alert.clearedAt) {
    const gone = fmt(Math.max(0, Math.round((now - alert.clearedAt) / 1000)))
    return {
      short: `${first} / ${gone}`,
      title: t(`First seen ${first} ago in this session · condition cleared ${gone} ago`,
        `נראתה לראשונה לפני ${first} בסשן זה · התנאי חדל לפני ${gone}`),
    }
  }
  return {
    short: first,
    title: t(`First seen ${first} ago in this session`, `נראתה לראשונה לפני ${first} בסשן זה`),
  }
}

function sourceLabel(alert, t) {
  if (alert.sourceType === 'camera') {
    return alert.cameraSourceKnown && alert.sourceId
      ? alert.sourceId
      : t('CAMERA SOURCE NOT IDENTIFIED', 'מקור המצלמה אינו מזוהה')
  }
  if (alert.sourceType === 'radar') {
    return alert.sourceId || t('RADAR', 'רדאר')
  }
  return t('SYSTEM', 'מערכת')
}

export function AlertList({
  alerts, selectedAlertId, onSelect, areas, now, onRowMenu = null,
}) {
  const { t, lang } = useConcept()
  const listRef = useRef(null)

  // Roving tabindex: exactly one row is tabbable and arrow keys move FOCUS.
  // Focus is NOT selection — arrowing through the list must not silently change
  // what every other panel is showing. Until the operator moves focus, the
  // tabbable row is the selected one, derived during render rather than mirrored
  // into state, so the two can never drift apart.
  const [focusIndex, setFocusIndex] = useState(null)
  const selectedIndex = Math.max(0, alerts.findIndex((a) => a.id === selectedAlertId))
  const activeIndex = focusIndex === null
    ? selectedIndex
    : Math.min(Math.max(focusIndex, 0), Math.max(0, alerts.length - 1))

  const moveFocus = useCallback((delta) => {
    const rows = listRef.current?.querySelectorAll('[data-io2-alert-row]')
    if (!rows || !rows.length) return
    setFocusIndex((current) => {
      const from = current === null ? selectedIndex : current
      const next = Math.min(rows.length - 1, Math.max(0, from + delta))
      const el = rows[next]
      if (el) {
        el.focus()
        el.scrollIntoView({ block: 'nearest' })
      }
      return next
    })
  }, [selectedIndex])

  // The context menu acts on the row it was opened from, so that row is selected
  // first — the menu and the action bar then describe the same alert. The row's
  // own markup is untouched: the handlers live on the container, so nothing here
  // can change a row's height.
  const openMenu = useCallback((id, at) => {
    if (!onRowMenu || !id) return
    onSelect(id)
    onRowMenu(id, at)
  }, [onRowMenu, onSelect])

  const onContextMenu = useCallback((event) => {
    const row = event.target?.closest?.('[data-io2-alert-row]')
    if (!row || !onRowMenu) return
    event.preventDefault()
    openMenu(row.getAttribute('data-io2-alert-row'), { x: event.clientX, y: event.clientY })
  }, [onRowMenu, openMenu])

  const onKeyDown = useCallback((event) => {
    if (event.repeat || event.isComposing) return
    if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(-1) }
    else if (event.key === ' ' || event.key === 'Spacebar') {
      // Space selects the focused row. Enter is deliberately NOT bound: opening
      // in OPT is Phase D, and a key that silently does nothing is worse than
      // one that is not bound at all.
      event.preventDefault()
      const id = event.target?.getAttribute?.('data-io2-alert-row')
      if (id) onSelect(id)
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      // The keyboard route to the same menu. Anchored to the focused row, since
      // there is no pointer position to anchor to.
      const row = event.target?.closest?.('[data-io2-alert-row]')
      if (!row || !onRowMenu) return
      event.preventDefault()
      const box = row.getBoundingClientRect()
      openMenu(row.getAttribute('data-io2-alert-row'), { x: box.left + 12, y: box.bottom })
    }
  }, [moveFocus, onSelect, onRowMenu, openMenu])

  if (!alerts.length) {
    return (
      <div className="io2-alerts-empty" data-io2-focus="alerts">
        <p className="io2-empty-title" dir="ltr">{t('NO ACTIVE ALERTS', 'אין התראות פעילות')}</p>
        <p className="io2-empty-note">
          {t('All configured areas remain visible.', 'כל האזורים המוגדרים נשארים גלויים.')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="io2-alerts-scroll"
      data-io2-focus="alerts"
      ref={listRef}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      role="listbox"
      aria-label={t('Operational alerts', 'התראות מבצעיות')}
      tabIndex={-1}
    >
      <ul className="io2-alert-list">
        {alerts.map((alert, index) => {
          const selected = alert.id === selectedAlertId
          const area = areas.find((a) => a.id === alert.areaId) || null
          const life = LIFECYCLE_LABEL[alert.lifecycle] || { en: alert.lifecycle, he: alert.lifecycle }
          const seen = seenLabel(alert, now, t)
          return (
            <li key={alert.id}>
              <div
                data-io2-alert-row={alert.id}
                role="option"
                aria-selected={selected}
                tabIndex={index === activeIndex ? 0 : -1}
                className={`io2-alert-row io2-alert-row--${alert.severity} ${selected ? 'is-selected' : ''} ${alert.active ? '' : 'is-cleared'}`}
                onClick={() => onSelect(alert.id)}
              >
                <div className="io2-alert-line1">
                  <span className={`io2-alert-sev io2-alert-sev--${alert.severity}`} dir="ltr">
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="io2-alert-area">{area ? areaName(area, lang) : alert.areaId}</span>
                  <span className="io2-alert-msg">{lang === 'he' ? alert.messageHe : alert.message}</span>
                  {/* A compact marker rather than the full badge: at one badge
                      per row it wrapped to its own line and cut the number of
                      alerts an operator could see roughly in half. The screen is
                      still unmistakably demo — DATA DEMO in the status strip,
                      DEMO on the bottom bar, MOCK on the plot and on every
                      sensor chip, and the demo badge on the area itself. */}
                  {alert.isDemo ? (
                    <span className="io2-alert-demo" dir="ltr" title="Demo data — design preview">DEMO</span>
                  ) : null}
                </div>

                <div className="io2-alert-line2">
                  <span className="io2-alert-src">{sourceLabel(alert, t)}</span>
                  {alert.trackId !== null && alert.trackId !== undefined ? (
                    <><span className="io2-alert-sep">·</span><Val>#{alert.trackId}</Val></>
                  ) : null}
                  {alert.targetId !== null && alert.targetId !== undefined ? (
                    <><span className="io2-alert-sep">·</span><Val>T{alert.targetId}</Val></>
                  ) : null}
                  <span className="io2-alert-sep">·</span>
                  <bdi dir="ltr" className="io2-alert-age" title={seen.title}>{seen.short}</bdi>
                  <span className="io2-alert-sep">·</span>
                  <span className={`io2-alert-life io2-alert-life--${alert.lifecycle.toLowerCase()}`}>
                    {t(life.en, life.he)}
                  </span>
                  {alert.owner?.name ? (
                    <><span className="io2-alert-sep">·</span><span className="io2-alert-owner">{alert.owner.name}</span></>
                  ) : null}
                  {!alert.active ? (
                    <><span className="io2-alert-sep">·</span>
                      <span className="io2-alert-cleared">{t('CONDITION CLEARED', 'התנאי חדל')}</span></>
                  ) : null}
                  {/* Never implied, always stated, and sitting on the same line
                      as the lifecycle it qualifies. Abbreviated so it fits
                      beside it; the full sentence is one hover away and the
                      panel caption states it in full for the whole list. */}
                  <span className="io2-alert-sep">·</span>
                  <bdi dir="ltr" className="io2-alert-local" title="Session-local workflow — not persisted on the server">
                    SESSION-LOCAL
                  </bdi>
                </div>

                {/* Phase A1 put an "other active evidence in this area" line
                    here, on the selected row only. Phase A2 removes it: a row
                    that grows when it is selected pushes every row below it
                    down, and with an action bar above the list the operator is
                    now clicking between two moving targets. Every row is the
                    same height in every state.

                    Nothing is lost from the screen. The same context — stated
                    the same way, AREA CONTEXT — NOT ASSOCIATED — is in the risk
                    factors panel, which labels every factor it cannot tie to
                    the selected contact. (Phase A3.1.1 removed the decision
                    band that used to carry a second copy of it.) */}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
