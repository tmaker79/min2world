import {
  getAllHexPositions,
  getHexDistance,
  getHexNeighbors,
  getOppositeBoardPosition,
  positionKey,
} from './hex'
import { UNIT_MAX_HP, UNIT_STATS } from './rules'
import { MAP_GENERATION_VERSION } from './types'
import type {
  FactionId,
  GameState,
  Position,
  Site,
  SiteType,
  Terrain,
  Tile,
  Unit,
  UnitType,
} from './types'

export const DEFAULT_MAP_SEED = 'min2world'

const STARTING_RESOURCES = 15
const MAX_GENERATION_ATTEMPTS = 128
const CAPITAL_DISTANCE_FROM_CENTER = 5
const SITE_PAIR_TYPES: readonly SiteType[] = ['city', 'village', 'mine']
const STARTING_UNIT_TYPES: readonly UnitType[] = [
  'infantry',
  'infantry',
  'cavalry',
]

const TERRAIN_COST: Record<Terrain, number | null> = {
  plain: 1,
  mountain: null,
  water: null,
  hill: 2,
  forest: 2,
}

function hashSeed(value: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function normalizeMapSeed(seed: string): string | undefined {
  const normalized = seed.trim()
  return normalized.length >= 1 && normalized.length <= 64
    ? normalized
    : undefined
}

export function createRandomMapSeed(): string {
  const values = new Uint32Array(1)

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values)
  } else {
    values[0] = Math.floor(Math.random() * 0x100000000)
  }

  return values[0].toString(16).padStart(8, '0')
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function createClusteredValues(
  positions: Position[],
  random: () => number,
): Map<string, number> {
  let values = new Map(
    positions.map((position) => [positionKey(position), random()]),
  )

  for (let pass = 0; pass < 2; pass += 1) {
    values = new Map(
      positions.map((position) => {
        const samples = [
          values.get(positionKey(position)) ?? 0.5,
          ...getHexNeighbors(position).map(
            (neighbor) => values.get(positionKey(neighbor)) ?? 0.5,
          ),
        ]
        return [
          positionKey(position),
          samples.reduce((total, value) => total + value, 0) / samples.length,
        ]
      }),
    )
  }

  return values
}

function terrainFromNoise(elevation: number, moisture: number): Terrain {
  if (elevation < 0.34) return 'water'
  if (elevation > 0.68) return 'mountain'
  if (elevation > 0.59) return 'hill'
  if (moisture > 0.61) return 'forest'
  return 'plain'
}

function opposite(position: Position): Position {
  return getOppositeBoardPosition(position)
}

function chooseCapitals(random: () => number): Record<FactionId, Position> {
  const candidates = getAllHexPositions().filter(
    (position) =>
      getHexDistance(position, { q: 0, r: 0 }) ===
        CAPITAL_DISTANCE_FROM_CENTER &&
      positionKey(position) < positionKey(opposite(position)),
  )
  const selected = candidates[Math.floor(random() * candidates.length)]
  const player = random() < 0.5 ? selected : opposite(selected)

  return { player, enemy: opposite(player) }
}

function getPassableKeys(tiles: Tile[]): Set<string> {
  return new Set(
    tiles
      .filter((tile) => TERRAIN_COST[tile.terrain] !== null)
      .map((tile) => positionKey(tile.position)),
  )
}

function getConnectedKeys(tiles: Tile[], start: Position): Set<string> {
  const passable = getPassableKeys(tiles)
  const connected = new Set<string>()
  const frontier = [start]

  while (frontier.length > 0) {
    const current = frontier.shift()!
    const key = positionKey(current)
    if (connected.has(key) || !passable.has(key)) continue
    connected.add(key)
    frontier.push(...getHexNeighbors(current))
  }

  return connected
}

