import { useCallback, useState } from 'react'
import { API_BASE, fetchJson } from '../../../design-lab/shared/api'
import { useConcept } from '../../useConcept'

// User-triggered probes against endpoints that already exist. Each button is
// named for what its endpoint actually does:
//
//   /api/radar/live      reads the current radar state  -> "Check live radar data"
//   /api/cameras/status  reads current camera state     -> "Check camera status"
//   /api/cameras/dahua/test  opens RTSP and reads a frame -> "Test Dahua connection"
//
// Only the last one performs a real connection attempt, so only it is called a
// test. Nothing runs on mount: a probe that opens a camera stream should happen
// because an operator asked for it.
export function ConnectionChecks({ className = '' }) {
  const { t } = useConcept()
  const [results, setResults] = useState({})
  const [busy, setBusy] = useState(null)

  const run = useCallback(async (id, url, summarize) => {
    setBusy(id)
    try {
      const data = await fetchJson(url)
      setResults((prev) => ({ ...prev, [id]: summarize(data) }))
    } catch (err) {
      setResults((prev) => ({ ...prev, [id]: { ok: false, text: err.message } }))
    } finally {
      setBusy(null)
    }
  }, [])

  const checks = [
    {
      id: 'radar',
      label: t('Check live radar data', 'בדיקת נתוני רדאר חיים'),
      run: () =>
        run('radar', `${API_BASE}/api/radar/live`, (data) => ({
          ok: Boolean(data?.radar_connected),
          text: [
            `status ${data?.radar_status || '—'}`,
            `provider ${data?.provider || '—'}`,
            `targets ${Array.isArray(data?.targets) ? data.targets.length : 0}`,
            data?.last_error ? `error: ${data.last_error}` : null,
          ].filter(Boolean).join(' · '),
        })),
    },
    {
      id: 'cameras',
      label: t('Check camera status', 'בדיקת מצב מצלמות'),
      run: () =>
        run('cameras', `${API_BASE}/api/cameras/status`, (data) => {
          const sources = ['webcam', 'dahua']
            .map((name) => `${name}: ${data?.[name]?.connected ? 'connected' : (data?.[name]?.status || 'unavailable')}`)
          return { ok: sources.some((s) => s.includes('connected')), text: sources.join(' · ') }
        }),
    },
    {
      id: 'dahua',
      label: t('Test Dahua connection', 'בדיקת חיבור Dahua'),
      run: () =>
        run('dahua', `${API_BASE}/api/cameras/dahua/test`, (data) => ({
          ok: Boolean(data?.success && data?.frame_read),
          text: data?.success
            ? t('RTSP opened, frame read.', 'ה־RTSP נפתח, נקרא פריים.')
            : data?.sanitized_error || data?.message || t('Connection failed.', 'החיבור נכשל.'),
        })),
    },
  ]

  return (
    <div className={`pp-conncheck ${className}`}>
      <p className="pp-checks-note">
        {t(
          'Each check queries the backend when you press it. Nothing runs on its own.',
          'כל בדיקה פונה לשרת בעת הלחיצה. שום דבר אינו רץ מעצמו.'
        )}
      </p>
      <ul className="pp-checks-list">
        {checks.map((check) => {
          const result = results[check.id]
          return (
            <li key={check.id} className="pp-conncheck-row">
              <button type="button" className="dm-btn" disabled={busy !== null} onClick={check.run}>
                {busy === check.id ? t('Checking…', 'בודק…') : check.label}
              </button>
              {result ? (
                <span className={`pp-conncheck-result ${result.ok ? 'is-ok' : 'is-err'}`} dir="ltr" role="status">
                  {result.text}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
