import { useId } from 'react'

type NewGameMenuProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
  seedInput: string
  seedFeedback?: string
  onSeedInputChange: (value: string) => void
  onSeedSubmit: () => boolean
  onRandomRestart: () => boolean
}

export function NewGameMenu({
  open,
  onToggle,
  onClose,
  seedInput,
  seedFeedback,
  onSeedInputChange,
  onSeedSubmit,
  onRandomRestart,
}: NewGameMenuProps) {
  const menuId = useId()

  return (
    <div className="chrome-menu new-game-menu">
      <button
        type="button"
        className="app-chrome__button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={onToggle}
      >
        새 게임
      </button>
      {open && (
        <form
          id={menuId}
          className="chrome-menu__panel seed-controls"
          onSubmit={(event) => {
            event.preventDefault()
            if (onSeedSubmit()) {
              onClose()
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
                  onClose()
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
