import { useLocation } from 'react-router-dom'
import { demoOptionsFromLocation } from '../../design-lab/shared/useAtapisData'
import { ABOUT } from './aboutContent'

export function useAboutViewModel() {
  const location = useLocation()
  return { about: ABOUT, demo: demoOptionsFromLocation(location.search) }
}
