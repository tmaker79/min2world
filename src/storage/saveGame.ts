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
} from '../game/rules'
import {
  BUILDING_DEFINITIONS,
  BUILDING_IDS,
  WALL_MAX_HP_BONUS,
} from '../game/cityAdministration'
import {
  GAME_SCHEMA_VERSION,
  MAP_GENERATION_VERSION,
  SUPPORTED_MAP_GENERATION_VERSIONS,
} from '../game/types'
import type {
  BoardSize,
  BuildingId,
  FactionCount,
  FactionId,
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
const TERRAINS = new Set<Terrain>([
  'plain', 'bridge', 'mountain', 'water', 'hill', 'forest', 'desert', 'desertHill', 'oasis', 'tundra',
  'tundraForest',
  'tundraMountain',
])
const UNIT_TYPES = new Set<UnitType>(['infantry', 'cavalry', 'archer', 'spearman'])
const SITE_TYPES = new Set<SiteType>([
  'outpost',
  'keep',
  'stronghold',
  'village',
  'town',
  'farm',
  'mine',
  'blacksmith',
  'city',
])
const MAP_TYPES = new Set<MapType>(['balanced', 'plains', 'mountainous', 'forested'])
const BUILDINGS = new Set<BuildingId>(BUILDING_IDS)

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

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length
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
  if (
    value.schemaVersion !== GAME_SCHEMA_VERSION ||
    !isNonEmptyString(value.mapSeed, 64) ||
    typeof mapType !== 'string' ||
    !MAP_TYPES.has(mapType as MapType) ||
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
    mapSeed: value.mapSeed.trim(),
    mapType: mapType as MapType,
    mapGenerationVersion: value.mapGenerationVersion,
    boardSize,
    factionCount,
    humanFactionId: value.humanFactionId as FactionId,
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
  const savedRecord = parsed as Record<string, unknown>
  if (savedRecord.schemaVersion === 6 && isRecord(savedRecord.gameState)) {
    const legacyState = savedRecord.gameState
    if (legacyState.mapGenerationVersion !== 4) {
      return failure('invalidData', '저장된 지도 생성 버전이 올바르지 않습니다.')
    }
    const remapFaction = (value: unknown) =>
      value === 'player' ? 'f1' : value === 'enemy' ? 'f2' : value
    const remapEntity = (entity: unknown) => {
      if (!isRecord(entity)) return entity
      return {
        ...entity,
        factionId: remapFaction(entity.factionId),
        ownerId: remapFaction(entity.ownerId),
        capitalFor: remapFaction(entity.capitalFor),
      }
    }
    parsed = {
      ...savedRecord,
      schemaVersion: 7,
      gameState: {
        ...legacyState,
        schemaVersion: 7,
        mapGenerationVersion: MAP_GENERATION_VERSION,
        boardSize: { columns: 48, rows: 32 },
        factionCount: 2,
        humanFactionId: 'f1',
        factionOrder: ['f1', 'f2'],
        activeFactionId: remapFaction(legacyState.activeFactionId),
        resources: {
          f1: isRecord(legacyState.resources) ? legacyState.resources.player : undefined,
          f2: isRecord(legacyState.resources) ? legacyState.resources.enemy : undefined,
        },
        units: Array.isArray(legacyState.units)
          ? legacyState.units.map(remapEntity)
          : legacyState.units,
        sites: Array.isArray(legacyState.sites)
          ? legacyState.sites.map(remapEntity)
          : legacyState.sites,
      },
    }
  }
  const siteTypeRecord = parsed as Record<string, unknown>
  if (siteTypeRecord.schemaVersion === 7 && isRecord(siteTypeRecord.gameState)) {
    const legacyState = siteTypeRecord.gameState
    const remapSiteType = (site: unknown) => {
      if (!isRecord(site)) return site
      return {
        ...site,
        kind: site.kind === 'city' ? 'village' : site.kind === 'village' ? 'farm' : site.kind,
      }
    }
    parsed = {
      ...siteTypeRecord,
      schemaVersion: 8,
      gameState: {
        ...legacyState,
        schemaVersion: 8,
        sites: Array.isArray(legacyState.sites)
          ? legacyState.sites.map(remapSiteType)
          : legacyState.sites,
      },
    }
  }
  const developmentRecord = parsed as Record<string, unknown>
  if (developmentRecord.schemaVersion === 8 && isRecord(developmentRecord.gameState)) {
    const legacyState = developmentRecord.gameState
    const migrateSite = (site: unknown) => {
      if (!isRecord(site)) return site
      const {
        lastDevelopedTurn: _lastDevelopedTurn,
        level: _level,
        ...legacySite
      } = site
      void _lastDevelopedTurn
      void _level
      const requiresLevel = legacySite.kind === 'farm' || legacySite.kind === 'mine'
      return {
        ...legacySite,
        ...(requiresLevel ? { level: 1 } : {}),
      }
    }
    parsed = {
      ...developmentRecord,
      schemaVersion: 9,
      gameState: {
        ...legacyState,
        schemaVersion: 9,
        sites: Array.isArray(legacyState.sites)
          ? legacyState.sites.map(migrateSite)
          : legacyState.sites,
      },
    }
  }
  const siteCombatRecord = parsed as Record<string, unknown>
  if (siteCombatRecord.schemaVersion === 9 && isRecord(siteCombatRecord.gameState)) {
    const legacyState = siteCombatRecord.gameState
    const legacyMaxHp: Record<string, number> = {
      outpost: 50,
      keep: 75,
      stronghold: 100,
      castle: 120,
    }
    const migrateSite = (site: unknown) => {
      if (!isRecord(site) || typeof site.kind !== 'string') return site
      const maxHp = legacyMaxHp[site.kind]
      if (!maxHp) return site
      return {
        ...site,
        hp: maxHp,
        maxHp,
      }
    }
    parsed = {
      ...siteCombatRecord,
      schemaVersion: 10,
      gameState: {
        ...legacyState,
        schemaVersion: 10,
        sites: Array.isArray(legacyState.sites)
          ? legacyState.sites.map(migrateSite)
          : legacyState.sites,
      },
    }
  }
  const settlementNamesRecord = parsed as Record<string, unknown>
  if (
    settlementNamesRecord.schemaVersion === 10 &&
    isRecord(settlementNamesRecord.gameState)
  ) {
    const legacyState = settlementNamesRecord.gameState
    const capitalNames: Record<string, string> = {
      '청색 성': '청색 도시',
      '적색 성': '적색 도시',
      '황금 성': '황금 도시',
      '자색 성': '자색 도시',
    }
    const migrateSite = (site: unknown) => {
      if (!isRecord(site)) return site
      return {
        ...site,
        kind:
          site.kind === 'castle'
            ? 'city'
            : site.kind === 'city'
              ? 'town'
              : site.kind,
        name:
          site.kind === 'castle' && typeof site.name === 'string'
            ? (capitalNames[site.name] ?? site.name)
            : site.name,
      }
    }
    parsed = {
      ...settlementNamesRecord,
      schemaVersion: 11,
      gameState: {
        ...legacyState,
        schemaVersion: 11,
        sites: Array.isArray(legacyState.sites)
          ? legacyState.sites.map(migrateSite)
          : legacyState.sites,
      },
    }
  }
  const buildingRecord = parsed as Record<string, unknown>
  if (
    buildingRecord.schemaVersion === 11 &&
    isRecord(buildingRecord.gameState)
  ) {
    const legacyState = buildingRecord.gameState
    const migrateSite = (site: unknown) =>
      isRecord(site) ? { ...site, buildings: [] } : site
    parsed = {
      ...buildingRecord,
      schemaVersion: 12,
      gameState: {
        ...legacyState,
        schemaVersion: 12,
        sites: Array.isArray(legacyState.sites)
          ? legacyState.sites.map(migrateSite)
          : legacyState.sites,
      },
    }
  }
  const normalizedRecord = parsed as Record<string, unknown>
  if (normalizedRecord.schemaVersion !== GAME_SCHEMA_VERSION) {
    return failure(
      'unsupportedVersion',
      normalizedRecord.schemaVersion === 4 || normalizedRecord.schemaVersion === 5
        ? '이전 사각 지도 저장은 지원되지 않습니다. 새 게임을 시작해 주세요.'
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
