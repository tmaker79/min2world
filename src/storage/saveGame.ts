import { cloneGameState } from '../game/state'
import {
  BOARD_SIZE,
  getTileAt,
  positionKey,
  positionsEqual,
  TERRAIN_MOVEMENT_COST,
  UNIT_STATS,
} from '../game/rules'
import { GAME_SCHEMA_VERSION } from '../game/types'
import type {
  City,
  FactionId,
  GameState,
  Position,
  Terrain,
  Tile,
  Unit,
  UnitType,
} from '../game/types'

export const SAVE_STORAGE_KEY = 'min2world:save'

export type SavedGame = {
  schemaVersion: number
  savedAt: string
  gameState: GameState
}

export type StorageErrorCode =
  | 'notFound'
  | 'invalidData'
  | 'unsupportedVersion'
  | 'storageUnavailable'

export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: StorageErrorCode; message: string }

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const FACTIONS = new Set<FactionId>(['player', 'enemy'])
const TERRAINS = new Set<Terrain>(['plain', 'mountain', 'water'])
const UNIT_TYPES = new Set<UnitType>(['infantry', 'cavalry'])

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function failure(
  code: StorageErrorCode,
  message: string,
): StorageResult<never> {
  return { ok: false, code, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum = Infinity,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  )
}

function parsePosition(value: unknown): Position | undefined {
  if (
    !isRecord(value) ||
    !isIntegerInRange(value.x, 0, BOARD_SIZE - 1) ||
    !isIntegerInRange(value.y, 0, BOARD_SIZE - 1)
  ) {
    return undefined
  }

  return { x: value.x, y: value.y }
}

function parseTile(value: unknown): Tile | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.id)) {
    return undefined
  }

  const position = parsePosition(value.position)
  if (
    !position ||
    typeof value.terrain !== 'string' ||
    !TERRAINS.has(value.terrain as Terrain) ||
    (value.cityId !== undefined && !isNonEmptyString(value.cityId))
  ) {
    return undefined
  }

  return {
    id: value.id,
    position,
    terrain: value.terrain as Terrain,
    cityId: value.cityId as string | undefined,
  }
}

function parseUnit(value: unknown): Unit | undefined {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    typeof value.factionId !== 'string' ||
    !FACTIONS.has(value.factionId as FactionId) ||
    typeof value.type !== 'string' ||
    !UNIT_TYPES.has(value.type as UnitType) ||
    typeof value.hasActed !== 'boolean'
  ) {
    return undefined
  }

  const position = parsePosition(value.position)
  const type = value.type as UnitType
  if (
    !position ||
    !isIntegerInRange(value.maxHp, 1) ||
    !isIntegerInRange(value.hp, 1, value.maxHp) ||
    !isIntegerInRange(
      value.movementRemaining,
      0,
      UNIT_STATS[type].movement,
    ) ||
    (value.hasActed && value.movementRemaining !== 0)
  ) {
    return undefined
  }

  return {
    id: value.id,
    name: value.name,
    factionId: value.factionId as FactionId,
    type,
    position,
    hp: value.hp,
    maxHp: value.maxHp,
    movementRemaining: value.movementRemaining,
    hasActed: value.hasActed,
  }
}

function parseCity(value: unknown): City | undefined {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    typeof value.ownerId !== 'string' ||
    !FACTIONS.has(value.ownerId as FactionId) ||
    !isIntegerInRange(value.resourcePerTurn, 0)
  ) {
    return undefined
  }

  const position = parsePosition(value.position)
  if (!position) {
    return undefined
  }

  return {
    id: value.id,
    name: value.name,
    position,
    ownerId: value.ownerId as FactionId,
    resourcePerTurn: value.resourcePerTurn,
  }
}

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length
}

