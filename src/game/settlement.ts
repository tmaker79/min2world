import { getHexDistance, getHexNeighbors, positionKey } from './hex'
import { getFactionAdjustedCost } from './playerEconomy'
import {
  getSiteAt,
  getSiteMaxHp,
  getTileAt,
  SITE_TYPE_LABELS,
  TERRAIN_MOVEMENT_COST,
} from './rules'
import { getSiteOccupiedPositions } from './siteFootprint'
import {
  createTerritoryIndex,
  getTerritoryOwnerAt,
  type TerritoryIndex,
} from './territory'
import { canSpendWithUpkeepReserve } from './upkeep'
import type {
  BuildableSiteType,
  CivilianUnitType,
  FactionId,
  GameState,
  Position,
  Site,
  Terrain,
} from './types'

export const BUILDABLE_SITE_TYPES: readonly BuildableSiteType[] = [
  'outpost',
  'farm',
  'mine',
  'blacksmith',
]

export const SITE_CONSTRUCTION_COSTS: Record<BuildableSiteType, number> = {
  outpost: 10,
  farm: 6,
  mine: 8,
  blacksmith: 10,
}

export function getSiteConstructionCost(
  state: GameState,
  factionId: FactionId,
  siteKind: BuildableSiteType,
): number {
  return getFactionAdjustedCost(
    state,
    factionId,
    SITE_CONSTRUCTION_COSTS[siteKind],
  )
}

const IMPASSABLE_TERRAINS = new Set<Terrain>([
  'water',
  'mountain',
  'tundraMountain',
])
const MOUNTAIN_TERRAINS = new Set<Terrain>(['mountain', 'tundraMountain'])
const HILL_TERRAINS = new Set<Terrain>(['hill', 'desertHill'])
const CONSTRUCTION_ANCHORS = new Set([
  'town',
  'city',
  'keep',
  'stronghold',
])
const TERRITORY_RESTRICTED_SITE_TYPES = new Set<BuildableSiteType>([
  'farm',
  'mine',
  'blacksmith',
])

function isBuildableLand(terrain: Terrain) {
  return terrain !== 'bridge' && !IMPASSABLE_TERRAINS.has(terrain)
}

function isConnectionTerrain(terrain: Terrain) {
  return TERRAIN_MOVEMENT_COST[terrain] !== null
}

function isFarEnoughFromSites(
  state: GameState,
  position: Position,
  minimumDistance: number,
) {
  return state.sites.every((site) =>
    getSiteOccupiedPositions(site).every(
      (occupied) => getHexDistance(position, occupied) >= minimumDistance,
    ),
  )
}

function isMineTerrain(state: GameState, position: Position, terrain: Terrain) {
  if (HILL_TERRAINS.has(terrain)) return true
  if (!isBuildableLand(terrain)) return false
  return getHexNeighbors(position, state.boardSize).some((neighbor) => {
    const tile = getTileAt(state, neighbor)
    return Boolean(tile && MOUNTAIN_TERRAINS.has(tile.terrain))
  })
}

export function getOwnedAnchorGraphDistance(
  state: GameState,
  factionId: FactionId,
  destination: Position,
) {
  const destinationKey = positionKey(destination)
  const tilesByKey = new Map(
    state.tiles.map((tile) => [positionKey(tile.position), tile]),
  )
  const frontier = state.sites
    .filter(
      (site) =>
        site.ownerId === factionId && CONSTRUCTION_ANCHORS.has(site.kind),
    )
    .flatMap((site) => [...getSiteOccupiedPositions(site)])
    .map((position) => ({ position, distance: 0 }))
  const visited = new Set(frontier.map(({ position }) => positionKey(position)))
  let index = 0

  while (index < frontier.length) {
    const current = frontier[index]
    index += 1
    if (positionKey(current.position) === destinationKey) return current.distance
    if (current.distance >= 3) continue

    for (const neighbor of getHexNeighbors(current.position, state.boardSize)) {
      const key = positionKey(neighbor)
      if (visited.has(key)) continue
      const tile = tilesByKey.get(key)
      if (!tile || !isConnectionTerrain(tile.terrain)) continue
      visited.add(key)
      frontier.push({ position: neighbor, distance: current.distance + 1 })
    }
  }
  return undefined
}

