import { DEFAULT_MAP_SEED, generateGameState } from './mapGenerator'
import type { GameState } from './types'

export function createInitialGameState(
  seed = DEFAULT_MAP_SEED,
): GameState {
  return generateGameState(seed)
}
