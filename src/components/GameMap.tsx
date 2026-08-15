import type { CSSProperties } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getHexPixelPosition, HEX_HEIGHT, HEX_WIDTH } from '../game/hex'
import {
  getSiteAt,
  getUnitAt,
  positionKey,
  getDisplayedCombatStrength,
  SITE_TYPE_LABELS,
  TERRAIN_LABELS,
  UNIT_STATS,
  UNIT_TYPE_LABELS,
} from '../game/rules'
import type { GameState, Position, Site, Tile, Unit } from '../game/types'
import { useMapViewport } from '../hooks/useMapViewport'
import { SiteIcon } from './SiteIcon'
import { hasTerrainImage, TerrainIcon } from './TerrainIcon'
import { UnitIcon } from './UnitIcon'

const UNIT_TOOLTIP_SHOW_DELAY_MS = 400
const UNIT_TOOLTIP_TOP_SAFE_PX = 120
const VIEWPORT_OVERSCAN_PX = Math.max(HEX_WIDTH, HEX_HEIGHT) * 2

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

type GameMapProps = {
  state: GameState
  scrollElement: HTMLElement | null
  reachableKeys: Set<string>
  attackableKeys: Set<string>
  deployableKeys: Set<string>
  zoneOfControlKeys: Set<string>
  selectedSiteId?: string
  combatAnimation?: CombatAnimation
  disabled: boolean
  suppressClickRef?: { current: boolean }
  onTileClick: (tile: Tile) => void
  onTileHoverChange?: (tile: Tile | undefined) => void
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
  inZoneOfControl: boolean
  disabled: boolean
  style: CSSProperties
  onClick: (tile: Tile) => void
  suppressClickRef?: { current: boolean }
  onUnitHoverChange: (unitId: string | undefined, options?: { immediate?: boolean }) => void
  onTileHoverChange?: (tile: Tile | undefined) => void
}

function ownerLabel(site: Site): string {
  const labels: Record<string, string> = {
    player: '푸른 연맹',
    enemy: '붉은 제국',
    f1: '청색 연맹',
    f2: '적색 제국',
    f3: '황금 왕국',
    f4: '자색 공국',
    neutral: '중립',
  }
  return labels[site.ownerId]
}

