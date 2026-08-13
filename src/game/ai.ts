import {
  getAttackableUnits,
  getMovementCost,
  getReachablePositions,
  getTileAt,
  getUnitAt,
  isPositionInEnemyZoneOfControl,
  isPositionOnBoard,
  positionKey,
  TERRAIN_MOVEMENT_COST,
} from './rules'
import type { City, GameAction, GameState, Position, Unit } from './types'

function compareIds(left: { id: string }, right: { id: string }) {
  return left.id.localeCompare(right.id)
}

function getOrthogonalNeighbors(position: Position): Position[] {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y },
  ].filter(isPositionOnBoard)
}

function getApproachPositions(
  state: GameState,
  target: Unit,
  movingUnit: Unit,
): Position[] {
  return getOrthogonalNeighbors(target.position).filter((position) => {
    const tile = getTileAt(state, position)
    const occupant = getUnitAt(state, position)

    return Boolean(
      tile &&
        TERRAIN_MOVEMENT_COST[tile.terrain] !== null &&
        (!occupant || occupant.id === movingUnit.id),
    )
  })
}

function getWeightedPathCost(
  state: GameState,
  unit: Unit,
  start: Position,
  destinations: Position[],
): number | undefined {
  const destinationKeys = new Set(destinations.map(positionKey))
  const occupiedKeys = new Set(
    state.units
      .filter((candidate) => candidate.id !== unit.id)
      .map((candidate) => positionKey(candidate.position)),
  )
  const bestCosts = new Map<string, number>([[positionKey(start), 0]])
  const frontier: Array<{ position: Position; cost: number }> = [
    { position: start, cost: 0 },
  ]

  while (frontier.length > 0) {
    frontier.sort(
      (left, right) =>
        left.cost - right.cost ||
        left.position.y - right.position.y ||
        left.position.x - right.position.x,
    )
    const current = frontier.shift()

    if (!current) {
      break
    }

    const currentKey = positionKey(current.position)
    if (current.cost !== bestCosts.get(currentKey)) {
      continue
    }

    if (destinationKeys.has(currentKey)) {
      return current.cost
    }

    if (
      current.cost > 0 &&
      isPositionInEnemyZoneOfControl(state, unit.factionId, current.position)
    ) {
      continue
    }

    for (const neighbor of getOrthogonalNeighbors(current.position)) {
      const neighborKey = positionKey(neighbor)
      if (occupiedKeys.has(neighborKey)) {
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
      if (nextCost >= (bestCosts.get(neighborKey) ?? Infinity)) {
        continue
      }

      bestCosts.set(neighborKey, nextCost)
      frontier.push({ position: neighbor, cost: nextCost })
    }
  }

  return undefined
}

type Target = {
  id: string
  positions: Position[]
  cost: number
}

function chooseClosestTarget(
  state: GameState,
  unit: Unit,
  targets: Array<{ id: string; positions: Position[] }>,
): Target | undefined {
  return targets
    .flatMap((target) => {
      const cost = getWeightedPathCost(
        state,
        unit,
        unit.position,
        target.positions,
      )

      return cost === undefined ? [] : [{ ...target, cost }]
    })
    .sort(
      (left, right) =>
        left.cost - right.cost || left.id.localeCompare(right.id),
    )[0]
}

function chooseTarget(state: GameState, unit: Unit): Target | undefined {
  const cities = state.cities
    .filter((city) => city.ownerId === 'player')
    .sort(compareIds)
  const cityTarget = chooseClosestTarget(
    state,
    unit,
    cities.map((city: City) => ({ id: city.id, positions: [city.position] })),
  )

  if (cityTarget) {
    return cityTarget
  }

  const playerUnits = state.units
    .filter((candidate) => candidate.factionId === 'player')
    .sort(compareIds)

  return chooseClosestTarget(
    state,
    unit,
    playerUnits.map((target) => ({
      id: target.id,
      positions: getApproachPositions(state, target, unit),
    })),
  )
}

function chooseMovement(
  state: GameState,
  unit: Unit,
): GameAction | undefined {
  const target = chooseTarget(state, unit)
  if (!target || target.cost === 0) {
    return undefined
  }

  const destination = getReachablePositions(state, unit)
    .flatMap((position) => {
      const remainingCost = getWeightedPathCost(
        state,
        unit,
        position,
        target.positions,
      )
      const movementCost = getMovementCost(state, unit, position)

      if (
        remainingCost === undefined ||
        movementCost === undefined ||
        remainingCost >= target.cost
      ) {
        return []
      }

      return [{ position, remainingCost, movementCost }]
    })
    .sort(
      (left, right) =>
        left.remainingCost - right.remainingCost ||
        right.movementCost - left.movementCost ||
        left.position.y - right.position.y ||
        left.position.x - right.position.x,
    )[0]?.position

  return destination
    ? { type: 'unitMoved', unitId: unit.id, destination }
    : undefined
}

export function chooseAiAction(state: GameState): GameAction | undefined {
  if (state.phase !== 'playing' || state.activeFactionId !== 'enemy') {
    return undefined
  }

  const selectedUnit = state.units.find(
    (unit) =>
      unit.id === state.selectedUnitId &&
      unit.factionId === 'enemy' &&
      !unit.hasActed,
  )

  if (!selectedUnit) {
    const nextUnit = state.units
      .filter((unit) => unit.factionId === 'enemy' && !unit.hasActed)
      .sort(compareIds)[0]

    return nextUnit
      ? { type: 'unitSelected', unitId: nextUnit.id }
      : { type: 'turnEnded' }
  }

  const attackTarget = getAttackableUnits(state, selectedUnit).sort(
    (left, right) => left.hp - right.hp || left.id.localeCompare(right.id),
  )[0]

  if (attackTarget) {
    return {
      type: 'unitAttacked',
      attackerId: selectedUnit.id,
      defenderId: attackTarget.id,
    }
  }

  const movement = chooseMovement(state, selectedUnit)
  return movement ?? { type: 'unitWaited', unitId: selectedUnit.id }
}
