import { useEffect, useId, useRef, useState } from 'react'

type NewGameMenuProps = {
  seedInput: string
  seedFeedback?: string
  onSeedInputChange: (value: string) => void
  onSeedSubmit: () => boolean
  onRandomRestart: () => boolean
}

export function NewGameMenu({
  seedInput,
  seedFeedback,
  onSeedInputChange,
  onSeedSubmit,
  onRandomRestart,
}: NewGameMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="new-game-menu" ref={rootRef}>
      <button
        type="button"
        className="app-chrome__button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        새 게임
      </button>
      {open && (
        <form
          id={menuId}
          className="new-game-menu__panel seed-controls"
          onSubmit={(event) => {
            event.preventDefault()
            if (onSeedSubmit()) {
              setOpen(false)
            }
          }}
        >
          <label>
            <span>MAP SEED</span>
            <input
              value={seedInput}
              maxLength={64}
              autoFocus
              aria-describedby={seedFeedback ? 'seed-feedback' : undefined}
              onChange={(event) => onSeedInputChange(event.target.value)}
            />
          </label>
          <div className="new-game-menu__actions">
            <button type="submit">seed로 새 게임</button>
            <button
              type="button"
              onClick={() => {
                if (onRandomRestart()) {
                  setOpen(false)
                }
              }}
            >
              무작위 지도
            </button>
          </div>
          {seedFeedback && (
            <span id="seed-feedback" className="new-game-menu__error" role="alert">
              {seedFeedback}
            </span>
          )}
        </form>
      )}
    </div>
  )
}
