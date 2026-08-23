import { useId } from 'react'

type NewGameMenuProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
  onRandomRestart: () => boolean
}

export function NewGameMenu({
  open,
  onToggle,
  onClose,
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
        <div id={menuId} className="chrome-menu__panel new-game-menu__panel">
          <p>현재 게임을 끝내고 새로운 지도를 생성합니다.</p>
          <div className="new-game-menu__actions">
            <button
              type="button"
              onClick={() => {
                if (onRandomRestart()) {
                  onClose()
                }
              }}
            >
              새 지도로 시작
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
