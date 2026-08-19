// Industrial Ops — area model (Phase A0).
//
// HONESTY CONTRACT (read before changing anything here):
//
// The backend has no area entity. `/status` collapses every camera source into
// one dominant global snapshot (server.py::_build_global_status_snapshot) and
// the radar payload carries no sensor id at all. `track.zone` is NOT an area —
// it is the behaviour engine's image-space label (`outside` / `fence` / `gate`).
//
// So the mapping below is DECLARED, never inferred. Live has exactly the
// hardware that exists: two camera sources and one radar, in one area. Inventing
// a "north tower" or a "west gate" would be the same class of lie as
// synthesizing a camera-radar association.
//
// The shape is already N-area so that swapping in a future GET /api/areas is a
// data-source change and not a rewrite. That endpoint is NOT implemented.

export const DEPLOYMENT_MODES = {
  SINGLE_AREA: 'single-area',
  MULTI_AREA: 'multi-area',
}

export const SOURCE_TYPES = {
  CAMERA: 'camera',
  RADAR: 'radar',
  SYSTEM: 'system',
}

// The only real camera keys the adapter produces (adapter.js::adaptSnapshot).
export const CAMERA_SOURCE_KEYS = ['webcam', 'dahua']

// Declared identifiers. `CAM-01`/`CAM-02` exist today only as hardcoded text in
// IndustrialCamera.jsx; this is the first place they become actual identifiers.
const CAMERA_ID_BY_SOURCE_KEY = {
  webcam: 'CAM-01',
  dahua: 'CAM-02',
}

export const RADAR_SENSOR_ID = 'RDR-01'
export const LIVE_AREA_ID = 'AREA-01'

// Live deployment: one area, the hardware that is actually wired.
export const LIVE_AREAS = Object.freeze([
  Object.freeze({
    id: LIVE_AREA_ID,
    name: 'Primary Site',
    nameHe: 'אתר ראשי',
    deploymentMode: DEPLOYMENT_MODES.SINGLE_AREA,
    isDemo: false,
    cameras: Object.freeze([
      Object.freeze({ id: 'CAM-01', sourceKey: 'webcam' }),
      Object.freeze({ id: 'CAM-02', sourceKey: 'dahua' }),
    ]),
    radars: Object.freeze([Object.freeze({ id: RADAR_SENSOR_ID, sourceKey: 'ld2450' })]),
    // No source of truth says which camera is primary, so none is declared.
    // A null here is what makes "open the area's primary camera" fall through to
    // the operator's last choice instead of a guess.
    primaryCameraId: null,
  }),
])

// Demo areas may be plural — they are synthetic by construction and every
// consumer can tell, because `isDemo` travels with the area itself.
export const DEMO_AREAS = Object.freeze([
  Object.freeze({
    id: 'DEMO-AREA-01',
    name: 'Main Gate (demo)',
    nameHe: 'ש״ג ראשי (הדגמה)',
    deploymentMode: DEPLOYMENT_MODES.MULTI_AREA,
    isDemo: true,
    cameras: Object.freeze([
      Object.freeze({ id: 'DEMO-CAM-01', sourceKey: 'mock' }),
      Object.freeze({ id: 'DEMO-CAM-02', sourceKey: 'mock' }),
    ]),
    radars: Object.freeze([Object.freeze({ id: 'DEMO-RDR-01', sourceKey: 'mock' })]),
    primaryCameraId: 'DEMO-CAM-01',
  }),
  Object.freeze({
    id: 'DEMO-AREA-02',
    name: 'North Tower (demo)',
    nameHe: 'מגדל צפוני (הדגמה)',
    deploymentMode: DEPLOYMENT_MODES.MULTI_AREA,
    isDemo: true,
    cameras: Object.freeze([Object.freeze({ id: 'DEMO-CAM-04', sourceKey: 'mock' })]),
    radars: Object.freeze([Object.freeze({ id: 'DEMO-RDR-03', sourceKey: 'mock' })]),
    primaryCameraId: 'DEMO-CAM-04',
  }),
  Object.freeze({
    id: 'DEMO-AREA-03',
    name: 'East Entrance (demo)',
    nameHe: 'כניסה מזרחית (הדגמה)',
    deploymentMode: DEPLOYMENT_MODES.MULTI_AREA,
    isDemo: true,
    cameras: Object.freeze([
      Object.freeze({ id: 'DEMO-CAM-05', sourceKey: 'mock' }),
      Object.freeze({ id: 'DEMO-CAM-06', sourceKey: 'mock' }),
    ]),
    radars: Object.freeze([Object.freeze({ id: 'DEMO-RDR-04', sourceKey: 'mock' })]),
    primaryCameraId: 'DEMO-CAM-05',
  }),
])

/** Live areas, or the demo set. Demo areas never leak into a live session. */
export function getAreas({ isDemo = false } = {}) {
  return isDemo ? DEMO_AREAS : LIVE_AREAS
}

export function findArea(areas, areaId) {
  if (!Array.isArray(areas) || !areaId) return null
  return areas.find((area) => area.id === areaId) || null
}

/** 'webcam' -> 'CAM-01'. Returns null for anything not declared. */
export function cameraIdForSourceKey(sourceKey) {
  return CAMERA_ID_BY_SOURCE_KEY[sourceKey] || null
}

export function areaName(area, lang) {
  if (!area) return ''
  return lang === 'he' ? area.nameHe : area.name
}

/**
 * Area id for a source — a lookup in the declared mapping, never a guess.
 * Returns null when the source is not mapped; callers must NOT fall back to
 * "the first area", because that would attach an event to a place it may not
 * have happened in.
 *
 * `sourceKey` is optional for radar/system: exactly one radar is declared per
 * area and system events belong to the area as a whole.
 */
export function resolveAreaIdForSource(areas, { sourceType, sourceKey = null } = {}) {
  if (!Array.isArray(areas) || !areas.length) return null

  if (sourceType === SOURCE_TYPES.CAMERA) {
    // A camera event whose source key is unknown (the current live case) still
    // belongs to the deployment when there is exactly one area — that is the
    // declared topology, not an inference about which camera fired.
    if (!sourceKey) return areas.length === 1 ? areas[0].id : null
    const owner = areas.find((area) => area.cameras.some((cam) => cam.sourceKey === sourceKey))
    return owner ? owner.id : null
  }

  if (sourceType === SOURCE_TYPES.RADAR) {
    if (!sourceKey) return areas.length === 1 ? areas[0].id : null
    const owner = areas.find((area) => area.radars.some((rdr) => rdr.sourceKey === sourceKey))
    return owner ? owner.id : null
  }

  if (sourceType === SOURCE_TYPES.SYSTEM) {
    return areas.length === 1 ? areas[0].id : null
  }

  return null
}

/** The single declared radar of an area, or null. */
export function radarIdForArea(areas, areaId) {
  const area = findArea(areas, areaId)
  if (!area || !area.radars.length) return null
  return area.radars[0].id
}

/** True when the deployment is the single-area live topology. */
export function isSingleAreaDeployment(areas) {
  return Array.isArray(areas) && areas.length === 1 &&
    areas[0].deploymentMode === DEPLOYMENT_MODES.SINGLE_AREA
}
