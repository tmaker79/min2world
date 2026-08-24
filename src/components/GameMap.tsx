import type { CSSProperties } from 'react'
import { memo, useMemo } from 'react'
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
import {
  getHexDistance,
  getHexPixelPosition,
  HEX_HEIGHT,
  HEX_WIDTH,
} from '../game/hex'
import {
  getSiteAt,
  getSiteCombatStats,
  getSiteMaxHp,
  getUnitAt,
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
/** Matches `.game-map` content-box padding (8*2) + border (1*2). */
const MAP_FRAME_PX = 18
const MAP_CAMERA_MINIMUM_GUTTER_X = 12
const MAP_CAMERA_MINIMUM_GUTTER_Y = 8
const MAP_CAMERA_EDGE_CENTER_X = (HEX_WIDTH + MAP_FRAME_PX) / 2
const MAP_CAMERA_EDGE_CENTER_Y = (HEX_HEIGHT + MAP_FRAME_PX) / 2
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
const SITE_ASSET_PREVIEW_ICONS = {
  ...PRODUCTION_SITE_ASSET_PREVIEW_ICONS,
  ...MILITARY_SITE_ASSET_PREVIEW_ICONS,
} as const
type SiteAssetPreviewKind = keyof typeof SITE_ASSET_PREVIEW_ICONS

export type CombatAnimationPhase = 'attack' | 'hit'

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
  scrollElement: HTMLElement | null
  zoom?: number
  reachableKeys: Set<string>
  attackableKeys: Set<string>
  attackableSiteKeys?: Set<string>
  deployableKeys: Set<string>
  developmentFootprintKeys?: Set<string>
  selectedDevelopmentFootprintKeys?: Set<string>
  zoneOfControlKeys: Set<string>
  selectedSiteId?: string
  inspectedTileKey?: string
  combatAnimation?: CombatAnimation
  siteAttackAnimation?: SiteAttackAnimation
  showSiteAssetPreview?: boolean
  disabled: boolean
  suppressClickRef?: { current: boolean }
  onTileClick: (tile: Tile) => void
  onTileContextMenu?: (tile: Tile) => void
  onPreviewTileChange?: (tileKey?: string) => void
}

type TileButtonProps = {
  tile: Tile
  unit?: Unit
  site?: Site
  mapSeed: string
  selected: boolean
  siteSelected: boolean
  inspected: boolean
  reachable: boolean
  attackable: boolean
  attackableSite: boolean
  deployable: boolean
  developmentFootprint: boolean
  selectedDevelopmentFootprint: boolean
  inZoneOfControl: boolean
  disabled: boolean
  style: CSSProperties
  onClick: (tile: Tile) => void
  onContextMenu?: (tile: Tile) => void
  suppressClickRef?: { current: boolean }
  onPreviewTileChange?: (tileKey?: string) => void
}

function factionLabel(factionId: string): string {
  const labels: Record<string, string> = {
    player: '푸른 연맹',
    enemy: '붉은 제국',
    f1: '청색 연맹',
    f2: '적색 제국',
    f3: '황금 왕국',
    f4: '자색 공국',
    neutral: '중립',
  }
  return labels[factionId] ?? factionId
}

