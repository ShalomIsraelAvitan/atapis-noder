import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { API_BASE, fetchJson } from '../../design-lab/shared/api'
import { demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'
import { useAuth } from '../../context/AuthContext'

// Settings view model. Radar config is the REAL, backend-connected section
// (GET/PUT /api/radar-config — same field keys the legacy Settings page uses).
// Controls with no backend are exposed under `planned` and must be rendered
// disabled with a "Not connected / Planned" label — never as live toggles.

// Editable field descriptors (key names must match ld2450_reader's config).
export const RADAR_FIELDS = {
  toggles: [
    { key: 'LD2450_ENABLED', en: 'Radar enabled', he: 'רדאר פעיל' },
    { key: 'RADAR_USE_MOCK', en: 'Use simulator (mock)', he: 'שימוש בסימולטור (mock)' },
    { key: 'noise_enabled', en: 'Simulator noise', he: 'רעש סימולטור' },
    { key: 'show_debug_overlay_on_camera', en: 'Debug overlay on camera', he: 'שכבת debug על המצלמה' },
  ],
  fields: [
    { key: 'LD2450_PORT', type: 'text', en: 'Serial port', he: 'פורט טורי' },
    { key: 'LD2450_BAUD', type: 'number', en: 'Baud rate', he: 'קצב Baud' },
    { key: 'update_rate_hz', type: 'number', en: 'Update rate (Hz)', he: 'קצב עדכון (Hz)' },
    { key: 'max_targets', type: 'number', en: 'Max targets', he: 'מקס׳ מטרות' },
    { key: 'alert_speed_cm_s', type: 'number', en: 'Alert speed (cm/s)', he: 'מהירות ALERT (סמ״ש)' },
    { key: 'danger_speed_cm_s', type: 'number', en: 'Danger speed (cm/s)', he: 'מהירות DANGER (סמ״ש)' },
    { key: 'gate_distance_alert_mm', type: 'number', en: 'Gate alert distance (mm)', he: 'מרחק התראת שער (מ״מ)' },
    { key: 'fence_distance_alert_mm', type: 'number', en: 'Fence alert distance (mm)', he: 'מרחק התראת גדר (מ״מ)' },
  ],
}

// Operator vs. engineering split. Same keys as RADAR_FIELDS, regrouped with
// human labels + units. Operators see plain controls; engineering controls
// (ports, baud, simulator internals) are gated behind admin. RADAR_FIELDS above
// is kept unchanged as the back-compat flat alias.
export const RADAR_GROUPS = {
  operator: {
    id: 'operator',
    en: 'Operation',
    he: 'תפעול',
    toggles: [
      { key: 'LD2450_ENABLED', en: 'Radar sensing', he: 'חישת רדאר' },
      { key: 'show_debug_overlay_on_camera', en: 'Show detection boxes on video', he: 'הצג תיבות זיהוי על הווידאו' },
    ],
    fields: [
      { key: 'alert_speed_cm_s', type: 'number', en: 'Alert speed', he: 'מהירות התראה', unit: 'cm/s' },
      { key: 'danger_speed_cm_s', type: 'number', en: 'Danger speed', he: 'מהירות סכנה', unit: 'cm/s' },
      { key: 'gate_distance_alert_mm', type: 'number', en: 'Gate alert distance', he: 'מרחק התראת שער', unit: 'mm' },
      { key: 'fence_distance_alert_mm', type: 'number', en: 'Fence alert distance', he: 'מרחק התראת גדר', unit: 'mm' },
    ],
  },
  engineering: {
    id: 'engineering',
    en: 'Engineering',
    he: 'הנדסה',
    requiresRole: 'admin',
    toggles: [
      { key: 'RADAR_USE_MOCK', en: 'Simulator mode (no hardware)', he: 'מצב סימולטור (ללא חומרה)' },
      { key: 'noise_enabled', en: 'Simulator noise', he: 'רעש סימולטור' },
    ],
    fields: [
      { key: 'LD2450_PORT', type: 'text', en: 'Radar serial port', he: 'פורט טורי של רדאר' },
      { key: 'LD2450_BAUD', type: 'number', en: 'Radar UART baud', he: 'קצב UART של רדאר' },
      { key: 'update_rate_hz', type: 'number', en: 'Update rate', he: 'קצב עדכון', unit: 'Hz' },
      { key: 'max_targets', type: 'number', en: 'Max targets', he: 'מקס׳ מטרות' },
    ],
  },
}

const groupKeys = (group) => [...group.toggles, ...group.fields].map((f) => f.key)
export const OPERATOR_KEYS = new Set(groupKeys(RADAR_GROUPS.operator))
export const ENGINEERING_KEYS = new Set([...groupKeys(RADAR_GROUPS.engineering), 'scenario'])

// --- Three-way layout (opt-in) -----------------------------------------------
// A SEPARATE structure, not derived from RADAR_GROUPS: a view opting in reads
// only these, a view that does not reads only the legacy set above, so the two
// layouts can never affect each other.
//
// The security thresholds and the radar on/off switch move behind admin here:
// a shift operator changing the ALERT distance, or switching radar sensing off,
// silently changes what the whole site detects.
export const RADAR_GROUPS_V2 = {
  operator: {
    id: 'operator',
    en: 'Operation',
    he: 'תפעול',
    toggles: [
      { key: 'show_debug_overlay_on_camera', en: 'Show detection boxes on video', he: 'הצג תיבות זיהוי על הווידאו' },
    ],
    fields: [],
  },
  calibration: {
    id: 'calibration',
    en: 'Security calibration',
    he: 'כיול אבטחה',
    requiresRole: 'admin',
    toggles: [
      { key: 'LD2450_ENABLED', en: 'Radar sensing', he: 'חישת רדאר' },
    ],
    fields: [
      { key: 'alert_speed_cm_s', type: 'number', en: 'Alert speed', he: 'מהירות התראה', unit: 'cm/s' },
      { key: 'danger_speed_cm_s', type: 'number', en: 'Danger speed', he: 'מהירות סכנה', unit: 'cm/s' },
      { key: 'gate_distance_alert_mm', type: 'number', en: 'Gate alert distance', he: 'מרחק התראת שער', unit: 'mm' },
      { key: 'fence_distance_alert_mm', type: 'number', en: 'Fence alert distance', he: 'מרחק התראת גדר', unit: 'mm' },
    ],
  },
  engineering: {
    id: 'engineering',
    en: 'Engineering',
    he: 'הנדסה',
    requiresRole: 'admin',
    toggles: [
      { key: 'RADAR_USE_MOCK', en: 'Simulator mode (no hardware)', he: 'מצב סימולטור (ללא חומרה)' },
      { key: 'noise_enabled', en: 'Simulator noise', he: 'רעש סימולטור' },
    ],
    fields: [
      { key: 'LD2450_PORT', type: 'text', en: 'Radar serial port', he: 'פורט טורי של רדאר' },
      { key: 'LD2450_BAUD', type: 'number', en: 'Radar UART baud', he: 'קצב UART של רדאר' },
      { key: 'update_rate_hz', type: 'number', en: 'Update rate', he: 'קצב עדכון', unit: 'Hz' },
      { key: 'max_targets', type: 'number', en: 'Max targets', he: 'מקס׳ מטרות' },
    ],
  },
}

export const OPERATOR_KEYS_V2 = new Set(groupKeys(RADAR_GROUPS_V2.operator))
export const CALIBRATION_KEYS_V2 = new Set(groupKeys(RADAR_GROUPS_V2.calibration))
export const ENGINEERING_KEYS_V2 = new Set([...groupKeys(RADAR_GROUPS_V2.engineering), 'scenario'])

// Lang-aware label lookup for a raw config key (falls back to the key itself).
const ALL_DESCRIPTORS = [
  ...RADAR_GROUPS.operator.toggles, ...RADAR_GROUPS.operator.fields,
  ...RADAR_GROUPS.engineering.toggles, ...RADAR_GROUPS.engineering.fields,
]
export function radarKeyLabel(key, lang) {
  const d = ALL_DESCRIPTORS.find((f) => f.key === key)
  if (!d) return key
  return lang === 'he' ? d.he : d.en
}

// Local-only legacy "General" controls — intentionally NOT wired; shown as Planned.
export const PLANNED_SETTINGS = [
  { key: 'notifications', en: 'Push notifications', he: 'התראות push' },
  { key: 'emailAlerts', en: 'Email alerts', he: 'התראות אימייל' },
  { key: 'autoRecord', en: 'Automatic recording', he: 'הקלטה אוטומטית' },
  { key: 'detectionSensitivity', en: 'Detection sensitivity', he: 'רגישות זיהוי' },
]

export function useSettingsViewModel() {
  const location = useLocation()
  const demo = demoOptionsFromLocation(location.search)
  const { user, updateUser } = useAuth()

  const [config, setConfig] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | unsupported | error
  const [saveState, setSaveState] = useState({ busy: false, message: null, ok: null })

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await fetchJson(`${API_BASE}/api/radar-config`)
      if (data.success && data.config) {
        setConfig(data.config)
        setDraft(data.config)
        setScenarios(data.available_scenarios || [])
        setStatus('ready')
      } else {
        setStatus('unsupported')
      }
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setField = useCallback((key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setSaveState((prev) => ({ ...prev, message: null }))
  }, [])

  const isDirty = draft && config && JSON.stringify(draft) !== JSON.stringify(config)

  const save = useCallback(async () => {
    if (!draft) return
    setSaveState({ busy: true, message: null, ok: null })
    try {
      const response = await fetch(`${API_BASE}/api/radar-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: draft }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.success) {
        setConfig(data.config || draft)
        setDraft(data.config || draft)
        if (data.available_scenarios) setScenarios(data.available_scenarios)
        setSaveState({ busy: false, message: 'Saved', ok: true })
      } else {
        setSaveState({ busy: false, message: data.error || `HTTP ${response.status}`, ok: false })
      }
    } catch (err) {
      setSaveState({ busy: false, message: err.message, ok: false })
    }
  }, [draft])

  const cancel = useCallback(() => {
    setDraft(config)
    setSaveState({ busy: false, message: null, ok: null })
  }, [config])

  // --- Profile (real: PUT /api/users/:id via AuthContext) -------------------
  const [profile, setProfile] = useState({ username: user?.username || '', email: user?.email || '', password: '', confirm: '' })
  const [profileState, setProfileState] = useState({ busy: false, message: null, ok: null })

  const saveProfile = useCallback(async () => {
    if (!user) return
    if (profile.password && profile.password !== profile.confirm) {
      setProfileState({ busy: false, message: 'Passwords do not match', ok: false })
      return
    }
    if (profile.password && profile.password.length < 6) {
      setProfileState({ busy: false, message: 'Password must be at least 6 characters', ok: false })
      return
    }
    setProfileState({ busy: true, message: null, ok: null })
    const payload = { username: profile.username.trim(), email: profile.email.trim() }
    if (profile.password) payload.password = profile.password
    const result = await updateUser(user.id, payload)
    setProfileState({
      busy: false,
      message: result?.success ? 'Profile saved' : result?.error || 'Save failed',
      ok: Boolean(result?.success),
    })
  }, [user, profile, updateUser])

  const canEngineer = user?.role === 'admin'

  return {
    demo,
    radar: {
      status, config, draft, scenarios, isDirty,
      setField, save, cancel, reload: load, saveState,
      fields: RADAR_FIELDS, // back-compat flat alias
      groups: RADAR_GROUPS,
      canEngineer,
      showKeys: canEngineer, // raw config keys are engineer-facing only
      operatorKeys: OPERATOR_KEYS,
      engineeringKeys: ENGINEERING_KEYS,
      keyLabel: radarKeyLabel,
      // Read only by views that opt into groupLayout="three-way".
      groupsV2: RADAR_GROUPS_V2,
      operatorKeysV2: OPERATOR_KEYS_V2,
      calibrationKeysV2: CALIBRATION_KEYS_V2,
      engineeringKeysV2: ENGINEERING_KEYS_V2,
    },
    planned: PLANNED_SETTINGS,
    profile: { values: profile, set: setProfile, save: saveProfile, state: profileState, user },
  }
}
