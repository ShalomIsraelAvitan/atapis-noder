import { useEffect, useRef, useState } from 'react'
import { riskTone } from '../../../design-lab/shared/adapter'
import { UNCALIBRATED_TITLE } from '../reasons'

// Risk factors for Industrial OPS.
//
// Same data as the shared WhyThisRisk panel (vm.reasons / vm.contributions) with
// the operational detail this screen needs: which sensor raised it, how long it
// has been up, and whether it is still being reported.
//
// Deliberate constraints:
//  - No internal scroll container. The Session Log owns the one scroll region on
//    this screen; a second one competing with it at 1366x768 is worse than a
//    "+N MORE" affordance.
//  - "Time since detected" is measured client-side from when the factor first
//    appeared in the feed, and is labelled AGE — not a backend event time.
//  - Camera and radar factors never merge into a combined claim; each keeps its
//    source tag and its own risk number.

const SEVERITY_RANK = { danger: 3, alert: 2, info: 1 }
const VISIBLE = 6
const STALE_GRACE_MS = 5000

function ageLabel(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

const SOURCE_CODE = { camera: 'CAM', radar: 'RDR' }

// `areaContext` (opt-in, default false): the caller could not tie these factors
// to the selected alert's own contact — usually because the alert has no track
// or target id to match on. They are still the area's real factors, so they are
// shown, but labelled as context rather than as this alert's cause. Camera
// factors are never offered for a radar alert or the reverse; that filtering
// happens upstream in the command-centre layer.
export function RiskFactorsPanel({ reasons = [], contributions, snapshot, t, lang = 'en', areaContext = false }) {
  const [expanded, setExpanded] = useState(false)
  // first-seen / last-seen per factor key, so AGE and STALE reflect the feed and
  // not the render cycle. All clock reads happen inside effects — never during
  // render — so the panel stays pure and ages advance on a real timer.
  const seenRef = useRef(new Map())
  const [rows, setRows] = useState([])

  useEffect(() => {
    let cancelled = false

    const recompute = () => {
      if (cancelled) return
      const stamp = Date.now()
      const map = seenRef.current

      for (const r of reasons) {
        const prev = map.get(r.key)
        if (prev) {
          prev.lastSeen = stamp
          prev.reason = r
        } else {
          map.set(r.key, { firstSeen: stamp, lastSeen: stamp, reason: r })
        }
      }
      for (const [key, entry] of map) {
        if (stamp - entry.lastSeen > STALE_GRACE_MS) map.delete(key)
      }

      const live = new Set(reasons.map((r) => r.key))
      setRows(
        [...map.entries()]
          .map(([key, entry]) => ({
            key,
            reason: entry.reason,
            ageMs: stamp - entry.firstSeen,
            stale: !live.has(key),
          }))
          .sort((a, b) => {
            const sev = (SEVERITY_RANK[b.reason.severity] || 0) - (SEVERITY_RANK[a.reason.severity] || 0)
            return sev || a.ageMs - b.ageMs
          })
      )
    }

    const immediate = setTimeout(recompute, 0)
    const timer = setInterval(recompute, 1000)
    return () => {
      cancelled = true
      clearTimeout(immediate)
      clearInterval(timer)
    }
  }, [reasons])

  const shown = expanded ? rows : rows.slice(0, VISIBLE)
  const hidden = rows.length - shown.length

  const c = contributions || {}
  const fusedReal = snapshot?.risks?.fused

  return (
    <div className="io2-rf">
      {areaContext && rows.length > 0 ? (
        <p className="io2-rf-context" dir="ltr" title={t(
          'These are the area\'s active risk factors. The data does not tie them to the selected alert\'s contact.',
          'אלה גורמי הסיכון הפעילים של האזור. הנתונים אינם קושרים אותם למגע של ההתראה הנבחרת.'
        )}>
          {t('AREA CONTEXT — NOT ASSOCIATED', 'הקשר אזורי — ללא שיוך')}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="io2-rf-empty">{t('No active risk factors', 'אין גורמי סיכון פעילים')}</p>
      ) : (
        <ul className="io2-rf-list">
          {shown.map((row) => (
            <li
              key={row.key}
              className={`io2-rf-item io2-rf-item--${row.reason.severity} ${row.stale ? 'is-stale' : ''}`}
            >
              <span className={`io2-rf-src io2-src-${row.reason.source}`} dir="ltr">
                {SOURCE_CODE[row.reason.source] || 'SYS'}
              </span>
              <span className="io2-rf-text">
                {row.reason.text}
                {row.reason.uncalibrated ? (
                  <span className="io2-uncal" title={UNCALIBRATED_TITLE[lang === 'he' ? 'he' : 'en']}>
                    {t('UNCALIBRATED', 'ללא כיול')}
                  </span>
                ) : null}
              </span>
              <span className="io2-rf-meta" dir="ltr">
                {row.reason.contribution !== null && row.reason.contribution !== undefined ? (
                  <bdi className={`io2-rf-risk dm-tone-${riskTone(row.reason.contribution)}`}>
                    {Math.round(row.reason.contribution)}
                  </bdi>
                ) : null}
                <bdi className="io2-rf-age">{row.stale ? 'STALE' : ageLabel(row.ageMs)}</bdi>
              </span>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 || expanded ? (
        <button type="button" className="io2-rf-more" onClick={() => setExpanded((v) => !v)} dir="ltr">
          {expanded ? `— ${t('SHOW TOP', 'הצג עיקריים')} ${VISIBLE}` : `+${hidden} ${t('MORE', 'נוספים')}`}
        </button>
      ) : null}

      {/* Source risk summary: three independent numbers, never blended here. */}
      <dl className="io2-rf-sum" dir="ltr">
        <div>
          <dt>{t('CAMERA RISK', 'סיכון מצלמה')}</dt>
          <dd className={`dm-tone-${riskTone(c.camera?.risk)}`}>{c.camera?.risk ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('RADAR RISK', 'סיכון רדאר')}</dt>
          <dd className={`dm-tone-${riskTone(c.radar?.risk)}`}>
            {c.radar?.risk ?? '—'}
            {c.radar?.confidence ? (
              <span className="io2-rf-sub"> conf {Math.round(c.radar.confidence * 100)}%</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{t('FUSED RISK', 'סיכון ממוזג')}</dt>
          <dd className={`dm-tone-${riskTone(fusedReal)}`}>
            {fusedReal ?? '—'}
            <span className="io2-rf-sub"> {t('backend', 'מהשרת')}</span>
          </dd>
        </div>
        <div>
          <dt>{t('SYSTEM MODE', 'מצב מערכת')}</dt>
          <dd className={`dm-tone-${riskTone(fusedReal)}`}>{snapshot?.mode || '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
