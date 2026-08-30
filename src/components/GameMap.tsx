import type { CSSProperties } from 'react'
import { memo, useMemo, useRef } from 'react'
import farmLevel2Icon from '../assets/sites/farm-level-2.png'
import farmLevel3Icon from '../assets/sites/farm-level-3.png'
import farmLevel1Icon from '../assets/sites/farm.png'
import mineLevel2Icon from '../assets/sites/mine-level-2.png'
import mineLevel3Icon from '../assets/sites/mine-level-3.png'
import mineLevel1Icon from '../assets/sites/mine.png'
import outpostIcon from '../assets/sites/outpost.png'
import keepIcon from '../assets/sites/keep.png'
import smithyLevel2Icon from '../assets/sites/smithy-level-2.png'
import smithyLevel3Icon from '../assets/sites/smithy-level-3.png'
import smithyLevel1Icon from '../assets/sites/smithy.png'
import strongholdIcon from '../assets/sites/stronghold.png'
import easternTownIcon from '../assets/sites/town-eastern-3tile-roofmatch.png'
import easternVillageIcon from '../assets/sites/village-eastern.png'
import { getFactionLabel } from '../game/factions'
import {
  getHexDistance,
  getHexPixelPosition,
  HEX_DIRECTIONS,
  HEX_HEIGHT,
  HEX_WIDTH,
} from '../game/hex'
import type { TerritoryIndex, TerritoryOwner } from '../game/territory'
import {
  getSiteAt,
  getSiteCombatStats,
  getSiteMaxHp,
  getUnitAt,
  isCivilianUnitType,
  positionKey,
  SITE_TYPE_LABELS,
  TERRAIN_LABELS,
  TERRAIN_MOVEMENT_COST,
  UNIT_TYPE_LABELS,
} from '../game/rules'
import type {
  GameState,
  Position,
  Site,
  SiteType,
  Tile,
  Unit,
} from '../game/types'
import { getSiteOccupiedPositions } from '../game/siteFootprint'
import { getMapCameraGutter } from '../hooks/useMapZoom'
import { useMapViewport } from '../hooks/useMapViewport'
import { ArrowVolley } from './ArrowVolley'
import { SiteIcon } from './SiteIcon'
import { hasTerrainImage, TerrainIcon } from './TerrainIcon'
import { UnitIcon } from './UnitIcon'

const VIEWPORT_OVERSCAN_PX = Math.max(HEX_WIDTH, HEX_HEIGHT) * 2
// 컬링 경계를 이 단위로 바깥쪽 반올림해, 1px 스크롤마다 컬링이 다시 돌지 않게 한다.
// 오버스캔보다 작아야 반올림 오차가 화면 밖에서 흡수된다.
const VIEWPORT_QUANTUM_PX = 64
/** Matches `.game-map` content-box padding (8*2). */
const MAP_FRAME_PX = 16
const MAP_CAMERA_MINIMUM_GUTTER = 48
const MAP_CAMERA_MAXIMUM_GUTTER = 72
const HEX_BOUNDARY_EDGES = [
  [58, 16.5, 58, 49.5],
  [29, 0, 58, 16.5],
  [0, 16.5, 29, 0],
  [0, 49.5, 0, 16.5],
  [29, 66, 0, 49.5],
  [58, 49.5, 29, 66],
] as const
const HEX_VOID_SHADOW_OFFSETS = [
  [4, 3],
  [2, -2],
  [-2, -2],
  [-4, 3],
  [-3, 6],
  [3, 6],
] as const

// 경계면 집합은 배열이 아니라 6비트 마스크로 넘긴다. 배열이면 매 렌더 새 참조가
// 되어 TileButton의 memo 비교가 항상 실패하고, 팬 중 보이는 타일 전부가 다시
// 렌더된다.
function getKeySetBoundaryMask(
  position: Position,
  keys: ReadonlySet<string>,
): number {
  let mask = 0
  for (let side = 0; side < HEX_DIRECTIONS.length; side += 1) {
    const direction = HEX_DIRECTIONS[side]
    const neighborKey = positionKey({
      q: position.q + direction.q,
      r: position.r + direction.r,
    })
    if (!keys.has(neighborKey)) mask |= 1 << side
  }
  return mask
}

function getTerritoryBoundaryMask(
  position: Position,
  territoryByKey: TerritoryIndex,
  owner: TerritoryOwner,
): number {
  let mask = 0
  for (let side = 0; side < HEX_DIRECTIONS.length; side += 1) {
    const direction = HEX_DIRECTIONS[side]
    const neighborKey = positionKey({
      q: position.q + direction.q,
      r: position.r + direction.r,
    })
    if (territoryByKey.get(neighborKey) !== owner) mask |= 1 << side
  }
  return mask
}

function getBoundarySides(mask: number): number[] {
  const sides: number[] = []
  for (let side = 0; side < HEX_DIRECTIONS.length; side += 1) {
    if (mask & (1 << side)) sides.push(side)
  }
  return sides
}

