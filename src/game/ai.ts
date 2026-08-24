import {
  canSiteProduceUnit,
  getAttackableSites,
  getAttackableUnits,
  getDeployablePositions,
  getHexNeighbors,
  getProducibleUnitTypes,
  getReachablePositionCosts,
  getMovementStepCost,
  getSiteMaxHp,
  getTileAt,
  getUnitProductionCost,
  getUnitAt,
  isFortifiedSite,
  isPositionInEnemyZoneOfControl,
  positionKey,
  TERRAIN_MOVEMENT_COST,
  UNIT_STATS,
} from './rules'
import { getHexDistance } from './hex'
import { getSiteOccupiedPositions } from './siteFootprint'
import {
  canDevelopSite,
  getSiteDevelopmentFootprints,
  getSiteDevelopmentTarget,
} from './siteDevelopment'
import { MinPriorityQueue } from './priorityQueue'
import {
  BUILDING_DEFINITIONS,
  canStartConstruction,
  hasBuilding,
} from './cityAdministration'
import type {
  BuildingId,
  FactionId,
  GameAction,
  GameState,
  Position,
  Site,
  SiteType,
  Unit,
  UnitType,
} from './types'

const AI_DEVELOPMENT_RESERVE = 5
const AI_CONSTRUCTION_RESERVE = 10

const AI_PEACEFUL_BUILDING_PRIORITY: readonly BuildingId[] = [
  'granary',
  'market',
  'library',
  'barracks',
  'temple',
  'wall',
  'tavern',
]
const AI_THREATENED_BUILDING_PRIORITY: readonly BuildingId[] = [
  'wall',
  'tavern',
  'barracks',
]

const AI_PRODUCTION_PRIORITY: readonly UnitType[] = [
  'spearman',
  'archer',
  'cavalry',
  'infantry',
]

function compareIds(left: { id: string }, right: { id: string }) {
  return left.id.localeCompare(right.id)
}

type AiSiteDevelopmentScore = {
  stage: number
  role: number
}

const SITE_ROLE_PRIORITY: Record<SiteType, number> = {
  outpost: 0,
  keep: 0,
  stronghold: 0,
  village: 1,
  town: 1,
  city: 1,
  farm: 2,
  mine: 2,
  blacksmith: 2,
}

export function getAiSiteDevelopmentScore(
  site: Site,
): AiSiteDevelopmentScore {
  const stage =
    site.kind === 'outpost' || site.kind === 'village'
      ? 1
      : site.kind === 'keep' || site.kind === 'town'
        ? 2
        : site.kind === 'stronghold' || site.kind === 'city'
          ? 3
          : (site.level ?? 1)

  return { stage, role: SITE_ROLE_PRIORITY[site.kind] }
}

export function compareAiSiteDevelopmentCandidates(
  left: Site,
  right: Site,
): number {
  const leftScore = getAiSiteDevelopmentScore(left)
  const rightScore = getAiSiteDevelopmentScore(right)
  return (
    leftScore.stage - rightScore.stage ||
    leftScore.role - rightScore.role ||
    left.id.localeCompare(right.id)
  )
}

function compareFootprints(left: readonly Position[], right: readonly Position[]) {
  const getKey = (footprint: readonly Position[]) =>
    [...footprint]
      .sort((a, b) => a.r - b.r || a.q - b.q)
      .map(positionKey)
      .join('|')
  return getKey(left).localeCompare(getKey(right))
}

