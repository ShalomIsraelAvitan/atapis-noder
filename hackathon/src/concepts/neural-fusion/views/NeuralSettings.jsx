import { useConcept } from '../../useConcept'
import { RadarConfigForm, ProfileForm, PlannedSettings } from '../../domain/SettingsForms'

// Neural: signal configuration — glass cards grouped per signal source.
// Calm by design (no flow animation on utility pages).
export default function NeuralSettings({ vm }) {
  const { t } = useConcept()
  return (
    <div className="nf2-page nf2-settings">
      <header className="nf2-head">
        <div>
          <p className="nf2-eyebrow" dir="ltr">SIGNALS</p>
          <h1 className="nf2-title">{t('Signal configuration', 'תצורת אותות')}</h1>
        </div>
      </header>
      <div className="nf2-settings-grid">
        <section className="nf2-card" aria-label={t('Radar signal', 'אות רדאר')}>
          <h2 className="dm-subtitle">{t('Radar signal', 'אות רדאר')}</h2>
          <RadarConfigForm radar={vm.radar} />
        </section>
        <div className="nf2-settings-side">
          <section className="nf2-card" aria-label={t('Operator', 'מפעיל')}>
            <h2 className="dm-subtitle">{t('Operator', 'מפעיל')}</h2>
            <ProfileForm profile={vm.profile} />
          </section>
          <section className="nf2-card" aria-label={t('General', 'כללי')}>
            <PlannedSettings planned={vm.planned} />
          </section>
        </div>
      </div>
    </div>
  )
}
