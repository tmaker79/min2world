import {
  canSiteProduceUnit,
  getAttackableSites,
  getAttackableUnits,
  getDeployablePositions,
  getFactionIncome,
  getHexNeighbors,
  getMatchupBonus,
  getMovementStepCost,
  getProducibleUnitTypes,
  getReachablePositionCosts,
  getSiteIncome,
  getSiteMaxHp,
  getTileAt,
  getUnitAt,
  getUnitProductionCost,
  isCivilianUnitType,
  isFortifiedSite,
  isMilitaryUnitType,
  isPositionInEnemyZoneOfControl,
  positionKey,
  resolveCombat,
  resolveSiteCombat,
  TERRAIN_COMBAT_BONUS,
  TERRAIN_MOVEMENT_COST,
  UNIT_STATS,
} from './rules'
import {
  BUILDABLE_SITE_TYPES,
  canConstruct,
  canProduceCivilianUnit,
  canSettle,
  getConstructiblePositions,
  getOwnedAnchorGraphDistance,
  getSettleablePositions,
  SITE_CONSTRUCTION_COSTS,
} from './settlement'
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
  BUILDING_IDS,
  canStartConstruction,
  hasBuilding,
} from './cityAdministration'
import type {
  BuildableSiteType,
  FactionId,
  GameAction,
  GameState,
  MilitaryUnitType,
  Position,
  Site,
  SiteType,
  Unit,
} from './types'
import {
  canSpendWithUpkeepReserve,
  getFactionNetIncome,
  getFactionUpkeep,
  UNIT_UPKEEP,
} from './upkeep'

export type AiDecisionReason =
  | 'deficitDisband'
  | 'immediateAttack'
  | 'capitalDefense'
  | 'tacticalMove'
  | 'economicExpansion'
  | 'offense'
  | 'investment'
  | 'production'
  | 'settlement'
  | 'siteConstruction'
  | 'endTurn'

export type AiDecision = {
  action: GameAction
  reason: AiDecisionReason
}

const AI_PRODUCTION_PRIORITY: readonly MilitaryUnitType[] = [
  'spearman',
  'archer',
  'cavalry',
  'infantry',
]

const ECONOMIC_SITE_PRIORITY: Record<'mine' | 'farm' | 'blacksmith', number> = {
  mine: 0,
  farm: 1,
  blacksmith: 2,
}

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

export function getAiSiteDevelopmentScore(site: Site): AiSiteDevelopmentScore {
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

export function compareAiSiteDevelopmentCandidates(left: Site, right: Site) {
  const leftScore = getAiSiteDevelopmentScore(left)
  const rightScore = getAiSiteDevelopmentScore(right)
  return (
    leftScore.stage - rightScore.stage ||
    leftScore.role - rightScore.role ||
    left.id.localeCompare(right.id)
  )
}

function comparePositions(left: Position, right: Position) {
  return left.r - right.r || left.q - right.q
}

function compareFootprints(left: readonly Position[], right: readonly Position[]) {
  const key = (footprint: readonly Position[]) =>
    [...footprint].sort(comparePositions).map(positionKey).join('|')
  return key(left).localeCompare(key(right))
}

function getOwnedCapitals(state: GameState, factionId: FactionId) {
  return state.sites
    .filter((site) => site.ownerId === factionId && site.capitalFor === factionId)
    .sort(compareIds)
}

function getCapitalThreats(state: GameState, factionId: FactionId) {
  const positions = getOwnedCapitals(state, factionId).flatMap(getSiteOccupiedPositions)
  return state.units
    .filter(
      (unit) =>
        unit.factionId !== factionId &&
        isMilitaryUnitType(unit.type) &&
        positions.some((position) => getHexDistance(unit.position, position) <= 2),
    )
    .sort(compareIds)
}

function isPassableDestination(state: GameState, position: Position, unit: Unit) {
  const tile = getTileAt(state, position)
  const occupant = getUnitAt(state, position)
  const blockedSite = state.sites.some(
    (site) =>
      isFortifiedSite(site) &&
      site.ownerId !== unit.factionId &&
      getSiteOccupiedPositions(site).some(
        (occupied) => positionKey(occupied) === positionKey(position),
      ),
  )
  return Boolean(
    tile &&
      TERRAIN_MOVEMENT_COST[tile.terrain] !== null &&
      (!occupant || occupant.id === unit.id) &&
      !blockedSite,
  )
}

function getUnitApproachPositions(state: GameState, target: Unit, unit: Unit) {
  const range = UNIT_STATS[unit.type].range
  return state.tiles
    .map((tile) => tile.position)
    .filter(
      (position) =>
        getHexDistance(position, target.position) <= range &&
        isPassableDestination(state, position, unit),
    )
    .sort(comparePositions)
}

function getSiteApproachPositions(state: GameState, target: Site, unit: Unit) {
  const range = UNIT_STATS[unit.type].range
  const occupied = getSiteOccupiedPositions(target)
  return state.tiles
    .map((tile) => tile.position)
    .filter(
      (position) =>
        occupied.some((cell) => getHexDistance(position, cell) <= range) &&
        isPassableDestination(state, position, unit),
    )
    .sort(comparePositions)
}

type PathSearch = {
  costs: Map<string, number>
  previous: Map<string, Position>
}

function getWeightedPathSearch(state: GameState, unit: Unit, start: Position): PathSearch {
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
      .filter((site) => isFortifiedSite(site) && site.ownerId !== unit.factionId)
      .flatMap(getSiteOccupiedPositions)
      .map(positionKey),
  )
  const costs = new Map<string, number>([[positionKey(start), 0]])
  const previous = new Map<string, Position>()
  const frontier = new MinPriorityQueue<{ position: Position; cost: number }>(
    (left, right) =>
      left.cost - right.cost || comparePositions(left.position, right.position),
  )
  frontier.push({ position: start, cost: 0 })

  while (frontier.size > 0) {
    const current = frontier.pop()
    if (!current) break
    const currentKey = positionKey(current.position)
    if (current.cost !== costs.get(currentKey)) continue
    if (
      current.cost > 0 &&
      isPositionInEnemyZoneOfControl(state, unit.factionId, current.position)
    ) {
      continue
    }
    for (const neighbor of getHexNeighbors(current.position, state.boardSize)) {
      const neighborKey = positionKey(neighbor)
      if (occupiedKeys.has(neighborKey) || fortifiedKeys.has(neighborKey)) continue
      const movementCost = getMovementStepCost(state, current.position, neighbor)
      if (movementCost === null) continue
      const nextCost = current.cost + movementCost
      if (nextCost >= (costs.get(neighborKey) ?? Infinity)) continue
      costs.set(neighborKey, nextCost)
      previous.set(neighborKey, current.position)
      frontier.push({ position: neighbor, cost: nextCost })
    }
  }
  return { costs, previous }
}

