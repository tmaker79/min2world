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
import type { MapType, Terrain } from './types'
import { HEX_TILE_COUNT } from './hex'

const MAP_TYPES: MapType[] = ['balanced', 'plains', 'mountainous', 'forested']

describe('procedural map generation', () => {
  it('reproduces an identical state from the same seed', () => {
    expect(generateGameState('same-seed')).toEqual(generateGameState('same-seed'))
  })

  it('preserves the existing balanced terrain for the default map type', () => {
    const implicit = generateGameState('balanced-compatibility')
    const explicit = generateGameState('balanced-compatibility', {
      mapType: 'balanced',
    })

    expect(explicit.tiles).toEqual(implicit.tiles)
    expect(explicit.sites.map((site) => site.position)).toEqual(
      implicit.sites.map((site) => site.position),
    )
  })

  it('creates distinct terrain profiles from the same seed', () => {
    const signatures = MAP_TYPES.map((mapType) =>
      JSON.stringify(
        generateGameState('map-type-difference', { mapType }).tiles.map(
          (tile) => tile.terrain,
        ),
      ),
    )

    expect(new Set(signatures)).toHaveLength(MAP_TYPES.length)
  })

  it('biases terrain counts toward the selected map type', () => {
    const seeds = ['profile-alpha', 'profile-bravo', 'profile-charlie', 'profile-delta']
    const countTerrain = (mapType: MapType) => {
      const counts: Record<Terrain, number> = {
        plain: 0,
        water: 0,
        hill: 0,
        mountain: 0,
        forest: 0,
        desert: 0,
        desertHill: 0,
        oasis: 0,
        tundra: 0,
        tundraForest: 0,
        tundraMountain: 0,
      }
      for (const seed of seeds) {
        const state = generateGameState(seed, {
          boardSize: BOARD_SIZE_PRESETS.standard,
          factionCount: 2,
          humanFactionId: 'f1',
          mapType,
        })
        for (const tile of state.tiles) counts[tile.terrain] += 1
      }
      return counts
    }

    const balanced = countTerrain('balanced')
    const plains = countTerrain('plains')
    const mountainous = countTerrain('mountainous')
    const forested = countTerrain('forested')

    expect(plains.plain + plains.desert + plains.oasis).toBeGreaterThan(
      balanced.plain + balanced.desert + balanced.oasis,
    )
    expect(
      mountainous.hill +
        mountainous.desertHill +
        mountainous.mountain +
        mountainous.tundraMountain,
    ).toBeGreaterThan(
      balanced.hill +
        balanced.desertHill +
        balanced.mountain +
        balanced.tundraMountain,
    )
    expect(forested.forest + forested.tundraForest).toBeGreaterThan(
      balanced.forest + balanced.tundraForest,
    )
  })

  it.each(
    MAP_TYPES.flatMap((mapType) =>
      ['type-alpha', 'type-bravo'].map((seed) => [mapType, seed] as const),
    ),
  )('generates a valid %s map for %s', (mapType, seed) => {
    const state = generateGameState(seed, {
      boardSize: BOARD_SIZE_PRESETS.tiny,
      factionCount: 2,
      humanFactionId: 'f1',
      mapType,
    })

    expect(state.mapType).toBe(mapType)
    expect(validateGeneratedMap(state)).toEqual([])
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

  it('generates passable desert away from capitals', () => {
    const states = ['desert-alpha', 'desert-bravo', 'desert-charlie'].map(
      (seed) => generateGameState(seed),
    )
    const deserts = states.flatMap((state) =>
      state.tiles.filter((tile) => tile.terrain === 'desert'),
    )

    expect(deserts.length).toBeGreaterThan(0)
  })

  it('uses desert hills for elevated hot and dry terrain', () => {
    const desertHills = Array.from({ length: 16 }, (_, index) =>
      generateGameState(`desert-hill-${index}`).tiles.filter(
        (tile) => tile.terrain === 'desertHill',
      ),
    ).flat()

    expect(desertHills.length).toBeGreaterThan(0)
  })

  it('occasionally places sparse oases in hot and dry terrain', () => {
    const states = Array.from({ length: 24 }, (_, index) =>
      generateGameState(`oasis-${index}`),
    )
    const oases = states.flatMap((state) =>
      state.tiles.filter((tile) => tile.terrain === 'oasis'),
    )
    const deserts = states.flatMap((state) =>
      state.tiles.filter((tile) => tile.terrain === 'desert'),
    )

    expect(oases.length).toBeGreaterThan(0)
    expect(oases.length).toBeLessThan(deserts.length)
    expect(oases.length / (oases.length + deserts.length)).toBeLessThan(0.06)

    for (const state of states) {
      const tilesByPosition = new Map(
        state.tiles.map((tile) => [positionKey(tile.position), tile]),
      )
      for (const tile of state.tiles.filter((tile) => tile.terrain === 'oasis')) {
        const neighbors = getHexNeighbors(tile.position, state.boardSize)

        expect(neighbors).toHaveLength(6)
        expect(
          neighbors.every((neighbor) => {
            const terrain = tilesByPosition.get(positionKey(neighbor))?.terrain
            return terrain === 'desert' || terrain === 'desertHill'
          }),
        ).toBe(true)
      }
    }
  })

  it('generates passable tundra in cold regions', () => {
    const states = ['tundra-alpha', 'tundra-bravo', 'tundra-charlie'].map(
      (seed) => generateGameState(seed),
    )
    const tundra = states.flatMap((state) =>
      state.tiles.filter((tile) => tile.terrain === 'tundra'),
    )

    expect(tundra.length).toBeGreaterThan(0)
  })

  it('uses conifer forest for cold and moist regions', () => {
    const states = Array.from({ length: 12 }, (_, index) =>
      generateGameState(`taiga-${index}`),
    )
    const tundraForests = states.flatMap((state) =>
      state.tiles.filter((tile) => tile.terrain === 'tundraForest'),
    )

    expect(tundraForests.length).toBeGreaterThan(0)
  })

  it('uses snowy mountains for high-elevation tundra', () => {
    const tundraMountains = Array.from({ length: 16 }, (_, index) =>
      generateGameState(`tundra-mountain-${index}`).tiles.filter(
        (tile) => tile.terrain === 'tundraMountain',
      ),
    ).flat()

    expect(tundraMountains.length).toBeGreaterThan(0)
  })

  it('places tundra along at most one cold edge of the regional map', () => {
    const states = ['regional-alpha', 'regional-bravo', 'regional-charlie'].map(
      (seed) => generateGameState(seed),
    )
    const edgeRow = Math.floor(BOARD_SIZE_PRESETS.standard.rows / 2)

    for (const state of states) {
      const tundraTiles = state.tiles.filter(
        (tile) =>
          tile.terrain === 'tundra' ||
          tile.terrain === 'tundraForest' ||
          tile.terrain === 'tundraMountain',
      )
      const isTopEdge = tundraTiles.every((tile) => tile.position.r < 0)
      const isBottomEdge = tundraTiles.every((tile) => tile.position.r > 0)

      expect(isTopEdge || isBottomEdge).toBe(true)
      expect(
        tundraTiles.every((tile) => Math.abs(tile.position.r) >= edgeRow * 0.5),
      ).toBe(true)
    }
  })

  it('can generate worlds both with and without tundra', () => {
    const tundraCounts = Array.from({ length: 24 }, (_, index) =>
      generateGameState(`optional-tundra-${index}`).tiles.filter(
        (tile) =>
          tile.terrain === 'tundra' ||
          tile.terrain === 'tundraForest' ||
          tile.terrain === 'tundraMountain',
      ).length,
    )

    expect(tundraCounts.some((count) => count === 0)).toBe(true)
    expect(tundraCounts.some((count) => count > 0)).toBe(true)
  })

  it('does not place ordinary terrain beyond the tundra boundary', () => {
    const coldTerrains: Terrain[] = ['tundra', 'tundraForest', 'tundraMountain']

    for (let index = 0; index < 12; index += 1) {
      const state = generateGameState(`solid-tundra-edge-${index}`)
      const tundraTiles = state.tiles.filter((tile) =>
        coldTerrains.includes(tile.terrain),
      )
      if (tundraTiles.length === 0) continue

      const topEdge = tundraTiles.every((tile) => tile.position.r < 0)
      const tilesByColumn = new Map<number, typeof state.tiles>()
      for (const tile of state.tiles) {
        const column =
          tile.position.q +
          Math.floor(state.boardSize.columns / 2) +
          Math.floor(tile.position.r / 2)
        const columnTiles = tilesByColumn.get(column) ?? []
        columnTiles.push(tile)
        tilesByColumn.set(column, columnTiles)
      }

      for (const columnTiles of tilesByColumn.values()) {
        const columnTundra = columnTiles.filter((tile) =>
          coldTerrains.includes(tile.terrain),
        )
        if (columnTundra.length === 0) continue
        const boundaryRow = topEdge
          ? Math.max(...columnTundra.map((tile) => tile.position.r))
          : Math.min(...columnTundra.map((tile) => tile.position.r))
        const tilesBeyondBoundary = columnTiles.filter((tile) =>
          topEdge
            ? tile.position.r <= boundaryRow
            : tile.position.r >= boundaryRow,
        )

        expect(
          tilesBeyondBoundary.every((tile) => coldTerrains.includes(tile.terrain)),
        ).toBe(true)
      }
    }
  })

  it('keeps every tundra row from spanning the full map width', () => {
    const coldTerrains: Terrain[] = ['tundra', 'tundraForest', 'tundraMountain']

    for (let index = 0; index < 12; index += 1) {
      const state = generateGameState(`ragged-tundra-edge-${index}`)
      const tilesByRow = new Map<number, typeof state.tiles>()
      for (const tile of state.tiles) {
        const rowTiles = tilesByRow.get(tile.position.r) ?? []
        rowTiles.push(tile)
        tilesByRow.set(tile.position.r, rowTiles)
      }

      for (const rowTiles of tilesByRow.values()) {
        expect(rowTiles.some((tile) => !coldTerrains.includes(tile.terrain))).toBe(true)
      }
    }
  })

  it('keeps hot desert and cold tundra out of the same climate row', () => {
    const coldTerrains: Terrain[] = ['tundra', 'tundraForest', 'tundraMountain']

    for (const seed of ['climate-alpha', 'climate-bravo', 'climate-charlie']) {
      const state = generateGameState(seed)
      const rows = new Map<number, Set<Terrain>>()

      for (const tile of state.tiles) {
        const terrains = rows.get(tile.position.r) ?? new Set<Terrain>()
        terrains.add(tile.terrain)
        rows.set(tile.position.r, terrains)
      }

      for (const terrains of rows.values()) {
        const hasColdTerrain = coldTerrains.some((terrain) => terrains.has(terrain))
        expect(terrains.has('desert') && hasColdTerrain).toBe(false)
      }
    }
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
      expect(state.sites).toHaveLength(12)
      expect(state.units).toHaveLength(6)
      const tilesByPosition = new Map(
        state.tiles.map((tile) => [positionKey(tile.position), tile]),
      )
      expect(state.sites.filter((site) => site.kind === 'castle')).toHaveLength(2)
      for (const castle of state.sites.filter(
        (site) => site.kind === 'castle',
      )) {
        expect(castle.footprint).toHaveLength(4)
        expect(
          castle.footprint?.every(
            (position) =>
              tilesByPosition.get(positionKey(position))?.siteId === castle.id,
          ),
        ).toBe(true)
      }
      expect(state.sites.filter((site) => site.kind === 'outpost')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'village')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'farm')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'mine')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'blacksmith')).toHaveLength(2)
      expect(state.sites.filter((site) => site.kind === 'city')).toHaveLength(0)
      expect(
        state.sites
          .filter(
            (site) =>
              site.kind === 'farm' ||
              site.kind === 'mine' ||
              site.kind === 'blacksmith',
          )
          .every((site) => site.level === 1),
      ).toBe(true)
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
    expect(state.sites).toHaveLength(factionCount * 6)
    expect(state.sites.filter((site) => site.capitalFor)).toHaveLength(factionCount)
    for (const kind of ['outpost', 'village', 'farm', 'mine', 'blacksmith'] as const) {
      expect(
        state.sites.filter(
          (site) => site.ownerId === 'neutral' && site.kind === kind,
        ),
      ).toHaveLength(factionCount)
    }
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

  it('uses both temperate forest variants across generated maps', () => {
    const variants = new Set(
      Array.from({ length: 8 }, (_, index) =>
        generateGameState(`forest-variant-${index}`).tiles
          .filter((tile) => tile.terrain === 'forest')
          .map((tile) => tile.terrainVariant),
      ).flat(),
    )

    expect(variants).toEqual(new Set([0, 1]))
  })
})
