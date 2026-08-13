import { describe, expect, it } from 'vitest'
import {
  getAllHexPositions,
  getHexDistance,
  getHexLine,
  getHexNeighbors,
  getOppositeBoardPosition,
  getHexPixelPosition,
  isPositionOnBoard,
  positionKey,
} from './hex'

describe('hex coordinates', () => {
  it('creates a square 12 by 12 board with 144 unique cells', () => {
    const positions = getAllHexPositions()

    expect(positions).toHaveLength(144)
    expect(new Set(positions.map(positionKey))).toHaveLength(144)
    expect(positions.every((position) => isPositionOnBoard(position))).toBe(true)
    const rowCounts = new Map<number, number>()
    positions.forEach(({ r }) => rowCounts.set(r, (rowCounts.get(r) ?? 0) + 1))
    expect([...rowCounts.values()]).toEqual(Array(12).fill(12))
    expect(
      positions.every((position) =>
        isPositionOnBoard(getOppositeBoardPosition(position)),
      ),
    ).toBe(true)
  })

  it('returns six neighbors at the center and clips board-edge neighbors', () => {
    expect(getHexNeighbors({ q: 0, r: 0 })).toHaveLength(6)
    expect(getHexNeighbors({ q: 5, r: 0 }).length).toBeLessThan(6)
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
})
