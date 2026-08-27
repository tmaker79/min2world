import { positionKey } from './hex'
import {
  getSitePositionIndex,
  getTileIndex,
  getUnitPositionIndex,
} from './spatialIndex'
import type { GameState, Position } from './types'

export function getTileAt(state: GameState, position: Position) {
  return getTileIndex(state).get(positionKey(position))
}

export function getUnitAt(state: GameState, position: Position) {
  return getUnitPositionIndex(state).get(positionKey(position))
}

export function getSiteAt(state: GameState, position: Position) {
  return getSitePositionIndex(state).get(positionKey(position))
}
