import {
  DEFAULT_MAP_SEED,
  generateGameState,
  type MapGenerationOptions,
} from './mapGenerator'
import type { GameState } from './types'

export function createInitialGameState(
  seed = DEFAULT_MAP_SEED,
  options?: MapGenerationOptions,
): GameState {
  return generateGameState(seed, options)
}
