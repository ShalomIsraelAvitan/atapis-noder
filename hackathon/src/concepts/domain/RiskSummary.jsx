import { AnimatedNumber } from '../../design-lab/shared/status-primitives'
import { riskTone } from '../../design-lab/shared/adapter'
import { useConcept } from '../useConcept'

// Fused / camera / radar risk numbers. Fused is primary.
export function RiskSummary({ snapshot, className = '' }) {
  const { t } = useConcept()
  const { fused, camera, radar } = snapshot.risks
  return (
    <div className={`dm-risks ${className}`}>
      <div className={`dm-risk dm-risk--primary dm-tone-${riskTone(fused)}`}>
        <span className="dm-risk-label">{t('Fused risk', 'סיכון ממוזג')}</span>
        <AnimatedNumber value={fused} className="dm-risk-value" />
      </div>
      <div className={`dm-risk dm-tone-${riskTone(camera)}`}>
        <span className="dm-risk-label">{t('Camera', 'מצלמה')}</span>
        <AnimatedNumber value={camera} className="dm-risk-value" />
      </div>
      <div className={`dm-risk dm-tone-${riskTone(radar)}`}>
        <span className="dm-risk-label">{t('Radar', 'רדאר')}</span>
        <AnimatedNumber value={radar} className="dm-risk-value" />
      </div>
    </div>
  )
}
