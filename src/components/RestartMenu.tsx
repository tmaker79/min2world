import { useId } from 'react'

type RestartMenuProps = {
  open: boolean
  onToggle: () => void
  onClose: () => void
  onRandomRestart: () => boolean
}

export function RestartMenu({
  open,
  onToggle,
  onClose,
  onRandomRestart,
}: RestartMenuProps) {
  const menuId = useId()

  return (
    <div className="chrome-menu restart-menu">
      <button
        type="button"
        className="app-chrome__button"
        aria-label="재시작"
        title="재시작"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={onToggle}
      >
        <svg
          className="app-chrome__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M3 3v5h5" />
          <path d="M3.7 15a9 9 0 1 0 .9-8.6L3 8" />
        </svg>
      </button>
      {open && (
        <div id={menuId} className="chrome-menu__panel restart-menu__panel">
          <p>현재 게임을 끝내고 새 랜덤 지도로 재시작합니다.</p>
          <div className="restart-menu__actions">
            <button
              type="button"
              onClick={() => {
                if (onRandomRestart()) {
                  onClose()
                }
              }}
            >
              새 랜덤 지도로 재시작
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
