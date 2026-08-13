import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  captureSiteAt,
  getAttackableUnits,
  getCapitalPhase,
  getDeployablePositions,
  getEnemyZoneOfControlPositions,
  getFactionIncome,
  getHexDistance,
  getMovementCost,
  getReachablePositions,
  resolveCombat,
  SITE_STATS,
} from './rules'
import type { GameState, Position, Terrain, Unit, UnitType } from './types'

function unit(
  id: string,
  factionId: 'player' | 'enemy',
  type: UnitType,
  position: Position,
  overrides: Partial<Unit> = {},
): Unit {
  return {
    id,
    name: id,
    factionId,
    type,
    position,
    hp: 10,
    maxHp: 10,
    movementRemaining: type === 'cavalry' ? 3 : 2,
    hasActed: false,
    ...overrides,
  }
}

function rulesState(units: Unit[] = []): GameState {
  const state = createInitialGameState('rules-test')
  return {
    ...state,
    tiles: state.tiles.map((tile) => ({ ...tile, terrain: 'plain' as Terrain })),
    units,
  }
}

function withTerrain(state: GameState, position: Position, terrain: Terrain) {
  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      getHexDistance(tile.position, position) === 0 ? { ...tile, terrain } : tile,
    ),
  }
}

describe('hex movement rules', () => {
  it('reaches all cells within movement 2 on open terrain', () => {
    const infantry = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const reachable = getReachablePositions(rulesState([infantry]), infantry)

    expect(reachable).toHaveLength(18)
    expect(reachable.every((position) => getHexDistance(position, infantry.position) <= 2)).toBe(true)
  })

  it('blocks water and charges 2 for rough terrain', () => {
    const infantry = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    let state = rulesState([infantry])
    state = withTerrain(state, { q: 1, r: 0 }, 'water')
    state = withTerrain(state, { q: 0, r: 1 }, 'forest')

    expect(getMovementCost(state, infantry, { q: 1, r: 0 })).toBeUndefined()
    expect(getMovementCost(state, infantry, { q: 0, r: 1 })).toBe(2)
  })

  it('charges 0.5 between consecutive road cells and 1 to enter or leave', () => {
    const cavalry = unit('p1', 'player', 'cavalry', { q: 0, r: 0 })
    let state = rulesState([cavalry])
    state = withTerrain(state, { q: 0, r: 0 }, 'road')
    state = withTerrain(state, { q: 1, r: 0 }, 'road')
    state = withTerrain(state, { q: 2, r: 0 }, 'road')

    expect(getMovementCost(state, cavalry, { q: 1, r: 0 })).toBe(0.5)
    expect(getMovementCost(state, cavalry, { q: 2, r: 0 })).toBe(1)
    expect(getMovementCost(state, cavalry, { q: 2, r: -1 })).toBe(1.5)
  })

  it('uses all six adjacent cells for enemy zone of control', () => {
    const enemy = unit('e1', 'enemy', 'infantry', { q: 0, r: 0 })
    expect(getEnemyZoneOfControlPositions(rulesState([enemy]), 'player')).toHaveLength(6)
  })
})

describe('hex combat rules', () => {
  it('allows archers to attack at hex distance 2', () => {
    const archer = unit('p1', 'player', 'archer', { q: 0, r: 0 })
    const nearby = unit('e1', 'enemy', 'infantry', { q: 2, r: -1 })
    const far = unit('e2', 'enemy', 'infantry', { q: 2, r: 1 })

    expect(getAttackableUnits(rulesState([archer, nearby, far]), archer).map(({ id }) => id)).toEqual(['e1'])
  })

  it.each([
    ['plain', 6],
    ['forest', 7],
    ['hill', 7],
    ['mountain', 8],
  ] as const)('applies %s defense to incoming damage', (terrain, expectedHp) => {
    const attacker = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const defender = unit('e1', 'enemy', 'infantry', { q: 1, r: 0 })
    const state = withTerrain(rulesState([attacker, defender]), defender.position, terrain)

    expect(resolveCombat(state, attacker, defender).defenderHp).toBe(expectedHp)
  })

  it('keeps attack and counterattack damage at a minimum of 1', () => {
    const attacker = unit('p1', 'player', 'archer', { q: 0, r: 0 })
    const defender = unit('e1', 'enemy', 'archer', { q: 1, r: 0 })
    let state = withTerrain(rulesState([attacker, defender]), defender.position, 'mountain')
    state = withTerrain(state, attacker.position, 'mountain')
    const result = resolveCombat(state, attacker, defender)

    expect(result.defenderHp).toBe(9)
    expect(result.attackerHp).toBe(9)
  })

  it('gives spearmen their cavalry bonus', () => {
    const attacker = unit('p1', 'player', 'spearman', { q: 0, r: 0 })
    const defender = unit('e1', 'enemy', 'cavalry', { q: 1, r: 0 })
    expect(resolveCombat(rulesState([attacker, defender]), attacker, defender).defenderHp).toBe(5)
  })
})

describe('sites', () => {
  it('uses the configured income and production rules', () => {
    expect(SITE_STATS).toEqual({
      stronghold: { income: 5, canProduce: true },
      city: { income: 4, canProduce: true },
      village: { income: 2, canProduce: false },
      mine: { income: 3, canProduce: false },
    })

    const state = createInitialGameState('sites')
    const playerCapital = state.sites.find((site) => site.capitalFor === 'player')!
    const village = state.sites.find((site) => site.kind === 'village')!
    expect(getFactionIncome(state, 'player')).toBe(5)
    expect(getDeployablePositions(state, playerCapital).length).toBeGreaterThan(0)
    expect(getDeployablePositions(state, village)).toEqual([])
  })

  it('captures neutral sites while preserving immutable capital ownership', () => {
    const state = createInitialGameState('capture')
    const neutral = state.sites.find((site) => site.ownerId === 'neutral')!
    const enemyCapital = state.sites.find((site) => site.capitalFor === 'enemy')!
    const capturedNeutral = captureSiteAt(state.sites, neutral.position, 'player')
    const capturedCapital = captureSiteAt(capturedNeutral, enemyCapital.position, 'player')

    expect(capturedNeutral.find((site) => site.id === neutral.id)?.ownerId).toBe('player')
    expect(capturedCapital.find((site) => site.id === enemyCapital.id)?.capitalFor).toBe('enemy')
    expect(getCapitalPhase(capturedCapital)).toBe('victory')
  })
})
