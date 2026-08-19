// Industrial Ops keyboard shortcuts: Alt+<digit> only, never while the operator
// is typing. Focus shortcuts resolve their target through a data attribute so a
// panel can move between files without touching the key map.

const TYPING_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

export function isTypingTarget(target) {
  if (!target || typeof target.closest !== 'function') return false
  return Boolean(target.closest(TYPING_SELECTOR) || target.closest('dialog'))
}

// True when a global shortcut must stay silent: key repeat, IME composition, or
// the event originating inside an editable field.
export function shouldIgnoreShortcut(event) {
  return Boolean(event.repeat) || Boolean(event.isComposing) || isTypingTarget(event.target)
}

// Alt+7/8/9 targets. A region is optional: when the panel is not on screen the
// shortcut is a no-op rather than an error.
export const FOCUS_REGIONS = {
  7: 'log',
  8: 'radar-targets',
  9: 'camera-tracks',
}

export function focusRegion(region) {
  const el = document.querySelector(`[data-io2-focus="${region}"]`)
  if (!el) return false
  el.focus({ preventScroll: false })
  return true
}
