import type { CSSProperties } from 'react'
import { useState } from 'react'
import { getHexPixelPosition, HEX_HEIGHT, HEX_WIDTH } from '../game/hex'
import {
  getSiteAt,
  getUnitAt,
  positionKey,
  SITE_TYPE_LABELS,
  TERRAIN_LABELS,
  UNIT_STATS,
  UNIT_TYPE_LABELS,
} from '../game/rules'
import type { GameState, Position, Site, Tile, Unit } from '../game/types'
import { UnitIcon } from './UnitIcon'

export type CombatAnimationPhase =
  | 'attack'
  | 'defenderHit'
  | 'counter'
  | 'attackerHit'

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
  reachableKeys: Set<string>
  attackableKeys: Set<string>
  deployableKeys: Set<string>
  zoneOfControlKeys: Set<string>
  combatAnimation?: CombatAnimation
  disabled: boolean
  onTileClick: (tile: Tile) => void
}

type TileButtonProps = {
  tile: Tile
  unit?: Unit
  site?: Site
  selected: boolean
  reachable: boolean
  attackable: boolean
  deployable: boolean
  inZoneOfControl: boolean
  disabled: boolean
  style: CSSProperties
  onClick: () => void
  onUnitHoverChange: (unitId: string | undefined) => void
}

