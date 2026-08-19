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
  getCombatDamage,
  getHealthCombatPenalty,
  resolveCombat,
  SITE_STATS,
  UNIT_MAX_HP,
  UNIT_STATS,
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
    hp: UNIT_MAX_HP,
    maxHp: UNIT_MAX_HP,
    movementRemaining: UNIT_STATS[type].movement,
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

  it('blocks water and mountains and charges 2 for rough climate terrain', () => {
    const infantry = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    let state = rulesState([infantry])
    state = withTerrain(state, { q: 1, r: 0 }, 'water')
    state = withTerrain(state, { q: 1, r: -1 }, 'mountain')
    state = withTerrain(state, { q: 0, r: 1 }, 'forest')
    state = withTerrain(state, { q: -1, r: 1 }, 'desert')
    state = withTerrain(state, { q: -1, r: 0 }, 'tundra')
    state = withTerrain(state, { q: 0, r: -1 }, 'tundraForest')
    state = withTerrain(state, { q: 2, r: -1 }, 'tundraMountain')

    expect(getMovementCost(state, infantry, { q: 1, r: 0 })).toBeUndefined()
    expect(getMovementCost(state, infantry, { q: 1, r: -1 })).toBeUndefined()
    expect(getMovementCost(state, infantry, { q: 0, r: 1 })).toBe(2)
    expect(getMovementCost(state, infantry, { q: -1, r: 1 })).toBe(2)
    expect(getMovementCost(state, infantry, { q: -1, r: 0 })).toBe(2)
    expect(getMovementCost(state, infantry, { q: 0, r: -1 })).toBe(2)
    expect(getMovementCost(state, infantry, { q: 2, r: -1 })).toBeUndefined()
  })

  it('treats an oasis as passable terrain with movement cost 1', () => {
    const infantry = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const state = withTerrain(rulesState([infantry]), { q: 1, r: 0 }, 'oasis')

    expect(getMovementCost(state, infantry, { q: 1, r: 0 })).toBe(1)
  })

  it('uses all six adjacent cells for enemy zone of control', () => {
    const enemy = unit('e1', 'enemy', 'infantry', { q: 0, r: 0 })
    expect(getEnemyZoneOfControlPositions(rulesState([enemy]), 'player')).toHaveLength(6)
  })

  it('allows moving through allies but not stopping on them', () => {
    const mover = unit('p1', 'player', 'cavalry', { q: 0, r: 0 })
    const ally = unit('p2', 'player', 'infantry', { q: 1, r: 0 })
    const state = rulesState([mover, ally])

    expect(getMovementCost(state, mover, ally.position)).toBeUndefined()
    expect(getMovementCost(state, mover, { q: 2, r: 0 })).toBe(2)
  })

  it('still blocks enemy-occupied tiles', () => {
    const mover = unit('p1', 'player', 'cavalry', { q: 0, r: 0 })
    const enemy = unit('e1', 'enemy', 'infantry', { q: 1, r: 0 })
    const state = rulesState([mover, enemy])

    expect(getMovementCost(state, mover, { q: 1, r: 0 })).toBeUndefined()
    expect(getMovementCost(state, mover, { q: 2, r: 0 })).toBeUndefined()
  })
})

