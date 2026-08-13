import { getReachablePositions, positionsEqual } from './rules'
import type { GameAction, GameState } from './types'

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'unitSelected': {
      const unit = state.units.find((candidate) => candidate.id === action.unitId)

      if (!unit || unit.factionId !== state.activeFactionId || unit.hasActed) {
        return state
      }

      return {
        ...state,
        selectedUnitId:
          state.selectedUnitId === action.unitId ? undefined : action.unitId,
      }
    }

    case 'selectionCleared':
      return state.selectedUnitId ? { ...state, selectedUnitId: undefined } : state

    case 'unitMoved': {
      if (state.selectedUnitId !== action.unitId) {
        return state
      }

      const unit = state.units.find((candidate) => candidate.id === action.unitId)
      if (!unit || unit.factionId !== state.activeFactionId || unit.hasActed) {
        return state
      }

      const canMove = getReachablePositions(state, unit).some((position) =>
        positionsEqual(position, action.destination),
      )

      if (!canMove) {
        return state
      }

      return {
        ...state,
        selectedUnitId: undefined,
        units: state.units.map((candidate) =>
          candidate.id === action.unitId
            ? {
                ...candidate,
                position: { ...action.destination },
                hasActed: true,
              }
            : candidate,
        ),
      }
    }

    case 'turnEnded':
      return {
        ...state,
        turn: state.turn + 1,
        selectedUnitId: undefined,
        units: state.units.map((unit) =>
          unit.factionId === 'player' && unit.hasActed
            ? { ...unit, hasActed: false }
            : unit,
        ),
      }
  }
}
