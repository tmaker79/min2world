import type { BoardSize, Position } from './types'

export const BOARD_SIZE_PRESETS = {
  tiny: { columns: 15, rows: 11 },
  small: { columns: 21, rows: 14 },
  standard: { columns: 42, rows: 28 },
  large: { columns: 84, rows: 56 },
} as const satisfies Record<string, BoardSize>
export const DEFAULT_BOARD_SIZE: BoardSize = BOARD_SIZE_PRESETS.standard
/** @deprecated Use DEFAULT_BOARD_SIZE.columns. */
export const HEX_COLUMNS = DEFAULT_BOARD_SIZE.columns
/** @deprecated Use DEFAULT_BOARD_SIZE.rows. */
export const HEX_ROWS = DEFAULT_BOARD_SIZE.rows
/** @deprecated Use DEFAULT_BOARD_SIZE and getAllHexPositions(size). */
export const HEX_TILE_COUNT = HEX_COLUMNS * HEX_ROWS
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

function getBoardCenter(size: BoardSize) {
  return {
    column: Math.floor(size.columns / 2),
    row: Math.floor(size.rows / 2),
  }
}

export function isPositionOnBoard(
  position: Position,
  size: BoardSize = DEFAULT_BOARD_SIZE,
): boolean {
  const center = getBoardCenter(size)
  const row = position.r + center.row
  const column = position.q + center.column + Math.floor(position.r / 2)
  return row >= 0 && row < size.rows && column >= 0 && column < size.columns
}

export function getHexNeighbors(
  position: Position,
  size: BoardSize = DEFAULT_BOARD_SIZE,
): Position[] {
  return HEX_DIRECTIONS.map((direction) => ({
    q: position.q + direction.q,
    r: position.r + direction.r,
  })).filter((candidate) => isPositionOnBoard(candidate, size))
}

export function getAllHexPositions(size: BoardSize = DEFAULT_BOARD_SIZE): Position[] {
  const positions: Position[] = []
  const center = getBoardCenter(size)

  for (let row = 0; row < size.rows; row += 1) {
    const r = row - center.row
    for (let column = 0; column < size.columns; column += 1) {
      positions.push({
        q: column - center.column - Math.floor(r / 2),
        r,
      })
    }
  }

  return positions
}

export function getOppositeBoardPosition(
  position: Position,
  size: BoardSize = DEFAULT_BOARD_SIZE,
): Position {
  const center = getBoardCenter(size)
  const row = position.r + center.row
  const column = position.q + center.column + Math.floor(position.r / 2)
  const oppositeRow = size.rows - 1 - row
  const oppositeColumn = size.columns - 1 - column
  const r = oppositeRow - center.row

  return {
    q: oppositeColumn - center.column - Math.floor(r / 2),
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
