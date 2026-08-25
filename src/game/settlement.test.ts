import { describe, expect, it } from 'vitest'
import { getHexDistance, getHexNeighbors, positionKey } from './hex'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import {
  canConstructAt,
  canProduceCivilianUnit,
  canSettleAt,
  getExpansionLimits,
  getOwnedAnchorGraphDistance,
} from './settlement'
import type { GameState, Position, Site, Unit } from './types'

function openState(seed = 'settlement-rules'): GameState {
  const initial = createInitialGameState(seed)
  return {
    ...initial,
    resources: { ...initial.resources, player: 100 },
    tiles: initial.tiles.map((tile) => ({
      ...tile,
      terrain: 'plain' as const,
      siteId: undefined,
    })),
    sites: [],
    units: [],
    selectedUnitId: undefined,
  }
}

function singleCellCity(position: Position): Site {
  return {
    id: 'player-city',
    name: 'Player City',
    kind: 'city',
    position,
    ownerId: 'player',
    capitalFor: 'player',
    hp: 120,
    maxHp: 120,
    buildings: [],
  }
}

function civilian(
  type: 'settler' | 'builder',
  position: Position,
): Unit {
  return {
    id: `player-${type}`,
    name: type,
    factionId: 'player',
    type,
    position,
    hp: 100,
    maxHp: 100,
    movementRemaining: 2,
    hasActed: false,
  }
}

describe('settlement and construction rules', () => {
  it('maps current and legacy board sizes to cumulative construction limits', () => {
    expect(getExpansionLimits({ columns: 15, rows: 10 })).toEqual({
      constructedSites: 2,
    })
    expect(getExpansionLimits({ columns: 24, rows: 16 })).toEqual({
      constructedSites: 4,
    })
    expect(getExpansionLimits({ columns: 42, rows: 28 })).toEqual({
      constructedSites: 10,
    })
    expect(getExpansionLimits({ columns: 96, rows: 64 })).toEqual({
      constructedSites: 24,
    })
  })

  it('requires buildable non-bridge land and four hexes from existing sites for a Village', () => {
    const state = openState()
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const distanceThree = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 3,
    )!.position
    const distanceFour = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 4,
    )!.position
    const withSite = { ...state, sites: [singleCellCity(origin)] }

    expect(canSettleAt(withSite, 'player', distanceThree)).toEqual({
      ok: false,
      reason: 'tooCloseToSite',
    })
    expect(canSettleAt(withSite, 'player', distanceFour)).toEqual({ ok: true })
    const foundedVillages: Site[] = Array.from({ length: 20 }, (_, index) => ({
      id: `player-village-${index}`,
      name: `Village ${index}`,
      kind: 'village',
      position: { q: 100 + index * 10, r: 100 },
      ownerId: 'player',
      foundedBy: 'player',
      buildings: [],
    }))
    expect(
      canSettleAt(
        { ...withSite, sites: [...withSite.sites, ...foundedVillages] },
        'player',
        distanceFour,
      ),
    ).toEqual({ ok: true })
    expect(
      canSettleAt(
        {
          ...withSite,
          tiles: withSite.tiles.map((tile) =>
            positionKey(tile.position) === positionKey(distanceFour)
              ? { ...tile, terrain: 'bridge' }
              : tile,
          ),
        },
        'player',
        distanceFour,
      ),
    ).toEqual({ ok: false, reason: 'invalidTerrain' })
  })

  it('uses bridges for the three-step anchor connection but never as construction tiles', () => {
    const state = openState('construction-bridge')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const step = getHexNeighbors(origin, state.boardSize)[0]
    const destination = getHexNeighbors(step, state.boardSize).find(
      (position) => getHexDistance(origin, position) === 2,
    )!
    const corridor = {
      ...state,
      sites: [singleCellCity(origin)],
      tiles: state.tiles.map((tile) => {
        const key = positionKey(tile.position)
        const terrain =
          key === positionKey(origin) || key === positionKey(destination)
            ? 'plain'
            : key === positionKey(step)
              ? 'bridge'
              : 'mountain'
        return { ...tile, terrain: terrain as typeof tile.terrain }
      }),
    }

    expect(getOwnedAnchorGraphDistance(corridor, 'player', destination)).toBe(2)
    expect(canConstructAt(corridor, 'player', destination, 'farm')).toEqual({
      ok: true,
    })
    expect(canConstructAt(corridor, 'player', step, 'outpost')).toEqual({
      ok: false,
      reason: 'invalidTerrain',
    })
  })

  it('allows mines on hills or land adjacent to either mountain type', () => {
    const state = openState('mine-placement')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 2,
    )!.position
    const mountain = getHexNeighbors(destination, state.boardSize).find(
      (position) => getHexDistance(origin, position) >= 2,
    )!
    const anchored = {
      ...state,
      sites: [singleCellCity(origin)],
      tiles: state.tiles.map((tile) =>
        positionKey(tile.position) === positionKey(mountain)
          ? { ...tile, terrain: 'tundraMountain' as const }
          : tile,
      ),
    }

    expect(canConstructAt(anchored, 'player', destination, 'mine')).toEqual({
      ok: true,
    })
    expect(
      canConstructAt(
        {
          ...anchored,
          tiles: anchored.tiles.map((tile) =>
            positionKey(tile.position) === positionKey(destination)
              ? { ...tile, terrain: 'desertHill' as const }
              : tile,
          ),
        },
        'player',
        destination,
        'mine',
      ),
    ).toEqual({ ok: true })
  })

  it('permits unlimited settlers and multiple living builders below the cumulative site cap', () => {
    const state = openState('civilian-capacity')
    const position = state.tiles[0].position
    const settler = civilian('settler', position)
    const settlers = Array.from({ length: 20 }, (_, index) => ({
      ...settler,
      id: `player-settler-${index}`,
    }))
    const builders = [
      civilian('builder', position),
      { ...civilian('builder', position), id: 'player-builder-2' },
    ]

    expect(
      canProduceCivilianUnit({ ...state, units: settlers }, 'player', 'settler'),
    ).toEqual({ ok: true })
    expect(
      canProduceCivilianUnit({ ...state, units: builders }, 'player', 'builder'),
    ).toEqual({ ok: true })
  })
})

