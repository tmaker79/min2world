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
