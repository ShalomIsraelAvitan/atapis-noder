import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './CameraRoom.css'

const API_BASE_URL = 'http://localhost:5000'
const STATUS_POLL_INTERVAL_MS = 1000

function CameraRoom() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const seenMessages = useRef(new Set())
  const [activeTab, setActiveTab] = useState('live')
  const [systemStatus, setSystemStatus] = useState(null)
  const [radarLive, setRadarLive] = useState(null)
  const [cameraStatuses, setCameraStatuses] = useState({})
  const [streamVersions, setStreamVersions] = useState({ webcam: 0, dahua: 0 })
  const [streamStates, setStreamStates] = useState({
    webcam: { isStreaming: false, error: null },
    dahua: { isStreaming: false, error: null },
  })
  const [scenarioFile, setScenarioFile] = useState(null)
  const [scenarioResult, setScenarioResult] = useState(null)
  const [scenarioError, setScenarioError] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [scenarioJobId, setScenarioJobId] = useState(null)
  const [scenarioProgress, setScenarioProgress] = useState(0)
  const [scenarioStage, setScenarioStage] = useState('Idle')
  const [scenarioFramesTotal, setScenarioFramesTotal] = useState(0)
  const [scenarioFramesRead, setScenarioFramesRead] = useState(0)
  const [scenarioFramesAnalyzed, setScenarioFramesAnalyzed] = useState(0)
  const [scenarioHistory, setScenarioHistory] = useState([])
  const [scenarioHistoryError, setScenarioHistoryError] = useState(null)
  const [isLoadingScenarioHistory, setIsLoadingScenarioHistory] = useState(false)
  const [selectedScenarioHistoryId, setSelectedScenarioHistoryId] = useState(null)
  const [deletingScenarioHistoryId, setDeletingScenarioHistoryId] = useState(null)

  const roomName = roomId ? `Main Area / Camera ${roomId}` : 'Main Area'

  useEffect(() => {
    startVideoFeed('webcam')
    startVideoFeed('dahua')
    fetchStatus()
    fetchRadarLive()
    fetchCameraStatuses()
    fetchArduinoMessages()

    const statusInterval = setInterval(fetchStatus, STATUS_POLL_INTERVAL_MS)
    const radarInterval = setInterval(fetchRadarLive, STATUS_POLL_INTERVAL_MS)
    const cameraStatusInterval = setInterval(fetchCameraStatuses, STATUS_POLL_INTERVAL_MS)
    const arduinoInterval = setInterval(fetchArduinoMessages, 1000)

    return () => {
      clearInterval(statusInterval)
      clearInterval(radarInterval)
      clearInterval(cameraStatusInterval)
      clearInterval(arduinoInterval)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'live') {
      startVideoFeed('webcam')
      startVideoFeed('dahua')
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'scenario') {
      fetchScenarioHistory()
    }
  }, [activeTab])

  useEffect(() => {
    if (!scenarioJobId || !isAnalyzing) {
      return undefined
    }

    let isCancelled = false
    let nextPollTimer = null

    const pollScenarioJob = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/scenario-analysis/${scenarioJobId}`)
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Scenario analysis status could not be loaded.')
        }

        if (isCancelled) {
          return
        }

        setScenarioStage(data.stage || 'Processing')
        setScenarioProgress(typeof data.progress_percent === 'number' ? data.progress_percent : 0)
        setScenarioFramesTotal(data.frames_total || 0)
        setScenarioFramesRead(data.frames_read || 0)
        setScenarioFramesAnalyzed(data.frames_analyzed || 0)

        if (data.status === 'completed') {
          setScenarioResult({
            video_url: data.video_url,
            summary: data.summary,
            output_filename: data.output_filename,
          })
          setSelectedScenarioHistoryId(data.output_filename)
          setScenarioJobId(null)
          setScenarioProgress(100)
          setScenarioStage('Completed')
          setIsAnalyzing(false)
          fetchScenarioHistory({ preferLatest: true })
          return
        }

        if (data.status === 'failed') {
          throw new Error(data.error || 'Scenario analysis failed.')
        }

        nextPollTimer = window.setTimeout(pollScenarioJob, 1000)
      } catch (pollError) {
        if (isCancelled) {
          return
        }

        setScenarioError(pollError.message || 'Scenario analysis failed.')
        setScenarioJobId(null)
        setScenarioStage('Failed')
        setIsAnalyzing(false)
      }
    }

    pollScenarioJob()

    return () => {
      isCancelled = true
      if (nextPollTimer) {
        window.clearTimeout(nextPollTimer)
      }
    }
  }, [scenarioJobId, isAnalyzing])

  const fetchArduinoMessages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/arduino-messages`)
      if (!response.ok) {
        return
      }

      const data = await response.json()
      if (!data.messages || data.messages.length === 0) {
        return
      }

      data.messages.forEach((msg) => {
        const messageKey = `${msg.time}-${msg.message}`
        if (seenMessages.current.has(messageKey)) {
          return
        }

        seenMessages.current.add(messageKey)
        if (seenMessages.current.size > 200) {
          const firstKey = seenMessages.current.values().next().value
          seenMessages.current.delete(firstKey)
        }

        const logMessage = `[Arduino ${msg.time}] ${msg.message}`
        if (msg.message.includes('ALERT activated') || msg.message.includes('CMD: ALERT')) {
          console.warn(logMessage)
        } else if (msg.message.includes('CMD:')) {
          console.info(logMessage)
        } else if (msg.message.includes('cm')) {
          if (Math.random() < 0.2) {
            console.log(logMessage)
          }
        } else {
          console.log(logMessage)
        }
      })
    } catch (fetchError) {
      // Arduino is optional, so ignore connection errors here.
    }
  }

  const updateStreamState = (sourceName, updates) => {
    setStreamStates((prev) => ({
      ...prev,
      [sourceName]: {
        ...prev[sourceName],
        ...updates,
      },
    }))
  }

  const startVideoFeed = (sourceName = 'webcam') => {
    updateStreamState(sourceName, {
      isStreaming: false,
      error: null,
    })
    setStreamVersions((prev) => ({
      ...prev,
      [sourceName]: (prev[sourceName] || 0) + 1,
    }))
  }

  const buildStreamUrl = (sourceName) => {
    const version = streamVersions[sourceName] || 0
    return `${API_BASE_URL}/video_feed/${sourceName}?v=${version}`
  }

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/status`)
      if (!response.ok) {
        return
      }

      const data = await response.json()
      setSystemStatus(data)
    } catch (fetchError) {
      console.error('Error fetching status:', fetchError)
    }
  }

  const fetchRadarLive = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/radar/live`)
      if (!response.ok) {
        return
      }

      const data = await response.json()
      setRadarLive(data)
    } catch (fetchError) {
      console.error('Error fetching radar status:', fetchError)
    }
  }

  const fetchCameraStatuses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cameras/status`)
      if (!response.ok) {
        return
      }

      const data = await response.json()
      setCameraStatuses(data)
    } catch (fetchError) {
      console.error('Error fetching camera status:', fetchError)
    }
  }

  const loadScenarioResult = (historyItem) => {
    if (!historyItem) {
      return
    }

    setScenarioResult({
      video_url: historyItem.video_url,
      summary: historyItem.summary,
      output_filename: historyItem.output_filename,
    })
    setSelectedScenarioHistoryId(historyItem.id)
    setScenarioError(null)
  }

  const clearScenarioResultSelection = () => {
    setScenarioResult(null)
    setSelectedScenarioHistoryId(null)
  }

  const fetchScenarioHistory = async ({ preferLatest = false } = {}) => {
    setIsLoadingScenarioHistory(true)
    setScenarioHistoryError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/scenario-history`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Scenario history could not be loaded.')
      }

      const historyItems = Array.isArray(data.history) ? data.history : []
      setScenarioHistory(historyItems)

      if (historyItems.length === 0) {
        clearScenarioResultSelection()
        return
      }

      const shouldSelectLatest =
        preferLatest ||
        (!selectedScenarioHistoryId && !scenarioResult) ||
        !historyItems.some((item) => item.id === selectedScenarioHistoryId)

      if (historyItems.length > 0 && shouldSelectLatest) {
        loadScenarioResult(historyItems[0])
      }
    } catch (historyError) {
      setScenarioHistoryError(historyError.message || 'Scenario history could not be loaded.')
    } finally {
      setIsLoadingScenarioHistory(false)
    }
  }

  const handleDeleteScenarioHistory = async (historyItem) => {
    if (!historyItem?.id || deletingScenarioHistoryId === historyItem.id) {
      return
    }

    const isConfirmed = window.confirm(
      `Delete "${historyItem.source_filename}" from the saved scenario videos?`
    )
    if (!isConfirmed) {
      return
    }

    setDeletingScenarioHistoryId(historyItem.id)
    setScenarioHistoryError(null)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/scenario-history/${encodeURIComponent(historyItem.id)}`,
        { method: 'DELETE' }
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Scenario video could not be deleted.')
      }

      const remainingHistoryItems = scenarioHistory.filter((item) => item.id !== historyItem.id)
      setScenarioHistory(remainingHistoryItems)

      if (
        selectedScenarioHistoryId === historyItem.id ||
        scenarioResult?.output_filename === historyItem.output_filename
      ) {
        if (remainingHistoryItems.length > 0) {
          loadScenarioResult(remainingHistoryItems[0])
        } else {
          clearScenarioResultSelection()
        }
      }
    } catch (deleteError) {
      setScenarioHistoryError(deleteError.message || 'Scenario video could not be deleted.')
    } finally {
      setDeletingScenarioHistoryId(null)
    }
  }

  const resetScenarioAnalysisState = () => {
    setScenarioResult(null)
    setScenarioError(null)
    setScenarioJobId(null)
    setScenarioProgress(0)
    setScenarioStage('Idle')
    setScenarioFramesTotal(0)
    setScenarioFramesRead(0)
    setScenarioFramesAnalyzed(0)
  }

  const uploadScenarioVideo = (formData) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE_URL}/api/scenario-analysis`)
      xhr.responseType = 'text'

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return
        }

        setScenarioStage('Uploading video')
        setScenarioProgress(Math.round((event.loaded / event.total) * 100))
      }

      xhr.onload = () => {
        const rawResponse = xhr.responseText || ''
        let data = {}

        try {
          data = rawResponse ? JSON.parse(rawResponse) : {}
        } catch {
          reject(new Error('Video analysis returned an invalid server response.'))
          return
        }

        if (xhr.status < 200 || xhr.status >= 300 || !data.success) {
          reject(new Error(data.error || 'Video analysis failed.'))
          return
        }

        resolve(data)
      }

      xhr.onerror = () => {
        reject(new Error('Video upload failed. Please check the backend connection and try again.'))
      }

      xhr.send(formData)
    })

  const handleScenarioFileChange = (event) => {
    const file = event.target.files?.[0] || null
    setScenarioFile(file)
    resetScenarioAnalysisState()
  }

  const handleAnalyzeVideo = async () => {
    if (!scenarioFile || isAnalyzing) {
      return
    }

    setIsAnalyzing(true)
    resetScenarioAnalysisState()
    setScenarioStage('Uploading video')

    const formData = new FormData()
    formData.append('video', scenarioFile)

    try {
      const data = await uploadScenarioVideo(formData)
      setScenarioJobId(data.job_id)
      setScenarioStage(data.stage || 'Queued')
      setScenarioProgress(typeof data.progress_percent === 'number' ? data.progress_percent : 0)
    } catch (analysisError) {
      setScenarioError(analysisError.message || 'Video analysis failed.')
      setScenarioStage('Failed')
      setIsAnalyzing(false)
    }
  }

  const getPersonCount = () => {
    return systemStatus?.person_count || 0
  }

  const hasWeapon = () => {
    return systemStatus?.has_weapon || false
  }

  const getWeaponType = () => {
    return systemStatus?.weapon_type || null
  }

  const getLiveRisk = () => {
    if (typeof systemStatus?.max_risk === 'number') {
      return systemStatus.max_risk
    }

    if (Array.isArray(systemStatus?.tracks) && systemStatus.tracks.length > 0) {
      return Math.max(
        ...systemStatus.tracks.map((track) => Number(track?.risk) || 0)
      )
    }

    return 0
  }

  const getCameraRisk = () => {
    if (typeof systemStatus?.camera_risk === 'number') {
      return systemStatus.camera_risk
    }

    if (Array.isArray(systemStatus?.tracks) && systemStatus.tracks.length > 0) {
      return Math.max(...systemStatus.tracks.map((track) => Number(track?.risk) || 0))
    }

    return 0
  }

  const getRadarRisk = () => {
    if (typeof radarLive?.max_radar_risk === 'number') {
      return radarLive.max_radar_risk
    }

    if (typeof systemStatus?.radar_risk === 'number') {
      return systemStatus.radar_risk
    }

    if (typeof systemStatus?.radar?.max_radar_risk === 'number') {
      return systemStatus.radar.max_radar_risk
    }

    return 0
  }

  const getFusedRisk = () => {
    if (typeof systemStatus?.fused_risk === 'number') {
      return systemStatus.fused_risk
    }

    return getLiveRisk()
  }

  const getRiskBadgeClass = (risk) => {
    if (risk >= 75) {
      return 'detection-count-danger'
    }
    if (risk >= 40) {
      return 'detection-count-alert'
    }
    return 'detection-count-safe'
  }

  const clampValue = (value, min, max) => {
    return Math.min(Math.max(value, min), max)
  }

  const getRadarMapDotClass = (risk) => {
    if (risk >= 75) {
      return 'radar-map-target-dot-danger'
    }
    if (risk >= 40) {
      return 'radar-map-target-dot-alert'
    }
    return 'radar-map-target-dot-safe'
  }

  const formatScenarioHistoryDate = (value) => {
    if (!value) {
      return 'Unknown date'
    }

    const parsedDate = new Date(value)
    if (Number.isNaN(parsedDate.getTime())) {
      return value
    }

    return parsedDate.toLocaleString()
  }

  const formatScenarioHistorySize = (bytes) => {
    if (!bytes || bytes <= 0) {
      return ''
    }

    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
  }

  const formatRadarDistance = (distanceMm) => {
    const distance = Number(distanceMm) || 0
    return `${(distance / 1000).toFixed(1)} m`
  }

  const formatRadarSpeed = (target) => {
    if (target?.speed_cm_s !== undefined && target?.speed_cm_s !== null) {
      const speed = Number(target.speed_cm_s) || 0
      return `${(speed / 100).toFixed(2)} m/s`
    }

    const speed = Number(target?.speed_mm_s) || 0
    return `${(speed / 1000).toFixed(2)} m/s`
  }

  const formatRadarLatency = (latencyMs) => {
    if (latencyMs === null || latencyMs === undefined) {
      return 'n/a'
    }

    return `${Math.max(0, Math.round(Number(latencyMs) || 0))} ms`
  }

  const getRadarMapPosition = (target) => {
    const xRatio = clampValue((Number(target?.x_mm) || 0) / 3000, -1, 1)
    const yRatio = clampValue((Number(target?.y_mm) || 0) / 8000, 0, 1)

    return {
      left: `${50 + xRatio * 42}%`,
      bottom: `${10 + yRatio * 76}%`,
    }
  }

  const getCameraSourceStatus = (sourceName) => cameraStatuses?.[sourceName] || null

  const getCameraSourceRisk = (sourceStatus) => {
    if (typeof sourceStatus?.fused_risk === 'number') {
      return sourceStatus.fused_risk
    }

    if (typeof sourceStatus?.max_risk === 'number') {
      return sourceStatus.max_risk
    }

    return 0
  }

  const getCameraSourceMode = (sourceStatus) => sourceStatus?.mode || 'SAFE'

  const getCameraSourceConnectionLabel = (sourceStatus) => {
    if (sourceStatus?.connected) {
      return 'Connected'
    }

    if (sourceStatus?.status === 'reconnecting') {
      return 'Reconnecting'
    }

    return 'Disconnected'
  }

  const renderCameraPanel = (sourceName, title, subtitle) => {
    const sourceStatus = getCameraSourceStatus(sourceName)
    const sourceStream = streamStates[sourceName] || { isStreaming: false, error: null }
    const sourceRisk = getCameraSourceRisk(sourceStatus)
    const sourceMode = getCameraSourceMode(sourceStatus)
    const connectionLabel = getCameraSourceConnectionLabel(sourceStatus)
    const statusText = sourceStatus?.status || 'inactive'
    const statusMessage = sourceStatus?.last_error || sourceStatus?.context || subtitle
    const weaponDetected = Boolean(sourceStatus?.has_weapon)
    const weaponDetectionUnavailable = sourceStatus?.weapon_detection_available === false

    return (
      <div key={sourceName} className="camera-container camera-source-panel">
        <div className="camera-section-header">
          <div>
            <h2>{title}</h2>
            <p className="camera-section-subtitle">{subtitle}</p>
          </div>
          <div className="camera-source-badges">
            <span className={`status-badge ${sourceStatus?.connected ? 'active' : 'inactive'}`}>
              {connectionLabel}
            </span>
            <span className={`detection-count ${getRiskBadgeClass(sourceRisk)}`}>{sourceMode}</span>
          </div>
        </div>

        <div className="video-wrapper camera-source-video">
          <img
            src={buildStreamUrl(sourceName)}
            alt={`${title} Feed`}
            className="camera-video"
            onLoad={() => updateStreamState(sourceName, { isStreaming: true, error: null })}
            onError={() => {
              updateStreamState(sourceName, {
                isStreaming: false,
                error: `Failed to load the ${title.toLowerCase()} feed.`,
              })
            }}
          />
          {sourceStream.error && (
            <div className="camera-placeholder">
              <div className="placeholder-icon">!</div>
              <p>{sourceStream.error}</p>
              <button type="button" onClick={() => startVideoFeed(sourceName)} className="retry-btn">
                Retry Connection
              </button>
            </div>
          )}
          {!sourceStream.isStreaming && !sourceStream.error && (
            <div className="camera-placeholder">
              <div className="placeholder-icon">...</div>
              <p>Connecting to {title.toLowerCase()}...</p>
            </div>
          )}
        </div>

        <div className="camera-source-meta">
          <div className="camera-source-metric">
            <span className="camera-source-metric-label">Source Status</span>
            <strong>{statusText}</strong>
          </div>
          <div className="camera-source-metric">
            <span className="camera-source-metric-label">Persons</span>
            <strong>{sourceStatus?.person_count || 0}</strong>
          </div>
          <div className="camera-source-metric">
            <span className="camera-source-metric-label">Weapon</span>
            <strong>{weaponDetectionUnavailable ? 'Unavailable' : weaponDetected ? 'Detected' : 'None'}</strong>
          </div>
          <div className="camera-source-metric">
            <span className="camera-source-metric-label">Risk</span>
            <strong>{sourceRisk}</strong>
          </div>
          {sourceName === 'dahua' && (
            <>
              <div className="camera-source-metric">
                <span className="camera-source-metric-label">Subtype</span>
                <strong>{sourceStatus?.subtype ?? '-'}</strong>
              </div>
              <div className="camera-source-metric">
                <span className="camera-source-metric-label">Last Frame</span>
                <strong>{sourceStatus?.last_frame_time || '-'}</strong>
              </div>
            </>
          )}
          {sourceName === 'webcam' && (
            <>
              <div className="camera-source-metric">
                <span className="camera-source-metric-label">Mode</span>
                <strong>{sourceStatus?.camera_mode || 'SAFE'}</strong>
              </div>
              <div className="camera-source-metric">
                <span className="camera-source-metric-label">Last Update</span>
                <strong>{sourceStatus?.last_update || '-'}</strong>
              </div>
            </>
          )}
        </div>

        {statusMessage && <p className="camera-source-context">{statusMessage}</p>}
      </div>
    )
  }

  const summary = scenarioResult?.summary || null
  const liveRisk = getFusedRisk()
  const cameraRisk = getCameraRisk()
  const radarRisk = getRadarRisk()
  const radarStatus = radarLive || systemStatus?.radar || null
  const radarTargets = Array.isArray(radarStatus?.targets)
    ? radarStatus.targets.filter((target) => target?.valid !== false)
    : []
  const radarConnectionLabel = radarStatus?.radar_connected ? 'Connected' : 'Disconnected'
  const radarStateLabel =
    radarStatus?.radar_status || (radarStatus?.radar_connected ? 'OK' : 'DISCONNECTED')
  const activeProfile = systemStatus?.profile || 'perimeter'
  const globalMode = systemStatus?.mode || 'SAFE'
  const webcamStatus = getCameraSourceStatus('webcam')
  const dahuaStatus = getCameraSourceStatus('dahua')
  const anyStreamActive = Boolean(
    streamStates.webcam?.isStreaming || streamStates.dahua?.isStreaming
  )
  const isStreaming = anyStreamActive
  const anyCameraConnected = Boolean(
    webcamStatus?.connected || dahuaStatus?.connected || systemStatus?.status === 'active'
  )
  const scenarioStatusText = isAnalyzing
    ? scenarioStage || 'Processing'
    : scenarioError
    ? 'Failed'
    : scenarioResult
    ? 'Ready'
    : 'Idle'
  const scenarioProgressLabel =
    scenarioStage === 'Uploading video'
      ? `Upload ${scenarioProgress}%`
      : `${scenarioStage || 'Processing'} ${scenarioProgress}%`

  return (
    <div className="camera-room-page">
      <div className="camera-header">
        <div className="header-left">
          <button type="button" className="back-btn" onClick={() => navigate('/rooms')}>
            ← Back to Rooms
          </button>
          <h1>{roomName}</h1>
        </div>
        <div className="header-right">
          <span className={`status-badge ${systemStatus?.status === 'active' ? 'active' : 'inactive'}`}>
            {systemStatus?.status === 'active' ? 'System Active' : 'System Offline'}
          </span>
        </div>
      </div>

      <div className="analysis-tabs">
        <button
          type="button"
          className={`analysis-tab ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          Live Camera
        </button>
        <button
          type="button"
          className={`analysis-tab ${activeTab === 'scenario' ? 'active' : ''}`}
          onClick={() => setActiveTab('scenario')}
        >
          Scenario Video Analysis
        </button>
      </div>

      {activeTab === 'live' ? (
        <div className="camera-dashboard dashboard-layout">
          <div className="camera-stream-stack camera-column">
            {renderCameraPanel(
              'webcam',
              'Computer Camera',
              'Local webcam stream with person and weapon annotations.'
            )}
            {renderCameraPanel(
              'dahua',
              'Dahua RTSP Camera',
              'RTSP stream from the Dahua IP camera using latest-frame buffering.'
            )}
          </div>

          {false && (
          <div className="camera-container">
            <div className="camera-section-header">
              <div>
                <h2>Live Camera View</h2>
                <p className="camera-section-subtitle">
                  Clean stream with person and weapon annotations only.
                </p>
              </div>
              <span className={`status-badge ${anyCameraConnected ? 'active' : 'inactive'}`}>
                {isStreaming && systemStatus?.status === 'active' ? 'Live' : 'Offline'}
              </span>
            </div>
            <div className="video-wrapper">
              <img
                ref={imgRef}
                src={`${API_BASE_URL}/video_feed`}
                alt="Camera Feed"
                className="camera-video"
                onLoad={() => {
                  setIsStreaming(true)
                  setError(null)
                }}
                onError={() => {
                  setIsStreaming(false)
                  setError('Failed to load the live video feed. Please check that the backend server is running.')
                }}
              />
              {error && (
                <div className="camera-placeholder">
                  <div className="placeholder-icon">!</div>
                  <p>{error}</p>
                  <button type="button" onClick={startVideoFeed} className="retry-btn">
                    Retry Connection
                  </button>
                </div>
              )}
              {!isStreaming && !error && (
                <div className="camera-placeholder">
                  <div className="placeholder-icon">📹</div>
                  <p>Connecting to live camera feed...</p>
                </div>
              )}
            </div>
          </div>
          )}

          <div className="detection-panel radar-column radar-dashboard-panel">
            <div className="panel-header">
              <h2>Radar / Sensor Dashboard</h2>
              <span className={`detection-count ${getRiskBadgeClass(liveRisk)}`}>
                {globalMode}
              </span>
              <span className={`status-badge ${isStreaming && systemStatus?.status === 'active' ? 'active' : 'inactive'}`}>
                {isStreaming && systemStatus?.status === 'active' ? '● Live' : '○ Offline'}
              </span>
            </div>

            {systemStatus && (
              <div className="system-info">
                <h3>System Status</h3>
                <div className="info-row">
                  <span className="info-label">Status:</span>
                  <span className={`info-value ${systemStatus.status === 'active' ? 'active' : ''}`}>
                    {systemStatus.status || 'Unknown'}
                  </span>
                </div>
                {systemStatus.last_update && (
                  <div className="info-row">
                    <span className="info-label">Last Update:</span>
                    <span className="info-value">{systemStatus.last_update}</span>
                  </div>
                )}
              </div>
            )}

            <div className="detection-list">
              <h3>System Status</h3>
              {systemStatus?.has_person ||
              hasWeapon() ||
              systemStatus?.motion ||
              systemStatus?.mode ||
              radarStatus ||
              (systemStatus?.distance !== null && systemStatus?.distance !== undefined) ? (
                <ul>
                  {systemStatus?.person_count > 0 && (
                    <li className="detection-item">
                      <span className="detection-name">Persons</span>
                      <span className="detection-count">{getPersonCount()}</span>
                    </li>
                  )}
                  {hasWeapon() && (
                    <li className="detection-item detection-item-danger">
                      <span className="detection-name">Weapon</span>
                      <span className="detection-count detection-count-danger">
                        {getWeaponType() || 'Detected'}
                      </span>
                    </li>
                  )}
                  {systemStatus?.motion && (
                    <li className="detection-item">
                      <span className="detection-name">Motion</span>
                      <span className="detection-count">{systemStatus.motion}</span>
                    </li>
                  )}
                  {systemStatus?.mode && (
                    <li className="detection-item">
                      <span className="detection-name">Global Mode</span>
                      <span
                        className={`detection-count ${
                          systemStatus.mode === 'DANGER'
                            ? 'detection-count-danger'
                            : systemStatus.mode === 'ALERT'
                            ? 'detection-count-alert'
                            : 'detection-count-safe'
                        }`}
                      >
                        {systemStatus.mode}
                      </span>
                    </li>
                  )}
                  <li className="detection-item">
                    <span className="detection-name">Camera Risk</span>
                    <span className={`detection-count ${getRiskBadgeClass(cameraRisk)}`}>
                      {cameraRisk}
                    </span>
                  </li>
                  <li className="detection-item">
                    <span className="detection-name">Radar Risk</span>
                    <span className={`detection-count ${getRiskBadgeClass(radarRisk)}`}>
                      {radarRisk}
                    </span>
                  </li>
                  <li className="detection-item">
                    <span className="detection-name">Fused Risk</span>
                    <span className={`detection-count ${getRiskBadgeClass(liveRisk)}`}>
                      {liveRisk}
                    </span>
                  </li>
                  <li className="detection-item">
                    <span className="detection-name">Active Profile</span>
                    <span className="detection-count">{activeProfile}</span>
                  </li>
                  {systemStatus?.camera_mode && (
                    <li className="detection-item">
                      <span className="detection-name">Camera Mode</span>
                      <span className={`detection-count ${getRiskBadgeClass(cameraRisk)}`}>
                        {systemStatus.camera_mode}
                      </span>
                    </li>
                  )}
                  {radarStatus && (
                    <>
                      <li className="detection-item">
                        <span className="detection-name">Radar Link</span>
                        <span
                          className={`detection-count ${
                            radarStatus.radar_connected ? 'detection-count-safe' : 'detection-count-danger'
                          }`}
                        >
                          {radarConnectionLabel}
                        </span>
                      </li>
                      <li className="detection-item">
                        <span className="detection-name">Radar Status</span>
                        <span className="detection-count">{radarStateLabel}</span>
                      </li>
                      <li className="detection-item">
                        <span className="detection-name">Radar Targets</span>
                        <span className={`detection-count ${getRiskBadgeClass(radarRisk)}`}>
                          {radarStatus.targets_count ?? radarTargets.length}
                        </span>
                      </li>
                      <li className="detection-item">
                        <span className="detection-name">Last Radar Update</span>
                        <span className="detection-count">{formatRadarLatency(radarStatus.last_update_ms)}</span>
                      </li>
                      <li className="detection-item">
                        <span className="detection-name">Radar Provider</span>
                        <span className="detection-count">
                          {radarStatus.provider || radarStatus.mode || 'ld2450'}
                        </span>
                      </li>
                      <li className="detection-item">
                        <span className="detection-name">Debug Overlay On Camera</span>
                        <span className={`detection-count ${
                          radarStatus.show_debug_overlay_on_camera ? 'detection-count-alert' : 'detection-count-safe'
                        }`}>
                          {radarStatus.show_debug_overlay_on_camera ? 'ON' : 'OFF'}
                        </span>
                      </li>
                    </>
                  )}
                  {systemStatus?.distance !== null && systemStatus?.distance !== undefined && (
                    <li className="detection-item">
                      <span className="detection-name">Sensor Distance</span>
                      <span className="detection-count">{Math.round(systemStatus.distance)} cm</span>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="no-detections">No objects detected</p>
              )}
            </div>

            {radarStatus && (
              <div className="radar-live-panel">
                <div className="scenario-history-header">
                  <h3>Radar Targets</h3>
                  <span className={`status-badge ${radarStatus.radar_connected ? 'active' : 'inactive'}`}>
                    {radarStateLabel}
                  </span>
                </div>

                {radarTargets.length > 0 ? (
                  <div className="radar-target-list">
                    {radarTargets.map((target) => (
                      <div key={target.id || target.radar_id} className="radar-target-card">
                        <div className="radar-target-top">
                          <span className="radar-target-id">Radar ID {target.id || target.radar_id}</span>
                          <span className={`detection-count ${getRiskBadgeClass(target.radar_risk)}`}>
                            Risk {target.radar_risk}
                          </span>
                        </div>
                        <div className="radar-target-metrics">
                          <span>Distance: {formatRadarDistance(target.distance_mm)}</span>
                          <span>Speed: {formatRadarSpeed(target)}</span>
                          <span>Direction: {target.direction}</span>
                          <span>Angle: {target.angle_deg}°</span>
                          <span>Resolution: {target.resolution_mm ?? 0} mm</span>
                          <span>Valid: {target.valid ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-detections">No active radar targets are currently reported by the sensor.</p>
                )}
              </div>
            )}

            {radarStatus && (
              <div className="radar-live-panel radar-map-panel">
                <div className="scenario-history-header">
                  <h3>Radar Map</h3>
                  <span className={`detection-count ${getRiskBadgeClass(radarRisk)}`}>
                    {radarTargets.length} targets
                  </span>
                </div>

                <div className="radar-map-surface">
                  <div className="radar-map-grid-line radar-map-grid-line-top"></div>
                  <div className="radar-map-grid-line radar-map-grid-line-middle"></div>
                  <div className="radar-map-grid-line radar-map-grid-line-bottom"></div>
                  <div className="radar-map-center-line"></div>
                  <div className="radar-origin">R</div>

                  {radarTargets.map((target) => {
                    const position = getRadarMapPosition(target)

                    return (
                      <div
                        key={`radar-map-${target.radar_id}`}
                        className="radar-map-target"
                        style={position}
                      >
                        <span className={`radar-map-target-dot ${getRadarMapDotClass(target.radar_risk)}`}></span>
                        <span className="radar-map-target-label">#{target.radar_id}</span>
                      </div>
                    )
                  })}

                  {radarTargets.length === 0 && (
                    <p className="radar-map-empty">No active radar targets to plot.</p>
                  )}
                </div>

                <div className="radar-map-legend">
                  <span>Range increases upward from the radar origin.</span>
                  <span>Horizontal spread is based on target x_mm.</span>
                </div>
              </div>
            )}

            {systemStatus?.context && (
              <div className="detection-context">
                <p>{systemStatus.context}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="camera-dashboard scenario-dashboard">
          <div className="camera-container">
            <div className="video-wrapper scenario-video-wrapper">
              {scenarioResult?.video_url ? (
                <video className="scenario-video" src={scenarioResult.video_url} controls playsInline />
              ) : (
                <div className="camera-placeholder scenario-placeholder">
                  <div className="placeholder-icon">🎬</div>
                  <p>Upload a scenario video and run analysis to generate an annotated clip for the judges.</p>
                </div>
              )}
            </div>
          </div>

          <div className="detection-panel scenario-panel">
            <div className="panel-header">
              <h2>Scenario Video Analysis</h2>
              <span className={`status-badge ${isAnalyzing ? 'active' : scenarioResult ? 'active' : 'inactive'}`}>
                {scenarioStatusText}
              </span>
            </div>

            <div className="scenario-controls">
              <label className="upload-field">
                <span className="upload-label">Select Video</span>
                <input
                  type="file"
                  accept=".mp4,.avi,.mov,.m4v,video/mp4,video/x-msvideo,video/quicktime"
                  onChange={handleScenarioFileChange}
                  disabled={isAnalyzing}
                />
              </label>

              <button
                type="button"
                className="retry-btn analyze-btn"
                onClick={handleAnalyzeVideo}
                disabled={!scenarioFile || isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing Video...' : 'Analyze Video'}
              </button>

              {scenarioFile && (
                <div className="selected-file">
                  <span className="info-label">Selected file:</span>
                  <span className="info-value">{scenarioFile.name}</span>
                </div>
              )}
            </div>

            {isAnalyzing && (
              <div className="scenario-progress">
                <div className="scenario-progress-meta">
                  <span>{scenarioProgressLabel}</span>
                  <span>{scenarioFramesTotal > 0 ? `${scenarioFramesRead}/${scenarioFramesTotal} frames` : 'Preparing...'}</span>
                </div>
                <div className="scenario-progress-bar">
                  <div
                    className="scenario-progress-indicator"
                    style={{ width: `${Math.max(scenarioProgress, 6)}%` }}
                  ></div>
                </div>
                <p>
                  {scenarioStage === 'Uploading video'
                    ? 'Uploading the selected clip to the backend.'
                    : `Processing the video with frame skipping and resized inference for faster turnaround. Analyzed frames: ${scenarioFramesAnalyzed}.`}
                </p>
              </div>
            )}

            {scenarioError && (
              <div className="scenario-error">
                {scenarioError}
              </div>
            )}

            {summary ? (
              <div className="scenario-summary">
                <h3>Analysis Summary</h3>
                <div className="info-row">
                  <span className="info-label">Final Mode</span>
                  <span className={`detection-count ${
                    summary.final_mode === 'DANGER'
                      ? 'detection-count-danger'
                      : summary.final_mode === 'ALERT'
                      ? 'detection-count-alert'
                      : 'detection-count-safe'
                  }`}>
                    {summary.final_mode}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Max Risk</span>
                  <span className="info-value">{summary.max_risk}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Person Count Max</span>
                  <span className="info-value">{summary.person_count_max}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Has Weapon</span>
                  <span className="info-value">{summary.has_weapon ? 'Yes' : 'No'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Main Motion</span>
                  <span className="info-value">{summary.main_motion}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Main Context</span>
                  <span className="info-value">{summary.main_context}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Output File</span>
                  <span className="info-value">{summary.output_filename}</span>
                </div>
              </div>
            ) : (
              <p className="no-detections">
                Upload an MP4, AVI, or MOV video, then click Analyze Video to create an annotated scenario clip and summary.
              </p>
            )}

            <div className="scenario-history">
              <div className="scenario-history-header">
                <h3>Previous Analyses</h3>
                <button
                  type="button"
                  className="scenario-history-refresh"
                  onClick={() => fetchScenarioHistory()}
                  disabled={isLoadingScenarioHistory}
                >
                  {isLoadingScenarioHistory ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {scenarioHistoryError && (
                <div className="scenario-error">
                  {scenarioHistoryError}
                </div>
              )}

              {!scenarioHistoryError && scenarioHistory.length === 0 && !isLoadingScenarioHistory && (
                <p className="no-detections">No analyzed scenario videos have been saved yet.</p>
              )}

              {scenarioHistory.length > 0 && (
                <div className="scenario-history-list">
                  {scenarioHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`scenario-history-item ${
                        selectedScenarioHistoryId === item.id ? 'active' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="scenario-history-item-button"
                        onClick={() => loadScenarioResult(item)}
                        aria-pressed={selectedScenarioHistoryId === item.id}
                        disabled={deletingScenarioHistoryId === item.id}
                      >
                        <div className="scenario-history-top">
                          <span className="scenario-history-name">{item.source_filename}</span>
                          <span
                            className={`scenario-history-mode scenario-history-mode-${String(
                              item.summary?.final_mode || 'SAFE'
                            ).toLowerCase()}`}
                          >
                            {item.summary?.final_mode || 'SAFE'}
                          </span>
                        </div>
                        <div className="scenario-history-meta">
                          <span>{formatScenarioHistoryDate(item.analyzed_at)}</span>
                          <span>{formatScenarioHistorySize(item.file_size_bytes)}</span>
                        </div>
                        <div className="scenario-history-meta">
                          <span>People: {item.summary?.person_count_max ?? 0}</span>
                          <span>Risk: {item.summary?.max_risk ?? 0}</span>
                          <span>{item.summary?.has_weapon ? 'Weapon: Yes' : 'Weapon: No'}</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="scenario-history-delete"
                        onClick={() => handleDeleteScenarioHistory(item)}
                        disabled={deletingScenarioHistoryId === item.id}
                        aria-label={`Delete ${item.source_filename}`}
                        title="Delete analyzed video"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9 3h6m-9 4h12m-1 0-.7 10.2a2 2 0 0 1-2 1.8H9.7a2 2 0 0 1-2-1.8L7 7m3 4v4m4-4v4"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CameraRoom
