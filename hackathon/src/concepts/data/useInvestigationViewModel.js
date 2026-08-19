import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'
import { useDetections } from './useDetections'

// Investigation Room (חדר חקירה) view model — real persisted detections from
// /api/detections with client-side filtering, plus a selected-event drilldown.

const MODE_OPTIONS = ['ALL', 'SAFE', 'ALERT', 'DANGER']
const SOURCE_OPTIONS = ['ALL', 'webcam', 'dahua']
const RANGE_OPTIONS = [
  { id: 'all', en: 'All time', he: 'כל הזמן', ms: null },
  { id: '24h', en: 'Last 24h', he: '24 שעות', ms: 24 * 3600 * 1000 },
  { id: '7d', en: 'Last 7 days', he: '7 ימים', ms: 7 * 24 * 3600 * 1000 },
  { id: '30d', en: 'Last 30 days', he: '30 ימים', ms: 30 * 24 * 3600 * 1000 },
]

// Reasons for a stored event use only fields persisted with the detection.
export function eventReasons(event, t = (en) => en) {
  const reasons = []
  if (event.personCount > 0) {
    reasons.push({ key: 'person', severity: 'info', source: 'camera', text: t('Person detected', 'זוהה אדם') })
  }
  if (event.motion === 'running') {
    reasons.push({ key: 'running', severity: 'alert', source: 'camera', text: t('Running', 'ריצה') })
  } else if (event.motion) {
    reasons.push({ key: 'motion', severity: 'info', source: 'camera', text: t(event.motion, event.motion) })
  }
  if (event.context && event.context.includes('approach')) {
    reasons.push({ key: 'approach', severity: 'alert', source: 'camera', text: t('Approaching gate', 'התקרבות לשער') })
  }
  if (event.context && event.context.includes('loiter')) {
    reasons.push({ key: 'loiter', severity: 'alert', source: 'camera', text: t('Loitering', 'שהייה ממושכת') })
  }
  if (event.hasWeapon || (event.context && event.context.includes('armed'))) {
    reasons.push({ key: 'armed', severity: 'danger', source: 'camera', text: t('Weapon detected', 'זוהה נשק') })
  }
  if (event.radarRisk > 0) {
    reasons.push({
      key: 'radar', severity: event.radarRisk >= 40 ? 'alert' : 'info', source: 'radar',
      text: t(`Radar contribution (risk ${event.radarRisk})`, `תרומת רדאר (סיכון ${event.radarRisk})`),
    })
  }
  return reasons
}

export function useInvestigationViewModel() {
  const location = useLocation()
  const demoOpts = demoOptionsFromLocation(location.search)
  const detectionsApi = useDetections({ demo: demoOpts.demo })

  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('ALL')
  const [source, setSource] = useState('ALL')
  const [range, setRange] = useState('all')
  const [minRisk, setMinRisk] = useState(0)
  const [selectedId, setSelectedId] = useState(null)

  const filtered = useMemo(() => {
    const rangeMs = RANGE_OPTIONS.find((r) => r.id === range)?.ms ?? null
    const cutoff = rangeMs ? Date.now() - rangeMs : null
    const q = search.trim().toLowerCase()
    return detectionsApi.detections.filter((event) => {
      if (mode !== 'ALL' && event.mode !== mode) return false
      if (source !== 'ALL' && event.source !== source) return false
      if (event.fusedRisk < minRisk) return false
      if (cutoff && event.timestamp && event.timestamp.getTime() < cutoff) return false
      if (q) {
        const haystack = `${event.context || ''} ${event.motion || ''} ${event.mode} ${event.source} ${event.weaponType || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [detectionsApi.detections, search, mode, source, range, minRisk])

  const selected = useMemo(
    () => filtered.find((event) => event.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  )

  // Real risk-over-events series (persisted data), oldest → newest.
  const riskSeries = useMemo(
    () =>
      [...filtered]
        .filter((event) => event.timestamp)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((event) => ({ t: event.timestamp.getTime(), fused: event.fusedRisk, mode: event.mode })),
    [filtered]
  )

  return {
    ...detectionsApi,
    filtered,
    riskSeries,
    filters: {
      search, setSearch,
      mode, setMode, modeOptions: MODE_OPTIONS,
      source, setSource, sourceOptions: SOURCE_OPTIONS,
      range, setRange, rangeOptions: RANGE_OPTIONS,
      minRisk, setMinRisk,
    },
    selected,
    selectedId,
    setSelectedId,
    demo: demoOpts,
  }
}
