import { getCityAt, getUnitAt, positionKey } from '../game/rules'
import type {
  City,
  GameState,
  Position,
  Terrain,
  Tile,
  Unit,
} from '../game/types'

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

const TERRAIN_LABELS: Record<Terrain, string> = {
  plain: '평지',
  mountain: '산',
  water: '물',
}

const UNIT_LABELS = {
  infantry: '보병',
  cavalry: '기병',
} as const

type GameMapProps = {
  state: GameState
  reachableKeys: Set<string>
  attackableKeys: Set<string>
  zoneOfControlKeys: Set<string>
  combatAnimation?: CombatAnimation
  disabled: boolean
  onTileClick: (tile: Tile) => void
}

type TileButtonProps = {
  tile: Tile
  unit?: Unit
  city?: City
  selected: boolean
  reachable: boolean
  attackable: boolean
  inZoneOfControl: boolean
  combatAnimation?: CombatAnimation
  disabled: boolean
  onClick: () => void
}

function getTileLabel(
  tile: Tile,
  unit?: Unit,
  city?: City,
  attackable = false,
  inZoneOfControl = false,
) {
  const parts = [
    `좌표 ${tile.position.x}, ${tile.position.y}`,
    TERRAIN_LABELS[tile.terrain],
  ]

  if (inZoneOfControl) {
    parts.push('적 통제 구역')
  }

  if (city) {
    parts.push(`${city.name}, ${city.ownerId === 'player' ? '푸른 연맹' : '붉은 제국'} 도시`)
  }

  if (unit) {
    parts.push(`${unit.name}, ${UNIT_LABELS[unit.type]}`)
    parts.push(`체력 ${unit.hp}/${unit.maxHp}`)
    parts.push(
      unit.hasActed
        ? '행동 완료'
        : unit.movementRemaining === 0
          ? '공격만 가능'
          : '행동 가능',
    )
    if (attackable) {
      parts.push('공격 가능')
    }
  }

  return parts.join(', ')
}

function TileButton({
  tile,
  unit,
  city,
  selected,
  reachable,
  attackable,
  inZoneOfControl,
  combatAnimation,
  disabled,
  onClick,
}: TileButtonProps) {
  const healthPercent = unit
    ? Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))
    : 0
  const healthLevel =
    healthPercent <= 30
      ? 'critical'
      : healthPercent < 100
        ? 'damaged'
        : 'healthy'
  const isAttacker = unit?.id === combatAnimation?.attackerId
  const isDefender = unit?.id === combatAnimation?.defenderId
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
  const strikeX = unit && strikeTarget ? (strikeTarget.x - unit.position.x) * 18 : 0
  const strikeY = unit && strikeTarget ? (strikeTarget.y - unit.position.y) * 18 : 0
  const classNames = [
    'map-tile',
    `map-tile--${tile.terrain}`,
    selected ? 'map-tile--selected' : '',
    reachable ? 'map-tile--reachable' : '',
    inZoneOfControl ? 'map-tile--zoc' : '',
    attackable ? 'map-tile--attackable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classNames}
      type="button"
      aria-label={getTileLabel(
        tile,
        unit,
        city,
        attackable,
        inZoneOfControl,
      )}
      aria-pressed={unit ? selected : undefined}
      data-coordinate={positionKey(tile.position)}
      data-reachable={reachable ? 'true' : undefined}
      data-attackable={attackable ? 'true' : undefined}
      data-zone-of-control={inZoneOfControl ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="tile-coordinate" aria-hidden="true">
        {tile.position.x},{tile.position.y}
      </span>

      {tile.terrain === 'mountain' && (
        <span className="terrain-mark terrain-mark--mountain" aria-hidden="true">
          ▲
        </span>
      )}
      {tile.terrain === 'water' && (
        <span className="terrain-mark terrain-mark--water" aria-hidden="true">
          ≋
        </span>
      )}

      {city && (
        <span
          className={`city-marker city-marker--${city.ownerId}`}
          aria-hidden="true"
        >
          성
        </span>
      )}

      {unit && (
        <span
          className={`unit-token unit-token--${unit.factionId} ${
            unit.hasActed ? 'unit-token--acted' : ''
          } ${isStriking ? 'unit-token--striking' : ''} ${
            isHit ? 'unit-token--hit' : ''
          } ${isDefeated ? 'unit-token--defeated' : ''}`}
          aria-hidden="true"
          data-unit-id={unit.id}
          data-health={`${unit.hp}/${unit.maxHp}`}
          style={
            {
              '--strike-x': `${strikeX}px`,
              '--strike-y': `${strikeY}px`,
            } as React.CSSProperties
          }
        >
          <span className="unit-symbol">
            {unit.type === 'infantry' ? '보' : '기'}
          </span>
          <span className={`unit-health-value unit-health-value--${healthLevel}`}>
            {unit.hp}
          </span>
          <span className="unit-health-bar">
            <span
              className={`unit-health-bar__fill unit-health-bar__fill--${healthLevel}`}
              style={{ width: `${healthPercent}%` }}
            />
          </span>
        </span>
      )}
      {unit && isHit && (
        <span className="damage-popup" aria-hidden="true">
          -
          {isDefender
            ? combatAnimation?.damageToDefender
            : combatAnimation?.damageToAttacker}
        </span>
      )}
    </button>
  )
}

export function GameMap({
  state,
  reachableKeys,
  attackableKeys,
  zoneOfControlKeys,
  combatAnimation,
  disabled,
  onTileClick,
}: GameMapProps) {
  return (
    <div className="game-map" data-testid="game-map">
      {state.tiles.map((tile) => {
        const unit = getUnitAt(state, tile.position)
        const city = getCityAt(state, tile.position)
        const selected = Boolean(unit && unit.id === state.selectedUnitId)
        const reachable = reachableKeys.has(positionKey(tile.position))
        const attackable = attackableKeys.has(positionKey(tile.position))
        const inZoneOfControl = zoneOfControlKeys.has(
          positionKey(tile.position),
        )

        return (
          <TileButton
            key={tile.id}
            tile={tile}
            unit={unit}
            city={city}
            selected={selected}
            reachable={reachable}
            attackable={attackable}
            inZoneOfControl={inZoneOfControl}
            combatAnimation={combatAnimation}
            disabled={disabled}
            onClick={() => onTileClick(tile)}
          />
        )
      })}
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