export type SitePlacementFailure =
  | 'tileNotFound'
  | 'invalidTerrain'
  | 'siteOccupied'
  | 'tooCloseToSite'
  | 'notConnected'
  | 'outsideTerritory'

export type SitePlacementCheck =
  | { ok: true }
  | { ok: false; reason: SitePlacementFailure }

export function canSettleAt(
  state: GameState,
  _factionId: FactionId,
  position: Position,
): SitePlacementCheck {
  const tile = state.tiles.find(
    (candidate) => positionKey(candidate.position) === positionKey(position),
  )
  if (!tile) return { ok: false, reason: 'tileNotFound' }
  if (!isBuildableLand(tile.terrain)) {
    return { ok: false, reason: 'invalidTerrain' }
  }
  if (getSiteAt(state, position)) return { ok: false, reason: 'siteOccupied' }
  if (!isFarEnoughFromSites(state, position, 4)) {
    return { ok: false, reason: 'tooCloseToSite' }
  }
  return { ok: true }
}

export function canConstructAt(
  state: GameState,
  factionId: FactionId,
  position: Position,
  siteKind: BuildableSiteType,
  territory: TerritoryIndex = createTerritoryIndex(state),
): SitePlacementCheck {
  const tile = state.tiles.find(
    (candidate) => positionKey(candidate.position) === positionKey(position),
  )
  if (!tile) return { ok: false, reason: 'tileNotFound' }
  const terrainAllowed =
    siteKind === 'farm'
      ? tile.terrain === 'plain'
      : siteKind === 'mine'
        ? isMineTerrain(state, position, tile.terrain)
        : isBuildableLand(tile.terrain)
  if (!terrainAllowed) return { ok: false, reason: 'invalidTerrain' }
  if (getSiteAt(state, position)) return { ok: false, reason: 'siteOccupied' }
  if (!isFarEnoughFromSites(state, position, 2)) {
    return { ok: false, reason: 'tooCloseToSite' }
  }
  if (getOwnedAnchorGraphDistance(state, factionId, position) === undefined) {
    return { ok: false, reason: 'notConnected' }
  }
  if (
    TERRITORY_RESTRICTED_SITE_TYPES.has(siteKind) &&
    getTerritoryOwnerAt(territory, position) !== factionId
  ) {
    return { ok: false, reason: 'outsideTerritory' }
  }
  return { ok: true }
}

export function getSettleablePositions(
  state: GameState,
  factionId: FactionId,
) {
  return state.tiles
    .filter((tile) => canSettleAt(state, factionId, tile.position).ok)
    .map((tile) => tile.position)
}

export function getConstructiblePositions(
  state: GameState,
  factionId: FactionId,
  siteKind: BuildableSiteType,
  territory: TerritoryIndex = createTerritoryIndex(state),
) {
  return state.tiles
    .filter(
      (tile) =>
        canConstructAt(
          state,
          factionId,
          tile.position,
          siteKind,
          territory,
        ).ok,
    )
    .map((tile) => tile.position)
}

export type SiteActionFailure =
  | SitePlacementFailure
  | 'unitNotFound'
  | 'wrongUnitType'
  | 'notSelected'
  | 'inactiveFaction'
  | 'notPlaying'
  | 'alreadyActed'
  | 'insufficientResources'
  | 'insufficientUpkeepReserve'

export type SettlementActionCheck =
  | { ok: true }
  | { ok: false; reason: SiteActionFailure }

export type ConstructionActionCheck =
  | { ok: true; cost: number }
  | { ok: false; reason: SiteActionFailure }

function checkCivilianAction(
  state: GameState,
  unitId: string,
  expectedType: CivilianUnitType,
): { ok: true; unit: GameState['units'][number] } | { ok: false; reason: SiteActionFailure } {
  const unit = state.units.find((candidate) => candidate.id === unitId)
  if (!unit) return { ok: false, reason: 'unitNotFound' }
  if (unit.type !== expectedType) return { ok: false, reason: 'wrongUnitType' }
  if (state.selectedUnitId !== unit.id) return { ok: false, reason: 'notSelected' }
  if (unit.factionId !== state.activeFactionId) {
    return { ok: false, reason: 'inactiveFaction' }
  }
  if (state.phase !== 'playing') return { ok: false, reason: 'notPlaying' }
  if (unit.hasActed) return { ok: false, reason: 'alreadyActed' }
  return { ok: true, unit }
}

