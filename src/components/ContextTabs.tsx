import type { ReactNode } from 'react'

export type ContextTabId = 'legend' | 'save' | 'help'

const TABS: Array<{ id: ContextTabId; label: string }> = [
  { id: 'legend', label: '범례' },
  { id: 'save', label: '저장' },
  { id: 'help', label: '도움말' },
]

type ContextTabsProps = {
  activeTab: ContextTabId
  onTabChange: (tab: ContextTabId) => void
  panels: Record<ContextTabId, ReactNode>
}

export function ContextTabs({
  activeTab,
  onTabChange,
  panels,
}: ContextTabsProps) {
  return (
    <section className="context-tabs" aria-label="보조 정보">
      <div className="context-tabs__list" role="tablist" aria-label="보조 패널">
        {TABS.map((tab) => {
          const selected = tab.id === activeTab
          return (
            <button
              key={tab.id}
              id={`context-tab-${tab.id}`}
              className={
                selected
                  ? 'context-tabs__tab context-tabs__tab--selected'
                  : 'context-tabs__tab'
              }
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`context-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => {
                const currentIndex = TABS.findIndex((item) => item.id === activeTab)
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  onTabChange(TABS[(currentIndex + 1) % TABS.length].id)
                }
                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  onTabChange(
                    TABS[(currentIndex - 1 + TABS.length) % TABS.length].id,
                  )
                }
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          id={`context-panel-${tab.id}`}
          className="context-tabs__panel"
          role="tabpanel"
          aria-labelledby={`context-tab-${tab.id}`}
          hidden={tab.id !== activeTab}
        >
          {panels[tab.id]}
        </div>
      ))}
    </section>
  )
}
