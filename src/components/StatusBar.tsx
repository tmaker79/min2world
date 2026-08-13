import type { FactionId } from '../game/types'

type StatusBarProps = {
  turn: number
  resource: number
  activeFactionId: FactionId
  disabled: boolean
  onEndTurn: () => void
}

export function StatusBar({
  turn,
  resource,
  activeFactionId,
  disabled,
  onEndTurn,
}: StatusBarProps) {
  return (
    <section className="status-bar" aria-label="현재 게임 상태">
      <div className="status-item">
        <span className="status-item__label">현재 턴</span>
        <strong>{turn}</strong>
      </div>
      <div className="status-separator" aria-hidden="true" />
      <div className="status-item">
        <span className="status-item__label">활성 세력</span>
        <strong
          className={`faction-name faction-name--${activeFactionId}`}
          aria-live="polite"
        >
          {activeFactionId === 'player' ? '푸른 연맹' : '붉은 제국'}
        </strong>
      </div>
      <div className="status-separator" aria-hidden="true" />
      <div className="status-item">
        <span className="status-item__label">보유 자원</span>
        <strong>{resource}</strong>
      </div>
      <button
        className="end-turn-button"
        type="button"
        disabled={disabled}
        onClick={onEndTurn}
      >
        {activeFactionId === 'enemy' ? (
          <>
            AI 작전 중…
            <span aria-hidden="true">◆</span>
          </>
        ) : (
          <>
            턴 종료
            <kbd aria-hidden="true">Enter</kbd>
            <span aria-hidden="true">→</span>
          </>
        )}
      </button>
    </section>
  )
}
