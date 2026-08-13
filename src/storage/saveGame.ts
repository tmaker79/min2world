import { getAllHexPositions, HEX_TILE_COUNT, isPositionOnBoard, positionKey, positionsEqual } from '../game/hex'
import { cloneGameState } from '../game/state'
import { SITE_STATS, TERRAIN_MOVEMENT_COST, UNIT_STATS } from '../game/rules'
import { GAME_SCHEMA_VERSION, MAP_GENERATION_VERSION } from '../game/types'
import type {
  FactionId,
  GameState,
  Position,
  Site,
  SiteOwnerId,
  SiteType,
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
const SITE_OWNERS = new Set<SiteOwnerId>(['player', 'enemy', 'neutral'])
const TERRAINS = new Set<Terrain>([
  'plain', 'mountain', 'water', 'hill', 'road', 'forest', 'grassland', 'steppe',
])
const UNIT_TYPES = new Set<UnitType>(['infantry', 'cavalry', 'archer', 'spearman'])
const SITE_TYPES = new Set<SiteType>(['stronghold', 'city', 'village', 'mine'])

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function failure(code: StorageErrorCode, message: string): StorageResult<never> {
  return { ok: false, code, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown, maximum = Infinity): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum
}

function isIntegerInRange(value: unknown, minimum: number, maximum = Infinity): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

function parsePosition(value: unknown): Position | undefined {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.q) ||
    !Number.isInteger(value.r)
  ) {
    return undefined
  }
  const position = { q: value.q as number, r: value.r as number }
  return isPositionOnBoard(position) ? position : undefined
}

function parseTile(value: unknown): Tile | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return undefined
  const position = parsePosition(value.position)
  if (
    !position ||
    typeof value.terrain !== 'string' ||
    !TERRAINS.has(value.terrain as Terrain) ||
    (value.siteId !== undefined && !isNonEmptyString(value.siteId))
  ) {
    return undefined
  }
  return {
    id: value.id,
    position,
    terrain: value.terrain as Terrain,
    ...(value.siteId === undefined ? {} : { siteId: value.siteId as string }),
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
    typeof value.movementRemaining !== 'number' ||
    value.movementRemaining < 0 ||
    value.movementRemaining > UNIT_STATS[type].movement ||
    value.movementRemaining * 2 !== Math.round(value.movementRemaining * 2) ||
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

function parseSite(value: unknown): Site | undefined {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    typeof value.kind !== 'string' ||
    !SITE_TYPES.has(value.kind as SiteType) ||
    typeof value.ownerId !== 'string' ||
    !SITE_OWNERS.has(value.ownerId as SiteOwnerId) ||
    (value.capitalFor !== undefined &&
      (typeof value.capitalFor !== 'string' || !FACTIONS.has(value.capitalFor as FactionId))) ||
    (value.lastProducedTurn !== undefined && !isIntegerInRange(value.lastProducedTurn, 1))
  ) {
    return undefined
  }
  const position = parsePosition(value.position)
  const kind = value.kind as SiteType
  if (
    !position ||
    (value.capitalFor !== undefined && kind !== 'stronghold') ||
    (value.lastProducedTurn !== undefined && !SITE_STATS[kind].canProduce)
  ) {
    return undefined
  }
  return {
    id: value.id,
    name: value.name,
    kind,
    position,
    ownerId: value.ownerId as SiteOwnerId,
    ...(value.capitalFor === undefined ? {} : { capitalFor: value.capitalFor as FactionId }),
    ...(value.lastProducedTurn === undefined ? {} : { lastProducedTurn: value.lastProducedTurn as number }),
  }
}

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length
}

