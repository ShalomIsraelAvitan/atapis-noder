import { useMemo } from 'react'
import { useConcept } from '../../useConcept'
import { RadarConfigForm, ProfileForm, PlannedSettings } from '../../domain/SettingsForms'
import { ConnectionChecks } from './ConnectionChecks'

// Display-only configuration checks derived from the current draft — the
// "validation improvements" this concept inherits (decision doc). Advisory
// text only: nothing here blocks or alters the real save flow or the config
// contract, and nothing changes any value by itself.
function configChecks(draft, t) {
  if (!draft) return []
  const checks = []
  const baud = Number(draft.LD2450_BAUD)
  if (baud && baud !== 115200 && baud !== 256000) {
    checks.push({
      key: 'baud-unknown', level: 'warn',
      text: t(
        `Baud ${baud} is neither 115200 nor 256000 — the LD2450 is unlikely to sync.`,
        `קצב ${baud} אינו 115200 ואינו 256000 — סנכרון מול LD2450 לא סביר.`
      ),
    })
  } else if (baud === 115200) {
    checks.push({
      key: 'baud-115200', level: 'info',
      text: t(
        'Baud 115200 differs from the LD2450 factory default (256000). Verify against the physical wiring before changing.',
        'קצב 115200 שונה מברירת המחדל היצרנית של LD2450 (‏256000). יש לאמת מול החיווט הפיזי לפני שינוי.'
      ),
    })
  }
  if (draft.LD2450_PORT && !/^COM\d+$/i.test(String(draft.LD2450_PORT).trim())) {
    checks.push({
      key: 'port-format', level: 'warn',
      text: t(
        `"${draft.LD2450_PORT}" does not look like a Windows serial port (COM<n>).`,
        `"${draft.LD2450_PORT}" לא נראה כמו פורט טורי של Windows‏ (COM<n>).`
      ),
    })
  }
  const alertSpeed = Number(draft.alert_speed_cm_s)
  const dangerSpeed = Number(draft.danger_speed_cm_s)
  if (alertSpeed && dangerSpeed && alertSpeed >= dangerSpeed) {
    checks.push({
      key: 'speed-order', level: 'warn',
      text: t(
        `ALERT speed (${alertSpeed}) is not below DANGER speed (${dangerSpeed}) — DANGER would never trigger by speed alone.`,
        `מהירות ALERT‏ (${alertSpeed}) אינה נמוכה ממהירות DANGER‏ (${dangerSpeed}) — DANGER לא יופעל לפי מהירות בלבד.`
      ),
    })
  }
  const rate = Number(draft.update_rate_hz)
  if (rate && (rate < 1 || rate > 30)) {
    checks.push({
      key: 'rate-range', level: 'warn',
      text: t(
        `Update rate ${rate}Hz is outside the practical 1–30Hz range.`,
        `קצב עדכון ${rate}Hz מחוץ לטווח המעשי 1–30Hz.`
      ),
    })
  }
  if (draft.RADAR_USE_MOCK) {
    checks.push({
      key: 'mock-on', level: 'info',
      text: t(
        'Simulator (mock) is active — live radar hardware is ignored while this is on.',
        'הסימולטור (mock) פעיל — חומרת הרדאר החיה אינה בשימוש כל עוד זה דולק.'
      ),
    })
  }
  return checks
}

// Prime settings: Minimal's clean structure + advisory configuration checks.
export default function PrimeSettings({ vm }) {
  const { t } = useConcept()
  const checks = useMemo(() => configChecks(vm.radar.draft, t), [vm.radar.draft, t])

  return (
    <div className="pp-page pp-settings">
      <header className="pp-head">
        <div>
          <p className="pp-eyebrow" dir="ltr">SETTINGS</p>
          <h1 className="pp-title">{t('System settings', 'הגדרות מערכת')}</h1>
        </div>
      </header>

      <div className="pp-settings-grid">
        <div className="pp-settings-main">
          <section className="pp-card" aria-label={t('Radar', 'רדאר')}>
            <h2 className="dm-subtitle">{t('Radar', 'רדאר')}</h2>
            <RadarConfigForm radar={vm.radar} groupLayout="three-way" />
          </section>

          <section className="pp-card" aria-label={t('Connection checks', 'בדיקות חיבור')}>
            <h2 className="dm-subtitle">{t('Connection checks', 'בדיקות חיבור')}</h2>
            <ConnectionChecks />
          </section>

          {checks.length ? (
            <section className="pp-card pp-checks" aria-label={t('Configuration checks', 'בדיקות תצורה')}>
              <h2 className="dm-subtitle">{t('Configuration checks', 'בדיקות תצורה')}</h2>
              <p className="pp-checks-note">
                {t('Advisory only — nothing is changed automatically.', 'ייעוץ בלבד — דבר לא משתנה אוטומטית.')}
              </p>
              <ul className="pp-checks-list">
                {checks.map((check) => (
                  <li key={check.key} className={`pp-check pp-check--${check.level}`}>{check.text}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="pp-settings-side">
          <section className="pp-card" aria-label={t('Operator profile', 'פרופיל מפעיל')}>
            <h2 className="dm-subtitle">{t('Operator profile', 'פרופיל מפעיל')}</h2>
            <ProfileForm profile={vm.profile} />
          </section>
          <section className="pp-card" aria-label={t('General', 'כללי')}>
            <PlannedSettings planned={vm.planned} />
          </section>
        </div>
      </div>
    </div>
  )
}
