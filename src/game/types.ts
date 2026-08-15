export type Terrain =
  | 'plain'
  | 'mountain'
  | 'water'
  | 'hill'
  | 'forest'

export const GAME_SCHEMA_VERSION = 6
export const MAP_GENERATION_VERSION = 4
export const FOREST_TERRAIN_VARIANT_COUNT = 2

export type Position = {
  q: number
  r: number
}

export type FactionId = 'player' | 'enemy'
export type SiteOwnerId = FactionId | 'neutral'
export type SiteType = 'stronghold' | 'city' | 'village' | 'mine'
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
  mapGenerationVersion: number
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
  | { type: 'gameRestarted'; seed: string }
