import { describe, expect, it } from 'vitest'
import { chooseAiAction } from './ai'
import { getHexDistance } from './hex'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import { getDeployablePositions } from './rules'
import type { GameState, Unit } from './types'

function enemyTurn(seed = 'ai-test'): GameState {
  return { ...createInitialGameState(seed), activeFactionId: 'enemy' }
}

describe('hex-map AI', () => {
  it('does nothing outside the enemy playing phase', () => {
    expect(chooseAiAction(createInitialGameState('ai-player'))).toBeUndefined()
    expect(chooseAiAction({ ...enemyTurn(), phase: 'victory' })).toBeUndefined()
  })

  it('selects the first available enemy unit deterministically', () => {
    const state = enemyTurn()
    const expected = state.units
      .filter((unit) => unit.factionId === 'enemy' && !unit.hasActed)
      .sort((left, right) => left.id.localeCompare(right.id))[0]

    expect(chooseAiAction(state)).toEqual({ type: 'unitSelected', unitId: expected.id })
    expect(chooseAiAction(state)).toEqual(chooseAiAction(state))
  })

  it('attacks an enemy in axial range before moving', () => {
    const enemy: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 10, maxHp: 10, movementRemaining: 2, hasActed: false,
    }
    const player: Unit = {
      id: 'player-target', name: 'target', factionId: 'player', type: 'infantry',
      position: { q: 2, r: -1 }, hp: 3, maxHp: 10, movementRemaining: 2, hasActed: false,
    }
    const state = { ...enemyTurn(), selectedUnitId: enemy.id, units: [enemy, player] }

    expect(chooseAiAction(state)).toEqual({
      type: 'unitAttacked', attackerId: enemy.id, defenderId: player.id,
    })
  })

  it('moves toward the player capital over a valid weighted hex path', () => {
    const initial = enemyTurn('ai-move')
    const enemy = initial.units.find((unit) => unit.factionId === 'enemy')!
    const capital = initial.sites.find((site) => site.capitalFor === 'player')!
    const state = {
      ...initial,
      selectedUnitId: enemy.id,
      units: initial.units.filter((unit) => unit.factionId === 'enemy'),
    }
    const action = chooseAiAction(state)

    expect(action?.type).toBe('unitMoved')
    if (action?.type === 'unitMoved') {
      expect(action.destination).not.toEqual(enemy.position)
      expect(getHexDistance(action.destination, capital.position)).toBeLessThanOrEqual(
        getHexDistance(enemy.position, capital.position),
      )
      expect(gameReducer(state, action)).not.toBe(state)
    }
  })

  it('produces a valid unit after every enemy unit has acted', () => {
    const initial = enemyTurn('ai-produce')
    const state = {
      ...initial,
      units: initial.units.map((unit) =>
        unit.factionId === 'enemy' ? { ...unit, hasActed: true, movementRemaining: 0 } : unit,
      ),
    }
    const action = chooseAiAction(state)

    expect(action?.type).toBe('unitProduced')
    if (action?.type === 'unitProduced') {
      const site = state.sites.find((candidate) => candidate.id === action.siteId)!
      expect(site.ownerId).toBe('enemy')
      expect(getDeployablePositions(state, site)).toContainEqual(action.destination)
      expect(gameReducer(state, action).units).toHaveLength(state.units.length + 1)
    }
  })

  it('ends the turn when units are done and production is unaffordable', () => {
    const initial = enemyTurn('ai-end')
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 0 },
      units: initial.units.map((unit) =>
        unit.factionId === 'enemy' ? { ...unit, hasActed: true, movementRemaining: 0 } : unit,
      ),
    }

    expect(chooseAiAction(state)).toEqual({ type: 'turnEnded' })
  })
})