function getReverseTerrainCosts(
  state: GameState,
  destinations: readonly Position[],
) {
  const costs = new Map<string, number>()
  const frontier = new MinPriorityQueue<{ position: Position; cost: number }>(
    (left, right) => left.cost - right.cost || comparePositions(left.position, right.position),
  )
  for (const position of destinations) {
    costs.set(positionKey(position), 0)
    frontier.push({ position, cost: 0 })
  }
  while (frontier.size > 0) {
    const current = frontier.pop()!
    const currentKey = positionKey(current.position)
    if (current.cost !== costs.get(currentKey)) continue
    const currentTile = getTileAt(state, current.position)
    const reverseStep = currentTile
      ? TERRAIN_MOVEMENT_COST[currentTile.terrain]
      : null
    if (reverseStep === null) continue
    for (const neighbor of getHexNeighbors(current.position, state.boardSize)) {
      const neighborTile = getTileAt(state, neighbor)
      if (!neighborTile || TERRAIN_MOVEMENT_COST[neighborTile.terrain] === null) continue
      const key = positionKey(neighbor)
      const nextCost = current.cost + reverseStep
      if (nextCost >= (costs.get(key) ?? Infinity)) continue
      costs.set(key, nextCost)
      frontier.push({ position: neighbor, cost: nextCost })
    }
  }
  return costs
}

function civilianAt(
  factionId: FactionId,
  type: 'settler' | 'builder',
  position: Position,
  id: string,
): Unit {
  return {
    id,
    name: id,
    factionId,
    type,
    position,
    hp: 100,
    maxHp: 100,
    movementRemaining: UNIT_STATS[type].movement,
    hasActed: false,
  }
}

type CivilianOrigin = {
  unit: Unit
  search: PathSearch
}

function getCivilianOrigins(
  state: GameState,
  units: readonly Unit[],
): CivilianOrigin[] {
  return units.map((unit) => ({
    unit,
    search: getWeightedPathSearch(state, unit, unit.position),
  }))
}

function closestOrigin(
  origins: readonly CivilianOrigin[],
  position: Position,
) {
  return origins
    .flatMap((origin) => {
      const cost = origin.search.costs.get(positionKey(position))
      return cost === undefined ? [] : [{ origin, cost }]
    })
    .sort(
      (left, right) =>
        left.cost - right.cost || comparePositions(left.origin.unit.position, right.origin.unit.position),
    )[0]
}

type AiSettlementCandidate = {
  position: Position
  pathCost: number
  enemyCapitalCost: number
  origin: Unit
}

function chooseSettlementCandidate(
  state: GameState,
  factionId: FactionId,
  units: readonly Unit[],
): AiSettlementCandidate | undefined {
  const origins = getCivilianOrigins(state, units)
  const enemyCapitalPositions = state.sites
    .filter(
      (site) =>
        Boolean(site.capitalFor) &&
        site.ownerId !== 'neutral' &&
        site.ownerId !== factionId,
    )
    .flatMap((site) => [...getSiteOccupiedPositions(site)])
  const capitalCosts = getReverseTerrainCosts(state, enemyCapitalPositions)
  return getSettleablePositions(state, factionId)
    .flatMap((position) => {
      const nearest = closestOrigin(origins, position)
      return nearest
        ? [{
            position,
            pathCost: nearest.cost,
            enemyCapitalCost: capitalCosts.get(positionKey(position)) ?? Infinity,
            origin: nearest.origin.unit,
          }]
        : []
    })
    .sort(
      (left, right) =>
        left.enemyCapitalCost - right.enemyCapitalCost ||
        left.pathCost - right.pathCost ||
        comparePositions(left.position, right.position),
    )[0]
}

