// Industrial Ops — the alert vocabulary (Phase A2).
//
// One place for the words, so the row, the action bar, the confirmation dialogs
// and the context menu describe the same alert the same way. Two surfaces
// disagreeing about what an alert is called is how an operator ends up acting on
// the wrong one.
//
// Plain .js on purpose: these are constants and pure functions, and keeping them
// out of the component file is what lets fast refresh work on the components.

import { LIFECYCLE, RESOLVE_REASONS } from '../alerts.js'

export const LIFECYCLE_LABEL = {
  [LIFECYCLE.NEW]: { en: 'NEW', he: 'חדשה' },
  [LIFECYCLE.ACKNOWLEDGED]: { en: 'ACK', he: 'אושרה' },
  [LIFECYCLE.IN_REVIEW]: { en: 'IN REVIEW', he: 'בטיפול' },
  [LIFECYCLE.RESOLVED]: { en: 'RESOLVED', he: 'נסגרה' },
}

export const RESOLVE_REASON_LABEL = {
  false_alarm: { en: 'False Alarm', he: 'התראת שווא' },
  no_threat: { en: 'No Threat', he: 'אין איום' },
  handled: { en: 'Handled', he: 'טופל' },
  sensor_issue: { en: 'Sensor Issue', he: 'תקלה בחיישן' },
  other: { en: 'Other', he: 'אחר' },
}

export const ACTION_LABEL = {
  acknowledge: { en: 'ACKNOWLEDGE', he: 'אישור קבלה' },
  review: { en: 'START REVIEW', he: 'התחל טיפול' },
  resolve: { en: 'RESOLVE', he: 'סגור התראה' },
  reopen: { en: 'REOPEN', he: 'פתח מחדש' },
}

/** The five approved reasons, in their approved order, ready for a <select>. */
export const RESOLVE_REASON_OPTIONS = RESOLVE_REASONS

export const pickLabel = (map, key, lang) =>
  (map[key] ? map[key][lang === 'he' ? 'he' : 'en'] : key || '')

export function lifecycleLabel(alert, lang) {
  return alert ? pickLabel(LIFECYCLE_LABEL, alert.lifecycle, lang) : ''
}

/** The condition axis, which is NOT the lifecycle and never collapses into it. */
export function conditionLabel(alert, t) {
  if (!alert) return ''
  return alert.active ? t('CONDITION ACTIVE', 'התנאי פעיל') : t('CONDITION CLEARED', 'התנאי חדל')
}

/**
 * The camera honesty rule, in one place: a camera alert prints CAMERA SOURCE NOT
 * IDENTIFIED, because the backend merges every camera into one global snapshot
 * and tracks carry no camera id. Naming CAM-01 would be a guess printed as fact.
 * A radar alert MAY show its id — exactly one radar is declared per area.
 */
export function sourceLabel(alert, t) {
  if (!alert) return ''
  if (alert.sourceType === 'camera') {
    return alert.cameraSourceKnown && alert.sourceId
      ? alert.sourceId
      : t('CAMERA SOURCE NOT IDENTIFIED', 'מקור המצלמה אינו מזוהה')
  }
  if (alert.sourceType === 'radar') return alert.sourceId || t('RADAR', 'רדאר')
  return t('SYSTEM', 'מערכת')
}

export function severityLabel(alert, t) {
  if (!alert) return ''
  if (alert.severity === 'danger') return t('DANGER', 'סכנה')
  if (alert.severity === 'alert') return t('ALERT', 'התראה')
  return t('INFO', 'מידע')
}
