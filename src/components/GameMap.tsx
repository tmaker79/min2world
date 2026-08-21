import type { CSSProperties } from 'react'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
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
  getUnitAt,
  positionKey,
  SITE_TYPE_LABELS,
  TERRAIN_COMBAT_BONUS,
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
import { useMapViewport } from '../hooks/useMapViewport'
import { SiteIcon } from './SiteIcon'
import { hasTerrainImage, TerrainIcon } from './TerrainIcon'
import { UnitIcon } from './UnitIcon'

const MAP_TOOLTIP_SHOW_DELAY_MS = 1000
const MAP_TOOLTIP_TOP_SAFE_PX = 120
const VIEWPORT_OVERSCAN_PX = Math.max(HEX_WIDTH, HEX_HEIGHT) * 2
/** Matches `.game-map` content-box padding (8*2) + border (1*2). */
const MAP_FRAME_PX = 18
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

type HoverTarget =
  | { kind: 'unit'; unitId: string; element: HTMLElement }
  | { kind: 'terrain'; tileKey: string; element: HTMLElement }

type GameMapProps = {
  state: GameState
  scrollElement: HTMLElement | null
  zoom?: number
  reachableKeys: Set<string>
  attackableKeys: Set<string>
  deployableKeys: Set<string>
  developmentFootprintKeys?: Set<string>
  selectedDevelopmentFootprintKeys?: Set<string>
  zoneOfControlKeys: Set<string>
  selectedSiteId?: string
  combatAnimation?: CombatAnimation
  showSiteAssetPreview?: boolean
  disabled: boolean
  suppressClickRef?: { current: boolean }
  onTileClick: (tile: Tile) => void
  onTileContextMenu?: (tile: Tile) => void
}

type TileButtonProps = {
  tile: Tile
  unit?: Unit
  site?: Site
  mapSeed: string
  selected: boolean
  siteSelected: boolean
  reachable: boolean
  attackable: boolean
  deployable: boolean
  developmentFootprint: boolean
  selectedDevelopmentFootprint: boolean
  inZoneOfControl: boolean
  disabled: boolean
  style: CSSProperties
  onClick: (tile: Tile) => void
  onContextMenu?: (tile: Tile) => void
  suppressClickRef?: { current: boolean }
  onHoverChange: (
    target: HoverTarget | undefined,
    options?: { immediate?: boolean },
  ) => void
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
    if (attackable) parts.push('공격 가능')
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
  return {
    left:
      pixels.reduce((total, pixel) => total + pixel.x, 0) / pixels.length -
      minimumX,
    top:
      pixels.reduce((total, pixel) => total + pixel.y, 0) / pixels.length -
      minimumY,
  }
}

function movementCostLabel(terrain: Tile['terrain']) {
  const cost = TERRAIN_MOVEMENT_COST[terrain]
  return cost === null ? '통과 불가' : String(cost)
}

function combatBonusLabel(terrain: Tile['terrain']) {
  const bonus = TERRAIN_COMBAT_BONUS[terrain]
  return bonus > 0 ? `+${bonus}` : '없음'
}

function getTerrainTooltipRows(tile: Tile, site?: Site) {
  const rows = [
    {
      label: '이동 비용',
      value: movementCostLabel(tile.terrain),
    },
  ]

  if (TERRAIN_COMBAT_BONUS[tile.terrain] > 0) {
    rows.push({
      label: '방어 보정치',
      value: combatBonusLabel(tile.terrain),
    })
  }

  if (site) {
    rows.push({
      label: '거점',
      value: `${site.name} (${factionLabel(site.ownerId)} ${SITE_TYPE_LABELS[site.kind]})`,
    })
  }

  return rows
}

