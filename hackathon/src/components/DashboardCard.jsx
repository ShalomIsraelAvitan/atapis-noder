import './DashboardCard.css'

function DashboardCard({ title, icon, children, className = '' }) {
  return (
    <div className={`dashboard-card ${className}`}>
      <div className="card-header">
        <h2>{title}</h2>
        <span className="card-icon">{icon}</span>
      </div>
      {children}
    </div>
  )
}

export default DashboardCard

