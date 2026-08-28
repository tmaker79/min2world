import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { GameMode } from '../game/types'
import { Legend } from './Legend'

const HELP_TABS = [
  { id: 'controls', label: '조작' },
  { id: 'rules', label: '규칙' },
  { id: 'legend', label: '범례' },
] as const

type HelpTabId = (typeof HELP_TABS)[number]['id']

type HelpPanelProps = {
  gameMode: GameMode
}

export function HelpPanel({ gameMode }: HelpPanelProps) {
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
      <h2 id={headingId}>게임 도움말</h2>
      <div className="help-card__tabs" role="tablist" aria-label="도움말 항목">
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
            {tab.label}
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
              <h3>기본 조작</h3>
              <ul>
                <li>아군 유닛을 선택한 뒤 이동 또는 공격 명령을 선택하세요.</li>
                <li>
                  금색 칸은 이동 가능 범위이며 우클릭으로 이동합니다. 붉은
                  표시는 공격 가능 대상으로 좌클릭해 공격합니다.
                </li>
              </ul>
            </section>
            <section className="help-card__section">
              <h3>단축키</h3>
              <ul>
                <li><kbd>Enter</kbd> 현재 턴 종료</li>
                <li><kbd>Esc</kbd> 선택 중인 이동·공격·생산·건설 취소</li>
              </ul>
            </section>
          </div>
        )}

        {activeIndex === 1 && (
          <div className="help-card__guide">
            <section className="help-card__section">
              <h3>생산·경제</h3>
              <ul>
                {gameMode === 'quick' ? (
                  <>
                    <li>도시에서 군사 유닛을 생산하고 청록색 칸에 배치하세요.</li>
                    <li>
                      중립 농장·광산·대장간으로 이동해 점령하면 턴 수입이
                      늘어납니다.
                    </li>
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
                <li>
                  상태바의 자원을 선택하면 수입·유지비·순수입을 확인할 수
                  있습니다.
                </li>
              </ul>
            </section>
            <section className="help-card__section">
              <h3>승리 조건</h3>
              <ul>
                <li>상대 수도를 점령하면 승리합니다.</li>
                <li>내 수도를 빼앗기면 패배합니다.</li>
              </ul>
            </section>
          </div>
        )}

        {activeIndex === 2 && <Legend embedded gameMode={gameMode} />}
      </div>
    </section>
  )
}
