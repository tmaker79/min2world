import { describe, expect, it } from 'vitest'
import { getHexDistance, positionKey } from './hex'
import { createInitialGameState } from './initialState'
import {
  createTerritoryIndex,
  getSiteTerritoryRadius,
  getTerritoryOwnerAt,
} from './territory'
import type { GameState, Position, Site, SiteType } from './types'

function territoryState(seed = 'territory-rules'): GameState {
  const initial = createInitialGameState(seed)
  return {
    ...initial,
    sites: [],
    units: [],
    tiles: initial.tiles.map((tile) => ({
      ...tile,
      terrain: 'water' as const,
      siteId: undefined,
    })),
  }
}

function site(
  id: string,
  kind: SiteType,
  ownerId: Site['ownerId'],
  position: Position,
): Site {
  return { id, name: id, kind, ownerId, position, buildings: [] }
}

describe('territory rules', () => {
  it.each([
    ['village', 1, 7],
    ['town', 2, 19],
    ['city', 3, 37],
  ] as const)('claims the tier radius for %s', (kind, radius, tileCount) => {
    const state = territoryState(`territory-${kind}`)
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const source = site('source', kind, 'player', origin)
    const territory = createTerritoryIndex({ ...state, sites: [source] })

    expect(getSiteTerritoryRadius(source)).toBe(radius)
    expect(territory.size).toBe(tileCount)
    expect(
      [...territory.keys()].every((key) => {
        const tile = state.tiles.find((candidate) => positionKey(candidate.position) === key)!
        return getHexDistance(origin, tile.position) <= radius
      }),
    ).toBe(true)
  })

  it('clips claims at the board edge and ignores terrain', () => {
    const state = territoryState('territory-edge')
    const origin = state.tiles[0].position
    const territory = createTerritoryIndex({
      ...state,
      sites: [site('edge-city', 'city', 'player', origin)],
    })

    expect(territory.size).toBeLessThan(37)
    expect(getTerritoryOwnerAt(territory, origin)).toBe('player')
    expect(
      [...territory.keys()].every((key) =>
        state.tiles.some((tile) => positionKey(tile.position) === key),
      ),
    ).toBe(true)
  })

  it('does not create territory from neutral, production, or military sites', () => {
    const state = territoryState('territory-non-sources')
    const positions = state.tiles.slice(0, 7).map((tile) => tile.position)
    const sites = [
      site('neutral-city', 'city', 'neutral', positions[0]),
      site('farm', 'farm', 'player', positions[1]),
      site('mine', 'mine', 'player', positions[2]),
      site('blacksmith', 'blacksmith', 'player', positions[3]),
      site('outpost', 'outpost', 'player', positions[4]),
      site('keep', 'keep', 'player', positions[5]),
      site('stronghold', 'stronghold', 'player', positions[6]),
    ]

    expect(createTerritoryIndex({ ...state, sites }).size).toBe(0)
    expect(sites.map(getSiteTerritoryRadius)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('uses the nearest source and marks cross-faction distance ties contested', () => {
    const state = territoryState('territory-overlap')
    const center = state.tiles[Math.floor(state.tiles.length / 2)].position
    const left = { q: center.q - 2, r: center.r }
    const right = { q: center.q + 2, r: center.r }
    const territory = createTerritoryIndex({
      ...state,
      sites: [
        site('player-city', 'city', 'player', left),
        site('enemy-city', 'city', 'enemy', right),
      ],
    })

    expect(getTerritoryOwnerAt(territory, center)).toBe('contested')
    expect(getTerritoryOwnerAt(territory, { q: center.q - 1, r: center.r })).toBe('player')
    expect(getTerritoryOwnerAt(territory, { q: center.q + 1, r: center.r })).toBe('enemy')
  })

  it('keeps equal-distance claims from the same faction owned', () => {
    const state = territoryState('territory-friendly-overlap')
    const center = state.tiles[Math.floor(state.tiles.length / 2)].position
    const territory = createTerritoryIndex({
      ...state,
      sites: [
        site('city-a', 'city', 'player', { q: center.q - 2, r: center.r }),
        site('city-b', 'city', 'player', { q: center.q + 2, r: center.r }),
      ],
    })

    expect(getTerritoryOwnerAt(territory, center)).toBe('player')
  })

  it('derives ownership immediately from captured and developed site state', () => {
    const state = territoryState('territory-derived-state')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const village = site('village', 'village', 'player', origin)
    const distanceThree = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 3,
    )!.position

    expect(getTerritoryOwnerAt(createTerritoryIndex({ ...state, sites: [village] }), distanceThree)).toBeUndefined()
    expect(
      getTerritoryOwnerAt(
        createTerritoryIndex({ ...state, sites: [{ ...village, kind: 'city' }] }),
        distanceThree,
      ),
    ).toBe('player')
    expect(
      getTerritoryOwnerAt(
        createTerritoryIndex({ ...state, sites: [{ ...village, kind: 'city', ownerId: 'enemy' }] }),
        distanceThree,
      ),
    ).toBe('enemy')
  })
})
