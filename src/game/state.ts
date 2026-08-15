import type { GameState } from './types'

export function cloneGameState(
  state: GameState,
  clearSelection = false,
): GameState {
  return {
    schemaVersion: state.schemaVersion,
    mapSeed: state.mapSeed,
    mapGenerationVersion: state.mapGenerationVersion,
    boardSize: { ...state.boardSize },
    factionCount: state.factionCount,
    humanFactionId: state.humanFactionId,
    factionOrder: [...state.factionOrder],
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
    sites: state.sites.map((site) => ({
      ...site,
      position: { ...site.position },
    })),
  }
}
