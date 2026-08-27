import type { FactionId, GameState } from './types'

export function getFactionAdjustedCost(
  state: Pick<GameState, 'difficulty' | 'humanFactionId'>,
  factionId: FactionId,
  baseCost: number,
): number {
  return state.difficulty === 'easy' && factionId === state.humanFactionId
    ? 0
    : baseCost
}