function ownerLabel(site: Site): string {
  if (site.ownerId === 'player') return '푸른 연맹'
  if (site.ownerId === 'enemy') return '붉은 제국'
  return '중립'
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

function getTerrainMark(terrain: Tile['terrain']): string | undefined {
  return {
    plain: undefined,
    mountain: '▲',
    water: '≋',
    hill: '◒',
    forest: '♣',
  }[terrain]
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
  const rows = [
    { label: '병종', value: UNIT_TYPE_LABELS[unit.type] },
    { label: '체력', value: `${unit.hp}/${unit.maxHp}` },
  ]

  if (unit.factionId === 'player') {
    rows.push({
      label: '이동',
      value: `${unit.movementRemaining}/${UNIT_STATS[unit.type].movement}`,
    })
  }

  rows.push({ label: '상태', value: getUnitStatusLabel(unit) })
  return rows
}

function TileButton({
  tile,
  unit,
  site,
  selected,
  reachable,
  attackable,
  deployable,
  inZoneOfControl,
  disabled,
  style,
  onClick,
  onUnitHoverChange,
}: TileButtonProps) {
  const terrainMark = getTerrainMark(tile.terrain)
  const classNames = [
    'map-tile',
    `map-tile--${tile.terrain}`,
    selected ? 'map-tile--selected' : '',
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
      aria-pressed={unit ? selected : undefined}
      data-coordinate={positionKey(tile.position)}
      data-reachable={reachable ? 'true' : undefined}
      data-attackable={attackable ? 'true' : undefined}
      data-deployable={deployable ? 'true' : undefined}
      data-zone-of-control={inZoneOfControl ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => onUnitHoverChange(unit?.id)}
      onMouseLeave={() => onUnitHoverChange(undefined)}
      onFocus={() => onUnitHoverChange(unit?.id)}
      onBlur={() => onUnitHoverChange(undefined)}
    >
      {terrainMark && (
        <span className={`terrain-mark terrain-mark--${tile.terrain}`} aria-hidden="true">
          {terrainMark}
        </span>
      )}
    </button>
  )
}

function UnitTooltip({
  unit,
  style,
  placement,
}: {
  unit: Unit
  style: CSSProperties
  placement: 'above' | 'below'
}) {
  return (
    <span className="map-overlay-cell map-overlay-cell--tooltip" style={style}>
      <span
        className={`unit-tooltip unit-tooltip--${placement}`}
        role="tooltip"
        data-unit-tooltip={unit.id}
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
      </span>
    </span>
  )
}

function SiteMarker({
  site,
  style,
}: {
  site: Site
  style: CSSProperties
}) {
  return (
    <span className="map-overlay-cell" style={style}>
      <span
        className={`site-marker site-marker--${site.kind} site-marker--${site.ownerId}`}
      >
        {site.kind === 'stronghold'
          ? '성'
          : site.kind === 'city'
            ? '도'
            : site.kind === 'village'
              ? '촌'
              : '광'}
      </span>
    </span>
  )
}

function UnitMarker({
  unit,
  combatAnimation,
  style,
}: {
  unit: Unit
  combatAnimation?: CombatAnimation
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
  const isDefender = unit.id === combatAnimation?.defenderId
  const isStriking =
    (isAttacker && combatAnimation?.phase === 'attack') ||
    (isDefender && combatAnimation?.phase === 'counter')
  const isHit =
    (isDefender && combatAnimation?.phase === 'defenderHit') ||
    (isAttacker && combatAnimation?.phase === 'attackerHit')
  const isDefeated =
    isHit &&
    ((isDefender && combatAnimation?.defenderDefeated) ||
      (isAttacker && combatAnimation?.attackerDefeated))
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
        className={`unit-token unit-token--${unit.factionId} ${
          unit.hasActed ? 'unit-token--acted' : ''
        } ${isStriking ? 'unit-token--striking' : ''} ${
          isHit ? 'unit-token--hit' : ''
        } ${isDefeated ? 'unit-token--defeated' : ''}`}
        data-unit-id={unit.id}
        data-coordinate={positionKey(unit.position)}
        data-health={`${unit.hp}/${unit.maxHp}`}
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

export function GameMap({
  state,
  reachableKeys,
  attackableKeys,
  deployableKeys,
  zoneOfControlKeys,
  combatAnimation,
  disabled,
  onTileClick,
}: GameMapProps) {
  const [hoveredUnitId, setHoveredUnitId] = useState<string>()
  const pixelPositions = state.tiles.map((tile) => getHexPixelPosition(tile.position))
  const minimumX = Math.min(...pixelPositions.map((position) => position.x))
  const minimumY = Math.min(...pixelPositions.map((position) => position.y))
  const maximumX = Math.max(...pixelPositions.map((position) => position.x))
  const maximumY = Math.max(...pixelPositions.map((position) => position.y))
  const hitUnit = combatAnimation?.phase === 'defenderHit'
    ? state.units.find((unit) => unit.id === combatAnimation.defenderId)
    : combatAnimation?.phase === 'attackerHit'
      ? state.units.find((unit) => unit.id === combatAnimation.attackerId)
      : undefined
  const hitDamage = combatAnimation?.phase === 'defenderHit'
    ? combatAnimation.damageToDefender
    : combatAnimation?.phase === 'attackerHit'
      ? combatAnimation.damageToAttacker
      : undefined
  const hoveredUnit = hoveredUnitId
    ? state.units.find((unit) => unit.id === hoveredUnitId)
    : undefined
  const hoveredTooltipPlacement =
    hoveredUnit &&
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
    >
      <div className="map-layer map-layer--terrain">
        {state.tiles.map((tile) => {
          const unit = getUnitAt(state, tile.position)
          const site = getSiteAt(state, tile.position)
          const selected = Boolean(unit && unit.id === state.selectedUnitId)
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
              selected={selected}
              reachable={reachable}
              attackable={attackable}
              deployable={deployable}
              inZoneOfControl={inZoneOfControl}
              disabled={disabled}
              style={getOverlayStyle(tile.position, minimumX, minimumY)}
              onClick={() => onTileClick(tile)}
              onUnitHoverChange={setHoveredUnitId}
            />
          )
        })}
      </div>

      <div className="map-layer map-layer--sites" aria-hidden="true">
        {state.sites.map((site) => (
          <SiteMarker
            key={site.id}
            site={site}
            style={getOverlayStyle(site.position, minimumX, minimumY)}
          />
        ))}
      </div>

      <div className="map-layer map-layer--units" aria-hidden="true">
        {state.units.map((unit) => (
          <UnitMarker
            key={unit.id}
            unit={unit}
            combatAnimation={combatAnimation}
            style={getOverlayStyle(unit.position, minimumX, minimumY)}
          />
        ))}
      </div>

      <div className="map-layer map-layer--effects" aria-hidden="true">
        {hitUnit && hitDamage !== undefined && (
          <span
            className="map-overlay-cell"
            style={getOverlayStyle(hitUnit.position, minimumX, minimumY)}
          >
            <span className="damage-popup">-{hitDamage}</span>
          </span>
        )}
      </div>

      <div className="map-layer map-layer--tooltips" aria-hidden="true">
        {hoveredUnit && (
          <UnitTooltip
            unit={hoveredUnit}
            placement={hoveredTooltipPlacement}
            style={getOverlayStyle(hoveredUnit.position, minimumX, minimumY)}
          />
        )}
      </div>

      {combatAnimation && (
        <span className="sr-only" role="status" aria-live="polite">
          {combatAnimation.phase === 'attack' && '공격 중'}
          {combatAnimation.phase === 'defenderHit' &&
            `방어 유닛이 ${combatAnimation.damageToDefender} 피해를 받았습니다`}
          {combatAnimation.phase === 'counter' && '반격 중'}
          {combatAnimation.phase === 'attackerHit' &&
            `공격 유닛이 ${combatAnimation.damageToAttacker} 피해를 받았습니다`}
        </span>
      )}
    </div>
  )
}
