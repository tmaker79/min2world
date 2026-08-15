import { getHexNeighbors, positionKey } from './hex'
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
  Record<FactionId, ReadonlyMap<string, Position>>
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
  return getOrCreateIndex(state.sites, sitePositionIndexCache)
}

export function getSiteIdIndex(state: GameState): SiteIndex {
  return getOrCreateIdIndex(state.sites, siteIdIndexCache)
}

export function getZoneOfControlIndex(
  state: GameState,
  factionId: FactionId,
): ReadonlyMap<string, Position> {
  let cached = zoneOfControlCache.get(state.units)
  if (!cached) {
    const player = new Map<string, Position>()
    const enemy = new Map<string, Position>()

    for (const unit of state.units) {
      const affectedFaction = unit.factionId === 'player' ? enemy : player
      for (const position of getHexNeighbors(unit.position)) {
        affectedFaction.set(positionKey(position), position)
      }
    }

    cached = { player, enemy }
    zoneOfControlCache.set(state.units, cached)
  }

  return cached[factionId]
}
