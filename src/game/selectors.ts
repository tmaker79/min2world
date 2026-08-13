import { getReachablePositions } from './rules'
import type { GameState } from './types'

export function getSelectedUnit(state: GameState) {
  return state.units.find((unit) => unit.id === state.selectedUnitId)
}

export function getSelectedUnitReachablePositions(state: GameState) {
  const selectedUnit = getSelectedUnit(state)
  return selectedUnit ? getReachablePositions(state, selectedUnit) : []
}

