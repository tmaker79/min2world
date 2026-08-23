import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import {
  getTileIndex,
  getUnitPositionIndex,
  getZoneOfControlIndex,
} from './spatialIndex'
import { getHexNeighbors, positionKey } from './hex'
import type { Site } from './types'

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

  it('combines every owned fortified footprint zone and excludes neutral sites', () => {
    const initial = createInitialGameState('site-zoc')
    const footprint = [{ q: 0, r: 0 }, { q: 1, r: 0 }]
    const city: Site = {
      id: 'city',
      name: 'City',
      kind: 'city',
      position: footprint[0],
      footprint,
      ownerId: 'enemy',
      hp: 120,
      maxHp: 120,
    }
    const state = { ...initial, units: [], sites: [city] }
    const enemyZone = getZoneOfControlIndex(state, 'player')

    for (const occupiedPosition of footprint) {
      for (const neighbor of getHexNeighbors(occupiedPosition, state.boardSize)) {
        expect(enemyZone.has(positionKey(neighbor))).toBe(true)
      }
    }
    expect(getZoneOfControlIndex(state, 'enemy').size).toBe(0)
    expect(
      getZoneOfControlIndex(
        { ...state, sites: [{ ...city, ownerId: 'neutral' }] },
        'player',
      ).size,
    ).toBe(0)

    const enemyUnit = {
      id: 'enemy-unit',
      name: 'Enemy',
      factionId: 'enemy' as const,
      type: 'infantry' as const,
      position: { q: -3, r: 0 },
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const combined = getZoneOfControlIndex(
      { ...state, units: [enemyUnit] },
      'player',
    )
    expect(
      getHexNeighbors(enemyUnit.position, state.boardSize).every((position) =>
        combined.has(positionKey(position)),
      ),
    ).toBe(true)
    expect(
      getHexNeighbors(city.position, state.boardSize).every((position) =>
        combined.has(positionKey(position)),
      ),
    ).toBe(true)
  })

  it('invalidates zone caches independently for unit and site arrays', () => {
    const initial = createInitialGameState('zoc-cache')
    const state = { ...initial, units: [], sites: [] }
    const first = getZoneOfControlIndex(state, 'player')
    expect(getZoneOfControlIndex(state, 'player')).toBe(first)

    const changedUnits = { ...state, units: [...state.units] }
    expect(getZoneOfControlIndex(changedUnits, 'player')).not.toBe(first)

    const changedSites = { ...state, sites: [...state.sites] }
    expect(getZoneOfControlIndex(changedSites, 'player')).not.toBe(first)
  })
})
