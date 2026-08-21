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
    ...overrides,
  }
  return {
    ...initial,
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
    expect(getSiteDevelopmentCost(developmentState('city').sites[0])).toBe(15)
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

  it('returns every available city footprint and rejects blocked new cells', () => {
    const state = developmentState()
    const candidates = getSiteDevelopmentFootprints(state, 'site-1')
    expect(candidates).toHaveLength(2)
    expect(candidates.every((candidate) => candidate.length === 3)).toBe(true)
    expect(
      candidates.every((candidate) => {
        const rows = new Map<number, number>()
        for (const position of candidate) {
          rows.set(position.r, (rows.get(position.r) ?? 0) + 1)
        }
        return [...rows.values()].sort().join(',') === '1,2'
      }),
    ).toBe(true)

    const blockedPosition = candidates[0].find(
      (position) => position.q !== 0 || position.r !== 0,
    )!
    const blocked = {
      ...state,
      units: [
        {
          id: 'blocker',
          name: 'blocker',
          factionId: state.activeFactionId,
          type: 'infantry' as const,
          position: blockedPosition,
          hp: 100,
          maxHp: 100,
          movementRemaining: 2,
          hasActed: false,
        },
      ],
    }
    expect(getSiteDevelopmentFootprints(blocked, 'site-1').length).toBeLessThan(
      candidates.length,
    )
    expect(canDevelopSite(blocked, 'site-1', candidates[0])).toEqual({
      ok: false,
      reason: 'invalidFootprint',
    })
  })

  it('atomically develops a village and updates every occupied tile', () => {
    const state = developmentState()
    const footprint = getSiteDevelopmentFootprints(state, 'site-1')[0]
    const result = resolveSiteDevelopment(state, 'site-1', footprint)
    const developed = result.sites[0]

    expect(developed).toMatchObject({
      kind: 'city',
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

  it('only offers castle footprints that contain the existing city', () => {
    const village = developmentState()
    const cityFootprint = getSiteDevelopmentFootprints(village, 'site-1')[0]
    const city = resolveSiteDevelopment(village, 'site-1', cityFootprint)
    const nextTurn = {
      ...city,
      turn: city.turn + 1,
    }
    const candidates = getSiteDevelopmentFootprints(nextTurn, 'site-1')

    expect(candidates.length).toBeGreaterThan(0)
    expect(
      candidates.every((candidate) =>
        cityFootprint.every((position) =>
          candidate.some(
            (occupied) =>
              occupied.q === position.q && occupied.r === position.r,
          ),
        ),
      ),
    ).toBe(true)
    expect(resolveSiteDevelopment(nextTurn, 'site-1', candidates[0]).sites[0].kind).toBe(
      'castle',
    )
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
    expect(canDevelopSite(developmentState('village'), 'site-1')).toEqual({
      ok: false,
      reason: 'invalidFootprint',
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
