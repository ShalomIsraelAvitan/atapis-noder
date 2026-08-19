import { useMemo } from 'react'
import { useConcept } from '../useConcept'
import { buildDecisionSentence } from '../data/riskDecision'

// One-sentence operational summary + supporting subline. Structure-only: each
// concept restyles via the .dm-decision* classes and the variant modifier.
// The primary number in the headline is always the backend Fused Risk.
//
// `sentence` is an opt-in override (see buildOperatorSentence): when supplied,
// the multi-sentence operator phrasing replaces the default single headline +
// subline. Omitting it leaves every existing caller rendering exactly as before.
export function RiskDecisionHeader({
  snapshot,
  linkage = null,
  variant = 'banner',
  sentence = null,
  className = '',
}) {
  const { lang } = useConcept()
  const fallback = useMemo(
    () => (sentence ? null : buildDecisionSentence(snapshot, { linkage })),
    [snapshot, linkage, sentence]
  )
  const idx = lang === 'he' ? 1 : 0
  const tone = sentence ? sentence.tone : fallback.tone

  return (
    <div
      className={`dm-decision dm-decision--${tone} dm-decision--${variant} ${className}`}
      role="status"
      aria-live="polite"
    >
      {sentence ? (
        <>
          <p className="dm-decision-headline">{sentence.headline[idx]}</p>
          {sentence.radarLine ? (
            <p className="dm-decision-sub" dir={lang === 'he' ? 'rtl' : 'ltr'}>
              {sentence.radarLine[idx]}
            </p>
          ) : null}
          {sentence.associationLine ? (
            <p className="dm-decision-assoc" dir={lang === 'he' ? 'rtl' : 'ltr'}>
              {sentence.associationLine[idx]}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="dm-decision-headline">{fallback.headline[idx]}</p>
          <p className="dm-decision-sub" dir={lang === 'he' ? 'rtl' : 'ltr'}>
            {fallback.subline[idx]}
          </p>
        </>
      )}
    </div>
  )
}
