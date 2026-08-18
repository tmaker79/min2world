import { describe, expect, it } from 'vitest'
import { BOARD_SIZE_PRESETS, getHexNeighbors, positionKey } from './hex'
import {
  createRandomMapSeed,
  generateGameState,
  normalizeMapSeed,
  validateGeneratedMap,
} from './mapGenerator'
import {
  FOREST_TERRAIN_VARIANT_COUNT,
  GAME_SCHEMA_VERSION,
  MAP_GENERATION_VERSION,
} from './types'
import { HEX_TILE_COUNT } from './hex'

describe('procedural map generation', () => {
  it('reproduces an identical state from the same seed', () => {
    expect(generateGameState('same-seed')).toEqual(generateGameState('same-seed'))
  })

  it('creates different terrain and sites for a different seed', () => {
    const signature = (seed: string) => {
      const state = generateGameState(seed)
      return JSON.stringify({
        terrains: state.tiles.map((tile) => tile.terrain),
        sites: state.sites.map((site) => site.position),
      })
    }

    expect(signature('alpha')).not.toBe(signature('bravo'))
  })

  it.each(['alpha', 'bravo', 'hex-world', '균형 지도', '00000000'])(
    'satisfies every generation invariant for %s',
    (seed) => {
      const state = generateGameState(seed)

      expect(validateGeneratedMap(state)).toEqual([])
      expect(state.tiles).toHaveLength(HEX_TILE_COUNT)
      expect(state.tiles.map((tile) => tile.terrain)).not.toContain('road')
      expect(state.tiles.map((tile) => tile.terrain)).not.toContain('grassland')
      expect(state.tiles.map((tile) => tile.terrain)).not.toContain('steppe')
      expect(state.sites).toHaveLength(8)
      expect(state.units).toHaveLength(6)
      expect(state.sites.filter((site) => site.kind === 'stronghold')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'village')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'farm')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'mine')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'city')).toHaveLength(0)
      const tilesByPosition = new Map(
        state.tiles.map((tile) => [positionKey(tile.position), tile]),
      )
      expect(
        state.sites
          .filter((site) => site.kind === 'farm')
          .every(
            (site) =>
              tilesByPosition.get(positionKey(site.position))?.terrain === 'plain',
          ),
      ).toBe(true)
      expect(state.mapGenerationVersion).toBe(MAP_GENERATION_VERSION)
      expect(state.schemaVersion).toBe(GAME_SCHEMA_VERSION)
    },
  )

  it('normalizes seeds and generates an eight-character hexadecimal seed', () => {
    expect(normalizeMapSeed('  a seed  ')).toBe('a seed')
    expect(normalizeMapSeed('')).toBeUndefined()
    expect(normalizeMapSeed('x'.repeat(65))).toBeUndefined()
    expect(createRandomMapSeed()).toMatch(/^[0-9a-f]{8}$/)
  })

  it.each([
    [BOARD_SIZE_PRESETS.tiny, 2],
    [BOARD_SIZE_PRESETS.small, 2],
    [BOARD_SIZE_PRESETS.standard, 3],
    [BOARD_SIZE_PRESETS.large, 4],
  ] as const)('generates a valid %sx%s map for %s factions', (boardSize, factionCount) => {
    const state = generateGameState('preset-factions', {
      boardSize,
      factionCount,
      humanFactionId: 'f1',
    })

    expect(validateGeneratedMap(state)).toEqual([])
    expect(state.tiles).toHaveLength(boardSize.columns * boardSize.rows)
    expect(state.factionOrder).toHaveLength(factionCount)
    expect(state.sites.filter((site) => site.capitalFor)).toHaveLength(factionCount)
    expect(state.units).toHaveLength(factionCount * 3)
  })

  it('forces tiny boards to duel (2 factions)', () => {
    const state = generateGameState('tiny-duel-only', {
      boardSize: BOARD_SIZE_PRESETS.tiny,
      factionCount: 4,
      humanFactionId: 'f1',
    })

    expect(state.factionCount).toBe(2)
    expect(state.factionOrder).toEqual(['f1', 'f2'])
  })

  it('keeps adjacent forest tiles on the same tree variant', () => {
    const state = generateGameState('hex-world')
    const forests = state.tiles.filter((tile) => tile.terrain === 'forest')
    const byKey = new Map(
      state.tiles.map((tile) => [positionKey(tile.position), tile]),
    )

    expect(forests.length).toBeGreaterThan(0)
    expect(
      forests.every(
        (tile) =>
          tile.terrainVariant !== undefined &&
          tile.terrainVariant >= 0 &&
          tile.terrainVariant < FOREST_TERRAIN_VARIANT_COUNT,
      ),
    ).toBe(true)

    for (const tile of forests) {
      for (const neighbor of getHexNeighbors(tile.position)) {
        const adjacent = byKey.get(positionKey(neighbor))
        if (adjacent?.terrain !== 'forest') continue
        expect(adjacent.terrainVariant).toBe(tile.terrainVariant)
      }
    }
  })
})