function getVoidShadowCoordinates(side: number) {
  const [x1, y1, x2, y2] = HEX_BOUNDARY_EDGES[side]
  const [offsetX, offsetY] = HEX_VOID_SHADOW_OFFSETS[side]
  return {
    x1: x1 + offsetX,
    y1: y1 + offsetY,
    x2: x2 + offsetX,
    y2: y2 + offsetY,
  }
}

const PRODUCTION_SITE_ASSET_PREVIEW_ICONS = {
  'farm-1': farmLevel1Icon,
  'farm-2': farmLevel2Icon,
  'farm-3': farmLevel3Icon,
  'mine-1': mineLevel1Icon,
  'mine-2': mineLevel2Icon,
  'mine-3': mineLevel3Icon,
  'smithy-1': smithyLevel1Icon,
  'smithy-2': smithyLevel2Icon,
  'smithy-3': smithyLevel3Icon,
} as const
const MILITARY_SITE_ASSET_PREVIEW_ICONS = {
  outpost: outpostIcon,
  keep: keepIcon,
  stronghold: strongholdIcon,
} as const
const SETTLEMENT_SITE_ASSET_PREVIEW_ICONS = {
  village: easternVillageIcon,
  town: easternTownIcon,
} as const
const SITE_ASSET_PREVIEW_ICONS = {
  ...PRODUCTION_SITE_ASSET_PREVIEW_ICONS,
  ...SETTLEMENT_SITE_ASSET_PREVIEW_ICONS,
  ...MILITARY_SITE_ASSET_PREVIEW_ICONS,
} as const
type SiteAssetPreviewKind = keyof typeof SITE_ASSET_PREVIEW_ICONS
const SITE_ASSET_PREVIEW_DETAILS: Record<
  SiteAssetPreviewKind,
  { siteKind: SiteType; level: 1 | 2 | 3 }
> = {
  'farm-1': { siteKind: 'farm', level: 1 },
  'farm-2': { siteKind: 'farm', level: 2 },
  'farm-3': { siteKind: 'farm', level: 3 },
  'mine-1': { siteKind: 'mine', level: 1 },
  'mine-2': { siteKind: 'mine', level: 2 },
  'mine-3': { siteKind: 'mine', level: 3 },
  'smithy-1': { siteKind: 'blacksmith', level: 1 },
  'smithy-2': { siteKind: 'blacksmith', level: 2 },
  'smithy-3': { siteKind: 'blacksmith', level: 3 },
  village: { siteKind: 'village', level: 1 },
  town: { siteKind: 'town', level: 1 },
  outpost: { siteKind: 'outpost', level: 1 },
  keep: { siteKind: 'keep', level: 1 },
  stronghold: { siteKind: 'stronghold', level: 1 },
}

export type CombatAnimationPhase = 'attack' | 'hit'

export type MapTileActivationSource =
  | 'mouse'
  | 'touch'
  | 'pen'
  | 'keyboard'

export type CombatAnimation = {
  attackerId: string
  defenderId: string
  attackerPosition: Position
  defenderPosition: Position
  damageToAttacker: number
  damageToDefender: number
  attackerDefeated: boolean
  defenderDefeated: boolean
  phase: CombatAnimationPhase
}

export type SiteAttackAnimation = {
  attackerId: string
  attackerPosition: Position
  siteId: string
  sitePosition: Position
  damage: number
  captured: boolean
  phase: CombatAnimationPhase
}

type GameMapProps = {
  state: GameState
  territoryByKey: TerritoryIndex
  scrollElement: HTMLElement | null
  zoom?: number
  reachableKeys: Set<string>
  attackableKeys: Set<string>
  attackableSiteKeys?: Set<string>
  deployableKeys: Set<string>
  developmentFootprintKeys?: Set<string>
  foundingCandidateKeys?: Set<string>
  selectedDevelopmentFootprintKeys?: Set<string>
  selectedSiteId?: string
  inspectedTileKey?: string
  combatAnimation?: CombatAnimation
  siteAttackAnimation?: SiteAttackAnimation
  showSiteAssetPreview?: boolean
  disabled: boolean
  suppressClickRef?: { current: boolean }
  onTileClick: (tile: Tile, source: MapTileActivationSource) => void
  onTileContextMenu?: (tile: Tile) => void
  onPreviewTileChange?: (tileKey?: string) => void
}

type TileButtonProps = {
  tile: Tile
  unit?: Unit
  site?: Site
  mapSeed: string
  territoryOwner?: TerritoryOwner
  territoryBoundaryMask: number
  reachableBoundaryMask: number
  selected: boolean
  siteSelected: boolean
  inspected: boolean
  reachable: boolean
  attackable: boolean
  attackableSite: boolean
  deployable: boolean
  developmentFootprint: boolean
  foundingCandidate: boolean
  selectedDevelopmentFootprint: boolean
  disabled: boolean
  style: CSSProperties
  onClick: (tile: Tile, source: MapTileActivationSource) => void
  onContextMenu?: (tile: Tile) => void
  suppressClickRef?: { current: boolean }
  onPreviewTileChange?: (tileKey?: string) => void
}