function isFrontlineOutpost(
  state: GameState,
  factionId: FactionId,
  position: Position,
) {
  return (
    state.units.some(
      (unit) =>
        unit.factionId !== factionId &&
        isMilitaryUnitType(unit.type) &&
        getHexDistance(unit.position, position) <= 3,
    ) ||
    state.sites.some(
      (site) =>
        site.ownerId !== 'neutral' &&
        site.ownerId !== factionId &&
        isFortifiedSite(site) &&
        getSiteOccupiedPositions(site).some(
          (occupied) => getHexDistance(occupied, position) <= 3,
        ),
    )
  )
}

function constructionPriority(
  state: GameState,
  factionId: FactionId,
  siteKind: BuildableSiteType,
  position: Position,
) {
  if (siteKind === 'outpost') {
    return isFrontlineOutpost(state, factionId, position) ? 0 : 4
  }
  return siteKind === 'mine' ? 1 : siteKind === 'farm' ? 2 : 3
}

type AiConstructionCandidate = {
  position: Position
  siteKind: BuildableSiteType
  priority: number
  pathCost: number
  anchorDistance: number
  origin: Unit
}

function chooseConstructionCandidate(
  state: GameState,
  factionId: FactionId,
  units: readonly Unit[],
): AiConstructionCandidate | undefined {
  const origins = getCivilianOrigins(state, units)
  return BUILDABLE_SITE_TYPES.flatMap((siteKind) =>
    getConstructiblePositions(state, factionId, siteKind).flatMap((position) => {
      const nearest = closestOrigin(origins, position)
      const anchorDistance = getOwnedAnchorGraphDistance(
        state,
        factionId,
        position,
      )
      return nearest && anchorDistance !== undefined
        ? [{
            position,
            siteKind,
            priority: constructionPriority(state, factionId, siteKind, position),
            pathCost: nearest.cost,
            anchorDistance,
            origin: nearest.origin.unit,
          }]
        : []
    }),
  ).sort(
    (left, right) =>
      left.priority - right.priority ||
      left.pathCost - right.pathCost ||
      left.anchorDistance - right.anchorDistance ||
      comparePositions(left.position, right.position),
  )[0]
}

type TargetKind = 'capitalDefense' | 'economicExpansion' | 'offense'

type Target = {
  id: string
  kind: TargetKind
  positions: Position[]
  referencePositions: Position[]
  cost: number
  destination: Position
  siteKind?: SiteType
  requiresAction: boolean
}

function chooseClosestTarget(
  targets: Array<Omit<Target, 'cost' | 'destination'>>,
  costs: ReadonlyMap<string, number>,
  compare?: (left: Target, right: Target) => number,
) {
  return targets
    .flatMap((target) => {
      const destination = target.positions
        .flatMap((position) => {
          const cost = costs.get(positionKey(position))
          return cost === undefined ? [] : [{ position, cost }]
        })
        .sort(
          (left, right) =>
            left.cost - right.cost || comparePositions(left.position, right.position),
        )[0]
      return destination
        ? [{ ...target, cost: destination.cost, destination: destination.position }]
        : []
    })
    .sort(
      compare ??
        ((left, right) => left.cost - right.cost || left.id.localeCompare(right.id)),
    )[0]
}

function siteTarget(state: GameState, unit: Unit, site: Site, kind: TargetKind) {
  const referencePositions = [...getSiteOccupiedPositions(site)]
  return {
    id: site.id,
    kind,
    siteKind: site.kind,
    requiresAction: isFortifiedSite(site),
    referencePositions,
    positions: isFortifiedSite(site)
      ? getSiteApproachPositions(state, site, unit)
      : referencePositions,
  }
}

function unitTarget(state: GameState, unit: Unit, target: Unit, kind: TargetKind) {
  return {
    id: target.id,
    kind,
    positions: getUnitApproachPositions(state, target, unit),
    referencePositions: [target.position],
    requiresAction: true,
  }
}

