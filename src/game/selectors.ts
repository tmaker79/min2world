import {
  getAttackableUnits,
  getEnemyZoneOfControlPositions,
  getReachablePositions,
} from './rules'
import type { GameState } from './types'

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

export function getSelectedUnitEnemyZoneOfControlPositions(state: GameState) {
  const selectedUnit = getSelectedUnit(state)
  return selectedUnit
    ? getEnemyZoneOfControlPositions(state, selectedUnit.factionId)
    : []
}
