import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  canSpendWithUpkeepReserve,
  getFactionNetIncome,
  getFactionUpkeep,
  getFactionUpkeepReserve,
  getProjectedUpkeepReserve,
  UNIT_UPKEEP,
} from './upkeep'

describe('unit upkeep', () => {
  it('defines upkeep for every unit type', () => {
    expect(UNIT_UPKEEP).toEqual({
      infantry: 1,
      spearman: 1,
      archer: 1,
      cavalry: 2,
      settler: 1,
      builder: 1,
    })
  })

  it('calculates faction upkeep, net income, and deficit reserve', () => {
    const state = createInitialGameState('upkeep-summary')
    const factionId = state.humanFactionId

    expect(getFactionUpkeep(state, factionId)).toBe(4)
    expect(getFactionNetIncome(state, factionId)).toBe(3)
    expect(getFactionUpkeepReserve(state, factionId)).toBe(0)

    const deficit = {
      ...state,
      sites: state.sites.filter((site) => site.ownerId !== factionId),
    }
    expect(getFactionNetIncome(deficit, factionId)).toBe(-4)
    expect(getFactionUpkeepReserve(deficit, factionId)).toBe(4)
  })

  it('checks available resources separately from the upkeep reserve', () => {
    const state = createInitialGameState('upkeep-spending')
    const factionId = state.humanFactionId
    const deficit = {
      ...state,
      sites: state.sites.filter((site) => site.ownerId !== factionId),
      resources: { ...state.resources, [factionId]: 5 },
    }

    expect(canSpendWithUpkeepReserve(deficit, factionId, 6)).toEqual({
      ok: false,
      reason: 'insufficientResources',
      reserve: 4,
    })
    expect(canSpendWithUpkeepReserve(deficit, factionId, 3)).toEqual({
      ok: false,
      reason: 'insufficientUpkeepReserve',
      reserve: 4,
    })
    expect(
      canSpendWithUpkeepReserve(
        {
          ...deficit,
          resources: { ...deficit.resources, [factionId]: 7 },
        },
        factionId,
        3,
      ),
    ).toEqual({ ok: true, reserve: 4 })
  })

  it('projects new upkeep and immediate income changes', () => {
    const state = createInitialGameState('upkeep-projection')
    const factionId = state.humanFactionId

    expect(
      getProjectedUpkeepReserve(state, factionId, { upkeepDelta: 5 }),
    ).toBe(2)
    expect(
      getProjectedUpkeepReserve(state, factionId, {
        upkeepDelta: 5,
        incomeDelta: 2,
      }),
    ).toBe(0)
  })
})
