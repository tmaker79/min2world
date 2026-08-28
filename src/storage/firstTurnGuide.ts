import type { GameMode } from '../game/types'

type GuideStorage = Pick<Storage, 'getItem' | 'setItem'>

export const FIRST_TURN_GUIDE_STORAGE_KEYS: Record<GameMode, string> = {
  quick: 'min2world:first-turn-guide:quick:v1',
  standard: 'min2world:first-turn-guide:standard:v1',
}

function resolveStorage(storage?: GuideStorage) {
  if (storage) return storage
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function hasSeenFirstTurnGuide(
  gameMode: GameMode,
  storage?: GuideStorage,
) {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return false
  try {
    return resolvedStorage.getItem(FIRST_TURN_GUIDE_STORAGE_KEYS[gameMode]) === '1'
  } catch {
    return false
  }
}

export function markFirstTurnGuideSeen(
  gameMode: GameMode,
  storage?: GuideStorage,
) {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return false
  try {
    resolvedStorage.setItem(FIRST_TURN_GUIDE_STORAGE_KEYS[gameMode], '1')
    return true
  } catch {
    return false
  }
}
