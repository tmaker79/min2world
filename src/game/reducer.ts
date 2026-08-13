import { createInitialGameState } from './initialState'
import {
  captureCityAt,
  getAttackableUnits,
  getMovementCost,
  isPositionInEnemyZoneOfControl,
  ownsAllCities,
  resolveCombat,
  UNIT_STATS,
} from './rules'
import type { GameAction, GameState } from './types'

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'gameRestarted') {
    return createInitialGameState()
  }

  if (state.phase !== 'playing') {
    return state
  }

  switch (action.type) {
    case 'unitSelected': {
      const unit = state.units.find((candidate) => candidate.id === action.unitId)

      if (!unit || unit.factionId !== state.activeFactionId) {
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

      const movementCost = getMovementCost(state, unit, action.destination)

      if (movementCost === undefined) {
        return state
      }

      const movementAfterCost = unit.movementRemaining - movementCost
      const stoppedByZoneOfControl =
        movementAfterCost > 0 &&
        isPositionInEnemyZoneOfControl(
          state,
          unit.factionId,
          action.destination,
        )
      const movementRemaining = stoppedByZoneOfControl
        ? 0
        : movementAfterCost

      const cities = captureCityAt(
        state.cities,
        action.destination,
        unit.factionId,
      )

      return {
        ...state,
        phase: ownsAllCities(cities, 'player') ? 'victory' : state.phase,
        selectedUnitId: unit.id,
        cities,
        units: state.units.map((candidate) =>
          candidate.id === action.unitId
            ? {
                ...candidate,
                position: { ...action.destination },
                movementRemaining,
                hasActed: movementRemaining === 0 && !stoppedByZoneOfControl,
              }
            : candidate,
        ),
      }
    }

    case 'unitAttacked': {
      if (state.selectedUnitId !== action.attackerId) {
        return state
      }

      const attacker = state.units.find(
        (unit) => unit.id === action.attackerId,
      )
      const defender = state.units.find(
        (unit) => unit.id === action.defenderId,
      )

      if (
        !attacker ||
        !defender ||
        attacker.hasActed ||
        attacker.factionId !== state.activeFactionId ||
        defender.factionId === attacker.factionId ||
        !getAttackableUnits(state, attacker).some(
          (unit) => unit.id === defender.id,
        )
      ) {
        return state
      }

      const result = resolveCombat(attacker, defender)
      const units = state.units.flatMap((unit) => {
        if (unit.id === attacker.id) {
          return result.attackerHp > 0
            ? [
                {
                  ...unit,
                  hp: result.attackerHp,
                  movementRemaining: 0,
                  hasActed: true,
                },
              ]
            : []
        }

        if (unit.id === defender.id) {
          return result.defenderHp > 0
            ? [{ ...unit, hp: result.defenderHp }]
            : []
        }

        return [unit]
      })

      return {
        ...state,
        selectedUnitId: undefined,
        units,
      }
    }

    case 'turnEnded':
      return {
        ...state,
        turn: state.turn + 1,
        selectedUnitId: undefined,
        units: state.units.map((unit) =>
          unit.factionId === 'player'
            ? {
                ...unit,
                movementRemaining: UNIT_STATS[unit.type].movement,
                hasActed: false,
              }
            : unit,
        ),
      }
  }
}
