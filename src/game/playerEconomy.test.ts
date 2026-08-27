import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { getFactionAdjustedCost } from './playerEconomy'
import { UNIT_UPKEEP } from './upkeep'

describe('playerEconomy', () => {
  it('waives costs for the human faction on easy difficulty', () => {
    const state = createInitialGameState('easy-human', { difficulty: 'easy' })
    const humanId = state.humanFactionId
    const aiId = state.factionOrder.find((factionId) => factionId !== humanId)!

    expect(getFactionAdjustedCost(state, humanId, 10)).toBe(0)
    expect(getFactionAdjustedCost(state, aiId, 10)).toBe(10)
  })

  it('charges all factions on normal difficulty', () => {
    const state = createInitialGameState('normal-human', { difficulty: 'normal' })
    const humanId = state.humanFactionId
    const aiId = state.factionOrder.find((factionId) => factionId !== humanId)!

    expect(getFactionAdjustedCost(state, humanId, UNIT_UPKEEP.infantry)).toBe(
      UNIT_UPKEEP.infantry,
    )
    expect(getFactionAdjustedCost(state, aiId, UNIT_UPKEEP.infantry)).toBe(
      UNIT_UPKEEP.infantry,
    )
  })
})
