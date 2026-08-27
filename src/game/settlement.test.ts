import { describe, expect, it } from 'vitest'
import { getHexDistance, getHexNeighbors, positionKey } from './hex'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import {
  canConstructAt,
  canSettleAt,
  createProductionSupportIndex,
  getOwnedAnchorGraphDistance,
  getProductionSupportAt,
  getSettlementProductionCapacity,
  getSettlementProductionCapacityLimit,
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

  it('allows Outposts only on ordinary plains, hills, and forests', () => {
    const state = openState('outpost-terrain')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 2,
    )!.position
    const anchored = { ...state, sites: [singleCellCity(origin)] }
    const withTerrain = (terrain: GameState['tiles'][number]['terrain']) => ({
      ...anchored,
      tiles: anchored.tiles.map((tile) =>
        positionKey(tile.position) === positionKey(destination)
          ? { ...tile, terrain }
          : tile,
      ),
    })

    for (const terrain of ['plain', 'hill', 'forest'] as const) {
      expect(
        canConstructAt(withTerrain(terrain), 'player', destination, 'outpost'),
      ).toEqual({ ok: true })
    }
    for (const terrain of [
      'desert',
      'desertHill',
      'oasis',
      'tundra',
      'tundraForest',
      'bridge',
      'water',
      'mountain',
      'tundraMountain',
    ] as const) {
      expect(
        canConstructAt(withTerrain(terrain), 'player', destination, 'outpost'),
      ).toEqual({ ok: false, reason: 'invalidTerrain' })
    }
  })

  it('rejects enemy territory while allowing owned, contested, and unclaimed Outpost tiles', () => {
    const state = openState('outpost-territory')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 2,
    )!.position
    const anchored = { ...state, sites: [singleCellCity(origin)] }
    const key = positionKey(destination)

    expect(
      canConstructAt(
        anchored,
        'player',
        destination,
        'outpost',
        new Map([[key, 'enemy']]),
      ),
    ).toEqual({ ok: false, reason: 'enemyTerritory' })
    for (const owner of ['player', 'contested'] as const) {
      expect(
        canConstructAt(
          anchored,
          'player',
          destination,
          'outpost',
          new Map([[key, owner]]),
        ),
      ).toEqual({ ok: true })
    }
    expect(
      canConstructAt(anchored, 'player', destination, 'outpost', new Map()),
    ).toEqual({ ok: true })
  })

  it('separates military sites by one tile without spacing them from other sites', () => {
    const state = openState('outpost-spacing')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 2,
    )!.position
    const adjacent = getHexNeighbors(destination, state.boardSize).find(
      (position) => positionKey(position) !== positionKey(origin),
    )!
    const distanceTwo = state.tiles.find(
      (tile) =>
        getHexDistance(destination, tile.position) === 2 &&
        positionKey(tile.position) !== positionKey(origin),
    )!.position
    const city = singleCellCity(origin)

    for (const kind of ['outpost', 'keep', 'stronghold'] as const) {
      for (const ownerId of ['player', 'enemy', 'neutral'] as const) {
        const militarySite: Site = {
          id: `${ownerId}-${kind}`,
          name: kind,
          kind,
          position: adjacent,
          ownerId,
          buildings: [],
        }
        expect(
          canConstructAt(
            { ...state, sites: [city, militarySite] },
            'player',
            destination,
            'outpost',
          ),
        ).toEqual({ ok: false, reason: 'tooCloseToMilitarySite' })
      }
    }

    const farm: Site = {
      id: 'adjacent-farm',
      name: 'Farm',
      kind: 'farm',
      position: adjacent,
      ownerId: 'player',
      level: 1,
      buildings: [],
    }
    const distantOutpost: Site = {
      id: 'distant-outpost',
      name: 'Outpost',
      kind: 'outpost',
      position: distanceTwo,
      ownerId: 'enemy',
      buildings: [],
    }
    expect(
      canConstructAt(
        { ...state, sites: [city, farm] },
        'player',
        destination,
        'outpost',
      ),
    ).toEqual({ ok: true })
    expect(
      canConstructAt(
        { ...state, sites: [city, { ...farm, position: destination }] },
        'player',
        destination,
        'outpost',
      ),
    ).toEqual({ ok: false, reason: 'siteOccupied' })
    expect(
      canConstructAt(
        { ...state, sites: [city, distantOutpost] },
        'player',
        destination,
        'outpost',
      ),
    ).toEqual({ ok: true })
  })

  it('lets production sites sit adjacent to military sites but not other sites', () => {
    const state = openState('production-spacing')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 2,
    )!.position
    const adjacent = getHexNeighbors(destination, state.boardSize).find(
      (position) => getHexDistance(origin, position) === 2,
    )!
    const city = singleCellCity(origin)

    for (const kind of ['outpost', 'keep', 'stronghold'] as const) {
      for (const ownerId of ['player', 'enemy', 'neutral'] as const) {
        const militarySite: Site = {
          id: `${ownerId}-${kind}`,
          name: kind,
          kind,
          position: adjacent,
          ownerId,
          buildings: [],
        }
        for (const siteKind of ['farm', 'blacksmith'] as const) {
          expect(
            canConstructAt(
              { ...state, sites: [city, militarySite] },
              'player',
              destination,
              siteKind,
            ),
          ).toEqual({ ok: true })
        }
      }
    }

    const village: Site = {
      id: 'adjacent-village',
      name: 'Village',
      kind: 'village',
      position: adjacent,
      ownerId: 'player',
      buildings: [],
    }
    expect(
      canConstructAt(
        { ...state, sites: [city, village] },
        'player',
        destination,
        'farm',
      ),
    ).toEqual({ ok: false, reason: 'tooCloseToSite' })
  })

  it('restricts production sites to owned territory while allowing contested Outposts', () => {
    const state = openState('territory-construction')
    const destination = state.tiles[Math.floor(state.tiles.length / 2)].position
    const ownedOrigin = { q: destination.q - 2, r: destination.r }
    const enemyOrigin = { q: destination.q + 2, r: destination.r }
    const ownedCity = singleCellCity(ownedOrigin)
    const enemyCity = {
      ...singleCellCity(enemyOrigin),
      id: 'enemy-city',
      ownerId: 'enemy' as const,
      capitalFor: 'enemy' as const,
    }
    const adjacentMountain = getHexNeighbors(destination, state.boardSize)[0]
    const contested = {
      ...state,
      sites: [ownedCity, enemyCity],
      tiles: state.tiles.map((tile) =>
        positionKey(tile.position) === positionKey(adjacentMountain)
          ? { ...tile, terrain: 'mountain' as const }
          : tile,
      ),
    }

    for (const siteKind of ['farm', 'mine', 'blacksmith'] as const) {
      expect(canConstructAt(contested, 'player', destination, siteKind)).toEqual({
        ok: false,
        reason: 'outsideTerritory',
      })
    }
    expect(canConstructAt(contested, 'player', destination, 'outpost')).toEqual({
      ok: true,
    })
  })

  it('rejects unclaimed production tiles outside a tier-two territory radius', () => {
    const state = openState('unclaimed-construction')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 3,
    )!.position
    const town = { ...singleCellCity(origin), kind: 'town' as const, hp: undefined, maxHp: undefined }
    const withTown = { ...state, sites: [town] }

    expect(getOwnedAnchorGraphDistance(withTown, 'player', destination)).toBe(3)
    expect(canConstructAt(withTown, 'player', destination, 'farm')).toEqual({
      ok: false,
      reason: 'outsideTerritory',
    })
    expect(canConstructAt(withTown, 'player', destination, 'outpost')).toEqual({
      ok: true,
    })
  })

  it('allows Outposts beyond both owned territory and the anchor connection range', () => {
    const state = openState('unclaimed-outpost-expansion')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 4,
    )!.position
    const withCity = { ...state, sites: [singleCellCity(origin)] }

    expect(getOwnedAnchorGraphDistance(withCity, 'player', destination))
      .toBeUndefined()
    expect(canConstructAt(withCity, 'player', destination, 'farm')).toEqual({
      ok: false,
      reason: 'notConnected',
    })
    expect(canConstructAt(withCity, 'player', destination, 'outpost')).toEqual({
      ok: true,
    })
  })

  it('does not apply the production capacity limit to Outposts', () => {
    const state = openState('unlimited-construction')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 2,
    )!.position
    const foundedSites: Site[] = Array.from({ length: 30 }, (_, index) => ({
      id: `player-founded-${index + 1}`,
      name: `Farm ${index + 1}`,
      kind: 'farm',
      position: { q: 100 + index * 3, r: 100 },
      ownerId: 'player',
      foundedBy: 'player',
      level: 1,
      buildings: [],
    }))

    expect(
      canConstructAt(
        { ...state, sites: [singleCellCity(origin), ...foundedSites] },
        'player',
        destination,
        'outpost',
      ),
    ).toEqual({ ok: true })
  })

  it('assigns production support by graph distance and settlement id', () => {
    const state = openState('production-support-assignment')
    const center = state.tiles[Math.floor(state.tiles.length / 2)].position
    const left: Site = {
      ...singleCellCity({ q: center.q - 2, r: center.r }),
      id: 'z-town',
      name: 'Z Town',
      kind: 'town',
      hp: undefined,
      maxHp: undefined,
    }
    const right: Site = {
      ...singleCellCity({ q: center.q + 2, r: center.r }),
      id: 'a-city',
      name: 'A City',
    }
    const index = createProductionSupportIndex(
      { ...state, sites: [left, right] },
      'player',
    )

    expect(getProductionSupportAt(index, center)).toMatchObject({
      settlement: { id: 'a-city' },
      distance: 2,
      used: 0,
      capacity: 4,
    })

    const distanceThree = state.tiles.find(
      (tile) => getHexDistance(left.position, tile.position) === 3,
    )!.position
    expect(getProductionSupportAt(index, distanceThree)?.distance).toBe(3)

    const isolated = {
      ...state,
      sites: [left],
      tiles: state.tiles.map((tile) => ({
        ...tile,
        terrain:
          positionKey(tile.position) === positionKey(left.position) ||
          positionKey(tile.position) === positionKey(center)
            ? ('plain' as const)
            : ('mountain' as const),
      })),
    }
    expect(
      getProductionSupportAt(
        createProductionSupportIndex(isolated, 'player'),
        center,
      ),
    ).toBeUndefined()
  })

  it('uses Town and City production capacities while excluding other owners', () => {
    const state = openState('production-capacity')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const positions = state.tiles
      .filter((tile) => {
        const distance = getHexDistance(origin, tile.position)
        return distance === 2
      })
      .map((tile) => tile.position)
      .reduce<Position[]>((selected, position) => {
        if (selected.every((other) => getHexDistance(other, position) >= 2)) {
          selected.push(position)
        }
        return selected
      }, [])
    const town: Site = {
      ...singleCellCity(origin),
      kind: 'town',
      hp: undefined,
      maxHp: undefined,
    }
    const productionSites: Site[] = [
      {
        id: 'player-farm',
        name: 'Farm',
        kind: 'farm',
        position: positions[0],
        ownerId: 'player',
        level: 1,
        buildings: [],
      },
      {
        id: 'player-mine',
        name: 'Mine',
        kind: 'mine',
        position: positions[1],
        ownerId: 'player',
        level: 1,
        buildings: [],
      },
      {
        id: 'neutral-blacksmith',
        name: 'Neutral Blacksmith',
        kind: 'blacksmith',
        position: positions[3],
        ownerId: 'neutral',
        level: 1,
        buildings: [],
      },
    ]
    const capped = { ...state, sites: [town, ...productionSites] }
    const index = createProductionSupportIndex(capped, 'player')

    expect(getSettlementProductionCapacityLimit({ ...town, kind: 'village' }))
      .toBe(0)
    expect(getSettlementProductionCapacity(index, town.id)).toMatchObject({
      used: 2,
      capacity: 2,
    })
    expect(canConstructAt(capped, 'player', positions[2], 'farm')).toEqual({
      ok: false,
      reason: 'productionCapacityReached',
    })

    const city = { ...town, kind: 'city' as const, hp: 120, maxHp: 120 }
    const cityState = { ...capped, sites: [city, ...productionSites] }
    expect(
      getSettlementProductionCapacity(
        createProductionSupportIndex(cityState, 'player'),
        city.id,
      ),
    ).toMatchObject({ used: 2, capacity: 4 })
    expect(canConstructAt(cityState, 'player', positions[2], 'farm')).toEqual({
      ok: true,
    })
  })

  it('recomputes support after ownership and settlement stage changes without removing sites', () => {
    const state = openState('production-support-recalculation')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const positions = state.tiles
      .filter((tile) => getHexDistance(origin, tile.position) === 2)
      .map((tile) => tile.position)
      .reduce<Position[]>((selected, position) => {
        if (selected.every((other) => getHexDistance(other, position) >= 2)) {
          selected.push(position)
        }
        return selected
      }, [])
    const town: Site = {
      ...singleCellCity(origin),
      kind: 'town',
      hp: undefined,
      maxHp: undefined,
    }
    const productionSites: Site[] = positions.slice(0, 3).map((position, index) => ({
      id: `over-capacity-${index}`,
      name: `Production ${index}`,
      kind: (['farm', 'mine', 'blacksmith'] as const)[index],
      position,
      ownerId: 'player',
      level: 1,
      buildings: [],
    }))
    const overCapacityState = { ...state, sites: [town, ...productionSites] }
    const overCapacityIndex = createProductionSupportIndex(
      overCapacityState,
      'player',
    )

    expect(getSettlementProductionCapacity(overCapacityIndex, town.id)).toMatchObject({
      used: 3,
      capacity: 2,
    })
    expect(
      productionSites.map((site) =>
        getProductionSupportAt(overCapacityIndex, site.position)?.settlement.id,
      ),
    ).toEqual([town.id, town.id, town.id])

    const developed = {
      ...overCapacityState,
      sites: [{ ...town, kind: 'city' as const, hp: 120, maxHp: 120 }, ...productionSites],
    }
    expect(
      getSettlementProductionCapacity(
        createProductionSupportIndex(developed, 'player'),
        town.id,
      ),
    ).toMatchObject({ used: 3, capacity: 4 })

    const captured = {
      ...overCapacityState,
      sites: [{ ...town, ownerId: 'enemy' as const }, ...productionSites],
    }
    expect(
      getProductionSupportAt(
        createProductionSupportIndex(captured, 'player'),
        productionSites[0].position,
      ),
    ).toBeUndefined()
    expect(captured.sites).toHaveLength(4)
  })

  it('does not use Villages or military sites as production support', () => {
    const state = openState('unsupported-production')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const destination = state.tiles.find(
      (tile) => getHexDistance(origin, tile.position) === 2,
    )!.position
    const village: Site = {
      ...singleCellCity(origin),
      kind: 'village',
      hp: undefined,
      maxHp: undefined,
    }

    for (const kind of ['village', 'keep', 'stronghold'] as const) {
      const anchor: Site = {
        ...village,
        id: `player-${kind}`,
        kind,
        ...(kind === 'keep'
          ? { hp: 75, maxHp: 75 }
          : kind === 'stronghold'
            ? { hp: 100, maxHp: 100 }
            : {}),
      }
      expect(
        canConstructAt({ ...state, sites: [anchor] }, 'player', destination, 'farm'),
      ).toEqual({ ok: false, reason: 'notConnected' })
    }
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
    state.resources.player = 10
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

    expect(result.resources.player).toBe(0)
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

  it('leaves capped production construction state and resources unchanged', () => {
    const state = openState('capped-production-action')
    const origin = state.tiles[Math.floor(state.tiles.length / 2)].position
    const positions = state.tiles
      .filter((tile) => getHexDistance(origin, tile.position) === 2)
      .map((tile) => tile.position)
      .reduce<Position[]>((selected, position) => {
        if (selected.every((other) => getHexDistance(other, position) >= 2)) {
          selected.push(position)
        }
        return selected
      }, [])
    const city = singleCellCity(origin)
    const sites: Site[] = positions.slice(0, 4).map((position, index) => ({
      id: `player-production-${index}`,
      name: `Production ${index}`,
      kind: (['farm', 'mine', 'blacksmith', 'farm'] as const)[index],
      position,
      ownerId: 'player',
      level: 1,
      buildings: [],
    }))
    const builder = civilian('builder', positions[4])
    const capped = {
      ...state,
      sites: [city, ...sites],
      units: [builder],
      selectedUnitId: builder.id,
    }

    expect(
      gameReducer(capped, {
        type: 'siteConstructed',
        unitId: builder.id,
        siteKind: 'farm',
      }),
    ).toBe(capped)
  })
})
