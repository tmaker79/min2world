import { describe, expect, it } from 'vitest'
import { BOARD_SIZE_PRESETS } from './hex'
import { createInitialGameState } from './initialState'
import { getActionablePlayerUnits } from './selectors'
import type { GameState, Unit } from './types'

function board(): GameState {
  const initial = createInitialGameState('unit-orders', { boardSize: BOARD_SIZE_PRESETS.tiny })
  return {
    ...initial, sites: [], units: [],
    tiles: initial.tiles.map((tile) => ({ ...tile, terrain: 'plain', siteId: undefined })),
  }
}

function unit(id: string, overrides: Partial<Unit> = {}): Unit {
  return {
    id, name: id, type: 'infantry', factionId: 'f1', position: { q: 0, r: 0 },
    movementRemaining: 2, hasActed: false, hp: 100, maxHp: 100, ...overrides,
  }
}

describe('actionable player units', () => {
  it('counts legal movement and excludes blocked, spent and opposing units', () => {
    const state = board()
    const mobile = unit('mobile')
    const spent = unit('spent', { position: { q: 2, r: 0 }, hasActed: true })
    const enemy = unit('enemy', { position: { q: 4, r: 0 }, factionId: 'f2' })
    state.units = [spent, mobile, enemy]
    expect([...getActionablePlayerUnits(state)]).toEqual([mobile])
    state.tiles = state.tiles.map((tile) => ({ ...tile, terrain: 'water' }))
    expect(getActionablePlayerUnits(state).size).toBe(0)
  })

  it('counts attack-only and siege-only units with no movement remaining', () => {
    const state = board()
    const attacker = unit('attacker', { movementRemaining: 0 })
    const defender = unit('guard', { factionId: 'f2', position: { q: 1, r: 0 } })
    state.units = [attacker, defender]
    expect([...getActionablePlayerUnits(state)]).toEqual([attacker])
    state.sites = [{
      id: 'fort', name: 'fort', kind: 'keep', position: defender.position, ownerId: 'f2', buildings: [],
    }]
    expect([...getActionablePlayerUnits(state)]).toEqual([attacker])
    expect(getActionablePlayerUnits({ ...state, activeFactionId: 'f2' }).size).toBe(0)
    expect(getActionablePlayerUnits({ ...state, phase: 'victory' }).size).toBe(0)
  })

  it('evaluates unselected civilian commands including placement, cost and upkeep', () => {
    const state = board()
    const settler = unit('settler', { type: 'settler', movementRemaining: 0 })
    const builder = unit('builder', { type: 'builder', position: { q: 1, r: 0 }, movementRemaining: 0 })
    state.units = [builder, settler]
    // With no settlement to support a production site, only an outpost is affordable at 10 + 2 upkeep.
    state.resources.f1 = 12
    expect([...getActionablePlayerUnits(state)]).toEqual([builder, settler])
    state.resources.f1 = 11
    expect([...getActionablePlayerUnits(state)]).toEqual([settler])
    expect(getActionablePlayerUnits({ ...state, gameMode: 'quick' }).size).toBe(0)
    state.tiles = state.tiles.map((tile) => ({ ...tile, terrain: 'water' }))
    expect(getActionablePlayerUnits(state).size).toBe(0)
  })
})
