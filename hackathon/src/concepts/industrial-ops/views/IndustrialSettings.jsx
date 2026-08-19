import { useState } from 'react'
import { useConcept } from '../../useConcept'
import { RadarConfigForm, ProfileForm, PlannedSettings } from '../../domain/SettingsForms'
import { SystemHealthPanel } from '../components/SystemHealthPanel'

// Industrial: technical tabs + a read-only current-values table.
//
// Phase A3.1 added the SYSTEM HEALTH tab, moved here from OPS. It is mounted
// only while its tab is selected: the panel carries its own live data, and an
// operator reading the radar form has no reason to be polling for it.
export default function IndustrialSettings({ vm }) {
  const { t, lang } = useConcept()
  const [tab, setTab] = useState('radar')
  const config = vm.radar.config
  const { showKeys, operatorKeys, keyLabel } = vm.radar

  // Operators see only the operator-facing values with human labels; admins get
  // the full config with raw keys. Internal keys are never dumped to operators.
  const configRows = config
    ? Object.entries(config).filter(([key]) => showKeys || operatorKeys.has(key))
    : []

  return (
    <div className="io2-page io2-settings">
      <div className="io2-strip" dir="ltr">
        <div className="io2-strip-mode">
          <span className="io2-strip-label">CONFIG</span>
          <span className="io2-strip-modeval io2-strip-modeval--sm">{t('SYSTEM CONFIGURATION', 'תצורת מערכת')}</span>
        </div>
        <div className="io2-tabs" role="tablist" aria-label={t('Settings sections', 'מקטעי הגדרות')}>
          {[
            { id: 'radar', label: 'RADAR' },
            { id: 'profile', label: 'OPERATOR' },
            { id: 'general', label: 'GENERAL' },
            // Appended, never inserted: the three existing tabs keep the
            // positions operators already know.
            { id: 'health', label: t('SYSTEM HEALTH', 'בריאות מערכת') },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'is-active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* System health is a full-width read-out, not a form beside a values
          table, so it replaces the two-column grid rather than squeezing into
          half of it. */}
      {tab === 'health' ? (
        <div className="io2-settings-wide">
          <section className="io2-panel" aria-label={t('System health', 'תקינות מערכת')}>
            <SystemHealthPanel />
          </section>
        </div>
      ) : (
      <div className="io2-settings-grid">
        <section className="io2-panel io2-settings-main">
          {tab === 'radar' ? <RadarConfigForm radar={vm.radar} /> : null}
          {tab === 'profile' ? <ProfileForm profile={vm.profile} /> : null}
          {tab === 'general' ? <PlannedSettings planned={vm.planned} /> : null}
        </section>

        <section className="io2-panel" aria-label={t('Current values', 'ערכים נוכחיים')}>
          <h2 className="io2-panel-title" dir="ltr">[ ACTIVE VALUES ]</h2>
          {configRows.length ? (
            <div className="dm-table-scroll">
              <table className="dm-table" dir="ltr" style={{ '--dm-cols': 2 }}>
                <thead>
                  <tr><th>{showKeys ? 'KEY' : t('Setting', 'הגדרה')}</th><th>{t('Value', 'ערך')}</th></tr>
                </thead>
                <tbody>
                  {configRows.map(([key, value]) => (
                    <tr key={key}>
                      <td className="io2-key">{showKeys ? key : keyLabel(key, lang)}</td>
                      <td>{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dm-empty" dir="ltr">CONFIG UNAVAILABLE</p>
          )}
        </section>
      </div>
      )}
    </div>
  )
}
