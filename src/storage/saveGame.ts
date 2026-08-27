import {
  BOARD_SIZE_PRESETS,
  DEFAULT_BOARD_SIZE,
  getAllHexPositions,
  isPositionOnBoard,
  positionKey,
  positionsEqual,
} from '../game/hex'
import { cloneGameState } from '../game/state'
import {
  getSiteOccupiedPositions,
  isValidCityFootprint,
  isValidTownFootprint,
} from '../game/siteFootprint'
import {
  getSiteMaxHp,
  isFortifiedSiteKind,
  SITE_STATS,
  TERRAIN_MOVEMENT_COST,
  UNIT_STATS,
  UNIT_TYPES as UNIT_TYPE_LIST,
} from '../game/rules'
import {
  BUILDING_DEFINITIONS,
  BUILDING_IDS,
  WALL_MAX_HP_BONUS,
} from '../game/cityAdministration'
import {
  GAME_SCHEMA_VERSION,
  SUPPORTED_MAP_GENERATION_VERSIONS,
} from '../game/types'
import { migrateSaveRecord } from './saveMigrations'
import {
  failure,
  hasUniqueValues,
  isIntegerInRange,
  isNonEmptyString,
  isRecord,
  success,
} from './storageResult'
import type { StorageResult } from './storageResult'
import type {
  BoardSize,
  BuildingId,
  Difficulty,
  FactionCount,
  FactionId,
  GameMode,
  GameState,
  MapType,
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
export const QUICK_SAVE_STORAGE_KEY = 'min2world:quick:save'

export type SavedGame = {
  schemaVersion: number
  savedAt: string
  gameState: GameState
}

export type { StorageErrorCode, StorageResult } from './storageResult'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const ACTIVE_FACTIONS = ['f1', 'f2', 'f3', 'f4'] as const
const FACTIONS = new Set<FactionId>([
  ...ACTIVE_FACTIONS,
  'player',
  'enemy',
])
const SITE_OWNERS = new Set<SiteOwnerId>([
  ...ACTIVE_FACTIONS,
  'player',
  'enemy',
  'neutral',
])
const TERRAINS = new Set<Terrain>(
  Object.keys(TERRAIN_MOVEMENT_COST) as Terrain[],
)
const UNIT_TYPES = new Set<UnitType>(UNIT_TYPE_LIST)
const SITE_TYPES = new Set<SiteType>(Object.keys(SITE_STATS) as SiteType[])
const MAP_TYPES = new Set<MapType>(['balanced', 'plains', 'mountainous', 'forested'])
const DIFFICULTIES = new Set<Difficulty>(['easy', 'normal'])
const GAME_MODES = new Set<GameMode>(['quick', 'standard'])

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.has(value as Difficulty)
}
function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && GAME_MODES.has(value as GameMode)
}
const BUILDINGS = new Set<BuildingId>(BUILDING_IDS)

function parsePosition(value: unknown, boardSize = DEFAULT_BOARD_SIZE): Position | undefined {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.q) ||
    !Number.isInteger(value.r)
  ) {
    return undefined
  }
  const position = { q: value.q as number, r: value.r as number }
  return isPositionOnBoard(position, boardSize) ? position : undefined
}

function parseTile(value: unknown, boardSize: BoardSize): Tile | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return undefined
  const position = parsePosition(value.position, boardSize)
  if (
    !position ||
    typeof value.terrain !== 'string' ||
    !TERRAINS.has(value.terrain as Terrain) ||
    (value.siteId !== undefined && !isNonEmptyString(value.siteId)) ||
    (value.terrainVariant !== undefined &&
      !isIntegerInRange(value.terrainVariant, 0))
  ) {
    return undefined
  }
  return {
    id: value.id,
    position,
    terrain: value.terrain as Terrain,
    ...(value.terrainVariant === undefined
      ? {}
      : { terrainVariant: value.terrainVariant as number }),
    ...(value.siteId === undefined ? {} : { siteId: value.siteId as string }),
  }
}

