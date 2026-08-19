import { useConcept } from '../useConcept'

// Reusable About building blocks — concepts compose + style them differently.
export function AboutHero({ about, className = '' }) {
  const { lang, t } = useConcept()
  return (
    <header className={`dm-about-hero ${className}`}>
      <p className="dm-about-eyebrow" dir="ltr">{about.product} · {about.fullName}</p>
      <h1 className="dm-about-title">{about.tagline[lang] || about.tagline.en}</h1>
      <p className="dm-about-note">{t('Current MVP — honest status, no marketing numbers.', 'MVP נוכחי — סטטוס כן, בלי מספרי שיווק.')}</p>
    </header>
  )
}

export function AboutSection({ section, className = '' }) {
  const { lang } = useConcept()
  return (
    <section className={`dm-about-section ${className}`}>
      <h2>{section.title[lang] || section.title.en}</h2>
      <p>{section.body[lang] || section.body.en}</p>
    </section>
  )
}

export function AboutPillars({ pillars, className = '' }) {
  const { lang } = useConcept()
  return (
    <div className={`dm-about-pillars ${className}`}>
      {pillars.map((pillar) => (
        <article key={pillar.id} className="dm-about-pillar">
          <h3>{pillar.title[lang] || pillar.title.en}</h3>
          <p>{pillar.body[lang] || pillar.body.en}</p>
        </article>
      ))}
    </div>
  )
}

export function AboutFlow({ flow, className = '' }) {
  return (
    <ol className={`dm-about-flow ${className}`} dir="ltr">
      {flow.map((step, index) => (
        <li key={step}>
          <span className="dm-about-flow-step">{step}</span>
          {index < flow.length - 1 ? <span className="dm-about-flow-arrow" aria-hidden="true">→</span> : null}
        </li>
      ))}
    </ol>
  )
}

export function AboutMvp({ mvp, className = '' }) {
  const { lang, t } = useConcept()
  const title = mvp.title[lang] || mvp.title.en
  return (
    <section className={`dm-about-section ${className}`}>
      {title ? <h2>{title}</h2> : null}
      <ul className="dm-about-mvp">
        {mvp.items.map((item, index) => (
          <li key={index} className={`dm-about-mvp-item is-${item.status}`}>
            <span className="dm-about-mvp-status" dir="ltr">
              {item.status === 'working' ? t('Working', 'עובד') : t('In verification', 'באימות')}
            </span>
            {lang === 'he' ? item.he : item.en}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AboutVision({ vision, className = '' }) {
  const { lang } = useConcept()
  const title = vision.title[lang] || vision.title.en
  return (
    <section className={`dm-about-section dm-about-vision ${className}`}>
      {title ? <h2>{title}</h2> : null}
      <p className="dm-about-vision-note">{vision.note[lang] || vision.note.en}</p>
      <ul>
        {vision.items.map((item, index) => (
          <li key={index}>{lang === 'he' ? item.he : item.en}</li>
        ))}
      </ul>
    </section>
  )
}
