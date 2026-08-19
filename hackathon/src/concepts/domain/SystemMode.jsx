import { modeTone } from '../../design-lab/shared/adapter'
import { useConcept } from '../useConcept'

// Global system mode — the single most important datum in the product.
// Concepts control size/placement purely via CSS on .dm-sysmode.
export function SystemMode({ snapshot, showContext = true, className = '' }) {
  const { t } = useConcept()
  const tone = modeTone(snapshot.mode)
  return (
    <div className={`dm-sysmode dm-sysmode--${tone} ${className}`}>
      <span className="dm-sysmode-label">{t('System mode', 'מצב מערכת')}</span>
      <strong className="dm-sysmode-value" dir="ltr" aria-live="polite">{snapshot.mode}</strong>
      {showContext && snapshot.context ? (
        <span className="dm-sysmode-context" dir="ltr">{snapshot.context}</span>
      ) : null}
    </div>
  )
}
