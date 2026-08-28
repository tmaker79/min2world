import { useEffect, useId, useRef } from 'react'
import type { GameMode } from '../game/types'

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
        <h2 id={titleId}>첫 턴 안내</h2>
        <p id={descriptionId} className="first-turn-guide__description">
          세 가지만 기억하고 전투를 시작하세요.
        </p>

        <ol className="first-turn-guide__steps">
          <li>
            <span aria-hidden="true">1</span>
            <div>
              <strong>부대 선택</strong>
              <p>지도에서 아군 유닛을 선택하세요.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              <strong>이동·공격</strong>
              <p>금색 칸은 우클릭으로 이동하고 붉은 대상은 좌클릭해 공격합니다.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              <strong>{gameMode === 'quick' ? '병력 생산·승리' : '확장·승리'}</strong>
              <p>
                {gameMode === 'quick'
                  ? '도시에서 병력을 생산하고 상대 수도를 점령하세요.'
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
            자세히 보기
          </button>
          <button
            ref={startButtonRef}
            type="button"
            className="first-turn-guide__button first-turn-guide__button--start"
            onClick={onDismiss}
          >
            게임 시작
          </button>
        </div>
      </section>
    </div>
  )
}
