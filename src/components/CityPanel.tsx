import { getSiteIncome, SITE_TYPE_LABELS } from '../game/rules'
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
        <button
          type="button"
          role="tab"
          aria-selected={false}
          disabled
          title="준비 중인 기능입니다."
        >
          건설
        </button>
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
