import { hasBuilding, WALL_DEFENSE_BONUS } from './cityBuildings'
import type {
  CivilianUnitType,
  MilitaryUnitType,
  Site,
  SiteCombatStats,
  SiteStats,
  SiteType,
  Terrain,
  UnitStats,
  UnitType,
} from './types'

export const UNIT_MAX_HP = 100

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: { movement: 2, melee: 45, ranged: 0, range: 1, cost: 10 },
  spearman: { movement: 2, melee: 45, ranged: 0, range: 1, cost: 13 },
  archer: { movement: 2, melee: 30, ranged: 40, range: 2, cost: 15 },
  cavalry: { movement: 4, melee: 50, ranged: 0, range: 1, cost: 18 },
  settler: { movement: 2, melee: 0, ranged: 0, range: 0, cost: 30 },
  builder: { movement: 2, melee: 0, ranged: 0, range: 0, cost: 15 },
}

export const MILITARY_UNIT_TYPES: readonly MilitaryUnitType[] = [
  'infantry',
  'cavalry',
  'archer',
  'spearman',
]
export const CIVILIAN_UNIT_TYPES: readonly CivilianUnitType[] = [
  'settler',
  'builder',
]
export const UNIT_TYPES: readonly UnitType[] = [
  ...MILITARY_UNIT_TYPES,
  ...CIVILIAN_UNIT_TYPES,
]

export function isMilitaryUnitType(type: UnitType): type is MilitaryUnitType {
  return MILITARY_UNIT_TYPES.includes(type as MilitaryUnitType)
}

export function isCivilianUnitType(type: UnitType): type is CivilianUnitType {
  return CIVILIAN_UNIT_TYPES.includes(type as CivilianUnitType)
}

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  infantry: '보병',
  cavalry: '기병',
  archer: '궁병',
  spearman: '창병',
  settler: '개척자',
  builder: '건설자',
}

export const SITE_STATS: Record<SiteType, SiteStats> = {
  outpost: { income: 0, canProduce: false },
  keep: { income: 0, canProduce: false },
  stronghold: { income: 0, canProduce: false },
  village: { income: 3, canProduce: false },
  town: { income: 5, canProduce: false },
  city: { income: 7, canProduce: true },
  farm: { income: 2, canProduce: false },
  mine: { income: 3, canProduce: false },
  blacksmith: { income: 2, canProduce: false },
}

export type FortifiedSiteKind = 'outpost' | 'keep' | 'stronghold' | 'city'
export type MilitarySiteKind = 'outpost' | 'keep' | 'stronghold'

export function isMilitarySiteKind(kind: SiteType): kind is MilitarySiteKind {
  return kind === 'outpost' || kind === 'keep' || kind === 'stronghold'
}

export const SITE_COMBAT_STATS: Record<FortifiedSiteKind, SiteCombatStats> = {
  outpost: { maxHp: 50, defense: 35 },
  keep: { maxHp: 75, defense: 42 },
  stronghold: { maxHp: 100, defense: 50 },
  city: { maxHp: 120, defense: 55 },
}

export function isFortifiedSiteKind(
  kind: SiteType,
): kind is FortifiedSiteKind {
  return kind in SITE_COMBAT_STATS
}

export function isFortifiedSite(
  site: Site,
): site is Site & { kind: FortifiedSiteKind } {
  return isFortifiedSiteKind(site.kind)
}

export function getSiteCombatStats(
  siteOrKind: Site | SiteType,
): SiteCombatStats | undefined {
  const kind = typeof siteOrKind === 'string' ? siteOrKind : siteOrKind.kind
  if (!isFortifiedSiteKind(kind)) return undefined
  const stats = SITE_COMBAT_STATS[kind]
  return typeof siteOrKind !== 'string' && hasBuilding(siteOrKind, 'wall')
    ? { ...stats, maxHp: siteOrKind.maxHp ?? stats.maxHp, defense: stats.defense + WALL_DEFENSE_BONUS }
    : stats
}

export function getSiteMaxHp(siteOrKind: Site | SiteType): number | undefined {
  const stats = getSiteCombatStats(siteOrKind)
  if (!stats) return undefined
  return typeof siteOrKind !== 'string' && siteOrKind.maxHp !== undefined
    ? siteOrKind.maxHp
    : stats.maxHp
}

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  outpost: '전초기지',
  keep: '요새',
  stronghold: '성채',
  village: '마을',
  town: '소도시',
  farm: '농장',
  mine: '광산',
  city: '도시',
  blacksmith: '대장간',
}

const PRODUCIBLE_UNIT_TYPES: Record<SiteType, readonly UnitType[]> = {
  outpost: [],
  keep: [],
  stronghold: [],
  village: [],
  town: [],
  city: UNIT_TYPES,
  farm: [],
  mine: [],
  blacksmith: [],
}

export function getSiteLevel(site: Site): 1 | 2 | 3 {
  return site.level ?? 1
}

export function getProducibleUnitTypes(site: Site): readonly UnitType[] {
  return PRODUCIBLE_UNIT_TYPES[site.kind]
}

export function canSiteProduceUnit(site: Site, unitType: UnitType): boolean {
  return getProducibleUnitTypes(site).includes(unitType)
}

export const TERRAIN_MOVEMENT_COST: Record<Terrain, number | null> = {
  plain: 1,
  bridge: 1,
  mountain: null,
  water: null,
  hill: 2,
  forest: 2,
  desert: 2,
  desertHill: 2,
  oasis: 1,
  tundra: 2,
  tundraForest: 2,
  tundraMountain: null,
}

export const TERRAIN_COMBAT_BONUS: Record<Terrain, number> = {
  plain: 0,
  bridge: 0,
  mountain: 0,
  water: 0,
  hill: 3,
  forest: 3,
  desert: 0,
  desertHill: 3,
  oasis: 0,
  tundra: 0,
  tundraForest: 3,
  tundraMountain: 0,
}

export const TERRAIN_LABELS: Record<Terrain, string> = {
  plain: '평지',
  bridge: '다리',
  mountain: '산',
  water: '물',
  hill: '언덕',
  forest: '숲',
  desert: '사막',
  desertHill: '사막 언덕',
  oasis: '오아시스',
  tundra: '툰드라',
  tundraForest: '툰드라 숲',
  tundraMountain: '툰드라 산',
}