const TileButton = memo(function TileButton({
  tile,
  unit,
  site,
  mapSeed,
  selected,
  siteSelected,
  reachable,
  attackable,
  deployable,
  developmentFootprint,
  selectedDevelopmentFootprint,
  inZoneOfControl,
  disabled,
  style,
  onClick,
  onContextMenu,
  suppressClickRef,
  onHoverChange,
}: TileButtonProps) {
  const classNames = [
    'map-tile',
    `map-tile--${tile.terrain}`,
    selected ? 'map-tile--selected' : '',
    siteSelected ? 'map-tile--site-selected' : '',
    reachable ? 'map-tile--reachable' : '',
    inZoneOfControl ? 'map-tile--zoc' : '',
    attackable ? 'map-tile--attackable' : '',
    deployable ? 'map-tile--deployable' : '',
    developmentFootprint ? 'map-tile--development-footprint' : '',
    selectedDevelopmentFootprint
      ? 'map-tile--development-footprint-selected'
      : '',
    unit ? 'map-tile--has-unit' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const announceHover = (
    element: HTMLElement,
    immediate = false,
  ) => {
    if (unit) {
      onHoverChange({ kind: 'unit', unitId: unit.id, element }, { immediate })
      return
    }
    onHoverChange(
      {
        kind: 'terrain',
        tileKey: positionKey(tile.position),
        element,
      },
      { immediate },
    )
  }

  return (
    <button
      className={classNames}
      style={style}
      type="button"
      aria-label={getTileLabel(
        tile,
        unit,
        site,
        attackable,
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
        onClick(tile)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        if (disabled || suppressClickRef?.current || !onContextMenu) {
          return
        }
        onContextMenu(tile)
      }}
      onMouseEnter={(event) => announceHover(event.currentTarget)}
      onMouseLeave={() => onHoverChange(undefined)}
      onFocus={(event) => announceHover(event.currentTarget, true)}
      onBlur={() => onHoverChange(undefined)}
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

function MapTooltip({
  title,
  subtitle,
  rows,
  placement,
  anchor,
  unitId,
  terrainKey,
}: {
  title: string
  subtitle?: string
  rows?: Array<{ label: string; value: string }>
  placement: 'above' | 'below'
  anchor: DOMRect
  unitId?: string
  terrainKey?: string
}) {
  return createPortal(
    <span
      className={`map-tooltip map-tooltip--fixed map-tooltip--${placement}`}
      role="tooltip"
      data-unit-tooltip={unitId}
      data-terrain-tooltip={terrainKey}
      style={{
        left: anchor.left + anchor.width / 2,
        top: placement === 'above' ? anchor.top : anchor.bottom,
      }}
    >
      <strong>{title}</strong>
      {subtitle && (
        <span className="map-tooltip__subtitle">{subtitle}</span>
      )}
      {rows && rows.length > 0 && (
        <dl>
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </span>,
    document.body,
  )
}

function UnitTooltip({
  unit,
  tile,
  placement,
  anchor,
}: {
  unit: Unit
  tile: Tile
  placement: 'above' | 'below'
  anchor: DOMRect
}) {
  return (
    <MapTooltip
      title={`${factionLabel(unit.factionId)} - ${unit.name}`}
      subtitle={TERRAIN_LABELS[tile.terrain]}
      rows={getTerrainTooltipRows(tile)}
      placement={placement}
      anchor={anchor}
      unitId={unit.id}
    />
  )
}

function TerrainTooltip({
  tile,
  site,
  placement,
  anchor,
}: {
  tile: Tile
  site?: Site
  placement: 'above' | 'below'
  anchor: DOMRect
}) {
  return (
    <MapTooltip
      title={TERRAIN_LABELS[tile.terrain]}
      rows={getTerrainTooltipRows(tile, site)}
      placement={placement}
      anchor={anchor}
      terrainKey={positionKey(tile.position)}
    />
  )
}

function SiteMarker({
  site,
  selected,
  style,
}: {
  site: Site
  selected: boolean
  style: CSSProperties
}) {
  return (
    <span className="map-overlay-cell" style={style}>
      <span
        className={`site-marker site-marker--${site.kind} site-marker--${site.ownerId}${
          selected ? ' site-marker--selected' : ''
        }`}
        data-owner={site.ownerId}
        data-site-selected={selected ? 'true' : undefined}
      >
        <SiteIcon kind={site.kind} ownerId={site.ownerId} level={site.level} />
        {site.ownerId !== 'neutral' && (
          <span className={`site-banner site-banner--${site.ownerId}`} />
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
  style,
  tokenRef,
}: {
  unit: Unit
  selected: boolean
  combatAnimation?: CombatAnimation
  style: CSSProperties
  tokenRef?: (element: HTMLSpanElement | null) => void
}) {
  const healthPercent = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))
  const healthLevel =
    healthPercent <= 30
      ? 'critical'
      : healthPercent < 100
        ? 'damaged'
        : 'healthy'
  const isAttacker = unit.id === combatAnimation?.attackerId
  const isDefender = unit.id === combatAnimation?.defenderId
  const meleeExchange = Boolean(
    combatAnimation && combatAnimation.damageToAttacker > 0,
  )
  const isStriking =
    combatAnimation?.phase === 'attack' &&
    (isAttacker || (isDefender && meleeExchange))
  const isHit =
    combatAnimation?.phase === 'hit' &&
    ((isDefender && combatAnimation.damageToDefender > 0) ||
      (isAttacker && combatAnimation.damageToAttacker > 0))
  const isDefeated =
    isHit &&
    ((isDefender && combatAnimation.defenderDefeated) ||
      (isAttacker && combatAnimation.attackerDefeated))
  const strikeTarget = isAttacker
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
        ref={tokenRef}
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
  deployableKeys,
  developmentFootprintKeys = new Set(),
  selectedDevelopmentFootprintKeys = new Set(),
  zoneOfControlKeys,
  selectedSiteId,
  combatAnimation,
  showSiteAssetPreview = false,
  disabled,
  suppressClickRef,
  onTileClick,
  onTileContextMenu,
}: GameMapProps) {
  const viewport = useMapViewport(scrollElement)
  const [hoveredUnitId, setHoveredUnitId] = useState<string>()
  const [hoveredTerrainKey, setHoveredTerrainKey] = useState<string>()
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect>()
  const hoverTimerRef = useRef<number | undefined>(undefined)
  const tooltipFrameRef = useRef<number | undefined>(undefined)
  const hoveredUnitIdRef = useRef<string | undefined>(undefined)
  const hoveredTerrainKeyRef = useRef<string | undefined>(undefined)
  const hoverElementRef = useRef<HTMLElement | null>(null)
  const unitTokenRefs = useRef(new Map<string, HTMLSpanElement>())

  useEffect(() => {
    return () => window.clearTimeout(hoverTimerRef.current)
  }, [])

  useLayoutEffect(() => {
    if (!hoveredUnitId && !hoveredTerrainKey) {
      return
    }

    const updateAnchor = () => {
      tooltipFrameRef.current = undefined
      const token = hoveredUnitId
        ? unitTokenRefs.current.get(hoveredUnitId)
        : undefined
      const element = token ?? hoverElementRef.current
      if (!element) {
        setTooltipAnchor(undefined)
        return
      }
      setTooltipAnchor(element.getBoundingClientRect())
    }
    const scheduleAnchorUpdate = () => {
      if (tooltipFrameRef.current !== undefined) return
      tooltipFrameRef.current = window.requestAnimationFrame(updateAnchor)
    }

    updateAnchor()
    scrollElement?.addEventListener('scroll', scheduleAnchorUpdate, {
      passive: true,
    })
    window.addEventListener('resize', scheduleAnchorUpdate)

    return () => {
      if (tooltipFrameRef.current !== undefined) {
        window.cancelAnimationFrame(tooltipFrameRef.current)
        tooltipFrameRef.current = undefined
      }
      scrollElement?.removeEventListener('scroll', scheduleAnchorUpdate)
      window.removeEventListener('resize', scheduleAnchorUpdate)
    }
  }, [hoveredTerrainKey, hoveredUnitId, scrollElement])

  const handleHoverChange = useCallback((
    target: HoverTarget | undefined,
    options?: { immediate?: boolean },
  ) => {
    window.clearTimeout(hoverTimerRef.current)

    if (!target) {
      hoveredUnitIdRef.current = undefined
      hoveredTerrainKeyRef.current = undefined
      hoverElementRef.current = null
      setHoveredUnitId(undefined)
      setHoveredTerrainKey(undefined)
      setTooltipAnchor(undefined)
      return
    }

    const applyHover = () => {
      hoverElementRef.current = target.element
      if (target.kind === 'unit') {
        hoveredUnitIdRef.current = target.unitId
        hoveredTerrainKeyRef.current = undefined
        setHoveredUnitId(target.unitId)
        setHoveredTerrainKey(undefined)
        return
      }
      hoveredUnitIdRef.current = undefined
      hoveredTerrainKeyRef.current = target.tileKey
      setHoveredUnitId(undefined)
      setHoveredTerrainKey(target.tileKey)
    }

    // Dismiss any visible tooltip while waiting on a new tile.
    hoveredUnitIdRef.current = undefined
    hoveredTerrainKeyRef.current = undefined
    hoverElementRef.current = target.element
    setHoveredUnitId(undefined)
    setHoveredTerrainKey(undefined)
    setTooltipAnchor(undefined)

    if (options?.immediate) {
      applyHover()
      return
    }

    hoverTimerRef.current = window.setTimeout(
      applyHover,
      MAP_TOOLTIP_SHOW_DELAY_MS,
    )
  }, [])

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
    const left = viewport.left / zoom - VIEWPORT_OVERSCAN_PX
    const top = viewport.top / zoom - VIEWPORT_OVERSCAN_PX
    const right = (viewport.left + viewport.width) / zoom + VIEWPORT_OVERSCAN_PX
    const bottom =
      (viewport.top + viewport.height) / zoom + VIEWPORT_OVERSCAN_PX
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
    layout,
    attackableKeys,
    deployableKeys,
    developmentFootprintKeys,
    reachableKeys,
    selectedDevelopmentFootprintKeys,
    siteAssetPreviews,
    state.sites,
    state.units,
    viewport,
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
  const hoveredUnit = hoveredUnitId
    ? state.units.find((unit) => unit.id === hoveredUnitId)
    : undefined
  const hoveredUnitTile = hoveredUnit
    ? layout.byKey.get(positionKey(hoveredUnit.position))?.tile
    : undefined
  const hoveredTerrain = hoveredTerrainKey
    ? layout.byKey.get(hoveredTerrainKey)?.tile
    : undefined
  const hoveredTerrainSite = hoveredTerrain
    ? getSiteAt(state, hoveredTerrain.position)
    : undefined
  const hoveredTooltipPlacement =
    tooltipAnchor && tooltipAnchor.top < MAP_TOOLTIP_TOP_SAFE_PX
      ? 'below'
      : hoveredUnit &&
          getHexPixelPosition(hoveredUnit.position).y - minimumY < HEX_HEIGHT
        ? 'below'
        : hoveredTerrain &&
            getHexPixelPosition(hoveredTerrain.position).y - minimumY < HEX_HEIGHT
          ? 'below'
          : 'above'

  return (
    <div
      className="map-zoom-shell"
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
      onMouseLeave={() => handleHoverChange(undefined)}
    >
      <div className="map-layer map-layer--terrain">
        {visibleTiles.map(({ tile, style }) => {
          const unit = getUnitAt(state, tile.position)
          const site = getSiteAt(state, tile.position)
          const selected = Boolean(unit && unit.id === state.selectedUnitId)
          const siteSelected = Boolean(selectedSiteId && site?.id === selectedSiteId)
          const reachable = reachableKeys.has(positionKey(tile.position))
          const attackable = attackableKeys.has(positionKey(tile.position))
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
              reachable={reachable}
              attackable={attackable}
              deployable={deployable}
              developmentFootprint={developmentFootprint}
              selectedDevelopmentFootprint={selectedDevelopmentFootprint}
              inZoneOfControl={inZoneOfControl}
              disabled={disabled}
              style={style}
              onClick={onTileClick}
              onContextMenu={onTileContextMenu}
              suppressClickRef={suppressClickRef}
              onHoverChange={handleHoverChange}
            />
          )
        })}
      </div>

      <div className="map-layer map-layer--sites" aria-hidden="true">
        {state.sites.map((site) => (
          <SiteMarker
            key={site.id}
            site={site}
            selected={site.id === selectedSiteId}
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
            style={getOverlayStyle(unit.position, minimumX, minimumY)}
            tokenRef={(element) => {
              if (element) {
                unitTokenRefs.current.set(unit.id, element)
              } else {
                unitTokenRefs.current.delete(unit.id)
              }
            }}
          />
        ))}
      </div>

      <div className="map-layer map-layer--effects" aria-hidden="true">
        {hitEffects.map(({ unit, damage }) => (
          <span
            key={unit.id}
            className="map-overlay-cell"
            style={getOverlayStyle(unit.position, minimumX, minimumY)}
          >
            <span className="damage-popup">-{damage}</span>
          </span>
        ))}
      </div>

      {hoveredUnit && hoveredUnitTile && tooltipAnchor && (
        <UnitTooltip
          unit={hoveredUnit}
          tile={hoveredUnitTile}
          placement={hoveredTooltipPlacement}
          anchor={tooltipAnchor}
        />
      )}
      {!hoveredUnit && hoveredTerrain && tooltipAnchor && (
        <TerrainTooltip
          tile={hoveredTerrain}
          site={hoveredTerrainSite}
          placement={hoveredTooltipPlacement}
          anchor={tooltipAnchor}
        />
      )}

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
  )
}

export const GameMap = memo(GameMapComponent)
