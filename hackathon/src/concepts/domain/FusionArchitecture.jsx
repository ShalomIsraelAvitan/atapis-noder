import { useConcept } from '../useConcept'

// One sensor path row (camera or radar). Module-level so it is not re-created
// on every render of the diagram.
function ArchPath({ steps, tone }) {
  return (
    <div className={`dm-arch-path dm-arch-path--${tone}`}>
      {steps.map((step, i) => (
        <span key={step} className="dm-arch-cell">
          <span className={`dm-arch-node${i === 0 ? ` dm-arch-node--${tone}` : ''}`}>{step}</span>
          {i < steps.length - 1 ? <span className="dm-arch-arrow" aria-hidden="true">→</span> : null}
        </span>
      ))}
    </div>
  )
}

// Two parallel sensor paths converging into fusion → risk decision. Structure
// only (no data) — each concept skins the dm-arch* classes. This replaces the
// single linear flow where the camera and radar pipelines should read as
// distinct sources meeting at the fusion engine.
//
// showExample and animateFlow are both opt-in: a caller that passes neither
// renders the exact static diagram it did before.
export function FusionArchitecture({ showExample = false, animateFlow = false, className = '' }) {
  const { t, lang } = useConcept()
  // Explicit rather than dir="auto": styling that mirrors the sequence chevrons
  // has to be able to select on the resolved direction.
  const exampleDir = lang === 'he' ? 'rtl' : 'ltr'
  const cameraSteps = [
    t('Camera', 'מצלמה'),
    t('Detection', 'זיהוי'),
    t('Tracking', 'מעקב'),
    t('Behavior', 'התנהגות'),
  ]
  const radarSteps = [
    t('Radar', 'רדאר'),
    t('Distance · Speed · Direction', 'מרחק · מהירות · כיוון'),
  ]

  return (
    <div className={`dm-arch ${animateFlow ? 'dm-arch--flow' : ''} ${className}`} dir="ltr">
      <div className="dm-arch-sources">
        <ArchPath steps={cameraSteps} tone="camera" />
        <ArchPath steps={radarSteps} tone="radar" />
      </div>
      <div className="dm-arch-join" aria-hidden="true"><span className="dm-arch-brace" /></div>
      <div className="dm-arch-out">
        <span className="dm-arch-node dm-arch-node--fusion">{t('Sensor Fusion', 'היתוך חיישנים')}</span>
        <span className="dm-arch-arrow" aria-hidden="true">→</span>
        <span className="dm-arch-node dm-arch-node--risk">{t('Risk Decision', 'החלטת סיכון')}</span>
      </div>

      {showExample ? (
        <div className="dm-arch-example" dir={exampleDir}>
          <h3 className="dm-arch-example-title">{t('One event, end to end', 'אירוע אחד, מקצה לקצה')}</h3>
          {/* A sequence of stages rather than a paragraph, so the reader can
              follow the same left-to-right path the diagram above describes. */}
          <ol className="dm-arch-seq">
            {[
              {
                tone: 'camera',
                stage: t('Camera path', 'מסלול המצלמה'),
                value: t('Person #7 · approaching', 'אדם ‎#7‎ · מתקרב'),
                body: t(
                  'Detected, tracked across frames, and read by behavior analysis as an approach toward the gate.',
                  'זוהה, נעקב לאורך הפריימים, וניתוח ההתנהגות קרא את התנועה כהתקרבות לשער.'
                ),
              },
              {
                tone: 'radar',
                stage: t('Radar path', 'מסלול הרדאר'),
                value: t('Target T1 · 3.9 m · 0.96 m/s', 'מטרה T1 · 3.9 m · 0.96 m/s'),
                body: t(
                  'Reported independently, with its own distance, speed and direction.',
                  'מדווח באופן עצמאי, עם מרחק, מהירות וכיוון משלו.'
                ),
              },
              {
                tone: 'fusion',
                stage: t('Sensor fusion', 'היתוך חיישנים'),
                value: t('Camera 47 + Radar 48', 'מצלמה 47 + רדאר 48'),
                body: t(
                  'The two risk scores are combined into one system decision.',
                  'שני ציוני הסיכון משולבים להחלטה מערכתית אחת.'
                ),
              },
              {
                tone: 'risk',
                stage: t('Risk decision', 'החלטת סיכון'),
                value: t('ALERT · Fused Risk 51', 'ALERT · סיכון ממוזג 51'),
                body: t(
                  'SAFE below 40, ALERT from 40, DANGER from 75.',
                  'SAFE מתחת ל־40, ALERT מ־40, DANGER מ־75.'
                ),
              },
            ].map((step) => (
              <li key={step.stage} className={`dm-arch-seq-step dm-arch-seq-step--${step.tone}`}>
                <span className="dm-arch-seq-stage">{step.stage}</span>
                <span className="dm-arch-seq-value">{step.value}</span>
                <span className="dm-arch-seq-body">{step.body}</span>
              </li>
            ))}
          </ol>
          <p className="dm-arch-example-note">{t(
            'The camera track and the radar target stay separate sources. With no shared frame of reference between them, live operation shows them as a Candidate Pair marked Unverified; a confirmed Fused Contact appears only in demo data, until a real association is implemented.',
            'מסלול המצלמה ומטרת הרדאר נשארים מקורות נפרדים. בהיעדר מסגרת ייחוס משותפת ביניהם, בתפעול חי הם מוצגים כזוג מועמד המסומן "לא מאומת"; מגע מאוחד ודאי מופיע רק בנתוני הדגמה, עד שיוטמע שיוך אמיתי.'
          )}</p>
        </div>
      ) : null}
    </div>
  )
}
