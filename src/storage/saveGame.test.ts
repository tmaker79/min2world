import { describe, expect, it } from 'vitest'
import { HEX_TILE_COUNT, positionKey } from '../game/hex'
import { createInitialGameState } from '../game/initialState'
import {
  getSiteMaxHp,
  isFortifiedSiteKind,
  TERRAIN_MOVEMENT_COST,
} from '../game/rules'
import { getCityFootprintCandidates } from '../game/siteFootprint'
import { GAME_SCHEMA_VERSION, MAP_GENERATION_VERSION } from '../game/types'
import type { GameState } from '../game/types'
import {
  deleteSavedGame,
  inspectSavedGame,
  loadGame,
  SAVE_STORAGE_KEY,
  saveGame,
  type StorageLike,
} from './saveGame'

class MemoryStorage implements StorageLike {
  values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

function storeEnvelope(
  storage: MemoryStorage,
  gameState: unknown,
  schemaVersion = GAME_SCHEMA_VERSION,
) {
  storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
    schemaVersion,
    savedAt: '2026-08-13T00:00:00.000Z',
    gameState,
  }))
}

function createSchema8State(seed: string): GameState {
  const state = createInitialGameState(seed)
  const renamedSiteIds = new Map(
    state.sites
      .filter((site) => site.kind === 'blacksmith')
      .map((site) => [site.id, site.id.replace('blacksmith', 'village')]),
  )
  return {
    ...state,
    schemaVersion: 8,
    tiles: state.tiles.map((tile) =>
      tile.siteId && renamedSiteIds.has(tile.siteId)
        ? { ...tile, siteId: renamedSiteIds.get(tile.siteId) }
        : tile,
    ),
    sites: state.sites
      .map(({ level: _level, lastDevelopedTurn: _lastDevelopedTurn, ...site }) => {
        void _level
        void _lastDevelopedTurn
        return site.kind === 'blacksmith'
          ? {
              ...site,
              id: renamedSiteIds.get(site.id)!,
              name: site.name.replace('대장간', '마을'),
              kind: 'village' as const,
            }
          : site
      }),
  }
}