function getTileLabel(
  tile: Tile,
  unit?: Unit,
  site?: Site,
  attackable = false,
  deployable = false,
  developmentFootprint = false,
  selectedDevelopmentFootprint = false,
  foundingCandidate = false,
  territoryOwner?: TerritoryOwner,
) {
  const parts = [
    `육각 좌표 ${tile.position.q}, ${tile.position.r}`,
    TERRAIN_LABELS[tile.terrain],
  ]
  parts.push(
    territoryOwner === 'contested'
      ? '영토 분쟁 지역'
      : territoryOwner
        ? `${getFactionLabel(territoryOwner)} 영토`
        : '미편입 지역',
  )
  if (deployable) parts.push('생산 배치 가능')
  if (foundingCandidate) parts.push('정착·건설 가능')
  if (developmentFootprint) {
    parts.push(
      selectedDevelopmentFootprint ? '선택한 발전 footprint' : '발전 footprint 후보',
    )
  }
  if (site) {
    parts.push(
      `${site.name}, ${getFactionLabel(site.ownerId)} ${SITE_TYPE_LABELS[site.kind]}`,
    )
    if (attackable) parts.push('공격 가능')
  }
  if (unit) {
    parts.push(`${unit.name}, ${UNIT_TYPE_LABELS[unit.type]}`)
    parts.push(`체력 ${unit.hp}/${unit.maxHp}`)
    parts.push(
      unit.hasActed
        ? '행동 완료'
        : isCivilianUnitType(unit.type)
          ? '행동 가능'
        : unit.movementRemaining === 0
          ? '공격만 가능'
          : '행동 가능',
    )
    if (attackable && !site) parts.push('공격 가능')
  }
  return parts.join(', ')
}

function getOverlayStyle(
  position: Position,
  minimumX: number,
  minimumY: number,
): CSSProperties {
  const pixel = getHexPixelPosition(position)
  return { left: pixel.x - minimumX, top: pixel.y - minimumY }
}

function getSiteOverlayStyle(
  site: Site,
  minimumX: number,
  minimumY: number,
): CSSProperties {
  const pixels = getSiteOccupiedPositions(site).map(getHexPixelPosition)
  const left = Math.min(...pixels.map((pixel) => pixel.x))
  const top = Math.min(...pixels.map((pixel) => pixel.y))
  const right = Math.max(...pixels.map((pixel) => pixel.x)) + HEX_WIDTH
  const bottom = Math.max(...pixels.map((pixel) => pixel.y)) + HEX_HEIGHT
  return {
    left: left - minimumX,
    top: top - minimumY,
    width: right - left,
    height: bottom - top,
  }
}

