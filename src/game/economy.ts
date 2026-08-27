import {
  getBarracksProductionDiscount,
  getBuildingIncomeBonus,
  MAX_PRODUCTION_DISCOUNT,
} from './cityBuildings'
import {
  getSiteLevel,
  isCivilianUnitType,
  isMilitarySiteKind,
  SITE_STATS,
  UNIT_STATS,
} from './gameCatalog'
import { getFactionAdjustedCost } from './playerEconomy'
import type { FactionId, GameState, Site, UnitType } from './types'

export function getSiteIncome(site: Site): number {
  if (isMilitarySiteKind(site.kind)) return 0
  const level = getSiteLevel(site)
  if (site.kind === 'farm' || site.kind === 'blacksmith') return level + 1
  if (site.kind === 'mine') return level + 2
  return SITE_STATS[site.kind].income + getBuildingIncomeBonus(site)
}

export function getFactionIncome(
  state: GameState,
  factionId: FactionId,
): number {
  return state.sites
    .filter((site) => site.ownerId === factionId)
    .reduce((total, site) => total + getSiteIncome(site), 0)
}

export function getBlacksmithProductionDiscount(
  state: GameState,
  factionId: FactionId,
  unitType: UnitType,
): number {
  if (isCivilianUnitType(unitType)) return 0
  const level = Math.max(
    0,
    ...state.sites
      .filter((site) => site.ownerId === factionId && site.kind === 'blacksmith')
      .map(getSiteLevel),
  )
  if (level >= 3) return 2
  if (
    level >= 1 &&
    (unitType === 'infantry' ||
      unitType === 'spearman' ||
      (level >= 2 && unitType === 'archer'))
  ) {
    return 1
  }
  return 0
}

export function getUnitProductionCost(
  state: GameState,
  factionId: FactionId,
  unitType: UnitType,
  site?: Site,
): number {
  const discount = Math.min(
    MAX_PRODUCTION_DISCOUNT,
    getBlacksmithProductionDiscount(state, factionId, unitType) +
      getBarracksProductionDiscount(site, unitType),
  )
  return getFactionAdjustedCost(
    state,
    factionId,
    Math.max(1, UNIT_STATS[unitType].cost - discount),
  )
}