function getTileLabel(
  tile: Tile,
  unit?: Unit,
  site?: Site,
  attackable = false,
  inZoneOfControl = false,
  deployable = false,
  developmentFootprint = false,
  selectedDevelopmentFootprint = false,
) {
  const parts = [
    `육각 좌표 ${tile.position.q}, ${tile.position.r}`,
    TERRAIN_LABELS[tile.terrain],
  ]
  if (inZoneOfControl) parts.push('적 통제 구역')
  if (deployable) parts.push('생산 배치 가능')
  if (developmentFootprint) {
    parts.push(
      selectedDevelopmentFootprint ? '선택한 발전 footprint' : '발전 footprint 후보',
    )
  }
  if (site) {
    parts.push(
      `${site.name}, ${factionLabel(site.ownerId)} ${SITE_TYPE_LABELS[site.kind]}`,
    )
    if (attackable) parts.push('공격 가능')
  }
  if (unit) {
    parts.push(`${unit.name}, ${UNIT_TYPE_LABELS[unit.type]}`)
    parts.push(`체력 ${unit.hp}/${unit.maxHp}`)
    parts.push(
      unit.hasActed
        ? '행동 완료'
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
  selected,
  siteSelected,
  inspected,
  reachable,
  attackable,
  attackableSite,
  deployable,
  developmentFootprint,
  selectedDevelopmentFootprint,
  inZoneOfControl,
  disabled,
  style,
  onClick,
  onContextMenu,
  suppressClickRef,
  onPreviewTileChange,
}: TileButtonProps) {
  const classNames = [
    'map-tile',
    `map-tile--${tile.terrain}`,
    selected ? 'map-tile--selected' : '',
    siteSelected ? 'map-tile--site-selected' : '',
    inspected ? 'map-tile--inspected' : '',
    reachable ? 'map-tile--reachable' : '',
    inZoneOfControl ? 'map-tile--zoc' : '',
    attackable ? 'map-tile--attackable' : '',
    attackableSite ? 'map-tile--attackable-site' : '',
    deployable ? 'map-tile--deployable' : '',
    developmentFootprint ? 'map-tile--development-footprint' : '',
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
        inZoneOfControl,
        deployable,
        developmentFootprint,
        selectedDevelopmentFootprint,
      )}
      aria-pressed={
        selected || siteSelected ? true : unit ? false : undefined
      }
      data-coordinate={positionKey(tile.position)}
      data-reachable={reachable ? 'true' : undefined}
      data-attackable={attackable ? 'true' : undefined}
      data-attackable-site={attackableSite ? 'true' : undefined}
      data-deployable={deployable ? 'true' : undefined}
      data-development-footprint={developmentFootprint ? 'true' : undefined}
      data-development-footprint-selected={
        selectedDevelopmentFootprint ? 'true' : undefined
      }
      data-zone-of-control={inZoneOfControl ? 'true' : undefined}
      data-site-selected={siteSelected ? 'true' : undefined}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled || suppressClickRef?.current) {
          return
        }
        onPreviewTileChange?.(undefined)
        onClick(tile)
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
    </button>
  )
})

