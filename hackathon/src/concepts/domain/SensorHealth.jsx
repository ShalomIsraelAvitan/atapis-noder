import { useConcept } from '../useConcept'

// Condense a backend serial error into one operational line. The full text stays
// available behind the disclosure; nothing is rewritten or hidden.
function shortRadarError(raw, t) {
  const text = String(raw || '')
  const port = text.match(/COM\d+/i)
  if (/could not open port/i.test(text) && port) {
    return t(`${port[0].toUpperCase()} unavailable`, `‏${port[0].toUpperCase()} לא זמין`)
  }
  if (/permission|access is denied/i.test(text)) {
    return port
      ? t(`${port[0].toUpperCase()} busy — access denied`, `‏${port[0].toUpperCase()} תפוס — הגישה נדחתה`)
      : t('Serial port busy', 'פורט טורי תפוס')
  }
  if (/not configured/i.test(text)) return t('Radar port not configured', 'פורט הרדאר לא מוגדר')
  const firstLine = text.split(/[\n\r]/)[0]
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine
}

// Subsystem health. Imported only by the Industrial Ops OPS screen.
//
// Colour contract (the reason this was restructured):
//   green  = a live, healthy link
//   grey   = demo / mock — synthetic data, never dressed as a healthy live link
//   amber  = degraded or stale
//   red    = offline / failed
//
// `fresh` and `backendStatus` are optional. Without them the panel falls back to
// the original rows, so the component still renders standalone.
export function SensorHealth({ snapshot, sensor, className = '', fresh = null, backendStatus = null }) {
  const { t } = useConcept()
  const weapon = snapshot.cameras.webcam.weaponDetectionAvailable ?? snapshot.cameras.dahua.weaponDetectionAvailable

  const radarMock = fresh
    ? fresh.radarMock
    : /MOCK|DEMO/i.test(String(snapshot.radar.status || '')) || snapshot.radar.provider === 'demo'

  const radarState = fresh ? fresh.radarState : snapshot.radar.status
  const radarTone = !snapshot.radar.enabled
    ? 'muted'
    : radarMock
      ? 'muted' // synthetic: never green
      : !snapshot.radar.connected
        ? 'danger'
        : fresh?.radarStale
          ? 'alert'
          : 'safe'

  const cams = snapshot.cameras
  const cameraConnected = Boolean(cams.webcam.connected || cams.dahua.connected)
  const activeCam = cams.dahua.connected ? 'DAHUA' : cams.webcam.connected ? 'WEBCAM' : null
  const cameraUpdated = cams.dahua.connected
    ? cams.dahua.lastFrameTime || cams.dahua.lastUpdate
    : cams.webcam.lastFrameTime || cams.webcam.lastUpdate

  const backendTone =
    backendStatus === 'ok' ? 'safe' : backendStatus === 'offline' ? 'danger' : backendStatus ? 'alert' : 'muted'

  // Subsystem | State | Mode | Value | Updated
  const rows = [
    backendStatus
      ? {
          key: 'backend',
          label: t('Backend', 'שרת'),
          state: String(backendStatus).toUpperCase(),
          mode: fresh ? fresh.dataState : null,
          value: fresh?.failures ? `${fresh.failures} ${t('failed polls', 'כשלי דגימה')}` : null,
          updated: fresh?.lastSuccessLabel ? `${fresh.lastSuccessLabel}${fresh.backendAgeLabel ? ` (+${fresh.backendAgeLabel})` : ''}` : '—',
          tone: backendTone,
        }
      : null,
    {
      key: 'camera',
      label: t('Camera', 'מצלמה'),
      state: cameraConnected ? 'UP' : 'DOWN',
      mode: activeCam,
      value: `${snapshot.personCount} ${t('persons', 'אנשים')}`,
      updated: cameraUpdated || '—',
      tone: cameraConnected ? 'safe' : 'danger',
    },
    {
      key: 'weapon-model',
      label: t('Weapon model', 'מודל נשק'),
      state: weapon === false ? 'UNAVAILABLE' : weapon === true ? 'OK' : 'UNKNOWN',
      mode: null,
      value: null,
      updated: null,
      tone: weapon === false ? 'alert' : weapon === true ? 'safe' : 'muted',
    },
    {
      key: 'radar',
      label: t('Radar', 'רדאר'),
      state: radarState,
      // MOCK/DEMO is called out in its own column, not smuggled into a green dot.
      mode: radarMock ? 'MOCK' : snapshot.radar.provider ? snapshot.radar.provider.toUpperCase() : null,
      value: `${snapshot.radar.targetsCount} ${t('targets', 'מטרות')}`,
      updated:
        fresh?.radarAgeLabel
          ? `rx ${fresh.radarAgeLabel}`
          : snapshot.radar.lastUpdateMs !== null && snapshot.radar.lastUpdateMs !== undefined
            ? `${Math.max(0, Math.round(snapshot.radar.lastUpdateMs))} ms`
            : '—',
      tone: radarTone,
    },
    {
      key: 'distance',
      label: t('Distance sensor', 'חיישן מרחק'),
      state: snapshot.distanceCm !== null ? 'OK' : 'UNAVAILABLE',
      mode: null,
      value: snapshot.distanceCm !== null ? `${Math.round(snapshot.distanceCm)} cm` : null,
      updated: null,
      tone: snapshot.distanceCm !== null ? 'safe' : 'muted',
    },
    {
      key: 'aux',
      label: t('Controller', 'בקר'),
      state: sensor?.connected === true ? 'UP' : sensor?.connected === false ? 'NOT FOUND' : 'UNKNOWN',
      mode: sensor?.port || null,
      value: null,
      updated: null,
      tone: sensor?.connected === true ? 'safe' : 'muted',
    },
  ].filter(Boolean)

  return (
    <div className={`dm-health-table ${className}`} dir="ltr">
      <div className="dm-health-head">
        <span>{t('Subsystem', 'תת־מערכת')}</span>
        <span>{t('State', 'מצב')}</span>
        <span>{t('Mode', 'אופן')}</span>
        <span>{t('Value', 'ערך')}</span>
        <span>{t('Updated', 'עודכן')}</span>
      </div>
      {rows.map((row) => (
        <div key={row.key} className={`dm-health-row dm-health--${row.tone}`}>
          <span className="dm-health-name">{row.label}</span>
          <span className="dm-health-state">{row.state}</span>
          <span className={`dm-health-mode ${row.mode === 'MOCK' ? 'is-synthetic' : ''}`}>{row.mode || '—'}</span>
          <span className="dm-health-value">{row.value || '—'}</span>
          <span className="dm-health-updated">{row.updated || '—'}</span>
        </div>
      ))}
      {snapshot.radar.lastError ? (
        /* Operational summary first; the raw message stays one keyboard-reachable
           toggle away instead of wrapping over four lines and being clipped. */
        <details className="dm-health-err">
          <summary>
            <span>{t('Radar error', 'שגיאת רדאר')}</span> {shortRadarError(snapshot.radar.lastError, t)}
          </summary>
          <p className="dm-health-err-full">{snapshot.radar.lastError}</p>
        </details>
      ) : null}
    </div>
  )
}
