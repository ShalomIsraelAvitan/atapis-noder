import { useConcept } from '../useConcept'

// "Why this risk?" — contributing signals derived strictly from system data.
// Radar confidence is real (API field); fused confidence does not exist yet
// and is always presented as "Confidence metric not yet available".
export function WhyThisRisk({ reasons, contributions, className = '' }) {
  const { t } = useConcept()
  return (
    <div className={`dm-why ${className}`}>
      {reasons.length ? (
        <ul className="dm-why-list">
          {reasons.map((reason) => (
            <li key={reason.key} className={`dm-why-item dm-why-item--${reason.severity}`}>
              <span className="dm-why-text">{reason.text}</span>
              <span className="dm-why-meta" dir="ltr">
                {reason.source}
                {typeof reason.contribution === 'number' ? ` · ${reason.contribution}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dm-empty">{t('No active risk factors. Perimeter quiet.', 'אין גורמי סיכון פעילים. ההיקף שקט.')}</p>
      )}
      {contributions ? (
        <dl className="dm-why-contrib" dir="ltr">
          <div>
            <dt>{t('Camera risk', 'סיכון מצלמה')}</dt>
            <dd>{contributions.camera.risk}</dd>
          </div>
          <div>
            <dt>{t('Radar risk', 'סיכון רדאר')}</dt>
            <dd>
              {contributions.radar.risk}
              {contributions.radar.confidence
                ? ` (conf ${Math.round(contributions.radar.confidence * 100)}%)`
                : ''}
            </dd>
          </div>
          <div>
            <dt>{t('Fused confidence', 'ביטחון ממוזג')}</dt>
            <dd className="dm-why-na">{t('Confidence metric not yet available', 'מדד ביטחון עדיין לא זמין')}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}
