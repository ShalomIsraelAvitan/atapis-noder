import { useCallback, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  DensityContext,
  DENSITY_KEY,
  DENSITY_MODES,
  CONCEPT_DEFAULT_DENSITY,
} from './density-context'

// Resolution order: ?density= override → localStorage → per-concept default.
function resolveInitial(conceptId, search) {
  const fromQuery = new URLSearchParams(search).get('density')
  if (fromQuery && DENSITY_MODES.includes(fromQuery)) return { value: fromQuery, isDefault: false }
  try {
    const stored = localStorage.getItem(DENSITY_KEY)
    if (stored && DENSITY_MODES.includes(stored)) return { value: stored, isDefault: false }
  } catch {
    // storage unavailable
  }
  return { value: CONCEPT_DEFAULT_DENSITY[conceptId] || 'comfort', isDefault: true }
}

// Provides the active density mode. The mode is applied by each shell as a
// `data-density` attribute on its scope div; concepts-base.css redeclares the
// spacing/type CSS variables per attribute value, so no rule needs rewriting.
export function DensityProvider({ conceptId, children }) {
  const location = useLocation()
  const [state, setState] = useState(() => resolveInitial(conceptId, location.search))

  const setDensity = useCallback((mode) => {
    if (!DENSITY_MODES.includes(mode)) return
    try {
      localStorage.setItem(DENSITY_KEY, mode)
    } catch {
      // in-memory only
    }
    setState({ value: mode, isDefault: false })
  }, [])

  const value = useMemo(
    () => ({ density: state.value, setDensity, isDefault: state.isDefault }),
    [state, setDensity]
  )

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
}
