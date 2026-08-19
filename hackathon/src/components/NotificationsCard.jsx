import DashboardCard from './DashboardCard'
import './NotificationsCard.css'

function NotificationsCard() {
  const notifications = [
    {
      title: 'New message received',
      desc: 'You have 3 unread messages',
      unread: true
    },
    {
      title: 'Weekly report ready',
      desc: 'Your weekly summary is available',
      unread: false
    },
    {
      title: 'System maintenance',
      desc: 'Scheduled for tomorrow at 2 AM',
      unread: false
    }
  ]

  return (
    <DashboardCard title="Notifications" icon="🔔">
      <div className="notifications-content">
        {notifications.map((notification, index) => (
          <div
            key={index}
            className={`notification-item ${notification.unread ? 'unread' : ''}`}
          >
            {notification.unread && <div className="notification-badge"></div>}
            <div className="notification-text">
              <div className="notification-title">{notification.title}</div>
              <div className="notification-desc">{notification.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}

export default NotificationsCard

