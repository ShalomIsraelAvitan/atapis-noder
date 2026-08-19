import { useContext } from 'react'
import { LabContext } from './lab-context'

export function useLab() {
  return useContext(LabContext)
}
