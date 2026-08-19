import { useConcept } from '../../useConcept'
import { AboutHero, AboutMvp, AboutVision } from '../../domain/AboutSections'

// Neural: the sensor-fusion journey — each stage of the pipeline is a step,
// connected by a running flow line.
export default function NeuralAbout({ vm }) {
  const { lang, t } = useConcept()
  const { about } = vm
  const L = (obj) => obj[lang] || obj.en

  const steps = [
    { id: 'problem', title: L(about.problem.title), body: L(about.problem.body) },
    ...about.pillars.map((pillar) => ({ id: pillar.id, title: L(pillar.title), body: L(pillar.body) })),
    { id: 'decision', title: t('One decision', 'החלטה אחת'), body: L(about.innovation.body) },
  ]

  return (
    <div className="nf2-page nf2-about">
      <AboutHero about={about} className="nf2-about-hero" />

      <ol className="nf2-journey" aria-label={t('Fusion journey', 'מסע ההיתוך')}>
        {steps.map((step, index) => (
          <li key={step.id} className="nf2-journey-step" style={{ '--nf2-i': index }}>
            <span className="nf2-journey-dot" aria-hidden="true" />
            <div className="nf2-card nf2-journey-card">
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="nf2-about-tail">
        <AboutMvp mvp={about.mvp} className="nf2-card" />
        <AboutVision vision={about.vision} className="nf2-card" />
      </div>
    </div>
  )
}
