export type Terrain = 'plain' | 'mountain' | 'water'

export type Position = {
  x: number
  y: number
}

export type FactionId = 'player' | 'enemy'
export type UnitType = 'infantry' | 'cavalry'

export type Tile = {
  id: string
  position: Position
  terrain: Terrain
  cityId?: string
}

export type Unit = {
  id: string
  name: string
  factionId: FactionId
  type: UnitType
  position: Position
  hp: number
  maxHp: number
  hasActed: boolean
}

export type City = {
  id: string
  name: string
  position: Position
  ownerId: FactionId
  resourcePerTurn: number
}

export type GameState = {
  schemaVersion: number
  turn: number
  activeFactionId: FactionId
  selectedUnitId?: string
  resources: Record<FactionId, number>
  tiles: Tile[]
  units: Unit[]
  cities: City[]
}

export type GameAction =
  | { type: 'unitSelected'; unitId: string }
  | { type: 'selectionCleared' }
  | { type: 'unitMoved'; unitId: string; destination: Position }
  | { type: 'turnEnded' }

