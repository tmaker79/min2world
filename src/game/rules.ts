import {
  getHexDistance,
  getHexNeighbors,
  isPositionOnBoard,
  positionKey,
  positionsEqual,
} from './hex'
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

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: { movement: 2, attack: 4, counterAttack: 3, range: 1, cost: 10 },
  cavalry: { movement: 3, attack: 5, counterAttack: 2, range: 1, cost: 15 },
  archer: { movement: 2, attack: 3, counterAttack: 1, range: 2, cost: 12 },
  spearman: { movement: 2, attack: 3, counterAttack: 5, range: 1, cost: 12 },
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
  city: { income: 4, canProduce: true },
  village: { income: 2, canProduce: false },
  mine: { income: 3, canProduce: false },
}

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  stronghold: '성',
  city: '도시',
  village: '마을',
  mine: '광산',
}

export const TERRAIN_MOVEMENT_COST: Record<Terrain, number | null> = {
  plain: 1,
  mountain: 2,
  water: null,
  hill: 2,
  road: 1,
  forest: 2,
  grassland: 1,
  steppe: 1,
}

export const TERRAIN_DEFENSE: Record<Terrain, number> = {
  plain: 0,
  mountain: 2,
  water: 0,
  hill: 1,
  road: 0,
  forest: 1,
  grassland: 0,
  steppe: 0,
}

export const TERRAIN_LABELS: Record<Terrain, string> = {
  plain: '평지',
  mountain: '산',
  water: '물',
  hill: '언덕',
  road: '길',
  forest: '숲',
  grassland: '초원',
  steppe: '평원',
}

export function getTileAt(state: GameState, position: Position) {
  return state.tiles.find((tile) => positionsEqual(tile.position, position))
}

export function getUnitAt(state: GameState, position: Position) {
  return state.units.find((unit) => positionsEqual(unit.position, position))
}

export function getSiteAt(state: GameState, position: Position) {
  return state.sites.find((site) => positionsEqual(site.position, position))
}

export function getMovementStepCost(
  state: GameState,
  from: Position,
  destination: Position,
): number | null {
  const fromTile = getTileAt(state, from)
  const destinationTile = getTileAt(state, destination)
  if (!fromTile || !destinationTile) return null
  if (fromTile.terrain === 'road' && destinationTile.terrain === 'road') return 0.5
  return TERRAIN_MOVEMENT_COST[destinationTile.terrain]
}

export function getEnemyZoneOfControlPositions(
  state: GameState,
  factionId: FactionId,
): Position[] {
  const positions = new Map<string, Position>()

  for (const unit of state.units) {
    if (unit.factionId === factionId) continue
    for (const position of getHexNeighbors(unit.position)) {
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
      getHexDistance(unit.position, position) === 1,
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
    frontier.sort(
      (left, right) =>
        left.cost - right.cost ||
        left.position.r - right.position.r ||
        left.position.q - right.position.q,
    )
    const current = frontier.shift()!
    const currentKey = positionKey(current.position)
    if (current.cost !== bestCosts.get(currentKey)) continue

    if (current.cost > 0 && enemyZoneOfControlPositions.has(currentKey)) {
      continue
    }

    for (const neighbor of getHexNeighbors(current.position)) {
      const neighborKey = positionKey(neighbor)
      if (occupiedPositions.has(neighborKey)) continue
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

export function resolveCombat(
  state: GameState,
  attacker: Unit,
  defender: Unit,
): CombatResult {
  const distance = getHexDistance(attacker.position, defender.position)
  const attackBonus =
    attacker.type === 'spearman' && defender.type === 'cavalry' ? 2 : 0
  const defenderTerrain = getTileAt(state, defender.position)?.terrain ?? 'plain'
  const damageToDefender = Math.max(
    1,
    UNIT_STATS[attacker.type].attack +
      attackBonus -
      TERRAIN_DEFENSE[defenderTerrain],
  )
  const defenderHp = Math.max(0, defender.hp - damageToDefender)
  const canCounter =
    distance <= UNIT_STATS[defender.type].range && defenderHp > 0
  const counterAttackBonus =
    defender.type === 'spearman' && attacker.type === 'cavalry' ? 2 : 0
  const attackerTerrain = getTileAt(state, attacker.position)?.terrain ?? 'plain'
  const damageToAttacker = Math.max(
    1,
    UNIT_STATS[defender.type].counterAttack +
      counterAttackBonus -
      TERRAIN_DEFENSE[attackerTerrain],
  )
  const attackerHp = canCounter
    ? Math.max(0, attacker.hp - damageToAttacker)
    : attacker.hp

  return { attackerHp, defenderHp }
}

export function getDeployablePositions(
  state: GameState,
  site: Site,
): Position[] {
  if (!SITE_STATS[site.kind].canProduce) return []

  const candidates = [
    { ...site.position },
    ...getHexNeighbors(site.position).sort(
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

export function getCapitalPhase(sites: Site[]): GamePhase {
  const playerCapital = sites.find((site) => site.capitalFor === 'player')
  const enemyCapital = sites.find((site) => site.capitalFor === 'enemy')

  if (enemyCapital?.ownerId === 'player') return 'victory'
  if (playerCapital?.ownerId === 'enemy') return 'defeat'
  return 'playing'
}
