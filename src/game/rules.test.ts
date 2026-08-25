import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  captureSiteAt,
  getAttackableSites,
  getAttackableUnits,
  getDeployablePositions,
  getEnemyZoneOfControlPositions,
  getFactionIncome,
  getHexDistance,
  getMovementCost,
  getProducibleUnitTypes,
  getReachablePositions,
  getCombatDamage,
  getHealthCombatPenalty,
  getSiteIncome,
  getSiteMaxHp,
  getUnitProductionCost,
  isFortifiedSite,
  resolveCombat,
  resolveSiteCombat,
  SITE_STATS,
  CIVILIAN_UNIT_TYPES,
  MILITARY_UNIT_TYPES,
  UNIT_MAX_HP,
  UNIT_STATS,
} from './rules'
import type { GameState, Position, Site, Terrain, Unit, UnitType } from './types'

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
    tiles: state.tiles.map((tile) => ({
      ...tile,
      terrain: 'plain' as Terrain,
      siteId: undefined,
    })),
    units,
    sites: [],
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

  it('treats a bridge as passable terrain with movement cost 1', () => {
    const infantry = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const state = withTerrain(rulesState([infantry]), { q: 1, r: 0 }, 'bridge')

    expect(getMovementCost(state, infantry, { q: 1, r: 0 })).toBe(1)
  })

  it('uses all six adjacent cells for enemy zone of control', () => {
    const enemy = unit('e1', 'enemy', 'infantry', { q: 0, r: 0 })
    expect(
      getEnemyZoneOfControlPositions(
        { ...rulesState([enemy]), sites: [] },
        'player',
      ),
    ).toHaveLength(6)
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

  it('blocks every hostile or neutral fortified footprint but allows owned ones', () => {
    const mover = unit('p1', 'player', 'cavalry', { q: 0, r: 0 })
    const fortified: Site = {
      id: 'fort',
      name: 'Fort',
      kind: 'city',
      position: { q: 2, r: 0 },
      footprint: [{ q: 1, r: 0 }, { q: 2, r: 0 }],
      ownerId: 'neutral',
      hp: 120,
      maxHp: 120,
      buildings: [],
    }
    const blocked = { ...rulesState([mover]), sites: [fortified] }

    expect(getMovementCost(blocked, mover, { q: 1, r: 0 })).toBeUndefined()
    expect(
      getMovementCost(
        { ...blocked, sites: [{ ...fortified, ownerId: 'player' }] },
        mover,
        { q: 1, r: 0 },
      ),
    ).toBe(1)
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

  it('keeps civilian units noncombatant while allowing them to take damage', () => {
    const attacker = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const settler = unit('e1', 'enemy', 'settler', { q: 1, r: 0 })
    const state = rulesState([attacker, settler])

    expect(getAttackableUnits(state, settler)).toEqual([])
    expect(getAttackableSites(state, settler)).toEqual([])
    expect(resolveCombat(state, attacker, settler)).toMatchObject({
      attackerHp: 100,
      defenderHp: 0,
    })
    expect(
      resolveSiteCombat(state, settler, {
        id: 'outpost',
        name: 'Outpost',
        kind: 'outpost',
        position: { q: 1, r: 0 },
        ownerId: 'enemy',
        hp: 50,
        maxHp: 50,
        buildings: [],
      }),
    ).toEqual({ siteHp: 50 })
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

  it('damages fortified sites without return damage using site defense', () => {
    const attacker = unit('p1', 'player', 'infantry', { q: 0, r: 0 })
    const site: Site = {
      id: 'outpost',
      name: 'Outpost',
      kind: 'outpost',
      position: { q: 1, r: 0 },
      ownerId: 'enemy',
      hp: 50,
      maxHp: 50,
      buildings: [],
    }

    expect(getSiteMaxHp(site)).toBe(50)
    expect(isFortifiedSite(site)).toBe(true)
    expect(resolveSiteCombat(rulesState([attacker]), attacker, site)).toEqual({
      siteHp: 5,
    })
    expect(attacker.hp).toBe(100)
  })

  it('uses ranged power plus anchor terrain and site health defense modifiers', () => {
    const archer = unit('p1', 'player', 'archer', { q: 0, r: 0 })
    const site: Site = {
      id: 'outpost',
      name: 'Outpost',
      kind: 'outpost',
      position: { q: 1, r: 0 },
      ownerId: 'enemy',
      hp: 50,
      maxHp: 50,
      buildings: [],
    }
    const forest = withTerrain(
      rulesState([archer]),
      site.position,
      'forest',
    )

    expect(resolveSiteCombat(rulesState([archer]), archer, site).siteHp).toBe(13)
    expect(resolveSiteCombat(forest, archer, site).siteHp).toBe(18)
    expect(
      resolveSiteCombat(forest, archer, { ...site, hp: 25 }).siteHp,
    ).toBe(0)
  })

  it('attacks a fortified site through any footprint cell even when a unit occupies it', () => {
    const archer = unit('p1', 'player', 'archer', { q: 0, r: 0 })
    const blocker = unit('e1', 'enemy', 'infantry', { q: 2, r: 0 })
    const city: Site = {
      id: 'city',
      name: 'City',
      kind: 'city',
      position: { q: 3, r: 0 },
      footprint: [{ q: 3, r: 0 }, { q: 2, r: 0 }],
      ownerId: 'enemy',
      hp: 120,
      maxHp: 120,
      buildings: [],
    }
    const state = { ...rulesState([archer, blocker]), sites: [city] }

    expect(getAttackableSites(state, archer)).toEqual([city])
    expect(getAttackableUnits(state, archer)).toEqual([blocker])
    expect(
      getAttackableSites(
        { ...state, sites: [{ ...city, ownerId: 'neutral' }] },
        archer,
      ).map((site) => site.id),
    ).toEqual([city.id])
  })
})

describe('sites', () => {
  it('uses the configured income and production rules', () => {
    expect(SITE_STATS).toEqual({
      outpost: { income: 2, canProduce: true },
      keep: { income: 3, canProduce: true },
      stronghold: { income: 5, canProduce: true },
      village: { income: 3, canProduce: false },
      town: { income: 5, canProduce: false },
      city: { income: 7, canProduce: true },
      farm: { income: 2, canProduce: false },
      mine: { income: 3, canProduce: false },
      blacksmith: { income: 2, canProduce: false },
    })

    const state = createInitialGameState('sites')
    const playerCapital = state.sites.find((site) => site.capitalFor === 'player')!
    const farm = state.sites.find((site) => site.kind === 'farm')!
    const village = { ...farm, kind: 'village' as const, level: undefined }
    expect(getFactionIncome(state, 'player')).toBe(7)
    expect(getDeployablePositions(state, playerCapital).length).toBeGreaterThan(0)
    expect(getDeployablePositions(state, village)).toEqual([])
    expect(getDeployablePositions(state, farm)).toEqual([])
  })

  it('applies level income, unit unlocks, and the best owned blacksmith discount', () => {
    const state = createInitialGameState('site-balance')
    const ownerId = state.activeFactionId
    const blacksmith = {
      id: 'smith',
      name: 'Smith',
      kind: 'blacksmith' as const,
      level: 2 as const,
      position: { q: 0, r: 0 },
      ownerId,
      buildings: [],
    }
    const keep = { ...blacksmith, id: 'keep', kind: 'keep' as const, level: undefined }
    const city = { ...keep, id: 'city', kind: 'city' as const }
    const discounted = { ...state, sites: [blacksmith, keep] }

    expect(getSiteIncome(blacksmith)).toBe(3)
    expect(getProducibleUnitTypes(keep)).toEqual([
      'infantry',
      'spearman',
      'archer',
    ])
    expect(getProducibleUnitTypes(city)).toEqual([
      ...MILITARY_UNIT_TYPES,
      ...CIVILIAN_UNIT_TYPES,
    ])
    expect(getUnitProductionCost(discounted, ownerId, 'infantry')).toBe(9)
    expect(getUnitProductionCost(discounted, ownerId, 'archer')).toBe(14)
    expect(getUnitProductionCost(discounted, ownerId, 'cavalry')).toBe(18)
    expect(getUnitProductionCost(discounted, ownerId, 'settler')).toBe(30)
    expect(getUnitProductionCost(discounted, ownerId, 'builder')).toBe(15)
  })

  it('captures ordinary sites but requires combat for fortified sites', () => {
    const state = createInitialGameState('capture')
    const neutral: Site = {
      id: 'village',
      name: 'Village',
      kind: 'village',
      position: { q: 0, r: 0 },
      ownerId: 'neutral',
      buildings: [],
    }
    const enemyCapital = state.sites.find((site) => site.capitalFor === 'enemy')!
    const capturedNeutral = captureSiteAt([neutral, enemyCapital], neutral.position, 'player')
    const capturedCapital = captureSiteAt(capturedNeutral, enemyCapital.position, 'player')

    expect(capturedNeutral.find((site) => site.id === neutral.id)?.ownerId).toBe('player')
    expect(capturedCapital.find((site) => site.id === enemyCapital.id)?.capitalFor).toBe('enemy')
    expect(capturedCapital.find((site) => site.id === enemyCapital.id)?.ownerId).not.toBe(
      'player',
    )
  })

  it('captures a non-fortified multi-tile site only at its anchor', () => {
    const town: Site = {
      id: 'town',
      name: 'Town',
      kind: 'town',
      position: { q: 0, r: 0 },
      footprint: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: -1 }],
      ownerId: 'neutral',
      buildings: [],
    }

    expect(captureSiteAt([town], { q: 1, r: 0 }, 'player')).toEqual([town])
    expect(
      captureSiteAt([town], town.position, 'player')[0].ownerId,
    ).toBe('player')
  })
})
