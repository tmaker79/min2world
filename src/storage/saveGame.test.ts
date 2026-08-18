import { describe, expect, it } from 'vitest'
import { HEX_TILE_COUNT } from '../game/hex'
import { createInitialGameState } from '../game/initialState'
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

function storeEnvelope(storage: MemoryStorage, gameState: unknown, schemaVersion = 6) {
  storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
    schemaVersion,
    savedAt: '2026-08-13T00:00:00.000Z',
    gameState,
  }))
}

describe('saved games', () => {
  it('round-trips the seed, hex map, sites, and fractional movement', () => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('save-roundtrip')
    state.units[0].movementRemaining = 1.5

    expect(saveGame(state, storage, new Date('2026-08-13T00:00:00Z')).ok).toBe(true)
    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.gameState).toEqual(JSON.parse(JSON.stringify(state)))
      expect(loaded.value.gameState.tiles).toHaveLength(HEX_TILE_COUNT)
      expect(loaded.value.gameState.sites).toHaveLength(8)
      expect(loaded.value.gameState.mapSeed).toBe('save-roundtrip')
    }
  })

  it('migrates schema 7 town and farm site IDs to their explicit types', () => {
    const storage = new MemoryStorage()
    const state = createInitialGameState('site-type-migration')
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
    }
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