function chooseStrategicTarget(state: GameState, unit: Unit, pathSearch: PathSearch) {
  const neutralEconomy = state.sites
    .filter(
      (site): site is Site & { kind: 'mine' | 'farm' | 'blacksmith' } =>
        site.ownerId === 'neutral' &&
        (site.kind === 'mine' || site.kind === 'farm' || site.kind === 'blacksmith'),
    )
    .map((site) => siteTarget(state, unit, site, 'economicExpansion'))
  const economyTarget = chooseClosestTarget(
    neutralEconomy,
    pathSearch.costs,
    (left, right) =>
      left.cost - right.cost ||
      ECONOMIC_SITE_PRIORITY[left.siteKind as 'mine' | 'farm' | 'blacksmith'] -
        ECONOMIC_SITE_PRIORITY[right.siteKind as 'mine' | 'farm' | 'blacksmith'] ||
      left.id.localeCompare(right.id),
  )

  const capitals = state.sites
    .filter(
      (site) =>
        Boolean(site.capitalFor) &&
        site.ownerId !== 'neutral' &&
        site.ownerId !== unit.factionId,
    )
    .sort(compareIds)
  const capitalTarget = chooseClosestTarget(
    capitals.map((site) => siteTarget(state, unit, site, 'offense')),
    pathSearch.costs,
  )
  const netIncome = getFactionNetIncome(state, unit.factionId)
  if (
    economyTarget &&
    (netIncome <= 2 || !capitalTarget || economyTarget.cost <= capitalTarget.cost)
  ) {
    return economyTarget
  }
  if (capitalTarget) return capitalTarget

  const enemyEconomy = state.sites
    .filter(
      (site) =>
        site.ownerId !== 'neutral' &&
        site.ownerId !== unit.factionId &&
        (site.kind === 'mine' || site.kind === 'farm' || site.kind === 'blacksmith'),
    )
    .map((site) => siteTarget(state, unit, site, 'offense'))
  const enemyEconomyTarget = chooseClosestTarget(enemyEconomy, pathSearch.costs)
  if (enemyEconomyTarget) return enemyEconomyTarget

  const excluded = new Set([...capitals.map((site) => site.id), ...enemyEconomy.map((site) => site.id)])
  const otherSiteTarget = chooseClosestTarget(
    state.sites
      .filter((site) => site.ownerId !== unit.factionId && !excluded.has(site.id))
      .sort(compareIds)
      .map((site) => siteTarget(state, unit, site, 'offense')),
    pathSearch.costs,
  )
  if (otherSiteTarget) return otherSiteTarget

  return chooseClosestTarget(
    state.units
      .filter((candidate) => candidate.factionId !== unit.factionId)
      .sort(compareIds)
      .map((target) => unitTarget(state, unit, target, 'offense')),
    pathSearch.costs,
  )
}

type UnitAttackCandidate = {
  kind: 'unit'
  attacker: Unit
  target: Unit
  priority: number
  threat: number
  defenderHp: number
  attackerHp: number
  damageMargin: number
  matchup: number
}

type SiteAttackCandidate = {
  kind: 'site'
  attacker: Unit
  target: Site
  priority: number
  siteHp: number
  damage: number
}

type AttackCandidate = UnitAttackCandidate | SiteAttackCandidate

function compareAttackCandidates(left: AttackCandidate, right: AttackCandidate) {
  const priority = right.priority - left.priority
  if (priority !== 0) return priority
  if (left.kind === 'unit' && right.kind === 'unit') {
    return (
      right.threat - left.threat ||
      left.defenderHp - right.defenderHp ||
      right.attackerHp - left.attackerHp ||
      right.damageMargin - left.damageMargin ||
      right.matchup - left.matchup ||
      left.attacker.id.localeCompare(right.attacker.id) ||
      left.target.id.localeCompare(right.target.id)
    )
  }
  if (left.kind === 'site' && right.kind === 'site') {
    return (
      left.siteHp - right.siteHp ||
      right.damage - left.damage ||
      right.attacker.hp - left.attacker.hp ||
      left.attacker.id.localeCompare(right.attacker.id) ||
      left.target.id.localeCompare(right.target.id)
    )
  }
  return left.kind === 'unit' ? -1 : 1
}

function getBestAttack(state: GameState, factionId: FactionId) {
  const threatIds = new Set(getCapitalThreats(state, factionId).map((unit) => unit.id))
  const candidates: AttackCandidate[] = []
  const attackers = state.units
    .filter((unit) => unit.factionId === factionId && !unit.hasActed)
    .sort(compareIds)

  for (const attacker of attackers) {
    for (const target of getAttackableUnits(state, attacker).sort(compareIds)) {
      const result = resolveCombat(state, attacker, target)
      const dealt = target.hp - result.defenderHp
      const received = attacker.hp - result.attackerHp
      const kills = result.defenderHp === 0
      const survives = result.attackerHp > 0
      const threat = threatIds.has(target.id)
      const matchup = getMatchupBonus(attacker.type, target.type)
      if (!survives && !kills && !threat) continue
      let category = 1
      if (survives && kills) category = 5
      else if (threat && (kills || dealt >= target.hp / 2)) category = 4
      else if (
        !survives &&
        kills &&
        UNIT_STATS[target.type].cost > UNIT_STATS[attacker.type].cost
      ) category = 3
      else if (dealt > received) category = 2
      candidates.push({
        kind: 'unit', attacker, target, priority: category * 100,
        threat: Number(threat), defenderHp: result.defenderHp,
        attackerHp: result.attackerHp, damageMargin: dealt - received, matchup,
      })
    }
    for (const target of getAttackableSites(state, attacker).sort(compareIds)) {
      const currentHp = target.hp ?? getSiteMaxHp(target) ?? 0
      const result = resolveSiteCombat(state, attacker, target)
      const captures = result.siteHp === 0
      const capital = Boolean(
        target.capitalFor &&
          target.capitalFor !== factionId &&
          target.ownerId !== 'neutral' &&
          target.ownerId !== factionId,
      )
      candidates.push({
        kind: 'site', attacker, target,
        priority: captures && capital ? 1_000 : captures ? 90 : 80,
        siteHp: result.siteHp, damage: currentHp - result.siteHp,
      })
    }
  }
  return candidates.sort(compareAttackCandidates)[0]
}

