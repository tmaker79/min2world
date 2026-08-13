import {
  getAttackableUnits,
  getDeployablePositions,
  getHexNeighbors,
  getMovementCost,
  getMovementStepCost,
  getReachablePositions,
  getTileAt,
  getUnitAt,
  isPositionInEnemyZoneOfControl,
  positionKey,
  UNIT_STATS,
} from './rules'
import type {
  GameAction,
  GameState,
  Position,
  Site,
  Unit,
  UnitType,
} from './types'

const AI_PRODUCTION_PRIORITY: readonly UnitType[] = [
  'spearman',
  'archer',
  'cavalry',
  'infantry',
]

function compareIds(left: { id: string }, right: { id: string }) {
  return left.id.localeCompare(right.id)
}

function getApproachPositions(
  state: GameState,
  target: Unit,
  movingUnit: Unit,
): Position[] {
  return getHexNeighbors(target.position).filter((position) => {
    const tile = getTileAt(state, position)
    const occupant = getUnitAt(state, position)

    return Boolean(
      tile &&
        tile.terrain !== 'water' &&
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
        left.position.r - right.position.r ||
        left.position.q - right.position.q,
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

    for (const neighbor of getHexNeighbors(current.position)) {
      const neighborKey = positionKey(neighbor)
      if (occupiedKeys.has(neighborKey)) {
        continue
      }

      const tile = getTileAt(state, neighbor)
      if (!tile) {
        continue
      }

      const movementCost = getMovementStepCost(
        state,
        current.position,
        neighbor,
      )
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
  const capital = state.sites.find(
    (site) => site.capitalFor === 'player' && site.ownerId === 'player',
  )
  const sites = state.sites
    .filter((site) => site.ownerId === 'player')
    .sort(compareIds)
  const siteTarget = chooseClosestTarget(
    state,
    unit,
    (capital ? [capital] : sites).map((site: Site) => ({
      id: site.id,
      positions: [site.position],
    })),
  )

  if (siteTarget) {
    return siteTarget
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
        left.position.r - right.position.r ||
        left.position.q - right.position.q,
    )[0]?.position

  return destination
    ? { type: 'unitMoved', unitId: unit.id, destination }
    : undefined
}

function chooseProduction(state: GameState): GameAction | undefined {
  const site = state.sites
    .filter(
      (candidate) =>
        candidate.ownerId === 'enemy' &&
        candidate.lastProducedTurn !== state.turn &&
        getDeployablePositions(state, candidate).length > 0,
    )
    .sort(compareIds)[0]

  if (!site) {
    return undefined
  }

  const unitCounts = new Map<UnitType, number>(
    AI_PRODUCTION_PRIORITY.map((type) => [
      type,
      state.units.filter(
        (unit) => unit.factionId === 'enemy' && unit.type === type,
      ).length,
    ]),
  )
  const unitType = AI_PRODUCTION_PRIORITY.filter(
    (type) => UNIT_STATS[type].cost <= state.resources.enemy,
  ).sort(
    (left, right) =>
      (unitCounts.get(left) ?? 0) - (unitCounts.get(right) ?? 0) ||
      AI_PRODUCTION_PRIORITY.indexOf(left) -
        AI_PRODUCTION_PRIORITY.indexOf(right),
  )[0]

  if (!unitType) {
    return undefined
  }

  return {
    type: 'unitProduced',
    siteId: site.id,
    unitType,
    destination: getDeployablePositions(state, site)[0],
  }
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
      : (chooseProduction(state) ?? { type: 'turnEnded' })
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
