import DashboardCard from './DashboardCard'
import './StatisticsCard.css'

function StatisticsCard() {
  const stats = [
    { value: '1,234', label: 'Total Users' },
    { value: '567', label: 'Active Now' },
    { value: '89%', label: 'Engagement' }
  ]

  return (
    <DashboardCard title="Statistics" icon="📊">
      <div className="stats-content">
        {stats.map((stat, index) => (
          <div key={index} className="stat-item">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}

export default StatisticsCard

