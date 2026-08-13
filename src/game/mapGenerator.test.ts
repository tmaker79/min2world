import { describe, expect, it } from 'vitest'
import {
  createRandomMapSeed,
  generateGameState,
  normalizeMapSeed,
  validateGeneratedMap,
} from './mapGenerator'

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
      expect(state.tiles).toHaveLength(144)
      expect(state.tiles.map((tile) => tile.terrain)).not.toContain('road')
      expect(state.tiles.map((tile) => tile.terrain)).not.toContain('grassland')
      expect(state.tiles.map((tile) => tile.terrain)).not.toContain('steppe')
      expect(state.sites).toHaveLength(8)
      expect(state.units).toHaveLength(6)
      expect(state.sites.filter((site) => site.kind === 'stronghold')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'city')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'village')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'mine')).toHaveLength(2)
      expect(state.mapGenerationVersion).toBe(1)
      expect(state.schemaVersion).toBe(6)
    },
  )

  it('normalizes seeds and generates an eight-character hexadecimal seed', () => {
    expect(normalizeMapSeed('  a seed  ')).toBe('a seed')
    expect(normalizeMapSeed('')).toBeUndefined()
    expect(normalizeMapSeed('x'.repeat(65))).toBeUndefined()
    expect(createRandomMapSeed()).toMatch(/^[0-9a-f]{8}$/)
  })
})