function getTileLabel(
  tile: Tile,
  unit?: Unit,
  site?: Site,
  attackable = false,
  inZoneOfControl = false,
  deployable = false,
) {
  const parts = [
    `육각 좌표 ${tile.position.q}, ${tile.position.r}`,
    TERRAIN_LABELS[tile.terrain],
  ]
  if (inZoneOfControl) parts.push('적 통제 구역')
  if (deployable) parts.push('생산 배치 가능')
  if (site) {
    parts.push(
      `${site.name}, ${ownerLabel(site)} ${SITE_TYPE_LABELS[site.kind]}`,
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

function getUnitStatusLabel(unit: Unit) {
  if (unit.hasActed) return '행동 완료'
  if (unit.movementRemaining === 0) return '공격만 가능'
  return '행동 가능'
}

function getUnitTooltipRows(unit: Unit) {
  const stats = UNIT_STATS[unit.type]
  const rows = [
    { label: '병종', value: UNIT_TYPE_LABELS[unit.type] },
    { label: '체력', value: `${unit.hp}/${unit.maxHp}` },
    { label: '근접', value: String(getDisplayedCombatStrength(unit, 'melee')) },
  ]

  if (stats.ranged > 0) {
    rows.push({
      label: '원거리',
      value: String(getDisplayedCombatStrength(unit, 'ranged')),
    })
  }

  rows.push({
    label: '이동',
    value: `${unit.movementRemaining}/${stats.movement}`,
  })

  rows.push({ label: '상태', value: getUnitStatusLabel(unit) })
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
  inZoneOfControl,
  disabled,
  style,
  onClick,
  suppressClickRef,
  onUnitHoverChange,
  onTileHoverChange,
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
    unit ? 'map-tile--has-unit' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classNames}
      style={style}
      type="button"
      aria-label={getTileLabel(tile, unit, site, attackable, inZoneOfControl, deployable)}
      aria-pressed={
        selected || siteSelected ? true : unit ? false : undefined
      }
      data-coordinate={positionKey(tile.position)}
      data-reachable={reachable ? 'true' : undefined}
      data-attackable={attackable ? 'true' : undefined}
      data-deployable={deployable ? 'true' : undefined}
      data-zone-of-control={inZoneOfControl ? 'true' : undefined}
      data-site-selected={siteSelected ? 'true' : undefined}
      disabled={disabled}
      onClick={() => {
        if (suppressClickRef?.current) {
          return
        }
        onClick(tile)
      }}
      onMouseEnter={() => {
        onTileHoverChange?.(tile)
        onUnitHoverChange(unit?.id)
      }}
      onMouseLeave={() => onUnitHoverChange(undefined)}
      onFocus={() => {
        onTileHoverChange?.(tile)
        onUnitHoverChange(unit?.id, { immediate: true })
      }}
      onBlur={() => onUnitHoverChange(undefined)}
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

function UnitTooltip({
  unit,
  placement,
  anchor,
}: {
  unit: Unit
  placement: 'above' | 'below'
  anchor: DOMRect
}) {
  return createPortal(
    <span
      className={`unit-tooltip unit-tooltip--fixed unit-tooltip--${placement}`}
      role="tooltip"
      data-unit-tooltip={unit.id}
      style={{
        left: anchor.left + anchor.width / 2,
        top: placement === 'above' ? anchor.top : anchor.bottom,
      }}
    >
      <strong>{unit.name}</strong>
      <dl>
        {getUnitTooltipRows(unit).map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </span>,
    document.body,
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
        <SiteIcon kind={site.kind} />
        {site.ownerId !== 'neutral' && (
          <span className={`site-banner site-banner--${site.ownerId}`} />
        )}
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
  reachableKeys,
  attackableKeys,
  deployableKeys,
  zoneOfControlKeys,
  selectedSiteId,
  combatAnimation,
  disabled,
  suppressClickRef,
  onTileClick,
  onTileHoverChange,
}: GameMapProps) {
  const viewport = useMapViewport(scrollElement)
  const [hoveredUnitId, setHoveredUnitId] = useState<string>()
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect>()
  const hoverTimerRef = useRef<number | undefined>(undefined)
  const tooltipFrameRef = useRef<number | undefined>(undefined)
  const hoveredUnitIdRef = useRef<string | undefined>(undefined)
  const unitTokenRefs = useRef(new Map<string, HTMLSpanElement>())

  useEffect(() => {
    return () => window.clearTimeout(hoverTimerRef.current)
  }, [])

  useEffect(() => {
    if (!hoveredUnitId) {
      return
    }

    const updateAnchor = () => {
      tooltipFrameRef.current = undefined
      const token = unitTokenRefs.current.get(hoveredUnitId)
      setTooltipAnchor(token?.getBoundingClientRect())
    }
    const scheduleAnchorUpdate = () => {
      if (tooltipFrameRef.current !== undefined) return
      tooltipFrameRef.current = window.requestAnimationFrame(updateAnchor)
    }

    scheduleAnchorUpdate()
    scrollElement?.addEventListener('scroll', scheduleAnchorUpdate, {
      passive: true,
    })
    window.addEventListener('resize', scheduleAnchorUpdate)

    return () => {
      if (tooltipFrameRef.current !== undefined) {
        window.cancelAnimationFrame(tooltipFrameRef.current)
      }
      scrollElement?.removeEventListener('scroll', scheduleAnchorUpdate)
      window.removeEventListener('resize', scheduleAnchorUpdate)
    }
  }, [hoveredUnitId, scrollElement])

  const handleUnitHoverChange = useCallback((
    unitId: string | undefined,
    options?: { immediate?: boolean },
  ) => {
    window.clearTimeout(hoverTimerRef.current)

    if (!unitId) {
      hoveredUnitIdRef.current = undefined
      setHoveredUnitId(undefined)
      return
    }

    if (options?.immediate || hoveredUnitIdRef.current) {
      hoveredUnitIdRef.current = unitId
      setHoveredUnitId(unitId)
      return
    }

    hoverTimerRef.current = window.setTimeout(() => {
      hoveredUnitIdRef.current = unitId
      setHoveredUnitId(unitId)
    }, UNIT_TOOLTIP_SHOW_DELAY_MS)
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
  const visibleTiles = useMemo(() => {
    const left = viewport.left - VIEWPORT_OVERSCAN_PX
    const top = viewport.top - VIEWPORT_OVERSCAN_PX
    const right = viewport.left + viewport.width + VIEWPORT_OVERSCAN_PX
    const bottom = viewport.top + viewport.height + VIEWPORT_OVERSCAN_PX
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
      ...state.sites.map((site) => site.position),
      combatAnimation?.attackerPosition,
      combatAnimation?.defenderPosition,
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
    reachableKeys,
    state.sites,
    state.units,
    viewport,
    zoneOfControlKeys,
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
  const hoveredTooltipPlacement =
    tooltipAnchor && tooltipAnchor.top < UNIT_TOOLTIP_TOP_SAFE_PX
      ? 'below'
      : hoveredUnit &&
          getHexPixelPosition(hoveredUnit.position).y - minimumY < HEX_HEIGHT
        ? 'below'
        : 'above'

  return (
    <div
      className="game-map"
      data-testid="game-map"
      style={{
        width: maximumX - minimumX + HEX_WIDTH,
        height: maximumY - minimumY + HEX_HEIGHT,
      }}
      onMouseLeave={() => onTileHoverChange?.(undefined)}
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
              inZoneOfControl={inZoneOfControl}
              disabled={disabled}
              style={style}
              onClick={onTileClick}
              suppressClickRef={suppressClickRef}
              onUnitHoverChange={handleUnitHoverChange}
              onTileHoverChange={onTileHoverChange}
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
            style={getOverlayStyle(site.position, minimumX, minimumY)}
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

      {hoveredUnit && tooltipAnchor && (
        <UnitTooltip
          unit={hoveredUnit}
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
  )
}

export const GameMap = memo(GameMapComponent)
