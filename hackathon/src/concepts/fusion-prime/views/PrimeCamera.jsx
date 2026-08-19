import { useCallback, useEffect, useRef, useState } from 'react'
import { useConcept } from '../../useConcept'
import { CameraFeed } from '../../../design-lab/shared/CameraFeed'
import { TargetsTable } from '../../domain/TargetsTable'
import { TracksTable } from '../../domain/TracksTable'
import { OpenAlerts } from '../../domain/OpenAlerts'
import { WhyThisRisk } from '../../domain/WhyThisRisk'
import { ContactPairCard } from '../../domain/ContactPairCard'
import { DemoModeBadge } from '../../domain/DemoModeBadge'

// Fullscreen is not universally available (older browsers, iframe permission
// policies), and the request can be rejected after being called, so support is
// probed and rejection is surfaced rather than assumed.
function useFullscreen(ref) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const supported = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled)

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [ref])

  const toggle = useCallback(async () => {
    const node = ref.current
    if (!node || !supported) return false
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await node.requestFullscreen()
      return true
    } catch {
      return false
    }
  }, [ref, supported])

  return { supported, isFullscreen, toggle }
}

// Prime optics: Minimal's maximized feed, an evidence strip of session alerts,
// and Industrial-style tables below. Selecting a target opens its focus card
// in the side rail (matrix: selection "בטבלה+תאום" — table here, twin on dashboard).
export default function PrimeCamera({ vm }) {
  const { t } = useConcept()
  const feedRef = useRef(null)
  const fullscreen = useFullscreen(feedRef)
  const [feedNotice, setFeedNotice] = useState(null)

  // Captures the frame currently on screen. A cross-origin stream without CORS
  // headers taints the canvas and throws here — that is reported as unavailable
  // rather than silently producing a blank file. The live stream is untouched
  // either way: this only reads the already-decoded <img>.
  const takeSnapshot = useCallback(() => {
    const img = feedRef.current?.querySelector('img.dl-feed-img')
    if (!img || !img.naturalWidth) {
      setFeedNotice(t('Snapshot unavailable', 'צילום מסך לא זמין'))
      return
    }
    try {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `atapis-${vm.source}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      link.click()
      setFeedNotice(t('Snapshot saved', 'צילום נשמר'))
    } catch {
      setFeedNotice(t('Snapshot unavailable', 'צילום מסך לא זמין'))
    }
  }, [t, vm.source])

  // Falls back to the leading candidate so the rail states the current contact
  // instead of waiting for a click to say anything at all.
  const contactPair = vm.selectedPair || vm.candidatePairs?.[0] || null

  const handleFullscreen = useCallback(async () => {
    const ok = await fullscreen.toggle()
    if (!ok) setFeedNotice(t('Full screen unavailable', 'מסך מלא לא זמין'))
  }, [fullscreen, t])

  return (
    <div className="pp-page pp-camera">
      <header className="pp-head">
        <div>
          <DemoModeBadge when={vm.isDemo} />
          <p className="pp-eyebrow" dir="ltr">OPTICS · ROOM {vm.roomId}</p>
          <h1 className="pp-title">{t('Optics station', 'עמדת האופטיקה')}</h1>
        </div>
        <div className="pp-source-tabs" dir="ltr">
          {['webcam', 'dahua'].map((name) => (
            <button
              key={name}
              type="button"
              className={vm.source === name ? 'is-active' : ''}
              onClick={() => vm.setSource(name)}
            >
              {name === 'webcam' ? 'LOCAL' : 'DAHUA'}
            </button>
          ))}
        </div>
      </header>

      <div className="pp-camera-layout">
        <div className="pp-camera-main">
          <div className="pp-card pp-feed-large">
            <div className="pp-feed-tools">
              <span className="pp-muted" dir="ltr">
                {vm.source === 'webcam' ? 'CAM-01 · LOCAL' : 'CAM-02 · DAHUA'}
              </span>
              <div className="pp-feed-actions">
                {feedNotice ? <span className="pp-feed-notice" role="status">{feedNotice}</span> : null}
                <button type="button" className="dm-btn" onClick={takeSnapshot}>
                  {t('Snapshot', 'צילום')}
                </button>
                {fullscreen.supported ? (
                  <button type="button" className="dm-btn" onClick={handleFullscreen}>
                    {fullscreen.isFullscreen ? t('Exit full screen', 'יציאה ממסך מלא') : t('Full screen', 'מסך מלא')}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="pp-feed-frame" ref={feedRef}>
              <CameraFeed
                source={vm.source}
                active
                cameraStatus={vm.camera}
                isDemo={vm.isDemo}
                enableSnapshotCapture
              />
            </div>
          </div>

          <section className="pp-card pp-evidence-strip" aria-label={t('Session evidence', 'ראיות הסשן')}>
            <h2 className="dm-subtitle">{t('Session alerts', 'התראות הסשן')}</h2>
            <OpenAlerts alerts={vm.alerts} limit={4} variant="compact" />
          </section>
        </div>

        <aside className="pp-camera-rail">
          <section className="pp-card" aria-label={t('Selected contact', 'מגע נבחר')}>
            <div className="pp-card-head">
              <h2 className="dm-subtitle">
                {vm.selectedPair ? t('Selected contact', 'מגע נבחר') : t('Current contact', 'מגע נוכחי')}
              </h2>
              {vm.selectedPair ? (
                <button type="button" className="dm-btn" onClick={() => vm.setSelectedTargetId(null)}>
                  {t('Clear selection', 'ניקוי בחירה')}
                </button>
              ) : null}
            </div>
            {contactPair ? (
              <>
                <ContactPairCard pair={contactPair} />
                {!vm.selectedPair ? (
                  <p className="pp-muted pp-rail-hint">
                    {t('Select a radar target below to inspect a different contact.', 'בחר מטרת רדאר למטה כדי לבחון מגע אחר.')}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="dm-empty">{t('No active contacts.', 'אין מגעים פעילים.')}</p>
            )}
          </section>

          <section className="pp-card" aria-label={t('Why this risk', 'למה הסיכון')}>
            <h2 className="dm-subtitle">{t('Why this risk?', 'למה הסיכון הזה?')}</h2>
            <WhyThisRisk reasons={vm.reasons} contributions={null} />
          </section>
        </aside>
      </div>

      <div className="pp-camera-tables">
        <section className="pp-card" aria-label={t('Radar targets', 'מטרות רדאר')}>
          <h2 className="dm-subtitle">{t('Radar targets', 'מטרות רדאר')}</h2>
          <TargetsTable
            radar={vm.snapshot.radar}
            selectedId={vm.selectedTargetId}
            onSelect={(id) => vm.setSelectedTargetId(vm.selectedTargetId === id ? null : id)}
            variant="table"
          />
        </section>
        <section className="pp-card" aria-label={t('Tracked persons', 'אנשים במעקב')}>
          <h2 className="dm-subtitle">{t('Tracked persons', 'אנשים במעקב')}</h2>
          <TracksTable snapshot={vm.snapshot} />
        </section>
      </div>
    </div>
  )
}
