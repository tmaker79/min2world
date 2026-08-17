import { SITE_STATS, SITE_TYPE_LABELS } from '../game/rules'
import type { Site } from '../game/types'
import type { ReactNode } from 'react'
import { SiteIcon } from './SiteIcon'

type CityPanelProps = {
  site: Site
  productionOpen: boolean
  onProductionOpen: () => void
  onClose: () => void
  children?: ReactNode
}

export function CityPanel({
  site,
  productionOpen,
  onProductionOpen,
  onClose,
  children,
}: CityPanelProps) {
  return (
    <div className="city-stack">
      {children}

      <div className="city-card__menu" role="tablist" aria-label="성 메뉴">
        <button
          type="button"
          role="tab"
          aria-selected={productionOpen}
          onClick={onProductionOpen}
        >
          생산
        </button>
        <button type="button" role="tab" disabled title="준비 중인 기능입니다.">
          건설 <small>미구현</small>
        </button>
        <button
          type="button"
          className="city-card__close"
          aria-label="성 정보 닫기"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <section className="city-card" aria-label="성 정보">
        <div className="city-card__summary">
          <span className="city-card__icon" aria-hidden="true">
            <SiteIcon kind={site.kind} />
          </span>
          <div>
            <strong>{site.name}</strong>
            <span>{SITE_TYPE_LABELS[site.kind]}</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>수입</dt>
            <dd>{SITE_STATS[site.kind].income} 자원/턴</dd>
          </div>
          <div>
            <dt>생산</dt>
            <dd>
              {site.lastProducedTurn ? `${site.lastProducedTurn}턴 완료` : '가능'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
