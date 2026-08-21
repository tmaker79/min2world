import { isPositionOnBoard, positionKey } from './hex'
import type { BoardSize, Position, Site } from './types'

const CASTLE_FOOTPRINT_OFFSETS: readonly (readonly Position[])[] = [
  [
    { q: 0, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: 1 },
  ],
  [
    { q: 0, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: 1, r: 0 },
  ],
  [
    { q: 0, r: 0 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ],
  [
    { q: 0, r: 0 },
    { q: -1, r: -1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
  ],
]

function applyOffsets(anchor: Position, offsets: readonly Position[]): Position[] {
  return offsets.map((offset) => ({
    q: anchor.q + offset.q,
    r: anchor.r + offset.r,
  }))
}

export function getSiteOccupiedPositions(site: Site): readonly Position[] {
  return site.footprint ?? [site.position]
}

export function findCastleFootprint(
  anchor: Position,
  boardSize: BoardSize,
): Position[] | undefined {
  return CASTLE_FOOTPRINT_OFFSETS
    .map((offsets) => applyOffsets(anchor, offsets))
    .find((positions) =>
      positions.every((position) => isPositionOnBoard(position, boardSize)),
    )
}

export function isValidCastleFootprint(
  anchor: Position,
  footprint: readonly Position[],
  boardSize: BoardSize,
): boolean {
  if (
    footprint.length !== 4 ||
    new Set(footprint.map(positionKey)).size !== footprint.length ||
    footprint.some((position) => !isPositionOnBoard(position, boardSize))
  ) {
    return false
  }

  const footprintKeys = new Set(footprint.map(positionKey))
  return CASTLE_FOOTPRINT_OFFSETS.some((offsets) =>
    applyOffsets(anchor, offsets).every((position) =>
      footprintKeys.has(positionKey(position)),
    ),
  )
}
