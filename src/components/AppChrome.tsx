import { useEffect, useId, useRef, type ReactNode } from 'react'
import { RestartMenu } from './RestartMenu'

export type ChromeMenuId = 'restart' | 'save' | 'help'

type AppChromeProps = {
  openMenu: ChromeMenuId | null
  onOpenMenuChange: (menu: ChromeMenuId | null) => void
  onRandomRestart: () => boolean
  savePanel: ReactNode
  helpPanel: ReactNode
}

export function AppChrome({
  openMenu,
  onOpenMenuChange,
  onRandomRestart,
  savePanel,
  helpPanel,
}: AppChromeProps) {
  const metaRef = useRef<HTMLDivElement>(null)
  const saveId = useId()
  const helpId = useId()

  const toggleMenu = (menu: ChromeMenuId) => {
    onOpenMenuChange(openMenu === menu ? null : menu)
  }

  useEffect(() => {
    if (!openMenu) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!metaRef.current?.contains(event.target as Node)) {
        onOpenMenuChange(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenMenuChange(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu, onOpenMenuChange])

  return (
    <header className="app-chrome">
      <div className="app-chrome__brand">
        <h1>min2world</h1>
      </div>

      <div className="app-chrome__meta" ref={metaRef}>
        <RestartMenu
          open={openMenu === 'restart'}
          onToggle={() => toggleMenu('restart')}
          onClose={() => onOpenMenuChange(null)}
          onRandomRestart={onRandomRestart}
        />

        <div className="chrome-menu">
          <button
            type="button"
            className="app-chrome__button"
            aria-label="저장"
            title="저장"
            aria-expanded={openMenu === 'save'}
            aria-controls={saveId}
            onClick={() => toggleMenu('save')}
          >
            <svg
              className="app-chrome__icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M5 3h12l4 4v14H3V5a2 2 0 0 1 2-2Z" />
              <path d="M7 3v6h10V3M7 21v-8h10v8" />
            </svg>
          </button>
          {openMenu === 'save' && (
            <div id={saveId} className="chrome-menu__panel">
              {savePanel}
            </div>
          )}
        </div>

        <div className="chrome-menu">
          <button
            type="button"
            className="app-chrome__button"
            aria-label="도움말"
            title="도움말"
            aria-expanded={openMenu === 'help'}
            aria-controls={helpId}
            onClick={() => toggleMenu('help')}
          >
            <svg
              className="app-chrome__icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M9.6 9a2.6 2.6 0 1 1 3.7 2.35C12.4 11.8 12 12.4 12 13.4" />
              <path d="M12 17h.01" />
            </svg>
          </button>
          {openMenu === 'help' && (
            <div
              id={helpId}
              className="chrome-menu__panel chrome-menu__panel--wide chrome-menu__panel--help"
            >
              {helpPanel}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
