import {
  getHexDistance,
  getHexNeighbors,
  isPositionOnBoard,
  positionKey,
  positionsEqual,
} from './hex'
import { MinPriorityQueue } from './priorityQueue'
import { getSiteOccupiedPositions } from './siteFootprint'
import {
  getSitePositionIndex,
  getTileIndex,
  getUnitPositionIndex,
  getZoneOfControlIndex,
} from './spatialIndex'
import type {
  FactionId,
  GamePhase,
  GameState,
  Position,
  Site,
  SiteCombatStats,
  SiteStats,
  SiteType,
  Terrain,
  Unit,
  UnitStats,
  UnitType,
} from './types'

export { getHexDistance, getHexNeighbors, isPositionOnBoard, positionKey, positionsEqual }

export const UNIT_MAX_HP = 100

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: { movement: 2, melee: 45, ranged: 0, range: 1, cost: 10 },
  spearman: { movement: 2, melee: 45, ranged: 0, range: 1, cost: 13 },
  archer: { movement: 2, melee: 30, ranged: 40, range: 2, cost: 15 },
  cavalry: { movement: 4, melee: 50, ranged: 0, range: 1, cost: 18 },
}

export const UNIT_TYPES: readonly UnitType[] = [
  'infantry',
  'cavalry',
  'archer',
  'spearman',
]

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  infantry: '보병',
  cavalry: '기병',
  archer: '궁병',
  spearman: '창병',
}

export const SITE_STATS: Record<SiteType, SiteStats> = {
  outpost: { income: 2, canProduce: true },
  keep: { income: 3, canProduce: true },
  stronghold: { income: 5, canProduce: true },
  village: { income: 3, canProduce: false },
  town: { income: 5, canProduce: false },
  city: { income: 7, canProduce: true },
  farm: { income: 2, canProduce: false },
  mine: { income: 3, canProduce: false },
  blacksmith: { income: 2, canProduce: false },
}

export type FortifiedSiteKind = 'outpost' | 'keep' | 'stronghold' | 'city'

export const SITE_COMBAT_STATS: Record<FortifiedSiteKind, SiteCombatStats> = {
  outpost: { maxHp: 50, defense: 35 },
  keep: { maxHp: 75, defense: 42 },
  stronghold: { maxHp: 100, defense: 50 },
  city: { maxHp: 120, defense: 55 },
}

export function isFortifiedSiteKind(
  kind: SiteType,
): kind is FortifiedSiteKind {
  return kind in SITE_COMBAT_STATS
}

export function isFortifiedSite(
  site: Site,
): site is Site & { kind: FortifiedSiteKind } {
  return isFortifiedSiteKind(site.kind)
}

export function getSiteCombatStats(
  siteOrKind: Site | SiteType,
): SiteCombatStats | undefined {
  const kind = typeof siteOrKind === 'string' ? siteOrKind : siteOrKind.kind
  return isFortifiedSiteKind(kind) ? SITE_COMBAT_STATS[kind] : undefined
}

export function getSiteMaxHp(siteOrKind: Site | SiteType): number | undefined {
  const stats = getSiteCombatStats(siteOrKind)
  if (!stats) return undefined
  return typeof siteOrKind !== 'string' && siteOrKind.maxHp !== undefined
    ? siteOrKind.maxHp
    : stats.maxHp
}

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  outpost: '전초기지',
  keep: '요새',
  stronghold: '성채',
  village: '마을',
  town: '소도시',
  farm: '농장',
  mine: '광산',
  city: '도시',
  blacksmith: '대장간',
}

const PRODUCIBLE_UNIT_TYPES: Record<SiteType, readonly UnitType[]> = {
  outpost: ['infantry'],
  keep: ['infantry', 'spearman', 'archer'],
  stronghold: UNIT_TYPES,
  village: [],
  town: [],
  city: UNIT_TYPES,
  farm: [],
  mine: [],
  blacksmith: [],
}

export function getSiteLevel(site: Site): 1 | 2 | 3 {
  return site.level ?? 1
}

export function getSiteIncome(site: Site): number {
  const level = getSiteLevel(site)
  if (site.kind === 'farm' || site.kind === 'blacksmith') return level + 1
  if (site.kind === 'mine') return level + 2
  return SITE_STATS[site.kind].income
}

export function getProducibleUnitTypes(site: Site): readonly UnitType[] {
  return PRODUCIBLE_UNIT_TYPES[site.kind]
}

