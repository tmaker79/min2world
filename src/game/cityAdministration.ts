import { positionKey } from './hex'
import { getSiteOccupiedPositions } from './siteFootprint'
import type {
  BuildingId,
  FactionId,
  GameState,
  Site,
  UnitType,
} from './types'

export type BuildingDefinition = {
  id: BuildingId
  label: string
  category: 'economy' | 'military' | 'civic'
  cost: number
  turns: number
  effect: string
}

export const BUILDING_IDS: readonly BuildingId[] = [
  'granary',
  'market',
  'wall',
  'barracks',
  'tavern',
  'temple',
  'library',
]

export const BUILDING_DEFINITIONS: Record<BuildingId, BuildingDefinition> = {
  granary: {
    id: 'granary',
    label: '곡창',
    category: 'economy',
    cost: 15,
    turns: 1,
    effect: '도시 수입 +1',
  },
  market: {
    id: 'market',
    label: '시장',
    category: 'economy',
    cost: 25,
    turns: 2,
    effect: '도시 수입 +2',
  },
  wall: {
    id: 'wall',
    label: '성벽',
    category: 'military',
    cost: 25,
    turns: 2,
    effect: '도시 최대 HP +30 · 방어력 +5',
  },
  barracks: {
    id: 'barracks',
    label: '병영',
    category: 'military',
    cost: 20,
    turns: 2,
    effect: '이 도시의 보병·창병 생산비 -2',
  },
  tavern: {
    id: 'tavern',
    label: '선술집',
    category: 'civic',
    cost: 18,
    turns: 1,
    effect: '턴 시작에 도시 안 아군 HP +10',
  },
  temple: {
    id: 'temple',
    label: '신전',
    category: 'civic',
    cost: 22,
    turns: 2,
    effect: '턴 시작에 도시 HP +10',
  },
  library: {
    id: 'library',
    label: '도서관',
    category: 'civic',
    cost: 25,
    turns: 3,
    effect: '세력 거점 개발비 -1 · 최대 -3',
  },
}

export const BUILDING_CATEGORY_LABELS: Record<
  BuildingDefinition['category'],
  string
> = {
  economy: '경제',
  military: '군사',
  civic: '도시',
}

export const WALL_MAX_HP_BONUS = 30
export const WALL_DEFENSE_BONUS = 5
export const TAVERN_HEALING = 10
export const TEMPLE_HEALING = 10
export const MAX_PRODUCTION_DISCOUNT = 3
export const MAX_LIBRARY_DISCOUNT = 3

export function hasBuilding(
  site: Pick<Site, 'buildings'>,
  buildingId: BuildingId,
): boolean {
  return site.buildings.includes(buildingId)
}

export function getBuildingIncomeBonus(site: Site): number {
  if (site.kind !== 'city') return 0
  return Number(hasBuilding(site, 'granary')) +
    Number(hasBuilding(site, 'market')) * 2
}

export function getBarracksProductionDiscount(
  site: Site | undefined,
  unitType: UnitType,
): number {
  return site?.kind === 'city' &&
    hasBuilding(site, 'barracks') &&
    (unitType === 'infantry' || unitType === 'spearman')
    ? 2
    : 0
}

export function getFactionLibraryDiscount(
  state: GameState,
  factionId: FactionId,
): number {
  return Math.min(
    MAX_LIBRARY_DISCOUNT,
    state.sites.filter(
      (site) =>
        site.ownerId === factionId &&
        site.kind === 'city' &&
        hasBuilding(site, 'library'),
    ).length,
  )
}

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

export type ConstructionCheck =
  | { ok: true; cost: number; turns: number }
  | { ok: false; reason: ConstructionFailure }

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
  if ((state.resources[site.ownerId] ?? 0) < definition.cost) {
    return { ok: false, reason: 'insufficientResources' }
  }
  return { ok: true, cost: definition.cost, turns: definition.turns }
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
