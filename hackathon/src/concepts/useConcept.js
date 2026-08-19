import { useContext } from 'react'
import { ConceptContext } from './concept-context'

export function useConcept() {
  const ctx = useContext(ConceptContext)
  if (!ctx) throw new Error('useConcept must be used inside a ConceptProvider')
  return ctx
}
