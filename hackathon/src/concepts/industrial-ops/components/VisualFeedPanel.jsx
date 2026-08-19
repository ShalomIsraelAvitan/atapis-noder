import { useState } from 'react'
import { useConcept } from '../../useConcept'
import { CameraFeed } from '../../../design-lab/shared/CameraFeed'
import { RadarPlot } from '../../domain/RadarPlot'
import { RADAR_RANGE } from '../../../design-lab/shared/adapter'
import { AllCamerasPanel } from './AllCamerasPanel'
import { VISUAL_TABS } from '../useIndustrialOpsCommandCenter.js'
import { SOURCE_STATES } from '../alerts.js'

// [ VISUAL FEED ] — camera first, radar as an alternative view.
//
// THE HARD RULE: at most one live MJPEG <img> exists in the DOM at any moment.
// Each one drives a full YOLO loop on the backend (issue H4), so tabs must
// UNMOUNT the previous stream, never hide it with CSS — a hidden stream is still
// an open stream. Consequently:
//   - ALL CAMERAS renders a status table and zero streams;
//   - the RADAR tab renders no camera at all;
//   - a background tab (document.hidden) drops the stream entirely;
//   - a camera known to be down renders a status panel instead of a stream.
//
// AND: the camera on screen is a DISPLAY choice. The backend never says which
// camera raised an alert, so when an alert is selected whose camera source is
// unknown, the panel says so out loud rather than letting the visible feed be
// read as the source.

function Val({ children }) {
  return <bdi dir="ltr" className="io2-val">{children}</bdi>
}

