import type { GamePhase } from '../game/types'

type GameResultPanelProps = {
  phase: Exclude<GamePhase, 'playing'>
  turn: number
  onRestart: () => void
}

const RESULT_CONTENT = {
  victory: {
    eyebrow: 'CAMPAIGN COMPLETE',
    heading: '대륙 통일',
    description: '푸른 연맹이 모든 도시를 점령했습니다.',
    summary: '승리',
  },
  defeat: {
    eyebrow: 'CAMPAIGN LOST',
    heading: '수도 함락',
    description: '붉은 제국이 모든 도시를 점령했습니다.',
    summary: '패배',
  },
} as const

export function GameResultPanel({
  phase,
  turn,
  onRestart,
}: GameResultPanelProps) {
  const content = RESULT_CONTENT[phase]

  return (
    <div
      className="result-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-heading"
    >
      <section className={`result-panel result-panel--${phase}`}>
        <p className="eyebrow">{content.eyebrow}</p>
        <span className="result-emblem" aria-hidden="true">
          {phase === 'victory' ? '◆' : '◇'}
        </span>
        <h2 id="result-heading">{content.heading}</h2>
        <p>{content.description}</p>
        <strong>
          {turn}턴 만에 {content.summary}
        </strong>
        <button type="button" onClick={onRestart} autoFocus>
          새 게임
        </button>
      </section>
    </div>
  )
}
