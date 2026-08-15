import {
  getAttackableUnits,
  getDeployablePositions,
  getHexNeighbors,
  getReachablePositionCosts,
  getMovementStepCost,
  getTileAt,
  getUnitAt,
  isPositionInEnemyZoneOfControl,
  positionKey,
  TERRAIN_MOVEMENT_COST,
  UNIT_STATS,
} from './rules'
import { MinPriorityQueue } from './priorityQueue'
import type {
  FactionId,
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
  return getHexNeighbors(target.position, state.boardSize).filter((position) => {
    const tile = getTileAt(state, position)
    const occupant = getUnitAt(state, position)

    return Boolean(
      tile &&
        TERRAIN_MOVEMENT_COST[tile.terrain] !== null &&
        (!occupant || occupant.id === movingUnit.id),
    )
  })
}

type PathSearch = {
  costs: Map<string, number>
  previous: Map<string, Position>
}

function getWeightedPathSearch(
  state: GameState,
  unit: Unit,
  start: Position,
): PathSearch {
  const occupiedKeys = new Set(
    state.units
      .filter(
        (candidate) =>
          candidate.id !== unit.id && candidate.factionId !== unit.factionId,
      )
      .map((candidate) => positionKey(candidate.position)),
  )
  const bestCosts = new Map<string, number>([[positionKey(start), 0]])
  const previous = new Map<string, Position>()
  const frontier = new MinPriorityQueue<{ position: Position; cost: number }>(
    (left, right) =>
      left.cost - right.cost ||
      left.position.r - right.position.r ||
      left.position.q - right.position.q,
  )
  frontier.push({ position: start, cost: 0 })

  while (frontier.size > 0) {
    const current = frontier.pop()

    if (!current) {
      break
    }

    const currentKey = positionKey(current.position)
    if (current.cost !== bestCosts.get(currentKey)) {
      continue
    }

    if (
      current.cost > 0 &&
      isPositionInEnemyZoneOfControl(state, unit.factionId, current.position)
    ) {
      continue
    }

    for (const neighbor of getHexNeighbors(current.position, state.boardSize)) {
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
      previous.set(neighborKey, current.position)
      frontier.push({ position: neighbor, cost: nextCost })
    }
  }

  return { costs: bestCosts, previous }
}

type Target = {
  id: string
  positions: Position[]
  cost: number
  destination: Position
}

function chooseClosestTarget(
  targets: Array<{ id: string; positions: Position[] }>,
  costs: ReadonlyMap<string, number>,
): Target | undefined {
  return targets
    .flatMap((target) => {
      const destination = target.positions
        .flatMap((position) => {
          const cost = costs.get(positionKey(position))
          return cost === undefined ? [] : [{ position, cost }]
        })
        .sort(
          (left, right) =>
            left.cost - right.cost ||
            left.position.r - right.position.r ||
            left.position.q - right.position.q,
        )[0]

      return destination
        ? [
            {
              ...target,
              cost: destination.cost,
              destination: destination.position,
            },
          ]
        : []
    })
    .sort(
      (left, right) =>
        left.cost - right.cost || left.id.localeCompare(right.id),
    )[0]
}

function chooseTarget(
  state: GameState,
  unit: Unit,
  costs: ReadonlyMap<string, number>,
): Target | undefined {
  const capital = state.sites.find((site) => {
    return Boolean(
      site.capitalFor &&
        site.capitalFor !== unit.factionId &&
        site.ownerId !== unit.factionId,
    )
  })
  const sites = state.sites
    .filter(
      (site) =>
        site.ownerId !== 'neutral' && site.ownerId !== unit.factionId,
    )
    .sort(compareIds)
  const siteTarget = chooseClosestTarget(
    (capital ? [capital] : sites).map((site: Site) => ({
      id: site.id,
      positions: [site.position],
    })),
    costs,
  )

  if (siteTarget) {
    return siteTarget
  }

  const enemyUnits = state.units
    .filter((candidate) => candidate.factionId !== unit.factionId)
    .sort(compareIds)

  return chooseClosestTarget(
    enemyUnits.map((target) => ({
      id: target.id,
      positions: getApproachPositions(state, target, unit),
    })),
    costs,
  )
}

function reconstructPath(
  start: Position,
  destination: Position,
  previous: ReadonlyMap<string, Position>,
): Position[] {
  const path: Position[] = [{ ...destination }]
  let current = destination

  while (positionKey(current) !== positionKey(start)) {
    const parent = previous.get(positionKey(current))
    if (!parent) return []
    path.push(parent)
    current = parent
  }

  return path.reverse()
}

function chooseMovement(
  state: GameState,
  unit: Unit,
): GameAction | undefined {
  const pathSearch = getWeightedPathSearch(state, unit, unit.position)
  const target = chooseTarget(state, unit, pathSearch.costs)
  if (!target || target.cost === 0) {
    return undefined
  }

  const reachableCosts = getReachablePositionCosts(state, unit)
  const path = reconstructPath(unit.position, target.destination, pathSearch.previous)
  const destination = [...path]
    .reverse()
    .find((position) => reachableCosts.has(positionKey(position)))

  return destination
    ? { type: 'unitMoved', unitId: unit.id, destination }
    : undefined
}

function chooseProduction(
  state: GameState,
  factionId: FactionId,
): GameAction | undefined {
  const site = state.sites
    .filter(
      (candidate) =>
        candidate.ownerId === factionId &&
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
        (unit) => unit.factionId === factionId && unit.type === type,
      ).length,
    ]),
  )
  const unitType = AI_PRODUCTION_PRIORITY.filter(
    (type) => UNIT_STATS[type].cost <= (state.resources[factionId] ?? 0),
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

export function chooseAiAction(
  state: GameState,
  factionId = state.activeFactionId,
): GameAction | undefined {
  if (
    state.phase !== 'playing' ||
    state.activeFactionId !== factionId ||
    factionId === state.humanFactionId
  ) {
    return undefined
  }

  const selectedUnit = state.units.find(
    (unit) =>
      unit.id === state.selectedUnitId &&
      unit.factionId === factionId &&
      !unit.hasActed,
  )

  if (!selectedUnit) {
    const nextUnit = state.units
      .filter((unit) => unit.factionId === factionId && !unit.hasActed)
      .sort(compareIds)[0]

    return nextUnit
      ? { type: 'unitSelected', unitId: nextUnit.id }
      : (chooseProduction(state, factionId) ?? { type: 'turnEnded' })
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
