import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function mediaQuery() {
  if (typeof window === 'undefined' || !window.matchMedia) return null
  return window.matchMedia(QUERY)
}

// One-shot read, for non-React callers (e.g. an rAF driver picking a duration).
export function prefersReducedMotion() {
  return mediaQuery()?.matches ?? false
}

function subscribe(onChange) {
  const mql = mediaQuery()
  if (!mql) return () => {}
  // addEventListener is the modern API; addListener is the Safari <14 fallback.
  if (mql.addEventListener) {
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }
  mql.addListener(onChange)
  return () => mql.removeListener(onChange)
}

// Subscribes to the media query rather than reading once at mount, so toggling
// the OS setting takes effect without a page reload.
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}