export function canSiteProduceUnit(site: Site, unitType: UnitType): boolean {
  return getProducibleUnitTypes(site).includes(unitType)
}

export function getBlacksmithProductionDiscount(
  state: GameState,
  factionId: FactionId,
  unitType: UnitType,
): number {
  const level = Math.max(
    0,
    ...state.sites
      .filter((site) => site.ownerId === factionId && site.kind === 'blacksmith')
      .map(getSiteLevel),
  )
  if (level >= 3) return 2
  if (
    level >= 1 &&
    (unitType === 'infantry' ||
      unitType === 'spearman' ||
      (level >= 2 && unitType === 'archer'))
  ) {
    return 1
  }
  return 0
}

export function getUnitProductionCost(
  state: GameState,
  factionId: FactionId,
  unitType: UnitType,
): number {
  return Math.max(
    0,
    UNIT_STATS[unitType].cost -
      getBlacksmithProductionDiscount(state, factionId, unitType),
  )
}

export const TERRAIN_MOVEMENT_COST: Record<Terrain, number | null> = {
  plain: 1,
  bridge: 1,
  mountain: null,
  water: null,
  hill: 2,
  forest: 2,
  desert: 2,
  desertHill: 2,
  oasis: 1,
  tundra: 2,
  tundraForest: 2,
  tundraMountain: null,
}

export const TERRAIN_COMBAT_BONUS: Record<Terrain, number> = {
  plain: 0,
  bridge: 0,
  mountain: 0,
  water: 0,
  hill: 3,
  forest: 3,
  desert: 0,
  desertHill: 3,
  oasis: 0,
  tundra: 0,
  tundraForest: 3,
  tundraMountain: 0,
}

export const TERRAIN_LABELS: Record<Terrain, string> = {
  plain: '평지',
  bridge: '다리',
  mountain: '산',
  water: '물',
  hill: '언덕',
  forest: '숲',
  desert: '사막',
  desertHill: '사막 언덕',
  oasis: '오아시스',
  tundra: '툰드라',
  tundraForest: '툰드라 숲',
  tundraMountain: '툰드라 산',
}

export function getTileAt(state: GameState, position: Position) {
  return getTileIndex(state).get(positionKey(position))
}

export function getUnitAt(state: GameState, position: Position) {
  return getUnitPositionIndex(state).get(positionKey(position))
}

export function getSiteAt(state: GameState, position: Position) {
  return getSitePositionIndex(state).get(positionKey(position))
}

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
      getHexDistance(unit.position, candidate.position) <=
        UNIT_STATS[unit.type].range,
  )
}

export function getAttackableSites(state: GameState, unit: Unit): Site[] {
  if (
    state.phase !== 'playing' ||
    unit.hasActed ||
    unit.factionId !== state.activeFactionId
  ) {
    return []
  }

  const range = UNIT_STATS[unit.type].range
  return state.sites.filter(
    (site) =>
      isFortifiedSite(site) &&
      site.ownerId !== unit.factionId &&
      getSiteOccupiedPositions(site).some(
        (position) => getHexDistance(unit.position, position) <= range,
      ),
  )
}

export type CombatResult = {
  attackerHp: number
  defenderHp: number
}

export const COMBAT_DAMAGE_BASE = 30
export const COMBAT_DAMAGE_EXPONENT = 0.04
export const HEALTH_STRENGTH_LOSS_PER_MISSING_HP = 0.1

export function getMatchupBonus(strikerType: UnitType, targetType: UnitType) {
  if (strikerType === 'infantry' && targetType === 'spearman') return 5
  if (strikerType === 'spearman' && targetType === 'cavalry') return 10
  return 0
}

function getHealthStrengthPenalty(hp: number, maxHp: number) {
  if (hp >= maxHp) return 0
  return (
    -HEALTH_STRENGTH_LOSS_PER_MISSING_HP *
    (100 - (hp / maxHp) * 100)
  )
}

export function getHealthCombatPenalty(unit: Unit) {
  return getHealthStrengthPenalty(unit.hp, unit.maxHp)
}

export function getDisplayedCombatStrength(unit: Unit, stat: 'melee' | 'ranged') {
  return UNIT_STATS[unit.type][stat] + getHealthCombatPenalty(unit)
}