function chooseNeutralSites(
  tiles: Tile[],
  capitals: Record<FactionId, Position>,
  random: () => number,
): Site[] | undefined {
  const connected = getConnectedKeys(tiles, capitals.player)
  const chosen: Position[] = [capitals.player, capitals.enemy]
  const pairs: Array<{ kind: SiteType; position: Position }> = []
  const candidates = shuffled(
    tiles
      .map((tile) => tile.position)
      .filter((position) => {
        const reflected = opposite(position)
        return (
          positionKey(position) < positionKey(reflected) &&
          connected.has(positionKey(position)) &&
          connected.has(positionKey(reflected)) &&
          getHexDistance(position, { q: 0, r: 0 }) >= 2
        )
      }),
    random,
  )

  for (const kind of SITE_PAIR_TYPES) {
    const position = candidates.find((candidate) => {
      const reflected = opposite(candidate)
      return [candidate, reflected].every((item) =>
        chosen.every((existing) => getHexDistance(item, existing) >= 3),
      )
    })

    if (!position) return undefined
    const reflected = opposite(position)
    chosen.push(position, reflected)
    pairs.push({ kind, position }, { kind, position: reflected })
  }

  return pairs.map(({ kind, position }, index) => ({
    id: `site-${kind}-${index + 1}`,
    name: `${kind === 'city' ? '중립 마을' : kind === 'village' ? '중립 농장' : '중립 광산'} ${Math.floor(index / 2) + 1}`,
    kind,
    position: { ...position },
    ownerId: 'neutral',
  }))
}

function getWeightedCosts(tiles: Tile[], start: Position): Map<string, number> {
  const tileByKey = new Map(tiles.map((tile) => [positionKey(tile.position), tile]))
  const costs = new Map<string, number>([[positionKey(start), 0]])
  const frontier: Array<{ position: Position; cost: number }> = [
    { position: start, cost: 0 },
  ]

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost)
    const current = frontier.shift()!
    const currentKey = positionKey(current.position)
    if (current.cost !== costs.get(currentKey)) continue

    for (const neighbor of getHexNeighbors(current.position)) {
      const neighborKey = positionKey(neighbor)
      const terrain = tileByKey.get(neighborKey)?.terrain
      if (!terrain || TERRAIN_COST[terrain] === null) continue
      const stepCost = TERRAIN_COST[terrain] ?? 1
      const nextCost = current.cost + stepCost
      if (nextCost >= (costs.get(neighborKey) ?? Infinity)) continue
      costs.set(neighborKey, nextCost)
      frontier.push({ position: neighbor, cost: nextCost })
    }
  }

  return costs
}

export function validateGeneratedMap(state: GameState): string[] {
  const issues: string[] = []
  if (state.tiles.length !== getAllHexPositions().length) issues.push('tileCount')
  if (state.sites.length !== 8) issues.push('siteCount')

  const tileKeys = state.tiles.map((tile) => positionKey(tile.position))
  const siteKeys = state.sites.map((site) => positionKey(site.position))
  if (new Set(tileKeys).size !== tileKeys.length) issues.push('duplicateTiles')
  if (new Set(siteKeys).size !== siteKeys.length) issues.push('duplicateSites')

  const capitals = Object.fromEntries(
    state.sites
      .filter((site) => site.capitalFor)
      .map((site) => [site.capitalFor!, site.position]),
  ) as Partial<Record<FactionId, Position>>

  if (!capitals.player || !capitals.enemy) return [...issues, 'capitals']

  const connected = getConnectedKeys(state.tiles, capitals.player)
  if (
    !connected.has(positionKey(capitals.enemy)) ||
    state.sites.some((site) => !connected.has(positionKey(site.position)))
  ) {
    issues.push('connectivity')
  }

  const localCounts = (['player', 'enemy'] as const).map((factionId) =>
    state.tiles.filter(
      (tile) =>
        TERRAIN_COST[tile.terrain] !== null &&
        getHexDistance(tile.position, capitals[factionId]!) <= 2,
    ).length,
  )
  if (localCounts.some((count) => count < 10)) issues.push('startingArea')
  if (Math.abs(localCounts[0] - localCounts[1]) > 2) issues.push('localBalance')

  for (let left = 0; left < state.sites.length; left += 1) {
    for (let right = left + 1; right < state.sites.length; right += 1) {
      if (getHexDistance(state.sites[left].position, state.sites[right].position) < 3) {
        issues.push('siteSpacing')
        left = state.sites.length
        break
      }
    }
  }

  const neutralKeys = state.sites
    .filter((site) => site.ownerId === 'neutral')
    .map((site) => positionKey(site.position))
  const nearestCosts = (['player', 'enemy'] as const).map((factionId) => {
    const costs = getWeightedCosts(state.tiles, capitals[factionId]!)
    return Math.min(...neutralKeys.map((key) => costs.get(key) ?? Infinity))
  })
  if (Math.abs(nearestCosts[0] - nearestCosts[1]) > 2) issues.push('costBalance')

  return [...new Set(issues)]
}

