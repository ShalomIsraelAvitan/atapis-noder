import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConcept } from '../../useConcept'
import { CameraFeed } from '../../../design-lab/shared/CameraFeed'
import { riskTone } from '../../../design-lab/shared/adapter'
import { RadarPlot } from '../../domain/RadarPlot'
import { TargetsTable } from '../../domain/TargetsTable'
import { TracksTable } from '../../domain/TracksTable'
import { OpenAlerts } from '../../domain/OpenAlerts'
import { DemoModeBadge } from '../../domain/DemoModeBadge'
import { getAreas, areaName } from '../areas.js'
import { readOpticalContext, opticalSourceKeyFor } from '../opticalContext.js'

// Industrial optical station: radar left, camera right, tables everywhere.
//
// PHASE A3.2 — CONTEXT INTAKE ONLY. The layout, the panels, the tables and the
// plot are exactly what they were; §82 permits this screen to learn where the
// operator came from and nothing else. What was added:
//
//   - it reads the OPS context out of the query string (§45/§46), so a refresh
//     or a shared link keeps it (§47);
//   - it opens the camera the alert named, when that camera is a real adapter
//     source (§38);
//   - it states plainly that the radar beside the feed is AREA CONTEXT and is
//     NOT ASSOCIATED with the camera track (§41);
//   - and it reports an unresolvable context instead of silently opening
//     something else (§48).
//
// What was NOT added, and must not be: any association between the camera track
// and a radar target. No target is auto-selected by proximity, by risk, by time
// or by being the only one there (§42). There is no calibration, no shared frame
// of reference and no homography in this project, so a geometric match cannot be
// computed — and anything shown as one would be invented.
export default function IndustrialCamera({ vm }) {
  const { t, lang } = useConcept()
  const tone = riskTone(vm.snapshot.risks.fused)
  const [searchParams] = useSearchParams()

  const areas = useMemo(() => getAreas({ isDemo: Boolean(vm.isDemo) }), [vm.isDemo])
  const context = useMemo(
    () => readOpticalContext(searchParams, { areas }),
    [searchParams, areas]
  )

  // Open the named camera ONCE per context, not on every render.
  //
  // The operator must stay able to switch source afterwards: this screen's source
  // buttons are the whole point of it. Re-applying the context on each render
  // would fight them and make the switch look broken, so the applied context is
  // remembered and a repeat is skipped.
  const appliedRef = useRef(null)
  const sourceKey = opticalSourceKeyFor(context)
  useEffect(() => {
    if (!sourceKey) return
    const token = `${context.cameraId}|${context.alertId || ''}`
    if (appliedRef.current === token) return
    appliedRef.current = token
    if (vm.source !== sourceKey) vm.setSource(sourceKey)
  }, [sourceKey, context, vm])

  const hasContext = Boolean(context)
  const resolved = Boolean(context?.resolved)

  return (
    <div className="io2-page io2-camera">
      <div className={`io2-strip io2-strip--${tone}`} dir="ltr">
        <div className="io2-strip-mode">
          <span className="io2-strip-label">OPTICAL / {vm.source.toUpperCase()}</span>
          <span className="io2-strip-modeval">{vm.snapshot.mode}</span>
          <DemoModeBadge when={vm.isDemo} />
        </div>
        <div className="io2-strip-cell">
          <span className="io2-strip-label">SOURCE</span>
          <div className="io2-source-switch">
            {['webcam', 'dahua'].map((name) => (
              <button
                key={name}
                type="button"
                className={vm.source === name ? 'is-active' : ''}
                onClick={() => vm.setSource(name)}
              >
                {name === 'webcam' ? 'CAM-01' : 'CAM-02'}
              </button>
            ))}
          </div>
        </div>
        <div className="io2-strip-cell">
          <span className="io2-strip-label">LINK</span>
          <span className={`io2-strip-value ${vm.camera.connected ? 'dm-tone-safe' : 'dm-tone-danger'}`}>
            {vm.camera.connected ? 'UP' : String(vm.camera.status).toUpperCase()}
          </span>
        </div>
        <div className="io2-strip-cell">
          <span className="io2-strip-label">PERSONS</span>
          <span className="io2-strip-value">{vm.camera.personCount}</span>
        </div>
      </div>

      {/* The context band. Rendered only when OPS actually sent one, so opening
          the optical station directly looks exactly as it always has. */}
      {hasContext && resolved ? (
        <section className="io2-optctx" data-io2-optctx="resolved" aria-label={t('Alert context', 'הקשר ההתראה')}>
          <span className="io2-optctx-tag">{t('FROM ALERT', 'מהתראה')}</span>
          <span className="io2-optctx-item">
            <span className="io2-optctx-k">{t('AREA', 'אזור')}</span>
            <bdi dir="ltr">{areaName(context.area, lang)} · {context.areaId}</bdi>
          </span>
          <span className="io2-optctx-item">
            <span className="io2-optctx-k">{t('CAMERA', 'מצלמה')}</span>
            <bdi dir="ltr" data-io2-optctx-camera>{context.cameraId}</bdi>
          </span>
          {context.alertId ? (
            <span className="io2-optctx-item">
              <span className="io2-optctx-k">{t('ALERT', 'התראה')}</span>
              <bdi dir="ltr" data-io2-optctx-alert title={context.alertId}>{context.alertId}</bdi>
            </span>
          ) : null}
          {/* Only when the alert genuinely carried one. An absent track is absent
              from the band rather than shown as a dash that looks like data. */}
          {context.trackId !== null ? (
            <span className="io2-optctx-item">
              <span className="io2-optctx-k">{t('TRACK', 'מסלול')}</span>
              <bdi dir="ltr" data-io2-optctx-track>#{context.trackId}</bdi>
            </span>
          ) : null}
          {context.targetId !== null ? (
            <span className="io2-optctx-item">
              <span className="io2-optctx-k">{t('TARGET', 'מטרה')}</span>
              <bdi dir="ltr" data-io2-optctx-target>T{context.targetId}</bdi>
            </span>
          ) : null}
          {context.isDemo ? <DemoModeBadge when /> : null}
        </section>
      ) : null}

      {/* §48. The link named something this deployment does not have. Say that;
          do not open a different camera and let it pass for the right one. */}
      {hasContext && !resolved ? (
        <section className="io2-optctx io2-optctx--bad" data-io2-optctx="unavailable" role="note">
          <span className="io2-optctx-tag">{t('CONTEXT UNAVAILABLE', 'ההקשר אינו זמין')}</span>
          <span className="io2-optctx-item">
            {t('The alert context in this link does not match anything in the current deployment. No camera was opened on its behalf.',
              'ההקשר שבקישור אינו תואם דבר בפריסה הנוכחית. לא נפתחה מצלמה כלשהי בעקבותיו.')}
          </span>
          {context.cameraId ? (
            <span className="io2-optctx-item">
              <span className="io2-optctx-k">{t('REQUESTED', 'התבקש')}</span>
              <bdi dir="ltr">{context.cameraId}</bdi>
            </span>
          ) : null}
        </section>
      ) : null}

      <div className="io2-camera-grid">
        <section className="io2-panel" aria-label={t('Radar', 'רדאר')}>
          <h2 className="io2-panel-title" dir="ltr">[ RADAR PLOT ]</h2>

          {/* §41, stated on the radar side itself rather than in a footnote. It
              is shown whenever a camera context is in force, because that is
              precisely when the two panels sitting side by side could be read as
              a claim that they describe the same thing. */}
          {resolved ? (
            <p className="io2-optctx-noassoc" data-io2-not-associated role="note">
              <strong>{t('RADAR AREA CONTEXT', 'הקשר רדאר של האזור')}</strong>
              <span>
                {t('NOT ASSOCIATED WITH SELECTED CAMERA TRACK',
                  'ללא שיוך מאומת למסלול המצלמה שנבחר')}
              </span>
              <span className="io2-optctx-noassoc-why">
                {context.radarId
                  ? t(`These are the contacts ${context.radarId} reports for ${context.areaId}. Same area is not evidence of the same object: no camera-to-radar association is computed anywhere in this system.`,
                      `אלה המגעים ש-${context.radarId} מדווח עבור ${context.areaId}. אותו אזור אינו ראיה לאותו עצם: המערכת אינה מחשבת שיוך בין מצלמה לרדאר בשום מקום.`)
                  : t('This area declares no radar, so there are no contacts to show for it.',
                      'באזור זה לא מוגדר רדאר, ולכן אין מגעים להצגה עבורו.')}
              </span>
            </p>
          ) : null}

          <RadarPlot
            radar={vm.snapshot.radar}
            variant="grid"
            selectedId={vm.selectedTargetId}
            onSelect={vm.setSelectedTargetId}
          />
          <h2 className="io2-panel-title" dir="ltr">[ CONTACT TABLE ]</h2>
          <TargetsTable
            radar={vm.snapshot.radar}
            variant="table"
            selectedId={vm.selectedTargetId}
            onSelect={vm.setSelectedTargetId}
          />
        </section>

        <section className="io2-panel" aria-label={t('Optical feed', 'זרם אופטי')}>
          <h2 className="io2-panel-title" dir="ltr">[ FEED ]</h2>
          <CameraFeed source={vm.source} active cameraStatus={vm.camera} isDemo={vm.isDemo} />
          <h2 className="io2-panel-title" dir="ltr">[ TRACK TABLE ]</h2>
          {/* The track the alert named, stated above the table. The table itself
              is a shared component and is left alone (§82/§83): saying which
              track is in context needs no change to it. */}
          {resolved && context.trackId !== null ? (
            <p className="io2-optctx-track" data-io2-optctx-trackhint>
              {t('ALERT CONTEXT — TRACK', 'הקשר ההתראה — מסלול')}{' '}
              <bdi dir="ltr">#{context.trackId}</bdi>
            </p>
          ) : null}
          <TracksTable snapshot={vm.snapshot} />
          <h2 className="io2-panel-title" dir="ltr">[ SESSION LOG ]</h2>
          <OpenAlerts alerts={vm.alerts} limit={6} variant="compact" />
        </section>
      </div>
    </div>
  )
}
