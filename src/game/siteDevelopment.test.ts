import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  canDevelopSite,
  getSiteDevelopmentCost,
  getSiteDevelopmentFootprints,
  resolveSiteDevelopment,
} from './siteDevelopment'
import type { GameState, Site, SiteType } from './types'

function developmentState(
  kind: SiteType = 'village',
  overrides: Partial<Site> = {},
): GameState {
  const initial = createInitialGameState('site-development')
  const site: Site = {
    id: 'site-1',
    name: 'Test site',
    kind,
    position: { q: 0, r: 0 },
    ownerId: initial.activeFactionId,
    buildings: [],
    ...overrides,
  }
  return {
    ...initial,
    humanFactionId: initial.factionOrder.find(
      (factionId) => factionId !== initial.activeFactionId,
    )!,
    resources: { ...initial.resources, [initial.activeFactionId]: 100 },
    units: [],
    sites: [site],
    tiles: initial.tiles.map((tile) => ({
      ...tile,
      siteId: undefined,
      terrain: 'plain' as const,
    })),
  }
}

describe('site development', () => {
  it('uses the configured chains and special-site level costs', () => {
    expect(getSiteDevelopmentCost(developmentState('outpost').sites[0])).toBe(8)
    expect(getSiteDevelopmentCost(developmentState('keep').sites[0])).toBe(12)
    expect(getSiteDevelopmentCost(developmentState('village').sites[0])).toBe(10)
    expect(getSiteDevelopmentCost(developmentState('town').sites[0])).toBe(15)
    expect(getSiteDevelopmentCost(developmentState('farm').sites[0])).toBe(6)
    expect(
      getSiteDevelopmentCost(
        developmentState('blacksmith', { level: 2 }).sites[0],
      ),
    ).toBe(11)
    expect(
      getSiteDevelopmentCost(
        developmentState('mine', { level: 3 }).sites[0],
      ),
    ).toBeUndefined()
  })

  it('waives development costs for the human faction', () => {
    const paid = developmentState('outpost')
    const state = {
      ...paid,
      humanFactionId: paid.activeFactionId,
      difficulty: 'easy' as const,
    }

    expect(getSiteDevelopmentCost(state.sites[0], state)).toBe(0)
    expect(canDevelopSite(state, 'site-1')).toMatchObject({ ok: true, cost: 0 })
    expect(resolveSiteDevelopment(state, 'site-1').resources[state.activeFactionId])
      .toBe(state.resources[state.activeFactionId])
  })

  it('preserves military-site health ratios and fully heals a new city', () => {
    const outpost = developmentState('outpost', { hp: 25, maxHp: 50 })
    const keep = resolveSiteDevelopment(outpost, 'site-1')
    expect(keep.sites[0]).toMatchObject({
      kind: 'keep',
      hp: 38,
      maxHp: 75,
    })

    const stronghold = resolveSiteDevelopment(
      { ...keep, turn: keep.turn + 1 },
      'site-1',
    )
    expect(stronghold.sites[0]).toMatchObject({
      kind: 'stronghold',
      hp: 51,
      maxHp: 100,
    })

    const village = developmentState('village', { hp: 10, maxHp: 20 })
    const townFootprint = getSiteDevelopmentFootprints(village, 'site-1')[0]
    const town = resolveSiteDevelopment(village, 'site-1', townFootprint)
    expect(town.sites[0]).not.toHaveProperty('hp')
    expect(town.sites[0]).not.toHaveProperty('maxHp')

    const cityState = { ...town, turn: town.turn + 1 }
    const cityFootprint =
      getSiteDevelopmentFootprints(cityState, 'site-1')[0]
    const city = resolveSiteDevelopment(
      cityState,
      'site-1',
      cityFootprint,
    )
    expect(city.sites[0]).toMatchObject({
      kind: 'city',
      hp: 120,
      maxHp: 120,
    })
  })

  it('keeps a developed town on the village tile', () => {
    const state = developmentState()
    const candidates = getSiteDevelopmentFootprints(state, 'site-1')
    expect(candidates).toEqual([[state.sites[0].position]])
    expect(canDevelopSite(state, 'site-1')).toMatchObject({
      ok: true,
      footprint: [state.sites[0].position],
    })
  })

  it('atomically develops a village and updates every occupied tile', () => {
    const state = developmentState()
    const footprint = getSiteDevelopmentFootprints(state, 'site-1')[0]
    const result = resolveSiteDevelopment(state, 'site-1', footprint)
    const developed = result.sites[0]

    expect(developed).toMatchObject({
      kind: 'town',
      footprint,
      lastDevelopedTurn: state.turn,
    })
    expect(result.resources[state.activeFactionId]).toBe(
      state.resources[state.activeFactionId] - 10,
    )
    expect(
      footprint.every(
        (position) =>
          result.tiles.find(
            (tile) =>
              tile.position.q === position.q && tile.position.r === position.r,
          )?.siteId === developed.id,
      ),
    ).toBe(true)
  })

  it('collapses a town footprint to its anchor when developing a city', () => {
    const village = developmentState()
    const townFootprint = getSiteDevelopmentFootprints(village, 'site-1')[0]
    const town = resolveSiteDevelopment(village, 'site-1', townFootprint)
    const nextTurn = {
      ...town,
      turn: town.turn + 1,
    }
    const candidates = getSiteDevelopmentFootprints(nextTurn, 'site-1')

    expect(candidates).toEqual([[nextTurn.sites[0].position]])
    expect(resolveSiteDevelopment(nextTurn, 'site-1').sites[0]).toMatchObject({
      kind: 'city',
      footprint: [nextTurn.sites[0].position],
    })
  })

  it('distinguishes ownership, phase, turn, resource, maximum, and footprint failures', () => {
    const state = developmentState('outpost')
    expect(canDevelopSite(state, 'missing')).toEqual({
      ok: false,
      reason: 'siteNotFound',
    })
    expect(
      canDevelopSite({
        ...state,
        sites: [{ ...state.sites[0], ownerId: 'neutral' }],
      }, 'site-1'),
    ).toEqual({ ok: false, reason: 'notOwned' })
    expect(
      canDevelopSite({
        ...state,
        sites: [{ ...state.sites[0], ownerId: 'enemy' }],
      }, 'site-1'),
    ).toEqual({ ok: false, reason: 'inactiveFaction' })
    expect(canDevelopSite({ ...state, phase: 'victory' }, 'site-1')).toEqual({
      ok: false,
      reason: 'notPlaying',
    })
    expect(
      canDevelopSite({
        ...state,
        sites: [{ ...state.sites[0], lastDevelopedTurn: state.turn }],
      }, 'site-1'),
    ).toEqual({ ok: false, reason: 'alreadyDeveloped' })
    expect(
      canDevelopSite({
        ...state,
        resources: { ...state.resources, [state.activeFactionId]: 0 },
      }, 'site-1'),
    ).toEqual({ ok: false, reason: 'insufficientResources' })
    expect(canDevelopSite(developmentState('stronghold'), 'site-1')).toEqual({
      ok: false,
      reason: 'maxLevel',
    })
    expect(canDevelopSite(developmentState('village'), 'site-1', [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ])).toEqual({
      ok: false,
      reason: 'invalidFootprint',
    })
  })

  it('does not project income from military-site development', () => {
    const initial = developmentState('outpost')
    const units = Array.from({ length: 3 }, (_, index) => ({
      id: `development-cavalry-${index}`,
      name: `Cavalry ${index}`,
      factionId: initial.activeFactionId,
      type: 'cavalry' as const,
      position: initial.tiles[index].position,
      hp: 100,
      maxHp: 100,
      movementRemaining: 0,
      hasActed: true,
    }))
    const allowed = {
      ...initial,
      resources: { ...initial.resources, [initial.activeFactionId]: 11 },
      units,
    }
    expect(canDevelopSite(allowed, 'site-1')).toEqual({
      ok: false,
      reason: 'insufficientUpkeepReserve',
    })

    const affordable = {
      ...allowed,
      resources: { ...allowed.resources, [initial.activeFactionId]: 17 },
    }
    expect(canDevelopSite(affordable, 'site-1')).toEqual({
      ok: true,
      cost: 8,
      footprint: [initial.sites[0].position],
    })
  })

  it('allows different sites to develop during the same faction turn', () => {
    const state = developmentState('outpost')
    const withSecond = {
      ...state,
      sites: [
        state.sites[0],
        {
          ...state.sites[0],
          id: 'site-2',
          position: { q: 3, r: 0 },
        },
      ],
    }
    const first = resolveSiteDevelopment(withSecond, 'site-1')
    const second = resolveSiteDevelopment(first, 'site-2')

    expect(second.sites.map((site) => site.kind)).toEqual(['keep', 'keep'])
    expect(second.resources[state.activeFactionId]).toBe(
      state.resources[state.activeFactionId] - 16,
    )
  })
})