export function getCombatStrength(
  state: GameState,
  striker: Unit,
  target: Unit,
  mode: 'attack' | 'counter',
) {
  const stats = UNIT_STATS[striker.type]
  const terrain = getTileAt(state, striker.position)?.terrain ?? 'plain'
  const base =
    mode === 'attack' && striker.type === 'archer' ? stats.ranged : stats.melee
  const matchup =
    mode === 'attack' && striker.type === 'archer'
      ? 0
      : getMatchupBonus(striker.type, target.type)

  return base + matchup + TERRAIN_COMBAT_BONUS[terrain] + getHealthCombatPenalty(striker)
}

export function getCombatDamage(
  strikerStrength: number,
  targetStrength: number,
) {
  const difference = strikerStrength - targetStrength
  return Math.max(
    1,
    Math.round(COMBAT_DAMAGE_BASE * Math.exp(COMBAT_DAMAGE_EXPONENT * difference)),
  )
}

export function resolveCombat(
  state: GameState,
  attacker: Unit,
  defender: Unit,
): CombatResult {
  const attackerStrength = getCombatStrength(state, attacker, defender, 'attack')
  const defenderStrength = getCombatStrength(state, defender, attacker, 'counter')
  const damageToDefender = getCombatDamage(attackerStrength, defenderStrength)
  // Melee exchanges apply both sides' damage at once from pre-combat strength.
  // Archer attacks stay one-way (no return damage).
  const damageToAttacker =
    attacker.type === 'archer'
      ? 0
      : getCombatDamage(defenderStrength, attackerStrength)

  return {
    attackerHp: Math.max(0, attacker.hp - damageToAttacker),
    defenderHp: Math.max(0, defender.hp - damageToDefender),
  }
}

export type SiteCombatResult = {
  siteHp: number
}

export function resolveSiteCombat(
  state: GameState,
  attacker: Unit,
  site: Site,
): SiteCombatResult {
  const siteStats = getSiteCombatStats(site)
  if (!siteStats) {
    return { siteHp: site.hp ?? 0 }
  }

  const attackerStats = UNIT_STATS[attacker.type]
  const attackerStrength =
    (attacker.type === 'archer'
      ? attackerStats.ranged
      : attackerStats.melee) +
    getHealthCombatPenalty(attacker)
  const maxHp = getSiteMaxHp(site) ?? siteStats.maxHp
  const currentHp = site.hp ?? maxHp
  const siteTerrain = getTileAt(state, site.position)?.terrain ?? 'plain'
  const siteStrength =
    siteStats.defense +
    TERRAIN_COMBAT_BONUS[siteTerrain] +
    getHealthStrengthPenalty(currentHp, maxHp)
  const damage = getCombatDamage(attackerStrength, siteStrength)

  return { siteHp: Math.max(0, currentHp - damage) }
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
  const candidates = [...candidatesByKey.values()].sort(
    (left, right) => left.r - right.r || left.q - right.q,
  )

  return candidates.filter((position) => {
    const tile = getTileAt(state, position)
    return Boolean(
      tile &&
        TERRAIN_MOVEMENT_COST[tile.terrain] !== null &&
        !getUnitAt(state, position),
    )
  })
}

export function getFactionIncome(
  state: GameState,
  factionId: FactionId,
): number {
  return state.sites
    .filter((site) => site.ownerId === factionId)
    .reduce((total, site) => total + getSiteIncome(site), 0)
}

export function captureSiteAt(
  sites: Site[],
  position: Position,
  ownerId: FactionId,
): Site[] {
  let siteCaptured = false
  const nextSites = sites.map((site) => {
    if (
      isFortifiedSite(site) ||
      !positionsEqual(site.position, position) ||
      site.ownerId === ownerId
    ) {
      return site
    }
    siteCaptured = true
    return { ...site, ownerId }
  })

  return siteCaptured ? nextSites : sites
}

export function getCapitalPhase(
  sites: Site[],
  humanFactionId: FactionId = 'player',
  factionOrder: readonly FactionId[] = ['player', 'enemy'],
): GamePhase {
  const humanCapital = sites.find(
    (site) => site.capitalFor === humanFactionId,
  )
  if (humanCapital?.ownerId !== humanFactionId) return 'defeat'

  const enemyCapitals = sites.filter(
    (site) =>
      site.capitalFor &&
      site.capitalFor !== humanFactionId &&
      factionOrder.includes(site.capitalFor),
  )
  if (
    enemyCapitals.length > 0 &&
    enemyCapitals.every((site) => site.ownerId === humanFactionId)
  ) {
    return 'victory'
  }
  return 'playing'
}
