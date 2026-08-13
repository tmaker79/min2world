import { getCityAt, getUnitAt, positionKey } from '../game/rules'
import type { City, GameState, Terrain, Tile, Unit } from '../game/types'

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
  disabled: boolean
  onClick: () => void
}

function getTileLabel(
  tile: Tile,
  unit?: Unit,
  city?: City,
  attackable = false,
) {
  const parts = [
    `좌표 ${tile.position.x}, ${tile.position.y}`,
    TERRAIN_LABELS[tile.terrain],
  ]

  if (city) {
    parts.push(`${city.name}, ${city.ownerId === 'player' ? '푸른 연맹' : '붉은 제국'} 도시`)
  }

  if (unit) {
    parts.push(`${unit.name}, ${UNIT_LABELS[unit.type]}`)
    parts.push(`체력 ${unit.hp}/${unit.maxHp}`)
    parts.push(unit.hasActed ? '행동 완료' : '행동 가능')
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
  const classNames = [
    'map-tile',
    `map-tile--${tile.terrain}`,
    selected ? 'map-tile--selected' : '',
    reachable ? 'map-tile--reachable' : '',
    attackable ? 'map-tile--attackable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classNames}
      type="button"
      aria-label={getTileLabel(tile, unit, city, attackable)}
      aria-pressed={unit?.factionId === 'player' ? selected : undefined}
      data-coordinate={positionKey(tile.position)}
      data-reachable={reachable ? 'true' : undefined}
      data-attackable={attackable ? 'true' : undefined}
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
          }`}
          aria-hidden="true"
          data-unit-id={unit.id}
          data-health={`${unit.hp}/${unit.maxHp}`}
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
    </button>
  )
}

export function GameMap({
  state,
  reachableKeys,
  attackableKeys,
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

        return (
          <TileButton
            key={tile.id}
            tile={tile}
            unit={unit}
            city={city}
            selected={selected}
            reachable={reachable}
            attackable={attackable}
            disabled={disabled}
            onClick={() => onTileClick(tile)}
          />
        )
      })}
    </div>
  )
}
