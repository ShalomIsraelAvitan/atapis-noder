import { useConcept } from '../../useConcept'
import { CameraFeed } from '../../../design-lab/shared/CameraFeed'
import { riskTone } from '../../../design-lab/shared/adapter'
import { RadarPlot } from '../../domain/RadarPlot'
import { TargetsTable } from '../../domain/TargetsTable'
import { TracksTable } from '../../domain/TracksTable'
import { WhyThisRisk } from '../../domain/WhyThisRisk'
import { ContactPairCard } from '../../domain/ContactPairCard'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Vision-first operational layout (redesigned): the live feed dominates, radar
// is a supporting panel, and the fused contact pair sits beside them. The
// neural orbital rings survive only as a faint backdrop behind the feed — the
// video is the work surface, not a token inside decorative circles.
export default function NeuralCamera({ vm }) {
  const { t } = useConcept()
  const s = vm.snapshot
  const track = s.tracks[0]

  return (
    <div className="nf2-page nf2-camera">
      <header className="nf2-head">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <p className="nf2-eyebrow" dir="ltr">VISION CORE · ROOM {vm.roomId}</p>
          <h1 className="nf2-title">{t('Vision, radar and fusion', 'ראייה, רדאר והיתוך')}</h1>
        </div>
      </header>

      <div className="nf2-vision-layout">
        <section className="nf2-card nf2-vision-main" aria-label={t('Live feed', 'זרם חי')}>
          <div className="nf2-vision-bar" dir="ltr">
            <div className="nf2-core-bar">
              {['webcam', 'dahua'].map((name) => (
                <button
                  key={name}
                  type="button"
                  className={vm.source === name ? 'is-active' : ''}
                  onClick={() => vm.setSource(name)}
                >
                  {name === 'webcam' ? 'LOCAL' : 'DAHUA'}
                </button>
              ))}
            </div>
            <span className="nf2-muted">
              {s.personCount > 0 ? `${s.personCount} person(s) in frame` : t('No person in frame', 'אין אדם בפריים')}
            </span>
          </div>
          <div className="nf2-vision-feed">
            <CameraFeed source={vm.source} active cameraStatus={vm.camera} isDemo={vm.isDemo} />
          </div>
          <dl className="nf2-vision-info" dir="ltr">
            <div><dt>{t('Behavior', 'התנהגות')}</dt><dd>{track?.state || s.motion || '—'}</dd></div>
            <div><dt>{t('Gate', 'שער')}</dt><dd>{track?.approachingGate ? t('Approaching', 'מתקרב') : '—'}</dd></div>
            <div>
              <dt>{t('Weapon', 'נשק')}</dt>
              <dd className={s.hasWeapon ? 'dm-tone-danger' : ''}>
                {vm.camera.weaponDetectionAvailable === false
                  ? t('Unavailable', 'לא זמין')
                  : s.hasWeapon ? t('Detected', 'זוהה') : t('None', 'אין')}
              </dd>
            </div>
            <div><dt>{t('Camera risk', 'סיכון מצלמה')}</dt><dd className={`dm-tone-${riskTone(s.risks.camera)}`}>{s.risks.camera}</dd></div>
          </dl>
        </section>

        <aside className="nf2-vision-rail">
          <section className="nf2-card" aria-label={t('Radar', 'רדאר')}>
            <div className="nf2-card-head">
              <h2 className="dm-subtitle">{t('Radar', 'רדאר')}</h2>
              <span className="nf2-muted" dir="ltr">{s.radar.status}{s.radar.provider ? ` · ${s.radar.provider}` : ''}</span>
            </div>
            <RadarPlot radar={s.radar} variant="arcs" selectedId={vm.selectedTargetId} onSelect={vm.setSelectedTargetId} />
            <TargetsTable radar={s.radar} variant="cards" selectedId={vm.selectedTargetId} onSelect={vm.setSelectedTargetId} />
          </section>

          <section className="nf2-card" aria-label={t('Fused target', 'מטרה מאוחדת')}>
            <h2 className="dm-subtitle">{t('Fused target', 'מטרה מאוחדת')}</h2>
            {vm.selectedPair ? (
              <ContactPairCard pair={vm.selectedPair} />
            ) : (
              <>
                <WhyThisRisk reasons={vm.reasons.slice(0, 3)} contributions={null} />
                <p className="nf2-muted nf2-rail-hint">{t('Select a target to inspect the contact pair.', 'בחר מטרה כדי לבחון את זוג המגע.')}</p>
              </>
            )}
          </section>

          <section className="nf2-card" aria-label={t('Tracked persons', 'אנשים במעקב')}>
            <h2 className="dm-subtitle">{t('Tracked persons', 'אנשים במעקב')}</h2>
            <TracksTable snapshot={s} />
          </section>
        </aside>
      </div>
    </div>
  )
}