describe('hex combat rules', () => {
  it('allows archers to attack at hex distance 2', () => {
    const archer = unit('p1', 'player', 'archer', { q: 0, r: 0 })
    const nearby = unit('e1', 'enemy', 'infantry', { q: 2, r: -1 })
    const far = unit('e2', 'enemy', 'infantry', { q: 2, r: 1 })

    expect(getAttackableUnits(rulesState([archer, nearby, far]), archer).map(({ id }) => id)).toEqual(['e1'])
  })

  it('applies forest and hill combat bonus to the striking unit', () => {
    const attacker = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const defender = unit('e1', 'enemy', 'infantry', { q: 1, r: 0 })
    const plain = resolveCombat(rulesState([attacker, defender]), attacker, defender)
    const forestState = withTerrain(
      rulesState([attacker, defender]),
      attacker.position,
      'forest',
    )
    const forest = resolveCombat(forestState, attacker, defender)
    const desertHillState = withTerrain(
      rulesState([attacker, defender]),
      attacker.position,
      'desertHill',
    )
    const desertHill = resolveCombat(desertHillState, attacker, defender)

    expect(plain.defenderHp).toBe(70)
    expect(plain.attackerHp).toBe(70)
    expect(forest.defenderHp).toBe(66)
    expect(forest.attackerHp).toBe(73)
    expect(desertHill).toEqual(forest)
  })

  it('never lets defenders return damage against archer attacks and uses ranged power', () => {
    const attacker = unit('p1', 'player', 'archer', { q: 0, r: 0 })
    const defender = unit('e1', 'enemy', 'infantry', { q: 1, r: 0 })
    const result = resolveCombat(rulesState([attacker, defender]), attacker, defender)

    expect(result.defenderHp).toBe(75)
    expect(result.attackerHp).toBe(UNIT_MAX_HP)
  })

  it('uses archer melee power when defending', () => {
    const attacker = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const defender = unit('e1', 'enemy', 'archer', { q: 1, r: 0 })
    const result = resolveCombat(rulesState([attacker, defender]), attacker, defender)

    expect(result.defenderHp).toBe(45)
    expect(result.attackerHp).toBe(84)
  })

  it('applies infantry bonus against spearmen on both sides of an exchange', () => {
    const infantry = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const spearman = unit('e1', 'enemy', 'spearman', { q: 1, r: 0 })
    const attack = resolveCombat(rulesState([infantry, spearman]), infantry, spearman)
    const reverse = resolveCombat(rulesState([spearman, infantry]), spearman, infantry)

    expect(attack.defenderHp).toBe(63)
    expect(attack.attackerHp).toBe(75)
    expect(reverse.defenderHp).toBe(75)
    expect(reverse.attackerHp).toBe(63)
  })

  it('applies spearman bonus against cavalry on both sides of an exchange', () => {
    const spearman = unit('p1', 'player', 'spearman', { q: 0, r: 0 })
    const cavalry = unit('e1', 'enemy', 'cavalry', { q: 1, r: 0 })
    const attack = resolveCombat(rulesState([spearman, cavalry]), spearman, cavalry)
    const reverse = resolveCombat(rulesState([cavalry, spearman]), cavalry, spearman)

    expect(attack.defenderHp).toBe(63)
    expect(attack.attackerHp).toBe(75)
    expect(reverse.defenderHp).toBe(75)
    expect(reverse.attackerHp).toBe(63)
  })

  it('uses the Civilization 6 damage curve and health strength loss', () => {
    expect(getCombatDamage(45, 45)).toBe(30)
    expect(getHealthCombatPenalty(unit('p1', 'player', 'infantry', { q: 0, r: 0 }))).toBe(0)
    expect(
      getHealthCombatPenalty(
        unit('p1', 'player', 'infantry', { q: 0, r: 0 }, { hp: 50 }),
      ),
    ).toBe(-5)

    const wounded = unit('p1', 'player', 'infantry', { q: 0, r: 0 }, { hp: 50 })
    const healthy = unit('e1', 'enemy', 'infantry', { q: 1, r: 0 })
    const result = resolveCombat(rulesState([wounded, healthy]), wounded, healthy)

    expect(result.defenderHp).toBe(75)
    expect(result.attackerHp).toBe(13)
  })

  it('still deals simultaneous return damage when the defender is defeated', () => {
    const attacker = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const defender = unit('e1', 'enemy', 'infantry', { q: 1, r: 0 }, { hp: 20 })
    const result = resolveCombat(rulesState([attacker, defender]), attacker, defender)

    expect(result.defenderHp).toBe(0)
    expect(result.attackerHp).toBe(78)
  })
})

describe('sites', () => {
  it('uses the configured income and production rules', () => {
    expect(SITE_STATS).toEqual({
      stronghold: { income: 5, canProduce: true },
      village: { income: 4, canProduce: false },
      farm: { income: 2, canProduce: false },
      mine: { income: 3, canProduce: false },
      city: { income: 0, canProduce: false },
    })

    const state = createInitialGameState('sites')
    const playerCapital = state.sites.find((site) => site.capitalFor === 'player')!
    const village = state.sites.find((site) => site.kind === 'village')!
    const farm = state.sites.find((site) => site.kind === 'farm')!
    expect(getFactionIncome(state, 'player')).toBe(5)
    expect(getDeployablePositions(state, playerCapital).length).toBeGreaterThan(0)
    expect(getDeployablePositions(state, village)).toEqual([])
    expect(getDeployablePositions(state, farm)).toEqual([])
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
