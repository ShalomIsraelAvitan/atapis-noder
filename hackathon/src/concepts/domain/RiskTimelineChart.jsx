import { useMemo, useRef, useState } from 'react'
import { useConcept } from '../useConcept'

// Risk-over-time line chart (single series: fused risk, 0–100).
// Built per the dataviz method: one axis, recessive grid, thin 2px line,
// status colors reserved for the ALERT/DANGER threshold references (labeled,
// never color-alone), hover crosshair + tooltip, hidden text summary.
//
// scope==='session' → data is the local "Current Session" buffer (resets on
// reload — there is no historical risk endpoint). scope==='events' → real
// persisted detection events.

const W = 560
const H = 160
const PAD = { top: 10, right: 8, bottom: 18, left: 26 }

// Opt-in refinements (defaults reproduce the original rendering exactly):
//   axisTicks          — draw start/mid/end clock labels on the time axis. The
//                        bottom padding is already reserved for them.
//   thresholdLabelPos  — 'end' (default) anchors the ALERT/DANGER captions on the
//                        right, where the newest samples are and where they
//                        collide with the line. 'start' moves them left.
export function RiskTimelineChart({
  samples,
  scope = 'session',
  className = '',
  axisTicks = false,
  thresholdLabelPos = 'end',
}) {
  const { t } = useConcept()
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const geometry = useMemo(() => {
    if (!samples || samples.length < 2) return null
    const t0 = samples[0].t
    const t1 = samples[samples.length - 1].t
    const span = Math.max(t1 - t0, 1)
    const x = (time) => PAD.left + ((time - t0) / span) * (W - PAD.left - PAD.right)
    const y = (risk) => PAD.top + (1 - Math.min(Math.max(risk, 0), 100) / 100) * (H - PAD.top - PAD.bottom)
    const path = samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.t).toFixed(1)} ${y(s.fused).toFixed(1)}`)
      .join(' ')
    const area = `${path} L ${x(t1).toFixed(1)} ${y(0)} L ${x(t0).toFixed(1)} ${y(0)} Z`
    return { x, y, path, area, t0, t1 }
  }, [samples])

  const summary = useMemo(() => {
    if (!samples || !samples.length) return null
    const values = samples.map((s) => s.fused)
    return { min: Math.min(...values), max: Math.max(...values), current: values[values.length - 1] }
  }, [samples])

  if (!geometry) {
    return (
      <div className={`dm-chart dm-chart--empty ${className}`}>
        <p className="dm-empty">{t('Collecting risk samples…', 'אוסף דגימות סיכון…')}</p>
      </div>
    )
  }

  const onMove = (event) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((event.clientX - rect.left) / rect.width) * W
    // nearest sample by x
    let best = null
    let bestDist = Infinity
    for (const s of samples) {
      const dist = Math.abs(geometry.x(s.t) - px)
      if (dist < bestDist) {
        bestDist = dist
        best = s
      }
    }
    setHover(best)
  }

  return (
    <div className={`dm-chart ${className}`} dir="ltr">
      <div className="dm-chart-head">
        <span className="dm-chart-title">{t('Risk over time', 'סיכון לאורך זמן')}</span>
        <span className="dm-chart-scope">
          {scope === 'session' ? t('Current Session', 'סשן נוכחי') : t('Recorded events', 'אירועים שמורים')}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="dm-chart-svg"
        role="img"
        aria-label={
          summary
            ? `Fused risk timeline. Current ${summary.current}, min ${summary.min}, max ${summary.max}.`
            : 'Fused risk timeline'
        }
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* recessive grid */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geometry.y(v)} y2={geometry.y(v)} className="dm-chart-grid" />
            <text x={PAD.left - 6} y={geometry.y(v) + 3} className="dm-chart-tick" textAnchor="end">{v}</text>
          </g>
        ))}
        {/* labeled threshold references (status colors, never color-alone) */}
        <line x1={PAD.left} x2={W - PAD.right} y1={geometry.y(40)} y2={geometry.y(40)} className="dm-chart-ref dm-chart-ref--alert" />
        <text
          x={thresholdLabelPos === 'start' ? PAD.left + 4 : W - PAD.right}
          y={geometry.y(40) - 3}
          className="dm-chart-ref-label dm-chart-ref-label--alert"
          textAnchor={thresholdLabelPos === 'start' ? 'start' : 'end'}
        >{'ALERT  ≥  40'}</text>
        <line x1={PAD.left} x2={W - PAD.right} y1={geometry.y(75)} y2={geometry.y(75)} className="dm-chart-ref dm-chart-ref--danger" />
        <text
          x={thresholdLabelPos === 'start' ? PAD.left + 4 : W - PAD.right}
          y={geometry.y(75) - 3}
          className="dm-chart-ref-label dm-chart-ref-label--danger"
          textAnchor={thresholdLabelPos === 'start' ? 'start' : 'end'}
        >{'DANGER  ≥  75'}</text>
        {/* time axis: start / middle / end of the buffer actually on screen */}
        {axisTicks ? (
          <g className="dm-chart-timeaxis">
            {[
              { at: geometry.t0, x: PAD.left, anchor: 'start' },
              { at: (geometry.t0 + geometry.t1) / 2, x: (PAD.left + W - PAD.right) / 2, anchor: 'middle' },
              { at: geometry.t1, x: W - PAD.right, anchor: 'end' },
            ].map((tick) => (
              <text
                key={tick.anchor}
                x={tick.x}
                y={H - 5}
                className="dm-chart-tick"
                textAnchor={tick.anchor}
              >
                {new Date(tick.at).toLocaleTimeString('en-GB')}
              </text>
            ))}
          </g>
        ) : null}
        {/* series */}
        <path d={geometry.area} className="dm-chart-area" />
        <path d={geometry.path} className="dm-chart-line" />
        {/* hover crosshair + tooltip */}
        {hover ? (
          <g>
            <line
              x1={geometry.x(hover.t)} x2={geometry.x(hover.t)}
              y1={PAD.top} y2={H - PAD.bottom}
              className="dm-chart-crosshair"
            />
            <circle cx={geometry.x(hover.t)} cy={geometry.y(hover.fused)} r="4" className="dm-chart-dot" />
          </g>
        ) : null}
      </svg>
      {hover ? (
        <div className="dm-chart-tooltip" role="status">
          {new Date(hover.t).toLocaleTimeString('en-GB')} · {t('fused', 'ממוזג')} {hover.fused}
          {hover.mode ? ` · ${hover.mode}` : ''}
        </div>
      ) : (
        <div className="dm-chart-tooltip dm-chart-tooltip--idle">
          {summary ? `now ${summary.current} · min ${summary.min} · max ${summary.max}` : ''}
        </div>
      )}
    </div>
  )
}
