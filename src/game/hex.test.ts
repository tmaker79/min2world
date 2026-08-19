import { describe, expect, it } from 'vitest'
import { getTerrainVariantIndex } from '../components/TerrainIcon'
import {
  getAllHexPositions,
  getHexDistance,
  getHexLine,
  getHexNeighbors,
  getOppositeBoardPosition,
  getHexPixelPosition,
  HEX_COLUMNS,
  HEX_ROWS,
  HEX_TILE_COUNT,
  isPositionOnBoard,
  positionKey,
} from './hex'

describe('hex coordinates', () => {
  it(`creates a ${HEX_COLUMNS} by ${HEX_ROWS} board with ${HEX_TILE_COUNT} unique cells`, () => {
    const positions = getAllHexPositions()

    expect(positions).toHaveLength(HEX_TILE_COUNT)
    expect(new Set(positions.map(positionKey))).toHaveLength(HEX_TILE_COUNT)
    expect(positions.every((position) => isPositionOnBoard(position))).toBe(true)
    const rowCounts = new Map<number, number>()
    positions.forEach(({ r }) => rowCounts.set(r, (rowCounts.get(r) ?? 0) + 1))
    expect([...rowCounts.values()]).toEqual(Array(HEX_ROWS).fill(HEX_COLUMNS))
    expect(
      positions.every((position) =>
        isPositionOnBoard(getOppositeBoardPosition(position)),
      ),
    ).toBe(true)
  })

  it('returns six neighbors at the center and clips board-edge neighbors', () => {
    expect(getHexNeighbors({ q: 0, r: 0 })).toHaveLength(6)
    const edge = getAllHexPositions().find(
      (position) => getHexNeighbors(position).length < 6,
    )
    expect(edge).toBeDefined()
    expect(getHexNeighbors(edge!).length).toBeLessThan(6)
  })

  it('uses axial hex distance and creates an inclusive straight line', () => {
    expect(getHexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2)
    expect(getHexDistance({ q: -4, r: 0 }, { q: 4, r: 0 })).toBe(8)

    const line = getHexLine({ q: -2, r: 0 }, { q: 2, r: 0 })
    expect(line).toHaveLength(5)
    expect(line[0]).toEqual({ q: -2, r: 0 })
    expect(line.at(-1)).toEqual({ q: 2, r: 0 })
  })

  it('maps all six screen directions to distinct pointy-hex positions', () => {
    const center = getHexPixelPosition({ q: 0, r: 0 })
    const neighbors = getHexNeighbors({ q: 0, r: 0 }).map((position) => {
      const pixel = getHexPixelPosition(position)
      return `${Math.sign(pixel.x - center.x)},${Math.sign(pixel.y - center.y)}`
    })

    expect(new Set(neighbors)).toHaveLength(6)
  })

  it('picks a stable terrain icon variant from hex coordinates and seed', () => {
    expect(getTerrainVariantIndex({ q: 1, r: -2 }, 7, 'seed-a')).toBe(
      getTerrainVariantIndex({ q: 1, r: -2 }, 7, 'seed-a'),
    )
    expect(getTerrainVariantIndex({ q: 1, r: -2 }, 7, 'seed-a')).not.toBe(
      getTerrainVariantIndex({ q: 1, r: -2 }, 7, 'seed-b'),
    )
    const variants = new Set(
      Array.from({ length: 24 }, (_, index) =>
        getTerrainVariantIndex({ q: index - 12, r: 1 }, 4, 'map'),
      ),
    )
    expect(variants.size).toBeGreaterThan(1)
  })

  it('does not alternate two terrain variants in a fixed coordinate pattern', () => {
    const variants = Array.from({ length: 29 }, (_, index) =>
      getTerrainVariantIndex({ q: index - 14, r: 3 }, 2, 'tundra-map'),
    )

    expect(
      variants.some((variant, index) => index > 0 && variant === variants[index - 1]),
    ).toBe(true)
    expect(
      variants.some((variant, index) => index > 1 && variant !== variants[index - 2]),
    ).toBe(true)
  })
})
