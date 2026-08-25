import type { FactionId, GameState } from './types'

/** Temporary testing rule: only the human-controlled faction pays no resource costs. */
export const HUMAN_FREE_ECONOMY = true

export function getFactionAdjustedCost(
  state: Pick<GameState, 'humanFactionId'>,
  factionId: FactionId,
  baseCost: number,
): number {
  return HUMAN_FREE_ECONOMY && factionId === state.humanFactionId
    ? 0
    : baseCost
}
