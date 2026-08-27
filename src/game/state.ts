import type { GameState } from './types'

export function cloneGameState(
  state: GameState,
  clearSelection = false,
): GameState {
  return {
    schemaVersion: state.schemaVersion,
    gameMode: state.gameMode,
    mapSeed: state.mapSeed,
    mapType: state.mapType,
    mapGenerationVersion: state.mapGenerationVersion,
    boardSize: { ...state.boardSize },
    factionCount: state.factionCount,
    humanFactionId: state.humanFactionId,
    difficulty: state.difficulty,
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
      footprint: site.footprint?.map((position) => ({ ...position })),
      buildings: [...site.buildings],
      constructionQueue: site.constructionQueue
        ? { ...site.constructionQueue }
        : undefined,
    })),
  }
}
