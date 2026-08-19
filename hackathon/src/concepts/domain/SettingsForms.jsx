import { serialAdvisories } from '../data/serialAdvisories'
import { useConcept } from '../useConcept'

// One toggle row. Raw config key is shown only when `showKeys` (engineer view).
function ToggleRow({ field, draft, setField, label, showKeys }) {
  return (
    <label className="dm-toggle-row">
      <input
        type="checkbox"
        checked={Boolean(draft[field.key])}
        onChange={(e) => setField(field.key, e.target.checked)}
      />
      <span>{label(field)}</span>
      {showKeys ? <code className="dm-key" dir="ltr">{field.key}</code> : null}
    </label>
  )
}

// One value row. Shows a unit hint and (engineer view) the raw key.
function FieldRow({ field, draft, setField, label, showKeys }) {
  return (
    <label className="dm-field-row">
      <span className="dm-field-label">
        {label(field)}
        {field.unit ? <span className="dm-field-unit" dir="ltr"> ({field.unit})</span> : null}
        {showKeys ? <code className="dm-key" dir="ltr">{field.key}</code> : null}
      </span>
      <input
        dir="ltr"
        type={field.type}
        value={draft[field.key] ?? ''}
        onChange={(e) =>
          setField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
        }
      />
    </label>
  )
}

// Advisory panel (baud disambiguation, port warnings). Advisory only — the one
// action prefills a draft field; the user still presses Save.
export function SettingsAdvisories({ advisories, onApply, className = '' }) {
  const { t, lang } = useConcept()
  if (!advisories || !advisories.length) return null
  return (
    <div className={`dm-advisories ${className}`}>
      {advisories.map((a) => (
        <div key={a.id} className={`dm-advisory dm-advisory--${a.severity}`} role="note">
          <p className="dm-advisory-title">{lang === 'he' ? a.titleHe : a.titleEn}</p>
          <p className="dm-advisory-body">{lang === 'he' ? a.bodyHe : a.bodyEn}</p>
          {a.action ? (
            <button type="button" className="dm-btn" onClick={() => onApply(a.action)}>
              {lang === 'he' ? a.action.labelHe : a.action.labelEn}
            </button>
          ) : null}
        </div>
      ))}
      <p className="dm-advisory-foot">{t('Advisory only — changes apply after you save.', 'ייעוץ בלבד — שינויים חלים לאחר שמירה.')}</p>
    </div>
  )
}

// Real radar configuration form (GET/PUT /api/radar-config).
// Operator controls are always shown; engineering controls (ports, baud,
// simulator internals, raw keys) are gated behind admin (radar.canEngineer).
//
// groupLayout='legacy' (default) reads radar.groups — two groups, operator
// ungated. groupLayout='three-way' reads radar.groupsV2 instead — a separate
// structure that additionally gates the security thresholds behind admin. The
// two paths share no state, so a view on one layout cannot be affected by the
// other.
export function RadarConfigForm({ radar, groupLayout = 'legacy', className = '' }) {
  const { t, lang } = useConcept()
  const {
    status, draft, scenarios, isDirty, setField, save, cancel, reload, saveState,
    canEngineer, showKeys,
  } = radar
  const groups = groupLayout === 'three-way' ? radar.groupsV2 : radar.groups

  if (status === 'loading') {
    return <p className={`dm-empty ${className}`}>{t('Loading radar configuration…', 'טוען הגדרות רדאר…')}</p>
  }
  if (status === 'unsupported' || status === 'error' || !draft) {
    return (
      <div className={`dm-settings-block ${className}`}>
        <p className="dm-empty" dir="ltr">
          {status === 'error'
            ? t('Backend unreachable — radar settings unavailable.', 'השרת לא נגיש — הגדרות רדאר לא זמינות.')
            : t('Radar configuration is not supported on this backend.', 'הגדרות רדאר אינן נתמכות בשרת זה.')}
        </p>
        <button type="button" className="dm-btn" onClick={reload}>{t('Retry', 'ניסיון חוזר')}</button>
      </div>
    )
  }

  const label = (field) => (lang === 'he' ? field.he : field.en)
  // Advisories derive from the editable draft. The settings endpoint does not
  // carry live radar connection status, so the port/timeout advisory only fires
  // when the config itself exposes radar_connected/last_error.
  const advisories = canEngineer
    ? serialAdvisories(draft, {
        radarConnected: radar.config?.radar_connected,
        lastError: radar.config?.last_error,
        includeTopology: groupLayout === 'three-way',
      })
    : []
  const threeWay = groupLayout === 'three-way'
  // Raw config keys are engineering vocabulary. In the three-way layout they are
  // confined to the Engineering block; operators and calibration see only the
  // human-readable label. The legacy layout keeps its existing behaviour.
  const rowProps = { draft, setField, label, showKeys: threeWay ? false : showKeys }
  const engRowProps = { draft, setField, label, showKeys }

  return (
    <form
      className={`dm-radarform ${className}`}
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <fieldset className="dm-settings-block">
        <legend>{lang === 'he' ? groups.operator.he : groups.operator.en}</legend>
        {groups.operator.toggles.map((field) => (
          <ToggleRow key={field.key} field={field} {...rowProps} />
        ))}
        {groups.operator.fields.map((field) => (
          <FieldRow key={field.key} field={field} {...rowProps} />
        ))}
      </fieldset>

      {canEngineer && groups.calibration ? (
        <details className="dm-settings-block dm-eng">
          <summary className="dm-eng-summary">
            {lang === 'he' ? groups.calibration.he : groups.calibration.en}
            <span className="dm-eng-tag" dir="ltr">{t('Admin', 'מנהל')}</span>
          </summary>
          {groups.calibration.toggles.map((field) => (
            <ToggleRow key={field.key} field={field} {...rowProps} />
          ))}
          {groups.calibration.fields.map((field) => (
            <FieldRow key={field.key} field={field} {...rowProps} />
          ))}
        </details>
      ) : null}

      {canEngineer ? (
        <details className="dm-settings-block dm-eng">
          <summary className="dm-eng-summary">
            {lang === 'he' ? groups.engineering.he : groups.engineering.en}
            <span className="dm-eng-tag" dir="ltr">{t('Admin', 'מנהל')}</span>
          </summary>

          <SettingsAdvisories advisories={advisories} onApply={(action) => setField(action.field, action.value)} />

          {groups.engineering.toggles.map((field) => (
            <ToggleRow key={field.key} field={field} {...engRowProps} />
          ))}
          {groups.engineering.fields.map((field) => (
            <FieldRow key={field.key} field={field} {...engRowProps} />
          ))}
          <label className="dm-field-row">
            <span className="dm-field-label">
              {t('Simulator scenario', 'תרחיש סימולטור')}
              {showKeys ? <code className="dm-key" dir="ltr">scenario</code> : null}
            </span>
            <select
              dir="ltr"
              value={draft.scenario || ''}
              disabled={!draft.RADAR_USE_MOCK}
              onChange={(e) => setField('scenario', e.target.value)}
            >
              {(scenarios.length ? scenarios : [draft.scenario].filter(Boolean)).map((scenario) => (
                <option key={scenario} value={scenario}>{scenario}</option>
              ))}
            </select>
          </label>
        </details>
      ) : null}

      {saveState.message ? (
        <p className={`dm-feedback ${saveState.ok ? 'is-ok' : 'is-err'}`} role="status" dir="ltr">
          {saveState.message}
        </p>
      ) : null}

      <div className="dm-form-actions">
        <button type="button" className="dm-btn" onClick={reload} disabled={saveState.busy}>
          {t('Reload', 'טעינה מחדש')}
        </button>
        <button type="button" className="dm-btn" onClick={cancel} disabled={!isDirty || saveState.busy}>
          {t('Cancel', 'ביטול')}
        </button>
        <button type="submit" className="dm-btn dm-btn--primary" disabled={!isDirty || saveState.busy}>
          {saveState.busy ? t('Saving…', 'שומר…') : t('Save changes', 'שמירת שינויים')}
        </button>
      </div>
    </form>
  )
}

