import { createContext } from 'react'

// Context object + storage keys for the /concepts environment.
// Kept component-free so React Fast Refresh stays happy.
export const ConceptContext = createContext(null)

export const LANG_KEY = 'atapis-concepts-lang'
export const LAST_CONCEPT_KEY = 'atapis-concepts-last'
