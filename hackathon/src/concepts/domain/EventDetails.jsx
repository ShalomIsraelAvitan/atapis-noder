import { useState } from 'react'
import { riskTone } from '../../design-lab/shared/adapter'
import { eventReasons } from '../data/useInvestigationViewModel'
import { useConcept } from '../useConcept'
import { DemoModeBadge } from './DemoModeBadge'

// Selected-event drilldown: real evidence snapshot (or Unavailable), stored
// risk breakdown, radar targets at the moment of the event, derived reasons.
//
// showSourceTabs is opt-in: it regroups the SAME stored fields under
// camera / radar / fusion tabs instead of one long column. Off by default so
// existing callers render exactly as before.
export function EventDetails({ event, isDemo = false, showSourceTabs = false, className = '' }) {
  const { t } = useConcept()
  const [imgFailed, setImgFailed] = useState(false)
  const [tab, setTab] = useState('camera')

  if (!event) {
    return <p className={`dm-empty ${className}`}>{t('Select an event to investigate.', 'בחרו אירוע לחקירה.')}</p>
  }

  const reasons = eventReasons(event, t)
  const radarTargets = Array.isArray(event.radar?.targets) ? event.radar.targets : []

  if (showSourceTabs) {
    const tabs = [
      { id: 'camera', label: t('Camera', 'מצלמה') },
      { id: 'radar', label: t('Radar', 'רדאר') },
      { id: 'fusion', label: t('Fusion', 'היתוך') },
    ]
    return (
      <div className={`dm-eventdetails dm-eventdetails--tabbed ${className}`} key={event.id}>
        <div className="dm-evidence">
          {event.imageUrl && !imgFailed ? (
            <img
              src={event.imageUrl}
              alt={t('Evidence snapshot', 'תמונת ראיה')}
              className="dm-evidence-img"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="dm-evidence-missing" dir="ltr">
              <p>{t('Snapshot unavailable', 'תמונת ראיה לא זמינה')}</p>
              <DemoModeBadge when={isDemo} />
            </div>
          )}
        </div>

        <div className="dm-evtabs" role="tablist" aria-label={t('Event sources', 'מקורות האירוע')}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'is-active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'camera' ? (
          <dl className="dm-eventmeta" dir="ltr">
            <div><dt>{t('Time', 'זמן')}</dt><dd>{event.dateLabel} {event.timeLabel}</dd></div>
            <div><dt>{t('Source', 'מקור')}</dt><dd>{event.source}</dd></div>
            <div><dt>{t('Motion', 'תנועה')}</dt><dd>{event.motion || '—'}</dd></div>
            <div><dt>{t('Context', 'הקשר')}</dt><dd>{event.context || '—'}</dd></div>
            <div><dt>{t('Persons', 'אנשים')}</dt><dd>{event.personCount}</dd></div>
            <div><dt>{t('Weapon', 'נשק')}</dt><dd className={event.hasWeapon ? 'dm-tone-danger' : ''}>{event.hasWeapon ? event.weaponType || 'YES' : '—'}</dd></div>
            <div><dt>Camera risk</dt><dd>{event.cameraRisk}</dd></div>
            <div>
              <dt>{t('Detection confidence', 'ביטחון זיהוי')}</dt>
              <dd>{typeof event.confidence === 'number' ? `${Math.round(event.confidence * 100)}%` : t('Unavailable', 'לא זמין')}</dd>
            </div>
          </dl>
        ) : null}

        {tab === 'radar' ? (
          <div className="dm-eventradar">
            <dl className="dm-eventmeta" dir="ltr">
              <div><dt>Radar risk</dt><dd>{event.radarRisk}</dd></div>
              <div><dt>{t('Targets', 'מטרות')}</dt><dd>{radarTargets.length}</dd></div>
            </dl>
            {radarTargets.length ? (
              <ul className="dm-eventradar-list" dir="ltr">
                {radarTargets.map((target, index) => (
                  <li key={index}>
                    T{target.id ?? target.radar_id ?? index} · {((Number(target.distance_mm) || 0) / 1000).toFixed(1)} m ·{' '}
                    {((Number(target.speed_cm_s) || 0) / 100).toFixed(2)} m/s · {target.direction || '—'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dm-empty" dir="ltr">
                {event.radar ? `RADAR ${event.radar.radar_status || 'NO TARGETS'}` : t('Unavailable', 'לא זמין')}
              </p>
            )}
          </div>
        ) : null}

        {tab === 'fusion' ? (
          <div className="dm-eventreasons">
            <dl className="dm-eventmeta" dir="ltr">
              <div><dt>{t('Mode', 'מצב')}</dt><dd className={`dm-tone-${riskTone(event.fusedRisk)}`}>{event.mode}</dd></div>
              <div><dt>Fused risk</dt><dd className={`dm-tone-${riskTone(event.fusedRisk)}`}>{event.fusedRisk}</dd></div>
            </dl>
            <h3 className="dm-subtitle">{t('Why this risk?', 'למה הסיכון הזה?')}</h3>
            {reasons.length ? (
              <ul className="dm-why-list">
                {reasons.map((reason) => (
                  <li key={reason.key} className={`dm-why-item dm-why-item--${reason.severity}`}>
                    <span className="dm-why-text">{reason.text}</span>
                    <span className="dm-why-meta" dir="ltr">{reason.source}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dm-empty">{t('No stored risk factors for this event.', 'אין גורמי סיכון שמורים לאירוע זה.')}</p>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`dm-eventdetails ${className}`} key={event.id}>
      <div className="dm-evidence">
        {event.imageUrl && !imgFailed ? (
          <img
            src={event.imageUrl}
            alt={t('Evidence snapshot', 'תמונת ראיה')}
            className="dm-evidence-img"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="dm-evidence-missing" dir="ltr">
            <p>{t('Snapshot unavailable', 'תמונת ראיה לא זמינה')}</p>
            <DemoModeBadge when={isDemo} />
          </div>
        )}
      </div>

      <dl className="dm-eventmeta" dir="ltr">
        <div><dt>{t('Time', 'זמן')}</dt><dd>{event.dateLabel} {event.timeLabel}</dd></div>
        <div><dt>{t('Mode', 'מצב')}</dt><dd className={`dm-tone-${riskTone(event.fusedRisk)}`}>{event.mode}</dd></div>
        <div><dt>{t('Source', 'מקור')}</dt><dd>{event.source}</dd></div>
        <div><dt>{t('Motion', 'תנועה')}</dt><dd>{event.motion || '—'}</dd></div>
        <div><dt>{t('Context', 'הקשר')}</dt><dd>{event.context || '—'}</dd></div>
        <div><dt>{t('Persons', 'אנשים')}</dt><dd>{event.personCount}</dd></div>
        <div><dt>{t('Weapon', 'נשק')}</dt><dd className={event.hasWeapon ? 'dm-tone-danger' : ''}>{event.hasWeapon ? event.weaponType || 'YES' : '—'}</dd></div>
        <div><dt>Camera risk</dt><dd>{event.cameraRisk}</dd></div>
        <div><dt>Radar risk</dt><dd>{event.radarRisk}</dd></div>
        <div><dt>Fused risk</dt><dd className={`dm-tone-${riskTone(event.fusedRisk)}`}>{event.fusedRisk}</dd></div>
        <div>
          <dt>{t('Detection confidence', 'ביטחון זיהוי')}</dt>
          <dd>{typeof event.confidence === 'number' ? `${Math.round(event.confidence * 100)}%` : t('Unavailable', 'לא זמין')}</dd>
        </div>
      </dl>

      <div className="dm-eventreasons">
        <h3 className="dm-subtitle">{t('Why this risk?', 'למה הסיכון הזה?')}</h3>
        {reasons.length ? (
          <ul className="dm-why-list">
            {reasons.map((reason) => (
              <li key={reason.key} className={`dm-why-item dm-why-item--${reason.severity}`}>
                <span className="dm-why-text">{reason.text}</span>
                <span className="dm-why-meta" dir="ltr">{reason.source}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dm-empty">{t('No stored risk factors for this event.', 'אין גורמי סיכון שמורים לאירוע זה.')}</p>
        )}
      </div>

      <div className="dm-eventradar">
        <h3 className="dm-subtitle">{t('Radar at event time', 'רדאר בזמן האירוע')}</h3>
        {radarTargets.length ? (
          <ul className="dm-eventradar-list" dir="ltr">
            {radarTargets.map((target, index) => (
              <li key={index}>
                T{target.id ?? target.radar_id ?? index} · {((Number(target.distance_mm) || 0) / 1000).toFixed(1)} m ·{' '}
                {((Number(target.speed_cm_s) || 0) / 100).toFixed(2)} m/s · {target.direction || '—'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="dm-empty" dir="ltr">
            {event.radar ? `RADAR ${event.radar.radar_status || 'NO TARGETS'}` : t('Unavailable', 'לא זמין')}
          </p>
        )}
      </div>
    </div>
  )
}
