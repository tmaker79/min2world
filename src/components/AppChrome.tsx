import { useEffect, useId, useRef, type ReactNode } from 'react'
import { NewGameMenu } from './NewGameMenu'

export type ChromeMenuId = 'newGame' | 'save' | 'help'

type AppChromeProps = {
  mapSeed: string
  openMenu: ChromeMenuId | null
  onOpenMenuChange: (menu: ChromeMenuId | null) => void
  seedInput: string
  seedFeedback?: string
  onSeedInputChange: (value: string) => void
  onSeedSubmit: () => boolean
  onRandomRestart: () => boolean
  savePanel: ReactNode
  helpPanel: ReactNode
}

export function AppChrome({
  mapSeed,
  openMenu,
  onOpenMenuChange,
  seedInput,
  seedFeedback,
  onSeedInputChange,
  onSeedSubmit,
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
        <output className="app-chrome__seed" aria-label="현재 seed">
          seed {mapSeed}
        </output>
        <NewGameMenu
          open={openMenu === 'newGame'}
          onToggle={() => toggleMenu('newGame')}
          onClose={() => onOpenMenuChange(null)}
          seedInput={seedInput}
          seedFeedback={seedFeedback}
          onSeedInputChange={onSeedInputChange}
          onSeedSubmit={onSeedSubmit}
          onRandomRestart={onRandomRestart}
        />

        <div className="chrome-menu">
          <button
            type="button"
            className="app-chrome__button"
            aria-expanded={openMenu === 'save'}
            aria-controls={saveId}
            onClick={() => toggleMenu('save')}
          >
            저장
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
            aria-expanded={openMenu === 'help'}
            aria-controls={helpId}
            onClick={() => toggleMenu('help')}
          >
            도움말
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