function SiteMarker({
  site,
  selected,
  siteAttackAnimation,
  style,
}: {
  site: Site
  selected: boolean
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
    <span className="map-overlay-cell" style={style}>
      <span
        className={`site-marker${
          site.kind === 'town' || site.kind === 'city'
            ? ' site-marker--multi'
            : ''
        } site-marker--${site.kind} site-marker--${site.ownerId}${
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
  return (
    <span
      className="map-overlay-cell"
      style={getOverlayStyle(position, minimumX, minimumY)}
    >
      <span
        className="site-asset-preview"
        data-site-asset-preview={kind}
        data-site-asset-preview-footprint="1"
      >
        <img
          src={SITE_ASSET_PREVIEW_ICONS[kind]}
          alt=""
          data-site-icon={kind}
          data-site-icon-variant="western"
        />
      </span>
    </span>
  )
}

function UnitMarker({
  unit,
  selected,
  combatAnimation,
  siteAttackAnimation,
  style,
}: {
  unit: Unit
  selected: boolean
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
    <span className="map-overlay-cell" style={style}>
      <span
        className={`unit-token unit-token--${unit.factionId} ${
          selected ? 'unit-token--selected' : ''
        } ${unit.hasActed ? 'unit-token--acted' : ''} ${
          isStriking ? 'unit-token--striking' : ''
        } ${isHit ? 'unit-token--hit' : ''} ${
          isDefeated ? 'unit-token--defeated' : ''
        }`}
        data-unit-id={unit.id}
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
  scrollElement,
  zoom = 1,
  reachableKeys,
  attackableKeys,
  attackableSiteKeys = new Set(),
  deployableKeys,
  developmentFootprintKeys = new Set(),
  selectedDevelopmentFootprintKeys = new Set(),
  zoneOfControlKeys,
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
    MAP_CAMERA_EDGE_CENTER_X,
    zoom,
    MAP_CAMERA_MINIMUM_GUTTER_X,
  )
  const cameraGutterY = getMapCameraGutter(
    scrollElement?.clientHeight ?? 0,
    MAP_CAMERA_EDGE_CENTER_Y,
    zoom,
    MAP_CAMERA_MINIMUM_GUTTER_Y,
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
      (site) => site.capitalFor === 'f1' || site.capitalFor === 'player',
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
  }, [showSiteAssetPreview, state.sites, state.tiles, state.units])
  const visibleTiles = useMemo(() => {
    const left =
      (viewport.left - cameraGutterX) / zoom - VIEWPORT_OVERSCAN_PX
    const top =
      (viewport.top - cameraGutterY) / zoom - VIEWPORT_OVERSCAN_PX
    const right =
      (viewport.left - cameraGutterX + viewport.width) / zoom +
      VIEWPORT_OVERSCAN_PX
    const bottom =
      (viewport.top - cameraGutterY + viewport.height) / zoom +
      VIEWPORT_OVERSCAN_PX
    const visible = new Map<
      string,
      { tile: Tile; left: number; top: number; style: CSSProperties }
    >()

    for (const row of layout.rows) {
      const rowTop = row[0]?.top ?? 0
      if (rowTop + HEX_HEIGHT < top || rowTop > bottom) continue
      for (const entry of row) {
        if (entry.left + HEX_WIDTH < left || entry.left > right) continue
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
    for (const key of [
      ...reachableKeys,
      ...attackableKeys,
      ...attackableSiteKeys,
      ...deployableKeys,
      ...developmentFootprintKeys,
      ...selectedDevelopmentFootprintKeys,
      ...zoneOfControlKeys,
    ]) {
      const entry = layout.byKey.get(key)
      if (entry) visible.set(entry.tile.id, entry)
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
    viewport,
    cameraGutterX,
    cameraGutterY,
    zoneOfControlKeys,
    zoom,
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
      data-camera-edge-center-x={MAP_CAMERA_EDGE_CENTER_X}
      data-camera-edge-center-y={MAP_CAMERA_EDGE_CENTER_Y}
      data-camera-minimum-gutter-x={MAP_CAMERA_MINIMUM_GUTTER_X}
      data-camera-minimum-gutter-y={MAP_CAMERA_MINIMUM_GUTTER_Y}
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
          const unit = getUnitAt(state, tile.position)
          const site = getSiteAt(state, tile.position)
          const selected = Boolean(unit && unit.id === state.selectedUnitId)
          const siteSelected = Boolean(selectedSiteId && site?.id === selectedSiteId)
          const reachable = reachableKeys.has(positionKey(tile.position))
          const attackable = attackableKeys.has(positionKey(tile.position))
          const attackableSite = attackableSiteKeys.has(
            positionKey(tile.position),
          )
          const deployable = deployableKeys.has(positionKey(tile.position))
          const developmentFootprint = developmentFootprintKeys.has(
            positionKey(tile.position),
          )
          const selectedDevelopmentFootprint =
            selectedDevelopmentFootprintKeys.has(positionKey(tile.position))
          const inZoneOfControl = zoneOfControlKeys.has(positionKey(tile.position))

          return (
            <TileButton
              key={tile.id}
              tile={tile}
              unit={unit}
              site={site}
              mapSeed={state.mapSeed}
              selected={selected}
              siteSelected={siteSelected}
              inspected={inspectedTileKey === positionKey(tile.position)}
              reachable={reachable}
              attackable={attackable}
              attackableSite={attackableSite}
              deployable={deployable}
              developmentFootprint={developmentFootprint}
              selectedDevelopmentFootprint={selectedDevelopmentFootprint}
              inZoneOfControl={inZoneOfControl}
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

      <div className="map-layer map-layer--sites">
        {state.sites.map((site) => (
          <SiteMarker
            key={site.id}
            site={site}
            selected={site.id === selectedSiteId}
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
