import { StatusDot } from '../../design-lab/shared/status-primitives'
import { backendDotState } from '../../design-lab/shared/adapter'
import { useConcept } from '../useConcept'

// Connection/health board: backend, cameras, radar (with provider), sensor.
export function StatusBoard({ snapshot, backendStatus, sensor, className = '' }) {
  const { t } = useConcept()
  const rows = [
    {
      key: 'backend',
      state: backendDotState(backendStatus),
      label: t('Backend', 'שרת'),
      detail: backendStatus,
    },
    {
      key: 'webcam',
      state: snapshot.cameras.webcam.connected ? 'ok' : 'err',
      label: t('Local camera', 'מצלמה מקומית'),
      detail: snapshot.cameras.webcam.status,
    },
    {
      key: 'dahua',
      state: snapshot.cameras.dahua.connected ? 'ok' : 'err',
      label: t('Dahua camera', 'מצלמת Dahua'),
      detail: snapshot.cameras.dahua.status,
    },
    {
      key: 'radar',
      state: snapshot.radar.connected ? 'ok' : 'err',
      label: t('Radar', 'רדאר'),
      detail: `${snapshot.radar.status}${snapshot.radar.provider ? ` · ${snapshot.radar.provider}` : ''}`,
    },
    {
      key: 'sensor',
      state: sensor ? (sensor.connected === true ? 'ok' : sensor.connected === false ? 'err' : 'off') : 'off',
      label: t('Aux sensor', 'חיישן עזר'),
      detail: sensor?.port || sensor?.message || t('Unavailable', 'לא זמין'),
    },
  ]
  return (
    <ul className={`dm-statusboard ${className}`}>
      {rows.map((row) => (
        <li key={row.key} className="dm-statusboard-row">
          <StatusDot state={row.state} label={row.label} />
          <span className="dm-statusboard-detail" dir="ltr">{row.detail}</span>
        </li>
      ))}
    </ul>
  )
}