function parseGameState(value: unknown): StorageResult<GameState> {
  if (!isRecord(value)) return failure('invalidData', '저장된 게임 상태 형식이 올바르지 않습니다.')
  if (
    value.schemaVersion !== GAME_SCHEMA_VERSION ||
    !isNonEmptyString(value.mapSeed, 64) ||
    value.mapGenerationVersion !== MAP_GENERATION_VERSION ||
    !isIntegerInRange(value.turn, 1) ||
    value.phase !== 'playing' ||
    value.activeFactionId !== 'player' ||
    !isRecord(value.resources) ||
    !isIntegerInRange(value.resources.player, 0) ||
    !isIntegerInRange(value.resources.enemy, 0) ||
    !Array.isArray(value.tiles) ||
    !Array.isArray(value.units) ||
    !Array.isArray(value.sites)
  ) {
    return failure('invalidData', '저장된 게임 진행 정보가 올바르지 않습니다.')
  }

  const tiles = value.tiles.map(parseTile)
  const units = value.units.map(parseUnit)
  const sites = value.sites.map(parseSite)
  if (
    tiles.length !== HEX_TILE_COUNT ||
    tiles.some((tile) => !tile) ||
    units.some((unit) => !unit) ||
    sites.length !== 8 ||
    sites.some((site) => !site)
  ) {
    return failure('invalidData', '지도, 유닛 또는 거점 정보가 올바르지 않습니다.')
  }

  const parsedTiles = tiles as Tile[]
  const parsedUnits = units as Unit[]
  const parsedSites = sites as Site[]
  const expectedPositionKeys = new Set(getAllHexPositions().map(positionKey))
  if (
    !hasUniqueValues(parsedTiles.map((tile) => tile.id)) ||
    !hasUniqueValues(parsedTiles.map((tile) => positionKey(tile.position))) ||
    parsedTiles.some((tile) => !expectedPositionKeys.has(positionKey(tile.position))) ||
    !hasUniqueValues(parsedUnits.map((unit) => unit.id)) ||
    !hasUniqueValues(parsedUnits.map((unit) => positionKey(unit.position))) ||
    !hasUniqueValues(parsedSites.map((site) => site.id)) ||
    !hasUniqueValues(parsedSites.map((site) => positionKey(site.position)))
  ) {
    return failure('invalidData', '중복되거나 올바르지 않은 지도 좌표가 있습니다.')
  }

  const state: GameState = {
    schemaVersion: GAME_SCHEMA_VERSION,
    mapSeed: value.mapSeed.trim(),
    mapGenerationVersion: MAP_GENERATION_VERSION,
    turn: value.turn,
    phase: 'playing',
    activeFactionId: 'player',
    resources: { player: value.resources.player, enemy: value.resources.enemy },
    tiles: parsedTiles,
    units: parsedUnits,
    sites: parsedSites,
  }
  const siteById = new Map(parsedSites.map((site) => [site.id, site]))
  const tilesMatchSites = parsedTiles.every((tile) => {
    if (!tile.siteId) return true
    const site = siteById.get(tile.siteId)
    return Boolean(site && positionsEqual(site.position, tile.position))
  })
  const sitesMatchTiles = parsedSites.every((site) => {
    const tile = parsedTiles.find((candidate) => positionsEqual(candidate.position, site.position))
    return tile?.siteId === site.id
  })
  const unitsAreValid = parsedUnits.every((unit) => {
    const tile = parsedTiles.find((candidate) => positionsEqual(candidate.position, unit.position))
    return Boolean(tile && TERRAIN_MOVEMENT_COST[tile.terrain] !== null)
  })
  const productionTurnsAreValid = parsedSites.every(
    (site) => site.lastProducedTurn === undefined || site.lastProducedTurn <= state.turn,
  )
  const capitals = parsedSites.filter((site) => site.capitalFor)
  const capitalsAreValid =
    capitals.length === 2 &&
    capitals.some((site) => site.capitalFor === 'player') &&
    capitals.some((site) => site.capitalFor === 'enemy')

  if (!tilesMatchSites || !sitesMatchTiles || !unitsAreValid || !productionTurnsAreValid || !capitalsAreValid) {
    return failure('invalidData', '지도 참조 관계가 올바르지 않습니다.')
  }
  return success(state)
}

function resolveStorage(storage?: StorageLike): StorageResult<StorageLike> {
  if (storage) return success(storage)
  try {
    return success(window.localStorage)
  } catch {
    return failure('storageUnavailable', '브라우저 저장소를 사용할 수 없습니다.')
  }
}

function readSavedGame(storage?: StorageLike): StorageResult<SavedGame> {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage.ok) return resolvedStorage
  let serialized: string | null
  try {
    serialized = resolvedStorage.value.getItem(SAVE_STORAGE_KEY)
  } catch {
    return failure('storageUnavailable', '저장 데이터를 읽을 수 없습니다.')
  }
  if (serialized === null) return failure('notFound', '저장된 게임이 없습니다.')

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return failure('invalidData', '저장 데이터가 손상되었습니다.')
  }
  if (!isRecord(parsed) || !isIntegerInRange(parsed.schemaVersion, 1)) {
    return failure('invalidData', '저장 데이터 형식이 올바르지 않습니다.')
  }
  if (parsed.schemaVersion !== GAME_SCHEMA_VERSION) {
    return failure(
      'unsupportedVersion',
      parsed.schemaVersion === 4 || parsed.schemaVersion === 5
        ? '이전 사각 지도 저장은 지원되지 않습니다. 새 게임을 시작해 주세요.'
        : '현재 버전에서 지원하지 않는 저장 데이터입니다.',
    )
  }
  if (typeof parsed.savedAt !== 'string' || Number.isNaN(Date.parse(parsed.savedAt))) {
    return failure('invalidData', '저장 시각 정보가 올바르지 않습니다.')
  }
  const gameState = parseGameState(parsed.gameState)
  if (!gameState.ok) return gameState
  return success({ schemaVersion: GAME_SCHEMA_VERSION, savedAt: parsed.savedAt, gameState: gameState.value })
}

export function saveGame(
  state: GameState,
  storage?: StorageLike,
  now = new Date(),
): StorageResult<SavedGame> {
  if (
    state.schemaVersion !== GAME_SCHEMA_VERSION ||
    state.mapGenerationVersion !== MAP_GENERATION_VERSION ||
    state.phase !== 'playing' ||
    state.activeFactionId !== 'player' ||
    Number.isNaN(now.getTime())
  ) {
    return failure('invalidData', '현재 게임은 저장할 수 없는 상태입니다.')
  }
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage.ok) return resolvedStorage
  const savedGame: SavedGame = {
    schemaVersion: GAME_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    gameState: cloneGameState(state, true),
  }
  try {
    resolvedStorage.value.setItem(SAVE_STORAGE_KEY, JSON.stringify(savedGame))
  } catch {
    return failure('storageUnavailable', '게임을 저장할 수 없습니다.')
  }
  return success(savedGame)
}

export function loadGame(storage?: StorageLike): StorageResult<SavedGame> {
  return readSavedGame(storage)
}

export function inspectSavedGame(storage?: StorageLike): StorageResult<SavedGame> {
  return readSavedGame(storage)
}

export function deleteSavedGame(storage?: StorageLike): StorageResult<undefined> {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage.ok) return resolvedStorage
  try {
    resolvedStorage.value.removeItem(SAVE_STORAGE_KEY)
  } catch {
    return failure('storageUnavailable', '저장 데이터를 삭제할 수 없습니다.')
  }
  return success(undefined)
}
