import { describe, expect, it } from 'vitest'
import { BOARD_SIZE_PRESETS, getHexDistance } from './hex'
import { createInitialGameState } from './initialState'
import { getMovementStepCost } from './movement'
import { createGameSession, gameSessionReducer } from './turnSummary'
import type { GameState, Site, Unit } from './types'

function exampleGame(): GameState {
  const initial = createInitialGameState('turn-report', { boardSize: BOARD_SIZE_PRESETS.tiny })
  const city: Site = {
    id: 'city', name: 'Capital', kind: 'city', ownerId: 'f1', capitalFor: 'f1',
    position: { q: 0, r: 0 }, buildings: [],
    constructionQueue: { buildingId: 'market', turnsRemaining: 1, startedTurn: 1 },
  }
  const farm: Site = {
    id: 'farm', name: 'Border Farm', kind: 'farm', ownerId: 'f1',
    position: { q: 5, r: 3 }, buildings: [], level: 1,
  }
  const scout: Unit = {
    id: 'scout', name: 'Scout', type: 'infantry', factionId: 'f1',
    hp: 1, maxHp: 100, hasActed: true, movementRemaining: 0, position: { q: 3, r: 2 },
  }
  return {
    ...initial,
    factionCount: 3, factionOrder: ['f1', 'f2', 'f3'], sites: [city, farm],
    resources: { ...initial.resources, f1: 1 }, difficulty: 'normal',
    units: [
      scout, { ...scout, id: 'guard', hp: 100, position: city.position },
      { ...scout, id: 'archer', factionId: 'f2', type: 'archer', hp: 100, position: { q: 4, r: 2 } },
      { ...scout, id: 'raider', factionId: 'f3', hp: 100, position: { q: 4, r: 3 } },
    ],
    tiles: initial.tiles.map((tile) => ({ ...tile, terrain: 'plain', siteId: undefined })),
  }
}

describe('movement in a game session', () => {
  it.each(['f1', 'f2'] as const)('charges %s for the path sent to the map', (factionId) => {
    const initial = exampleGame()
    const unit: Unit = {
      ...initial.units[0], type: 'cavalry', id: 'rider', factionId,
      position: { q: -3, r: -2 }, movementRemaining: 4, hasActed: false,
    }
    const water = { q: -2, r: -2 }, destination = { q: -1, r: -2 }
    const game: GameState = {
      ...initial, activeFactionId: factionId, selectedUnitId: unit.id, units: [unit],
      tiles: initial.tiles.map(tile => {
        if (tile.position.r !== -2) return tile
        if (tile.position.q === water.q) return { ...tile, terrain: 'water' }
        if (tile.position.q === destination.q) return { ...tile, terrain: 'forest' }
        return tile
      }),
    }
    const session = createGameSession(game)
    const move = { type: 'unitMoved' as const, unitId: unit.id, destination }
    expect(gameSessionReducer(session, { ...move, destination: water })).toBe(session)
    const moved = gameSessionReducer(session, move)
    const path = moved.movement!.path
    expect(path).toHaveLength(4)
    expect(path[0]).toEqual(unit.position)
    expect(path.at(-1)).toEqual(destination)
    expect(path.slice(1).every((step, i) => getHexDistance(path[i], step) === 1)).toBe(true)
    expect(path).not.toContainEqual(water)
    const cost = path.slice(1).reduce((sum, step, i) => sum + getMovementStepCost(game, path[i], step)!, 0)
    expect(cost).toBe(4)
    expect(moved.game.units[0].movementRemaining).toBe(unit.movementRemaining - cost)
    expect(moved.movement!.stoppedByZoneOfControl).toBe(false)
    expect(gameSessionReducer(moved, move)).toBe(moved)
    expect(gameSessionReducer(moved, { type: 'turnEnded' }).movement).toBeUndefined()
    expect(gameSessionReducer(moved, { type: 'gameLoaded', state: moved.game }).movement).toBeUndefined()
  })
})

describe('player turn summaries', () => {
  it('collects losses across AI factions and construction completed on return', () => {
    const game = exampleGame()
    let session = gameSessionReducer(createGameSession(game), { type: 'turnEnded' })
    const incomePaid = session.game.resources.f1 - game.resources.f1
    session = gameSessionReducer(session, { type: 'unitSelected', unitId: 'archer' })
    session = gameSessionReducer(session, { type: 'unitAttacked', attackerId: 'archer', defenderId: 'scout' })
    session = gameSessionReducer(session, { type: 'turnEnded' })
    expect(session.summary).toBeUndefined()
    session = gameSessionReducer(session, { type: 'unitSelected', unitId: 'raider' })
    session = gameSessionReducer(session, { type: 'unitMoved', unitId: 'raider', destination: { q: 5, r: 3 } })
    session = gameSessionReducer(session, { type: 'turnEnded' })
    expect(session.summary).toMatchObject({
      turn: 2, readyUnits: 1, resourceChange: incomePaid,
      lostUnits: [{ id: 'scout' }], lostSites: [{ id: 'farm' }],
      completed: [{ city: { id: 'city' }, building: 'market' }],
    })
    expect(gameSessionReducer(session, { type: 'gameLoaded', state: game }).summary).toBeUndefined()
    expect(gameSessionReducer(session, { type: 'gameRestarted', seed: 'new' }).summary).toBeUndefined()
  })

  it('records the actual negative balance change when upkeep is capped at zero', () => {
    const game = exampleGame()
    const session = createGameSession({ ...game, sites: [], factionCount: 2, factionOrder: ['f1', 'f2'] })
    const ai = gameSessionReducer(session, { type: 'turnEnded' })
    expect(ai.game.resources.f1).toBe(0)
    const next = gameSessionReducer(ai, { type: 'turnEnded' })
    expect(next.summary?.resourceChange).toBe(-1)
  })

  it('discards the pending report if the AI takes the player capital', () => {
    const game = exampleGame()
    const ai = createGameSession({
      ...game, activeFactionId: 'f2', selectedUnitId: 'archer',
      sites: game.sites.map((site) => site.capitalFor ? { ...site, hp: 1 } : site),
      units: game.units.map((unit) => unit.id === 'archer'
        ? { ...unit, hasActed: false, position: { q: 1, r: 0 } }
        : unit),
    })
    const end = gameSessionReducer(ai, { type: 'siteAttacked', attackerId: 'archer', siteId: 'city' })
    expect(end.game.phase).toBe('defeat')
    expect(end.summary).toBeUndefined()
    expect(end.beforeAi).toBeUndefined()
  })
})
