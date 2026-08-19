import { formatDistance, formatSpeed, riskTone } from '../../../design-lab/shared/adapter'
import { pairLabel } from '../../data/candidatePairs'
import { DemoModeBadge } from '../../domain/DemoModeBadge'
import { UNCALIBRATED_TITLE } from '../reasons'

// Industrial OPS decision band.
//
// Two halves that must never blur into each other:
//   SYSTEM DECISION  — what the system concluded (mode, backend fused risk,
//                      the single leading cause, and where the data came from).
//   SOURCE EVIDENCE  — what each sensor reports, on its own row, in its own
//                      units, with no cross-sensor claim.
//
// Honesty rules enforced here:
//  - "Fused Risk" labels snapshot.risks.fused only. pairRisk / max-of-sources is
//    never rendered on this screen, in any mode.
//  - The camera row carries no radar distance, speed or angle; the radar row
//    carries no person identity.
//  - Live pairing shows `CP-nn — Unverified` and its basis in words. FC-nn and a
//    percentage appear only for demo scenario data, next to a DemoModeBadge.
//  - Numbers, IDs and units are isolated with <bdi dir="ltr"> so a Hebrew line
//    cannot reorder "3.9 m" into "m 3.9".

// Isolated run: keeps a latin/number token upright inside RTL text.
function Val({ children, className = '' }) {
  return <bdi dir="ltr" className={`io2-val ${className}`}>{children}</bdi>
}

const SEVERITY_RANK = { danger: 3, alert: 2, info: 1 }

// The leading cause is the most severe reason the risk engine reported. Its
// source tag travels with it so the sentence never hides which sensor spoke.
function leadReason(reasons) {
  if (!Array.isArray(reasons) || !reasons.length) return null
  return reasons.reduce((best, r) =>
    (SEVERITY_RANK[r.severity] || 0) > (SEVERITY_RANK[best.severity] || 0) ? r : best
  )
}

function leadTrack(tracks) {
  if (!tracks?.length) return null
  return tracks.reduce((best, tr) => (tr.risk > best.risk ? tr : best))
}

function leadTarget(targets) {
  if (!targets?.length) return null
  return targets.reduce((best, tg) => (tg.risk > best.risk ? tg : best))
}

function EvidenceRow({ source, sourceLabel, children, empty }) {
  return (
    <div className={`io2-ev-row io2-ev-row--${source}`}>
      <span className="io2-ev-source">{sourceLabel}</span>
      <div className="io2-ev-body">{empty ? <span className="io2-ev-empty">{empty}</span> : children}</div>
    </div>
  )
}

// Compact selection context. Additive: with no `selected` prop the block renders
// exactly as it did before, so the approved decision band is unchanged whenever
// the command-centre layer is not driving it.
function SelectedContext({ selected, t }) {
  if (!selected) return null
  return (
    <p className="io2-sd-selected" dir="ltr">
      <span className="io2-sd-sel-label">{t('SELECTED AREA', 'אזור נבחר')}</span>
      <Val className="io2-sd-sel-val">{selected.areaLabel || '—'}</Val>
      <span className="io2-sd-sep">·</span>
      <span className="io2-sd-sel-label">{t('SELECTED ALERT', 'התראה נבחרת')}</span>
      <Val className="io2-sd-sel-val">{selected.alertId || '—'}</Val>
    </p>
  )
}

