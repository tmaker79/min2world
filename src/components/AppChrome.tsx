import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { GameMode } from '../game/types'
import { useLocalization, type Locale } from '../i18n/locale'

export type ChromeMenuId = 'save' | 'help'

type AppChromeProps = {
  gameMode: GameMode
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  openMenu: ChromeMenuId | null
  onOpenMenuChange: (menu: ChromeMenuId | null) => void
  onRandomRestart: () => void
  savePanel: ReactNode
  helpPanel: ReactNode
}

export function AppChrome({
  gameMode,
  locale,
  onLocaleChange,
  openMenu,
  onOpenMenuChange,
  onRandomRestart,
  savePanel,
  helpPanel,
}: AppChromeProps) {
  const { t } = useLocalization()
  const metaRef = useRef<HTMLDivElement>(null)
  const saveId = useId()
  const helpId = useId()
  const languageId = useId()
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)

  const toggleMenu = (menu: ChromeMenuId) => {
    setLanguageMenuOpen(false)
    onOpenMenuChange(openMenu === menu ? null : menu)
  }

  useEffect(() => {
    if (!openMenu && !languageMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!metaRef.current?.contains(event.target as Node)) {
        onOpenMenuChange(null)
        setLanguageMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenMenuChange(null)
        setLanguageMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [languageMenuOpen, openMenu, onOpenMenuChange])

  return (
    <header className="app-chrome">
      <div className="app-chrome__brand">
        <h1>min2world</h1>
      </div>

      <div className="app-chrome__meta" ref={metaRef}>
        <div className="chrome-menu">
          <button
            type="button"
            className="app-chrome__button"
            aria-label={t('restart')}
            title={t('restart')}
            onClick={() => {
              onOpenMenuChange(null)
              setLanguageMenuOpen(false)
              onRandomRestart()
            }}
          >
            <svg
              className="app-chrome__icon app-chrome__icon--restart"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 3v5h5" />
              <path d="M3.7 15a9 9 0 1 0 .9-8.6L3 8" />
            </svg>
          </button>
        </div>

        <div className="chrome-menu">
          <button
            type="button"
            className="app-chrome__button"
            aria-label={t('save')}
            title={t('save')}
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
            aria-label={t('help')}
            title={t('help')}
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

        {gameMode === 'quick' && (
          <div className="chrome-menu language-menu">
            <button
              type="button"
              className="app-chrome__button"
              aria-label={t('language')}
              title={t('language')}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              aria-controls={languageId}
              onClick={() => {
                onOpenMenuChange(null)
                setLanguageMenuOpen((open) => !open)
              }}
            >
              <svg
                className="app-chrome__icon app-chrome__icon--language"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
            </button>
            {languageMenuOpen && (
              <div
                id={languageId}
                className="chrome-menu__panel language-menu__panel"
                role="menu"
                aria-label={t('language')}
              >
                {([
                  ['ko', '한국어'],
                  ['en', 'English'],
                ] as const).map(([option, label]) => (
                  <button
                    key={option}
                    type="button"
                    className="language-menu__option"
                    role="menuitemradio"
                    aria-checked={locale === option}
                    onClick={() => {
                      onLocaleChange(option)
                      setLanguageMenuOpen(false)
                    }}
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
