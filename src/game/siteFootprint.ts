import { isPositionOnBoard, positionKey } from './hex'
import type { BoardSize, Position, Site, Tile } from './types'

export const CITY_FOOTPRINT_OFFSETS: readonly (readonly Position[])[] = [
  [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: -1 },
    { q: 1, r: -1 },
  ],
  [
    { q: 0, r: 0 },
    { q: 0, r: -1 },
    { q: -1, r: -1 },
    { q: -1, r: 0 },
  ],
  [
    { q: 0, r: 0 },
    { q: -1, r: 0 },
    { q: -2, r: 1 },
    { q: -1, r: 1 },
  ],
  [
    { q: 0, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
    { q: 1, r: 0 },
  ],
]

const TOWN_FOOTPRINT_OFFSETS: readonly (readonly Position[])[] = [
  [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: -1 },
  ],
  [
    { q: 0, r: 0 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
  ],
]

function applyOffsets(anchor: Position, offsets: readonly Position[]): Position[] {
  return offsets.map((offset) => ({
    q: anchor.q + offset.q,
    r: anchor.r + offset.r,
  }))
}

function matchesFootprint(
  anchor: Position,
  footprint: readonly Position[],
  offsets: readonly (readonly Position[])[],
): boolean {
  const footprintKeys = new Set(footprint.map(positionKey))
  return offsets.some((candidateOffsets) =>
    applyOffsets(anchor, candidateOffsets).every((position) =>
      footprintKeys.has(positionKey(position)),
    ),
  )
}

export function getSiteOccupiedPositions(site: Site): readonly Position[] {
  return site.footprint ?? [site.position]
}

export function getTownFootprintCandidates(
  anchor: Position,
  boardSize: BoardSize,
): Position[][] {
  return TOWN_FOOTPRINT_OFFSETS.map((offsets) => applyOffsets(anchor, offsets)).filter(
    (positions) => positions.every((position) => isPositionOnBoard(position, boardSize)),
  )
}

export function getCityFootprintCandidates(
  anchor: Position,
  boardSize: BoardSize,
  townFootprint?: readonly Position[],
): Position[][] {
  const townKeys = townFootprint
    ? new Set(townFootprint.map(positionKey))
    : undefined
  return CITY_FOOTPRINT_OFFSETS.map((offsets) => applyOffsets(anchor, offsets)).filter(
    (positions) =>
      positions.every((position) => isPositionOnBoard(position, boardSize)) &&
      (!townKeys ||
        [...townKeys].every((key) =>
          positions.some((position) => positionKey(position) === key),
        )),
  )
}

export function findCityFootprint(
  anchor: Position,
  boardSize: BoardSize,
): Position[] | undefined {
  return getCityFootprintCandidates(anchor, boardSize)[0]
}

export function isValidTownFootprint(
  anchor: Position,
  footprint: readonly Position[],
  boardSize: BoardSize,
): boolean {
  return (
    footprint.length === 3 &&
    new Set(footprint.map(positionKey)).size === footprint.length &&
    footprint.every((position) => isPositionOnBoard(position, boardSize)) &&
    matchesFootprint(anchor, footprint, TOWN_FOOTPRINT_OFFSETS)
  )
}

export function isValidCityFootprint(
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

  return matchesFootprint(anchor, footprint, CITY_FOOTPRINT_OFFSETS)
}

export function updateSiteFootprintTiles(
  tiles: readonly Tile[],
  siteId: string,
  previousFootprint: readonly Position[],
  nextFootprint: readonly Position[],
): Tile[] {
  const previousKeys = new Set(previousFootprint.map(positionKey))
  const nextKeys = new Set(nextFootprint.map(positionKey))
  let changed = false
  const nextTiles = tiles.map((tile) => {
    const key = positionKey(tile.position)
    if (nextKeys.has(key) && tile.siteId !== siteId) {
      changed = true
      return { ...tile, siteId }
    }
    if (previousKeys.has(key) && !nextKeys.has(key) && tile.siteId === siteId) {
      changed = true
      const { siteId: _siteId, ...withoutSite } = tile
      void _siteId
      return withoutSite
    }
    return tile
  })
  return changed ? nextTiles : (tiles as Tile[])
}
