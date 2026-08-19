import { buildRiskReasons } from '../data/whyThisRisk'

// Industrial Ops presentation of the risk reasons.
//
// Two things happen here, both display-only. No risk value, threshold or
// backend behaviour is touched.
//
// 1. Language. `buildRiskReasons` already carries an English/Hebrew pair for
//    every reason but the shared dashboard view model calls it without a
//    translator, so every concept renders English. Industrial calls it with its
//    own `t`, which leaves the shared `vm.reasons` — and therefore every other
//    concept — byte-identical.
//
// 2. Calibration honesty. The behaviour engine's `approaching_gate` for a camera
//    track is computed against GATE_POINT = (960, 1080) in image pixels
//    (analysis.py), which is calibrated for 1920x1080 and is off-frame on the
//    Dahua substream. The radar's own flag is sensor-relative and has no gate at
//    all. Neither is a calibrated gate, so this screen refuses to print the word
//    "gate" as if it were one, and marks the claim UNCALIBRATED instead.

const OVERRIDES = {
  // camera: heading vs an uncalibrated pixel reference point
  appr: {
    en: (id) => `Track #${id} approaching configured reference point`,
    he: (id) => `מסלול #${id} מתקרב לנקודת ייחוס מוגדרת`,
    uncalibrated: true,
  },
  // radar: closing inside the sensor cone — still not a gate
  'radar-gate': {
    en: (id) => `Radar T${id} closing inside sensor reference cone`,
    he: (id) => `רדאר T${id} מתקרב בתוך קונוס הייחוס של החיישן`,
    uncalibrated: true,
  },
}

function overrideFor(key) {
  if (typeof key !== 'string') return null
  if (key.startsWith('radar-gate-')) return { rule: OVERRIDES['radar-gate'], id: key.slice('radar-gate-'.length) }
  if (key.startsWith('appr-')) return { rule: OVERRIDES.appr, id: key.slice('appr-'.length) }
  return null
}

/**
 * @param snapshot adapted snapshot
 * @param t        concept translator: t(en, he)
 * @param lang     'he' | 'en'
 * @returns reasons with localized text and an `uncalibrated` flag where the
 *          underlying signal has no calibration behind it.
 */
export function buildIndustrialReasons(snapshot, t, lang) {
  const reasons = buildRiskReasons(snapshot, t)
  return reasons.map((reason) => {
    const hit = overrideFor(reason.key)
    if (!hit) return { ...reason, uncalibrated: false }
    const text = lang === 'he' ? hit.rule.he(hit.id) : hit.rule.en(hit.id)
    return { ...reason, text, uncalibrated: Boolean(hit.rule.uncalibrated) }
  })
}

export const UNCALIBRATED_TITLE = {
  en: 'Uncalibrated: derived from an image-space reference point (camera) or the sensor cone (radar). There is no surveyed gate and no camera-to-radar calibration in the system.',
  he: 'ללא כיול: נגזר מנקודת ייחוס במרחב התמונה (מצלמה) או מקונוס החיישן (רדאר). אין במערכת שער מדוד ואין כיול בין מצלמה לרדאר.',
}
