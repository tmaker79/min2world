import {
  getDisplayedCombatStrength,
  SITE_TYPE_LABELS,
  TERRAIN_COMBAT_BONUS,
  TERRAIN_LABELS,
  TERRAIN_MOVEMENT_COST,
  UNIT_STATS,
  UNIT_TYPE_LABELS,
} from '../game/rules'
import type { Site, Tile, Unit } from '../game/types'
import { hasTerrainImage, TerrainIcon } from './TerrainIcon'
import { UnitIcon } from './UnitIcon'

type InfoPanelProps = {
  unit?: Unit
  tile?: Tile
  site?: Site
  mapSeed?: string
}

function ownerLabel(site: Site) {
  if (site.ownerId === 'player') return '푸른 연맹'
  if (site.ownerId === 'enemy') return '붉은 제국'
  return '중립'
}

function movementCostLabel(terrain: Tile['terrain']) {
  const cost = TERRAIN_MOVEMENT_COST[terrain]
  return cost === null ? '통과 불가' : `${cost}`
}

export function InfoPanel({ unit, tile, site, mapSeed }: InfoPanelProps) {
  const showingTerrain = !unit && Boolean(tile)

  if (!unit && !tile) {
    return null
  }

  return (
    <section
      className="info-card"
      aria-labelledby="unit-info-heading"
      data-info-mode={unit ? 'unit' : 'terrain'}
    >
      <p className="eyebrow">{showingTerrain ? 'TERRAIN' : 'SELECTED UNIT'}</p>
      <h2 id="unit-info-heading">{showingTerrain ? '지형 정보' : '부대 정보'}</h2>

      {unit ? (
        <div className="unit-details">
          <div
            className={`unit-portrait unit-portrait--${unit.factionId}`}
            aria-hidden="true"
          >
            <UnitIcon type={unit.type} />
          </div>
          <div className="unit-details__heading">
            <strong>{unit.name}</strong>
            <span>{UNIT_TYPE_LABELS[unit.type]}</span>
          </div>
          <dl>
            <div>
              <dt>체력</dt>
              <dd>
                {unit.hp} / {unit.maxHp}
              </dd>
            </div>
            <div>
              <dt>남은 이동력</dt>
              <dd>
                {unit.movementRemaining} / {UNIT_STATS[unit.type].movement}
              </dd>
            </div>
            <div>
              <dt>근접 전투력</dt>
              <dd>{getDisplayedCombatStrength(unit, 'melee')}</dd>
            </div>
            {UNIT_STATS[unit.type].ranged > 0 && (
              <div>
                <dt>원거리 전투력</dt>
                <dd>{getDisplayedCombatStrength(unit, 'ranged')}</dd>
              </div>
            )}
            <div>
              <dt>공격 사거리</dt>
              <dd>{UNIT_STATS[unit.type].range}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>
                {unit.hasActed
                  ? '행동 완료'
                  : unit.movementRemaining === 0
                    ? '공격만 가능'
                    : '행동 가능'}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="unit-details terrain-details">
          <div
            className={`terrain-portrait terrain-portrait--${tile!.terrain}`}
            aria-hidden="true"
          >
            {hasTerrainImage(tile!.terrain) ? (
              <TerrainIcon
                terrain={tile!.terrain}
                position={tile!.position}
                seed={mapSeed}
                variantIndex={tile!.terrainVariant}
              />
            ) : (
              <span>{TERRAIN_LABELS[tile!.terrain].slice(0, 1)}</span>
            )}
          </div>
          <div className="unit-details__heading">
            <strong>{TERRAIN_LABELS[tile!.terrain]}</strong>
            <span>
              좌표 {tile!.position.q}, {tile!.position.r}
            </span>
          </div>
          <dl>
            <div>
              <dt>이동 비용</dt>
              <dd>{movementCostLabel(tile!.terrain)}</dd>
            </div>
            <div>
              <dt>전투력 보정</dt>
              <dd>
                {TERRAIN_COMBAT_BONUS[tile!.terrain] > 0
                  ? `+${TERRAIN_COMBAT_BONUS[tile!.terrain]}`
                  : '없음'}
              </dd>
            </div>
            {site && (
              <div>
                <dt>거점</dt>
                <dd>
                  {site.name} ({ownerLabel(site)} {SITE_TYPE_LABELS[site.kind]})
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  )
}
