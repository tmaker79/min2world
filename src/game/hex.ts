import type { Position } from './types'

export const HEX_RADIUS = 5
export const HEX_TILE_COUNT = 1 + 3 * HEX_RADIUS * (HEX_RADIUS + 1)
export const HEX_WIDTH = 58
export const HEX_HEIGHT = 66
export const HEX_ROW_STEP = HEX_HEIGHT * 0.75

export const HEX_DIRECTIONS: readonly Position[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function positionKey(position: Position): string {
  return `${position.q},${position.r}`
}

export function positionsEqual(left: Position, right: Position): boolean {
  return left.q === right.q && left.r === right.r
}

export function getHexDistance(left: Position, right: Position): number {
  const dq = left.q - right.q
  const dr = left.r - right.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

export function isPositionOnBoard(
  position: Position,
  radius = HEX_RADIUS,
): boolean {
  return getHexDistance({ q: 0, r: 0 }, position) <= radius
}

export function getHexNeighbors(
  position: Position,
  radius = HEX_RADIUS,
): Position[] {
  return HEX_DIRECTIONS.map((direction) => ({
    q: position.q + direction.q,
    r: position.r + direction.r,
  })).filter((candidate) => isPositionOnBoard(candidate, radius))
}

export function getAllHexPositions(radius = HEX_RADIUS): Position[] {
  const positions: Position[] = []

  for (let r = -radius; r <= radius; r += 1) {
    const minimumQ = Math.max(-radius, -r - radius)
    const maximumQ = Math.min(radius, -r + radius)

    for (let q = minimumQ; q <= maximumQ; q += 1) {
      positions.push({ q, r })
    }
  }

  return positions
}

function cubeRound(q: number, r: number): Position {
  const s = -q - r
  let roundedQ = Math.round(q)
  let roundedR = Math.round(r)
  let roundedS = Math.round(s)
  const qDifference = Math.abs(roundedQ - q)
  const rDifference = Math.abs(roundedR - r)
  const sDifference = Math.abs(roundedS - s)

  if (qDifference > rDifference && qDifference > sDifference) {
    roundedQ = -roundedR - roundedS
  } else if (rDifference > sDifference) {
    roundedR = -roundedQ - roundedS
  } else {
    roundedS = -roundedQ - roundedR
  }

  void roundedS
  return { q: roundedQ, r: roundedR }
}

export function getHexLine(start: Position, end: Position): Position[] {
  const distance = getHexDistance(start, end)
  if (distance === 0) {
    return [{ ...start }]
  }

  return Array.from({ length: distance + 1 }, (_, index) => {
    const amount = index / distance
    return cubeRound(
      start.q + (end.q - start.q) * amount,
      start.r + (end.r - start.r) * amount,
    )
  })
}

export function getHexPixelPosition(position: Position): {
  x: number
  y: number
} {
  return {
    x: HEX_WIDTH * (position.q + position.r / 2),
    y: HEX_ROW_STEP * position.r,
  }
}