function parseGameState(value: unknown): StorageResult<GameState> {
  if (!isRecord(value)) {
    return failure('invalidData', '저장된 게임 상태 형식이 올바르지 않습니다.')
  }

  if (!isIntegerInRange(value.schemaVersion, 1)) {
    return failure('invalidData', '저장 데이터의 버전 정보가 없습니다.')
  }

  if (value.schemaVersion !== GAME_SCHEMA_VERSION) {
    return failure(
      'unsupportedVersion',
      '현재 버전에서 지원하지 않는 저장 데이터입니다.',
    )
  }

  if (
    !isIntegerInRange(value.turn, 1) ||
    value.phase !== 'playing' ||
    value.activeFactionId !== 'player' ||
    !isRecord(value.resources) ||
    !isIntegerInRange(value.resources.player, 0) ||
    !isIntegerInRange(value.resources.enemy, 0) ||
    !Array.isArray(value.tiles) ||
    !Array.isArray(value.units) ||
    !Array.isArray(value.cities)
  ) {
    return failure('invalidData', '저장된 게임 진행 정보가 올바르지 않습니다.')
  }

  const tiles = value.tiles.map(parseTile)
  const units = value.units.map(parseUnit)
  const cities = value.cities.map(parseCity)

  if (
    tiles.length !== BOARD_SIZE * BOARD_SIZE ||
    tiles.some((tile) => !tile) ||
    units.some((unit) => !unit) ||
    cities.length === 0 ||
    cities.some((city) => !city)
  ) {
    return failure('invalidData', '지도, 유닛 또는 도시 정보가 올바르지 않습니다.')
  }

  const parsedTiles = tiles as Tile[]
  const parsedUnits = units as Unit[]
  const parsedCities = cities as City[]

  if (
    !hasUniqueValues(parsedTiles.map((tile) => tile.id)) ||
    !hasUniqueValues(parsedTiles.map((tile) => positionKey(tile.position))) ||
    !hasUniqueValues(parsedUnits.map((unit) => unit.id)) ||
    !hasUniqueValues(parsedUnits.map((unit) => positionKey(unit.position))) ||
    !hasUniqueValues(parsedCities.map((city) => city.id)) ||
    !hasUniqueValues(parsedCities.map((city) => positionKey(city.position)))
  ) {
    return failure('invalidData', '중복된 ID 또는 지도 좌표가 있습니다.')
  }

  const state: GameState = {
    schemaVersion: GAME_SCHEMA_VERSION,
    turn: value.turn,
    phase: 'playing',
    activeFactionId: 'player',
    resources: {
      player: value.resources.player,
      enemy: value.resources.enemy,
    },
    tiles: parsedTiles,
    units: parsedUnits,
    cities: parsedCities,
  }

  const cityById = new Map(parsedCities.map((city) => [city.id, city]))
  const citiesMatchTiles = parsedTiles.every((tile) => {
    if (!tile.cityId) {
      return true
    }

    const city = cityById.get(tile.cityId)
    return Boolean(city && positionsEqual(city.position, tile.position))
  })
  const tilesMatchCities = parsedCities.every((city) => {
    const tile = getTileAt(state, city.position)
    return tile?.cityId === city.id
  })
  const unitsAreOnPassableTiles = parsedUnits.every((unit) => {
    const tile = getTileAt(state, unit.position)
    return Boolean(
      tile && TERRAIN_MOVEMENT_COST[tile.terrain] !== null,
    )
  })

  if (!citiesMatchTiles || !tilesMatchCities || !unitsAreOnPassableTiles) {
    return failure('invalidData', '지도 참조 관계가 올바르지 않습니다.')
  }

  return success(state)
}

function resolveStorage(storage?: StorageLike): StorageResult<StorageLike> {
  if (storage) {
    return success(storage)
  }

  try {
    return success(window.localStorage)
  } catch {
    return failure('storageUnavailable', '브라우저 저장소를 사용할 수 없습니다.')
  }
}

function readSavedGame(storage?: StorageLike): StorageResult<SavedGame> {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage.ok) {
    return resolvedStorage
  }

  let serialized: string | null
  try {
    serialized = resolvedStorage.value.getItem(SAVE_STORAGE_KEY)
  } catch {
    return failure('storageUnavailable', '저장 데이터를 읽을 수 없습니다.')
  }

  if (serialized === null) {
    return failure('notFound', '저장된 게임이 없습니다.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return failure('invalidData', '저장 데이터가 손상되었습니다.')
  }

  if (!isRecord(parsed)) {
    return failure('invalidData', '저장 데이터 형식이 올바르지 않습니다.')
  }

  if (!isIntegerInRange(parsed.schemaVersion, 1)) {
    return failure('invalidData', '저장 데이터의 버전 정보가 없습니다.')
  }

  if (parsed.schemaVersion !== GAME_SCHEMA_VERSION) {
    return failure(
      'unsupportedVersion',
      '현재 버전에서 지원하지 않는 저장 데이터입니다.',
    )
  }

  if (
    typeof parsed.savedAt !== 'string' ||
    Number.isNaN(Date.parse(parsed.savedAt))
  ) {
    return failure('invalidData', '저장 시각 정보가 올바르지 않습니다.')
  }

  const gameState = parseGameState(parsed.gameState)
  if (!gameState.ok) {
    return gameState
  }

  return success({
    schemaVersion: GAME_SCHEMA_VERSION,
    savedAt: parsed.savedAt,
    gameState: gameState.value,
  })
}

export function saveGame(
  state: GameState,
  storage?: StorageLike,
  now = new Date(),
): StorageResult<SavedGame> {
  if (
    state.schemaVersion !== GAME_SCHEMA_VERSION ||
    state.phase !== 'playing' ||
    state.activeFactionId !== 'player' ||
    Number.isNaN(now.getTime())
  ) {
    return failure('invalidData', '현재 게임은 저장할 수 없는 상태입니다.')
  }

  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage.ok) {
    return resolvedStorage
  }

  const savedGame: SavedGame = {
    schemaVersion: GAME_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    gameState: cloneGameState(state, true),
  }

  try {
    resolvedStorage.value.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(savedGame),
    )
  } catch {
    return failure('storageUnavailable', '게임을 저장할 수 없습니다.')
  }

  return success(savedGame)
}

export function loadGame(storage?: StorageLike): StorageResult<SavedGame> {
  return readSavedGame(storage)
}

export function inspectSavedGame(
  storage?: StorageLike,
): StorageResult<SavedGame> {
  return readSavedGame(storage)
}

export function deleteSavedGame(
  storage?: StorageLike,
): StorageResult<undefined> {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage.ok) {
    return resolvedStorage
  }

  try {
    resolvedStorage.value.removeItem(SAVE_STORAGE_KEY)
  } catch {
    return failure('storageUnavailable', '저장 데이터를 삭제할 수 없습니다.')
  }

  return success(undefined)
}