function parseUnit(value: unknown, boardSize: BoardSize): Unit | undefined {
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

  const position = parsePosition(value.position, boardSize)
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

function parseSite(value: unknown, boardSize: BoardSize): Site | undefined {
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
    (value.foundedBy !== undefined &&
      (typeof value.foundedBy !== 'string' || !FACTIONS.has(value.foundedBy as FactionId))) ||
    (value.lastProducedTurn !== undefined && !isIntegerInRange(value.lastProducedTurn, 1)) ||
    (value.lastDevelopedTurn !== undefined && !isIntegerInRange(value.lastDevelopedTurn, 1))
  ) {
    return undefined
  }
  const position = parsePosition(value.position, boardSize)
  const kind = value.kind as SiteType
  const buildings = Array.isArray(value.buildings) &&
    value.buildings.every(
      (buildingId) =>
        typeof buildingId === 'string' &&
        BUILDINGS.has(buildingId as BuildingId),
    ) &&
    hasUniqueValues(value.buildings as string[])
      ? (value.buildings as BuildingId[])
      : undefined
  const queue = value.constructionQueue
  const constructionQueue = queue === undefined
    ? undefined
    : isRecord(queue) &&
        typeof queue.buildingId === 'string' &&
        BUILDINGS.has(queue.buildingId as BuildingId) &&
        isIntegerInRange(
          queue.turnsRemaining,
          1,
          BUILDING_DEFINITIONS[queue.buildingId as BuildingId].turns,
        ) &&
        isIntegerInRange(queue.startedTurn, 1)
      ? {
          buildingId: queue.buildingId as BuildingId,
          turnsRemaining: queue.turnsRemaining as number,
          startedTurn: queue.startedTurn as number,
        }
      : null
  const requiresLevel = kind === 'farm' || kind === 'mine' || kind === 'blacksmith'
  const fortified = isFortifiedSiteKind(kind)
  const expectedMaxHp = getSiteMaxHp(kind)! +
    (buildings?.includes('wall') ? WALL_MAX_HP_BONUS : 0)
  const footprint = Array.isArray(value.footprint)
    ? value.footprint.map((candidate) => parsePosition(candidate, boardSize))
    : undefined
  if (
    !position ||
    !buildings ||
    constructionQueue === null ||
    (kind !== 'city' &&
      (buildings.length > 0 || constructionQueue !== undefined)) ||
    (constructionQueue !== undefined &&
      buildings.includes(constructionQueue.buildingId)) ||
    (value.capitalFor !== undefined &&
      kind !== 'stronghold' &&
      kind !== 'city') ||
    (requiresLevel
      ? !isIntegerInRange(value.level, 1, 3)
      : value.level !== undefined) ||
    (kind === 'town' &&
      (!footprint ||
        footprint.some((candidate) => !candidate) ||
        !isValidTownFootprint(
          position,
          footprint as Position[],
          boardSize,
        ))) ||
    (kind === 'city' &&
      (!footprint ||
        footprint.some((candidate) => !candidate) ||
        !isValidCityFootprint(
          position,
          footprint as Position[],
          boardSize,
        ))) ||
    (kind !== 'town' && kind !== 'city' && value.footprint !== undefined) ||
    (fortified
      ? value.maxHp !== expectedMaxHp ||
        !isIntegerInRange(value.hp, 1, expectedMaxHp)
      : value.hp !== undefined || value.maxHp !== undefined)
  ) {
    return undefined
  }
  return {
    id: value.id,
    name: value.name,
    kind,
    position,
    ...(footprint === undefined
      ? {}
      : { footprint: footprint as Position[] }),
    ownerId: value.ownerId as SiteOwnerId,
    ...(value.foundedBy === undefined
      ? {}
      : { foundedBy: value.foundedBy as FactionId }),
    buildings,
    ...(constructionQueue === undefined ? {} : { constructionQueue }),
    ...(fortified
      ? { hp: value.hp as number, maxHp: value.maxHp as number }
      : {}),
    ...(requiresLevel ? { level: value.level as 1 | 2 | 3 } : {}),
    ...(value.capitalFor === undefined ? {} : { capitalFor: value.capitalFor as FactionId }),
    ...(value.lastProducedTurn === undefined || !SITE_STATS[kind].canProduce
      ? {}
      : { lastProducedTurn: value.lastProducedTurn as number }),
    ...(value.lastDevelopedTurn === undefined
      ? {}
      : { lastDevelopedTurn: value.lastDevelopedTurn as number }),
  }
}