export function canSettle(
  state: GameState,
  unitId: string,
): SettlementActionCheck {
  const unitCheck = checkCivilianAction(state, unitId, 'settler')
  if (!unitCheck.ok) return unitCheck
  return canSettleAt(state, unitCheck.unit.factionId, unitCheck.unit.position)
}

export function canConstruct(
  state: GameState,
  unitId: string,
  siteKind: BuildableSiteType,
): ConstructionActionCheck {
  const unitCheck = checkCivilianAction(state, unitId, 'builder')
  if (!unitCheck.ok) return unitCheck
  const placement = canConstructAt(
    state,
    unitCheck.unit.factionId,
    unitCheck.unit.position,
    siteKind,
  )
  if (!placement.ok) return placement
  const cost = getSiteConstructionCost(
    state,
    unitCheck.unit.factionId,
    siteKind,
  )
  const spending = canSpendWithUpkeepReserve(
    state,
    unitCheck.unit.factionId,
    cost,
  )
  return spending.ok
    ? { ok: true, cost }
    : { ok: false, reason: spending.reason }
}

function getFoundedSequence(state: GameState, factionId: FactionId) {
  let sequence = 1
  while (
    state.sites.some(
      (site) => site.id === `${factionId}-founded-${sequence}`,
    )
  ) {
    sequence += 1
  }
  return sequence
}

function createFoundedSite(
  state: GameState,
  factionId: FactionId,
  position: Position,
  kind: 'village' | BuildableSiteType,
): Site {
  const sequence = getFoundedSequence(state, factionId)
  const maxHp = kind === 'outpost' ? getSiteMaxHp(kind) : undefined
  return {
    id: `${factionId}-founded-${sequence}`,
    name: `${SITE_TYPE_LABELS[kind]} ${sequence}`,
    kind,
    position: { ...position },
    ownerId: factionId,
    foundedBy: factionId,
    buildings: [],
    lastDevelopedTurn: state.turn,
    ...(kind === 'farm' || kind === 'mine' || kind === 'blacksmith'
      ? { level: 1 as const }
      : {}),
    ...(kind === 'outpost' && maxHp !== undefined
      ? { hp: maxHp, maxHp, lastProducedTurn: state.turn }
      : {}),
  }
}

function attachSiteToTile(
  state: GameState,
  position: Position,
  siteId: string,
) {
  const key = positionKey(position)
  return state.tiles.map((tile) =>
    positionKey(tile.position) === key ? { ...tile, siteId } : tile,
  )
}

export function resolveSiteSettlement(
  state: GameState,
  unitId: string,
): GameState {
  const check = canSettle(state, unitId)
  if (!check.ok) return state
  const unit = state.units.find((candidate) => candidate.id === unitId)!
  const site = createFoundedSite(
    state,
    unit.factionId,
    unit.position,
    'village',
  )
  return {
    ...state,
    selectedUnitId: undefined,
    units: state.units.filter((candidate) => candidate.id !== unit.id),
    sites: [...state.sites, site],
    tiles: attachSiteToTile(state, unit.position, site.id),
  }
}

export function resolveSiteConstruction(
  state: GameState,
  unitId: string,
  siteKind: BuildableSiteType,
): GameState {
  const check = canConstruct(state, unitId, siteKind)
  if (!check.ok) return state
  const unit = state.units.find((candidate) => candidate.id === unitId)!
  const site = createFoundedSite(
    state,
    unit.factionId,
    unit.position,
    siteKind,
  )
  return {
    ...state,
    selectedUnitId: undefined,
    resources: {
      ...state.resources,
      [unit.factionId]: (state.resources[unit.factionId] ?? 0) - check.cost,
    },
    units: state.units.map((candidate) =>
      candidate.id === unit.id
        ? { ...candidate, movementRemaining: 0, hasActed: true }
        : candidate,
    ),
    sites: [...state.sites, site],
    tiles: attachSiteToTile(state, unit.position, site.id),
  }
}