export function VisualFeedPanel({
  tab, onTab, cameras, displayCamera, onSelectCamera,
  feedMounted, documentVisible, isDemo,
  displayIsFallback, radar, radarState, radarCornerTag, radarAgeLabel,
  hasRadar, onOpenRadar,
}) {
  const { t } = useConcept()
  // An explicit operator retry: mount the stream even though the last status
  // said the camera was down, because the status can lag the hardware.
  //
  // The attempt is stored WITH the camera it belongs to, so switching tabs
  // naturally discards it — a different camera is a different stream and must
  // start from its own real status, not inherit another one's retry.
  const [retry, setRetry] = useState({ cameraId: null, count: 0 })
  const retryToken = retry.cameraId === displayCamera?.id ? retry.count : 0
  const attemptRetry = () =>
    setRetry((prev) => ({
      cameraId: displayCamera?.id ?? null,
      count: prev.cameraId === displayCamera?.id ? prev.count + 1 : 1,
    }))

  const cameraDown = Boolean(displayCamera && !displayCamera.connected && retryToken === 0)
  const radarDown = radarState !== SOURCE_STATES.LIVE && radarState !== 'MOCK'

  return (
    <div className="io2-vf">
      <div className="io2-vf-tabs" role="tablist" aria-label={t('Visual source', 'מקור חזותי')}>
        {cameras.map((cam) => (
          <button
            key={cam.id}
            type="button"
            role="tab"
            data-io2-vf-tab={cam.id}
            aria-selected={tab === VISUAL_TABS.CAMERA && displayCamera?.id === cam.id}
            className={`io2-vf-tab ${tab === VISUAL_TABS.CAMERA && displayCamera?.id === cam.id ? 'is-active' : ''}`}
            onClick={() => onSelectCamera(cam.id)}
            title={`${cam.id} · ${cam.sourceKey} · ${cam.state}`}
          >
            <span dir="ltr">{cam.id}</span>
            <span className={`io2-vf-dot io2-vf-dot--${cam.connected ? 'ok' : 'down'}`} aria-hidden="true" />
          </button>
        ))}
        {/* Stable, language-independent hooks: the labels are translated, so a
            test (or an operator macro) must not have to match Hebrew text. */}
        <button
          type="button"
          role="tab"
          data-io2-vf-tab="all"
          aria-selected={tab === VISUAL_TABS.ALL}
          className={`io2-vf-tab io2-vf-tab--wide ${tab === VISUAL_TABS.ALL ? 'is-active' : ''}`}
          onClick={() => onTab(VISUAL_TABS.ALL)}
        >
          {t('ALL CAMERAS', 'כל המצלמות')}
        </button>
        <button
          type="button"
          role="tab"
          data-io2-vf-tab="radar"
          aria-selected={tab === VISUAL_TABS.RADAR}
          className={`io2-vf-tab io2-vf-tab--wide ${tab === VISUAL_TABS.RADAR ? 'is-active' : ''}`}
          onClick={() => onTab(VISUAL_TABS.RADAR)}
        >
          RADAR
        </button>
      </div>

      {/* ---- camera ---- */}
      {tab === VISUAL_TABS.CAMERA ? (
        <div className="io2-vf-body">
          {!displayCamera ? (
            <div className="io2-vf-state">
              <p className="io2-vf-state-title" dir="ltr">{t('NO CAMERA AVAILABLE', 'אין מצלמה זמינה')}</p>
              <p className="io2-vf-state-note">
                {t('No camera is declared for this area in the configuration.',
                   'לא הוגדרה מצלמה לאזור זה בתצורה.')}
              </p>
              {hasRadar ? (
                <button type="button" className="io2-vf-action" onClick={onOpenRadar}>OPEN RADAR</button>
              ) : null}
            </div>
          ) : !documentVisible ? (
            // The tab is in the background: the stream is dropped, not hidden.
            <div className="io2-vf-state">
              <p className="io2-vf-state-title" dir="ltr">{t('FEED PAUSED — TAB IN BACKGROUND', 'הזרם מושהה — הלשונית ברקע')}</p>
              <p className="io2-vf-state-note">
                {t('The stream is released while this tab is hidden and resumes on return.',
                   'הזרם משוחרר כשהלשונית מוסתרת ונטען מחדש בחזרה אליה.')}
              </p>
            </div>
          ) : cameraDown ? (
            <div className="io2-vf-state io2-vf-state--down">
              <p className="io2-vf-state-title" dir="ltr">{t('CAMERA UNAVAILABLE', 'מצלמה לא זמינה')}</p>
              <dl className="io2-vf-facts" dir="ltr">
                <div><dt>CAMERA</dt><dd><Val>{displayCamera.id}</Val></dd></div>
                <div><dt>SOURCE</dt><dd><Val>{displayCamera.sourceKey}</Val></dd></div>
                <div><dt>STATE</dt><dd><Val>{displayCamera.state}</Val></dd></div>
                <div><dt>LAST RX</dt><dd><Val>{displayCamera.lastFrameTime || '—'}</Val></dd></div>
              </dl>
              {displayCamera.lastError ? (
                <p className="io2-vf-state-err" dir="ltr" title={displayCamera.lastError}>
                  {displayCamera.lastError}
                </p>
              ) : null}
              <div className="io2-vf-actions">
                <button type="button" className="io2-vf-action" onClick={attemptRetry}>
                  {t('RETRY', 'נסה שוב')}
                </button>
                {/* Never automatic: switching evidence source is the operator's call. */}
                {hasRadar ? (
                  <button type="button" className="io2-vf-action" onClick={onOpenRadar}>OPEN RADAR</button>
                ) : null}
              </div>
              <p className="io2-vf-state-note">
                {t('Radar is not opened automatically — the camera being down is information in itself.',
                   'הרדאר אינו נפתח אוטומטית — נפילת המצלמה היא מידע בפני עצמו.')}
              </p>
            </div>
          ) : (
            <>
              {displayIsFallback ? (
                <p className="io2-vf-fallback" dir="ltr" title={t(
                  'The backend does not report which camera raised the alert. This view is an operator display choice.',
                  'ה־Backend אינו מדווח איזו מצלמה יצרה את ההתראה. התצוגה הזו היא בחירת תצוגה של המפעיל.'
                )}>
                  {t('DISPLAY FALLBACK — NOT IDENTIFIED AS ALERT SOURCE',
                     'תצוגת ברירת מחדל — לא זוהתה כמקור ההתראה')}
                </p>
              ) : null}
              {feedMounted ? (
                <CameraFeed
                  key={`${displayCamera.id}-${retryToken}`}
                  source={displayCamera.sourceKey}
                  active
                  cameraStatus={{ connected: displayCamera.connected, lastError: displayCamera.lastError }}
                  isDemo={isDemo}
                  labels={{
                    unavailable: t('CAMERA UNAVAILABLE', 'מצלמה לא זמינה'),
                    connecting: t('Connecting to camera…', 'מתחבר למצלמה…'),
                    retry: t('Retry', 'נסה שוב'),
                  }}
                />
              ) : null}
              <p className="io2-panel-note" dir="ltr">
                {t('CAMERA-ONLY · ONE LIVE FEED AT A TIME', 'מצלמה בלבד · feed חי אחד בכל רגע')}
              </p>
            </>
          )}
        </div>
      ) : null}

      {/* ---- all cameras: status board, zero streams ---- */}
      {tab === VISUAL_TABS.ALL ? (
        <div className="io2-vf-body">
          <AllCamerasPanel cameras={cameras} displayCameraId={displayCamera?.id} onOpen={onSelectCamera} />
        </div>
      ) : null}

      {/* ---- radar: the plot keeps every capability it had as a fixed panel ---- */}
      {tab === VISUAL_TABS.RADAR ? (
        <div className="io2-vf-body io2-vf-body--radar" data-io2-radar-tab>
          {radarDown ? (
            <div className="io2-vf-radar-down">
              <p className="io2-vf-state-title" dir="ltr">
                {t(`RADAR ${radarState}`, `רדאר ${radarState}`)}
              </p>
              {radar?.lastError ? (
                <p className="io2-vf-state-err" dir="ltr" title={radar.lastError}>{radar.lastError}</p>
              ) : null}
              <p className="io2-vf-state-note">
                {t('The plot below is empty because no target data is arriving. An empty payload is not new data.',
                   'התרשים למטה ריק מפני שלא מגיעים נתוני מטרות. payload ריק אינו נתון חדש.')}
              </p>
            </div>
          ) : null}
          <p className="io2-panel-note" dir="ltr">
            RADAR-ONLY · SENSOR-RELATIVE · RANGE {RADAR_RANGE.yMm / 1000} m · LATERAL ±{RADAR_RANGE.xMm / 1000} m
            {radarAgeLabel ? ` · RX ${radarAgeLabel}` : ''}
          </p>
          <RadarPlot
            radar={radar}
            variant="grid"
            trueRangeTicks
            lateralTicks
            legend
            sensorLabel="RADAR SENSOR"
            declutterLabels
            cornerTag={radarCornerTag}
          />
        </div>
      ) : null}
    </div>
  )
}