function parseBoardSize(value: unknown): BoardSize | undefined {
  if (
    !isRecord(value) ||
    !isIntegerInRange(value.columns, 1) ||
    !isIntegerInRange(value.rows, 1)
  ) {
    return undefined
  }
  const boardSize = { columns: value.columns, rows: value.rows }
  const allowedSizes = [
    ...Object.values(BOARD_SIZE_PRESETS),
    // Previous two-player preset; keep schema 8 saves loadable.
    { columns: 15, rows: 10 },
    // Previous small preset; keep schema 8 saves loadable.
    { columns: 21, rows: 14 },
    // Previous standard and large presets; keep schema 8 saves loadable.
    { columns: 42, rows: 28 },
    { columns: 84, rows: 56 },
    // Legacy presets from earlier schema 7 builds.
    { columns: 18, rows: 12 },
    { columns: 24, rows: 16 },
    { columns: 48, rows: 32 },
    { columns: 96, rows: 64 },
  ]
  return allowedSizes.some(
    (preset) =>
      preset.columns === boardSize.columns && preset.rows === boardSize.rows,
  )
    ? boardSize
    : undefined
}

function isFactionCount(value: unknown): value is FactionCount {
  return value === 2 || value === 3 || value === 4
}

function parseGameState(value: unknown): StorageResult<GameState> {
  if (!isRecord(value)) return failure('invalidData', '저장된 게임 상태 형식이 올바르지 않습니다.')
  const boardSize = parseBoardSize(value.boardSize)
  const factionCount = value.factionCount
  const factionOrder = value.factionOrder
  const mapType = value.mapType ?? 'balanced'
  const difficulty = value.difficulty ?? 'easy'
  const gameMode = value.gameMode
  if (
    value.schemaVersion !== GAME_SCHEMA_VERSION ||
    !isNonEmptyString(value.mapSeed, 64) ||
    typeof mapType !== 'string' ||
    !MAP_TYPES.has(mapType as MapType) ||
    !isDifficulty(difficulty) ||
    !isGameMode(gameMode) ||
    typeof value.mapGenerationVersion !== 'number' ||
    !SUPPORTED_MAP_GENERATION_VERSIONS.includes(value.mapGenerationVersion) ||
    !isIntegerInRange(value.turn, 1) ||
    value.phase !== 'playing' ||
    !boardSize ||
    !isFactionCount(factionCount) ||
    typeof value.humanFactionId !== 'string' ||
    !FACTIONS.has(value.humanFactionId as FactionId) ||
    !Array.isArray(factionOrder) ||
    factionOrder.length !== factionCount ||
    factionOrder.some(
      (factionId) =>
        typeof factionId !== 'string' || !FACTIONS.has(factionId as FactionId),
    ) ||
    typeof value.activeFactionId !== 'string' ||
    !FACTIONS.has(value.activeFactionId as FactionId) ||
    !factionOrder.includes(value.activeFactionId) ||
    !isRecord(value.resources) ||
    (factionOrder as string[]).some(
      (factionId) =>
        !isIntegerInRange(
          (value.resources as Record<string, unknown>)[factionId],
          0,
        ),
    ) ||
    !Array.isArray(value.tiles) ||
    !Array.isArray(value.units) ||
    !Array.isArray(value.sites)
  ) {
    return failure('invalidData', '저장된 게임 진행 정보가 올바르지 않습니다.')
  }

  const tiles = value.tiles.map((tile) => parseTile(tile, boardSize))
  const units = value.units.map((unit) => parseUnit(unit, boardSize))
  const sites = value.sites.map((site) => parseSite(site, boardSize))
  if (
    tiles.length !== boardSize.columns * boardSize.rows ||
    tiles.some((tile) => !tile) ||
    units.some((unit) => !unit) ||
    sites.some((site) => !site)
  ) {
    return failure('invalidData', '지도, 유닛 또는 거점 정보가 올바르지 않습니다.')
  }

  const parsedTiles = tiles as Tile[]
  const parsedUnits = units as Unit[]
  const parsedSites = sites as Site[]
  const occupiedSiteEntries = parsedSites.flatMap((site) =>
    getSiteOccupiedPositions(site).map((position) => ({
      key: positionKey(position),
      site,
    })),
  )
  const expectedPositionKeys = new Set(getAllHexPositions(boardSize).map(positionKey))
  if (
    !hasUniqueValues(parsedTiles.map((tile) => tile.id)) ||
    !hasUniqueValues(parsedTiles.map((tile) => positionKey(tile.position))) ||
    parsedTiles.some((tile) => !expectedPositionKeys.has(positionKey(tile.position))) ||
    !hasUniqueValues(parsedUnits.map((unit) => unit.id)) ||
    !hasUniqueValues(parsedUnits.map((unit) => positionKey(unit.position))) ||
    !hasUniqueValues(parsedSites.map((site) => site.id)) ||
    !hasUniqueValues(parsedSites.map((site) => positionKey(site.position))) ||
    !hasUniqueValues(occupiedSiteEntries.map(({ key }) => key)) ||
    !hasUniqueValues(factionOrder as string[])
  ) {
    return failure('invalidData', '중복되거나 올바르지 않은 지도 좌표가 있습니다.')
  }

  const state: GameState = {
    schemaVersion: GAME_SCHEMA_VERSION,
    gameMode,
    mapSeed: value.mapSeed.trim(),
    mapType: mapType as MapType,
    mapGenerationVersion: value.mapGenerationVersion,
    boardSize,
    factionCount,
    humanFactionId: value.humanFactionId as FactionId,
    difficulty,
    factionOrder: factionOrder as FactionId[],
    turn: value.turn,
    phase: 'playing',
    activeFactionId: value.activeFactionId as FactionId,
    resources: {
      f1: (value.resources as Record<string, number>).f1 ?? 0,
      f2: (value.resources as Record<string, number>).f2 ?? 0,
      f3: (value.resources as Record<string, number>).f3 ?? 0,
      f4: (value.resources as Record<string, number>).f4 ?? 0,
      player: (value.resources as Record<string, number>).player ?? 0,
      enemy: (value.resources as Record<string, number>).enemy ?? 0,
    },
    tiles: parsedTiles,
    units: parsedUnits,
    sites: parsedSites,
  }
  const siteIdByPosition = new Map(
    occupiedSiteEntries.map(({ key, site }) => [key, site.id]),
  )
  const tilesMatchSites = parsedTiles.every((tile) => {
    const expectedSiteId = siteIdByPosition.get(positionKey(tile.position))
    return tile.siteId === expectedSiteId
  })
  const sitesMatchTiles = parsedSites.every((site) => {
    return getSiteOccupiedPositions(site).every((position) => {
      const tile = parsedTiles.find((candidate) =>
        positionsEqual(candidate.position, position),
      )
      return (
        tile?.siteId === site.id &&
        TERRAIN_MOVEMENT_COST[tile.terrain] !== null
      )
    })
  })
  const unitsAreValid = parsedUnits.every((unit) => {
    const tile = parsedTiles.find((candidate) => positionsEqual(candidate.position, unit.position))
    return Boolean(tile && TERRAIN_MOVEMENT_COST[tile.terrain] !== null)
  })
  const productionTurnsAreValid = parsedSites.every(
    (site) => site.lastProducedTurn === undefined || site.lastProducedTurn <= state.turn,
  )
  const developmentTurnsAreValid = parsedSites.every(
    (site) => site.lastDevelopedTurn === undefined || site.lastDevelopedTurn <= state.turn,
  )
  const constructionTurnsAreValid = parsedSites.every(
    (site) =>
      site.constructionQueue === undefined ||
      site.constructionQueue.startedTurn <= state.turn,
  )
  const capitals = parsedSites.filter((site) => site.capitalFor)
  const capitalsAreValid =
    capitals.length === factionCount &&
    (factionOrder as FactionId[]).every((factionId) =>
      capitals.some((site) => site.capitalFor === factionId),
    )

  if (
    !tilesMatchSites ||
    !sitesMatchTiles ||
    !unitsAreValid ||
    !productionTurnsAreValid ||
    !developmentTurnsAreValid ||
    !constructionTurnsAreValid ||
    !capitalsAreValid
  ) {
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

function getSaveStorageKey(gameMode: GameMode) {
  return gameMode === 'quick' ? QUICK_SAVE_STORAGE_KEY : SAVE_STORAGE_KEY
}

function readSavedGame(
  storage?: StorageLike,
  gameMode: GameMode = 'standard',
): StorageResult<SavedGame> {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage.ok) return resolvedStorage
  let serialized: string | null
  try {
    serialized = resolvedStorage.value.getItem(getSaveStorageKey(gameMode))
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
  const migrated = migrateSaveRecord(parsed)
  if (!migrated.ok) return migrated
  const normalizedRecord = migrated.value
  if (normalizedRecord.schemaVersion !== GAME_SCHEMA_VERSION) {
    return failure(
      'unsupportedVersion',
      normalizedRecord.schemaVersion === 4 || normalizedRecord.schemaVersion === 5
        ? '이전 사각 지도 저장은 지원되지 않습니다. 새 랜덤 지도로 재시작해 주세요.'
        : '현재 버전에서 지원하지 않는 저장 데이터입니다.',
    )
  }
  if (
    typeof normalizedRecord.savedAt !== 'string' ||
    Number.isNaN(Date.parse(normalizedRecord.savedAt))
  ) {
    return failure('invalidData', '저장 시각 정보가 올바르지 않습니다.')
  }
  const gameState = parseGameState(normalizedRecord.gameState)
  if (!gameState.ok) return gameState
  if (gameState.value.gameMode !== gameMode) {
    return failure(
      'invalidData',
      '다른 게임 모드의 저장은 불러올 수 없습니다.',
    )
  }
  return success({
    schemaVersion: GAME_SCHEMA_VERSION,
    savedAt: normalizedRecord.savedAt,
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
    !GAME_MODES.has(state.gameMode) ||
    !SUPPORTED_MAP_GENERATION_VERSIONS.includes(state.mapGenerationVersion) ||
    state.phase !== 'playing' ||
    state.activeFactionId !== state.humanFactionId ||
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
    resolvedStorage.value.setItem(
      getSaveStorageKey(state.gameMode),
      JSON.stringify(savedGame),
    )
  } catch {
    return failure('storageUnavailable', '게임을 저장할 수 없습니다.')
  }
  return success(savedGame)
}

export function loadGame(
  storage?: StorageLike,
  gameMode: GameMode = 'standard',
): StorageResult<SavedGame> {
  return readSavedGame(storage, gameMode)
}

export function inspectSavedGame(
  storage?: StorageLike,
  gameMode: GameMode = 'standard',
): StorageResult<SavedGame> {
  return readSavedGame(storage, gameMode)
}

export function deleteSavedGame(
  storage?: StorageLike,
  gameMode: GameMode = 'standard',
): StorageResult<undefined> {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage.ok) return resolvedStorage
  try {
    resolvedStorage.value.removeItem(getSaveStorageKey(gameMode))
  } catch {
    return failure('storageUnavailable', '저장 데이터를 삭제할 수 없습니다.')
  }
  return success(undefined)
}
