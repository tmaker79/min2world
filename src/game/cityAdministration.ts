import {
  BUILDING_DEFINITIONS,
  hasBuilding,
  TAVERN_HEALING,
  TEMPLE_HEALING,
  WALL_MAX_HP_BONUS,
} from './cityBuildings'
import { positionKey } from './hex'
import { getFactionAdjustedCost } from './playerEconomy'
import { getSiteOccupiedPositions } from './siteFootprint'
import { canSpendWithUpkeepReserve } from './upkeep'
import type { BuildingId, FactionId, GameState, Site } from './types'

export type { BuildingDefinition } from './cityBuildings'
export {
  BUILDING_CATEGORY_LABELS,
  BUILDING_DEFINITIONS,
  BUILDING_IDS,
  getBarracksProductionDiscount,
  getBuildingIncomeBonus,
  getFactionLibraryDiscount,
  hasBuilding,
  MAX_LIBRARY_DISCOUNT,
  MAX_PRODUCTION_DISCOUNT,
  TAVERN_HEALING,
  TEMPLE_HEALING,
  WALL_DEFENSE_BONUS,
  WALL_MAX_HP_BONUS,
} from './cityBuildings'

export type ConstructionFailure =
  | 'siteNotFound'
  | 'notCity'
  | 'notOwned'
  | 'inactiveFaction'
  | 'notPlaying'
  | 'alreadyBuilt'
  | 'alreadyQueued'
  | 'queueOccupied'
  | 'insufficientResources'
  | 'insufficientUpkeepReserve'

export type ConstructionCheck =
  | { ok: true; cost: number; turns: number }
  | { ok: false; reason: ConstructionFailure }

export function getBuildingConstructionCost(
  state: GameState,
  factionId: FactionId,
  buildingId: BuildingId,
): number {
  return getFactionAdjustedCost(
    state,
    factionId,
    BUILDING_DEFINITIONS[buildingId].cost,
  )
}

export function canStartConstruction(
  state: GameState,
  siteId: string,
  buildingId: BuildingId,
): ConstructionCheck {
  const site = state.sites.find((candidate) => candidate.id === siteId)
  if (!site) return { ok: false, reason: 'siteNotFound' }
  if (site.kind !== 'city') return { ok: false, reason: 'notCity' }
  if (site.ownerId === 'neutral') return { ok: false, reason: 'notOwned' }
  if (site.ownerId !== state.activeFactionId) {
    return { ok: false, reason: 'inactiveFaction' }
  }
  if (state.phase !== 'playing') return { ok: false, reason: 'notPlaying' }
  if (hasBuilding(site, buildingId)) {
    return { ok: false, reason: 'alreadyBuilt' }
  }
  if (site.constructionQueue?.buildingId === buildingId) {
    return { ok: false, reason: 'alreadyQueued' }
  }
  if (site.constructionQueue) return { ok: false, reason: 'queueOccupied' }

  const definition = BUILDING_DEFINITIONS[buildingId]
  const cost = getBuildingConstructionCost(state, site.ownerId, buildingId)
  const spending = canSpendWithUpkeepReserve(
    state,
    site.ownerId,
    cost,
  )
  if (!spending.ok) {
    return { ok: false, reason: spending.reason }
  }
  return { ok: true, cost, turns: definition.turns }
}

export function resolveConstructionStart(
  state: GameState,
  siteId: string,
  buildingId: BuildingId,
): GameState {
  const check = canStartConstruction(state, siteId, buildingId)
  if (!check.ok) return state

  return {
    ...state,
    resources: {
      ...state.resources,
      [state.activeFactionId]:
        (state.resources[state.activeFactionId] ?? 0) - check.cost,
    },
    sites: state.sites.map((site) =>
      site.id === siteId
        ? {
            ...site,
            constructionQueue: {
              buildingId,
              turnsRemaining: check.turns,
              startedTurn: state.turn,
            },
          }
        : site,
    ),
  }
}

export function canCancelConstruction(
  state: GameState,
  siteId: string,
): boolean {
  const site = state.sites.find((candidate) => candidate.id === siteId)
  return Boolean(
    state.phase === 'playing' &&
      site?.kind === 'city' &&
      site.ownerId === state.activeFactionId &&
      site.constructionQueue,
  )
}

export function resolveConstructionCancellation(
  state: GameState,
  siteId: string,
): GameState {
  if (!canCancelConstruction(state, siteId)) return state
  return {
    ...state,
    sites: state.sites.map((site) => {
      if (site.id !== siteId) return site
      const { constructionQueue: _queue, ...withoutQueue } = site
      void _queue
      return withoutQueue
    }),
  }
}

function progressConstruction(site: Site, factionId: FactionId): Site {
  if (site.ownerId !== factionId || !site.constructionQueue) return site
  const turnsRemaining = site.constructionQueue.turnsRemaining - 1
  if (turnsRemaining > 0) {
    return {
      ...site,
      constructionQueue: { ...site.constructionQueue, turnsRemaining },
    }
  }

  const buildingId = site.constructionQueue.buildingId
  const { constructionQueue: _queue, ...withoutQueue } = site
  void _queue
  return {
    ...withoutQueue,
    buildings: [...site.buildings, buildingId],
    ...(buildingId === 'wall'
      ? {
          hp: Math.min(
            (site.maxHp ?? 0) + WALL_MAX_HP_BONUS,
            (site.hp ?? 0) + WALL_MAX_HP_BONUS,
          ),
          maxHp: (site.maxHp ?? 0) + WALL_MAX_HP_BONUS,
        }
      : {}),
  }
}

export function resolveCityTurnStart(
  state: GameState,
  factionId: FactionId,
): Pick<GameState, 'sites' | 'units'> {
  const sites = state.sites.map((site) => progressConstruction(site, factionId))
  const healingCityKeys = new Set(
    sites
      .filter(
        (site) =>
          site.kind === 'city' &&
          site.ownerId === factionId &&
          hasBuilding(site, 'tavern'),
      )
      .flatMap((site) => [...getSiteOccupiedPositions(site)])
      .map(positionKey),
  )

  return {
    sites: sites.map((site) =>
      site.kind === 'city' &&
      site.ownerId === factionId &&
      hasBuilding(site, 'temple')
        ? { ...site, hp: Math.min(site.maxHp ?? 0, (site.hp ?? 0) + TEMPLE_HEALING) }
        : site,
    ),
    units: state.units.map((unit) =>
      unit.factionId === factionId &&
      healingCityKeys.has(positionKey(unit.position))
        ? { ...unit, hp: Math.min(unit.maxHp, unit.hp + TAVERN_HEALING) }
        : unit,
    ),
  }
}
