import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useConcept } from '../../useConcept'
import { useAuth } from '../../../context/AuthContext'
import { riskTone } from '../../../design-lab/shared/adapter'
import { OpenAlerts } from '../../domain/OpenAlerts'
import { RiskTimelineChart } from '../../domain/RiskTimelineChart'
import { DemoModeBadge } from '../../domain/DemoModeBadge'
import { useFreshness } from '../useFreshness'
import { RiskFactorsPanel } from '../components/RiskFactorsPanel'
import { AreaList } from '../components/AreaList'
import { AlertList } from '../components/AlertList'
import { AlertFilters } from '../components/AlertFilters'
import { VisualFeedPanel } from '../components/VisualFeedPanel'
import { SelectedAlertActions } from '../components/SelectedAlertActions'
import { NewDangerBadge } from '../components/NewDangerBadge'
import { ResolveAlertDialog, ReopenAlertDialog, AlertNotesDialog } from '../components/AlertActionDialogs'
import { AlertContextMenu } from '../components/AlertContextMenu'
import { SoundControl } from '../components/SoundControl'
import { useOperationalAudio } from '../useOperationalAudio.js'
import { pickHeadlineAlert } from '../events'
import { buildIndustrialReasons } from '../reasons'
import { LIFECYCLE } from '../alerts.js'
import { ALERT_ACTIONS, legalActionsFor, opticalQueryParams } from '../alertSelectors.js'
import { operatorLogEntries, mergeSessionLog } from '../operatorLog.js'
import { splitSessionLog } from '../useIndustrialOpsCommandCenter.js'
import { useIndustrialOpsCommandCenter } from '../useIndustrialOpsCommandCenter.js'

// Every cell names its own source in the label. Camera and radar figures sit in
// the same bar, so the wording — not just position — has to say which is which.
function StatusStripCell({ label, value, tone, groupStart, title, sub }) {
  return (
    <div className={`io2-strip-cell ${groupStart ? 'io2-strip-cell--gstart' : ''}`} dir="ltr" title={title}>
      <span className="io2-strip-label">{label}</span>
      <span className={`io2-strip-value ${tone ? `dm-tone-${tone}` : ''}`}>
        {value}
        {sub ? <span className="io2-strip-sub">{sub}</span> : null}
      </span>
    </div>
  )
}

const LOG_MODES = { ALL: 'ALL', AREA: 'AREA' }

