import type { GameState, Position, Terrain, Unit, UnitType } from './types'

export const BOARD_SIZE = 10

export const UNIT_MOVEMENT: Record<UnitType, number> = {
  infantry: 2,
  cavalry: 3,
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

function getOrthogonalNeighbors(position: Position): Position[] {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y },
  ].filter(isPositionOnBoard)
}

export function getReachablePositions(state: GameState, unit: Unit): Position[] {
  if (unit.hasActed || unit.factionId !== state.activeFactionId) {
    return []
  }

  const movement = UNIT_MOVEMENT[unit.type]
  const occupiedPositions = new Set(
    state.units
      .filter((candidate) => candidate.id !== unit.id)
      .map((candidate) => positionKey(candidate.position)),
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
      if (nextCost > movement || nextCost >= (bestCosts.get(neighborKey) ?? Infinity)) {
        continue
      }

      bestCosts.set(neighborKey, nextCost)
      frontier.push({ position: neighbor, cost: nextCost })
    }
  }

  return [...bestCosts.entries()]
    .filter(([key]) => key !== positionKey(unit.position))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key]) => {
      const [x, y] = key.split(',').map(Number)
      return { x, y }
    })
}

