import type { GamePhase } from '../game/types'
import { useLocalization } from '../i18n/locale'

type GameResultPanelProps = {
  phase: Exclude<GamePhase, 'playing'>
  turn: number
  onRestart: () => void
  onRandomRestart: () => void
}

export function GameResultPanel({
  phase,
  turn,
  onRestart,
  onRandomRestart,
}: GameResultPanelProps) {
  const { t } = useLocalization()
  const content = phase === 'victory'
    ? { eyebrow: 'CAMPAIGN COMPLETE', heading: t('victoryHeading'), description: t('victoryDescription'), summary: t('victory') }
    : { eyebrow: 'CAMPAIGN LOST', heading: t('defeatHeading'), description: t('defeatDescription'), summary: t('defeat') }

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
          {t('resultTurns', { turn, result: content.summary })}
        </strong>
        <div className="result-panel__actions">
          <button type="button" onClick={onRestart} autoFocus>
            {t('restartSame')}
          </button>
          <button type="button" onClick={onRandomRestart}>
            {t('restartNew')}
          </button>
        </div>
      </section>
    </div>
  )
}
