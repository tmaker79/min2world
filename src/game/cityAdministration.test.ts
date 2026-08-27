import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { getHexNeighbors } from './hex'
import { gameReducer } from './reducer'
import {
  canStartConstruction,
  getFactionLibraryDiscount,
  resolveCityTurnStart,
} from './cityAdministration'
import {
  getFactionIncome,
  getSiteCombatStats,
  getSiteMaxHp,
  getUnitProductionCost,
} from './rules'
import { canDevelopSite } from './siteDevelopment'
import { getFactionUpkeepReserve } from './upkeep'
import { GAME_SCHEMA_VERSION } from './types'
import type { GameState, Site, Unit } from './types'

function ownedCity(state: GameState): Site {
  return state.sites.find(
    (site) =>
      site.kind === 'city' && site.ownerId === state.activeFactionId,
  )!
}

function advanceToFactionStart(state: GameState): GameState {
  let next = gameReducer(state, { type: 'turnEnded' })
  while (next.activeFactionId !== state.activeFactionId) {
    next = gameReducer(next, { type: 'turnEnded' })
  }
  return next
}

function withPaidActiveFaction(state: GameState): GameState {
  return {
    ...state,
    humanFactionId: state.factionOrder.find(
      (factionId) => factionId !== state.activeFactionId,
    )!,
  }
}

