import type {
  City,
  FactionId,
  GameState,
  Position,
  Terrain,
  Unit,
  UnitStats,
  UnitType,
} from './types'

export const BOARD_SIZE = 10

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: {
    movement: 2,
    attack: 4,
    counterAttack: 3,
  },
  cavalry: {
    movement: 3,
    attack: 5,
    counterAttack: 2,
  },
}

export const TERRAIN_MOVEMENT_COST: Record<Terrain, number | null> = {
  plain: 1,
  mountain: 2,
  water: null,
}

export function positionKey(position: Position): string {
  return `${position.x},${position.y}`
}

export function positionsEqual(left: Position, right: Position): boolean {
  return left.x === right.x && left.y === right.y
}

export function isPositionOnBoard(position: Position): boolean {
  return (
    position.x >= 0 &&
    position.x < BOARD_SIZE &&
    position.y >= 0 &&
    position.y < BOARD_SIZE
  )
}

export function getTileAt(state: GameState, position: Position) {
  return state.tiles.find((tile) => positionsEqual(tile.position, position))
}

export function getUnitAt(state: GameState, position: Position) {
  return state.units.find((unit) => positionsEqual(unit.position, position))
}

export function getCityAt(state: GameState, position: Position) {
  return state.cities.find((city) => positionsEqual(city.position, position))
}

export function areOrthogonallyAdjacent(
  left: Position,
  right: Position,
): boolean {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1
}

function getOrthogonalNeighbors(position: Position): Position[] {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y },
  ].filter(isPositionOnBoard)
}

export function getEnemyZoneOfControlPositions(
  state: GameState,
  factionId: FactionId,
): Position[] {
  const positions = new Map<string, Position>()

  for (const unit of state.units) {
    if (unit.factionId === factionId) {
      continue
    }

    for (const position of getOrthogonalNeighbors(unit.position)) {
      positions.set(positionKey(position), position)
    }
  }

  return [...positions.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, position]) => position)
}

export function isPositionInEnemyZoneOfControl(
  state: GameState,
  factionId: FactionId,
  position: Position,
): boolean {
  return state.units.some(
    (unit) =>
      unit.factionId !== factionId &&
      areOrthogonallyAdjacent(unit.position, position),
  )
}

function getReachablePositionCosts(
  state: GameState,
  unit: Unit,
): Map<string, number> {
  if (
    state.phase !== 'playing' ||
    unit.hasActed ||
    unit.factionId !== state.activeFactionId
  ) {
    return new Map()
  }

  const movement = unit.movementRemaining
  const occupiedPositions = new Set(
    state.units
      .filter((candidate) => candidate.id !== unit.id)
      .map((candidate) => positionKey(candidate.position)),
  )
  const enemyZoneOfControlPositions = new Set(
    getEnemyZoneOfControlPositions(state, unit.factionId).map(positionKey),
  )
  const bestCosts = new Map<string, number>([[positionKey(unit.position), 0]])
  const frontier: Array<{ position: Position; cost: number }> = [
    { position: unit.position, cost: 0 },
  ]

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost)
    const current = frontier.shift()

    if (!current) {
      break
    }

    if (current.cost !== bestCosts.get(positionKey(current.position))) {
      continue
    }

    if (
      current.cost > 0 &&
      enemyZoneOfControlPositions.has(positionKey(current.position))
    ) {
      continue
    }

    for (const neighbor of getOrthogonalNeighbors(current.position)) {
      const neighborKey = positionKey(neighbor)

      if (occupiedPositions.has(neighborKey)) {
        continue
      }

      const tile = getTileAt(state, neighbor)
      if (!tile) {
        continue
      }

      const movementCost = TERRAIN_MOVEMENT_COST[tile.terrain]
      if (movementCost === null) {
        continue
      }

      const nextCost = current.cost + movementCost
      if (
        nextCost > movement ||
        nextCost >= (bestCosts.get(neighborKey) ?? Infinity)
      ) {
        continue
      }

      bestCosts.set(neighborKey, nextCost)
      frontier.push({ position: neighbor, cost: nextCost })
    }
  }

  bestCosts.delete(positionKey(unit.position))
  return bestCosts
}

export function getReachablePositions(state: GameState, unit: Unit): Position[] {
  return [...getReachablePositionCosts(state, unit).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key]) => {
      const [x, y] = key.split(',').map(Number)
      return { x, y }
    })
}

export function getMovementCost(
  state: GameState,
  unit: Unit,
  destination: Position,
): number | undefined {
  return getReachablePositionCosts(state, unit).get(positionKey(destination))
}

export function getAttackableUnits(state: GameState, unit: Unit): Unit[] {
  if (
    state.phase !== 'playing' ||
    unit.hasActed ||
    unit.factionId !== state.activeFactionId
  ) {
    return []
  }

  return state.units.filter(
    (candidate) =>
      candidate.factionId !== unit.factionId &&
      areOrthogonallyAdjacent(unit.position, candidate.position),
  )
}

export type CombatResult = {
  attackerHp: number
  defenderHp: number
}

export function resolveCombat(attacker: Unit, defender: Unit): CombatResult {
  const defenderHp = Math.max(
    0,
    defender.hp - UNIT_STATS[attacker.type].attack,
  )
  const attackerHp =
    defenderHp > 0
      ? Math.max(
          0,
          attacker.hp - UNIT_STATS[defender.type].counterAttack,
        )
      : attacker.hp

  return { attackerHp, defenderHp }
}

export function captureCityAt(
  cities: City[],
  position: Position,
  ownerId: FactionId,
): City[] {
  let cityCaptured = false
  const nextCities = cities.map((city) => {
    if (!positionsEqual(city.position, position) || city.ownerId === ownerId) {
      return city
    }

    cityCaptured = true
    return { ...city, ownerId }
  })

  return cityCaptured ? nextCities : cities
}

export function ownsAllCities(cities: City[], factionId: FactionId): boolean {
  return cities.length > 0 && cities.every((city) => city.ownerId === factionId)
}
