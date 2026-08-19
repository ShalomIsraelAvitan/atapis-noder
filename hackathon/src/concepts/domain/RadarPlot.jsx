import { riskTone, radarMapPosition, RADAR_RANGE } from '../../design-lab/shared/adapter'

// 2D radar plot. variant: 'arcs' (quarter arcs, quiet) | 'grid' (orthographic, tactical).
// Concepts style everything via CSS on .dm-radarplot--<variant>.
//
// Optional, off by default:
//   alertRanges { fenceMm } — a ring at the configured fence alert distance.
//     Safe to draw as a radius because the backend compares it directly against
//     each target's distance_mm from the sensor (ld2450_reader / radar_simulator).
//     No gate marker and no camera<->radar link line is drawn here: camera tracks
//     have no position in radar space, so either would be an invented geometry.
// Grid-variant options, all off by default so existing callers render unchanged:
//   trueRangeTicks — draw the range rings where the target mapping actually puts
//     them (y = 228 - mm/RADAR_RANGE.yMm * 208). The legacy rings are hardcoded
//     at 60/120/180px, which is ~15% further out than the label claims.
//   lateralTicks   — label the lateral (x) axis, which otherwise has no scale.
//   sensorLabel    — name the origin marker, so it cannot be read as a gate.
//   legend         — explain the target colour coding.
//   cornerTag      — { text, tone } provenance/health badge (MOCK, STALE, OFFLINE).
//   declutterLabels — flip a target label to the other side when two targets are
//     close enough for their labels to collide.
export function RadarPlot({
  radar,
  selectedId = null,
  onSelect,
  variant = 'arcs',
  alertRanges = null,
  className = '',
  trueRangeTicks = false,
  lateralTicks = false,
  sensorLabel = null,
  legend = false,
  cornerTag = null,
  declutterLabels = false,
}) {
  const interactive = Boolean(onSelect)
  const fenceMm = Number(alertRanges?.fenceMm)
  const hasFence = Number.isFinite(fenceMm) && fenceMm > 0
  // Same transform the targets use, so a labelled ring means what it says.
  const rangeY = (mm) => 228 - (mm / RADAR_RANGE.yMm) * 208
  const lateralX = (mm) => 160 + (mm / RADAR_RANGE.xMm) * 150

  if (variant === 'grid') {
    return (
      <svg viewBox="0 0 320 240" className={`dm-radarplot dm-radarplot--grid ${className}`} role="img" aria-label="Radar plot" dir="ltr">
        <rect width="320" height="240" className="dm-rp-bg" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`h${i}`} x1="0" y1={40 + i * 40} x2="320" y2={40 + i * 40} className="dm-rp-grid" />
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={`v${i}`} x1={40 + i * 40} y1="0" x2={40 + i * 40} y2="240" className="dm-rp-grid" />
        ))}
        <line x1="160" y1="0" x2="160" y2="240" className="dm-rp-axis" />
        <rect x="150" y="228" width="20" height="8" className="dm-rp-origin" />
        {sensorLabel ? (
          <text x="160" y="223" className="dm-rp-sensorlabel" textAnchor="middle">{sensorLabel}</text>
        ) : null}
        {(trueRangeTicks ? [2000, 4000, 6000, 8000] : [60, 120, 180]).map((v, i) => {
          const y = trueRangeTicks ? rangeY(v) : 228 - v
          const label = trueRangeTicks ? `${v / 1000} m` : `${(i + 1) * 2}M`
          return (
            <g key={v}>
              <line x1="0" y1={y} x2="320" y2={y} className="dm-rp-ring" strokeDasharray="3 5" />
              <text x="4" y={y - 3} className="dm-rp-tick">{label}</text>
            </g>
          )
        })}
        {lateralTicks
          ? [-3000, -1500, 1500, 3000].map((mm) => (
              <text
                key={mm}
                x={lateralX(mm)}
                y="237"
                className="dm-rp-tick"
                textAnchor={mm === -3000 ? 'start' : mm === 3000 ? 'end' : 'middle'}
              >
                {mm > 0 ? '+' : ''}{mm / 1000} m
              </text>
            ))
          : null}
        {legend ? (
          /* Bottom-right: clear of the range labels (left) and the corner tag (top). */
          <g className="dm-rp-legend">
            {[
              { tone: 'safe', label: 'SAFE' },
              { tone: 'alert', label: 'ALERT' },
              { tone: 'danger', label: 'DANGER' },
            ].map((entry, i) => (
              <g key={entry.tone} transform={`translate(256, ${182 + i * 11})`}>
                <rect width="7" height="7" className={`dm-fill-${entry.tone}`} />
                <text x="11" y="6.5" className="dm-rp-tick">{entry.label}</text>
              </g>
            ))}
          </g>
        ) : null}
        {cornerTag?.text ? (
          <text x="314" y="13" className={`dm-rp-cornertag dm-rp-cornertag--${cornerTag.tone || 'muted'}`} textAnchor="end">
            {cornerTag.text}
          </text>
        ) : null}
        {hasFence ? (
          <g className="dm-rp-fence">
            <path
              d={`M ${160 - (fenceMm / RADAR_RANGE.xMm) * 150} 228 A ${(fenceMm / RADAR_RANGE.xMm) * 150} ${(fenceMm / RADAR_RANGE.yMm) * 208} 0 0 1 ${160 + (fenceMm / RADAR_RANGE.xMm) * 150} 228`}
              fill="none"
              strokeDasharray="5 4"
            />
            <text x="164" y={224 - (fenceMm / RADAR_RANGE.yMm) * 208} className="dm-rp-tick">FENCE</text>
          </g>
        ) : null}
        {radar.targets.map((target, index) => {
          const { xRatio, yRatio } = radarMapPosition(target)
          const x = 160 + xRatio * 150
          const y = 228 - yRatio * 208
          // Flip the label to the left when a nearer-listed target would overlap it.
          let labelLeft = false
          if (declutterLabels) {
            labelLeft = radar.targets.slice(0, index).some((other) => {
              const p = radarMapPosition(other)
              return Math.abs(160 + p.xRatio * 150 - x) < 24 && Math.abs(228 - p.yRatio * 208 - y) < 12
            })
          }
          return (
            <g
              key={target.id}
              className={`dm-rp-target ${interactive ? 'is-clickable' : ''}`}
              onClick={interactive ? () => onSelect(target.id) : undefined}
            >
              {selectedId === target.id ? (
                <rect x={x - 10} y={y - 10} width="20" height="20" className="dm-rp-select" strokeDasharray="3 2" />
              ) : null}
              <rect x={x - 5} y={y - 5} width="10" height="10" className={`dm-rp-dot dm-fill-${riskTone(target.risk)}`} />
              <text
                x={labelLeft ? x - 9 : x + 9}
                y={y + 4}
                className="dm-rp-label"
                textAnchor={labelLeft ? 'end' : 'start'}
              >
                T{target.id}
              </text>
            </g>
          )
        })}
        {!radar.targets.length ? (
          <text x="160" y="120" className="dm-rp-empty" textAnchor="middle">
            {radar.connected ? '[ NO CONTACTS ]' : `[ RADAR ${radar.status} ]`}
          </text>
        ) : null}
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 200 150" className={`dm-radarplot dm-radarplot--arcs ${className}`} role="img" aria-label="Radar map" dir="ltr">
      {[45, 85, 125].map((r) => (
        <path key={r} d={`M ${100 - r} 140 A ${r} ${r} 0 0 1 ${100 + r} 140`} fill="none" className="dm-rp-ring" />
      ))}
      <line x1="100" y1="140" x2="100" y2="10" className="dm-rp-axis" />
      <circle cx="100" cy="140" r="3" className="dm-rp-origin" />
      {hasFence ? (
        <path
          className="dm-rp-fence"
          d={`M ${100 - (fenceMm / RADAR_RANGE.xMm) * 88} 140 A ${(fenceMm / RADAR_RANGE.xMm) * 88} ${(fenceMm / RADAR_RANGE.yMm) * 125} 0 0 1 ${100 + (fenceMm / RADAR_RANGE.xMm) * 88} 140`}
          fill="none"
          strokeDasharray="4 3"
        />
      ) : null}
      {radar.targets.map((target) => {
        const { xRatio, yRatio } = radarMapPosition(target)
        const x = 100 + xRatio * 88
        const y = 140 - yRatio * 125
        return (
          <g
            key={target.id}
            className={`dm-rp-target ${interactive ? 'is-clickable' : ''}`}
            onClick={interactive ? () => onSelect(target.id) : undefined}
          >
            <circle cx={x} cy={y} r={selectedId === target.id ? 6 : 4.5} className={`dm-rp-dot dm-fill-${riskTone(target.risk)}`} />
            <text x={x + 8} y={y + 3} className="dm-rp-label">{target.id}</text>
          </g>
        )
      })}
      {!radar.targets.length ? (
        <text x="100" y="80" className="dm-rp-empty" textAnchor="middle">
          {radar.connected ? 'NO TARGETS' : `RADAR ${radar.status}`}
        </text>
      ) : null}
    </svg>
  )
}
