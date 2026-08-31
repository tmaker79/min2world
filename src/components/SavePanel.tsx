import type { SavedGame, StorageResult } from '../storage/saveGame'
import { useLocalization, type Locale } from '../i18n/locale'

type SaveFeedback = {
  type: 'status' | 'error'
  message: string
}

type SavePanelProps = {
  slot: StorageResult<SavedGame>
  canSave: boolean
  canLoad: boolean
  canDelete: boolean
  hasBlockedLegacySave?: boolean
  feedback?: SaveFeedback
  onSave: () => void
  onLoad: () => void
  onDelete: () => void
}

function formatSavedAt(savedAt: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(savedAt))
}

export function SavePanel({
  slot,
  canSave,
  canLoad,
  canDelete,
  hasBlockedLegacySave = false,
  feedback,
  onSave,
  onLoad,
  onDelete,
}: SavePanelProps) {
  const { locale, t } = useLocalization()
  const slotError = !slot.ok && slot.code !== 'notFound' ? t('saveNeedsCheck') : undefined

  return (
    <section className="save-card" aria-labelledby="save-heading">
      <h2 id="save-heading">{t('saveManagement')}</h2>

      <div className="save-card__summary">
        {slot.ok ? (
          <>
            <strong>{t('savedTurn', { turn: slot.value.gameState.turn })}</strong>
            <span>{formatSavedAt(slot.value.savedAt, locale)}</span>
          </>
        ) : (
          <span>
            {slot.code === 'notFound' ? t('noSavedGame') : t('saveNeedsCheck')}
          </span>
        )}
      </div>

      <div className="save-card__actions">
        <button type="button" disabled={!canSave} onClick={onSave}>
          {t('save')}
        </button>
        <button type="button" disabled={!canLoad} onClick={onLoad}>
          {t('load')}
        </button>
        <button
          className="save-card__delete"
          type="button"
          disabled={!canDelete}
          onClick={onDelete}
        >
          {t('delete')}
        </button>
      </div>

      {feedback?.type === 'status' && (
        <p className="save-card__message" role="status">
          {feedback.message}
        </p>
      )}
      {(feedback?.type === 'error' || slotError) && (
        <p className="save-card__message save-card__message--error" role="alert">
          {feedback?.type === 'error' ? feedback.message : slotError}
        </p>
      )}
      {hasBlockedLegacySave && (
        <p className="save-card__message" role="status">
          {t('legacySaveBlocked')}
        </p>
      )}
    </section>
  )
}
