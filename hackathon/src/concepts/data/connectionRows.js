import { backendDotState } from '../../design-lab/shared/adapter'

// Pure row builder for the combined connection + sensor health panel.
// Kept out of the component file so ConnectionHealth.jsx only exports a
// component (react-refresh/only-export-components). A concept can call this
// directly to render its own layout.
export function connectionRows(snapshot, backendStatus, sensor, t) {
  const weapon =
    snapshot.cameras.webcam.weaponDetectionAvailable ?? snapshot.cameras.dahua.weaponDetectionAvailable
  return [
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
      key: 'weapon-model',
      state: weapon === false ? 'warn' : weapon === true ? 'ok' : 'off',
      label: t('Weapon model', 'מודל נשק'),
      detail: weapon === false ? t('Unavailable', 'לא זמין') : weapon === true ? 'OK' : '—',
    },
    {
      key: 'sensor',
      state: sensor ? (sensor.connected === true ? 'ok' : sensor.connected === false ? 'err' : 'off') : 'off',
      label: t('Aux sensor', 'חיישן עזר'),
      detail: sensor?.port || sensor?.message || t('Unavailable', 'לא זמין'),
    },
  ]
}