function attackDecision(state: GameState, candidate: AttackCandidate): AiDecision {
  if (state.selectedUnitId !== candidate.attacker.id) {
    return {
      action: { type: 'unitSelected', unitId: candidate.attacker.id },
      reason: 'immediateAttack',
    }
  }
  return candidate.kind === 'unit'
    ? {
        action: {
          type: 'unitAttacked', attackerId: candidate.attacker.id,
          defenderId: candidate.target.id,
        },
        reason: 'immediateAttack',
      }
    : {
        action: {
          type: 'siteAttacked', attackerId: candidate.attacker.id,
          siteId: candidate.target.id,
        },
        reason: 'immediateAttack',
      }
}

type DefenseAssignment = { unit: Unit; target: Target }

function chooseCapitalDefense(state: GameState, factionId: FactionId): DefenseAssignment | undefined {
  const threats = getCapitalThreats(state, factionId)
  if (threats.length === 0) return undefined
  return state.units
    .filter(
      (unit) =>
        unit.factionId === factionId &&
        isMilitaryUnitType(unit.type) &&
        !unit.hasActed &&
        unit.movementRemaining > 0,
    )
    .sort(compareIds)
    .flatMap((unit) => {
      const search = getWeightedPathSearch(state, unit, unit.position)
      const target = chooseClosestTarget(
        threats.map((threat) => unitTarget(state, unit, threat, 'capitalDefense')),
        search.costs,
      )
      return target ? [{ unit, target }] : []
    })
    .sort(
      (left, right) =>
        left.target.cost - right.target.cost ||
        left.target.id.localeCompare(right.target.id) ||
        left.unit.id.localeCompare(right.unit.id) ||
        comparePositions(left.target.destination, right.target.destination),
    )[0]
}

function positionCanAttack(state: GameState, unit: Unit, position: Position) {
  const range = UNIT_STATS[unit.type].range
  return (
    state.units.some(
      (enemy) =>
        enemy.factionId !== unit.factionId &&
        getHexDistance(position, enemy.position) <= range,
    ) ||
    state.sites.some(
      (site) =>
        isFortifiedSite(site) &&
        site.ownerId !== unit.factionId &&
        getSiteOccupiedPositions(site).some(
          (cell) => getHexDistance(position, cell) <= range,
        ),
    )
  )
}

function getEnemyExposure(state: GameState, unit: Unit, position: Position) {
  return state.units.filter(
    (enemy) =>
      enemy.factionId !== unit.factionId &&
      getHexDistance(position, enemy.position) <= UNIT_STATS[enemy.type].range,
  ).length
}

type MovementCandidate = {
  position: Position
  attackOpportunity: number
  objectiveCompleted: number
  zonePenalty: number
  exposure: number
  defense: number
  rangePenalty: number
  remainingCost: number
}

function compareMovementCandidates(left: MovementCandidate, right: MovementCandidate) {
  return (
    right.attackOpportunity - left.attackOpportunity ||
    right.objectiveCompleted - left.objectiveCompleted ||
    left.zonePenalty - right.zonePenalty ||
    left.exposure - right.exposure ||
    right.defense - left.defense ||
    left.rangePenalty - right.rangePenalty ||
    left.remainingCost - right.remainingCost ||
    comparePositions(left.position, right.position)
  )
}

function chooseMovement(state: GameState, unit: Unit, target: Target) {
  const reachable = getReachablePositionCosts(state, unit)
  const remainingCostCache = new Map<string, number>()
  const candidates = [...reachable.keys()]
    .map((key): MovementCandidate => {
      const [q, r] = key.split(',').map(Number)
      const position = { q, r }
      const movementCost = reachable.get(key) ?? unit.movementRemaining
      const movementAfter = unit.movementRemaining - movementCost
      const stoppedByZone =
        movementAfter > 0 &&
        isPositionInEnemyZoneOfControl(state, unit.factionId, position)
      const canActAfterMove = movementAfter > 0 || stoppedByZone
      const attackOpportunity = Number(
        canActAfterMove && positionCanAttack(state, unit, position),
      )
      const objectiveCompleted = Number(
        target.positions.some((candidate) => positionKey(candidate) === key) &&
          (!target.requiresAction || canActAfterMove),
      )
      const immediate = attackOpportunity > 0 || objectiveCompleted > 0
      let remainingCost = remainingCostCache.get(key)
      if (remainingCost === undefined) {
        const search = getWeightedPathSearch(state, unit, position)
        remainingCost = Math.min(
          ...target.positions.map(
            (candidate) => search.costs.get(positionKey(candidate)) ?? Infinity,
          ),
        )
        remainingCostCache.set(key, remainingCost)
      }
      const nearest = Math.min(
        ...target.referencePositions.map((reference) => getHexDistance(position, reference)),
      )
      const tile = getTileAt(state, position)
      return {
        position,
        attackOpportunity,
        objectiveCompleted,
        zonePenalty: Number(
          !immediate && isPositionInEnemyZoneOfControl(state, unit.factionId, position),
        ),
        exposure: getEnemyExposure(state, unit, position),
        defense: tile ? TERRAIN_COMBAT_BONUS[tile.terrain] : 0,
        rangePenalty: Math.abs(nearest - (unit.type === 'archer' ? 2 : 1)),
        remainingCost,
      }
    })
    .filter((candidate) => Number.isFinite(candidate.remainingCost))
    .sort(compareMovementCandidates)
  return candidates[0]
    ? { type: 'unitMoved' as const, unitId: unit.id, destination: candidates[0].position }
    : undefined
}