const TileButton = memo(function TileButton({
  tile,
  unit,
  site,
  mapSeed,
  territoryOwner,
  territoryBoundaryMask,
  reachableBoundaryMask,
  selected,
  siteSelected,
  inspected,
  reachable,
  attackable,
  attackableSite,
  deployable,
  developmentFootprint,
  foundingCandidate,
  selectedDevelopmentFootprint,
  disabled,
  style,
  onClick,
  onContextMenu,
  suppressClickRef,
  onPreviewTileChange,
}: TileButtonProps) {
  const pointerSourceRef = useRef<MapTileActivationSource>('mouse')
  const classNames = [
    'map-tile',
    `map-tile--${tile.terrain}`,
    selected ? 'map-tile--selected' : '',
    siteSelected ? 'map-tile--site-selected' : '',
    inspected ? 'map-tile--inspected' : '',
    reachable ? 'map-tile--reachable' : '',
    attackable ? 'map-tile--attackable' : '',
    attackableSite ? 'map-tile--attackable-site' : '',
    deployable ? 'map-tile--deployable' : '',
    developmentFootprint ? 'map-tile--development-footprint' : '',
    foundingCandidate ? 'map-tile--founding-candidate' : '',
    selectedDevelopmentFootprint
      ? 'map-tile--development-footprint-selected'
      : '',
    unit ? 'map-tile--has-unit' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classNames}
      style={style}
      type="button"
      aria-label={getTileLabel(
        tile,
        unit,
        site,
        attackable || attackableSite,
        deployable,
        developmentFootprint,
        selectedDevelopmentFootprint,
        foundingCandidate,
        territoryOwner,
      )}
      aria-pressed={
        selected || siteSelected ? true : unit ? false : undefined
      }
      data-coordinate={positionKey(tile.position)}
      data-reachable={reachable ? 'true' : undefined}
      data-reachable-boundary={reachableBoundaryMask > 0 ? 'true' : undefined}
      data-attackable={attackable ? 'true' : undefined}
      data-attackable-site={attackableSite ? 'true' : undefined}
      data-deployable={deployable ? 'true' : undefined}
      data-development-footprint={developmentFootprint ? 'true' : undefined}
      data-founding-candidate={foundingCandidate ? 'true' : undefined}
      data-development-footprint-selected={
        selectedDevelopmentFootprint ? 'true' : undefined
      }
      data-site-selected={siteSelected ? 'true' : undefined}
      data-territory-owner={territoryOwner ?? 'unclaimed'}
      aria-disabled={disabled || undefined}
      onPointerDown={(event) => {
        pointerSourceRef.current =
          event.pointerType === 'touch' || event.pointerType === 'pen'
            ? event.pointerType
            : 'mouse'
      }}
      onClick={(event) => {
        const source = event.detail === 0 ? 'keyboard' : pointerSourceRef.current
        pointerSourceRef.current = 'mouse'
        if (disabled || suppressClickRef?.current) {
          return
        }
        onPreviewTileChange?.(undefined)
        onClick(tile, source)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        if (disabled || suppressClickRef?.current || !onContextMenu) {
          return
        }
        onPreviewTileChange?.(undefined)
        onContextMenu(tile)
      }}
      onMouseEnter={() => onPreviewTileChange?.(positionKey(tile.position))}
      onMouseLeave={() => onPreviewTileChange?.(undefined)}
      onFocus={() => onPreviewTileChange?.(positionKey(tile.position))}
      onBlur={() => onPreviewTileChange?.(undefined)}
    >
      {hasTerrainImage(tile.terrain) && (
        <span className={`terrain-mark terrain-mark--${tile.terrain}`} aria-hidden="true">
          <TerrainIcon
            terrain={tile.terrain}
            position={tile.position}
            seed={mapSeed}
            variantIndex={tile.terrainVariant}
          />
        </span>
      )}
      {territoryOwner && (
        <span
          className={`territory-mark territory-mark--${territoryOwner}`}
          aria-hidden="true"
        >
          {territoryBoundaryMask > 0 && (
            <svg
              className="territory-mark__boundary"
              viewBox={`0 0 ${HEX_WIDTH} ${HEX_HEIGHT}`}
            >
              {getBoundarySides(territoryBoundaryMask).map((side) => {
                const [x1, y1, x2, y2] = HEX_BOUNDARY_EDGES[side]
                return <line key={side} x1={x1} y1={y1} x2={x2} y2={y2} />
              })}
            </svg>
          )}
        </span>
      )}
      {reachableBoundaryMask > 0 && (
        <span className="reachable-area-mark" aria-hidden="true">
          <svg
            className="reachable-area-mark__boundary"
            viewBox={`0 0 ${HEX_WIDTH} ${HEX_HEIGHT}`}
          >
            {getBoundarySides(reachableBoundaryMask).map((side) => {
              const [x1, y1, x2, y2] = HEX_BOUNDARY_EDGES[side]
              return <line key={side} x1={x1} y1={y1} x2={x2} y2={y2} />
            })}
          </svg>
        </span>
      )}
    </button>
  )
})

const VoidEdgeShadowMarker = memo(function VoidEdgeShadowMarker({
  boundaryMask,
  style,
}: {
  boundaryMask: number
  style: CSSProperties
}) {
  const sides = getBoundarySides(boundaryMask)

  return (
    <span
      className="void-edge-shadow-marker"
      data-void-edge-shadow-mask={boundaryMask}
      style={style}
    >
      <svg
        className="void-edge-shadow-marker__art"
        viewBox={`0 0 ${HEX_WIDTH} ${HEX_HEIGHT}`}
      >
        {sides.map((side) => (
          <line
            key={side}
            className="void-edge-shadow-marker__line"
            {...getVoidShadowCoordinates(side)}
          />
        ))}
      </svg>
    </span>
  )
})

function SiteMarker({
  site,
  selected,
  attackable,
  siteAttackAnimation,
  style,
}: {
  site: Site
  selected: boolean
  attackable: boolean
  siteAttackAnimation?: SiteAttackAnimation
  style: CSSProperties
}) {
  const combatStats = getSiteCombatStats(site)
  const maxHp = getSiteMaxHp(site)
  const hp = combatStats && maxHp ? (site.hp ?? maxHp) : undefined
  const healthPercent =
    hp !== undefined && maxHp ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const isHit =
    site.id === siteAttackAnimation?.siteId &&
    siteAttackAnimation.phase === 'hit'
  const healthLabel =
    hp !== undefined && maxHp ? `, 체력 ${hp}/${maxHp}` : ''
  return (
    <span
      className={`map-overlay-cell${attackable ? ' map-overlay-cell--attackable' : ''}`}
      style={style}
    >
      <span
        className={`site-marker site-marker--${site.kind} site-marker--${site.ownerId}${
          selected ? ' site-marker--selected' : ''
        }${isHit ? ' site-marker--hit' : ''
        }`}
        data-owner={site.ownerId}
        data-site-id={site.id}
        data-health={hp !== undefined && maxHp ? `${hp}/${maxHp}` : undefined}
        data-site-selected={selected ? 'true' : undefined}
        role="img"
        aria-label={`${site.name}, ${SITE_TYPE_LABELS[site.kind]}${healthLabel}`}
      >
        <SiteIcon kind={site.kind} ownerId={site.ownerId} level={site.level} />
        {site.ownerId !== 'neutral' && (
          <span className={`site-banner site-banner--${site.ownerId}`} />
        )}
        {hp !== undefined && maxHp && (
          <span className="site-health-bar">
            <span
              className="site-health-bar__fill"
              style={{ width: `${healthPercent}%` }}
            />
          </span>
        )}
      </span>
    </span>
  )
}

