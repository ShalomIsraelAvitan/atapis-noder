import DashboardCard from './DashboardCard'
import './QuickActionsCard.css'

function QuickActionsCard() {
  const actions = [
    { label: 'Create New', type: 'primary' },
    { label: 'Import Data', type: 'secondary' },
    { label: 'Export Report', type: 'secondary' },
    { label: 'Settings', type: 'secondary' }
  ]

  return (
    <DashboardCard title="Quick Actions" icon="🚀">
      <div className="actions-content">
        {actions.map((action, index) => (
          <button
            key={index}
            className={`action-btn ${action.type}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </DashboardCard>
  )
}

export default QuickActionsCard

