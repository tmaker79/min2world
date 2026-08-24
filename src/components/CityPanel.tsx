import {
  getSiteCombatStats,
  getSiteIncome,
  getSiteMaxHp,
  SITE_TYPE_LABELS,
} from '../game/rules'
import type { Site } from '../game/types'
import type { ReactNode } from 'react'
import { SiteIcon } from './SiteIcon'

export type CityPanelTab = 'production' | 'development' | 'construction'

type CityPanelProps = {
  site: Site
  activeTab?: CityPanelTab
  canProduce: boolean
  onTabChange: (tab: CityPanelTab) => void
  onClose: () => void
  children?: ReactNode
}

export function CityPanel({
  site,
  activeTab,
  canProduce,
  onTabChange,
  onClose,
  children,
}: CityPanelProps) {
  const combatStats = getSiteCombatStats(site)
  const maxHp = getSiteMaxHp(site)

  return (
    <div className="city-stack">
      <section className="city-card" aria-label="거점 정보">
        <div className="city-card__summary">
          <span className="city-card__icon" aria-hidden="true">
            <SiteIcon kind={site.kind} ownerId={site.ownerId} level={site.level} />
          </span>
          <div>
            <strong>{site.name}</strong>
            <span>{SITE_TYPE_LABELS[site.kind]}</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>수입</dt>
            <dd>{getSiteIncome(site)} 자원/턴</dd>
          </div>
          <div>
            <dt>소유</dt>
            <dd>{site.ownerId === 'neutral' ? '중립' : site.ownerId}</dd>
          </div>
          {site.kind === 'city' && (
            <div>
              <dt>건물</dt>
              <dd>{site.buildings.length} / 7</dd>
            </div>
          )}
          {combatStats && maxHp && (
            <>
              <div>
                <dt>체력</dt>
                <dd>{site.hp ?? maxHp}/{maxHp}</dd>
              </div>
              <div>
                <dt>방어력</dt>
                <dd>{combatStats.defense}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <div className="city-card__menu" role="tablist" aria-label="거점 메뉴">
        {canProduce && (
          <button
            id="site-tab-production"
            type="button"
            role="tab"
            aria-controls="site-panel-production"
            aria-selected={activeTab === 'production'}
            onClick={() => onTabChange('production')}
          >
            생산
          </button>
        )}
        <button
          id="site-tab-development"
          type="button"
          role="tab"
          aria-controls="site-panel-development"
          aria-selected={activeTab === 'development'}
          onClick={() => onTabChange('development')}
        >
          발전
        </button>
        {site.kind === 'city' && (
          <button
            id="site-tab-construction"
            type="button"
            role="tab"
            aria-controls="site-panel-construction"
            aria-selected={activeTab === 'construction'}
            onClick={() => onTabChange('construction')}
          >
            건설
          </button>
        )}
        <button
          type="button"
          className="city-card__close"
          aria-label="거점 정보 닫기"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {children}
    </div>
  )
}
