import { getHexNeighbors, positionKey } from './hex'
import { getSiteOccupiedPositions } from './siteFootprint'
import type { FactionId, GameState, Position, Site, Tile, Unit } from './types'

type TileIndex = ReadonlyMap<string, Tile>
type UnitIndex = ReadonlyMap<string, Unit>
type SiteIndex = ReadonlyMap<string, Site>

const tileIndexCache = new WeakMap<Tile[], TileIndex>()
const unitPositionIndexCache = new WeakMap<Unit[], UnitIndex>()
const unitIdIndexCache = new WeakMap<Unit[], UnitIndex>()
const sitePositionIndexCache = new WeakMap<Site[], SiteIndex>()
const siteIdIndexCache = new WeakMap<Site[], SiteIndex>()
const zoneOfControlCache = new WeakMap<
  Unit[],
  WeakMap<Site[], Map<FactionId, ReadonlyMap<string, Position>>>
>()

function getOrCreateIndex<T extends { position: Position }>(
  items: T[],
  cache: WeakMap<T[], ReadonlyMap<string, T>>,
) {
  const cached = cache.get(items)
  if (cached) return cached

  const index = new Map(items.map((item) => [positionKey(item.position), item]))
  cache.set(items, index)
  return index
}

function getOrCreateIdIndex<T extends { id: string }>(
  items: T[],
  cache: WeakMap<T[], ReadonlyMap<string, T>>,
) {
  const cached = cache.get(items)
  if (cached) return cached

  const index = new Map(items.map((item) => [item.id, item]))
  cache.set(items, index)
  return index
}

export function getTileIndex(state: GameState): TileIndex {
  return getOrCreateIndex(state.tiles, tileIndexCache)
}

export function getUnitPositionIndex(state: GameState): UnitIndex {
  return getOrCreateIndex(state.units, unitPositionIndexCache)
}

export function getUnitIdIndex(state: GameState): UnitIndex {
  return getOrCreateIdIndex(state.units, unitIdIndexCache)
}

export function getSitePositionIndex(state: GameState): SiteIndex {
  const cached = sitePositionIndexCache.get(state.sites)
  if (cached) return cached

  const index = new Map<string, Site>()
  for (const site of state.sites) {
    for (const position of getSiteOccupiedPositions(site)) {
      index.set(positionKey(position), site)
    }
  }
  sitePositionIndexCache.set(state.sites, index)
  return index
}

export function getSiteIdIndex(state: GameState): SiteIndex {
  return getOrCreateIdIndex(state.sites, siteIdIndexCache)
}

export function getZoneOfControlIndex(
  state: GameState,
  factionId: FactionId,
): ReadonlyMap<string, Position> {
  let siteCaches = zoneOfControlCache.get(state.units)
  if (!siteCaches) {
    siteCaches = new WeakMap()
    zoneOfControlCache.set(state.units, siteCaches)
  }

  let cached = siteCaches.get(state.sites)
  if (!cached) {
    const zones = new Map<FactionId, Map<string, Position>>(
      state.factionOrder.map((id) => [id, new Map()]),
    )

    for (const unit of state.units) {
      for (const affectedFactionId of state.factionOrder) {
        if (affectedFactionId === unit.factionId) continue
        const zone = zones.get(affectedFactionId)!
        for (const position of getHexNeighbors(unit.position, state.boardSize)) {
          zone.set(positionKey(position), position)
        }
      }
    }

    for (const site of state.sites) {
      if (
        site.ownerId === 'neutral' ||
        (site.kind !== 'outpost' &&
          site.kind !== 'keep' &&
          site.kind !== 'stronghold' &&
          site.kind !== 'castle')
      ) {
        continue
      }
      for (const affectedFactionId of state.factionOrder) {
        if (affectedFactionId === site.ownerId) continue
        const zone = zones.get(affectedFactionId)!
        for (const occupiedPosition of getSiteOccupiedPositions(site)) {
          for (const position of getHexNeighbors(
            occupiedPosition,
            state.boardSize,
          )) {
            zone.set(positionKey(position), position)
          }
        }
      }
    }

    cached = zones
    siteCaches.set(state.sites, cached)
  }

  return cached.get(factionId) ?? new Map()
}
