import {
  getAttackableSites,
  getAttackableUnits,
  getEnemyZoneOfControlPositions,
  getReachablePositionCosts,
  getReachablePositions,
} from './rules'
import { BUILDABLE_SITE_TYPES, canConstruct, canSettle } from './settlement'
import type { GameState, Unit } from './types'

export function getActionablePlayerUnits(state: GameState): Set<Unit> {
  const actionable = new Set<Unit>()
  if (state.phase !== 'playing' || state.activeFactionId !== state.humanFactionId) return actionable

  for (const unit of state.units) {
    if (unit.factionId !== state.humanFactionId || unit.hasActed) continue
    if (
      (unit.movementRemaining > 0 && getReachablePositionCosts(state, unit).size > 0) ||
      getAttackableUnits(state, unit).length > 0 ||
      getAttackableSites(state, unit).length > 0
    ) {
      actionable.add(unit)
      continue
    }
    if (state.gameMode !== 'standard' || (unit.type !== 'settler' && unit.type !== 'builder')) continue
    // Civilian commands check selection as well as terrain, ownership and cost.
    const selected = { ...state, selectedUnitId: unit.id }
    const canFound = unit.type === 'settler'
      ? canSettle(selected, unit.id).ok
      : BUILDABLE_SITE_TYPES.some((kind) => canConstruct(selected, unit.id, kind).ok)
    if (canFound) actionable.add(unit)
  }
  return actionable
}

export function getSelectedUnit(state: GameState) {
  return state.units.find((unit) => unit.id === state.selectedUnitId)
}

export function getSelectedUnitReachablePositions(state: GameState) {
  const selectedUnit = getSelectedUnit(state)
  return selectedUnit ? getReachablePositions(state, selectedUnit) : []
}

export function getSelectedUnitAttackableUnits(state: GameState) {
  const selectedUnit = getSelectedUnit(state)
  return selectedUnit ? getAttackableUnits(state, selectedUnit) : []
}

export function getSelectedUnitAttackableSites(state: GameState) {
  const selectedUnit = getSelectedUnit(state)
  return selectedUnit ? getAttackableSites(state, selectedUnit) : []
}

export function getSelectedUnitEnemyZoneOfControlPositions(state: GameState) {
  const selectedUnit = getSelectedUnit(state)
  return selectedUnit
    ? getEnemyZoneOfControlPositions(state, selectedUnit.factionId)
    : []
}
