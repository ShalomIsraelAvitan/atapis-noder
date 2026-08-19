import DashboardCard from './DashboardCard'
import './ActivityCard.css'

function ActivityCard() {
  const activities = [
    { title: 'New user registered', time: '2 minutes ago' },
    { title: 'System update completed', time: '15 minutes ago' },
    { title: 'Backup created successfully', time: '1 hour ago' },
    { title: 'Performance report generated', time: '3 hours ago' }
  ]

  return (
    <DashboardCard title="Recent Activity" icon="⚡">
      <div className="activity-content">
        {activities.map((activity, index) => (
          <div key={index} className="activity-item">
            <div className="activity-dot"></div>
            <div className="activity-text">
              <div className="activity-title">{activity.title}</div>
              <div className="activity-time">{activity.time}</div>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}

export default ActivityCard

