import { useConcept } from '../../useConcept'
import { AboutMvp, AboutVision } from '../../domain/AboutSections'
import { FusionArchitecture } from '../../domain/FusionArchitecture'

// Industrial: numbered technical product brief — a spec document, not marketing.
export default function IndustrialAbout({ vm }) {
  const { lang, t } = useConcept()
  const { about } = vm
  const L = (obj) => obj[lang] || obj.en

  const sections = [
    { num: '1.0', title: L(about.problem.title), body: L(about.problem.body) },
    { num: '2.0', title: L(about.innovation.title), body: L(about.innovation.body) },
    ...about.pillars.map((pillar, index) => ({
      num: `3.${index + 1}`,
      title: L(pillar.title),
      body: L(pillar.body),
    })),
    { num: '4.0', title: L(about.architecture.title), body: L(about.architecture.body) },
  ]

  return (
    <div className="io2-page io2-about">
      <header className="io2-about-head" dir="ltr">
        <p className="io2-about-doc">DOC / SYSTEM BRIEF /// {about.product}</p>
        <h1 className="io2-about-title">{about.fullName.toUpperCase()}</h1>
        <p className="io2-about-tag" dir="auto">{L(about.tagline)}</p>
        <p className="io2-about-note" dir="auto">{t('Honest MVP status. No marketing numbers.', 'סטטוס MVP כן. בלי מספרי שיווק.')}</p>
      </header>

      <div className="io2-about-body">
        {sections.map((section) => (
          <section key={section.num} className="io2-about-section">
            <h2 dir="ltr"><span className="io2-about-num">{section.num}</span> {section.title.toUpperCase()}</h2>
            <p>{section.body}</p>
          </section>
        ))}

        <section className="io2-about-section">
          <h2 dir="ltr"><span className="io2-about-num">4.1</span> SIGNAL PATH</h2>
          <FusionArchitecture className="io2-about-arch" />
        </section>

        <section className="io2-about-section">
          <h2 dir="ltr"><span className="io2-about-num">5.0</span> {L(about.mvp.title).toUpperCase()}</h2>
          <AboutMvp mvp={{ ...about.mvp, title: { en: '', he: '' } }} className="io2-about-mvp" />
        </section>

        <section className="io2-about-section">
          <h2 dir="ltr"><span className="io2-about-num">6.0</span> {L(about.vision.title).toUpperCase()}</h2>
          <AboutVision vision={{ ...about.vision, title: { en: '', he: '' } }} />
        </section>
      </div>
    </div>
  )
}