function chooseCivilianMovement(
  state: GameState,
  unit: Unit,
  destination: Position,
) {
  const reachable = getReachablePositionCosts(state, unit)
  const best = [...reachable.keys()]
    .map((key) => {
      const [q, r] = key.split(',').map(Number)
      const position = { q, r }
      const remaining = getWeightedPathSearch(state, unit, position).costs.get(
        positionKey(destination),
      )
      return remaining === undefined ? undefined : { position, remaining }
    })
    .filter((candidate): candidate is { position: Position; remaining: number } =>
      Boolean(candidate),
    )
    .sort(
      (left, right) =>
        left.remaining - right.remaining ||
        comparePositions(left.position, right.position),
    )[0]
  return best
    ? { type: 'unitMoved' as const, unitId: unit.id, destination: best.position }
    : undefined
}

function chooseCivilianDecision(
  state: GameState,
  unit: Unit,
): AiDecision {
  if (unit.type === 'settler') {
    if (canSettle(state, unit.id).ok) {
      return {
        action: { type: 'siteSettled', unitId: unit.id },
        reason: 'settlement',
      }
    }
    const candidate = chooseSettlementCandidate(state, unit.factionId, [unit])
    const movement = candidate
      ? chooseCivilianMovement(state, unit, candidate.position)
      : undefined
    return {
      action: movement ?? { type: 'unitWaited', unitId: unit.id },
      reason: 'settlement',
    }
  }

  const immediate = BUILDABLE_SITE_TYPES
    .filter((siteKind) => canConstruct(state, unit.id, siteKind).ok)
    .sort(
      (left, right) =>
        constructionPriority(state, unit.factionId, left, unit.position) -
          constructionPriority(state, unit.factionId, right, unit.position) ||
        left.localeCompare(right),
    )[0]
  if (immediate) {
    return {
      action: { type: 'siteConstructed', unitId: unit.id, siteKind: immediate },
      reason: 'siteConstruction',
    }
  }
  const candidate = chooseConstructionCandidate(state, unit.factionId, [unit])
  if (
    candidate &&
    positionKey(candidate.position) === positionKey(unit.position)
  ) {
    return {
      action: { type: 'unitWaited', unitId: unit.id },
      reason: 'siteConstruction',
    }
  }
  const movement = candidate
    ? chooseCivilianMovement(state, unit, candidate.position)
    : undefined
  return {
    action: movement ?? { type: 'unitWaited', unitId: unit.id },
    reason: 'siteConstruction',
  }
}

export function getAiUnitCap(state: GameState, factionId: FactionId) {
  const sites = state.sites.filter((site) => site.ownerId === factionId)
  return (
    3 +
    sites.filter((site) => site.kind === 'city').length +
    sites.filter((site) => site.kind === 'keep').length +
    sites.filter((site) => site.kind === 'stronghold').length * 2 +
    sites.filter((site) => site.kind === 'city' && hasBuilding(site, 'barracks')).length
  )
}

function getAvailableProductionSites(state: GameState, factionId: FactionId) {
  return state.sites
    .filter(
      (site) =>
        site.ownerId === factionId &&
        site.lastProducedTurn !== state.turn &&
        getDeployablePositions(state, site).length > 0,
    )
    .sort(compareIds)
}

function chooseBuilderProduction(state: GameState, factionId: FactionId) {
  if (!canProduceCivilianUnit(state, factionId, 'builder').ok) return undefined
  const livingBuilders = state.units.filter(
    (unit) => unit.factionId === factionId && unit.type === 'builder',
  )
  if (
    livingBuilders.length > 0 &&
    chooseConstructionCandidate(state, factionId, livingBuilders)
  ) {
    return undefined
  }

  for (const city of getAvailableProductionSites(state, factionId).filter(
    (site) => site.kind === 'city',
  )) {
    const origins = getDeployablePositions(state, city).map((position, index) =>
      civilianAt(factionId, 'builder', position, `builder-origin-${index}`),
    )
    const candidate = chooseConstructionCandidate(state, factionId, origins)
    if (!candidate) continue
    const productionCost = getUnitProductionCost(
      state,
      factionId,
      'builder',
      city,
    )
    if (
      !canSpendWithUpkeepReserve(
        state,
        factionId,
        productionCost + SITE_CONSTRUCTION_COSTS[candidate.siteKind],
        { upkeepDelta: UNIT_UPKEEP.builder },
      ).ok
    ) {
      continue
    }
    return {
      type: 'unitProduced' as const,
      siteId: city.id,
      unitType: 'builder' as const,
      destination: candidate.origin.position,
    }
  }
  return undefined
}