function SiteAssetPreviewMarker({
  kind,
  position,
  minimumX,
  minimumY,
}: {
  kind: SiteAssetPreviewKind
  position: Position
  minimumX: number
  minimumY: number
}) {
  const details = SITE_ASSET_PREVIEW_DETAILS[kind]
  const variant = kind === 'village' || kind === 'town' ? 'eastern' : 'western'
  return (
    <span
      className="map-overlay-cell"
      style={getOverlayStyle(position, minimumX, minimumY)}
    >
      <span
        className={`site-asset-preview site-asset-preview--${details.siteKind}`}
        data-site-asset-preview={kind}
        data-site-asset-preview-footprint="1"
      >
        <img
          src={SITE_ASSET_PREVIEW_ICONS[kind]}
          alt=""
          data-site-icon={details.siteKind}
          data-site-level={details.level}
          data-site-icon-variant={variant}
        />
      </span>
    </span>
  )
}

function UnitMarker({
  unit,
  selected,
  attackable,
  combatAnimation,
  siteAttackAnimation,
  style,
}: {
  unit: Unit
  selected: boolean
  attackable: boolean
  combatAnimation?: CombatAnimation
  siteAttackAnimation?: SiteAttackAnimation
  style: CSSProperties
}) {
  const healthPercent = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))
  const healthLevel =
    healthPercent <= 30
      ? 'critical'
      : healthPercent < 100
        ? 'damaged'
        : 'healthy'
  const unitRole = isCivilianUnitType(unit.type) ? 'civilian' : 'military'
  const isAttacker = unit.id === combatAnimation?.attackerId
  const isSiteAttacker = unit.id === siteAttackAnimation?.attackerId
  const isDefender = unit.id === combatAnimation?.defenderId
  const usesArrowVolley = unit.type === 'archer'
  const meleeExchange = Boolean(
    combatAnimation && combatAnimation.damageToAttacker > 0,
  )
  const isStriking =
    (combatAnimation?.phase === 'attack' &&
      ((isAttacker && !usesArrowVolley) || (isDefender && meleeExchange))) ||
    (siteAttackAnimation?.phase === 'attack' &&
      isSiteAttacker &&
      !usesArrowVolley)
  const isHit =
    combatAnimation?.phase === 'hit' &&
    ((isDefender && combatAnimation.damageToDefender > 0) ||
      (isAttacker && combatAnimation.damageToAttacker > 0))
  const isDefeated =
    isHit &&
    ((isDefender && combatAnimation.defenderDefeated) ||
      (isAttacker && combatAnimation.attackerDefeated))
  const strikeTarget = isSiteAttacker
    ? siteAttackAnimation?.sitePosition
    : isAttacker
      ? combatAnimation?.defenderPosition
      : combatAnimation?.attackerPosition
  const originPixel = getHexPixelPosition(unit.position)
  const targetPixel = strikeTarget ? getHexPixelPosition(strikeTarget) : undefined
  const deltaX = targetPixel ? targetPixel.x - originPixel.x : 0
  const deltaY = targetPixel ? targetPixel.y - originPixel.y : 0
  const deltaLength = Math.hypot(deltaX, deltaY) || 1

  return (
    <span
      className={`map-overlay-cell${attackable ? ' map-overlay-cell--attackable' : ''}`}
      style={style}
    >
      {selected && (
        <span className="unit-selection-light" data-unit-selection-light="true">
          <span className="unit-selection-light__ray unit-selection-light__ray--left" />
          <span className="unit-selection-light__ray unit-selection-light__ray--right" />
        </span>
      )}
      <span
        className={`unit-token unit-token--${unitRole} unit-token--${unit.factionId} ${
          selected ? 'unit-token--selected' : ''
        } ${unit.hasActed ? 'unit-token--acted' : ''} ${
          isStriking ? 'unit-token--striking' : ''
        } ${isHit ? 'unit-token--hit' : ''} ${
          isDefeated ? 'unit-token--defeated' : ''
        }`}
        data-unit-id={unit.id}
        data-unit-role={unitRole}
        data-coordinate={positionKey(unit.position)}
        data-health={`${unit.hp}/${unit.maxHp}`}
        data-selected={selected ? 'true' : undefined}
        style={
          {
            '--strike-x': `${(deltaX / deltaLength) * 18}px`,
            '--strike-y': `${(deltaY / deltaLength) * 18}px`,
          } as CSSProperties
        }
      >
        <span className="unit-symbol">
          <UnitIcon type={unit.type} />
        </span>
        <span className="unit-health-bar">
          <span
            className={`unit-health-bar__fill unit-health-bar__fill--${healthLevel}`}
            style={{ width: `${healthPercent}%` }}
          />
        </span>
      </span>
    </span>
  )
}

