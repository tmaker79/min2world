import type { GameState } from './types'

export function cloneGameState(
  state: GameState,
  clearSelection = false,
): GameState {
  return {
    schemaVersion: state.schemaVersion,
    turn: state.turn,
    phase: state.phase,
    activeFactionId: state.activeFactionId,
    selectedUnitId: clearSelection ? undefined : state.selectedUnitId,
    resources: { ...state.resources },
    tiles: state.tiles.map((tile) => ({
      ...tile,
      position: { ...tile.position },
    })),
    units: state.units.map((unit) => ({
      ...unit,
      position: { ...unit.position },
    })),
    cities: state.cities.map((city) => ({
      ...city,
      position: { ...city.position },
    })),
  }
}
