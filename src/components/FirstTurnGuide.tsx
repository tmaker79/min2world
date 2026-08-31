import { useEffect, useId, useRef } from 'react'
import type { GameMode } from '../game/types'
import { useLocalization } from '../i18n/locale'

type FirstTurnGuideProps = {
  gameMode: GameMode
  onDismiss: () => void
  onOpenHelp: () => void
}

export function FirstTurnGuide({
  gameMode,
  onDismiss,
  onOpenHelp,
}: FirstTurnGuideProps) {
  const { t } = useLocalization()
  const titleId = useId()
  const descriptionId = useId()
  const detailsButtonRef = useRef<HTMLButtonElement>(null)
  const startButtonRef = useRef<HTMLButtonElement>(null)
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    startButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismissRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const buttons = [detailsButtonRef.current, startButtonRef.current]
      const activeIndex = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      )
      if (activeIndex < 0) return

      const nextIndex = event.shiftKey ? activeIndex - 1 : activeIndex + 1
      if (nextIndex >= 0 && nextIndex < buttons.length) return

      event.preventDefault()
      buttons[event.shiftKey ? buttons.length - 1 : 0]?.focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  return (
    <div
      className="first-turn-guide__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <section
        className="first-turn-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{t('firstTurn')}</h2>
        <p id={descriptionId} className="first-turn-guide__description">
          {t('firstTurnIntro')}
        </p>

        <ol className="first-turn-guide__steps">
          <li>
            <span aria-hidden="true">1</span>
            <div>
              <strong>{t('selectUnit')}</strong>
              <p>{t('selectUnitHelp')}</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              <strong>{t('moveAttack')}</strong>
              <p>{t('moveAttackHelp')}</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              <strong>{gameMode === 'quick' ? t('produceWin') : '확장·승리'}</strong>
              <p>
                {gameMode === 'quick'
                  ? t('produceWinHelp')
                  : '도시에서 생산하고 정착·건설하며 상대 수도를 점령하세요.'}
              </p>
            </div>
          </li>
        </ol>

        <div className="first-turn-guide__actions">
          <button
            ref={detailsButtonRef}
            type="button"
            className="first-turn-guide__button first-turn-guide__button--details"
            onClick={onOpenHelp}
          >
            {t('details')}
          </button>
          <button
            ref={startButtonRef}
            type="button"
            className="first-turn-guide__button first-turn-guide__button--start"
            onClick={onDismiss}
          >
            {t('startGame')}
          </button>
        </div>
      </section>
    </div>
  )
}
