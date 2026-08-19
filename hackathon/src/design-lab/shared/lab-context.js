import { createContext } from 'react'

// Language / direction context for the Design Lab only.
// (Context object lives in its own module so component files export
// components exclusively — keeps react-refresh happy.)
export const LabContext = createContext({
  lang: 'en',
  dir: 'ltr',
  t: (en) => en,
  toggleLang: () => {},
})
