// Neutral "this is preview data, not live telemetry" chip.
//
// Deliberately NOT amber: amber is the ALERT hue, and a permanent amber chip on
// every demo screen trains operators to ignore the alert color. Styled gray via
// .dm-demo-tag (see concepts-base.css). The text is kept byte-identical to the
// literals it replaces so screenshot/QA tooling that matches on it still works.
export function DemoModeBadge({ when = true, variant = 'inline', className = '' }) {
  if (!when) return null
  return (
    <span className={`dm-demo-tag dm-demo-tag--${variant} ${className}`} dir="ltr">
      DEMO DATA — DESIGN PREVIEW
    </span>
  )
}
