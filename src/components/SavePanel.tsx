import type { SavedGame, StorageResult } from '../storage/saveGame'

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

function formatSavedAt(savedAt: string) {
  return new Intl.DateTimeFormat('ko-KR', {
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
  const slotError =
    !slot.ok && slot.code !== 'notFound' ? slot.message : undefined

  return (
    <section className="save-card" aria-labelledby="save-heading">
      <p className="eyebrow">LOCAL SAVE</p>
      <h2 id="save-heading">저장 관리</h2>

      <div className="save-card__summary">
        {slot.ok ? (
          <>
            <strong>{slot.value.gameState.turn}턴 저장</strong>
            <span>{formatSavedAt(slot.value.savedAt)}</span>
          </>
        ) : (
          <span>
            {slot.code === 'notFound' ? '저장된 게임 없음' : '저장 확인 필요'}
          </span>
        )}
      </div>

      <div className="save-card__actions">
        <button type="button" disabled={!canSave} onClick={onSave}>
          저장
        </button>
        <button type="button" disabled={!canLoad} onClick={onLoad}>
          불러오기
        </button>
        <button
          className="save-card__delete"
          type="button"
          disabled={!canDelete}
          onClick={onDelete}
        >
          삭제
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
          기존 전체모드 저장은 보존되어 있지만 빠른대전에서는 불러올 수 없습니다.
        </p>
      )}
    </section>
  )
}
