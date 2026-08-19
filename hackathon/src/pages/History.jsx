import { useState, useEffect } from 'react'
import './History.css'

function History() {
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    people: 0,
    weapons: 0,
    alerts: 0
  })

  useEffect(() => {
    fetchDetections()
    const interval = setInterval(fetchDetections, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchDetections = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/detections')
      if (response.ok) {
        const data = await response.json()
        setDetections(data)
        
        // Calculate stats
        const total = data.length
        const people = data.reduce((sum, d) => sum + (d.person_count || 0), 0)
        const weapons = data.filter(d => d.has_weapon).length
        const alerts = data.filter(d => d.mode === 'ALERT' || d.mode === 'DANGER').length
        setStats({ total, people, weapons, alerts })
      }
    } catch (error) {
      console.error('Error fetching detections:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all detection history? This action cannot be undone.')) {
      return
    }
    
    setClearing(true)
    try {
      const response = await fetch('http://localhost:5000/api/detections', {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setDetections([])
        setStats({ total: 0, people: 0, weapons: 0, alerts: 0 })
      } else {
        alert('Failed to clear history')
      }
    } catch (error) {
      console.error('Error clearing history:', error)
      alert('Error clearing history')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="history-page">
      <div className="history-container">
        <header className="history-header">
          <div className="header-content-wrapper">
            <div>
              <h1>Detection History</h1>
              <p>View all past detection events with captured images</p>
            </div>
            <button 
              onClick={handleClearHistory} 
              className="clear-history-btn"
              disabled={clearing || detections.length === 0}
            >
              {clearing ? 'Clearing...' : '🗑️ Clear History'}
            </button>
          </div>
        </header>

        <div className="history-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Detections</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.people}</div>
            <div className="stat-label">Total Persons</div>
          </div>
          <div className="stat-card" style={{ background: stats.weapons > 0 ? 'rgba(255, 59, 48, 0.1)' : undefined }}>
            <div className="stat-value" style={{ color: stats.weapons > 0 ? '#ff3b30' : undefined }}>
              {stats.weapons}
            </div>
            <div className="stat-label">Weapon Detections</div>
          </div>
          <div className="stat-card" style={{ background: stats.alerts > 0 ? 'rgba(255, 149, 0, 0.1)' : undefined }}>
            <div className="stat-value" style={{ color: stats.alerts > 0 ? '#ff9500' : undefined }}>
              {stats.alerts}
            </div>
            <div className="stat-label">Alerts & Dangers</div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading detections...</div>
        ) : detections.length === 0 ? (
          <div className="empty-state">No detections found</div>
        ) : (
          <div className="history-grid">
            {detections.map((detection, index) => {
              const { date, time } = formatDate(detection.timestamp)
              return (
                <div key={index} className="detection-card">
                  <div className="detection-image">
                    <img
                      src={`http://localhost:5000/api/images/${detection.filename}`}
                      alt={`Detection ${date}`}
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E'
                      }}
                    />
                  </div>
                  <div className="detection-info">
                    <div className="detection-time">
                      <div className="time-primary">{time}</div>
                      <div className="time-secondary">{date}</div>
                    </div>
                    <div className="detection-details">
                      {detection.person_count !== undefined && (
                        <div className="detail-item">
                          <span className="detail-label">Persons:</span>
                          <span className="detail-value">{detection.person_count}</span>
                        </div>
                      )}
                      {detection.has_weapon && (
                        <div className="detail-item" style={{ background: 'rgba(255, 59, 48, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                          <span className="detail-label" style={{ color: '#ff3b30', fontWeight: 'bold' }}>⚠️ Weapon:</span>
                          <span className="detail-value" style={{ color: '#ff3b30', fontWeight: 'bold' }}>
                            {detection.weapon_type || 'Detected'}
                          </span>
                        </div>
                      )}
                      {detection.motion && (
                        <div className="detail-item">
                          <span className="detail-label">Motion:</span>
                          <span className="detail-value">{detection.motion}</span>
                        </div>
                      )}
                      {detection.mode && (
                        <div className="detail-item">
                          <span className="detail-label">Mode:</span>
                          <span className={`detail-value mode-${detection.mode.toLowerCase()}`}>
                            {detection.mode}
                          </span>
                        </div>
                      )}
                      {detection.context && (
                        <div className="detail-item context">
                          <span className="detail-label">Context:</span>
                          <span className="detail-value">{detection.context}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default History
