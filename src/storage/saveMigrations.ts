import { MAP_GENERATION_VERSION } from '../game/types'
import { failure, isRecord, success } from './storageResult'
import type { StorageResult } from './storageResult'

// 저장 레코드와 그 안의 gameState는 아직 검증되지 않은 임의의 JSON이므로
// 마이그레이션 단계에서는 느슨한 레코드 타입으로만 다룬다.
type SaveRecord = Record<string, unknown>

// 각 단계는 gameState만 변환해 반환하고, schemaVersion 갱신은
// migrateSaveRecord가 레코드와 gameState 양쪽에 일괄 적용한다.
type MigrationStep = {
  from: number
  migrate: (gameState: SaveRecord) => StorageResult<SaveRecord>
}

function mapSites(
  gameState: SaveRecord,
  migrateSite: (site: unknown) => unknown,
): SaveRecord {
  return {
    ...gameState,
    sites: Array.isArray(gameState.sites)
      ? gameState.sites.map(migrateSite)
      : gameState.sites,
  }
}

// 단일 세력 id(player/enemy)를 f1/f2로 옮기고 2인 고정 보드로 정규화한다.
function migrateToV7(gameState: SaveRecord): StorageResult<SaveRecord> {
  if (gameState.mapGenerationVersion !== 4) {
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
  return success({
    ...gameState,
    mapGenerationVersion: MAP_GENERATION_VERSION,
    boardSize: { columns: 48, rows: 32 },
    factionCount: 2,
    humanFactionId: 'f1',
    factionOrder: ['f1', 'f2'],
    activeFactionId: remapFaction(gameState.activeFactionId),
    resources: {
      f1: isRecord(gameState.resources) ? gameState.resources.player : undefined,
      f2: isRecord(gameState.resources) ? gameState.resources.enemy : undefined,
    },
    units: Array.isArray(gameState.units)
      ? gameState.units.map(remapEntity)
      : gameState.units,
    sites: Array.isArray(gameState.sites)
      ? gameState.sites.map(remapEntity)
      : gameState.sites,
  })
}

// city -> village, village -> farm으로 거점 종류를 한 단계씩 밀어낸다.
function migrateToV8(gameState: SaveRecord): StorageResult<SaveRecord> {
  return success(
    mapSites(gameState, (site) => {
      if (!isRecord(site)) return site
      return {
        ...site,
        kind:
          site.kind === 'city'
            ? 'village'
            : site.kind === 'village'
              ? 'farm'
              : site.kind,
      }
    }),
  )
}

// 개발 단계 도입: 농장·광산에 level 1을 부여하고 이전 개발 기록은 버린다.
function migrateToV9(gameState: SaveRecord): StorageResult<SaveRecord> {
  return success(
    mapSites(gameState, (site) => {
      if (!isRecord(site)) return site
      const {
        lastDevelopedTurn: _lastDevelopedTurn,
        level: _level,
        ...legacySite
      } = site
      void _lastDevelopedTurn
      void _level
      const requiresLevel =
        legacySite.kind === 'farm' || legacySite.kind === 'mine'
      return {
        ...legacySite,
        ...(requiresLevel ? { level: 1 } : {}),
      }
    }),
  )
}

// 거점 전투 도입: 요새화 거점에 종류별 HP를 채운다.
function migrateToV10(gameState: SaveRecord): StorageResult<SaveRecord> {
  const legacyMaxHp: Record<string, number> = {
    outpost: 50,
    keep: 75,
    stronghold: 100,
    castle: 120,
  }
  return success(
    mapSites(gameState, (site) => {
      if (!isRecord(site) || typeof site.kind !== 'string') return site
      const maxHp = legacyMaxHp[site.kind]
      if (!maxHp) return site
      return {
        ...site,
        hp: maxHp,
        maxHp,
      }
    }),
  )
}

// castle -> city, city -> town으로 정착지 체계를 재편하고 수도 이름을 맞춘다.
function migrateToV11(gameState: SaveRecord): StorageResult<SaveRecord> {
  const capitalNames: Record<string, string> = {
    '청색 성': '청색 도시',
    '적색 성': '적색 도시',
    '황금 성': '황금 도시',
    '자색 성': '자색 도시',
  }
  return success(
    mapSites(gameState, (site) => {
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
    }),
  )
}

// 도시 건물 도입: 모든 거점에 빈 buildings 배열을 넣는다.
function migrateToV12(gameState: SaveRecord): StorageResult<SaveRecord> {
  return success(
    mapSites(gameState, (site) =>
      isRecord(site) ? { ...site, buildings: [] } : site,
    ),
  )
}

// 스키마 번호만 올린다.
function migrateToV13(gameState: SaveRecord): StorageResult<SaveRecord> {
  return success(gameState)
}

// 정착지 footprint 도입: town·city에 단일 칸 footprint를 부여하고,
// 앵커가 아닌 타일에 남아 있던 siteId 참조를 정리한다.
function migrateToV14(gameState: SaveRecord): StorageResult<SaveRecord> {
  const legacySites = Array.isArray(gameState.sites) ? gameState.sites : []
  const settlementAnchors = new Map(
    legacySites.flatMap((site) =>
      isRecord(site) &&
      (site.kind === 'town' || site.kind === 'city') &&
      typeof site.id === 'string' &&
      isRecord(site.position)
        ? [[site.id, site.position] as const]
        : [],
    ),
  )
  const migrateSite = (site: unknown) =>
    isRecord(site) && (site.kind === 'town' || site.kind === 'city')
      ? { ...site, footprint: [site.position] }
      : site
  const migrateTile = (tile: unknown) => {
    if (
      !isRecord(tile) ||
      typeof tile.siteId !== 'string' ||
      !isRecord(tile.position)
    ) {
      return tile
    }
    const anchor = settlementAnchors.get(tile.siteId)
    if (
      !anchor ||
      (tile.position.q === anchor.q && tile.position.r === anchor.r)
    ) {
      return tile
    }
    const { siteId: _siteId, ...withoutSiteId } = tile
    void _siteId
    return withoutSiteId
  }
  return success({
    ...gameState,
    sites: legacySites.map(migrateSite),
    tiles: Array.isArray(gameState.tiles)
      ? gameState.tiles.map(migrateTile)
      : gameState.tiles,
  })
}

const MIGRATION_STEPS: readonly MigrationStep[] = [
  { from: 6, migrate: migrateToV7 },
  { from: 7, migrate: migrateToV8 },
  { from: 8, migrate: migrateToV9 },
  { from: 9, migrate: migrateToV10 },
  { from: 10, migrate: migrateToV11 },
  { from: 11, migrate: migrateToV12 },
  { from: 12, migrate: migrateToV13 },
  { from: 13, migrate: migrateToV14 },
]

// 적용 가능한 단계를 순서대로 통과시킨다. 버전이 맞지 않거나 gameState가
// 레코드가 아니면 그 단계를 건너뛰므로, 최종 버전 확인은 호출자가 담당한다.
export function migrateSaveRecord(
  record: SaveRecord,
): StorageResult<SaveRecord> {
  let current = record
  for (const step of MIGRATION_STEPS) {
    if (current.schemaVersion !== step.from || !isRecord(current.gameState)) {
      continue
    }
    const migrated = step.migrate(current.gameState)
    if (!migrated.ok) return migrated
    const nextVersion = step.from + 1
    current = {
      ...current,
      schemaVersion: nextVersion,
      gameState: { ...migrated.value, schemaVersion: nextVersion },
    }
  }
  return success(current)
}
