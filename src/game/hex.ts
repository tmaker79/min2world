import type { Position } from './types'

export const HEX_COLUMNS = 24
export const HEX_ROWS = 16
export const HEX_TILE_COUNT = HEX_COLUMNS * HEX_ROWS
export const HEX_WIDTH = 58
export const HEX_HEIGHT = 66
export const HEX_ROW_STEP = HEX_HEIGHT * 0.75

const CENTER_COLUMN = Math.floor(HEX_COLUMNS / 2)
const CENTER_ROW = Math.floor(HEX_ROWS / 2)

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

export function isPositionOnBoard(position: Position): boolean {
  const row = position.r + CENTER_ROW
  const column = position.q + CENTER_COLUMN + Math.floor(position.r / 2)
  return row >= 0 && row < HEX_ROWS && column >= 0 && column < HEX_COLUMNS
}

export function getHexNeighbors(position: Position): Position[] {
  return HEX_DIRECTIONS.map((direction) => ({
    q: position.q + direction.q,
    r: position.r + direction.r,
  })).filter((candidate) => isPositionOnBoard(candidate))
}

export function getAllHexPositions(): Position[] {
  const positions: Position[] = []

  for (let row = 0; row < HEX_ROWS; row += 1) {
    const r = row - CENTER_ROW
    for (let column = 0; column < HEX_COLUMNS; column += 1) {
      positions.push({
        q: column - CENTER_COLUMN - Math.floor(r / 2),
        r,
      })
    }
  }

  return positions
}

export function getOppositeBoardPosition(position: Position): Position {
  const row = position.r + CENTER_ROW
  const column = position.q + CENTER_COLUMN + Math.floor(position.r / 2)
  const oppositeRow = HEX_ROWS - 1 - row
  const oppositeColumn = HEX_COLUMNS - 1 - column
  const r = oppositeRow - CENTER_ROW

  return {
    q: oppositeColumn - CENTER_COLUMN - Math.floor(r / 2),
    r,
  }
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
