import { BOARD_SIZE, positionKey, UNIT_STATS } from './rules'
import type { City, GameState, Position, Terrain, Unit } from './types'

const WATER_POSITIONS = new Set(
  Array.from({ length: BOARD_SIZE }, (_, y) => ({ x: 4, y }))
    .filter(({ y }) => y !== 3 && y !== 6)
    .map(positionKey),
)

const MOUNTAIN_POSITIONS = new Set(
  [
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 5, y: 2 },
    { x: 5, y: 7 },
    { x: 6, y: 6 },
    { x: 7, y: 6 },
  ].map(positionKey),
)

const CITY_DATA: City[] = [
  {
    id: 'city-player',
    name: '푸른 성채',
    position: { x: 1, y: 8 },
    ownerId: 'player',
    resourcePerTurn: 5,
  },
  {
    id: 'city-enemy',
    name: '붉은 요새',
    position: { x: 8, y: 1 },
    ownerId: 'enemy',
    resourcePerTurn: 5,
  },
]

const UNIT_DATA: Array<Omit<Unit, 'movementRemaining'>> = [
  {
    id: 'player-infantry-1',
    name: '청룡 보병대',
    factionId: 'player',
    type: 'infantry',
    position: { x: 1, y: 7 },
    hp: 10,
    maxHp: 10,
    hasActed: false,
  },
  {
    id: 'player-infantry-2',
    name: '백호 보병대',
    factionId: 'player',
    type: 'infantry',
    position: { x: 2, y: 8 },
    hp: 10,
    maxHp: 10,
    hasActed: false,
  },
  {
    id: 'player-cavalry-1',
    name: '바람 기병대',
    factionId: 'player',
    type: 'cavalry',
    position: { x: 2, y: 7 },
    hp: 10,
    maxHp: 10,
    hasActed: false,
  },
  {
    id: 'enemy-infantry-1',
    name: '적월 보병대',
    factionId: 'enemy',
    type: 'infantry',
    position: { x: 8, y: 2 },
    hp: 10,
    maxHp: 10,
    hasActed: false,
  },
  {
    id: 'enemy-infantry-2',
    name: '흑창 보병대',
    factionId: 'enemy',
    type: 'infantry',
    position: { x: 7, y: 1 },
    hp: 10,
    maxHp: 10,
    hasActed: false,
  },
  {
    id: 'enemy-cavalry-1',
    name: '화염 기병대',
    factionId: 'enemy',
    type: 'cavalry',
    position: { x: 7, y: 2 },
    hp: 10,
    maxHp: 10,
    hasActed: false,
  },
]

function terrainAt(position: Position): Terrain {
  const key = positionKey(position)

  if (WATER_POSITIONS.has(key)) {
    return 'water'
  }

  if (MOUNTAIN_POSITIONS.has(key)) {
    return 'mountain'
  }

  return 'plain'
}

export function createInitialGameState(): GameState {
  const cities = CITY_DATA.map((city) => ({
    ...city,
    position: { ...city.position },
  }))
  const cityIdsByPosition = new Map(
    cities.map((city) => [positionKey(city.position), city.id]),
  )

  return {
    schemaVersion: 3,
    turn: 1,
    phase: 'playing',
    activeFactionId: 'player',
    resources: {
      player: 0,
      enemy: 0,
    },
    tiles: Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
      const position = {
        x: index % BOARD_SIZE,
        y: Math.floor(index / BOARD_SIZE),
      }

      return {
        id: `tile-${position.x}-${position.y}`,
        position,
        terrain: terrainAt(position),
        cityId: cityIdsByPosition.get(positionKey(position)),
      }
    }),
    units: UNIT_DATA.map((unit) => ({
      ...unit,
      position: { ...unit.position },
      movementRemaining: UNIT_STATS[unit.type].movement,
    })),
    cities,
  }
}
