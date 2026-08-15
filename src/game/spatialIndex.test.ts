import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import {
  getTileIndex,
  getUnitPositionIndex,
  getZoneOfControlIndex,
} from './spatialIndex'
import { positionKey } from './hex'

describe('spatial indexes', () => {
  it('reuses immutable array indexes and invalidates changed unit arrays', () => {
    const state = createInitialGameState('spatial-index')
    const tileIndex = getTileIndex(state)
    const unitIndex = getUnitPositionIndex(state)
    const unit = state.units.find((candidate) => candidate.factionId === 'player')!

    expect(getTileIndex(state)).toBe(tileIndex)
    expect(getUnitPositionIndex(state)).toBe(unitIndex)
    expect(unitIndex.get(positionKey(unit.position))).toBe(unit)

    const selected = gameReducer(state, { type: 'unitSelected', unitId: unit.id })
    expect(getTileIndex(selected)).toBe(tileIndex)
    expect(getUnitPositionIndex(selected)).toBe(unitIndex)

    const waited = gameReducer(selected, { type: 'unitWaited', unitId: unit.id })
    expect(getUnitPositionIndex(waited)).not.toBe(unitIndex)
    expect(getZoneOfControlIndex(waited, 'enemy')).toBe(
      getZoneOfControlIndex(waited, 'enemy'),
    )
  })
})
