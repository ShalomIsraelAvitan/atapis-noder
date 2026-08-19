import { useEffect, useRef } from 'react'
import { useConcept } from '../useConcept'

// Accessible confirmation dialog for destructive actions:
// focus trap, Escape to cancel, explicit action naming + impact description.
export function ConfirmDialog({ confirm, onCancel, busy = false }) {
  const { t, lang } = useConcept()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!confirm) return undefined
    const previouslyFocused = document.activeElement
    cancelRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
      if (event.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll('button')
        if (!focusables?.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [confirm, onCancel])

  if (!confirm) return null

  const title = lang === 'he' && confirm.titleHe ? confirm.titleHe : confirm.title
  const body = lang === 'he' && confirm.bodyHe ? confirm.bodyHe : confirm.body
  const confirmLabel = lang === 'he' && confirm.confirmLabelHe ? confirm.confirmLabelHe : confirm.confirmLabel

  return (
    <div className="dm-dialog-backdrop" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dm-dialog-title"
        aria-describedby="dm-dialog-body"
        className={`dm-dialog ${confirm.danger ? 'dm-dialog--danger' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="dm-dialog-title" className="dm-dialog-title">{title}</h2>
        <p id="dm-dialog-body" className="dm-dialog-body">{body}</p>
        <div className="dm-dialog-actions">
          <button ref={cancelRef} type="button" className="dm-dialog-cancel" onClick={onCancel} disabled={busy}>
            {t('Cancel', 'ביטול')}
          </button>
          <button
            type="button"
            className={`dm-dialog-confirm ${confirm.danger ? 'is-danger' : ''}`}
            onClick={confirm.onConfirm}
            disabled={busy}
          >
            {busy ? t('Working…', 'מבצע…') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
