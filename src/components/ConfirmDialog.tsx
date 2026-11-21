import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { useLocalization } from '../i18n/locale'

type ConfirmDialogProps = {
  title: string
  description: ReactNode
  confirmLabel: string
  returnFocusTo?: HTMLElement | null
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  returnFocusTo,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useLocalization()
  const titleId = useId()
  const descriptionId = useId()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    const previouslyFocused = returnFocusTo ?? (document.activeElement as HTMLElement | null)
    cancelButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
        return
      }

      if (event.key !== 'Tab') return

      if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
        event.preventDefault()
        confirmButtonRef.current?.focus()
      } else if (
        !event.shiftKey &&
        document.activeElement === confirmButtonRef.current
      ) {
        event.preventDefault()
        cancelButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus({ preventScroll: true })
    }
  }, [returnFocusTo])

  return (
    <div
      className="confirm-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{title}</h2>
        <div id={descriptionId} className="confirm-dialog__description">
          {description}
        </div>
        <div className="confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-dialog__button confirm-dialog__button--cancel"
            onClick={onCancel}
          >
            {t('cancel')}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className="confirm-dialog__button confirm-dialog__button--confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