export function DecisionBlock({ vm, fresh, t, lang = 'en', reasons = null, selected = null, otherEvidence = null }) {
  const s = vm.snapshot
  const mode = s.mode
  const tone = riskTone(s.risks.fused)
  const reason = leadReason(reasons || vm.reasons)
  const track = leadTrack(s.tracks)
  const target = leadTarget(s.radar.targets)
  const pair = vm.candidatePairs?.[0] || null
  const isPaired = pair && pair.source?.camera && pair.source?.radar
  const isDemoPair = isPaired && pair.association?.isDemo
  const weaponUnavailable = s.cameras.webcam.weaponDetectionAvailable === false

  return (
    <section className="io2-decision" aria-label={t('System decision and source evidence', 'החלטת מערכת וראיות מקור')}>
      {/* ---- System decision -------------------------------------------- */}
      <div className={`io2-sd io2-sd--${tone}`} role="status" aria-live="polite">
        <h2 className="io2-block-title" dir="ltr">[ SYSTEM DECISION ]</h2>

        <div className="io2-sd-head">
          <span className={`io2-sd-mode dm-tone-${tone}`} dir="ltr">{mode}</span>
          <span className="io2-sd-risk" dir="ltr">
            <span className="io2-sd-risk-label">סיכון משולב</span>
            <Val className={`io2-sd-risk-val dm-tone-${tone}`}>{s.risks.fused}</Val>
            <span className="io2-sd-risk-src">{t('backend', 'מהשרת')}</span>
          </span>
        </div>

        <p className="io2-sd-cause">
          {reason ? (
            <>
              <span className={`io2-sd-cause-src io2-src-${reason.source}`} dir="ltr">
                {reason.source === 'camera' ? 'CAM' : reason.source === 'radar' ? 'RDR' : 'SYS'}
              </span>
              <span className="io2-sd-cause-text">{reason.text}</span>
              {reason.uncalibrated ? (
                <span className="io2-uncal" title={UNCALIBRATED_TITLE[lang === 'he' ? 'he' : 'en']}>
                  {t('UNCALIBRATED', 'ללא כיול')}
                </span>
              ) : null}
            </>
          ) : (
            <span className="io2-sd-cause-text io2-ev-empty">
              {t('No active risk factor reported', 'לא דווח גורם סיכון פעיל')}
            </span>
          )}
        </p>

        <p className="io2-sd-meta" dir="ltr">
          <span>DATA <Val className={`dm-tone-${fresh.dataTone === 'live' ? 'safe' : fresh.dataTone === 'danger' ? 'danger' : fresh.dataTone === 'alert' ? 'alert' : ''}`}>{fresh.dataState}</Val></span>
          <span className="io2-sd-sep">·</span>
          <span>
            LAST RX <Val>{fresh.lastSuccessLabel || '—'}</Val>
            {fresh.backendAgeLabel ? <Val className="io2-sd-age"> +{fresh.backendAgeLabel}</Val> : null}
          </span>
          <DemoModeBadge when={vm.isDemo} />
        </p>

        <SelectedContext selected={selected} t={t} />
      </div>

      {/* ---- Source evidence -------------------------------------------- */}
      <div className="io2-se">
        <h2 className="io2-block-title" dir="ltr">[ SOURCE EVIDENCE ]</h2>

        <EvidenceRow
          source="camera"
          sourceLabel={t('CAMERA', 'מצלמה')}
          empty={!track ? t('No tracked person', 'אין אדם במעקב') : null}
        >
          {track ? (
            <span className="io2-ev-line">
              <Val className="io2-ev-id">#{track.id}</Val>
              <span className="io2-ev-sep">·</span>
              <span>{track.state}</span>
              {track.approachingGate ? (
                <span className="io2-uncal" title={UNCALIBRATED_TITLE[lang === 'he' ? 'he' : 'en']}>
                  {t('REF · UNCALIBRATED', 'ייחוס · ללא כיול')}
                </span>
              ) : null}
              {track.zone ? (<><span className="io2-ev-sep">·</span><span>{t('zone', 'אזור')} <Val>{track.zone}</Val></span></>) : null}
              <span className="io2-ev-sep">·</span>
              <span>{t('speed', 'מהירות')} <Val>{Math.round(track.speed)} px/s</Val></span>
              <span className="io2-ev-sep">·</span>
              <span className={track.hasWeapon ? 'dm-tone-danger' : ''}>
                {t('weapon', 'נשק')} <Val>{weaponUnavailable ? 'N-A' : track.hasWeapon ? 'POS' : 'NEG'}</Val>
              </span>
              <span className="io2-ev-sep">·</span>
              <span>{t('camera risk', 'סיכון מצלמה')} <Val className={`dm-tone-${riskTone(track.risk)}`}>{track.risk}</Val></span>
            </span>
          ) : null}
        </EvidenceRow>

        <EvidenceRow
          source="radar"
          sourceLabel={t('RADAR', 'רדאר')}
          empty={
            !target
              ? s.radar.connected
                ? t('No active target', 'אין מטרה פעילה')
                : `${t('Radar', 'רדאר')} ${fresh.radarState}`
              : null
          }
        >
          {target ? (
            <span className="io2-ev-line">
              <Val className="io2-ev-id">T{target.id}</Val>
              <span className="io2-ev-sep">·</span>
              <span>{t('range', 'טווח')} <Val>{formatDistance(target.distanceMm)}</Val></span>
              <span className="io2-ev-sep">·</span>
              <span>{t('radial speed', 'מהירות רדיאלית')} <Val>{formatSpeed(target.speedCmS)}</Val></span>
              <span className="io2-ev-sep">·</span>
              <span>{t('bearing', 'זווית')} <Val>{Math.round(target.angleDeg)}°</Val></span>
              <span className="io2-ev-sep">·</span>
              <span>{target.direction}</span>
              <span className="io2-ev-sep">·</span>
              <span>{t('radar risk', 'סיכון רדאר')} <Val className={`dm-tone-${riskTone(target.risk)}`}>{target.risk}</Val></span>
            </span>
          ) : null}
        </EvidenceRow>

        <EvidenceRow
          source="pair"
          sourceLabel={t('PAIR', 'זיווג')}
          empty={!isPaired ? t(vm.linkage?.reasonEn, vm.linkage?.reasonHe) : null}
        >
          {isPaired ? (
            <span className="io2-ev-line">
              <Val className={`io2-ev-id ${isDemoPair ? 'io2-ev-id--demo' : ''}`}>{pairLabel(pair, t)}</Val>
              {isDemoPair && pair.association.confidence !== null ? (
                <>
                  <span className="io2-ev-sep">·</span>
                  <span>
                    {t('scenario association', 'שיוך מתרחיש')}{' '}
                    <Val>{Math.round(pair.association.confidence * 100)}%</Val>
                  </span>
                  <DemoModeBadge when />
                </>
              ) : null}
              <span className="io2-ev-sep">·</span>
              <span className="io2-ev-basis">{t(pair.association?.basisEn, pair.association?.basisHe)}</span>
            </span>
          ) : null}
        </EvidenceRow>

        {/* Other open alerts in the SAME AREA as the selected one. Listed, never
            merged: sharing a place is not evidence of sharing an event, and the
            backend computes no association at all. The label says so on the row
            itself so it cannot be read as a sub-source of the selection. */}
        {otherEvidence && otherEvidence.length ? (
          <EvidenceRow source="other" sourceLabel={t('AREA', 'אזור')}>
            <span className="io2-ev-line">
              <span className="io2-ev-notassoc">{t('NOT ASSOCIATED', 'ללא שיוך')}</span>
              <span className="io2-ev-basis">
                {t('Other active evidence in this area', 'ראיות פעילות נוספות באזור')}
              </span>
              {otherEvidence.slice(0, 3).map((item) => (
                <span key={item.id} className="io2-ev-other">
                  <Val>{item.sourceType === 'radar' ? (item.sourceId || 'RDR') : 'CAM'}</Val>
                  <span className="io2-ev-sep">·</span>
                  <span>{lang === 'he' ? item.messageHe : item.message}</span>
                </span>
              ))}
              {otherEvidence.length > 3 ? (
                <Val className="io2-ev-basis">+{otherEvidence.length - 3}</Val>
              ) : null}
            </span>
          </EvidenceRow>
        ) : null}
      </div>
    </section>
  )
}
