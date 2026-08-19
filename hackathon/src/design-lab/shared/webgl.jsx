import { Component, Suspense } from 'react'
import { webglAvailable } from './webgl-probe'

// Shared WebGL error boundary + guarded 3D host.
//
// IMPORTANT: this module must never import the three.js Scene. Each view keeps
// its own `lazy(() => import('.../Scene'))` so the three.js chunk stays out of
// the common bundle — scripts/phase-h-qa.mjs asserts the chunk is ABSENT on
// /concepts/*/settings and PRESENT on /concepts/fusion-prime/dashboard.

export class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// Renders `children` (a lazy 3D element) behind both guards, or `fallback` when
// WebGL is missing / the scene throws. Passing `enabled={false}` skips the 3D
// path entirely — the lazy element is constructed but never rendered, so the
// chunk is not fetched.
export function Scene3D({ enabled = true, fallback = null, loading = null, children }) {
  if (!enabled || !webglAvailable()) return fallback
  return (
    <SceneErrorBoundary fallback={fallback}>
      <Suspense fallback={loading}>{children}</Suspense>
    </SceneErrorBoundary>
  )
}
