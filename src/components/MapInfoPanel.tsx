import {
  getSiteCombatStats,
  getSiteMaxHp,
  TERRAIN_COMBAT_BONUS,
  TERRAIN_MOVEMENT_COST,
} from '../game/rules'
import type { Site, Tile, Unit } from '../game/types'
import type { TerritoryOwner } from '../game/territory'
import { TerrainIcon } from './TerrainIcon'
import { UnitIcon } from './UnitIcon'
import { useLocalization } from '../i18n/locale'

type MapInfoPanelProps = {
  tile: Tile
  unit?: Unit
  site?: Site
  territoryOwner?: TerritoryOwner
  mapSeed: string
  preview?: boolean
  onClose?: () => void
}

function movementCostLabel(tile: Tile, impassable: string) {
  const cost = TERRAIN_MOVEMENT_COST[tile.terrain]
  return cost === null ? impassable : String(cost)
}

export function MapInfoPanel({
  tile,
  unit,
  site,
  territoryOwner,
  mapSeed,
  preview = false,
  onClose,
}: MapInfoPanelProps) {
  const { t, factionLabel, siteLabel, siteName, terrainLabel, unitLabel, unitName } = useLocalization()
  const title = unit ? unitName(unit) : site ? siteName(site) : terrainLabel(tile.terrain)
  const subtitle = unit
    ? `${factionLabel(unit.factionId)} · ${unitLabel(unit.type)}`
    : site
      ? `${factionLabel(site.ownerId)} · ${siteLabel(site.kind)}`
      : t('terrain')
  const siteStats = site ? getSiteCombatStats(site) : undefined
  const siteMaxHp = site ? getSiteMaxHp(site) : undefined

  return (
    <div className="city-stack">
      <section
        className="city-card map-info-card"
        aria-label={preview ? t('mapPreview') : t('tileInfo')}
        data-info-mode={preview ? 'preview' : 'tile'}
      >
        <div className="city-card__summary">
          <span
            className={
              unit
                ? `city-card__icon unit-card__icon unit-card__icon--${unit.factionId}`
                : 'map-info-card__icon'
            }
            aria-hidden="true"
          >
            {unit ? (
              <UnitIcon type={unit.type} />
            ) : (
              <TerrainIcon
                terrain={tile.terrain}
                position={tile.position}
                seed={mapSeed}
                variantIndex={tile.terrainVariant}
                className="map-info-card__terrain"
              />
            )}
          </span>
          <div>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
          {onClose && (
            <button
              type="button"
              className="city-card__close"
              aria-label={t('closeTileInfo')}
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>

        <dl>
          {unit && (
            <div>
              <dt>{t('health')}</dt>
              <dd>
                {unit.hp} / {unit.maxHp}
              </dd>
            </div>
          )}
          {site && (
            <>
              {unit && (
                <div>
                  <dt>{t('site')}</dt>
                  <dd>{siteName(site)}</dd>
                </div>
              )}
              <div>
                <dt>{t('siteLevel')}</dt>
                <dd>{site.level}</dd>
              </div>
              {siteStats && siteMaxHp && (
                <div>
                  <dt>{t('siteHealth')}</dt>
                  <dd>
                    {site.hp ?? siteMaxHp} / {siteMaxHp}
                  </dd>
                </div>
              )}
            </>
          )}
          {(unit || site) && (
            <div>
              <dt>{t('terrain')}</dt>
              <dd>{terrainLabel(tile.terrain)}</dd>
            </div>
          )}
          {territoryOwner && territoryOwner !== 'contested' && (
            <div>
              <dt>{t('owner')}</dt>
              <dd>{factionLabel(territoryOwner)}</dd>
            </div>
          )}
          <div>
            <dt>{t('movementCost')}</dt>
            <dd>{movementCostLabel(tile, t('impassable'))}</dd>
          </div>
          {TERRAIN_COMBAT_BONUS[tile.terrain] > 0 && (
            <div>
              <dt>{t('defenseBonus')}</dt>
              <dd>{TERRAIN_COMBAT_BONUS[tile.terrain]}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  )
}
