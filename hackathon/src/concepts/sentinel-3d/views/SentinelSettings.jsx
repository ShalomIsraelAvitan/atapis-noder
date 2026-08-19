import { useConcept } from '../../useConcept'
import { RadarConfigForm, ProfileForm, PlannedSettings } from '../../domain/SettingsForms'

// Sentinel: console panels floating over a quiet background — no 3D here,
// this is where the operator configures the system, not observes it.
export default function SentinelSettings({ vm }) {
  const { t } = useConcept()
  return (
    <div className="s32-page s32-settings">
      <header className="s32-head">
        <div>
          <p className="s32-eyebrow" dir="ltr">CONSOLE</p>
          <h1 className="s32-title">{t('System console', 'קונסולת מערכת')}</h1>
        </div>
      </header>
      <div className="s32-settings-grid">
        <section className="s32-card" aria-label={t('Radar link', 'קישור רדאר')}>
          <h2 className="dm-subtitle">{t('Radar link', 'קישור רדאר')}</h2>
          <RadarConfigForm radar={vm.radar} />
        </section>
        <div className="s32-settings-side">
          <section className="s32-card" aria-label={t('Operator', 'מפעיל')}>
            <h2 className="dm-subtitle">{t('Operator', 'מפעיל')}</h2>
            <ProfileForm profile={vm.profile} />
          </section>
          <section className="s32-card" aria-label={t('General', 'כללי')}>
            <PlannedSettings planned={vm.planned} />
          </section>
        </div>
      </div>
    </div>
  )
}
