import { useEffect, useState } from 'react'

/**
 * Whether the tab is currently visible.
 *
 * This exists for one operational reason: every mounted MJPEG <img> costs a full
 * YOLO analysis loop on the backend (issue H4 in CLAUDE.md). A dashboard left
 * open in a background tab must not keep a camera stream — and therefore an
 * inference loop — running for nobody.
 *
 * The consumer unmounts the feed on `false`; it is never merely hidden with CSS,
 * because a hidden <img> still holds the stream open.
 */
export function useDocumentVisible() {
  const [visible, setVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return !document.hidden
  })

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return visible
}
