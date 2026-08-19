import { useConcept } from '../useConcept'
import { riskTone, formatDistance, formatSpeed } from '../../design-lab/shared/adapter'
import { pairLabel, associationLabel } from '../data/candidatePairs'
import { DemoModeBadge } from './DemoModeBadge'

// A camera<->radar candidate pair, for DISPLAY only.
//
// Honesty is the whole point of this component: in live mode the association is
// ALWAYS shown as "Unverified" text, never a percentage. A numeric confidence
// and the FC-nn identifier appear only for demo scenario data, and then a
// DemoModeBadge is rendered right beside it. The per-pair risk is labeled
// "Pair risk" with its basis — never "Fused Risk" (that is the backend value).
export function ContactPairCard({ pair, selected = false, onSelect, variant = 'card', className = '' }) {
  const { t, lang } = useConcept()
  if (!pair) return null

  const unavailable = pair.associationState === 'unavailable'
  const demo = pair.associationState === 'demo-verified'
  const basis = pair.association ? (lang === 'he' ? pair.association.basisHe : pair.association.basisEn) : null
  const behaviorState = pair.behavior.state
  const Tag = onSelect ? 'button' : 'div'

  return (
    <Tag
      type={onSelect ? 'button' : undefined}
      className={`dm-cp dm-cp--${variant} ${selected ? 'is-selected' : ''} ${className}`}
      onClick={onSelect ? () => onSelect(pair) : undefined}
      aria-pressed={onSelect ? selected : undefined}
    >
      <div className="dm-cp-head">
        <span className="dm-cp-id" dir="ltr">{pairLabel(pair, t)}</span>
        {pair.associationState === 'candidate' ? (
          <span className="dm-cp-unverified">{t('Unverified', 'לא מאומת')}</span>
        ) : null}
        {demo ? <DemoModeBadge /> : null}
      </div>

      <div className="dm-cp-sources" dir="ltr">
        <span className={pair.source.camera ? '' : 'is-off'}>
          {t('Camera', 'מצלמה')} {pair.cameraTrackId !== null ? `#${pair.cameraTrackId}` : '—'}
        </span>
        <span className={pair.source.radar ? '' : 'is-off'}>
          {t('Radar', 'רדאר')} {pair.radarTargetId !== null ? `T${pair.radarTargetId}` : '—'}
        </span>
      </div>

      <dl className="dm-cp-metrics" dir="ltr">
        <div className="dm-cp-metric">
          <dt>{t('Pair risk', 'סיכון הזוג')}</dt>
          <dd className={`dm-tone-${riskTone(pair.pairRisk.value)}`}>
            {pair.pairRisk.value}
            <span className="dm-cp-basis">{pair.pairRisk.basis}</span>
          </dd>
        </div>
        <div className="dm-cp-metric">
          <dt>{t('Behavior', 'התנהגות')}</dt>
          <dd>{behaviorState || (pair.behavior.approachingGate ? t('Approaching gate', 'מתקרב לשער') : '—')}</dd>
        </div>
        <div className="dm-cp-metric">
          <dt>{t('Distance', 'מרחק')}</dt>
          <dd>{pair.distance.mm !== null ? formatDistance(pair.distance.mm) : '—'}</dd>
        </div>
        <div className="dm-cp-metric">
          <dt>{t('Speed', 'מהירות')}</dt>
          <dd>{pair.speed.cmS !== null ? formatSpeed(pair.speed.cmS) : '—'}</dd>
        </div>
        <div className="dm-cp-metric">
          <dt>{t('Weapon', 'נשק')}</dt>
          <dd className={pair.hasWeapon ? 'dm-tone-danger' : ''}>
            {pair.hasWeapon === null ? '—' : pair.hasWeapon ? t('Yes', 'כן') : t('No', 'לא')}
          </dd>
        </div>
      </dl>

      <p className={`dm-cp-assoc ${unavailable ? 'dm-cp-assoc--unavailable' : ''}`}>
        <span className="dm-cp-assoc-label">{t('Association', 'שיוך')}:</span>{' '}
        <span className="dm-cp-assoc-value" dir="ltr">
          {unavailable
            ? t('Association unavailable', 'שיוך לא זמין')
            : demo
              ? associationLabel(pair.association, t)
              : t('Unverified', 'לא מאומת')}
        </span>
        {basis ? <span className="dm-cp-assoc-basis">{basis}</span> : null}
      </p>
    </Tag>
  )
}

export function ContactPairList({ pairs, selectedId, onSelect, variant = 'card', className = '' }) {
  const { t } = useConcept()
  if (!pairs || !pairs.length) {
    return <p className="dm-empty">{t('No contacts.', 'אין מגעים.')}</p>
  }
  return (
    <div className={`dm-cp-list ${className}`}>
      {pairs.map((pair) => (
        <ContactPairCard
          key={pair.id}
          pair={pair}
          variant={variant}
          selected={selectedId != null && (pair.radarTargetId === selectedId || pair.cameraTrackId === selectedId)}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
