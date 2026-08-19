import { useContext } from 'react'
import { DensityContext } from './density-context'

export function useDensity() {
  return useContext(DensityContext)
}
