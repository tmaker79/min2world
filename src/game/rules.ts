import {
  getHexDistance,
  getHexNeighbors,
  isPositionOnBoard,
  positionKey,
  positionsEqual,
} from './hex'
import { MinPriorityQueue } from './priorityQueue'
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
  stronghold: { income: 5, canProduce: true },
  village: { income: 4, canProduce: false },
  farm: { income: 2, canProduce: false },
  mine: { income: 3, canProduce: false },
  // Reserved until cities are implemented.
  city: { income: 0, canProduce: false },
}

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  stronghold: '성',
  village: '마을',
  farm: '농장',
  mine: '광산',
  city: '도시',
}

export const TERRAIN_MOVEMENT_COST: Record<Terrain, number | null> = {
  plain: 1,
  mountain: null,
  water: null,
  hill: 2,
  forest: 2,
  desert: 2,
  tundra: 2,
  tundraForest: 2,
}

export const TERRAIN_COMBAT_BONUS: Record<Terrain, number> = {
  plain: 0,
  mountain: 0,
  water: 0,
  hill: 3,
  forest: 3,
  desert: 0,
  tundra: 0,
  tundraForest: 3,
}

export const TERRAIN_LABELS: Record<Terrain, string> = {
  plain: '평지',
  mountain: '산',
  water: '물',
  hill: '언덕',
  forest: '숲',
  desert: '사막',
  tundra: '툰드라',
  tundraForest: '툰드라 숲',
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

export function getHealthCombatPenalty(unit: Unit) {
  if (unit.hp >= unit.maxHp) return 0
  return (
    -HEALTH_STRENGTH_LOSS_PER_MISSING_HP *
    (100 - (unit.hp / unit.maxHp) * 100)
  )
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

export function getDeployablePositions(
  state: GameState,
  site: Site,
): Position[] {
  if (!SITE_STATS[site.kind].canProduce) return []

  const candidates = [
    { ...site.position },
    ...getHexNeighbors(site.position, state.boardSize).sort(
      (left, right) => left.r - right.r || left.q - right.q,
    ),
  ]

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
    .reduce((total, site) => total + SITE_STATS[site.kind].income, 0)
}

export function captureSiteAt(
  sites: Site[],
  position: Position,
  ownerId: FactionId,
): Site[] {
  let siteCaptured = false
  const nextSites = sites.map((site) => {
    if (!positionsEqual(site.position, position) || site.ownerId === ownerId) {
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
