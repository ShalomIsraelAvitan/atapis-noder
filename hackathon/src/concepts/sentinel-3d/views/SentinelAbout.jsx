import { useConcept } from '../../useConcept'
import { AboutHero, AboutSection, AboutMvp, AboutVision } from '../../domain/AboutSections'
import { FusionArchitecture } from '../../domain/FusionArchitecture'

const ORBIT_ANGLES = [-90, 0, 90, 180]

// Sentinel: the architecture as a spatial diagram — pillars orbit a fusion
// core, then resolve into the linear signal-path flow.
export default function SentinelAbout({ vm }) {
  const { lang, t } = useConcept()
  const { about } = vm
  const L = (obj) => obj[lang] || obj.en

  return (
    <div className="s32-page s32-about">
      <AboutHero about={about} className="s32-about-hero" />

      <div className="s32-about-intro">
        <AboutSection section={about.problem} className="s32-card" />
        <AboutSection section={about.innovation} className="s32-card" />
      </div>

      <section className="s32-card s32-orbit-card" aria-label={t('System architecture', 'ארכיטקטורת מערכת')}>
        <span className="s32-hud-title" dir="ltr">SYSTEM ARCHITECTURE</span>
        <div className="s32-orbit">
          <div className="s32-orbit-ring" aria-hidden="true" />
          <div className="s32-orbit-core" dir="ltr">
            <span>FUSION</span>
          </div>
          {about.pillars.map((pillar, index) => {
            const angle = ORBIT_ANGLES[index % ORBIT_ANGLES.length]
            const rad = (angle * Math.PI) / 180
            return (
              <article
                key={pillar.id}
                className="s32-orbit-node"
                style={{ left: `${50 + Math.cos(rad) * 42}%`, top: `${50 + Math.sin(rad) * 42}%` }}
              >
                <h3>{L(pillar.title)}</h3>
                <p>{L(pillar.body)}</p>
              </article>
            )
          })}
        </div>
        <div className="s32-orbit-flow">
          <h3 className="dm-subtitle">{L(about.architecture.title)}</h3>
          <p>{L(about.architecture.body)}</p>
          <FusionArchitecture className="s32-about-arch" />
        </div>
      </section>

      <div className="s32-about-tail">
        <AboutMvp mvp={about.mvp} className="s32-card" />
        <AboutVision vision={about.vision} className="s32-card" />
      </div>
    </div>
  )
}
