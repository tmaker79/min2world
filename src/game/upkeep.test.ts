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

function withPaidActiveFaction(state: ReturnType<typeof createInitialGameState>) {
  return {
    ...state,
    humanFactionId: state.factionOrder.find(
      (factionId) => factionId !== state.activeFactionId,
    )!,
  }
}

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
    const state = withPaidActiveFaction(createInitialGameState('upkeep-summary'))
    const factionId = state.activeFactionId

    expect(getFactionUpkeep(state, factionId)).toBe(6)
    expect(getFactionNetIncome(state, factionId)).toBe(1)
    expect(getFactionUpkeepReserve(state, factionId)).toBe(0)

    const deficit = {
      ...state,
      sites: state.sites.filter((site) => site.ownerId !== factionId),
    }
    expect(getFactionNetIncome(deficit, factionId)).toBe(-6)
    expect(getFactionUpkeepReserve(deficit, factionId)).toBe(6)
  })

  it('checks available resources separately from the upkeep reserve', () => {
    const state = withPaidActiveFaction(createInitialGameState('upkeep-spending'))
    const factionId = state.activeFactionId
    const deficit = {
      ...state,
      sites: state.sites.filter((site) => site.ownerId !== factionId),
      resources: { ...state.resources, [factionId]: 5 },
    }

    expect(canSpendWithUpkeepReserve(deficit, factionId, 6)).toEqual({
      ok: false,
      reason: 'insufficientResources',
      reserve: 6,
    })
    expect(canSpendWithUpkeepReserve(deficit, factionId, 3)).toEqual({
      ok: false,
      reason: 'insufficientUpkeepReserve',
      reserve: 6,
    })
    expect(
      canSpendWithUpkeepReserve(
        {
          ...deficit,
          resources: { ...deficit.resources, [factionId]: 9 },
        },
        factionId,
        3,
      ),
    ).toEqual({ ok: true, reserve: 6 })
  })

  it('projects new upkeep and immediate income changes', () => {
    const state = withPaidActiveFaction(createInitialGameState('upkeep-projection'))
    const factionId = state.activeFactionId

    expect(
      getProjectedUpkeepReserve(state, factionId, { upkeepDelta: 5 }),
    ).toBe(4)
    expect(
      getProjectedUpkeepReserve(state, factionId, {
        upkeepDelta: 5,
        incomeDelta: 2,
      }),
    ).toBe(2)
  })

  it('waives current and projected upkeep only for the human faction', () => {
    const state = createInitialGameState('human-free-upkeep')
    const factionId = state.humanFactionId

    expect(getFactionUpkeep(state, factionId)).toBe(0)
    expect(getFactionUpkeepReserve({ ...state, sites: [] }, factionId)).toBe(0)
    expect(
      getProjectedUpkeepReserve(state, factionId, { upkeepDelta: 100 }),
    ).toBe(0)
  })
})
