import { describe, expect, it } from 'vitest'
import { getHexNeighbors } from './hex'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import { getDeployablePositions, getFactionIncome } from './rules'
import type { GameState, Unit } from './types'

function select(state: GameState, unitId: string) {
  return gameReducer(state, { type: 'unitSelected', unitId })
}

describe('gameReducer on a hex map', () => {
  it('selects only the active faction and toggles selection', () => {
    const state = createInitialGameState('reducer-select')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const enemy = state.units.find((unit) => unit.factionId === 'enemy')!

    expect(select(state, enemy.id)).toBe(state)
    const selected = select(state, player.id)
    expect(selected.selectedUnitId).toBe(player.id)
    expect(select(selected, player.id).selectedUnitId).toBeUndefined()
  })

  it('moves onto natural terrain and captures a neutral site', () => {
    const initial = createInitialGameState('reducer-capture')
    const generatedNeutral = initial.sites.find((site) => site.ownerId === 'neutral')!
    const neutral = { ...generatedNeutral, kind: 'village' as const }
    const start = getHexNeighbors(neutral.position).find((position) =>
      initial.tiles.some((tile) =>
        tile.position.q === position.q && tile.position.r === position.r && tile.terrain !== 'water',
      ),
    )!
    const mover: Unit = {
      id: 'capture-unit', name: 'capture', factionId: 'player', type: 'cavalry',
      position: start, hp: 100, maxHp: 100, movementRemaining: 4, hasActed: false,
    }
    const state: GameState = {
      ...initial,
      units: [mover],
      sites: initial.sites.map((site) =>
        site.id === neutral.id ? neutral : site,
      ),
      tiles: initial.tiles.map((tile) =>
        (tile.position.q === start.q && tile.position.r === start.r) ||
        (tile.position.q === neutral.position.q && tile.position.r === neutral.position.r)
          ? { ...tile, terrain: 'plain' }
          : tile,
      ),
    }
    const moved = gameReducer(select(state, mover.id), {
      type: 'unitMoved', unitId: mover.id, destination: neutral.position,
    })

    expect(moved.units[0].position).toEqual(neutral.position)
    expect(moved.units[0].movementRemaining).toBe(3)
    expect(moved.sites.find((site) => site.id === neutral.id)?.ownerId).toBe('player')
  })

  it('captures an enemy capital at 50% health and wins immediately', () => {
    const initial = createInitialGameState('reducer-victory')
    const generatedCapital = initial.sites.find((site) => site.capitalFor === 'enemy')!
    const capital = { ...generatedCapital, hp: 1, maxHp: 100 }
    const start = getHexNeighbors(capital.position)[0]
    const attacker: Unit = {
      id: 'winner', name: 'winner', factionId: 'player', type: 'infantry',
      position: start, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker],
      sites: initial.sites.map((site) =>
        site.id === capital.id ? capital : site,
      ),
      tiles: initial.tiles.map((tile) =>
        tile.position.q === capital.position.q && tile.position.r === capital.position.r
          ? { ...tile, terrain: 'plain' as const }
          : tile,
      ),
    }

    const result = gameReducer(state, {
      type: 'siteAttacked', attackerId: attacker.id, siteId: capital.id,
    })
    expect(result.phase).toBe('victory')
    expect(result.sites.find((site) => site.id === capital.id)).toMatchObject({
      ownerId: 'player',
      hp: 50,
      maxHp: 100,
      capitalFor: 'enemy',
    })
    expect(result.factionOrder).not.toContain('enemy')
    expect(result.units[0]).toMatchObject({
      movementRemaining: 0,
      hasActed: true,
    })
    expect(result.selectedUnitId).toBeUndefined()
  })

  it('loses immediately when the human capital falls to a site attack', () => {
    const initial = createInitialGameState('reducer-defeat')
    const generatedCapital = initial.sites.find(
      (site) => site.capitalFor === initial.humanFactionId,
    )!
    const capital = { ...generatedCapital, hp: 1, maxHp: 100 }
    const start = getHexNeighbors(capital.position)[0]
    const attacker: Unit = {
      id: 'enemy-winner',
      name: 'enemy winner',
      factionId: 'enemy',
      type: 'infantry',
      position: start,
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const state = {
      ...initial,
      activeFactionId: 'enemy' as const,
      selectedUnitId: attacker.id,
      units: [attacker],
      sites: initial.sites.map((site) =>
        site.id === capital.id ? capital : site,
      ),
    }

    const result = gameReducer(state, {
      type: 'siteAttacked',
      attackerId: attacker.id,
      siteId: capital.id,
    })
    expect(result.phase).toBe('defeat')
    expect(result.sites.find((site) => site.id === capital.id)).toMatchObject({
      ownerId: 'enemy',
      hp: 50,
      capitalFor: initial.humanFactionId,
    })
    expect(result.factionOrder).toEqual(state.factionOrder)
  })

  it('rejects movement outside the unit range', () => {
    const state = createInitialGameState('reducer-invalid')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const selected = select(state, player.id)
    expect(gameReducer(selected, {
      type: 'unitMoved', unitId: player.id, destination: { q: 6, r: 0 },
    })).toBe(selected)
  })

  it("resolves a valid adjacent attack and consumes the attacker's action", () => {
    const initial = createInitialGameState('reducer-combat')
    const attacker: Unit = {
      id: 'attacker', name: 'attacker', factionId: 'player', type: 'infantry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const defender: Unit = {
      id: 'defender', name: 'defender', factionId: 'enemy', type: 'infantry',
      position: { q: 1, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const state = {
      ...initial,
      units: [attacker, defender],
      tiles: initial.tiles.map((tile) =>
        (tile.position.q === 0 && tile.position.r === 0) ||
        (tile.position.q === 1 && tile.position.r === 0)
          ? { ...tile, terrain: 'plain' as const }
          : tile,
      ),
    }
    const result = gameReducer(select(state, attacker.id), {
      type: 'unitAttacked', attackerId: attacker.id, defenderId: defender.id,
    })

    expect(result.units.find((unit) => unit.id === attacker.id)).toMatchObject({ hp: 70, hasActed: true })
    expect(result.units.find((unit) => unit.id === defender.id)?.hp).toBe(70)
    expect(result.selectedUnitId).toBeUndefined()
  })

  it('reduces fortified site health and rejects invalid site attacks', () => {
    const initial = createInitialGameState('reducer-site-combat')
    const attacker: Unit = {
      id: 'attacker', name: 'attacker', factionId: 'player', type: 'infantry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const site = {
      id: 'outpost',
      name: 'Outpost',
      kind: 'outpost' as const,
      position: { q: 1, r: 0 },
      ownerId: 'enemy' as const,
      hp: 50,
      maxHp: 50,
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker],
      sites: [site],
      tiles: initial.tiles.map((tile) => ({
        ...tile,
        terrain: 'plain' as const,
      })),
    }

    const result = gameReducer(state, {
      type: 'siteAttacked',
      attackerId: attacker.id,
      siteId: site.id,
    })
    expect(result.sites[0]).toMatchObject({ ownerId: 'enemy', hp: 5, maxHp: 50 })
    expect(
      gameReducer({ ...state, selectedUnitId: undefined }, {
        type: 'siteAttacked',
        attackerId: attacker.id,
        siteId: site.id,
      }),
    ).toEqual({ ...state, selectedUnitId: undefined })
  })

  it('produces only at an owned production site and charges resources', () => {
    const initial = createInitialGameState('reducer-produce')
    const site = initial.sites.find((candidate) => candidate.capitalFor === 'player')!
    const destination = getDeployablePositions(initial, site)[0]
    const produced = gameReducer(initial, {
      type: 'unitProduced', siteId: site.id, unitType: 'infantry', destination,
    })

    expect(produced.units).toHaveLength(initial.units.length + 1)
    expect(produced.resources.player).toBe(initial.resources.player - 10)
    expect(produced.selectedUnitId).toBeUndefined()
    expect(produced.sites.find((candidate) => candidate.id === site.id)?.lastProducedTurn).toBe(1)
    expect(gameReducer(produced, {
      type: 'unitProduced', siteId: site.id, unitType: 'infantry', destination,
    })).toBe(produced)
  })

  it('routes site development and validates production unlocks and discounts', () => {
    const initial = createInitialGameState('reducer-development')
    const ownerId = initial.activeFactionId
    const site = {
      id: 'outpost',
      name: 'Outpost',
      kind: 'outpost' as const,
      position: { q: 0, r: 0 },
      ownerId,
    }
    const blacksmith = {
      ...site,
      id: 'blacksmith',
      kind: 'blacksmith' as const,
      level: 1 as const,
      position: { q: 3, r: 0 },
    }
    const state = {
      ...initial,
      resources: { ...initial.resources, [ownerId]: 100 },
      units: [],
      sites: [site, blacksmith],
      tiles: initial.tiles.map((tile) => ({
        ...tile,
        terrain: 'plain' as const,
        siteId:
          tile.position.q === site.position.q &&
          tile.position.r === site.position.r
            ? site.id
            : undefined,
      })),
    }
    const developed = gameReducer(state, {
      type: 'siteDeveloped',
      siteId: site.id,
    })
    const keep = developed.sites.find((candidate) => candidate.id === site.id)!
    expect(keep.kind).toBe('keep')
    expect(developed.resources[ownerId]).toBe(92)

    const destination = getDeployablePositions(developed, keep)[0]
    expect(
      gameReducer(developed, {
        type: 'unitProduced',
        siteId: keep.id,
        unitType: 'cavalry',
        destination,
      }),
    ).toBe(developed)
    const produced = gameReducer(developed, {
      type: 'unitProduced',
      siteId: keep.id,
      unitType: 'infantry',
      destination,
    })
    expect(produced.resources[ownerId]).toBe(83)
  })

  it('adds the ending faction income and refreshes the next faction', () => {
    const state = createInitialGameState('reducer-turn')
    const income = getFactionIncome(state, 'player')
    const result = gameReducer(state, { type: 'turnEnded' })

    expect(result.activeFactionId).toBe('enemy')
    expect(result.resources.player).toBe(state.resources.player + income)
    expect(result.units.filter((unit) => unit.factionId === 'enemy').every((unit) => !unit.hasActed)).toBe(true)
  })

  it('restarts deterministically with the requested seed even after game over', () => {
    const over = { ...createInitialGameState('old'), phase: 'defeat' as const }
    const restarted = gameReducer(over, { type: 'gameRestarted', seed: 'new-seed' })

    expect(restarted).toEqual(createInitialGameState('new-seed'))
    expect(gameReducer(over, { type: 'turnEnded' })).toBe(over)
  })

  it('preserves the requested map type when restarting', () => {
    const state = createInitialGameState('old-forest', {
      mapType: 'forested',
      humanFactionId: 'f1',
    })
    const restarted = gameReducer(state, {
      type: 'gameRestarted',
      seed: 'new-forest',
      mapType: state.mapType,
    })

    expect(restarted.mapSeed).toBe('new-forest')
    expect(restarted.mapType).toBe('forested')
  })
})
