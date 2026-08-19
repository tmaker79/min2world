import {
  BOARD_SIZE_PRESETS,
  DEFAULT_BOARD_SIZE,
  getAllHexPositions,
  getHexDistance,
  getHexNeighbors,
  getOppositeBoardPosition,
  positionKey,
} from './hex'
import { MinPriorityQueue } from './priorityQueue'
import { UNIT_MAX_HP, UNIT_STATS } from './rules'
import {
  FOREST_TERRAIN_VARIANT_COUNT,
  GAME_SCHEMA_VERSION,
  MAP_GENERATION_VERSION,
} from './types'
import type {
  BoardSize,
  FactionCount,
  FactionId,
  GameState,
  MapType,
  Position,
  Site,
  SiteType,
  Terrain,
  Tile,
  Unit,
  UnitType,
} from './types'

export const DEFAULT_MAP_SEED = 'min2world'
export const DEFAULT_MAP_TYPE: MapType = 'balanced'

const STARTING_RESOURCES = 15
const MAX_GENERATION_ATTEMPTS = 128
const STANDARD_CAPITAL_DISTANCE = 18
const STANDARD_CAPITAL_DISTANCE_REFERENCE_COLUMNS = 42
const SITE_PAIR_TYPES: readonly SiteType[] = ['village', 'farm', 'mine']
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
  desert: 2,
  tundra: 2,
  tundraForest: 2,
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
  boardSize: BoardSize,
): Map<string, number> {
  let values = new Map(
    positions.map((position) => [positionKey(position), random()]),
  )

  for (let pass = 0; pass < 2; pass += 1) {
    values = new Map(
      positions.map((position) => {
        const samples = [
          values.get(positionKey(position)) ?? 0.5,
          ...getHexNeighbors(position, boardSize).map(
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

const MAP_TYPE_PROFILES: Record<
  MapType,
  { elevationScale: number; elevationOffset: number; moistureOffset: number }
> = {
  balanced: { elevationScale: 1, elevationOffset: 0, moistureOffset: 0 },
  plains: { elevationScale: 0.65, elevationOffset: 0, moistureOffset: -0.12 },
  mountainous: { elevationScale: 1, elevationOffset: 0.1, moistureOffset: -0.05 },
  forested: { elevationScale: 0.9, elevationOffset: 0, moistureOffset: 0.14 },
}

function clampNoise(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function terrainFromNoise(
  elevation: number,
  moisture: number,
  temperature: number,
  mapType: MapType,
): Terrain {
  const profile = MAP_TYPE_PROFILES[mapType]
  const adjustedElevation = clampNoise(
    0.5 + (elevation - 0.5) * profile.elevationScale + profile.elevationOffset,
  )
  const adjustedMoisture = clampNoise(moisture + profile.moistureOffset)

  if (temperature < 0.43) {
    return adjustedMoisture > 0.52 ? 'tundraForest' : 'tundra'
  }
  if (adjustedElevation < 0.34) return 'water'
  if (adjustedElevation > 0.68) return 'mountain'
  if (adjustedElevation > 0.59) return 'hill'
  if (adjustedMoisture > 0.61) return 'forest'
  if (adjustedMoisture < 0.4 && temperature > 0.58) return 'desert'
  return 'plain'
}

function temperatureAt(
  position: Position,
  boardSize: BoardSize,
  coldEdge: 'top' | 'bottom' | 'none',
  temperateTemperature: number,
  edgeTemperatures: readonly number[],
  climateOffset: number,
): number {
  const row = position.r + Math.floor(boardSize.rows / 2)
  const rowProgress = boardSize.rows <= 1 ? 0.5 : row / (boardSize.rows - 1)

  if (coldEdge === 'none') {
    return clampNoise(temperateTemperature)
  }

  const distanceFromColdEdge = coldEdge === 'top' ? rowProgress : 1 - rowProgress
  const column =
    position.q + Math.floor(boardSize.columns / 2) + Math.floor(position.r / 2)
  const edgeTemperature = edgeTemperatures[column] ?? 0.42

  return clampNoise(
    edgeTemperature + distanceFromColdEdge * 0.36 + climateOffset,
  )
}

function createColdEdgeTemperatures(
  boardSize: BoardSize,
  random: () => number,
): number[] {
  const primaryPhase = random() * Math.PI * 2
  const secondaryPhase = random() * Math.PI * 2
  const raw = Array.from({ length: boardSize.columns }, (_, column) => {
    const progress = boardSize.columns <= 1 ? 0.5 : column / (boardSize.columns - 1)
    return (
      Math.sin(progress * Math.PI * 2 + primaryPhase) * 0.05 +
      Math.sin(progress * Math.PI * 4 + secondaryPhase) * 0.02
    )
  })
  const minimum = Math.min(...raw)
  const maximum = Math.max(...raw)
  const range = maximum - minimum || 1

  return raw.map((value) => 0.35 + ((value - minimum) / range) * 0.14)
}

function opposite(position: Position, boardSize: BoardSize): Position {
  return getOppositeBoardPosition(position, boardSize)
}

function getFactionIds(factionCount: FactionCount): FactionId[] {
  return (['f1', 'f2', 'f3', 'f4'] as const).slice(0, factionCount)
}

function getCapitalDistance(boardSize: BoardSize): number {
  return Math.max(
    6,
    Math.round(
      (STANDARD_CAPITAL_DISTANCE * boardSize.columns) /
        STANDARD_CAPITAL_DISTANCE_REFERENCE_COLUMNS,
    ),
  )
}

function chooseCapitals(
  random: () => number,
  boardSize: BoardSize,
  factionCount: FactionCount,
): Record<FactionId, Position> | undefined {
  const distance = getCapitalDistance(boardSize)
  const candidates = getAllHexPositions(boardSize).filter(
    (position) => getHexDistance(position, { q: 0, r: 0 }) === distance,
  )
  const factionIds = getFactionIds(factionCount)

  if (factionCount === 2) {
    const uniqueCandidates = candidates.filter(
      (position) =>
        positionKey(position) < positionKey(opposite(position, boardSize)),
    )
    const selected = uniqueCandidates[Math.floor(random() * uniqueCandidates.length)]
    if (!selected) return undefined
    const first = random() < 0.5 ? selected : opposite(selected, boardSize)
    return { f1: first, f2: opposite(first, boardSize) } as Record<
      FactionId,
      Position
    >
  }

  const minimumDistance = Math.max(7, Math.floor(distance * 0.9))
  const selected: Position[] = []
  for (const candidate of shuffled(candidates, random)) {
    if (selected.every((existing) => getHexDistance(existing, candidate) >= minimumDistance)) {
      selected.push(candidate)
      if (selected.length === factionCount) break
    }
  }
  if (selected.length !== factionCount) return undefined
  return Object.fromEntries(
    factionIds.map((factionId, index) => [factionId, selected[index]]),
  ) as Record<FactionId, Position>
}

function getPassableKeys(tiles: Tile[]): Set<string> {
  return new Set(
    tiles
      .filter((tile) => TERRAIN_COST[tile.terrain] !== null)
      .map((tile) => positionKey(tile.position)),
  )
}

function getConnectedKeys(
  tiles: Tile[],
  start: Position,
  boardSize: BoardSize,
): Set<string> {
  const passable = getPassableKeys(tiles)
  const connected = new Set<string>()
  const frontier = [start]
  let frontierIndex = 0

  while (frontierIndex < frontier.length) {
    const current = frontier[frontierIndex]
    frontierIndex += 1
    const key = positionKey(current)
    if (connected.has(key) || !passable.has(key)) continue
    connected.add(key)
    frontier.push(...getHexNeighbors(current, boardSize))
  }

  return connected
}

function chooseNeutralSites(
  tiles: Tile[],
  capitals: Record<FactionId, Position>,
  random: () => number,
  boardSize: BoardSize,
  factionCount: FactionCount,
): Site[] | undefined {
  const factionIds = getFactionIds(factionCount)
  const connected = getConnectedKeys(tiles, capitals[factionIds[0]], boardSize)
  const tilesByPosition = new Map(
    tiles.map((tile) => [positionKey(tile.position), tile]),
  )
  const chosen: Position[] = factionIds.map((factionId) => capitals[factionId])
  const sites: Array<{ kind: SiteType; position: Position }> = []
  const candidates = shuffled(
    tiles
      .map((tile) => tile.position)
      .filter((position) => {
        return (
          connected.has(positionKey(position)) &&
          getHexDistance(position, { q: 0, r: 0 }) >= 2
        )
      }),
    random,
  )

  for (let index = 0; index < factionCount * SITE_PAIR_TYPES.length; index += 1) {
    const kind = SITE_PAIR_TYPES[index % SITE_PAIR_TYPES.length]
    const position = candidates.find((candidate) => {
      const tile = tilesByPosition.get(positionKey(candidate))
      return (
        (kind !== 'farm' || tile?.terrain === 'plain') &&
        chosen.every((existing) => getHexDistance(candidate, existing) >= 3)
      )
    })

    if (!position) return undefined
    chosen.push(position)
    sites.push({ kind, position })
  }

  return sites.map(({ kind, position }, index) => ({
    id: `site-${kind}-${index + 1}`,
    name: `${kind === 'village' ? '중립 마을' : kind === 'farm' ? '중립 농장' : '중립 광산'} ${Math.floor(index / SITE_PAIR_TYPES.length) + 1}`,
    kind,
    position: { ...position },
    ownerId: 'neutral',
  }))
}

function getWeightedCosts(
  tiles: Tile[],
  start: Position,
  boardSize: BoardSize,
): Map<string, number> {
  const tileByKey = new Map(tiles.map((tile) => [positionKey(tile.position), tile]))
  const costs = new Map<string, number>([[positionKey(start), 0]])
  const frontier = new MinPriorityQueue<{ position: Position; cost: number }>(
    (left, right) =>
      left.cost - right.cost ||
      left.position.r - right.position.r ||
      left.position.q - right.position.q,
  )
  frontier.push({ position: start, cost: 0 })

  while (frontier.size > 0) {
    const current = frontier.pop()!
    const currentKey = positionKey(current.position)
    if (current.cost !== costs.get(currentKey)) continue

    for (const neighbor of getHexNeighbors(current.position, boardSize)) {
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
  const factionIds = state.factionOrder
  if (state.tiles.length !== getAllHexPositions(state.boardSize).length) issues.push('tileCount')
  if (state.sites.length !== state.factionCount * (SITE_PAIR_TYPES.length + 1)) {
    issues.push('siteCount')
  }

  const tileKeys = state.tiles.map((tile) => positionKey(tile.position))
  const siteKeys = state.sites.map((site) => positionKey(site.position))
  const tilesByPosition = new Map(
    state.tiles.map((tile) => [positionKey(tile.position), tile]),
  )
  if (new Set(tileKeys).size !== tileKeys.length) issues.push('duplicateTiles')
  if (new Set(siteKeys).size !== siteKeys.length) issues.push('duplicateSites')
  if (
    state.sites.some(
      (site) =>
        site.kind === 'farm' &&
        tilesByPosition.get(positionKey(site.position))?.terrain !== 'plain',
    )
  ) {
    issues.push('farmTerrain')
  }

  const capitals = Object.fromEntries(
    state.sites
      .filter((site) => site.capitalFor)
      .map((site) => [site.capitalFor!, site.position]),
  ) as Partial<Record<FactionId, Position>>

  if (factionIds.some((factionId) => !capitals[factionId])) {
    return [...issues, 'capitals']
  }

  const connected = getConnectedKeys(
    state.tiles,
    capitals[factionIds[0]]!,
    state.boardSize,
  )
  if (
    factionIds.some(
      (factionId) => !connected.has(positionKey(capitals[factionId]!)),
    ) ||
    state.sites.some((site) => !connected.has(positionKey(site.position)))
  ) {
    issues.push('connectivity')
  }

  const localCounts = factionIds.map((factionId) =>
    state.tiles.filter(
      (tile) =>
        TERRAIN_COST[tile.terrain] !== null &&
        getHexDistance(tile.position, capitals[factionId]!) <= 2,
    ).length,
  )
  if (localCounts.some((count) => count < 10)) issues.push('startingArea')
  if (Math.max(...localCounts) - Math.min(...localCounts) > 2) issues.push('localBalance')

  for (let left = 0; left < state.sites.length; left += 1) {
    for (let right = left + 1; right < state.sites.length; right += 1) {
      if (getHexDistance(state.sites[left].position, state.sites[right].position) < 3) {
        issues.push('siteSpacing')
        left = state.sites.length
        break
      }
    }
  }

  if (state.factionCount === 2) {
    const neutralKeys = state.sites
      .filter((site) => site.ownerId === 'neutral')
      .map((site) => positionKey(site.position))
    const nearestCosts = factionIds.map((factionId) => {
      const costs = getWeightedCosts(
        state.tiles,
        capitals[factionId]!,
        state.boardSize,
      )
      return Math.min(...neutralKeys.map((key) => costs.get(key) ?? Infinity))
    })
    if (Math.max(...nearestCosts) - Math.min(...nearestCosts) > 4) {
      issues.push('costBalance')
    }
  }

  return [...new Set(issues)]
}

function createSites(
  capitals: Record<FactionId, Position>,
  neutrals: Site[],
  factionCount: FactionCount,
): Site[] {
  const names: Partial<Record<FactionId, string>> = {
    f1: '청색 성채',
    f2: '적색 요새',
    f3: '황금 성채',
    f4: '자색 성채',
  }
  return [
    ...getFactionIds(factionCount).map((factionId) => ({
      id: `site-${factionId}-stronghold`,
      name: names[factionId] ?? factionId,
      kind: 'stronghold' as const,
      position: { ...capitals[factionId] },
      ownerId: factionId,
      capitalFor: factionId,
    })),
    ...neutrals,
  ]
}

function createUnits(
  capitals: Record<FactionId, Position>,
  tiles: Tile[],
  boardSize: BoardSize,
  factionCount: FactionCount,
): Unit[] {
  const passable = getPassableKeys(tiles)
  const names: Partial<Record<FactionId, readonly string[]>> = {
    f1: ['청룡 보병대', '백호 보병대', '바람 기병대'],
    f2: ['적월 보병대', '철창 보병대', '흑염 기병대'],
    f3: ['금빛 보병대', '사자 보병대', '태양 기병대'],
    f4: ['보랏빛 보병대', '까마귀 보병대', '황혼 기병대'],
  }

  return getFactionIds(factionCount).flatMap((factionId) => {
    const positions = getHexNeighbors(capitals[factionId], boardSize)
      .filter((position) => passable.has(positionKey(position)))
      .sort((left, right) => left.r - right.r || left.q - right.q)
      .slice(0, STARTING_UNIT_TYPES.length)
    if (positions.length !== STARTING_UNIT_TYPES.length) return []
    return STARTING_UNIT_TYPES.map((type, index) => ({
      id: `${factionId}-${type}-${index + 1}`,
      name: names[factionId]?.[index] ?? `${factionId} 부대 ${index + 1}`,
      factionId,
      type,
      position: { ...positions[index] },
      hp: UNIT_MAX_HP,
      maxHp: UNIT_MAX_HP,
      movementRemaining: UNIT_STATS[type].movement,
      hasActed: false,
    }))
  })
}

function assignForestTerrainVariants(
  tiles: Tile[],
  seed: string,
  boardSize: BoardSize,
) {
  const forestByKey = new Map(
    tiles
      .filter((tile) => tile.terrain === 'forest')
      .map((tile) => [positionKey(tile.position), tile]),
  )
  const visited = new Set<string>()

  for (const start of forestByKey.values()) {
    const startKey = positionKey(start.position)
    if (visited.has(startKey)) continue

    const component: Tile[] = []
    const queue = [start]
    let queueIndex = 0
    visited.add(startKey)

    while (queueIndex < queue.length) {
      const tile = queue[queueIndex]
      queueIndex += 1
      component.push(tile)

      for (const neighbor of getHexNeighbors(tile.position, boardSize)) {
        const neighborKey = positionKey(neighbor)
        if (visited.has(neighborKey)) continue
        const forestNeighbor = forestByKey.get(neighborKey)
        if (!forestNeighbor) continue
        visited.add(neighborKey)
        queue.push(forestNeighbor)
      }
    }

    const representative = component.reduce((best, tile) => {
      if (
        tile.position.q < best.position.q ||
        (tile.position.q === best.position.q &&
          tile.position.r < best.position.r)
      ) {
        return tile
      }
      return best
    })
    const variant =
      hashSeed(
        `${seed}:forest-variant:${representative.position.q},${representative.position.r}`,
      ) % FOREST_TERRAIN_VARIANT_COUNT

    for (const tile of component) {
      tile.terrainVariant = variant
    }
  }
}

export type MapGenerationOptions = {
  boardSize?: BoardSize
  factionCount?: FactionCount
  humanFactionId?: FactionId
  mapType?: MapType
}

function toLegacyTwoFactionState(state: GameState): GameState {
  const remap = (factionId: FactionId) =>
    factionId === 'f1' ? 'player' : factionId === 'f2' ? 'enemy' : factionId
  return {
    ...state,
    humanFactionId: 'player',
    factionOrder: ['player', 'enemy'],
    activeFactionId: 'player',
    resources: {
      ...state.resources,
      player: state.resources.f1,
      enemy: state.resources.f2,
    },
    units: state.units.map((unit) => ({
      ...unit,
      factionId: remap(unit.factionId),
    })),
    sites: state.sites.map((site) => ({
      ...site,
      ownerId: site.ownerId === 'neutral' ? 'neutral' : remap(site.ownerId),
      capitalFor: site.capitalFor ? remap(site.capitalFor) : undefined,
    })),
  }
}

function buildCandidate(
  seed: string,
  attempt: number,
  boardSize: BoardSize,
  factionCount: FactionCount,
  humanFactionId: FactionId,
  mapType: MapType,
  fallback = false,
): GameState | undefined {
  const random = createRandom(
    hashSeed(
      `${seed}:${MAP_GENERATION_VERSION}:${boardSize.columns}x${boardSize.rows}:n${factionCount}:${attempt}`,
    ),
  )
  const positions = getAllHexPositions(boardSize)
  const elevation = createClusteredValues(positions, random, boardSize)
  const moisture = createClusteredValues(positions, random, boardSize)
  const climateRoll = random()
  const coldEdge =
    climateRoll < 0.4 ? 'none' : climateRoll < 0.7 ? 'top' : 'bottom'
  const temperateTemperature = 0.55 + random() * 0.14
  const edgeTemperatures = createColdEdgeTemperatures(boardSize, random)
  const climateOffset = (random() - 0.5) * 0.04
  const capitals = chooseCapitals(random, boardSize, factionCount)
  if (!capitals) return undefined
  const tiles: Tile[] = positions.map((position) => ({
    id: `tile-${position.q}-${position.r}`,
    position: { ...position },
    terrain: fallback
      ? 'plain'
      : terrainFromNoise(
          elevation.get(positionKey(position)) ?? 0.5,
          moisture.get(positionKey(position)) ?? 0.5,
          temperatureAt(
            position,
            boardSize,
            coldEdge,
            temperateTemperature,
            edgeTemperatures,
            climateOffset,
          ),
          mapType,
        ),
  }))

  for (const factionId of getFactionIds(factionCount)) {
    const localTiles = tiles.filter(
      (tile) => getHexDistance(tile.position, capitals[factionId]) <= 2,
    )
    for (const tile of localTiles) {
      if (tile.terrain === 'water') tile.terrain = 'plain'
      if (tile.terrain === 'mountain') tile.terrain = 'hill'
      if (tile.terrain === 'desert') tile.terrain = 'plain'
    }
  }

  assignForestTerrainVariants(tiles, seed, boardSize)

  const neutralSites = chooseNeutralSites(
    tiles,
    capitals,
    random,
    boardSize,
    factionCount,
  )
  if (!neutralSites) return undefined
  const sites = createSites(capitals, neutralSites, factionCount)
  const siteIdsByPosition = new Map(
    sites.map((site) => [positionKey(site.position), site.id]),
  )
  for (const tile of tiles) {
    tile.siteId = siteIdsByPosition.get(positionKey(tile.position))
  }

  const state: GameState = {
    schemaVersion: GAME_SCHEMA_VERSION,
    mapSeed: seed,
    mapType,
    mapGenerationVersion: MAP_GENERATION_VERSION,
    boardSize: { ...boardSize },
    factionCount,
    humanFactionId,
    factionOrder: getFactionIds(factionCount),
    turn: 1,
    phase: 'playing',
    activeFactionId: getFactionIds(factionCount)[0],
    resources: {
      f1: factionCount >= 1 ? STARTING_RESOURCES : 0,
      f2: factionCount >= 2 ? STARTING_RESOURCES : 0,
      f3: factionCount >= 3 ? STARTING_RESOURCES : 0,
      f4: factionCount >= 4 ? STARTING_RESOURCES : 0,
      player: 0,
      enemy: 0,
    },
    tiles,
    units: createUnits(capitals, tiles, boardSize, factionCount),
    sites,
  }

  return validateGeneratedMap(state).length === 0 ? state : undefined
}

export function generateGameState(
  seed: string,
  options: MapGenerationOptions = {},
): GameState {
  const normalized = normalizeMapSeed(seed)
  if (!normalized) throw new Error('Seed must contain between 1 and 64 characters.')
  const useLegacyIds = Object.keys(options).length === 0
  const boardSize = options.boardSize ?? DEFAULT_BOARD_SIZE
  const requestedFactionCount = options.factionCount ?? 2
  const mapType = options.mapType ?? DEFAULT_MAP_TYPE
  const isTinyBoard =
    boardSize.columns === BOARD_SIZE_PRESETS.tiny.columns &&
    boardSize.rows === BOARD_SIZE_PRESETS.tiny.rows
  const factionCount: FactionCount = isTinyBoard ? 2 : requestedFactionCount
  const humanFactionId = options.humanFactionId ?? 'f1'
  if (!getFactionIds(factionCount).includes(humanFactionId)) {
    throw new Error('Human faction must be active.')
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const state = buildCandidate(
      normalized,
      attempt,
      boardSize,
      factionCount,
      humanFactionId,
      mapType,
    )
    if (state) return useLegacyIds ? toLegacyTwoFactionState(state) : state
  }

  const fallback = buildCandidate(
    normalized,
    MAX_GENERATION_ATTEMPTS,
    boardSize,
    factionCount,
    humanFactionId,
    mapType,
    true,
  )
  if (!fallback) throw new Error('Unable to generate a valid map.')
  return useLegacyIds ? toLegacyTwoFactionState(fallback) : fallback
}
