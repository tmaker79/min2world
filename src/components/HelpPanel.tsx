import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { GameMode } from '../game/types'
import { Legend } from './Legend'
import { useLocalization } from '../i18n/locale'

const HELP_TABS = [
  { id: 'controls', labelKey: 'controls' },
  { id: 'rules', labelKey: 'rules' },
  { id: 'legend', labelKey: 'legend' },
  { id: 'credits', labelKey: 'credits' },
] as const

type HelpTabId = (typeof HELP_TABS)[number]['id']

type HelpPanelProps = {
  gameMode: GameMode
}

export function HelpPanel({ gameMode }: HelpPanelProps) {
  const { t } = useLocalization()
  const [activeTab, setActiveTab] = useState<HelpTabId>('controls')
  const headingId = useId()
  const tabIdPrefix = useId()
  const panelIdPrefix = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const activateTab = (index: number) => {
    const tab = HELP_TABS[index]
    if (!tab) return
    setActiveTab(tab.id)
    tabRefs.current[index]?.focus()
  }

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % HELP_TABS.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + HELP_TABS.length) % HELP_TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = HELP_TABS.length - 1
    }

    if (nextIndex === undefined) return
    event.preventDefault()
    activateTab(nextIndex)
  }

  const activeIndex = HELP_TABS.findIndex((tab) => tab.id === activeTab)
  const activeTabId = `${tabIdPrefix}-${activeTab}`
  const activePanelId = `${panelIdPrefix}-${activeTab}`

  return (
    <section className="help-card" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('help')}</h2>
      <div className="help-card__tabs" role="tablist" aria-label={t('helpItems')}>
        {HELP_TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            id={`${tabIdPrefix}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${panelIdPrefix}-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div
        id={activePanelId}
        className={`help-card__panel help-card__panel--${activeTab}`}
        role="tabpanel"
        aria-labelledby={activeTabId}
        tabIndex={0}
      >
        {activeIndex === 0 && (
          <div className="help-card__guide">
            <section className="help-card__section">
              <h3>{t('basicControls')}</h3>
              <ul>
                <li>{t('controlSelect')}</li>
                <li>{t('controlMoveAttack')}</li>
              </ul>
            </section>
            <section className="help-card__section">
              <h3>{t('shortcuts')}</h3>
              <ul>
                <li><kbd>Enter</kbd> {t('shortcutEnd')}</li>
                <li><kbd>Esc</kbd> {t('shortcutCancel')}</li>
              </ul>
            </section>
          </div>
        )}

        {activeIndex === 1 && (
          <div className="help-card__guide">
            <section className="help-card__section">
              <h3>{t('productionEconomy')}</h3>
              <ul>
                {gameMode === 'quick' ? (
                  <>
                    <li>{t('quickProduce')}</li>
                    <li>{t('quickCaptureIncome')}</li>
                  </>
                ) : (
                  <>
                    <li>
                      도시에서 군사·민간 유닛을 생산하고 청록색 칸에
                      배치하세요.
                    </li>
                    <li>
                      개척자는 마을을 정착하고 건설자는 거점을 건설합니다.
                      거점 발전과 도시 건설로 세력을 강화하세요.
                    </li>
                  </>
                )}
                <li>{t('economyHelp')}</li>
              </ul>
            </section>
            <section className="help-card__section">
              <h3>{t('victoryConditions')}</h3>
              <ul>
                <li>{t('captureCapital')}</li>
                <li>{t('loseCapital')}</li>
              </ul>
            </section>
          </div>
        )}

        {activeIndex === 2 && <Legend embedded gameMode={gameMode} />}

        {activeIndex === 3 && (
          <div className="help-card__guide">
            <section className="help-card__section">
              <h3>{t('terrainTiles')}</h3>
              <p>
                {t('creditsBased')}{' '}
                <a
                  href="https://cmartins.itch.io/hex-tiles-fantasy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Hex Tiles: Fantasy
                </a>{' '}
                by{' '}
                <a
                  href="https://cmartins.itch.io/"
                  target="_blank"
                  rel="noreferrer"
                >
                  cmartins.art
                </a>
              </p>
              <p>
                {t('creditsLicense')}{' '}
                <a
                  href="https://creativecommons.org/licenses/by-sa/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY-SA 4.0
                </a>
              </p>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