function GameMapComponent({
  state,
  territoryByKey,
  scrollElement,
  zoom = 1,
  reachableKeys,
  attackableKeys,
  attackableSiteKeys = new Set(),
  deployableKeys,
  developmentFootprintKeys = new Set(),
  foundingCandidateKeys = new Set(),
  selectedDevelopmentFootprintKeys = new Set(),
  selectedSiteId,
  inspectedTileKey,
  combatAnimation,
  siteAttackAnimation,
  showSiteAssetPreview = false,
  disabled,
  suppressClickRef,
  onTileClick,
  onTileContextMenu,
  onPreviewTileChange,
}: GameMapProps) {
  const viewport = useMapViewport(scrollElement)
  const cameraGutterX = getMapCameraGutter(
    scrollElement?.clientWidth ?? 0,
    MAP_CAMERA_MINIMUM_GUTTER,
    MAP_CAMERA_MAXIMUM_GUTTER,
  )
  const cameraGutterY = getMapCameraGutter(
    scrollElement?.clientHeight ?? 0,
    MAP_CAMERA_MINIMUM_GUTTER,
    MAP_CAMERA_MAXIMUM_GUTTER,
  )

  const layout = useMemo(() => {
    const positionedTiles = state.tiles.map((tile) => ({
      tile,
      pixel: getHexPixelPosition(tile.position),
    }))
    const minimumX = Math.min(
      ...positionedTiles.map(({ pixel }) => pixel.x),
    )
    const minimumY = Math.min(
      ...positionedTiles.map(({ pixel }) => pixel.y),
    )
    const maximumX = Math.max(
      ...positionedTiles.map(({ pixel }) => pixel.x),
    )
    const maximumY = Math.max(
      ...positionedTiles.map(({ pixel }) => pixel.y),
    )
    const rowMap = new Map<
      number,
      Array<{ tile: Tile; left: number; top: number; style: CSSProperties }>
    >()
    const byKey = new Map<
      string,
      { tile: Tile; left: number; top: number; style: CSSProperties }
    >()

    for (const { tile, pixel } of positionedTiles) {
      const entry = {
        tile,
        left: pixel.x - minimumX,
        top: pixel.y - minimumY,
        style: {
          left: pixel.x - minimumX,
          top: pixel.y - minimumY,
        },
      }
      const row = rowMap.get(tile.position.r) ?? []
      row.push(entry)
      rowMap.set(tile.position.r, row)
      byKey.set(positionKey(tile.position), entry)
    }

    return {
      minimumX,
      minimumY,
      maximumX,
      maximumY,
      rows: [...rowMap.values()],
      byKey,
    }
  }, [state.tiles])
  const { minimumX, minimumY, maximumX, maximumY } = layout
  const logicalWidth = maximumX - minimumX + HEX_WIDTH
  const logicalHeight = maximumY - minimumY + HEX_HEIGHT
  const boardKeys = useMemo(
    () => new Set(state.tiles.map((tile) => positionKey(tile.position))),
    [state.tiles],
  )
  const siteAssetPreviews = useMemo(() => {
    if (!showSiteAssetPreview) return []

    const occupiedKeys = new Set([
      ...state.sites.flatMap((site) =>
        getSiteOccupiedPositions(site).map(positionKey),
      ),
      ...state.units.map((unit) => positionKey(unit.position)),
    ])
    const availableTiles = state.tiles
      .filter((tile) => !occupiedKeys.has(positionKey(tile.position)))
      .filter((tile) => TERRAIN_MOVEMENT_COST[tile.terrain] !== null)
    const capital = state.sites.find(
      (site) => site.capitalFor === state.humanFactionId,
    )
    if (!capital) return []

    const positions = availableTiles
      .sort((left, right) => {
        const distanceDifference =
          getHexDistance(left.position, capital.position) -
          getHexDistance(right.position, capital.position)
        if (distanceDifference !== 0) return distanceDifference
        if (left.position.r !== right.position.r) {
          return left.position.r - right.position.r
        }
        return left.position.q - right.position.q
      })
      .slice(0, Object.keys(SITE_ASSET_PREVIEW_ICONS).length)
      .map((tile) => tile.position)

    return (
      Object.keys(SITE_ASSET_PREVIEW_ICONS) as SiteAssetPreviewKind[]
    ).flatMap((kind, index) => {
      const position = positions[index]
      return position ? [{ kind, position }] : []
    })
  }, [
    showSiteAssetPreview,
    state.humanFactionId,
    state.sites,
    state.tiles,
    state.units,
  ])
  const rawLeft = (viewport.left - cameraGutterX) / zoom - VIEWPORT_OVERSCAN_PX
  const rawTop = (viewport.top - cameraGutterY) / zoom - VIEWPORT_OVERSCAN_PX
  const rawRight =
    (viewport.left - cameraGutterX + viewport.width) / zoom +
    VIEWPORT_OVERSCAN_PX
  const rawBottom =
    (viewport.top - cameraGutterY + viewport.height) / zoom +
    VIEWPORT_OVERSCAN_PX
  const quantum = VIEWPORT_QUANTUM_PX
  const cullLeft = Math.floor(rawLeft / quantum) * quantum
  const cullTop = Math.floor(rawTop / quantum) * quantum
  const cullRight = Math.ceil(rawRight / quantum) * quantum
  const cullBottom = Math.ceil(rawBottom / quantum) * quantum

  const visibleTiles = useMemo(() => {
    const visible = new Map<
      string,
      { tile: Tile; left: number; top: number; style: CSSProperties }
    >()

    for (const row of layout.rows) {
      const rowTop = row[0]?.top ?? 0
      if (rowTop + HEX_HEIGHT < cullTop || rowTop > cullBottom) continue
      for (const entry of row) {
        if (entry.left + HEX_WIDTH < cullLeft || entry.left > cullRight) continue
        visible.set(entry.tile.id, entry)
      }
    }

    const persistentPositions = [
      ...state.units.map((unit) => unit.position),
      ...state.sites.flatMap((site) => getSiteOccupiedPositions(site)),
      combatAnimation?.attackerPosition,
      combatAnimation?.defenderPosition,
      siteAttackAnimation?.attackerPosition,
      siteAttackAnimation?.sitePosition,
      ...siteAssetPreviews.map((preview) => preview.position),
    ]
    for (const position of persistentPositions) {
      if (!position) continue
      const entry = layout.byKey.get(positionKey(position))
      if (entry) visible.set(entry.tile.id, entry)
    }
    for (const keys of [
      reachableKeys,
      attackableKeys,
      attackableSiteKeys,
      deployableKeys,
      developmentFootprintKeys,
      selectedDevelopmentFootprintKeys,
    ]) {
      for (const key of keys) {
        const entry = layout.byKey.get(key)
        if (entry) visible.set(entry.tile.id, entry)
      }
    }

    return [...visible.values()]
  }, [
    combatAnimation?.attackerPosition,
    combatAnimation?.defenderPosition,
    siteAttackAnimation?.attackerPosition,
    siteAttackAnimation?.sitePosition,
    layout,
    attackableKeys,
    attackableSiteKeys,
    deployableKeys,
    developmentFootprintKeys,
    reachableKeys,
    selectedDevelopmentFootprintKeys,
    siteAssetPreviews,
    state.sites,
    state.units,
    cullLeft,
    cullTop,
    cullRight,
    cullBottom,
  ])
  const hitEffects =
    combatAnimation?.phase === 'hit'
      ? [
          {
            unit: state.units.find((unit) => unit.id === combatAnimation.defenderId),
            damage: combatAnimation.damageToDefender,
          },
          {
            unit: state.units.find((unit) => unit.id === combatAnimation.attackerId),
            damage: combatAnimation.damageToAttacker,
          },
        ].filter(
          (effect): effect is { unit: Unit; damage: number } =>
            Boolean(effect.unit) && effect.damage > 0,
        )
      : []
  const combatVolleyAttacker =
    combatAnimation?.phase === 'attack'
      ? state.units.find(
          (unit) =>
            unit.id === combatAnimation.attackerId && unit.type === 'archer',
        )
      : undefined
  const siteVolleyAttacker =
    siteAttackAnimation?.phase === 'attack'
      ? state.units.find(
          (unit) =>
            unit.id === siteAttackAnimation.attackerId && unit.type === 'archer',
        )
      : undefined

  return (
    <div
      className="map-camera-space"
      style={{
        paddingBlock: cameraGutterY,
        paddingInline: cameraGutterX,
      }}
    >
    <div
      className="map-zoom-shell"
      data-camera-minimum-gutter-x={MAP_CAMERA_MINIMUM_GUTTER}
      data-camera-minimum-gutter-y={MAP_CAMERA_MINIMUM_GUTTER}
      data-camera-maximum-gutter-x={MAP_CAMERA_MAXIMUM_GUTTER}
      data-camera-maximum-gutter-y={MAP_CAMERA_MAXIMUM_GUTTER}
      style={{
        width: (logicalWidth + MAP_FRAME_PX) * zoom,
        height: (logicalHeight + MAP_FRAME_PX) * zoom,
      }}
    >
    <div
      className="game-map"
      data-testid="game-map"
      style={{
        width: logicalWidth,
        height: logicalHeight,
        transform: `scale(${zoom})`,
        transformOrigin: '0 0',
      }}
      onMouseLeave={() => onPreviewTileChange?.(undefined)}
    >
      <div className="map-layer map-layer--terrain">
        {visibleTiles.map(({ tile, style }) => {
          const tileKey = positionKey(tile.position)
          const unit = getUnitAt(state, tile.position)
          const site = getSiteAt(state, tile.position)
          const selected = Boolean(unit && unit.id === state.selectedUnitId)
          const siteSelected = Boolean(selectedSiteId && site?.id === selectedSiteId)
          const reachable = reachableKeys.has(tileKey)
          const reachableBoundaryMask = reachable
            ? getKeySetBoundaryMask(tile.position, reachableKeys)
            : 0
          const attackable = attackableKeys.has(tileKey)
          const attackableSite = attackableSiteKeys.has(
            tileKey,
          )
          const deployable = deployableKeys.has(tileKey)
          const developmentFootprint = developmentFootprintKeys.has(
            tileKey,
          )
          const foundingCandidate = foundingCandidateKeys.has(
            tileKey,
          )
          const selectedDevelopmentFootprint =
            selectedDevelopmentFootprintKeys.has(tileKey)
          const territoryOwner = territoryByKey.get(tileKey)
          const territoryBoundaryMask = territoryOwner
            ? getTerritoryBoundaryMask(
                tile.position,
                territoryByKey,
                territoryOwner,
              )
            : 0

          return (
            <TileButton
              key={tile.id}
              tile={tile}
              unit={unit}
              site={site}
              mapSeed={state.mapSeed}
              territoryOwner={territoryOwner}
              territoryBoundaryMask={territoryBoundaryMask}
              reachableBoundaryMask={reachableBoundaryMask}
              selected={selected}
              siteSelected={siteSelected}
              inspected={inspectedTileKey === positionKey(tile.position)}
              reachable={reachable}
              attackable={attackable}
              attackableSite={attackableSite}
              deployable={deployable}
              developmentFootprint={developmentFootprint}
              foundingCandidate={foundingCandidate}
              selectedDevelopmentFootprint={selectedDevelopmentFootprint}
              disabled={disabled}
              style={style}
              onClick={onTileClick}
              onContextMenu={onTileContextMenu}
              suppressClickRef={suppressClickRef}
              onPreviewTileChange={onPreviewTileChange}
            />
          )
        })}
      </div>

      <div className="map-layer map-layer--void-edge-shadow" aria-hidden="true">
        {visibleTiles.map(({ tile, style }) => {
          const boundaryMask = getKeySetBoundaryMask(tile.position, boardKeys)
          return boundaryMask > 0 ? (
            <VoidEdgeShadowMarker
              key={tile.id}
              boundaryMask={boundaryMask}
              style={style}
            />
          ) : null
        })}
      </div>

      <div className="map-layer map-layer--sites">
        {state.sites.map((site) => (
          <SiteMarker
            key={site.id}
            site={site}
            selected={site.id === selectedSiteId}
            attackable={attackableSiteKeys.has(positionKey(site.position))}
            siteAttackAnimation={siteAttackAnimation}
            style={getSiteOverlayStyle(site, minimumX, minimumY)}
          />
        ))}
        {siteAssetPreviews.map((preview) => (
          <SiteAssetPreviewMarker
            key={preview.kind}
            kind={preview.kind}
            position={preview.position}
            minimumX={minimumX}
            minimumY={minimumY}
          />
        ))}
      </div>

      <div className="map-layer map-layer--units" aria-hidden="true">
        {state.units.map((unit) => (
          <UnitMarker
            key={unit.id}
            unit={unit}
            selected={unit.id === state.selectedUnitId}
            attackable={attackableKeys.has(positionKey(unit.position))}
            combatAnimation={combatAnimation}
            siteAttackAnimation={siteAttackAnimation}
            style={getOverlayStyle(unit.position, minimumX, minimumY)}
          />
        ))}
      </div>

      <div className="map-layer map-layer--effects" aria-hidden="true">
        {combatVolleyAttacker && combatAnimation && (
          <ArrowVolley
            attacker={combatAnimation.attackerPosition}
            target={combatAnimation.defenderPosition}
            minimumX={minimumX}
            minimumY={minimumY}
          />
        )}
        {siteVolleyAttacker && siteAttackAnimation && (
          <ArrowVolley
            attacker={siteAttackAnimation.attackerPosition}
            target={siteAttackAnimation.sitePosition}
            minimumX={minimumX}
            minimumY={minimumY}
          />
        )}
        {hitEffects.map(({ unit, damage }) => (
          <span
            key={unit.id}
            className="map-overlay-cell"
            style={getOverlayStyle(unit.position, minimumX, minimumY)}
          >
            <span className="damage-popup">-{damage}</span>
          </span>
        ))}
        {siteAttackAnimation?.phase === 'hit' &&
          siteAttackAnimation.damage > 0 && (
            <span
              className="map-overlay-cell"
              style={getOverlayStyle(
                siteAttackAnimation.sitePosition,
                minimumX,
                minimumY,
              )}
            >
              <span className="damage-popup">-{siteAttackAnimation.damage}</span>
            </span>
          )}
      </div>

      {combatAnimation && (
        <span className="sr-only" role="status" aria-live="polite">
          {combatAnimation.phase === 'attack' && '전투 중'}
          {combatAnimation.phase === 'hit' &&
            (combatAnimation.damageToAttacker > 0
              ? `양쪽이 각각 ${combatAnimation.damageToDefender}, ${combatAnimation.damageToAttacker} 피해를 받았습니다`
              : `방어 유닛이 ${combatAnimation.damageToDefender} 피해를 받았습니다`)}
        </span>
      )}
    </div>
    </div>
    </div>
  )
}

export const GameMap = memo(GameMapComponent)