function createSites(capitals: Record<FactionId, Position>, neutrals: Site[]): Site[] {
  return [
    {
      id: 'site-player-stronghold',
      name: '푸른 성채',
      kind: 'stronghold',
      position: { ...capitals.player },
      ownerId: 'player',
      capitalFor: 'player',
    },
    {
      id: 'site-enemy-stronghold',
      name: '붉은 요새',
      kind: 'stronghold',
      position: { ...capitals.enemy },
      ownerId: 'enemy',
      capitalFor: 'enemy',
    },
    ...neutrals,
  ]
}

function createUnits(
  capitals: Record<FactionId, Position>,
  tiles: Tile[],
): Unit[] {
  const passable = getPassableKeys(tiles)
  const playerPositions = getHexNeighbors(capitals.player)
    .filter((position) => passable.has(positionKey(position)))
    .sort((left, right) => left.r - right.r || left.q - right.q)
    .slice(0, 3)
  const enemyPositions = playerPositions.map(opposite)
  const names: Record<FactionId, readonly string[]> = {
    player: ['청룡 보병대', '백호 보병대', '바람 기병대'],
    enemy: ['적월 보병대', '철창 보병대', '흑염 기병대'],
  }

  return (['player', 'enemy'] as const).flatMap((factionId) =>
    STARTING_UNIT_TYPES.map((type, index) => ({
      id: `${factionId}-${type}-${index + 1}`,
      name: names[factionId][index],
      factionId,
      type,
      position: {
        ...(factionId === 'player' ? playerPositions[index] : enemyPositions[index]),
      },
      hp: UNIT_MAX_HP,
      maxHp: UNIT_MAX_HP,
      movementRemaining: UNIT_STATS[type].movement,
      hasActed: false,
    })),
  )
}

function buildCandidate(seed: string, attempt: number, fallback = false): GameState | undefined {
  const random = createRandom(hashSeed(`${seed}:${MAP_GENERATION_VERSION}:${attempt}`))
  const positions = getAllHexPositions()
  const elevation = createClusteredValues(positions, random)
  const moisture = createClusteredValues(positions, random)
  const capitals = chooseCapitals(random)
  const tiles: Tile[] = positions.map((position) => ({
    id: `tile-${position.q}-${position.r}`,
    position: { ...position },
    terrain: fallback
      ? 'plain'
      : terrainFromNoise(
          elevation.get(positionKey(position)) ?? 0.5,
          moisture.get(positionKey(position)) ?? 0.5,
        ),
  }))

  for (const factionId of ['player', 'enemy'] as const) {
    const localTiles = tiles.filter(
      (tile) => getHexDistance(tile.position, capitals[factionId]) <= 2,
    )
    for (const tile of localTiles) {
      if (tile.terrain === 'water') tile.terrain = 'plain'
      if (tile.terrain === 'mountain') tile.terrain = 'hill'
    }
  }

  const neutralSites = chooseNeutralSites(tiles, capitals, random)
  if (!neutralSites) return undefined
  const sites = createSites(capitals, neutralSites)
  const siteIdsByPosition = new Map(
    sites.map((site) => [positionKey(site.position), site.id]),
  )
  for (const tile of tiles) {
    tile.siteId = siteIdsByPosition.get(positionKey(tile.position))
  }

  const state: GameState = {
    schemaVersion: 6,
    mapSeed: seed,
    mapGenerationVersion: MAP_GENERATION_VERSION,
    turn: 1,
    phase: 'playing',
    activeFactionId: 'player',
    resources: { player: STARTING_RESOURCES, enemy: STARTING_RESOURCES },
    tiles,
    units: createUnits(capitals, tiles),
    sites,
  }

  return validateGeneratedMap(state).length === 0 ? state : undefined
}

export function generateGameState(seed: string): GameState {
  const normalized = normalizeMapSeed(seed)
  if (!normalized) throw new Error('Seed must contain between 1 and 64 characters.')

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const state = buildCandidate(normalized, attempt)
    if (state) return state
  }

  const fallback = buildCandidate(normalized, MAX_GENERATION_ATTEMPTS, true)
  if (!fallback) throw new Error('Unable to generate a valid map.')
  return fallback
}
