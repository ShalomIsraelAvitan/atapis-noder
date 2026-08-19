import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAtapisData, demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'
import { useRiskTimeline } from './useRiskTimeline'
import { useArduinoSensor } from './useArduinoSensor'
import { useDetections } from './useDetections'
import { buildRiskReasons, sourceContributions } from './whyThisRisk'
import { buildCandidatePairs, demoAssociationScenario } from './candidatePairs'

// Deterministic "Automated System Summary" — built ONLY from system data.
// Not AI-generated and never labeled as such.
function buildActivitySummary(snapshot, stats, alerts) {
  const parts = []
  parts.push(
    snapshot.mode === 'SAFE'
      ? ['System is in SAFE mode.', 'המערכת במצב SAFE.']
      : [`System is in ${snapshot.mode} mode (fused risk ${snapshot.risks.fused}).`,
         `המערכת במצב ${snapshot.mode} (סיכון ממוזג ${snapshot.risks.fused}).`]
  )
  if (snapshot.personCount > 0) {
    parts.push([
      `${snapshot.personCount} person(s) currently tracked${snapshot.motion ? `, dominant motion: ${snapshot.motion}` : ''}.`,
      `‏${snapshot.personCount} אנשים במעקב כרגע${snapshot.motion ? `, תנועה דומיננטית: ${snapshot.motion}` : ''}.`,
    ])
  }
  if (snapshot.radar.targets.length > 0) {
    parts.push([
      `Radar reports ${snapshot.radar.targets.length} active target(s) (${snapshot.radar.provider || 'ld2450'}).`,
      `הרדאר מדווח על ${snapshot.radar.targets.length} מטרות פעילות (${snapshot.radar.provider || 'ld2450'}).`,
    ])
  }
  if (snapshot.hasWeapon) {
    parts.push(['Weapon association is active on a tracked person.', 'שיוך נשק פעיל על אדם במעקב.'])
  }
  if (alerts.length) {
    parts.push([
      `${alerts.length} alert(s) recorded this session; latest: ${alerts[0].message}.`,
      `‏${alerts.length} התראות נרשמו בסשן; האחרונה: ${alerts[0].message}.`,
    ])
  }
  if (stats.total > 0) {
    parts.push([
      `Persistent event log holds ${stats.total} detections (${stats.weapons} with weapons).`,
      `יומן האירועים הקבוע מכיל ${stats.total} זיהויים (${stats.weapons} עם נשק).`,
    ])
  }
  return parts
}

export function useDashboardViewModel() {
  const location = useLocation()
  const { roomId } = useParams()
  const demoOpts = demoOptionsFromLocation(location.search)
  const { snapshot, backendStatus, isDemo, alerts, link } = useAtapisData(demoOpts)
  const timeline = useRiskTimeline(snapshot)
  const sensor = useArduinoSensor({ demo: isDemo ? 'forced' : 'auto' })
  const { stats: detectionStats } = useDetections({ demo: demoOpts.demo })

  const reasons = useMemo(() => buildRiskReasons(snapshot), [snapshot])
  const contributions = useMemo(() => sourceContributions(snapshot), [snapshot])
  // Display-only pairing. Live mode yields UNVERIFIED candidates (CP-nn) with no
  // confidence number. Demo mode showcases an illustrative fused contact (FC-nn)
  // that renders with a DemoModeBadge — see candidatePairs.js for why.
  const { pairs: candidatePairs, linkage } = useMemo(() => {
    const scenario = isDemo ? demoAssociationScenario(snapshot) : null
    return buildCandidatePairs(snapshot, { scenario })
  }, [snapshot, isDemo])
  const summary = useMemo(
    () => buildActivitySummary(snapshot, detectionStats, alerts),
    [snapshot, detectionStats, alerts]
  )

  return {
    snapshot,
    backendStatus,
    isDemo,
    alerts,
    link,
    timeline,
    sensor,
    reasons,
    contributions,
    candidatePairs,
    linkage,
    summary,
    detectionStats,
    roomId: roomId || '1',
    demo: demoOpts,
  }
}
