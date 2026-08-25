import { getFactionIncome } from './rules'
import type { FactionId, GameState, UnitType } from './types'

export const UNIT_UPKEEP: Record<UnitType, number> = {
  infantry: 1,
  spearman: 1,
  archer: 1,
  cavalry: 2,
  settler: 1,
  builder: 1,
}

export function getFactionUpkeep(
  state: GameState,
  factionId: FactionId,
): number {
  return state.units
    .filter((unit) => unit.factionId === factionId)
    .reduce((total, unit) => total + UNIT_UPKEEP[unit.type], 0)
}

export function getFactionNetIncome(
  state: GameState,
  factionId: FactionId,
): number {
  return getFactionIncome(state, factionId) - getFactionUpkeep(state, factionId)
}

export function getFactionUpkeepReserve(
  state: GameState,
  factionId: FactionId,
): number {
  return Math.max(0, -getFactionNetIncome(state, factionId))
}

export type EconomyProjection = {
  incomeDelta?: number
  upkeepDelta?: number
}

export function getProjectedUpkeepReserve(
  state: GameState,
  factionId: FactionId,
  projection: EconomyProjection = {},
): number {
  const income = getFactionIncome(state, factionId) +
    (projection.incomeDelta ?? 0)
  const upkeep = getFactionUpkeep(state, factionId) +
    (projection.upkeepDelta ?? 0)
  return Math.max(0, upkeep - income)
}

export type SpendingFailure =
  | 'insufficientResources'
  | 'insufficientUpkeepReserve'

export type SpendingCheck =
  | { ok: true; reserve: number }
  | { ok: false; reason: SpendingFailure; reserve: number }

export function canSpendWithUpkeepReserve(
  state: GameState,
  factionId: FactionId,
  cost: number,
  projection: EconomyProjection = {},
): SpendingCheck {
  const resources = state.resources[factionId] ?? 0
  const reserve = getProjectedUpkeepReserve(state, factionId, projection)
  if (resources < cost) {
    return { ok: false, reason: 'insufficientResources', reserve }
  }
  if (resources - cost < reserve) {
    return { ok: false, reason: 'insufficientUpkeepReserve', reserve }
  }
  return { ok: true, reserve }
}
