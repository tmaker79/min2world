export type Terrain =
  | 'plain'
  | 'mountain'
  | 'water'
  | 'hill'
  | 'forest'
  | 'desert'
  | 'tundra'
  | 'tundraForest'

export type MapType = 'balanced' | 'plains' | 'mountainous' | 'forested'

export const GAME_SCHEMA_VERSION = 8
export const MAP_GENERATION_VERSION = 12
export const SUPPORTED_MAP_GENERATION_VERSIONS: readonly number[] = [
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  MAP_GENERATION_VERSION,
]
export const FOREST_TERRAIN_VARIANT_COUNT = 1

export type Position = {
  q: number
  r: number
}

/** Legacy IDs remain in the type temporarily so schema 6 fixtures can migrate. */
export type FactionId = 'f1' | 'f2' | 'f3' | 'f4' | 'player' | 'enemy'
export type FactionCount = 2 | 3 | 4
export type BoardSize = {
  columns: number
  rows: number
}
export type SiteOwnerId = FactionId | 'neutral'
export type SiteType = 'stronghold' | 'village' | 'farm' | 'mine' | 'city'
export type UnitType = 'infantry' | 'cavalry' | 'archer' | 'spearman'
export type GamePhase = 'playing' | 'victory' | 'defeat'

export type UnitStats = {
  movement: number
  melee: number
  ranged: number
  range: number
  cost: number
}

export type SiteStats = {
  income: number
  canProduce: boolean
}

export type Tile = {
  id: string
  position: Position
  terrain: Terrain
  /** Visual variant within a terrain type (e.g. forest tree style). */
  terrainVariant?: number
  siteId?: string
}

export type Unit = {
  id: string
  name: string
  factionId: FactionId
  type: UnitType
  position: Position
  hp: number
  maxHp: number
  movementRemaining: number
  hasActed: boolean
}

export type Site = {
  id: string
  name: string
  kind: SiteType
  position: Position
  ownerId: SiteOwnerId
  capitalFor?: FactionId
  lastProducedTurn?: number
}

export type GameState = {
  schemaVersion: number
  mapSeed: string
  mapType: MapType
  mapGenerationVersion: number
  boardSize: BoardSize
  factionCount: FactionCount
  humanFactionId: FactionId
  factionOrder: FactionId[]
  turn: number
  phase: GamePhase
  activeFactionId: FactionId
  selectedUnitId?: string
  resources: Record<FactionId, number>
  tiles: Tile[]
  units: Unit[]
  sites: Site[]
}

export type GameAction =
  | { type: 'unitSelected'; unitId: string }
  | { type: 'selectionCleared' }
  | { type: 'unitMoved'; unitId: string; destination: Position }
  | { type: 'unitAttacked'; attackerId: string; defenderId: string }
  | { type: 'unitWaited'; unitId: string }
  | {
      type: 'unitProduced'
      siteId: string
      unitType: UnitType
      destination: Position
    }
  | { type: 'turnEnded' }
  | { type: 'gameLoaded'; state: GameState }
  | {
      type: 'gameRestarted'
      seed: string
      boardSize?: BoardSize
      factionCount?: FactionCount
      humanFactionId?: FactionId
      mapType?: MapType
    }