describe('settlement and construction actions', () => {
  it('atomically founds a Village and consumes the selected settler', () => {
    const state = openState('settler-action')
    const settler = civilian('settler', state.tiles[0].position)
    const selected = {
      ...state,
      units: [settler],
      selectedUnitId: settler.id,
    }
    const result = gameReducer(selected, {
      type: 'siteSettled',
      unitId: settler.id,
    })

    expect(result.units).toEqual([])
    expect(result.selectedUnitId).toBeUndefined()
    expect(result.sites).toContainEqual(
      expect.objectContaining({
        id: 'player-founded-1',
        name: '마을 1',
        kind: 'village',
        ownerId: 'player',
        foundedBy: 'player',
        buildings: [],
        lastDevelopedTurn: state.turn,
      }),
    )
    expect(
      result.tiles.find(
        (tile) => positionKey(tile.position) === positionKey(settler.position),
      )?.siteId,
    ).toBe('player-founded-1')
  })

  it('charges construction cost while preserving and exhausting the builder', () => {
    const state = openState('builder-action')
    state.resources.player = 0
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 2,
    )!.position
    const builder = civilian('builder', destination)
    const selected = {
      ...state,
      sites: [singleCellCity(origin)],
      units: [builder],
      selectedUnitId: builder.id,
    }
    const result = gameReducer(selected, {
      type: 'siteConstructed',
      unitId: builder.id,
      siteKind: 'outpost',
    })

    expect(result.resources.player).toBe(
      selected.resources.player,
    )
    expect(result.units).toContainEqual(
      expect.objectContaining({
        id: builder.id,
        movementRemaining: 0,
        hasActed: true,
      }),
    )
    expect(result.sites).toContainEqual(
      expect.objectContaining({
        id: 'player-founded-1',
        kind: 'outpost',
        foundedBy: 'player',
        hp: 50,
        maxHp: 50,
        lastProducedTurn: state.turn,
      }),
    )
  })

  it('leaves the state unchanged when the unit is not selected or placement is illegal', () => {
    const state = openState('invalid-settlement')
    const settler = civilian('settler', state.tiles[0].position)
    const unselected = { ...state, units: [settler] }

    expect(
      gameReducer(unselected, { type: 'siteSettled', unitId: settler.id }),
    ).toBe(unselected)
  })
})
