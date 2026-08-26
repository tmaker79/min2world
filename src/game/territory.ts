import { getHexDistance, positionKey } from './hex'
import type {
  FactionId,
  GameState,
  Position,
  Site,
  SiteType,
} from './types'

export type TerritoryOwner = FactionId | 'contested'
export type TerritoryIndex = ReadonlyMap<string, TerritoryOwner>

export const TERRITORY_RADIUS_BY_SITE_KIND: Readonly<
  Partial<Record<SiteType, 1 | 2 | 3>>
> = {
  village: 1,
  outpost: 1,
  town: 2,
  keep: 2,
  city: 3,
  stronghold: 3,
}

export function getSiteTerritoryRadius(site: Site): 0 | 1 | 2 | 3 {
  if (site.ownerId === 'neutral') return 0
  return TERRITORY_RADIUS_BY_SITE_KIND[site.kind] ?? 0
}

export function createTerritoryIndex(
  state: Pick<GameState, 'sites' | 'tiles'>,
): TerritoryIndex {
  const sources = state.sites.flatMap((site) => {
    const radius = getSiteTerritoryRadius(site)
    return radius > 0 && site.ownerId !== 'neutral'
      ? [{ position: site.position, ownerId: site.ownerId, radius }]
      : []
  })
  const territory = new Map<string, TerritoryOwner>()

  for (const tile of state.tiles) {
    let nearestDistance = Number.POSITIVE_INFINITY
    const nearestOwners = new Set<FactionId>()

    for (const source of sources) {
      const distance = getHexDistance(tile.position, source.position)
      if (distance > source.radius || distance > nearestDistance) continue
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestOwners.clear()
      }
      nearestOwners.add(source.ownerId)
    }

    if (nearestOwners.size === 1) {
      territory.set(positionKey(tile.position), [...nearestOwners][0])
    } else if (nearestOwners.size > 1) {
      territory.set(positionKey(tile.position), 'contested')
    }
  }

  return territory
}

export function getTerritoryOwnerAt(
  territory: TerritoryIndex,
  position: Position,
): TerritoryOwner | undefined {
  return territory.get(positionKey(position))
}