function getUnitApproachPositions(
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

function getSiteApproachPositions(
  state: GameState,
  target: Site,
  movingUnit: Unit,
): Position[] {
  const range = UNIT_STATS[movingUnit.type].range
  const occupiedPositions = getSiteOccupiedPositions(target)

  return state.tiles
    .filter(
      (tile) =>
        TERRAIN_MOVEMENT_COST[tile.terrain] !== null &&
        occupiedPositions.some(
          (position) => getHexDistance(tile.position, position) <= range,
        ),
    )
    .map((tile) => tile.position)
    .filter((position) => {
      const occupant = getUnitAt(state, position)
      const site = state.sites.find(
        (candidate) =>
          isFortifiedSite(candidate) &&
          candidate.ownerId !== movingUnit.factionId &&
          getSiteOccupiedPositions(candidate).some(
            (occupied) => positionKey(occupied) === positionKey(position),
          ),
      )
      return (!occupant || occupant.id === movingUnit.id) && !site
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
  const fortifiedKeys = new Set(
    state.sites
      .filter(
        (site) =>
          isFortifiedSite(site) && site.ownerId !== unit.factionId,
      )
      .flatMap(getSiteOccupiedPositions)
      .map(positionKey),
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
      if (occupiedKeys.has(neighborKey) || fortifiedKeys.has(neighborKey)) {
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
  const capital = state.sites
    .filter(
      (site) =>
        site.capitalFor &&
        site.capitalFor !== unit.factionId &&
        site.ownerId !== 'neutral' &&
        site.ownerId !== unit.factionId,
    )
    .sort(compareIds)[0]
  const sites = state.sites
    .filter(
      (site) =>
        site.ownerId !== 'neutral' && site.ownerId !== unit.factionId,
    )
    .sort(compareIds)
  const siteTarget = chooseClosestTarget(
    (capital ? [capital] : sites).map((site: Site) => ({
      id: site.id,
      positions: isFortifiedSite(site)
        ? getSiteApproachPositions(state, site, unit)
        : [site.position],
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
      positions: getUnitApproachPositions(state, target, unit),
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
  const sites = state.sites
    .filter(
      (candidate) =>
        candidate.ownerId === factionId &&
        candidate.lastProducedTurn !== state.turn &&
        getProducibleUnitTypes(candidate).length > 0 &&
        getDeployablePositions(state, candidate).length > 0,
    )
    .sort(compareIds)

  const unitCounts = new Map<UnitType, number>(
    AI_PRODUCTION_PRIORITY.map((type) => [
      type,
      state.units.filter(
        (unit) => unit.factionId === factionId && unit.type === type,
      ).length,
    ]),
  )
  for (const site of sites) {
    const unitType = getProducibleUnitTypes(site)
      .filter(
        (type) =>
          canSiteProduceUnit(site, type) &&
          getUnitProductionCost(state, factionId, type, site) <=
            (state.resources[factionId] ?? 0),
      )
      .sort(
        (left, right) =>
          (unitCounts.get(left) ?? 0) - (unitCounts.get(right) ?? 0) ||
          AI_PRODUCTION_PRIORITY.indexOf(left) -
            AI_PRODUCTION_PRIORITY.indexOf(right),
      )[0]

    if (unitType) {
      return {
        type: 'unitProduced',
        siteId: site.id,
        unitType,
        destination: getDeployablePositions(state, site)[0],
      }
    }
  }

  return undefined
}

function chooseDevelopment(
  state: GameState,
  factionId: FactionId,
): GameAction | undefined {
  const ownedSites = state.sites.filter((site) => site.ownerId === factionId)
  if (
    ownedSites.some(
      (site) =>
        site.lastDevelopedTurn === state.turn ||
        site.constructionQueue?.startedTurn === state.turn,
    )
  ) {
    return undefined
  }

  const resources = state.resources[factionId] ?? 0
  const candidates = ownedSites
    .filter(
      (site) =>
        getSiteDevelopmentTarget(site) &&
        site.lastDevelopedTurn !== state.turn,
    )
    .map((site) => {
      const footprint =
        site.kind === 'village' || site.kind === 'town'
          ? [...getSiteDevelopmentFootprints(state, site)].sort(
              compareFootprints,
            )[0]
          : undefined
      if ((site.kind === 'village' || site.kind === 'town') && !footprint) {
        return undefined
      }

      const check = canDevelopSite(state, site.id, footprint)
      return check.ok && resources - check.cost >= AI_DEVELOPMENT_RESERVE
        ? { site, footprint }
        : undefined
    })
    .filter(
      (
        candidate,
      ): candidate is { site: Site; footprint: Position[] | undefined } =>
        Boolean(candidate),
    )
    .sort((left, right) =>
      compareAiSiteDevelopmentCandidates(left.site, right.site),
    )

  const selected = candidates[0]
  return selected
    ? {
        type: 'siteDeveloped',
        siteId: selected.site.id,
        footprint: selected.footprint,
      }
    : undefined
}

function chooseConstruction(
  state: GameState,
  factionId: FactionId,
): GameAction | undefined {
  const ownedSites = state.sites.filter((site) => site.ownerId === factionId)
  if (
    ownedSites.some(
      (site) =>
        site.lastDevelopedTurn === state.turn ||
        site.constructionQueue?.startedTurn === state.turn,
    )
  ) {
    return undefined
  }

  const resources = state.resources[factionId] ?? 0
  for (const city of ownedSites
    .filter((site) => site.kind === 'city' && !site.constructionQueue)
    .sort(compareIds)) {
    const threatened = state.units.some(
      (unit) =>
        unit.factionId !== factionId &&
        getSiteOccupiedPositions(city).some(
          (position) => getHexDistance(unit.position, position) <= 2,
        ),
    )
    const priorities = threatened
      ? AI_THREATENED_BUILDING_PRIORITY
      : AI_PEACEFUL_BUILDING_PRIORITY

    for (const buildingId of priorities) {
      if (hasBuilding(city, buildingId)) continue
      const check = canStartConstruction(state, city.id, buildingId)
      if (
        check.ok &&
        resources - BUILDING_DEFINITIONS[buildingId].cost >=
          AI_CONSTRUCTION_RESERVE
      ) {
        return { type: 'constructionStarted', siteId: city.id, buildingId }
      }
    }
  }
  return undefined
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
      : (chooseDevelopment(state, factionId) ??
          chooseConstruction(state, factionId) ??
          chooseProduction(state, factionId) ?? { type: 'turnEnded' })
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

  const siteTarget = getAttackableSites(state, selectedUnit).sort(
    (left, right) => {
      const leftIsEnemyCapital = Boolean(
        left.capitalFor &&
          left.capitalFor !== selectedUnit.factionId &&
          left.ownerId !== 'neutral',
      )
      const rightIsEnemyCapital = Boolean(
        right.capitalFor &&
          right.capitalFor !== selectedUnit.factionId &&
          right.ownerId !== 'neutral',
      )
      return (
        Number(rightIsEnemyCapital) - Number(leftIsEnemyCapital) ||
        (left.hp ?? getSiteMaxHp(left) ?? Infinity) -
          (right.hp ?? getSiteMaxHp(right) ?? Infinity) ||
        left.id.localeCompare(right.id)
      )
    },
  )[0]

  if (siteTarget) {
    return {
      type: 'siteAttacked',
      attackerId: selectedUnit.id,
      siteId: siteTarget.id,
    }
  }

  const movement = chooseMovement(state, selectedUnit)
  return movement ?? { type: 'unitWaited', unitId: selectedUnit.id }
}
