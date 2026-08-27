import { getFactionLabel } from '../game/factions'
import {
  getSiteCombatStats,
  getSiteMaxHp,
  SITE_TYPE_LABELS,
  TERRAIN_COMBAT_BONUS,
  TERRAIN_LABELS,
  TERRAIN_MOVEMENT_COST,
  UNIT_TYPE_LABELS,
} from '../game/rules'
import type { Site, Tile, Unit } from '../game/types'
import type { TerritoryOwner } from '../game/territory'
import { TerrainIcon } from './TerrainIcon'

type MapInfoPanelProps = {
  tile: Tile
  unit?: Unit
  site?: Site
  territoryOwner?: TerritoryOwner
  mapSeed: string
  preview?: boolean
  onClose?: () => void
}

function movementCostLabel(tile: Tile) {
  const cost = TERRAIN_MOVEMENT_COST[tile.terrain]
  return cost === null ? '통과 불가' : String(cost)
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
  const title = unit?.name ?? site?.name ?? TERRAIN_LABELS[tile.terrain]
  const subtitle = unit
    ? `${getFactionLabel(unit.factionId)} · ${UNIT_TYPE_LABELS[unit.type]}`
    : site
      ? `${getFactionLabel(site.ownerId)} · ${SITE_TYPE_LABELS[site.kind]}`
      : '지형'
  const siteStats = site ? getSiteCombatStats(site) : undefined
  const siteMaxHp = site ? getSiteMaxHp(site) : undefined

  return (
    <div className="city-stack">
      <section
        className="city-card map-info-card"
        aria-label={preview ? '지도 정보 미리보기' : '타일 정보'}
        data-info-mode={preview ? 'preview' : 'tile'}
      >
        <div className="city-card__summary">
          <span className="map-info-card__icon" aria-hidden="true">
            <TerrainIcon
              terrain={tile.terrain}
              position={tile.position}
              seed={mapSeed}
              variantIndex={tile.terrainVariant}
              className="map-info-card__terrain"
            />
          </span>
          <div>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
          {onClose && (
            <button
              type="button"
              className="city-card__close"
              aria-label="타일 정보 닫기"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>

        <dl>
          {unit && (
            <>
              <div>
                <dt>체력</dt>
                <dd>
                  {unit.hp} / {unit.maxHp}
                </dd>
              </div>
              <div>
                <dt>이동</dt>
                <dd>{unit.movementRemaining}</dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>{unit.hasActed ? '행동 완료' : '행동 가능'}</dd>
              </div>
            </>
          )}
          {site && (
            <>
              {unit && (
                <div>
                  <dt>거점</dt>
                  <dd>{site.name}</dd>
                </div>
              )}
              <div>
                <dt>거점 단계</dt>
                <dd>{site.level}</dd>
              </div>
              {siteStats && siteMaxHp && (
                <div>
                  <dt>거점 체력</dt>
                  <dd>
                    {site.hp ?? siteMaxHp} / {siteMaxHp}
                  </dd>
                </div>
              )}
            </>
          )}
          {(unit || site) && (
            <div>
              <dt>지형</dt>
              <dd>{TERRAIN_LABELS[tile.terrain]}</dd>
            </div>
          )}
          {territoryOwner && territoryOwner !== 'contested' && (
            <div>
              <dt>소유자</dt>
              <dd>{getFactionLabel(territoryOwner)}</dd>
            </div>
          )}
          <div>
            <dt>이동 비용</dt>
            <dd>{movementCostLabel(tile)}</dd>
          </div>
          {TERRAIN_COMBAT_BONUS[tile.terrain] > 0 && (
            <div>
              <dt>방어 보정치</dt>
              <dd>{TERRAIN_COMBAT_BONUS[tile.terrain]}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  )
}
