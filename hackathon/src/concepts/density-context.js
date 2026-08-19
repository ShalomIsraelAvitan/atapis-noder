import { createContext } from 'react'

// Display-density context for the /concepts environment. Component-free so
// React Fast Refresh stays happy (same split as concept-context.js).
export const DENSITY_MODES = ['comfort', 'compact', 'presentation']
export const DENSITY_KEY = 'atapis-concepts-density'

// Per-concept default: Industrial is a dense, professional-operator surface, so
// it defaults to compact; the rest default to comfort. Keys are ROUTE ids.
export const CONCEPT_DEFAULT_DENSITY = {
  minimal: 'comfort',
  sentinel: 'comfort',
  industrial: 'compact',
  neural: 'comfort',
  'fusion-prime': 'comfort',
}

export const DensityContext = createContext({
  density: 'comfort',
  setDensity: () => {},
  isDefault: true,
})
