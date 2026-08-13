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
    const neutral = initial.sites.find((site) => site.ownerId === 'neutral')!
    const start = getHexNeighbors(neutral.position).find((position) =>
      initial.tiles.some((tile) =>
        tile.position.q === position.q && tile.position.r === position.r && tile.terrain !== 'water',
      ),
    )!
    const mover: Unit = {
      id: 'capture-unit', name: 'capture', factionId: 'player', type: 'cavalry',
      position: start, hp: 10, maxHp: 10, movementRemaining: 3, hasActed: false,
    }
    const state: GameState = {
      ...initial,
      units: [mover],
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
    expect(moved.units[0].movementRemaining).toBe(2)
    expect(moved.sites.find((site) => site.id === neutral.id)?.ownerId).toBe('player')
  })

  it('wins immediately when the enemy capital is occupied', () => {
    const initial = createInitialGameState('reducer-victory')
    const capital = initial.sites.find((site) => site.capitalFor === 'enemy')!
    const start = getHexNeighbors(capital.position)[0]
    const attacker: Unit = {
      id: 'winner', name: 'winner', factionId: 'player', type: 'infantry',
      position: start, hp: 10, maxHp: 10, movementRemaining: 2, hasActed: false,
    }
    const state = {
      ...initial,
      units: [attacker],
      tiles: initial.tiles.map((tile) =>
        tile.position.q === capital.position.q && tile.position.r === capital.position.r
          ? { ...tile, terrain: 'plain' as const }
          : tile,
      ),
    }

    const result = gameReducer(select(state, attacker.id), {
      type: 'unitMoved', unitId: attacker.id, destination: capital.position,
    })
    expect(result.phase).toBe('victory')
    expect(result.sites.find((site) => site.id === capital.id)?.capitalFor).toBe('enemy')
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
      position: { q: 0, r: 0 }, hp: 10, maxHp: 10, movementRemaining: 2, hasActed: false,
    }
    const defender: Unit = {
      id: 'defender', name: 'defender', factionId: 'enemy', type: 'infantry',
      position: { q: 1, r: 0 }, hp: 10, maxHp: 10, movementRemaining: 2, hasActed: false,
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

    expect(result.units.find((unit) => unit.id === attacker.id)).toMatchObject({ hp: 7, hasActed: true })
    expect(result.units.find((unit) => unit.id === defender.id)?.hp).toBeLessThan(10)
    expect(result.selectedUnitId).toBeUndefined()
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
    expect(produced.sites.find((candidate) => candidate.id === site.id)?.lastProducedTurn).toBe(1)
    expect(gameReducer(produced, {
      type: 'unitProduced', siteId: site.id, unitType: 'infantry', destination,
    })).toBe(produced)
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
})
