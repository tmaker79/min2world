import { describe, expect, it } from 'vitest'
import {
  getAllHexPositions,
  getHexDistance,
  getHexLine,
  getHexNeighbors,
  getHexPixelPosition,
  isPositionOnBoard,
  positionKey,
} from './hex'

describe('hex coordinates', () => {
  it('creates the 91 unique cells of a radius-5 board', () => {
    const positions = getAllHexPositions()

    expect(positions).toHaveLength(91)
    expect(new Set(positions.map(positionKey))).toHaveLength(91)
    expect(positions.every((position) => isPositionOnBoard(position))).toBe(true)
  })

  it('returns six neighbors at the center and clips board-edge neighbors', () => {
    expect(getHexNeighbors({ q: 0, r: 0 })).toHaveLength(6)
    expect(getHexNeighbors({ q: 5, r: 0 })).toHaveLength(3)
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