// Industrial: multi-zone command centre. Areas, operational alerts and the
// visual feed are the operational focus; the sensor tables answer the follow-up.
//
// This file is composition. Every derivation lives in
// useIndustrialOpsCommandCenter (which in turn defers to the Phase A0 engine),
// so there is exactly one place where an alert, an area or a selection is
// decided, and the view cannot form a second opinion.
export default function IndustrialDashboard({ vm }) {
  const { t, lang } = useConcept()
  const { conceptId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const tone = riskTone(vm.snapshot.risks.fused)
  const pad = (n) => String(n).padStart(2, '0')
  const fresh = useFreshness(vm, { forcedDemo: vm.demo?.demo === 'forced' })

  const operator = useMemo(
    () => (user ? { id: user.id, name: user.username } : null),
    [user]
  )
  const cc = useIndustrialOpsCommandCenter(vm, { operator })

  // Audio takes the full alert list, never the filtered view: a filter is what
  // the operator chose to look at, not what is happening in the perimeter, and
  // it must never be able to silence a real DANGER.
  const audio = useOperationalAudio({
    alerts: cc.alerts,
    isDemo: cc.isDemo,
    documentVisible: cc.documentVisible,
    // The transport's own "the backend really answered" marker. Until it moves,
    // the console does not yet know what is happening and cannot call anything new.
    dataStamp: vm.link?.lastSuccessAt ?? null,
  })

  const [logMode, setLogMode] = useState(LOG_MODES.ALL)

  // Plot provenance/health badge — synthetic and degraded states must be visible
  // on the plot itself, not only in a panel elsewhere.
  const radarCornerTag = fresh.radarMock
    ? { text: 'MOCK DATA', tone: 'demo' }
    : !fresh.radarConnected
      ? { text: `RADAR ${fresh.radarState}`, tone: 'danger' }
      : fresh.radarStale
        ? { text: `STALE +${fresh.radarAgeLabel}`, tone: 'alert' }
        : null

  // The bar leads with the most significant recent event, not simply the newest.
  const latest = pickHeadlineAlert(vm.alerts)
  const earlier = Math.max(0, vm.alerts.length - (latest ? 1 : 0))

  // Localized reasons with uncalibrated claims marked (industrial-only view).
  const reasons = useMemo(() => buildIndustrialReasons(vm.snapshot, t, lang), [vm.snapshot, t, lang])
  const focusedReasons = useMemo(() => {
    // Re-run the focus rule against the localized list so the panel shows the
    // same rows the command centre selected, in the operator's language.
    const keys = new Set(cc.focusedReasons.rows.map((r) => r.key))
    return reasons.filter((r) => keys.has(r.key))
  }, [reasons, cc.focusedReasons])

  // --- operator workflow (Phase A2) ------------------------------------------
  //
  // `pendingAction` holds an id, not an alert. The alert itself is looked up
  // fresh on every render, so a poll tick can update what the dialog says about
  // the condition while leaving the reason and note the operator typed alone.
  const [pendingAction, setPendingAction] = useState(null)
  const [menu, setMenu] = useState(null)
  // The notes dialog holds an id for the same reason as pendingAction: the alert
  // is looked up fresh each render, so a poll tick updates what the dialog shows
  // instead of freezing a stale copy of it.
  const [notesAlertId, setNotesAlertId] = useState(null)

  const pendingAlert = useMemo(
    () => (pendingAction ? cc.alerts.find((a) => a.id === pendingAction.alertId) || null : null),
    [pendingAction, cc.alerts]
  )
  const menuAlert = useMemo(
    () => (menu ? cc.alerts.find((a) => a.id === menu.alertId) || null : null),
    [menu, cc.alerts]
  )
  const notesAlert = useMemo(
    () => (notesAlertId ? cc.alerts.find((a) => a.id === notesAlertId) || null : null),
    [notesAlertId, cc.alerts]
  )
  const areaOf = (alert) => (alert ? cc.areas.find((a) => a.id === alert.areaId) || null : null)

  // OPS -> OPT (Phase A3.2 §36/§46). Existing route, existing router: the only
  // thing this adds is a query string, built by the same selector that decided
  // the button was legal in the first place.
  //
  // The guard is not defensive padding. `opticalQueryParams` returns null for any
  // context that is not enabled, so a caller reaching here with an alert whose
  // camera is unknown navigates NOWHERE rather than to a station with no camera
  // to open — the same answer the disabled button gives.
  const openOptical = (context) => {
    const params = opticalQueryParams(context)
    if (!params) return
    navigate(`/concepts/${conceptId}/camera/${vm.roomId}?${params.toString()}`)
  }

  // The single dispatcher. The action bar and the context menu both come here,
  // so an action means exactly one thing however it was invoked. The instant
  // actions go straight to the engine; the destructive ones open a confirmation.
  const runAlertAction = (action, alertId) => {
    if (!alertId) return
    if (action === ALERT_ACTIONS.ACKNOWLEDGE) cc.acknowledge(alertId)
    else if (action === ALERT_ACTIONS.REVIEW) cc.startReview(alertId)
    else if (action === ALERT_ACTIONS.RESOLVE) setPendingAction({ type: 'resolve', alertId })
    else if (action === ALERT_ACTIONS.REOPEN) setPendingAction({ type: 'reopen', alertId })
  }

  // The NEW DANGER chip's only job. Explicit and operator-initiated: the
  // selection rule itself is the engine's (`goToUnseenDanger` selects the alert
  // the unseen-danger selector named), and this wrapper adds nothing but the
  // courtesy of bringing the row into view and putting focus on it afterwards.
  //
  // Nothing here runs on its own. If a filter is hiding the row, it will not
  // exist to scroll to — the selection still lands, and the selected-alert
  // region says OUTSIDE CURRENT FILTER and offers SHOW ALERT.
  const goToUnseenDanger = () => {
    const alertId = cc.unseenDanger.unseenDangerAlertId
    cc.goToUnseenDanger()
    if (!alertId) return
    requestAnimationFrame(() => {
      const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(alertId)}"]`)
      if (!row) return
      row.scrollIntoView({ block: 'nearest' })
      row.focus()
    })
  }

  // Operator actions as log rows. This is a display merge over state that is
  // already in the tab — nothing is written anywhere and nothing replaces the
  // camera, radar, system or controller entries the feed provides.
  const operatorEntries = useMemo(
    () => operatorLogEntries(cc.alerts, { lang }),
    [cc.alerts, lang]
  )
  const mergedLog = useMemo(
    () => mergeSessionLog(vm.alerts, operatorEntries),
    [vm.alerts, operatorEntries]
  )
  const logEntries = useMemo(() => (
    logMode === LOG_MODES.ALL
      ? mergedLog
      : splitSessionLog(mergedLog, cc.areas, cc.selectedAreaId).inArea
  ), [logMode, mergedLog, cc.areas, cc.selectedAreaId])

  return (
    <div className="io2-page io2-dashboard">
      <div className={`io2-strip io2-strip--${tone}`} dir="ltr">
        <div className="io2-strip-mode">
          <span className="io2-strip-label">SYS MODE</span>
          <span className="io2-strip-modeval" aria-live="polite">{vm.snapshot.mode}</span>
          <DemoModeBadge when={vm.isDemo} />
          <SoundControl state={audio.soundState} muted={audio.muted} onToggle={audio.toggle} />
        </div>

        {/* Decision figures — the fused number is the backend's, never a UI blend. */}
        <StatusStripCell
          label="סיכון משולב"
          value={pad(vm.snapshot.risks.fused)}
          tone={tone}
          groupStart
          title="Fused risk as computed by the backend"
        />

        {/* Camera-sourced */}
        <StatusStripCell
          label="CAM RISK"
          value={pad(vm.snapshot.risks.camera)}
          tone={riskTone(vm.snapshot.risks.camera)}
          groupStart
          title="Camera risk — vision + behavior engine only"
        />
        <StatusStripCell label="CAM PERSONS" value={vm.snapshot.personCount} title="Persons tracked by the camera" />
        <StatusStripCell
          label="CAM WEAPON"
          value={vm.snapshot.cameras.webcam.weaponDetectionAvailable === false ? 'N-A' : vm.snapshot.hasWeapon ? 'POS' : 'NEG'}
          tone={vm.snapshot.hasWeapon ? 'danger' : undefined}
          title="Weapon detection — camera model only"
        />

        {/* Radar-sourced */}
        <StatusStripCell
          label="RDR RISK"
          value={pad(vm.snapshot.risks.radar)}
          tone={riskTone(vm.snapshot.risks.radar)}
          groupStart
          title="Radar risk — LD2450 only"
        />
        <StatusStripCell
          label="RDR TGTS"
          value={vm.snapshot.radar.targetsCount}
          title="Radar targets currently reported (not persons)"
        />
        <StatusStripCell
          label="RDR LINK"
          value={fresh.radarState}
          tone={fresh.radarMock ? undefined : fresh.radarConnected ? (fresh.radarStale ? 'alert' : 'safe') : 'danger'}
          sub={fresh.radarAgeLabel ? `rx ${fresh.radarAgeLabel}` : null}
          title="Radar link state. Age is when the backend received the payload, not sensor measurement time."
        />

        {/* Transport / data provenance */}
        <StatusStripCell
          label="BACKEND"
          value={vm.backendStatus.toUpperCase()}
          tone={vm.backendStatus === 'ok' ? 'safe' : vm.backendStatus === 'offline' ? 'danger' : 'alert'}
          groupStart
          title="Data link only. A responding backend does not mean the sensors are covering the perimeter."
        />
        {/* Subsystem coverage, kept apart from the threat state and from the
            data link: SAFE does not mean the sensors are up. */}
        <StatusStripCell
          label="COVERAGE"
          value={fresh.systemStateShort}
          tone={fresh.systemTone}
          title={
            fresh.faults.length
              ? `Degraded: ${fresh.faults.map((f) => f.label).join(' · ')}`
              : 'All monitored subsystems are up'
          }
        />
        <StatusStripCell
          label="DATA"
          value={fresh.dataState}
          tone={fresh.dataTone === 'live' ? 'safe' : fresh.dataTone === 'danger' ? 'danger' : fresh.dataTone === 'alert' ? 'alert' : undefined}
          title="Where the figures on this screen come from"
        />
        <StatusStripCell
          label="LAST RX"
          value={fresh.lastSuccessLabel || '—'}
          tone={fresh.backendStale ? 'alert' : undefined}
          sub={fresh.backendAgeLabel ? `+${fresh.backendAgeLabel}` : null}
          title="Last successful backend read. Never advances on a render or a failed poll."
        />
      </div>

      {/* Phase A3.1.1 removed three blocks that used to sit between the status
          strip and the grid: the SYSTEM DECISION / SOURCE EVIDENCE band, the
          full-width NEW DANGER notice and the external operational action bar.
          Together they pushed the command grid several hundred pixels down the
          page, so the operator scrolled past summaries to reach the feed.

          Nothing was deleted. The system mode, the backend fused risk, the data
          provenance and the last successful read are all in the status strip
          directly above; the leading cause and every risk factor are in RISK
          FACTORS with their source attribution intact; camera and radar evidence
          still drive the alerts, the risk factors, the feed and the plot, and
          the full per-contact tables are on the optical station. The operator's
          actions and the new-DANGER indicator moved INTO the alerts panel, which
          is the thing they act on. */}

      <div className="io2-grid">
        <section className="io2-panel io2-a-areas" aria-label={t('Areas', 'אזורים')}>
          <h2 className="io2-panel-title" dir="ltr">[ AREAS ]</h2>
          <AreaList
            rows={cc.areaRows}
            selectedAreaId={cc.selectedAreaId}
            onSelect={cc.selectArea}
            singleArea={cc.deployment.isSingleArea}
            now={fresh.now}
          />
        </section>

        <section className="io2-panel io2-a-feed" aria-label={t('Visual feed', 'תצוגה חזותית')}>
          <h2 className="io2-panel-title" dir="ltr">[ VISUAL FEED ]</h2>
          <VisualFeedPanel
            tab={cc.visualTab}
            onTab={cc.setVisualTab}
            cameras={cc.areaCameras}
            displayCamera={cc.displayCamera}
            onSelectCamera={cc.selectCamera}
            feedMounted={cc.cameraFeedMounted}
            documentVisible={cc.documentVisible}
            isDemo={vm.isDemo}
            displayIsFallback={cc.displayIsFallback}
            radar={vm.snapshot.radar}
            radarState={cc.radarState}
            radarCornerTag={radarCornerTag}
            radarAgeLabel={fresh.radarAgeLabel}
            hasRadar={Boolean(cc.areaRadarId)}
            onOpenRadar={cc.openRadarTab}
          />
        </section>

        <section className="io2-panel io2-a-alerts" aria-label={t('Operational alerts', 'התראות מבצעיות')}>
          {/* The panel header carries the new-DANGER indicator. A chip beside
              the title rather than a band across the page: it has to be noticed,
              not to take the screen over. */}
          <div className="io2-alerts-head">
            <h2 className="io2-panel-title" dir="ltr">[ OPERATIONAL ALERTS ]</h2>
            <NewDangerBadge
              count={cc.unseenDanger.unseenDangerCount}
              onGo={goToUnseenDanger}
            />
          </div>
          {/* States in full what each row abbreviates to SESSION-LOCAL. */}
          <p className="io2-panel-note" dir="ltr">
            {t('SESSION-LOCAL WORKFLOW — NOT PERSISTED ON THE SERVER',
               'תהליך מקומי לסשן — אינו נשמר בשרת')}
          </p>
          <AlertFilters
            filters={cc.filters}
            counts={cc.counts}
            areas={cc.areas}
            onChange={cc.setFilters}
            onSearch={cc.setSearch}
            onReset={cc.resetFilters}
          />
          {/* Between the filters and the list, inside the panel it acts on. */}
          <SelectedAlertActions
            alert={cc.selectedAlert}
            legalActions={cc.legalActions}
            outsideFilter={cc.selectedOutsideFilter}
            onAction={runAlertAction}
            onShowAlert={cc.unblockFilters}
            optical={cc.opticalContext}
            onOptical={openOptical}
            canShowNotes={cc.selectedAlert?.lifecycle === LIFECYCLE.RESOLVED}
            onNotes={setNotesAlertId}
          />
          <AlertList
            alerts={cc.visibleAlerts}
            selectedAlertId={cc.selectedAlert?.id || null}
            onSelect={cc.selectAlert}
            areas={cc.areas}
            now={fresh.now}
            onRowMenu={(alertId, at) => setMenu({ alertId, ...at })}
          />
        </section>

        {/* Phase A3.1 removed the RADAR TARGETS and CAMERA TRACKS tables from this
            screen. Neither the data nor the components went anywhere: tracks and
            targets still drive the alert engine, the radar plot, the source
            evidence and the risk factors, and OpsTargetsTable/OpsTracksTable are
            still the reduced tables the optical station uses. What they stopped
            being is two scrolling tables competing for the operator's attention
            on a screen whose job is deciding what to do next. */}

        <section className="io2-panel io2-a-factors" aria-label={t('Risk factors', 'גורמי סיכון')}>
          <h2 className="io2-panel-title" dir="ltr">[ RISK FACTORS ]</h2>
          <RiskFactorsPanel
            reasons={focusedReasons}
            contributions={vm.contributions}
            snapshot={vm.snapshot}
            t={t}
            lang={lang}
            areaContext={cc.focusedReasons.areaContext}
          />
          <Link to={`/concepts/${conceptId}/camera/${vm.roomId}`} className="io2-quicklink" dir="ltr">
            &gt;&gt;&gt; {t('OPEN OPTICAL STATION', 'לעמדה האופטית')}
          </Link>
        </section>

        <section className={`io2-panel io2-a-timeline io2-panel--timeline is-${tone}`} aria-label={t('Risk timeline', 'ציר סיכון')}>
          <h2 className="io2-panel-title" dir="ltr">[ RISK / TIME ]</h2>
          <p className="io2-panel-note" dir="ltr">
            סיכון משולב — BACKEND · SESSION · THRESHOLDS 40 / 75
          </p>
          <RiskTimelineChart samples={vm.timeline.samples} scope="session" axisTicks thresholdLabelPos="start" />
        </section>

        {/* SYSTEM HEALTH moved to Configuration in Phase A3.1. Which subsystem
            answered last is a diagnostics question, and it was taking a quarter
            of the bottom band away from the session log on a screen that exists
            to handle what is happening in the perimeter. Same component, same
            data, one screen over. */}

        <section className="io2-panel io2-a-log" aria-label={t('Session log', 'יומן סשן')}>
          <h2 className="io2-panel-title" dir="ltr">[ SESSION LOG ]</h2>
          <div className="io2-log-head">
            <p className="io2-panel-note" dir="ltr">SESSION-LOCAL · NEWEST FIRST</p>
            <div className="io2-log-modes" role="tablist" aria-label={t('Log scope', 'היקף היומן')}>
              <button
                type="button"
                role="tab"
                aria-selected={logMode === LOG_MODES.ALL}
                className={logMode === LOG_MODES.ALL ? 'is-active' : ''}
                onClick={() => setLogMode(LOG_MODES.ALL)}
              >
                {t('ALL AREAS', 'כל האזורים')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={logMode === LOG_MODES.AREA}
                className={logMode === LOG_MODES.AREA ? 'is-active' : ''}
                onClick={() => setLogMode(LOG_MODES.AREA)}
              >
                {t('SELECTED AREA', 'אזור נבחר')}
              </button>
            </div>
          </div>
          <div
            className="io2-log-scroll"
            data-io2-focus="log"
            tabIndex={0}
            role="log"
            aria-label={t('Session log', 'יומן סשן')}
          >
            <OpenAlerts alerts={logEntries} limit={50} variant="compact" showMeta />
            {/* Controller messages have no area in the data. In area scope they
                are shown apart rather than filed under a zone they never named. */}
            {logMode === LOG_MODES.AREA && cc.sessionLog.unassigned.length ? (
              <div className="io2-log-unassigned">
                <p className="io2-log-unassigned-title" dir="ltr">
                  {t('UNASSIGNED SYSTEM EVENTS — NO AREA IN SOURCE DATA',
                     'אירועי מערכת ללא שיוך — אין אזור בנתוני המקור')}
                </p>
                <OpenAlerts alerts={cc.sessionLog.unassigned} limit={10} variant="compact" showMeta />
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* Overlays. Both are top-layer / fixed, so neither adds a pixel to the
          document height and neither can reflow the grid above. */}
      {pendingAction?.type === 'resolve' ? (
        <ResolveAlertDialog
          alert={pendingAlert}
          area={areaOf(pendingAlert)}
          onDismiss={() => setPendingAction(null)}
          onConfirm={(reason, note) => {
            cc.resolve(pendingAction.alertId, reason, note)
            setPendingAction(null)
          }}
        />
      ) : null}

      {pendingAction?.type === 'reopen' ? (
        <ReopenAlertDialog
          alert={pendingAlert}
          area={areaOf(pendingAlert)}
          onDismiss={() => setPendingAction(null)}
          onConfirm={() => {
            cc.reopen(pendingAction.alertId)
            setPendingAction(null)
          }}
        />
      ) : null}

      {/* Reads the resolve record and lets the note — and only the note — be
          corrected. Same overlay discipline as the two above: nothing it does
          adds a pixel to the document or reflows the grid. */}
      {notesAlert ? (
        <AlertNotesDialog
          alert={notesAlert}
          area={areaOf(notesAlert)}
          onDismiss={() => setNotesAlertId(null)}
          onSaveNote={(alertId, note) => cc.editNote(alertId, note)}
        />
      ) : null}

      {/* Items are derived from the menu's OWN alert rather than from the
          selection, so they can never describe a different alert than the row
          that was clicked. */}
      {menu && menuAlert ? (
        <AlertContextMenu
          alert={menuAlert}
          x={menu.x}
          y={menu.y}
          actions={legalActionsFor(menuAlert)}
          onAction={runAlertAction}
          onClose={() => {
            setMenu(null)
            const row = document.querySelector(`[data-io2-alert-row="${CSS.escape(menu.alertId)}"]`)
            if (row) row.focus()
          }}
        />
      ) : null}

      {/* Operational bar: a stable readout, not a marquee. The tag states where the
          data comes from (LIVE / DEMO / OFFLINE) and is never a fixed "LIVE". */}
      <footer className="io2-bar" dir="ltr">
        <span className={`io2-bar-tag io2-bar-tag--${fresh.dataTone}`}>{fresh.dataState}</span>
        {/* Link state and sensor coverage are stated separately — a live link is
            not a claim that the perimeter is covered. */}
        <span className={`io2-bar-sys io2-bar-sys--${fresh.systemTone}`} title={fresh.linkState}>
          {fresh.linkState} · {fresh.systemState}
          {fresh.faults.length ? ` — ${fresh.faults.map((f) => f.label).join(' · ')}` : ''}
        </span>
        <div className="io2-bar-body">
          {latest ? (
            <>
              <span className="io2-bar-time">{latest.time}</span>
              <span className="io2-bar-src">{(latest.source || 'system').toUpperCase()}</span>
              <span className={`io2-bar-sev io2-bar-sev--${latest.severity}`}>{latest.severity.toUpperCase()}</span>
              <span className="io2-bar-msg" title={latest.message}>{latest.message}</span>
            </>
          ) : (
            <span className="io2-bar-msg io2-bar-noevt">{t('No events this session', 'אין אירועים בסשן')}</span>
          )}
        </div>
        {earlier > 0 ? (
          <span className="io2-bar-more">+{earlier} EARLIER — SEE SESSION LOG</span>
        ) : null}
      </footer>
    </div>
  )
}
