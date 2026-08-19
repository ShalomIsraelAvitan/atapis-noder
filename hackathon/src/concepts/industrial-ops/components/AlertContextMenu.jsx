// Alert context menu (Phase A2) — a SECONDARY path, never the only one.
//
// Everything this menu offers is also a button in the Operational Action Bar.
// A right-click menu that is the only way to reach an action is an action most
// operators will never find, and one that a keyboard user cannot reach at all.
//
// It dispatches through the same `onAction(actionId, alertId)` the bar uses, so
// there is exactly one implementation of what an action means. It contains no
// lifecycle logic and imports nothing from the engine.
//
// It is an overlay: fixed position, top of the industrial z-scale, so it adds
// nothing to the document height and cannot reflow the grid.

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useConcept } from '../../useConcept'
import { ACTION_LABEL, pickLabel } from './alertLabels.js'

const MARGIN = 8

export function AlertContextMenu({ alert, x, y, actions = [], onAction, onClose }) {
  const { t, lang } = useConcept()
  const ref = useRef(null)

  // Measure, then move. Writing to style directly rather than through state
  // keeps this a single paint and adds no render pass.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const left = Math.max(MARGIN, Math.min(x, window.innerWidth - box.width - MARGIN))
    const top = Math.max(MARGIN, Math.min(y, window.innerHeight - box.height - MARGIN))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
    const first = el.querySelector('[role="menuitem"]')
    if (first) first.focus()
  }, [x, y])

  // Anything that moves the menu away from the row it belongs to closes it.
  // Scroll is captured, because the alert list scrolls inside the page.
  useEffect(() => {
    const close = () => onClose()
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) onClose()
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    document.addEventListener('mousedown', onPointer, true)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
      document.removeEventListener('mousedown', onPointer, true)
    }
  }, [onClose])

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const list = [...(ref.current?.querySelectorAll('[role="menuitem"]') || [])]
    if (!list.length) return
    const at = list.indexOf(document.activeElement)
    const next = event.key === 'ArrowDown'
      ? (at + 1) % list.length
      : (at <= 0 ? list.length - 1 : at - 1)
    list[next].focus()
  }

  const copyId = async () => {
    // The FULL id, never the truncated display value. Clipboard access can be
    // refused outside a secure context; that is a no-op, not a crash.
    try {
      await navigator.clipboard.writeText(alert.id)
    } catch {
      /* no clipboard permission — the id stays visible and selectable in the bar */
    }
    onClose()
  }

  return (
    <div
      className="io2-ctxmenu"
      role="menu"
      aria-label={t('Alert actions', 'פעולות על ההתראה')}
      ref={ref}
      style={{ visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      data-io2-ctxmenu={alert.id}
      data-io2-actions={actions.length}
    >
      <p className="io2-ctxmenu-head">
        <bdi dir="ltr" title={alert.id}>{alert.id}</bdi>
      </p>
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          role="menuitem"
          className="io2-ctxmenu-item"
          data-io2-menu-action={action}
          onClick={() => { onAction(action, alert.id); onClose() }}
        >
          {pickLabel(ACTION_LABEL, action, lang)}
        </button>
      ))}
      <button
        type="button"
        role="menuitem"
        className="io2-ctxmenu-item io2-ctxmenu-item--copy"
        data-io2-menu-action="copy-id"
        data-io2-copy-value={alert.id}
        onClick={copyId}
      >
        {t('COPY ALERT ID', 'העתק מזהה התראה')}
      </button>
    </div>
  )
}
