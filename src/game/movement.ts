import {
  isFortifiedSite,
  SITE_STATS,
  TERRAIN_MOVEMENT_COST,
} from './gameCatalog'
import { comparePositions, getHexNeighbors, positionKey } from './hex'
import { MinPriorityQueue } from './priorityQueue'
import { getTileAt, getUnitAt } from './queries'
import { getSiteOccupiedPositions } from './siteFootprint'
import { getZoneOfControlIndex } from './spatialIndex'
import type { FactionId, GameState, Position, Site, Unit } from './types'

export function getMovementStepCost(
  state: GameState,
  from: Position,
  destination: Position,
): number | null {
  const fromTile = getTileAt(state, from)
  const destinationTile = getTileAt(state, destination)
  if (!fromTile || !destinationTile) return null
  return TERRAIN_MOVEMENT_COST[destinationTile.terrain]
}

export function getEnemyZoneOfControlPositions(
  state: GameState,
  factionId: FactionId,
): Position[] {
  return [...getZoneOfControlIndex(state, factionId).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, position]) => position)
}

export function isPositionInEnemyZoneOfControl(
  state: GameState,
  factionId: FactionId,
  position: Position,
): boolean {
  return getZoneOfControlIndex(state, factionId).has(positionKey(position))
}

export function getReachablePositionCosts(
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

  const enemyOccupiedPositions = new Set(
    state.units
      .filter(
        (candidate) =>
          candidate.id !== unit.id && candidate.factionId !== unit.factionId,
      )
      .map((candidate) => positionKey(candidate.position)),
  )
  const alliedOccupiedPositions = new Set(
    state.units
      .filter(
        (candidate) =>
          candidate.id !== unit.id && candidate.factionId === unit.factionId,
      )
      .map((candidate) => positionKey(candidate.position)),
  )
  const blockedFortifiedPositions = new Set(
    state.sites
      .filter(
        (site) =>
          isFortifiedSite(site) && site.ownerId !== unit.factionId,
      )
      .flatMap((site) => [...getSiteOccupiedPositions(site)])
      .map(positionKey),
  )
  const enemyZoneOfControlPositions = getZoneOfControlIndex(state, unit.factionId)
  const bestCosts = new Map<string, number>([[positionKey(unit.position), 0]])
  const frontier = new MinPriorityQueue<{ position: Position; cost: number }>(
    (left, right) =>
      left.cost - right.cost ||
      left.position.r - right.position.r ||
      left.position.q - right.position.q,
  )
  frontier.push({ position: unit.position, cost: 0 })

  while (frontier.size > 0) {
    const current = frontier.pop()!
    const currentKey = positionKey(current.position)
    if (current.cost !== bestCosts.get(currentKey)) continue

    if (current.cost > 0 && enemyZoneOfControlPositions.has(currentKey)) {
      continue
    }

    for (const neighbor of getHexNeighbors(current.position, state.boardSize)) {
      const neighborKey = positionKey(neighbor)
      if (enemyOccupiedPositions.has(neighborKey)) continue
      if (blockedFortifiedPositions.has(neighborKey)) continue
      const stepCost = getMovementStepCost(state, current.position, neighbor)
      if (stepCost === null) continue
      const nextCost = current.cost + stepCost
      if (
        nextCost > unit.movementRemaining ||
        nextCost >= (bestCosts.get(neighborKey) ?? Infinity)
      ) {
        continue
      }
      bestCosts.set(neighborKey, nextCost)
      frontier.push({ position: neighbor, cost: nextCost })
    }
  }

  bestCosts.delete(positionKey(unit.position))
  for (const alliedKey of alliedOccupiedPositions) {
    bestCosts.delete(alliedKey)
  }
  return bestCosts
}

export function getReachablePositions(state: GameState, unit: Unit): Position[] {
  return [...getReachablePositionCosts(state, unit).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key]) => {
      const [q, r] = key.split(',').map(Number)
      return { q, r }
    })
}

export function getMovementCost(
  state: GameState,
  unit: Unit,
  destination: Position,
): number | undefined {
  return getReachablePositionCosts(state, unit).get(positionKey(destination))
}

export function getDeployablePositions(
  state: GameState,
  site: Site,
): Position[] {
  if (!SITE_STATS[site.kind].canProduce) return []

  const candidatesByKey = new Map<string, Position>()
  for (const occupiedPosition of getSiteOccupiedPositions(site)) {
    candidatesByKey.set(positionKey(occupiedPosition), { ...occupiedPosition })
    for (const neighbor of getHexNeighbors(occupiedPosition, state.boardSize)) {
      candidatesByKey.set(positionKey(neighbor), neighbor)
    }
  }
  const candidates = [...candidatesByKey.values()].sort(comparePositions)

  return candidates.filter((position) => {
    const tile = getTileAt(state, position)
    return Boolean(
      tile &&
        TERRAIN_MOVEMENT_COST[tile.terrain] !== null &&
        !getUnitAt(state, position),
    )
  })
}
