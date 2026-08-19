import DashboardCard from './DashboardCard'
import './PerformanceMetricsCard.css'

function PerformanceMetricsCard() {
  const metrics = [
    { label: 'CPU Usage', value: 65 },
    { label: 'Memory', value: 48 },
    { label: 'Storage', value: 72 },
    { label: 'Network', value: 35 }
  ]

  return (
    <DashboardCard title="Performance Metrics" icon="⚙️">
      <div className="performance-content">
        {metrics.map((metric, index) => (
          <div key={index} className="metric-item">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{ width: `${metric.value}%` }}
              />
            </div>
            <div className="metric-value">{metric.value}%</div>
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}

export default PerformanceMetricsCard

