import {
  getSiteCombatStats,
  getSiteIncome,
  getSiteMaxHp,
  isMilitarySiteKind,
  TERRAIN_COMBAT_BONUS,
  TERRAIN_MOVEMENT_COST,
} from '../game/rules'
import type {
  ProductionSupport,
  SettlementProductionCapacity,
} from '../game/settlement'
import type { GameMode, Site, Tile } from '../game/types'
import type { ReactNode } from 'react'
import { SiteCommandIcon } from './SiteCommandIcon'
import { SiteIcon } from './SiteIcon'
import { useLocalization } from '../i18n/locale'

export type CityPanelTab = 'production' | 'development' | 'construction'

type CityPanelProps = {
  site: Site
  tile: Tile
  gameMode: GameMode
  activeTab?: CityPanelTab
  canProduce: boolean
  showProductionSupport?: boolean
  productionSupport?: ProductionSupport
  settlementCapacity?: SettlementProductionCapacity
  onTabChange: (tab: CityPanelTab) => void
  onClose: () => void
  children?: ReactNode
}

export function CityPanel({
  site,
  tile,
  gameMode,
  activeTab,
  canProduce,
  showProductionSupport = false,
  productionSupport,
  settlementCapacity,
  onTabChange,
  onClose,
  children,
}: CityPanelProps) {
  const { t, factionLabel, siteLabel, siteName, terrainLabel } = useLocalization()
  const combatStats = getSiteCombatStats(site)
  const maxHp = getSiteMaxHp(site)
  const isCapacityExemptProductionSite =
    site.foundedBy === undefined &&
    (site.kind === 'farm' ||
      site.kind === 'mine' ||
      site.kind === 'blacksmith')

  return (
    <div className="city-stack">
      <section className="city-card" aria-label={t('siteInfo')}>
        <div className="city-card__summary">
          <span className="city-card__icon" aria-hidden="true">
            <SiteIcon kind={site.kind} ownerId={site.ownerId} level={site.level} />
          </span>
          <div>
            <strong>{siteName(site)}</strong>
            <span>{siteLabel(site.kind)}</span>
          </div>
          <button
            type="button"
            className="city-card__close"
            aria-label={t('closeSiteInfo')}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <dl>
          <div>
            <dt>{t('income')}</dt>
            <dd>
              {isMilitarySiteKind(site.kind)
                ? t('none')
                : getSiteIncome(site)}
            </dd>
          </div>
          <div>
            <dt>{t('owner')}</dt>
            <dd>{factionLabel(site.ownerId)}</dd>
          </div>
          <div>
            <dt>{t('terrain')}</dt>
            <dd>{terrainLabel(tile.terrain)}</dd>
          </div>
          <div>
            <dt>{t('movementCost')}</dt>
            <dd>
              {TERRAIN_MOVEMENT_COST[tile.terrain] === null
                ? t('impassable')
                : TERRAIN_MOVEMENT_COST[tile.terrain]}
            </dd>
          </div>
          {TERRAIN_COMBAT_BONUS[tile.terrain] > 0 && (
            <div>
              <dt>{t('defenseBonus')}</dt>
              <dd>{TERRAIN_COMBAT_BONUS[tile.terrain]}</dd>
            </div>
          )}
          {gameMode === 'standard' && site.kind === 'city' && (
            <div>
              <dt>건물</dt>
              <dd>{site.buildings.length} / 7</dd>
            </div>
          )}
          {settlementCapacity && (
            <div>
              <dt>{t('supportedProductionSites')}</dt>
              <dd>
                {settlementCapacity.used} / {settlementCapacity.capacity}
              </dd>
            </div>
          )}
          {showProductionSupport && !isCapacityExemptProductionSite && (
            <>
              <div>
                <dt>{t('supportingSettlement')}</dt>
                <dd>
                  {productionSupport
                    ? siteName(productionSupport.settlement)
                    : t('none')}
                </dd>
              </div>
              {productionSupport && (
                <div>
                  <dt>{t('supportStatus')}</dt>
                  <dd>
                    {productionSupport.used} / {productionSupport.capacity}
                  </dd>
                </div>
              )}
            </>
          )}
          {combatStats && maxHp && (
            <>
              <div>
                <dt>{t('health')}</dt>
                <dd>{site.hp ?? maxHp}/{maxHp}</dd>
              </div>
              <div>
                <dt>{t('defense')}</dt>
                <dd>{combatStats.defense}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      {(canProduce || gameMode === 'standard') && (
        <div className="city-card__menu" role="tablist" aria-label={t('siteMenu')}>
          {canProduce && (
            <button
              className="command-button command-button--production"
              id="site-tab-production"
              type="button"
              role="tab"
              aria-label={t('production')}
              aria-controls="site-panel-production"
              aria-selected={activeTab === 'production'}
              title={t('unitProduction')}
              onClick={() => onTabChange('production')}
            >
              <SiteCommandIcon className="command-button__icon site-command-button__icon" />
            </button>
          )}
          {gameMode === 'standard' && (
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
          )}
          {gameMode === 'standard' && site.kind === 'city' && (
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
        </div>
      )}

      {children}
    </div>
  )
}
