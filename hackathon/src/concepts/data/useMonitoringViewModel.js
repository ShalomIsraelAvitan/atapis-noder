import { useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAtapisData, demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'
import { buildRiskReasons } from './whyThisRisk'
import { buildCandidatePairs, demoAssociationScenario } from './candidatePairs'

// Camera / monitoring page view model. Exactly one MJPEG source may be
// mounted at any time (performance budget H4) — `source` picks it.
export function useMonitoringViewModel() {
  const location = useLocation()
  const { roomId } = useParams()
  const demoOpts = demoOptionsFromLocation(location.search)
  const { snapshot, backendStatus, isDemo, alerts } = useAtapisData(demoOpts)
  const [source, setSource] = useState('webcam')
  const [selectedTargetId, setSelectedTargetId] = useState(null)

  const camera = snapshot.cameras[source]
  const reasons = useMemo(() => buildRiskReasons(snapshot), [snapshot])
  // Display-only pairing. Live mode yields UNVERIFIED candidates (CP-nn); demo
  // mode showcases an illustrative fused contact (FC-nn) badged as demo data.
  const { pairs: candidatePairs, linkage } = useMemo(() => {
    const scenario = isDemo ? demoAssociationScenario(snapshot) : null
    return buildCandidatePairs(snapshot, { scenario })
  }, [snapshot, isDemo])
  const selectedTarget =
    snapshot.radar.targets.find((target) => target.id === selectedTargetId) || null
  const selectedPair =
    candidatePairs.find((pair) => pair.radarTargetId === selectedTargetId) || null

  return {
    snapshot,
    backendStatus,
    isDemo,
    alerts,
    reasons,
    candidatePairs,
    linkage,
    selectedPair,
    roomId: roomId || '1',
    source,
    setSource,
    camera,
    selectedTargetId,
    setSelectedTargetId,
    selectedTarget,
    demo: demoOpts,
  }
}