describe('city administration', () => {
  it('initializes every site without buildings or a construction queue', () => {
    const state = createInitialGameState('building-initial')
    expect(state.schemaVersion).toBe(GAME_SCHEMA_VERSION)
    expect(state.sites.every((site) => site.buildings.length === 0)).toBe(true)
    expect(
      state.sites.every((site) => site.constructionQueue === undefined),
    ).toBe(true)
  })

  it('starts construction only in an active owned City and charges immediately', () => {
    const initial = createInitialGameState('building-start')
    initial.resources[initial.activeFactionId] = 20
    const city = ownedCity(initial)
    const farm = initial.sites.find((site) => site.kind === 'farm')!

    expect(canStartConstruction(initial, farm.id, 'granary')).toEqual({
      ok: false,
      reason: 'notCity',
    })
    const started = gameReducer(initial, {
      type: 'constructionStarted',
      siteId: city.id,
      buildingId: 'granary',
    })

    expect(started.resources[initial.activeFactionId]).toBe(5)
    expect(started.sites.find((site) => site.id === city.id)).toMatchObject({
      buildings: [],
      constructionQueue: {
        buildingId: 'granary',
        turnsRemaining: 1,
        startedTurn: 1,
      },
    })
    expect(
      gameReducer(started, {
        type: 'constructionStarted',
        siteId: city.id,
        buildingId: 'market',
      }),
    ).toBe(started)
  })

  it('completes buildings at the owner next turn start and applies income', () => {
    const initial = createInitialGameState('building-complete')
    const city = ownedCity(initial)
    const started = gameReducer(initial, {
      type: 'constructionStarted',
      siteId: city.id,
      buildingId: 'granary',
    })
    const completed = advanceToFactionStart(started)
    const completedCity = completed.sites.find((site) => site.id === city.id)!

    expect(completedCity.buildings).toContain('granary')
    expect(completedCity.constructionQueue).toBeUndefined()
    expect(getFactionIncome(completed, initial.activeFactionId)).toBe(
      getFactionIncome(initial, initial.activeFactionId) + 1,
    )
  })

  it('decrements multi-turn construction once per owner turn start', () => {
    const initial = {
      ...createInitialGameState('building-multi-turn'),
      resources: {
        ...createInitialGameState('building-multi-turn').resources,
        f1: 100,
        player: 100,
      },
    }
    const city = ownedCity(initial)
    const started = gameReducer(initial, {
      type: 'constructionStarted',
      siteId: city.id,
      buildingId: 'market',
    })
    const afterOne = advanceToFactionStart(started)
    expect(
      afterOne.sites.find((site) => site.id === city.id)?.constructionQueue,
    ).toMatchObject({ turnsRemaining: 1 })
    const completed = advanceToFactionStart(afterOne)
    expect(
      completed.sites.find((site) => site.id === city.id)?.buildings,
    ).toContain('market')
  })

  it('cancels without refund and preserves completed buildings', () => {
    const initial = createInitialGameState('building-cancel')
    const city = ownedCity(initial)
    const started = gameReducer(initial, {
      type: 'constructionStarted',
      siteId: city.id,
      buildingId: 'granary',
    })
    const cancelled = gameReducer(started, {
      type: 'constructionCancelled',
      siteId: city.id,
    })

    expect(cancelled.resources).toEqual(started.resources)
    expect(
      cancelled.sites.find((site) => site.id === city.id)?.constructionQueue,
    ).toBeUndefined()
  })

  it('applies wall defense and capped local barracks production discounts', () => {
    const state = createInitialGameState('building-military')
    const city = ownedCity(state)
    const fortified: Site = {
      ...city,
      buildings: ['wall', 'barracks'],
      hp: 150,
      maxHp: 150,
    }
    const blacksmith = state.sites.find((site) => site.kind === 'blacksmith')!
    const discounted: GameState = {
      ...withPaidActiveFaction(state),
      sites: state.sites.map((site) =>
        site.id === city.id
          ? { ...fortified, buildings: [...fortified.buildings] }
          : site.id === blacksmith.id
            ? { ...site, ownerId: city.ownerId, level: 3 }
            : site,
      ),
    }

    expect(getSiteMaxHp(fortified)).toBe(150)
    expect(getSiteCombatStats(fortified)?.defense).toBe(60)
    expect(
      getUnitProductionCost(
        discounted,
        state.activeFactionId,
        'infantry',
        fortified,
      ),
    ).toBe(7)
    expect(
      getUnitProductionCost(
        discounted,
        state.activeFactionId,
        'archer',
        fortified,
      ),
    ).toBe(13)
  })

  it('heals a City and friendly units on its footprint at turn start', () => {
    const state = createInitialGameState('building-healing')
    const city = ownedCity(state)
    const unit: Unit = {
      id: 'wounded-garrison',
      name: 'Wounded garrison',
      factionId: state.activeFactionId,
      type: 'infantry',
      position: city.position,
      hp: 70,
      maxHp: 100,
      movementRemaining: 0,
      hasActed: true,
    }
    const prepared: GameState = {
      ...state,
      sites: state.sites.map((site) =>
        site.id === city.id
          ? { ...site, buildings: ['tavern', 'temple'], hp: 90 }
          : site,
      ),
      units: [unit],
    }
    const result = resolveCityTurnStart(prepared, state.activeFactionId)

    expect(result.units[0].hp).toBe(80)
    expect(result.sites.find((site) => site.id === city.id)?.hp).toBe(100)
  })

  it('preserves buildings and a queue when a walled City is captured', () => {
    const initial = createInitialGameState('building-capture')
    const city = initial.sites.find(
      (site) =>
        site.kind === 'city' && site.ownerId !== initial.activeFactionId,
    )!
    const attacker: Unit = {
      id: 'building-capture-attacker',
      name: 'Capture attacker',
      factionId: initial.activeFactionId,
      type: 'infantry',
      position: getHexNeighbors(city.position, initial.boardSize)[0],
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const prepared: GameState = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker],
      sites: initial.sites.map((site) =>
        site.id === city.id
          ? {
              ...site,
              buildings: ['wall'],
              constructionQueue: {
                buildingId: 'market',
                turnsRemaining: 1,
                startedTurn: initial.turn,
              },
              hp: 1,
              maxHp: 150,
            }
          : site,
      ),
      tiles: initial.tiles.map((tile) => ({
        ...tile,
        terrain: 'plain',
      })),
    }
    const captured = gameReducer(prepared, {
      type: 'siteAttacked',
      attackerId: attacker.id,
      siteId: city.id,
    })

    expect(captured.sites.find((site) => site.id === city.id)).toMatchObject({
      ownerId: initial.activeFactionId,
      buildings: ['wall'],
      hp: 75,
      maxHp: 150,
      constructionQueue: {
        buildingId: 'market',
        turnsRemaining: 1,
      },
    })
  })

  it('caps the faction library discount and applies it to development', () => {
    const initial = withPaidActiveFaction(
      createInitialGameState('building-library'),
    )
    const ownerId = initial.activeFactionId
    const city = ownedCity(initial)
    const outpost = initial.sites.find((site) => site.kind === 'farm')!
    const state: GameState = {
      ...initial,
      resources: { ...initial.resources, [ownerId]: 100 },
      sites: [
        { ...city, buildings: ['library'] },
        {
          ...outpost,
          id: 'develop-me',
          kind: 'outpost',
          ownerId,
          level: undefined,
          buildings: [],
        },
      ],
    }

    expect(getFactionLibraryDiscount(state, ownerId)).toBe(1)
    expect(canDevelopSite(state, 'develop-me')).toEqual({
      ok: true,
      cost: 7,
      footprint: [outpost.position],
    })
  })

  it('does not count queued income buildings toward the upkeep reserve', () => {
    const initial = withPaidActiveFaction(
      createInitialGameState('building-upkeep-reserve'),
    )
    const factionId = initial.activeFactionId
    const city = ownedCity(initial)
    const units = Array.from({ length: 5 }, (_, index) => ({
      ...initial.units.find((unit) => unit.factionId === factionId)!,
      id: `construction-cavalry-${index}`,
      type: 'cavalry' as const,
      position: initial.tiles[index].position,
    }))
    const queued: GameState = {
      ...initial,
      units,
      sites: initial.sites.map((site) =>
        site.id === city.id
          ? {
              ...site,
              constructionQueue: {
                buildingId: 'granary',
                turnsRemaining: 1,
                startedTurn: initial.turn,
              },
            }
          : site,
      ),
    }
    expect(getFactionUpkeepReserve(queued, factionId)).toBe(1)

    const completed = {
      ...queued,
      sites: queued.sites.map((site) =>
        site.id === city.id
          ? { ...site, buildings: ['granary' as const], constructionQueue: undefined }
          : site,
      ),
    }
    expect(getFactionUpkeepReserve(completed, factionId)).toBe(0)
  })

  it('keeps the upkeep reserve when construction has no immediate income', () => {
    const initial = withPaidActiveFaction(
      createInitialGameState('building-spending-reserve'),
    )
    const factionId = initial.activeFactionId
    const city = ownedCity(initial)
    const units = Array.from({ length: 5 }, (_, index) => ({
      ...initial.units.find((unit) => unit.factionId === factionId)!,
      id: `construction-reserve-cavalry-${index}`,
      type: 'cavalry' as const,
      position: initial.tiles[index].position,
    }))
    const blocked: GameState = {
      ...initial,
      units,
      resources: { ...initial.resources, [factionId]: 15 },
    }

    expect(canStartConstruction(blocked, city.id, 'granary')).toEqual({
      ok: false,
      reason: 'insufficientUpkeepReserve',
    })
    expect(canStartConstruction({
      ...blocked,
      resources: { ...blocked.resources, [factionId]: 16 },
    }, city.id, 'granary')).toEqual({ ok: true, cost: 15, turns: 1 })
  })
})