// Real profile form (PUT /api/users/:id via AuthContext).
export function ProfileForm({ profile, className = '' }) {
  const { t } = useConcept()
  const { values, set, save, state } = profile
  return (
    <form
      className={`dm-profileform dm-settings-block ${className}`}
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <label className="dm-field-row">
        <span>{t('Username', 'שם משתמש')}</span>
        <input dir="ltr" value={values.username} onChange={(e) => set({ ...values, username: e.target.value })} />
      </label>
      <label className="dm-field-row">
        <span>{t('Email', 'אימייל')}</span>
        <input dir="ltr" type="email" value={values.email} onChange={(e) => set({ ...values, email: e.target.value })} />
      </label>
      <label className="dm-field-row">
        <span>{t('New password', 'סיסמה חדשה')}</span>
        <input dir="ltr" type="password" value={values.password} onChange={(e) => set({ ...values, password: e.target.value })} />
      </label>
      <label className="dm-field-row">
        <span>{t('Confirm password', 'אימות סיסמה')}</span>
        <input dir="ltr" type="password" value={values.confirm} onChange={(e) => set({ ...values, confirm: e.target.value })} />
      </label>
      {state.message ? (
        <p className={`dm-feedback ${state.ok ? 'is-ok' : 'is-err'}`} role="status" dir="ltr">{state.message}</p>
      ) : null}
      <div className="dm-form-actions">
        <button type="submit" className="dm-btn dm-btn--primary" disabled={state.busy}>
          {state.busy ? t('Saving…', 'שומר…') : t('Save profile', 'שמירת פרופיל')}
        </button>
      </div>
    </form>
  )
}

// Legacy "General" controls have no backend — rendered disabled + Planned.
export function PlannedSettings({ planned, className = '' }) {
  const { t, lang } = useConcept()
  return (
    <fieldset className={`dm-settings-block dm-planned ${className}`}>
      <legend>{t('General', 'כללי')}</legend>
      <p className="dm-planned-note">
        {t('These capabilities are not connected to the backend yet.', 'יכולות אלו עדיין אינן מחוברות לשרת.')}
      </p>
      {planned.map((item) => (
        <label key={item.key} className="dm-toggle-row is-disabled">
          <input type="checkbox" disabled />
          <span>{lang === 'he' ? item.he : item.en}</span>
          <span className="dm-planned-tag" dir="ltr">{t('Planned', 'מתוכנן')}</span>
        </label>
      ))}
    </fieldset>
  )
}
