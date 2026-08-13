type VictoryPanelProps = {
  turn: number
  onRestart: () => void
}

export function VictoryPanel({ turn, onRestart }: VictoryPanelProps) {
  return (
    <div
      className="victory-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-heading"
    >
      <section className="victory-panel">
        <p className="eyebrow">CAMPAIGN COMPLETE</p>
        <span className="victory-emblem" aria-hidden="true">
          ◆
        </span>
        <h2 id="victory-heading">대륙 통일</h2>
        <p>푸른 연맹이 모든 도시를 점령했습니다.</p>
        <strong>{turn}턴 만에 승리</strong>
        <button type="button" onClick={onRestart} autoFocus>
          새 게임
        </button>
      </section>
    </div>
  )
}
