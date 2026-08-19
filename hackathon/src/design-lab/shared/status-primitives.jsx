import { useEffect, useRef, useState } from 'react'
import { modeTone } from './adapter'

// --- AnimatedNumber -------------------------------------------------------
// Smoothly interpolates toward the target value (respects reduced motion —
// under reduce the duration collapses to a single animation frame).
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function AnimatedNumber({ value, duration = 350, className, decimals = 0 }) {
  const target = Number(value) || 0
  const [display, setDisplay] = useState(target)
  const frameRef = useRef(null)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return undefined
    const effectiveDuration = prefersReducedMotion() ? 1 : duration
    const start = performance.now()
    const step = (now) => {
      const p = Math.min((now - start) / effectiveDuration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = from + (target - from) * eased
      setDisplay(next)
      if (p < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return (
    <span className={className} dir="ltr">
      {display.toFixed(decimals)}
    </span>
  )
}

// --- ModeBadge -------------------------------------------------------------
export function ModeBadge({ mode, className = '' }) {
  return (
    <span className={`dl-mode dl-mode--${modeTone(mode)} ${className}`} dir="ltr">
      {mode}
    </span>
  )
}

// --- StatusDot -------------------------------------------------------------
// state: 'ok' | 'warn' | 'err' | 'off'
export function StatusDot({ state, label, className = '' }) {
  return (
    <span className={`dl-status-dot-wrap ${className}`}>
      <span className={`dl-status-dot dl-status-dot--${state}`} aria-hidden="true" />
      {label ? <span className="dl-status-dot-label">{label}</span> : null}
    </span>
  )
}

