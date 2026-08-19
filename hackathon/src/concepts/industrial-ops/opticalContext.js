// Industrial Ops — the OPT side of the OPS→OPT context contract (Phase A3.2).
//
// Pure functions, so the whole intake can be proven in Node without a browser.
//
// This module reads a context that OPS wrote into the URL and answers one
// question: what, if anything, may the optical station show because of it?
//
// THE RULE IT EXISTS TO ENFORCE (§48): a context id that does not resolve is
// reported as UNAVAILABLE. It is never quietly swapped for something that does
// resolve. A stale link that silently opened a different camera would be worse
// than a broken one — the operator would have no way to know they were looking
// at the wrong place.
//
// And the rule it exists to NOT break (§40-§44): nothing here associates a
// camera with a radar. The radar context it returns is the AREA's radar, carried
// because the alert named that area, and it is labelled as area context wherever
// it is shown. No target is chosen, no proximity is compared, no time window is
// matched.

import { CAMERA_SOURCE_KEYS, findArea } from './areas.js'

export const OPT_CONTEXT_KIND = 'ops-alert'

/** An integer id from the URL, or null. Never NaN, never a coerced string. */
function intOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Parses the OPS context out of URLSearchParams and resolves it against the
 * declared areas.
 *
 * @param params URLSearchParams (or anything with a .get)
 * @param areas  the declared areas for THIS session's mode
 * @returns null when no context was supplied at all — the ordinary case of
 *          somebody opening the optical station directly, which must look
 *          exactly as it always has.
 */
export function readOpticalContext(params, { areas = [] } = {}) {
  if (!params || typeof params.get !== 'function') return null
  if (params.get('ctx') !== OPT_CONTEXT_KIND) return null

  const cameraId = params.get('cameraId') || null
  const areaId = params.get('areaId') || null
  const alertId = params.get('alertId') || null
  const trackId = intOrNull(params.get('trackId'))
  const targetId = intOrNull(params.get('targetId'))
  const at = intOrNull(params.get('at'))
  const isDemo = params.get('demo') === '1'

  const base = { kind: OPT_CONTEXT_KIND, cameraId, areaId, alertId, trackId, targetId, at, isDemo }

  // A context with no camera should never have been created — the OPTICAL button
  // is disabled without one — so arriving here without it means a hand-edited or
  // truncated URL. Reported, not repaired.
  if (!cameraId) return { ...base, resolved: false, reason: 'no-camera-id', area: null, camera: null, radarId: null }

  const area = findArea(areas, areaId)
  if (!area) {
    // The area is not in THIS deployment. The commonest real cause is a demo link
    // opened in a live session (or the reverse), and showing a live camera under
    // a demo alert's context would be exactly the confusion §35 forbids.
    return { ...base, resolved: false, reason: 'area-not-found', area: null, camera: null, radarId: null }
  }

  const camera = area.cameras.find((cam) => cam.id === cameraId) || null
  if (!camera) {
    return { ...base, resolved: false, reason: 'camera-not-in-area', area, camera: null, radarId: null }
  }

  return {
    ...base,
    resolved: true,
    reason: null,
    area,
    camera,
    // The area's single declared radar, for AREA CONTEXT only (§40). Null when
    // the area declares none — and then the panel says radar is unavailable
    // rather than borrowing another area's (§99 case 2).
    radarId: area.radars.length ? area.radars[0].id : null,
  }
}

/**
 * The adapter source key the optical feed should open for a resolved context, or
 * null to leave the operator's current source alone.
 *
 * Null is returned for a DEMO camera on purpose. Demo areas declare `sourceKey:
 * 'mock'`, which is not an adapter source at all; forcing `webcam` or `dahua`
 * there would put a real camera's feed on screen underneath a demo alert's
 * context — a live source presented as the demo one, which §35 forbids in as many
 * words. The context is still displayed; only the source switch is withheld.
 */
export function opticalSourceKeyFor(context) {
  if (!context || !context.resolved || !context.camera) return null
  const key = context.camera.sourceKey
  return CAMERA_SOURCE_KEYS.includes(key) ? key : null
}
