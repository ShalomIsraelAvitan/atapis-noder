import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './Settings.css'

const API_BASE_URL = 'http://localhost:5000'

const DEFAULT_RADAR_CONFIG = {
  LD2450_ENABLED: true,
  LD2450_PORT: '',
  LD2450_BAUD: 256000,
  RADAR_USE_MOCK: false,
  radar_mode: 'ld2450',
  scenario: 'approaching_gate',
  max_targets: 3,
  update_rate_hz: 10,
  danger_speed_cm_s: 120,
  alert_speed_cm_s: 60,
  gate_distance_alert_mm: 3000,
  fence_distance_alert_mm: 2000,
  noise_enabled: true,
  show_debug_overlay_on_camera: false,
}

const FALLBACK_RADAR_SCENARIOS = [
  'idle',
  'walking_parallel',
  'approaching_gate',
  'running_to_gate',
  'loitering_near_fence',
  'multiple_targets',
  'noisy_false_positive',
]

function Settings() {
  const { user, updateUser } = useAuth()
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: false,
    detectionSensitivity: 75,
    autoRecord: true,
    motionDetection: true,
  })
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [activeTab, setActiveTab] = useState('general')
  const [saveMessage, setSaveMessage] = useState('')
  const [radarConfig, setRadarConfig] = useState(DEFAULT_RADAR_CONFIG)
  const [radarScenarios, setRadarScenarios] = useState(FALLBACK_RADAR_SCENARIOS)
  const [isLoadingRadarConfig, setIsLoadingRadarConfig] = useState(false)
  const [isSavingRadarConfig, setIsSavingRadarConfig] = useState(false)

  const showMessage = (message) => {
    setSaveMessage(message)
    window.setTimeout(() => setSaveMessage(''), 3000)
  }

  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        username: user.username || '',
        email: user.email || '',
      }))
    }
  }, [user])

  useEffect(() => {
    loadRadarConfig()
  }, [])

  const loadRadarConfig = async () => {
    setIsLoadingRadarConfig(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/radar-config`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Radar configuration could not be loaded.')
      }

      setRadarConfig({ ...DEFAULT_RADAR_CONFIG, ...(data.config || {}) })
      setRadarScenarios(
        Array.isArray(data.available_scenarios) && data.available_scenarios.length > 0
          ? data.available_scenarios
          : FALLBACK_RADAR_SCENARIOS
      )
    } catch (error) {
      showMessage(error.message || 'Radar configuration could not be loaded.')
    } finally {
      setIsLoadingRadarConfig(false)
    }
  }

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSliderChange = (value) => {
    setSettings((prev) => ({
      ...prev,
      detectionSensitivity: parseInt(value, 10),
    }))
  }

  const handleProfileChange = (event) => {
    setProfile({
      ...profile,
      [event.target.name]: event.target.value,
    })
  }

  const handleSaveProfile = () => {
    if (!user || !user.id) {
      showMessage('User not found. Please login again.')
      return
    }

    if (!profile.username || !profile.email) {
      showMessage('Username and email are required')
      return
    }

    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      showMessage('New passwords do not match')
      return
    }

    const updates = {
      username: profile.username,
      email: profile.email,
    }

    if (profile.newPassword) {
      updates.password = profile.newPassword
    }

    updateUser(user.id, updates)
    setProfile((prev) => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }))
    showMessage('Profile updated successfully!')
  }

  const handleRadarFieldChange = (key, value) => {
    setRadarConfig((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleRadarNumberChange = (key, value) => {
    const parsedValue = parseInt(value, 10)
    setRadarConfig((prev) => ({
      ...prev,
      [key]: Number.isNaN(parsedValue) ? 0 : parsedValue,
    }))
  }

  const handleSaveRadarConfig = async () => {
    setIsSavingRadarConfig(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/radar-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(radarConfig),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Radar configuration could not be saved.')
      }

      setRadarConfig({ ...DEFAULT_RADAR_CONFIG, ...(data.config || {}) })
      setRadarScenarios(
        Array.isArray(data.available_scenarios) && data.available_scenarios.length > 0
          ? data.available_scenarios
          : FALLBACK_RADAR_SCENARIOS
      )
      showMessage('Radar configuration saved.')
    } catch (error) {
      showMessage(error.message || 'Radar configuration could not be saved.')
    } finally {
      setIsSavingRadarConfig(false)
    }
  }

  const handleSaveGeneral = () => {
    showMessage('General settings saved locally in the dashboard UI.')
  }

  const handleResetGeneral = () => {
    setSettings({
      notifications: true,
      emailAlerts: false,
      detectionSensitivity: 75,
      autoRecord: true,
      motionDetection: true,
    })
    showMessage('General settings reset in the UI.')
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <header className="settings-header">
          <h1>Settings</h1>
          <p>Configure your smart security system</p>
        </header>

        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`tab-btn ${activeTab === 'radar' ? 'active' : ''}`}
            onClick={() => setActiveTab('radar')}
          >
            Radar
          </button>
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
        </div>

        {saveMessage && (
          <div className={`save-message ${
            saveMessage.toLowerCase().includes('success') ||
            saveMessage.toLowerCase().includes('saved') ||
            saveMessage.toLowerCase().includes('reset')
              ? 'success'
              : 'error'
          }`}>
            {saveMessage}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="settings-sections">
            <section className="settings-section">
              <h2>Profile Settings</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    name="username"
                    value={profile.username}
                    onChange={handleProfileChange}
                    placeholder="Enter username"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profile.email}
                    onChange={handleProfileChange}
                    placeholder="Enter email"
                  />
                </div>
                <div className="form-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={profile.currentPassword}
                    onChange={handleProfileChange}
                    placeholder="Enter current password (optional)"
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={profile.newPassword}
                    onChange={handleProfileChange}
                    placeholder="Enter new password (optional)"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={profile.confirmPassword}
                    onChange={handleProfileChange}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <div className="settings-actions">
                <button onClick={handleSaveProfile} className="save-btn">Save Profile</button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="settings-sections">
            <section className="settings-section">
              <h2>Detection Settings</h2>
              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Detection Sensitivity</label>
                  <p className="setting-desc">Adjust how sensitive the detection system is</p>
                </div>
                <div className="setting-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.detectionSensitivity}
                    onChange={(event) => handleSliderChange(event.target.value)}
                    className="slider"
                  />
                  <span className="slider-value">{settings.detectionSensitivity}%</span>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Motion Detection</label>
                  <p className="setting-desc">Enable motion-based detection</p>
                </div>
                <div className="setting-control">
                  <button
                    className={`toggle-btn ${settings.motionDetection ? 'active' : ''}`}
                    onClick={() => handleToggle('motionDetection')}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Auto Record</label>
                  <p className="setting-desc">Automatically record when detections occur</p>
                </div>
                <div className="setting-control">
                  <button
                    className={`toggle-btn ${settings.autoRecord ? 'active' : ''}`}
                    onClick={() => handleToggle('autoRecord')}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h2>Notifications</h2>
              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Push Notifications</label>
                  <p className="setting-desc">Receive notifications for detections</p>
                </div>
                <div className="setting-control">
                  <button
                    className={`toggle-btn ${settings.notifications ? 'active' : ''}`}
                    onClick={() => handleToggle('notifications')}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Email Alerts</label>
                  <p className="setting-desc">Send email notifications for important events</p>
                </div>
                <div className="setting-control">
                  <button
                    className={`toggle-btn ${settings.emailAlerts ? 'active' : ''}`}
                    onClick={() => handleToggle('emailAlerts')}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h2>System Information</h2>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">System Version</span>
                  <span className="info-value">v1.0.0</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Last Update</span>
                  <span className="info-value">2026-06-04</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Camera Status</span>
                  <span className="info-value active">Online</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Storage Used</span>
                  <span className="info-value">2.4 GB / 10 GB</span>
                </div>
              </div>
            </section>

            <div className="settings-actions">
              <button className="save-btn" onClick={handleSaveGeneral}>Save Changes</button>
              <button className="reset-btn" onClick={handleResetGeneral}>Reset to Defaults</button>
            </div>
          </div>
        )}

        {activeTab === 'radar' && (
          <div className="settings-sections">
            <section className="settings-section">
              <h2>LD2450 Radar Control</h2>
              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">LD2450 Reader</label>
                  <p className="setting-desc">Enable or disable the real LD2450 serial reader.</p>
                </div>
                <div className="setting-control">
                  <button
                    className={`toggle-btn ${radarConfig.LD2450_ENABLED ? 'active' : ''}`}
                    onClick={() => handleRadarFieldChange('LD2450_ENABLED', !radarConfig.LD2450_ENABLED)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Use Mock Radar</label>
                  <p className="setting-desc">Only enable the simulator when you explicitly want demo data.</p>
                </div>
                <div className="setting-control">
                  <button
                    className={`toggle-btn ${radarConfig.RADAR_USE_MOCK ? 'active' : ''}`}
                    onClick={() => handleRadarFieldChange('RADAR_USE_MOCK', !radarConfig.RADAR_USE_MOCK)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Mock Noise Layer</label>
                  <p className="setting-desc">Inject jitter only when mock mode is active.</p>
                </div>
                <div className="setting-control">
                  <button
                    className={`toggle-btn ${radarConfig.noise_enabled ? 'active' : ''}`}
                    onClick={() => handleRadarFieldChange('noise_enabled', !radarConfig.noise_enabled)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Debug Overlay On Camera</label>
                  <p className="setting-desc">Show technical radar and fusion overlays directly on the live camera feed.</p>
                </div>
                <div className="setting-control">
                  <button
                    className={`toggle-btn ${radarConfig.show_debug_overlay_on_camera ? 'active' : ''}`}
                    onClick={() =>
                      handleRadarFieldChange(
                        'show_debug_overlay_on_camera',
                        !radarConfig.show_debug_overlay_on_camera
                      )
                    }
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Radar Mode</label>
                  <input
                    type="text"
                    value={radarConfig.radar_mode || (radarConfig.RADAR_USE_MOCK ? 'mock' : 'ld2450')}
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label>LD2450 Port</label>
                  <input
                    type="text"
                    value={radarConfig.LD2450_PORT || ''}
                    onChange={(event) => handleRadarFieldChange('LD2450_PORT', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                    placeholder="COM14 or /dev/ttyUSB0"
                  />
                </div>
                <div className="form-group">
                  <label>LD2450 Baud</label>
                  <input
                    type="number"
                    min="9600"
                    max="2000000"
                    value={radarConfig.LD2450_BAUD}
                    onChange={(event) => handleRadarNumberChange('LD2450_BAUD', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  />
                </div>
                <div className="form-group">
                  <label>Mock Scenario</label>
                  <select
                    value={radarConfig.scenario}
                    onChange={(event) => handleRadarFieldChange('scenario', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig || !radarConfig.RADAR_USE_MOCK}
                  >
                    {radarScenarios.map((scenario) => (
                      <option key={scenario} value={scenario}>
                        {scenario}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Update Rate (Hz)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={radarConfig.update_rate_hz}
                    onChange={(event) => handleRadarNumberChange('update_rate_hz', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  />
                </div>
                <div className="form-group">
                  <label>Max Targets</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    value={radarConfig.max_targets}
                    onChange={(event) => handleRadarNumberChange('max_targets', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  />
                </div>
                <div className="form-group">
                  <label>Alert Speed (cm/s)</label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={radarConfig.alert_speed_cm_s}
                    onChange={(event) => handleRadarNumberChange('alert_speed_cm_s', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  />
                </div>
                <div className="form-group">
                  <label>Danger Speed (cm/s)</label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={radarConfig.danger_speed_cm_s}
                    onChange={(event) => handleRadarNumberChange('danger_speed_cm_s', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  />
                </div>
                <div className="form-group">
                  <label>Gate Alert Distance (mm)</label>
                  <input
                    type="number"
                    min="500"
                    max="12000"
                    value={radarConfig.gate_distance_alert_mm}
                    onChange={(event) => handleRadarNumberChange('gate_distance_alert_mm', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  />
                </div>
                <div className="form-group">
                  <label>Fence Alert Distance (mm)</label>
                  <input
                    type="number"
                    min="500"
                    max="12000"
                    value={radarConfig.fence_distance_alert_mm}
                    onChange={(event) => handleRadarNumberChange('fence_distance_alert_mm', event.target.value)}
                    disabled={isLoadingRadarConfig || isSavingRadarConfig}
                  />
                </div>
              </div>

              <p className="settings-inline-note">
                Use
                <code> LD2450_PORT </code>
                ,
                <code> LD2450_BAUD </code>
                ,
                <code> LD2450_ENABLED </code>
                and
                <code> RADAR_USE_MOCK </code>
                in
                <code> radar_config.json </code>
                or your environment. Mock mode stays off unless you enable it explicitly.
              </p>

              <div className="settings-actions">
                <button
                  className="reset-btn"
                  onClick={loadRadarConfig}
                  disabled={isLoadingRadarConfig || isSavingRadarConfig}
                >
                  {isLoadingRadarConfig ? 'Loading...' : 'Reload Config'}
                </button>
                <button
                  className="save-btn"
                  onClick={handleSaveRadarConfig}
                  disabled={isLoadingRadarConfig || isSavingRadarConfig}
                >
                  {isSavingRadarConfig ? 'Saving...' : 'Save Radar Config'}
                </button>
              </div>
            </section>

            <section className="settings-section">
              <h2>Radar Deployment Notes</h2>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Provider</span>
                  <span className="info-value">
                    {radarConfig.radar_mode || (radarConfig.RADAR_USE_MOCK ? 'mock' : 'ld2450')}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">LD2450 Port</span>
                  <span className="info-value">{radarConfig.LD2450_PORT || 'Not set'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Baud Rate</span>
                  <span className="info-value">{radarConfig.LD2450_BAUD}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Mock Enabled</span>
                  <span className="info-value">{radarConfig.RADAR_USE_MOCK ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings
