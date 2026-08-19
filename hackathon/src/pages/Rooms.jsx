import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Rooms.css'

function Rooms() {
  const navigate = useNavigate()
  const [room] = useState({ id: 1, name: 'Main Area', status: 'active', cameras: 2 })
  const [systemStatus, setSystemStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000) // Update every 5 seconds
    
    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/status')
      if (response.ok) {
        const data = await response.json()
        setSystemStatus(data)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error fetching status:', error)
      setLoading(false)
    }
  }

  const handleRoomClick = () => {
    navigate(`/camera/${room.id}`)
  }


  return (
    <div className="rooms-page">
      <header className="rooms-header">
        <div className="header-content">
          <div>
            <h1>Smart Security System</h1>
            <p>Monitor your security cameras</p>
          </div>
        </div>
      </header>

      <div className="rooms-container">
        <div className="rooms-grid">
          <div
            className={`room-card ${systemStatus?.status === 'active' ? 'active' : 'inactive'}`}
            onClick={handleRoomClick}
          >
            <div className="room-header">
              <div className="room-status-indicator"></div>
              <span className="room-status-text">
                {loading ? 'Loading...' : (systemStatus?.status || 'unknown')}
              </span>
            </div>
            <div className="room-content">
              <h2 className="room-name">{room.name}</h2>
              <div className="room-info">
                <div className="info-item">
                  <span className="info-icon">📹</span>
                  <span>{room.cameras} Camera</span>
                </div>
                {systemStatus && (
                  <>
                    {systemStatus.person_count !== undefined && (
                      <div className="info-item">
                        <span className="info-icon">👤</span>
                        <span>{systemStatus.person_count} Person(s)</span>
                      </div>
                    )}
                    {systemStatus.has_weapon && (
                      <div className="info-item" style={{ color: '#ff3b30', fontWeight: 'bold' }}>
                        <span className="info-icon">⚠️</span>
                        <span>Weapon: {systemStatus.weapon_type || 'Detected'}</span>
                      </div>
                    )}
                    {systemStatus.mode && (
                      <div className="info-item">
                        <span className="info-icon">
                          {systemStatus.mode === 'DANGER' ? '🔴' : 
                           systemStatus.mode === 'ALERT' ? '🟠' : '🟢'}
                        </span>
                        <span>Mode: {systemStatus.mode}</span>
                      </div>
                    )}
                    {systemStatus.motion && (
                      <div className="info-item">
                        <span className="info-icon">🏃</span>
                        <span>Motion: {systemStatus.motion}</span>
                      </div>
                    )}
                    {systemStatus.lastUpdate && (
                      <div className="info-item">
                        <span className="info-icon">🕐</span>
                        <span>Updated {systemStatus.lastUpdate}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="room-footer">
              <button className="view-room-btn">View Camera →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Rooms

