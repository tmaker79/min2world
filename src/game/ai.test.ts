import { describe, expect, it } from 'vitest'
import {
  chooseAiAction,
  compareAiSiteDevelopmentCandidates,
} from './ai'
import { getHexDistance } from './hex'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import { getDeployablePositions, getUnitProductionCost } from './rules'
import type { GameState, Site, Unit } from './types'

function enemyTurn(seed = 'ai-test'): GameState {
  return { ...createInitialGameState(seed), activeFactionId: 'enemy' }
}

function economyState(seed = 'ai-economy'): GameState {
  const initial = enemyTurn(seed)
  return {
    ...initial,
    resources: { ...initial.resources, enemy: 30 },
    tiles: initial.tiles.map((tile) => ({
      ...tile,
      terrain: 'plain' as const,
    })),
    units: [],
  }
}

function enemySite(state: GameState, overrides: Partial<Site> = {}): Site {
  const site = state.sites.find((candidate) => candidate.ownerId === 'enemy')!
  return {
    ...site,
    kind: 'outpost',
    footprint: undefined,
    level: undefined,
    lastProducedTurn: undefined,
    lastDevelopedTurn: undefined,
    ...overrides,
  }
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
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const player: Unit = {
      id: 'player-target', name: 'target', factionId: 'player', type: 'infantry',
      position: { q: 2, r: -1 }, hp: 30, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const state = { ...enemyTurn(), selectedUnitId: enemy.id, units: [enemy, player] }

    expect(chooseAiAction(state)).toEqual({
      type: 'unitAttacked', attackerId: enemy.id, defenderId: player.id,
    })
  })

  it('attacks an enemy unit before an attackable fortified site', () => {
    const initial = enemyTurn('ai-unit-before-site')
    const attacker: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const defender: Unit = {
      id: 'player-unit', name: 'unit', factionId: 'player', type: 'infantry',
      position: { q: 1, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 0, hasActed: true,
    }
    const site = enemySite(initial, {
      id: 'player-fort', ownerId: 'player', position: { q: 2, r: 0 },
      hp: 1, maxHp: 50,
    })
    const state = {
      ...initial, selectedUnitId: attacker.id, units: [attacker, defender], sites: [site],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'unitAttacked', attackerId: attacker.id, defenderId: defender.id,
    })
  })

  it('orders attackable sites by enemy capital, hp, then stable id', () => {
    const initial = enemyTurn('ai-site-order')
    const attacker: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const makeSite = (id: string, position: Site['position'], hp: number, capital = false) =>
      enemySite(initial, {
        id, ownerId: 'player', position, hp, maxHp: 50,
        capitalFor: capital ? 'player' : undefined,
      })
    const low = makeSite('a-low', { q: 1, r: 0 }, 1)
    const capital = makeSite('z-capital', { q: 2, r: 0 }, 40, true)
    const state = {
      ...initial, selectedUnitId: attacker.id, units: [attacker],
      sites: [low, capital],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: capital.id,
    })

    const equalHpSites = [
      makeSite('z-site', { q: 1, r: 0 }, 10),
      makeSite('a-site', { q: 2, r: 0 }, 10),
      makeSite('m-lowest', { q: 1, r: 1 }, 2),
    ]
    expect(chooseAiAction({ ...state, sites: equalHpSites })).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: 'm-lowest',
    })
    expect(chooseAiAction({ ...state, sites: equalHpSites.slice(0, 2) })).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: 'a-site',
    })
  })

  it('attacks a neutral fortified site', () => {
    const initial = enemyTurn('ai-neutral-site')
    const attacker: Unit = {
      id: 'enemy-infantry', name: 'infantry', factionId: 'enemy', type: 'infantry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const neutral = enemySite(initial, {
      id: 'neutral-fort', ownerId: 'neutral', position: { q: 1, r: 0 }, hp: 50,
    })
    const state = {
      ...initial, selectedUnitId: attacker.id, units: [attacker], sites: [neutral],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: neutral.id,
    })
  })

  it('moves into siege range without entering the fortified footprint', () => {
    const initial = enemyTurn('ai-move-to-siege-range')
    const attacker: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const capital = enemySite(initial, {
      id: 'player-capital', ownerId: 'player', capitalFor: 'player',
      kind: 'city', position: { q: 3, r: 0 },
      footprint: [{ q: 3, r: 0 }, { q: 4, r: 0 }],
      hp: 120, maxHp: 120,
    })
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      tiles: initial.tiles.map((tile) => ({ ...tile, terrain: 'plain' as const })),
      units: [attacker],
      sites: [capital],
    }
    const movement = chooseAiAction(state)

    expect(movement).toEqual({
      type: 'unitMoved', unitId: attacker.id, destination: { q: 1, r: 0 },
    })
    const moved = gameReducer(state, movement!)
    expect(capital.footprint).not.toContainEqual(moved.units[0].position)
    expect(chooseAiAction(moved)).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: capital.id,
    })
  })

  it('moves toward the player capital over a valid weighted hex path', () => {
    const initial = enemyTurn('ai-move-open')
    const capital = initial.sites.find((site) => site.capitalFor === 'player')!
    const movable = initial.units
      .filter((unit) => unit.factionId === 'enemy')
      .map((enemy) => {
        const state = {
          ...initial,
          selectedUnitId: enemy.id,
          units: initial.units.filter((unit) => unit.factionId === 'enemy'),
        }
        return { enemy, state, action: chooseAiAction(state) }
      })
      .find(({ action }) => action?.type === 'unitMoved')

    expect(movable?.action?.type).toBe('unitMoved')
    if (movable?.action?.type === 'unitMoved') {
      expect(movable.action.destination).not.toEqual(movable.enemy.position)
      expect(getHexDistance(movable.action.destination, capital.position)).toBeLessThanOrEqual(
        getHexDistance(movable.enemy.position, capital.position),
      )
      expect(gameReducer(movable.state, movable.action)).not.toBe(movable.state)
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

  it('develops one owned site after every unit has acted', () => {
    const initial = economyState('ai-develop')
    const site = enemySite(initial)
    const state = { ...initial, sites: [site] }

    expect(chooseAiAction(state)).toEqual({
      type: 'siteDeveloped',
      siteId: site.id,
      footprint: undefined,
    })
  })

  it('keeps five resources in reserve before development, then considers production', () => {
    const initial = economyState('ai-development-reserve')
    const site = enemySite(initial)
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 12 },
      sites: [site],
    }

    expect(chooseAiAction(state)).toMatchObject({
      type: 'unitProduced',
      siteId: site.id,
      unitType: 'infantry',
    })
  })

  it('skips settlement development when no valid footprint exists', () => {
    const initial = economyState('ai-no-footprint')
    const site = enemySite(initial, { kind: 'village' })
    const state = {
      ...initial,
      tiles: initial.tiles.map((tile) => ({
        ...tile,
        terrain:
          tile.position.q === site.position.q &&
          tile.position.r === site.position.r
            ? ('plain' as const)
            : ('water' as const),
      })),
      sites: [site],
    }

    expect(chooseAiAction(state)).toEqual({ type: 'turnEnded' })
  })

  it('allows at most one development for an AI faction each turn', () => {
    const initial = economyState('ai-one-development')
    const developed = enemySite(initial, {
      id: 'developed-farm',
      kind: 'farm',
      lastDevelopedTurn: initial.turn,
    })
    const available = enemySite(initial, {
      id: 'available-farm',
      kind: 'farm',
    })
    const state = { ...initial, sites: [available, developed] }

    expect(chooseAiAction(state)).toEqual({ type: 'turnEnded' })
  })

  it('sorts development candidates by stage, role, and finally site id', () => {
    const initial = economyState('ai-development-sort')
    const sites = [
      enemySite(initial, { id: 'z-keep', kind: 'keep' }),
      enemySite(initial, { id: 'z-farm', kind: 'farm', level: 1 }),
      enemySite(initial, { id: 'z-village', kind: 'village' }),
      enemySite(initial, { id: 'z-outpost', kind: 'outpost' }),
      enemySite(initial, { id: 'a-outpost', kind: 'outpost' }),
    ]

    expect([...sites].sort(compareAiSiteDevelopmentCandidates).map((site) => site.id))
      .toEqual([
        'a-outpost',
        'z-outpost',
        'z-village',
        'z-farm',
        'z-keep',
      ])
    expect(chooseAiAction({ ...initial, sites })).toMatchObject({
      type: 'siteDeveloped',
      siteId: 'a-outpost',
    })
  })

  it('can produce on the tick after development resolves', () => {
    const initial = economyState('ai-develop-then-produce')
    const site = enemySite(initial)
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 26 },
      sites: [site],
    }
    const development = chooseAiAction(state)!
    const developed = gameReducer(state, development)
    const production = chooseAiAction(developed)

    expect(development.type).toBe('siteDeveloped')
    expect(production).toMatchObject({
      type: 'unitProduced',
      siteId: site.id,
      unitType: 'spearman',
    })
  })

  it('does not produce locked unit types from an outpost', () => {
    const initial = economyState('ai-locked-production')
    const site = enemySite(initial, {
      lastDevelopedTurn: initial.turn,
    })
    const state = { ...initial, sites: [site] }

    expect(chooseAiAction(state)).toMatchObject({
      type: 'unitProduced',
      siteId: site.id,
      unitType: 'infantry',
    })
  })

  it('uses the Blacksmith discount when choosing an affordable unit', () => {
    const initial = economyState('ai-discount-production')
    const keep = enemySite(initial, { id: 'a-keep', kind: 'keep' })
    const blacksmithPosition = initial.tiles.find(
      (tile) =>
        tile.position.q !== keep.position.q ||
        tile.position.r !== keep.position.r,
    )!.position
    const blacksmith = enemySite(initial, {
      id: 'blacksmith',
      kind: 'blacksmith',
      level: 1,
      position: blacksmithPosition,
      lastDevelopedTurn: initial.turn,
    })
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 12 },
      sites: [keep, blacksmith],
    }

    expect(getUnitProductionCost(state, 'enemy', 'spearman')).toBe(12)
    expect(chooseAiAction(state)).toMatchObject({
      type: 'unitProduced',
      siteId: keep.id,
      unitType: 'spearman',
    })
  })

  it('constructs a granary in a peaceful City after unit actions', () => {
    const initial = economyState('ai-city-construction')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 100 },
      sites: [city],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'constructionStarted',
      siteId: city.id,
      buildingId: 'granary',
    })
  })

  it('prioritizes a wall when an enemy threatens a City', () => {
    const initial = economyState('ai-threatened-city')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    const threat: Unit = {
      id: 'nearby-player',
      name: 'Nearby player',
      factionId: 'player',
      type: 'infantry',
      position: city.position,
      hp: 100,
      maxHp: 100,
      movementRemaining: 0,
      hasActed: true,
    }
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 100 },
      sites: [city],
      units: [threat],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'constructionStarted',
      siteId: city.id,
      buildingId: 'wall',
    })
  })
})
