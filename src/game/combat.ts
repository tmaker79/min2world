import {
  getSiteCombatStats,
  getSiteMaxHp,
  isCivilianUnitType,
  isFortifiedSite,
  TERRAIN_COMBAT_BONUS,
  UNIT_STATS,
} from './gameCatalog'
import { getHexDistance } from './hex'
import { getSiteAt, getTileAt } from './queries'
import { getSiteOccupiedPositions } from './siteFootprint'
import type { GameState, Site, Unit, UnitType } from './types'

export function getAttackableUnits(state: GameState, unit: Unit): Unit[] {
  if (
    state.phase !== 'playing' ||
    unit.hasActed ||
    unit.factionId !== state.activeFactionId ||
    isCivilianUnitType(unit.type)
  ) {
    return []
  }

  return state.units.filter(
    (candidate) =>
      candidate.factionId !== unit.factionId &&
      getHexDistance(unit.position, candidate.position) <=
        UNIT_STATS[unit.type].range &&
      !isUnitGarrisonedInFortifiedSite(state, candidate),
  )
}

// Units garrisoned on their own fortified site (military sites and cities)
// are shielded until the site itself is captured, so attackers must besiege
// the site first.
export function isUnitGarrisonedInFortifiedSite(
  state: GameState,
  unit: Unit,
): boolean {
  const site = getSiteAt(state, unit.position)
  return Boolean(
    site && isFortifiedSite(site) && site.ownerId === unit.factionId,
  )
}

export function getAttackableSites(state: GameState, unit: Unit): Site[] {
  if (
    state.phase !== 'playing' ||
    unit.hasActed ||
    unit.factionId !== state.activeFactionId ||
    isCivilianUnitType(unit.type)
  ) {
    return []
  }

  const range = UNIT_STATS[unit.type].range
  return state.sites.filter(
    (site) =>
      isFortifiedSite(site) &&
      site.ownerId !== unit.factionId &&
      getSiteOccupiedPositions(site).some(
        (position) => getHexDistance(unit.position, position) <= range,
      ),
  )
}

export type CombatResult = {
  attackerHp: number
  defenderHp: number
}

export const COMBAT_DAMAGE_BASE = 30
export const COMBAT_DAMAGE_EXPONENT = 0.04
export const HEALTH_STRENGTH_LOSS_PER_MISSING_HP = 0.1

export function getMatchupBonus(strikerType: UnitType, targetType: UnitType) {
  if (strikerType === 'infantry' && targetType === 'spearman') return 5
  if (strikerType === 'spearman' && targetType === 'cavalry') return 10
  return 0
}

function getHealthStrengthPenalty(hp: number, maxHp: number) {
  if (hp >= maxHp) return 0
  return (
    -HEALTH_STRENGTH_LOSS_PER_MISSING_HP *
    (100 - (hp / maxHp) * 100)
  )
}

export function getHealthCombatPenalty(unit: Unit) {
  return getHealthStrengthPenalty(unit.hp, unit.maxHp)
}

export function getDisplayedCombatStrength(unit: Unit, stat: 'melee' | 'ranged') {
  return UNIT_STATS[unit.type][stat] + getHealthCombatPenalty(unit)
}

export function getCombatStrength(
  state: GameState,
  striker: Unit,
  target: Unit,
  mode: 'attack' | 'counter',
) {
  const stats = UNIT_STATS[striker.type]
  const terrain = getTileAt(state, striker.position)?.terrain ?? 'plain'
  const base =
    mode === 'attack' && striker.type === 'archer' ? stats.ranged : stats.melee
  const matchup =
    mode === 'attack' && striker.type === 'archer'
      ? 0
      : getMatchupBonus(striker.type, target.type)

  return base + matchup + TERRAIN_COMBAT_BONUS[terrain] + getHealthCombatPenalty(striker)
}

export function getCombatDamage(
  strikerStrength: number,
  targetStrength: number,
) {
  const difference = strikerStrength - targetStrength
  return Math.max(
    1,
    Math.round(COMBAT_DAMAGE_BASE * Math.exp(COMBAT_DAMAGE_EXPONENT * difference)),
  )
}

export function resolveCombat(
  state: GameState,
  attacker: Unit,
  defender: Unit,
): CombatResult {
  const attackerStrength = getCombatStrength(state, attacker, defender, 'attack')
  const defenderStrength = getCombatStrength(state, defender, attacker, 'counter')
  const damageToDefender = getCombatDamage(attackerStrength, defenderStrength)
  // Melee exchanges apply both sides' damage at once from pre-combat strength.
  // Archer attacks stay one-way (no return damage).
  const damageToAttacker =
    attacker.type === 'archer' || isCivilianUnitType(defender.type)
      ? 0
      : getCombatDamage(defenderStrength, attackerStrength)

  return {
    attackerHp: Math.max(0, attacker.hp - damageToAttacker),
    defenderHp: Math.max(0, defender.hp - damageToDefender),
  }
}

export type SiteCombatResult = {
  siteHp: number
}

export function resolveSiteCombat(
  state: GameState,
  attacker: Unit,
  site: Site,
): SiteCombatResult {
  const siteStats = getSiteCombatStats(site)
  if (!siteStats) {
    return { siteHp: site.hp ?? 0 }
  }
  if (isCivilianUnitType(attacker.type)) {
    return { siteHp: site.hp ?? siteStats.maxHp }
  }

  const attackerStats = UNIT_STATS[attacker.type]
  const attackerStrength =
    (attacker.type === 'archer'
      ? attackerStats.ranged
      : attackerStats.melee) +
    getHealthCombatPenalty(attacker)
  const maxHp = getSiteMaxHp(site) ?? siteStats.maxHp
  const currentHp = site.hp ?? maxHp
  const siteTerrain = getTileAt(state, site.position)?.terrain ?? 'plain'
  const siteStrength =
    siteStats.defense +
    TERRAIN_COMBAT_BONUS[siteTerrain] +
    getHealthStrengthPenalty(currentHp, maxHp)
  const damage = getCombatDamage(attackerStrength, siteStrength)

  return { siteHp: Math.max(0, currentHp - damage) }
}
