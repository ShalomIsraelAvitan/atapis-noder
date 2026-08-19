import { useCallback, useMemo, useState } from 'react'
import { ConceptContext, LANG_KEY } from './concept-context'

// Language + concept provider for the /concepts environment ONLY.
// Hebrew (RTL) is the default here per product decision; storage keys are
// separate from the main site and from the legacy Design Lab.
export function ConceptProvider({ concept, children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'he'
    } catch {
      return 'he'
    }
  })

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'he' ? 'en' : 'he'
      try {
        localStorage.setItem(LANG_KEY, next)
      } catch {
        // in-memory only
      }
      return next
    })
  }, [])

  const value = useMemo(() => {
    const t = (en, he) => (lang === 'he' && he ? he : en)
    return { concept, lang, dir: lang === 'he' ? 'rtl' : 'ltr', t, toggleLang }
  }, [concept, lang, toggleLang])

  return <ConceptContext.Provider value={value}>{children}</ConceptContext.Provider>
}
