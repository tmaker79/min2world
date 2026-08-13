type StatusBarProps = {
  turn: number
  resource: number
  onEndTurn: () => void
}

export function StatusBar({ turn, resource, onEndTurn }: StatusBarProps) {
  return (
    <section className="status-bar" aria-label="현재 게임 상태">
      <div className="status-item">
        <span className="status-item__label">현재 턴</span>
        <strong>{turn}</strong>
      </div>
      <div className="status-separator" aria-hidden="true" />
      <div className="status-item">
        <span className="status-item__label">활성 세력</span>
        <strong className="faction-name faction-name--player">푸른 연맹</strong>
      </div>
      <div className="status-separator" aria-hidden="true" />
      <div className="status-item">
        <span className="status-item__label">보유 자원</span>
        <strong>{resource}</strong>
      </div>
      <button className="end-turn-button" type="button" onClick={onEndTurn}>
        턴 종료
        <span aria-hidden="true">→</span>
      </button>
    </section>
  )
}