describe('saved games', () => {
  it('round-trips the seed, hex map, sites, and fractional movement', () => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('save-roundtrip', {
      mapType: 'forested',
      humanFactionId: 'f1',
    })
    state.units[0].movementRemaining = 1.5

    expect(saveGame(state, storage, new Date('2026-08-13T00:00:00Z')).ok).toBe(true)
    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.gameState).toEqual(JSON.parse(JSON.stringify(state)))
      expect(loaded.value.gameState.mapGenerationVersion).toBe(24)
      expect(loaded.value.gameState.tiles).toHaveLength(HEX_TILE_COUNT)
      expect(loaded.value.gameState.sites).toHaveLength(8)
      expect(loaded.value.gameState.mapSeed).toBe('save-roundtrip')
      expect(loaded.value.gameState.mapType).toBe('forested')
      expect(
        loaded.value.gameState.sites
          .filter((site) => isFortifiedSiteKind(site.kind))
          .every(
            (site) =>
              site.maxHp === getSiteMaxHp(site.kind) &&
              site.hp === getSiteMaxHp(site.kind),
          ),
      ).toBe(true)
    }
  })

  it('defaults schema 8 saves without a map type to balanced', () => {
    const storage = new MemoryStorage()
    const state = createSchema8State('legacy-map-type')
    const legacyState: Partial<typeof state> = { ...state }
    delete legacyState.mapType
    storeEnvelope(storage, legacyState, 8)

    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.value.gameState.mapType).toBe('balanced')
  })

  it.each([5, 20, 22, 23])(
    'loads and re-saves map generation version %s games',
    (mapGenerationVersion) => {
    const storage = new MemoryStorage()
    const state = createInitialGameState(`generation-v${mapGenerationVersion}`)
    state.mapGenerationVersion = mapGenerationVersion
    storeEnvelope(storage, state)

    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.gameState.mapGenerationVersion).toBe(
        mapGenerationVersion,
      )
      expect(saveGame(loaded.value.gameState, storage).ok).toBe(true)
    }
    expect(MAP_GENERATION_VERSION).toBe(24)
    },
  )

  it('loads schema 8 saves created with the previous 15x10 board', () => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('legacy-tiny-board', {
      boardSize: { columns: 15, rows: 10 },
      factionCount: 2,
    })
    state.schemaVersion = 8
    const removed = new Set(
      state.sites
        .filter((site) => site.kind === 'outpost' || site.kind === 'blacksmith')
        .map((site) => site.id),
    )
    state.sites = state.sites
      .filter((site) => !removed.has(site.id))
      .map(({ level: _level, ...site }) => {
        void _level
        return site
      })
    state.tiles = state.tiles.map((tile) => {
      if (!tile.siteId || !removed.has(tile.siteId)) return tile
      const { siteId: _siteId, ...withoutSite } = tile
      void _siteId
      return withoutSite
    })
    storeEnvelope(storage, state, 8)

    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.gameState.boardSize).toEqual({ columns: 15, rows: 10 })
    }
  })

  it('loads schema 8 saves created with the previous 21x14 board', () => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('legacy-small-board', {
      boardSize: { columns: 21, rows: 14 },
      factionCount: 2,
    })
    state.schemaVersion = 8
    const removed = new Set(
      state.sites
        .filter((site) => site.kind === 'outpost' || site.kind === 'blacksmith')
        .map((site) => site.id),
    )
    state.sites = state.sites
      .filter((site) => !removed.has(site.id))
      .map(({ level: _level, lastDevelopedTurn: _lastDevelopedTurn, ...site }) => {
        void _level
        void _lastDevelopedTurn
        return site
      })
    state.tiles = state.tiles.map((tile) => {
      if (!tile.siteId || !removed.has(tile.siteId)) return tile
      const { siteId: _siteId, ...withoutSite } = tile
      void _siteId
      return withoutSite
    })
    storeEnvelope(storage, state, 8)

    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.gameState.boardSize).toEqual({ columns: 21, rows: 14 })
    }
  })

  it('migrates schema 7 town and farm site IDs to their explicit types', () => {
    const storage = new MemoryStorage()
    const state = createSchema8State('site-type-migration')
    const legacyState = {
      ...state,
      schemaVersion: 7,
      sites: state.sites.map((site) => ({
        ...site,
        kind: site.kind === 'village' ? 'city' : site.kind === 'farm' ? 'village' : site.kind,
      })),
    }
    storeEnvelope(storage, legacyState, 7)

    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.gameState.sites.filter((site) => site.kind === 'village')).toHaveLength(2)
      expect(loaded.value.gameState.sites.filter((site) => site.kind === 'farm')).toHaveLength(2)
      expect(loaded.value.gameState.sites.filter((site) => site.kind === 'city')).toHaveLength(0)
      expect(
        loaded.value.gameState.sites
          .filter((site) => site.kind === 'farm' || site.kind === 'mine')
          .every((site) => site.level === 1),
      ).toBe(true)
    }
  })

  it('migrates an eight-site schema 8 save to schema 10 without changing its map version or castle footprints', () => {
    const storage = new MemoryStorage()
    const state = createSchema8State('schema-8-migration')
    state.mapGenerationVersion = 21
    const castleFootprints = state.sites
      .filter((site) => site.kind === 'castle')
      .map((site) => site.footprint)
    storeEnvelope(storage, state, 8)

    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.schemaVersion).toBe(10)
      expect(loaded.value.gameState.schemaVersion).toBe(10)
      expect(loaded.value.gameState.mapGenerationVersion).toBe(21)
      expect(loaded.value.gameState.sites).toHaveLength(8)
      expect(
        loaded.value.gameState.sites
          .filter((site) => site.kind === 'farm' || site.kind === 'mine')
          .every((site) => site.level === 1),
      ).toBe(true)
      expect(
        loaded.value.gameState.sites
          .filter((site) => site.kind === 'castle')
          .map((site) => site.footprint),
      ).toEqual(castleFootprints)
      expect(loaded.value.gameState.sites.every((site) => site.lastDevelopedTurn === undefined)).toBe(true)
    }
  })

  it('migrates schema 9 fortified sites to full kind-specific hp while preserving site data', () => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('schema-9-site-hp')
    state.schemaVersion = 9
    state.mapGenerationVersion = 21
    const castle = state.sites.find((site) => site.kind === 'castle')!
    const footprint = castle.footprint
    const farm = state.sites.find((site) => site.kind === 'farm')!
    farm.level = 2
    farm.lastDevelopedTurn = 1
    state.sites = state.sites.map(({ hp: _hp, maxHp: _maxHp, ...site }) => {
      void _hp
      void _maxHp
      return site
    })
    storeEnvelope(storage, state, 9)

    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.schemaVersion).toBe(10)
      expect(loaded.value.gameState.schemaVersion).toBe(10)
      expect(loaded.value.gameState.mapGenerationVersion).toBe(21)
      expect(loaded.value.gameState.sites.find((site) => site.id === castle.id)?.footprint).toEqual(footprint)
      expect(loaded.value.gameState.sites.find((site) => site.id === farm.id)).toMatchObject({
        level: 2,
        lastDevelopedTurn: 1,
      })
      for (const site of loaded.value.gameState.sites) {
        if (isFortifiedSiteKind(site.kind)) {
          expect(site).toMatchObject({
            hp: getSiteMaxHp(site.kind),
            maxHp: getSiteMaxHp(site.kind),
          })
        } else {
          expect(site.hp).toBeUndefined()
          expect(site.maxHp).toBeUndefined()
        }
      }
    }
  })

  it('round-trips a valid city footprint and development turn', () => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('city-roundtrip')
    state.turn = 3
    const village = state.sites.find((site) => site.kind === 'farm')!
    village.kind = 'village'
    delete village.level
    const footprint = getCityFootprintCandidates(village.position, state.boardSize).find(
      (candidate) =>
        candidate.every((position) => {
          const tile = state.tiles.find(
            (candidateTile) => positionKey(candidateTile.position) === positionKey(position),
          )
          return (
            tile &&
            TERRAIN_MOVEMENT_COST[tile.terrain] !== null &&
            (tile.siteId === undefined || tile.siteId === village.id)
          )
        }),
    )!
    village.kind = 'city'
    village.footprint = footprint
    village.lastDevelopedTurn = 2
    const footprintKeys = new Set(footprint.map(positionKey))
    state.tiles = state.tiles.map((tile) =>
      footprintKeys.has(positionKey(tile.position))
        ? { ...tile, siteId: village.id }
        : tile,
    )

    expect(saveGame(state, storage).ok).toBe(true)
    const loaded = loadGame(storage)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.gameState.sites.find((site) => site.id === village.id)).toMatchObject({
        kind: 'city',
        footprint,
        lastDevelopedTurn: 2,
      })
    }
  })

  it.each([
    ['missing level', (state: GameState) => { delete state.sites.find((site) => site.kind === 'farm')!.level }],
    ['invalid level', (state: GameState) => { state.sites.find((site) => site.kind === 'mine')!.level = 4 as never }],
    ['invalid city footprint', (state: GameState) => {
      const village = state.sites.find((site) => site.kind === 'farm')!
      village.kind = 'city'
      delete village.level
      village.footprint = [village.position]
    }],
    ['footprint on a one-tile site', (state: GameState) => { state.sites.find((site) => site.kind === 'farm')!.footprint = [state.sites.find((site) => site.kind === 'farm')!.position] }],
    ['future development turn', (state: GameState) => { state.sites[0].lastDevelopedTurn = state.turn + 1 }],
    ['missing fortified hp', (state: GameState) => { delete state.sites.find((site) => site.kind === 'castle')!.hp }],
    ['fractional fortified hp', (state: GameState) => { state.sites.find((site) => site.kind === 'castle')!.hp = 1.5 }],
    ['zero fortified hp', (state: GameState) => { state.sites.find((site) => site.kind === 'castle')!.hp = 0 }],
    ['hp above max', (state: GameState) => {
      const site = state.sites.find((candidate) => candidate.kind === 'castle')!
      site.hp = site.maxHp! + 1
    }],
    ['wrong fortified max hp', (state: GameState) => { state.sites.find((site) => site.kind === 'castle')!.maxHp = 1 }],
    ['hp on nonfortified site', (state: GameState) => { state.sites.find((site) => site.kind === 'farm')!.hp = 1 }],
    ['max hp on nonfortified site', (state: GameState) => { state.sites.find((site) => site.kind === 'farm')!.maxHp = 1 }],
  ])('rejects schema 10 sites with %s', (_, mutate) => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('invalid-site-schema')
    mutate(state)
    storeEnvelope(storage, state)

    expect(loadGame(storage)).toMatchObject({ ok: false, code: 'invalidData' })
  })

  it.each([4, 5])('safely rejects legacy square-map schema %s', (schemaVersion) => {
    const storage = new MemoryStorage()
    storeEnvelope(storage, {}, schemaVersion)

    const result = loadGame(storage)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unsupportedVersion')
      expect(result.message).toContain('새 게임')
    }
  })

  it.each([
    ['empty seed', (state: ReturnType<typeof createInitialGameState>) => { state.mapSeed = '' }],
    ['generation version', (state: ReturnType<typeof createInitialGameState>) => { state.mapGenerationVersion = 1 }],
    ['unknown map type', (state: ReturnType<typeof createInitialGameState>) => { state.mapType = 'oceanic' as never }],
    ['out-of-board coordinate', (state: ReturnType<typeof createInitialGameState>) => { state.tiles[0].position = { q: 20, r: 0 } }],
    ['unknown terrain', (state: ReturnType<typeof createInitialGameState>) => { state.tiles[0].terrain = 'lava' as never }],
    ['broken site reference', (state: ReturnType<typeof createInitialGameState>) => { state.tiles.find((tile) => tile.siteId)!.siteId = 'missing' }],
  ])('rejects invalid %s data', (_, mutate) => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('invalid-save')
    mutate(state)
    storeEnvelope(storage, state)

    expect(loadGame(storage)).toMatchObject({ ok: false, code: 'invalidData' })
  })

  it('reports malformed, missing, and unavailable storage safely', () => {
    const empty = new MemoryStorage()
    expect(inspectSavedGame(empty)).toMatchObject({ ok: false, code: 'notFound' })
    empty.setItem(SAVE_STORAGE_KEY, '{bad json')
    expect(loadGame(empty)).toMatchObject({ ok: false, code: 'invalidData' })

    const throwing: StorageLike = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }
    expect(saveGame(createInitialGameState('blocked'), throwing)).toMatchObject({ ok: false, code: 'storageUnavailable' })
    expect(loadGame(throwing)).toMatchObject({ ok: false, code: 'storageUnavailable' })
    expect(deleteSavedGame(throwing)).toMatchObject({ ok: false, code: 'storageUnavailable' })
  })

  it('deletes an existing save', () => {
    const storage = new MemoryStorage()
    saveGame(createInitialGameState('delete'), storage)
    expect(deleteSavedGame(storage)).toEqual({ ok: true, value: undefined })
    expect(loadGame(storage)).toMatchObject({ ok: false, code: 'notFound' })
  })
})