function chooseSettlerProduction(state: GameState, factionId: FactionId) {
  if (!canProduceCivilianUnit(state, factionId, 'settler').ok) return undefined
  for (const city of getAvailableProductionSites(state, factionId).filter(
    (site) => site.kind === 'city',
  )) {
    const origins = getDeployablePositions(state, city).map((position, index) =>
      civilianAt(factionId, 'settler', position, `settler-origin-${index}`),
    )
    const candidate = chooseSettlementCandidate(state, factionId, origins)
    if (!candidate) continue
    const cost = getUnitProductionCost(state, factionId, 'settler', city)
    if (
      !canSpendWithUpkeepReserve(state, factionId, cost, {
        upkeepDelta: UNIT_UPKEEP.settler,
      }).ok
    ) {
      continue
    }
    return {
      type: 'unitProduced' as const,
      siteId: city.id,
      unitType: 'settler' as const,
      destination: candidate.origin.position,
    }
  }
  return undefined
}

function chooseMilitaryProduction(state: GameState, factionId: FactionId) {
  const unitCount = state.units.filter(
    (unit) => unit.factionId === factionId && isMilitaryUnitType(unit.type),
  ).length
  if (unitCount >= getAiUnitCap(state, factionId)) return undefined
  const sites = getAvailableProductionSites(state, factionId).filter((site) =>
    getProducibleUnitTypes(site).some(isMilitaryUnitType),
  )
  const counts = new Map<MilitaryUnitType, number>(
    AI_PRODUCTION_PRIORITY.map((type) => [
      type,
      state.units.filter((unit) => unit.factionId === factionId && unit.type === type).length,
    ]),
  )
  for (const site of sites) {
    const unitType = getProducibleUnitTypes(site)
      .filter(isMilitaryUnitType)
      .filter(
        (type) =>
          canSiteProduceUnit(site, type) &&
          getFactionUpkeep(state, factionId) + UNIT_UPKEEP[type] <=
            getFactionIncome(state, factionId) &&
          canSpendWithUpkeepReserve(
            state,
            factionId,
            getUnitProductionCost(state, factionId, type, site),
            { upkeepDelta: UNIT_UPKEEP[type] },
          ).ok,
      )
      .sort(
        (left, right) =>
          (counts.get(left) ?? 0) - (counts.get(right) ?? 0) ||
          AI_PRODUCTION_PRIORITY.indexOf(left) - AI_PRODUCTION_PRIORITY.indexOf(right),
      )[0]
    if (unitType) {
      return {
        type: 'unitProduced' as const,
        siteId: site.id,
        unitType,
        destination: getDeployablePositions(state, site)[0],
      }
    }
  }
  return undefined
}

type InvestmentAction = Extract<GameAction, { type: 'siteDeveloped' | 'constructionStarted' }>
type InvestmentCandidate = {
  action: InvestmentAction
  tier: number
  incomeDelta: number
  payback: number
  cost: number
  stableKey: string
}

function compareInvestmentCandidates(left: InvestmentCandidate, right: InvestmentCandidate) {
  if (left.tier !== right.tier) return left.tier - right.tier
  if (left.tier === 2) {
    return (
      right.incomeDelta - left.incomeDelta ||
      left.payback - right.payback ||
      left.cost - right.cost ||
      left.stableKey.localeCompare(right.stableKey)
    )
  }
  return left.cost - right.cost || left.stableKey.localeCompare(right.stableKey)
}

function hasProductionOpportunity(state: GameState, factionId: FactionId) {
  return state.sites.some(
    (site) =>
      site.ownerId === factionId &&
      getProducibleUnitTypes(site).some(isMilitaryUnitType) &&
      getDeployablePositions(state, site).length > 0,
  )
}

function isCityThreatened(state: GameState, city: Site, factionId: FactionId) {
  return state.units.some(
    (unit) =>
      unit.factionId !== factionId &&
      isMilitaryUnitType(unit.type) &&
      getSiteOccupiedPositions(city).some(
        (position) => getHexDistance(unit.position, position) <= 2,
      ),
  )
}

function chooseInvestment(state: GameState, factionId: FactionId) {
  const ownedSites = state.sites.filter((site) => site.ownerId === factionId)
  if (
    ownedSites.some(
      (site) =>
        site.lastDevelopedTurn === state.turn ||
        site.constructionQueue?.startedTurn === state.turn,
    )
  ) return undefined
  const unitCount = state.units.filter(
    (unit) => unit.factionId === factionId && isMilitaryUnitType(unit.type),
  ).length
  const needsCapacity =
    unitCount >= getAiUnitCap(state, factionId) && hasProductionOpportunity(state, factionId)
  const candidates: InvestmentCandidate[] = []

  for (const site of [...ownedSites].sort(compareIds)) {
    const target = getSiteDevelopmentTarget(site)
    if (!target) continue
    const footprints: Array<Position[] | undefined> =
      site.kind === 'village' || site.kind === 'town'
        ? [...getSiteDevelopmentFootprints(state, site)].sort(compareFootprints)
        : [undefined]
    for (const footprint of footprints) {
      const check = canDevelopSite(state, site.id, footprint)
      if (!check.ok) continue
      const projected: Site = { ...site, kind: target.kind, level: target.level }
      const incomeDelta = getSiteIncome(projected) - getSiteIncome(site)
      const tier =
        needsCapacity && (target.kind === 'keep' || target.kind === 'stronghold')
          ? 1
          : incomeDelta > 0
            ? 2
            : 3
      candidates.push({
        action: { type: 'siteDeveloped', siteId: site.id, footprint },
        tier,
        incomeDelta,
        payback: incomeDelta > 0 ? check.cost / incomeDelta : Infinity,
        cost: check.cost,
        stableKey: `${site.id}:develop:${footprint?.map(positionKey).sort().join('|') ?? ''}`,
      })
      break
    }
  }

  for (const city of ownedSites
    .filter((site) => site.kind === 'city' && !site.constructionQueue)
    .sort(compareIds)) {
    for (const buildingId of BUILDING_IDS) {
      if (hasBuilding(city, buildingId)) continue
      const check = canStartConstruction(state, city.id, buildingId)
      if (!check.ok) continue
      const definition = BUILDING_DEFINITIONS[buildingId]
      const incomeDelta = buildingId === 'market' ? 2 : buildingId === 'granary' ? 1 : 0
      const tier =
        buildingId === 'wall' && isCityThreatened(state, city, factionId)
          ? 0
          : buildingId === 'barracks' && needsCapacity
            ? 1
            : incomeDelta > 0
              ? 2
              : 3
      candidates.push({
        action: { type: 'constructionStarted', siteId: city.id, buildingId },
        tier,
        incomeDelta,
        payback: incomeDelta > 0 ? definition.cost / incomeDelta : Infinity,
        cost: definition.cost,
        stableKey: `${city.id}:build:${buildingId}`,
      })
    }
  }
  return candidates.sort(compareInvestmentCandidates)[0]?.action
}

