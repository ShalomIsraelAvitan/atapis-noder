import { useConcept } from '../../useConcept'
import { RadarConfigForm, ProfileForm, PlannedSettings } from '../../domain/SettingsForms'

// The cleanest, most usable Settings of all concepts: single calm column.
export default function MinimalSettings({ vm }) {
  const { t } = useConcept()
  return (
    <div className="mn-page mn-settings">
      <header>
        <h1 className="mn-title">{t('Settings', 'הגדרות')}</h1>
        <p className="mn-muted">{t('Radar configuration is live; unconnected controls are marked Planned.', 'הגדרות הרדאר חיות; בקרות לא מחוברות מסומנות כמתוכננות.')}</p>
      </header>
      <section aria-label={t('Radar configuration', 'הגדרות רדאר')}>
        <h2 className="mn-section-title">{t('Radar', 'רדאר')}</h2>
        <RadarConfigForm radar={vm.radar} />
      </section>
      <section aria-label={t('Profile', 'פרופיל')}>
        <h2 className="mn-section-title">{t('Profile', 'פרופיל')}</h2>
        <ProfileForm profile={vm.profile} />
      </section>
      <section aria-label={t('General', 'כללי')}>
        <h2 className="mn-section-title">{t('General', 'כללי')}</h2>
        <PlannedSettings planned={vm.planned} />
      </section>
    </div>
  )
}
