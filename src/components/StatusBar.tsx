import type { FactionId } from '../game/types'

type StatusBarProps = {
  turn: number
  resource: number
  activeFactionId: FactionId
  humanFactionId: FactionId
  disabled: boolean
  onEndTurn: () => void
}

export function StatusBar({
  turn,
  resource,
  activeFactionId,
  humanFactionId,
  disabled,
  onEndTurn,
}: StatusBarProps) {
  const factionLabels: Record<string, string> = {
    player: '푸른 연맹',
    enemy: '붉은 제국',
    f1: '청색 연맹',
    f2: '적색 제국',
    f3: '황금 왕국',
    f4: '자색 공국',
  }
  const factionLabel = factionLabels[activeFactionId] ?? activeFactionId

  return (
    <section className="status-bar" aria-label="현재 게임 상태">
      <div className="status-bar__summary">
        <span>
          턴 <strong>{turn}</strong>
        </span>
        <span className="status-bar__dot" aria-hidden="true">
          ·
        </span>
        <span
          className={`faction-name faction-name--${activeFactionId}`}
          aria-live="polite"
        >
          {factionLabel}
        </span>
        <span className="status-bar__dot" aria-hidden="true">
          ·
        </span>
        <span>
          자원 <strong>{resource}</strong>
        </span>
      </div>
      <button
        className="end-turn-button"
        type="button"
        disabled={disabled}
        onClick={onEndTurn}
      >
        {activeFactionId !== humanFactionId ? (
          <>
            AI 작전 중…
            <span aria-hidden="true">◆</span>
          </>
        ) : (
          <>
            턴 종료
            <kbd aria-hidden="true">Enter</kbd>
          </>
        )}
      </button>
    </section>
  )
}
