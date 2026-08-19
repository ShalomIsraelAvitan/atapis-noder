import { useCallback, useMemo, useState } from 'react'
import { LabContext } from './lab-context'

// Technical values (coordinates, units, IDs) are always rendered LTR via
// dir="ltr" spans regardless of the UI language.
const STORAGE_KEY = 'atapis-design-lab-lang'

export function LabProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'he' ? 'he' : 'en'
    } catch {
      return 'en'
    }
  })

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'en' ? 'he' : 'en'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // localStorage unavailable — keep in-memory only
      }
      return next
    })
  }, [])

  const value = useMemo(() => {
    // t('English label', 'תווית בעברית') — falls back to English.
    const t = (en, he) => (lang === 'he' && he ? he : en)
    return { lang, dir: lang === 'he' ? 'rtl' : 'ltr', t, toggleLang }
  }, [lang, toggleLang])

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}
