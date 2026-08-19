import DashboardCard from './DashboardCard'
import './AnalyticsCard.css'

function AnalyticsCard() {
  const chartData = [60, 80, 45, 90, 70, 55]

  return (
    <DashboardCard title="Analytics" icon="📈">
      <div className="analytics-content">
        <div className="chart-placeholder">
          {chartData.map((height, index) => (
            <div
              key={index}
              className="chart-bar"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="analytics-footer">
          <span className="trend positive">↑ 12.5%</span>
          <span className="trend-label">vs last month</span>
        </div>
      </div>
    </DashboardCard>
  )
}

export default AnalyticsCard

