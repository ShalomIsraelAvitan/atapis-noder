// WebGL capability probe. Kept in its own module (no components) so the
// component file can satisfy react-refresh/only-export-components.

let probed = null

// Memoized per session: creating a throwaway canvas on every render is wasteful,
// and the answer cannot change without a page reload.
export function webglAvailable() {
  if (probed !== null) return probed
  try {
    const canvas = document.createElement('canvas')
    probed = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    probed = false
  }
  return probed
}