function chooseDisband(state: GameState, factionId: FactionId) {
  if (getFactionUpkeep(state, factionId) <= getFactionIncome(state, factionId)) return undefined
  const units = state.units.filter((unit) => unit.factionId === factionId)
  const protectedIds = new Set(
    units
      .filter((unit) => getAttackableUnits(state, unit).length > 0)
      .map((unit) => unit.id),
  )
  const unprotected = units.filter((unit) => !protectedIds.has(unit.id))
  const selected = [...(unprotected.length > 0 ? unprotected : units)].sort(
    (left, right) =>
      UNIT_UPKEEP[right.type] - UNIT_UPKEEP[left.type] ||
      left.hp - right.hp ||
      left.id.localeCompare(right.id),
  )[0]
  return selected ? { type: 'unitDisbanded' as const, unitId: selected.id } : undefined
}

function movementReason(target: Target): AiDecisionReason {
  return target.kind === 'capitalDefense'
    ? 'capitalDefense'
    : target.kind === 'economicExpansion'
      ? 'economicExpansion'
      : 'offense'
}

export function chooseAiDecision(
  state: GameState,
  factionId = state.activeFactionId,
): AiDecision | undefined {
  if (
    state.phase !== 'playing' ||
    state.activeFactionId !== factionId ||
    factionId === state.humanFactionId
  ) return undefined

  const disband = chooseDisband(state, factionId)
  if (disband) return { action: disband, reason: 'deficitDisband' }
  const attack = getBestAttack(state, factionId)
  if (attack) return attackDecision(state, attack)

  const defense = chooseCapitalDefense(state, factionId)
  if (defense) {
    if (state.selectedUnitId !== defense.unit.id) {
      return {
        action: { type: 'unitSelected', unitId: defense.unit.id },
        reason: 'capitalDefense',
      }
    }
    const movement = chooseMovement(state, defense.unit, defense.target)
    return {
      action: movement ?? { type: 'unitWaited', unitId: defense.unit.id },
      reason: 'capitalDefense',
    }
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
    if (nextUnit) {
      const target = isMilitaryUnitType(nextUnit.type)
        ? chooseStrategicTarget(
            state,
            nextUnit,
            getWeightedPathSearch(state, nextUnit, nextUnit.position),
          )
        : undefined
      return {
        action: { type: 'unitSelected', unitId: nextUnit.id },
        reason: nextUnit.type === 'settler'
          ? 'settlement'
          : nextUnit.type === 'builder'
            ? 'siteConstruction'
            : target
              ? movementReason(target)
              : 'tacticalMove',
      }
    }
    const investment = chooseInvestment(state, factionId)
    if (investment) return { action: investment, reason: 'investment' }
    const production =
      chooseBuilderProduction(state, factionId) ??
      chooseSettlerProduction(state, factionId) ??
      chooseMilitaryProduction(state, factionId)
    if (production) return { action: production, reason: 'production' }
    return { action: { type: 'turnEnded' }, reason: 'endTurn' }
  }

  if (isCivilianUnitType(selectedUnit.type)) {
    return chooseCivilianDecision(state, selectedUnit)
  }

  const target = chooseStrategicTarget(
    state,
    selectedUnit,
    getWeightedPathSearch(state, selectedUnit, selectedUnit.position),
  )
  if (!target) {
    return {
      action: { type: 'unitWaited', unitId: selectedUnit.id },
      reason: 'tacticalMove',
    }
  }
  const movement = chooseMovement(state, selectedUnit, target)
  return {
    action: movement ?? { type: 'unitWaited', unitId: selectedUnit.id },
    reason: movement ? 'tacticalMove' : movementReason(target),
  }
}

export function chooseAiAction(state: GameState, factionId = state.activeFactionId) {
  return chooseAiDecision(state, factionId)?.action
}
