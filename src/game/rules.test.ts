import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  captureCityAt,
  getAttackableUnits,
  getEnemyZoneOfControlPositions,
  getMovementCost,
  getReachablePositions,
  ownsAllCities,
  positionKey,
  resolveCombat,
  UNIT_STATS,
} from './rules'
import type { GameState, Position, Terrain, UnitType } from './types'

function createMovementState({
  unitType = 'infantry',
  terrain = [],
  blockers = [],
}: {
  unitType?: UnitType
  terrain?: Array<{ position: Position; terrain: Terrain }>
  blockers?: Position[]
} = {}): GameState {
  const state = createInitialGameState()
  const terrainByPosition = new Map(
    terrain.map((item) => [positionKey(item.position), item.terrain]),
  )

  return {
    ...state,
    tiles: state.tiles.map((tile) => ({
      ...tile,
      terrain: terrainByPosition.get(positionKey(tile.position)) ?? 'plain',
    })),
    units: [
      {
        id: 'test-unit',
        name: '시험 부대',
        factionId: 'player',
        type: unitType,
        position: { x: 5, y: 5 },
        hp: 10,
        maxHp: 10,
        movementRemaining: UNIT_STATS[unitType].movement,
        hasActed: false,
      },
      ...blockers.map((position, index) => ({
        id: `blocker-${index}`,
        name: `방해 부대 ${index}`,
        factionId: 'enemy' as const,
        type: 'infantry' as const,
        position,
        hp: 10,
        maxHp: 10,
        movementRemaining: UNIT_STATS.infantry.movement,
        hasActed: false,
      })),
    ],
  }
}

function reachableKeys(state: GameState) {
  return new Set(getReachablePositions(state, state.units[0]).map(positionKey))
}

describe('getReachablePositions', () => {
  it('보병은 평지에서 상하좌우로 이동력 2만큼 이동한다', () => {
    const reachable = reachableKeys(createMovementState())

    expect(reachable).toContain('5,3')
    expect(reachable).toContain('6,6')
    expect(reachable).not.toContain('5,2')
    expect(reachable).not.toContain('5,5')
  })

  it('물과 점유 타일은 통과하거나 도착할 수 없다', () => {
    const state = createMovementState({
      terrain: [{ position: { x: 4, y: 5 }, terrain: 'water' }],
      blockers: [{ x: 5, y: 4 }],
    })
    const reachable = reachableKeys(state)

    expect(reachable).not.toContain('4,5')
    expect(reachable).not.toContain('5,4')
    expect(reachable).not.toContain('5,3')
  })

  it('산 진입 비용 2를 적용하고 대각선으로 직접 이동하지 않는다', () => {
    const state = createMovementState({
      terrain: [
        { position: { x: 5, y: 4 }, terrain: 'mountain' },
        { position: { x: 6, y: 5 }, terrain: 'mountain' },
      ],
      blockers: [
        { x: 5, y: 6 },
        { x: 4, y: 5 },
      ],
    })
    const reachable = reachableKeys(state)

    expect(reachable).toContain('5,4')
    expect(reachable).toContain('6,5')
    expect(reachable).not.toContain('6,4')
  })

  it('기병은 보병보다 한 칸 더 멀리 이동한다', () => {
    const infantryReachable = reachableKeys(createMovementState())
    const cavalryReachable = reachableKeys(
      createMovementState({ unitType: 'cavalry' }),
    )

    expect(infantryReachable).not.toContain('5,2')
    expect(cavalryReachable).toContain('5,2')
  })

  it('행동을 마친 유닛에는 이동 가능 위치를 반환하지 않는다', () => {
    const state = createMovementState()
    state.units[0] = { ...state.units[0], hasActed: true }

    expect(getReachablePositions(state, state.units[0])).toEqual([])
  })

  it('현재 남은 이동력까지만 이동 범위와 비용을 계산한다', () => {
    const state = createMovementState()
    state.units[0] = { ...state.units[0], movementRemaining: 1 }
    const reachable = reachableKeys(state)

    expect(reachable).toContain('5,4')
    expect(reachable).not.toContain('5,3')
    expect(getMovementCost(state, state.units[0], { x: 5, y: 4 })).toBe(1)
    expect(
      getMovementCost(state, state.units[0], { x: 5, y: 3 }),
    ).toBeUndefined()
  })

  it('적 통제 구역에는 진입할 수 있지만 관통할 수 없다', () => {
    const state = createMovementState({
      unitType: 'cavalry',
      blockers: [{ x: 6, y: 4 }],
    })
    const reachable = reachableKeys(state)

    expect(reachable).toContain('5,4')
    expect(getMovementCost(state, state.units[0], { x: 5, y: 4 })).toBe(1)
    expect(reachable).not.toContain('5,3')
  })

  it('턴 시작부터 적 통제 구역에 있으면 구역 밖으로 이동할 수 있다', () => {
    const state = createMovementState({ blockers: [{ x: 5, y: 4 }] })

    expect(reachableKeys(state)).toContain('5,7')
  })

  it('적 유닛의 상하좌우 인접 위치만 통제 구역으로 반환한다', () => {
    const state = createMovementState({ blockers: [{ x: 6, y: 4 }] })
    const zoneOfControl = new Set(
      getEnemyZoneOfControlPositions(state, 'player').map(positionKey),
    )

    expect(zoneOfControl).toEqual(
      new Set(['6,3', '7,4', '6,5', '5,4']),
    )
    expect(zoneOfControl).not.toContain('5,3')
  })
})

describe('combat rules', () => {
  it('유닛 종류별 이동력, 공격력과 반격력을 제공한다', () => {
    expect(UNIT_STATS).toEqual({
      infantry: { movement: 2, attack: 4, counterAttack: 3, range: 1, cost: 10 },
      cavalry: { movement: 3, attack: 5, counterAttack: 2, range: 1, cost: 15 },
      archer: { movement: 2, attack: 3, counterAttack: 1, range: 2, cost: 12 },
      spearman: { movement: 2, attack: 3, counterAttack: 5, range: 1, cost: 12 },
    })
  })

  it('궁병은 맨해튼 거리 2까지 공격하고 근접 방어자는 반격하지 못한다', () => {
    const state = createMovementState({
      unitType: 'archer',
      blockers: [{ x: 6, y: 6 }],
    })
    const [archer, defender] = state.units

    expect(getAttackableUnits(state, archer).map((unit) => unit.id)).toEqual([
      defender.id,
    ])
    expect(resolveCombat(archer, defender)).toEqual({
      attackerHp: 10,
      defenderHp: 7,
    })
  })

  it('궁병끼리는 거리 2에서도 반격하며 창병은 기병에게 추가 피해를 준다', () => {
    const state = createMovementState({
      unitType: 'archer',
      blockers: [{ x: 5, y: 3 }],
    })
    const [archer, defender] = state.units
    const enemyArcher = { ...defender, type: 'archer' as const }
    const spearman = { ...archer, type: 'spearman' as const }
    const cavalry = { ...defender, position: { x: 5, y: 4 }, type: 'cavalry' as const }

    expect(resolveCombat(archer, enemyArcher)).toEqual({
      attackerHp: 9,
      defenderHp: 7,
    })
    expect(resolveCombat(spearman, cavalry)).toEqual({
      attackerHp: 8,
      defenderHp: 5,
    })
    expect(resolveCombat(cavalry, spearman)).toEqual({
      attackerHp: 3,
      defenderHp: 5,
    })
  })

  it('상하좌우로 인접한 적 유닛만 공격 대상으로 반환한다', () => {
    const state = createMovementState({
      blockers: [
        { x: 5, y: 4 },
        { x: 6, y: 6 },
        { x: 5, y: 2 },
      ],
    })

    expect(getAttackableUnits(state, state.units[0]).map((unit) => unit.id)).toEqual([
      'blocker-0',
    ])
  })

  it('방어자가 생존하면 공격 피해 후 반격 피해를 계산한다', () => {
    const state = createMovementState({ blockers: [{ x: 5, y: 4 }] })
    const [attacker, defender] = state.units

    expect(resolveCombat(attacker, defender)).toEqual({
      attackerHp: 7,
      defenderHp: 6,
    })
  })

  it('방어자가 공격으로 사망하면 반격하지 않는다', () => {
    const state = createMovementState({ blockers: [{ x: 5, y: 4 }] })
    const [attacker, defender] = state.units

    expect(resolveCombat(attacker, { ...defender, hp: 4 })).toEqual({
      attackerHp: 10,
      defenderHp: 0,
    })
  })
})

describe('city rules', () => {
  it('도시 소유권을 변경하고 모든 도시 소유 여부를 판정한다', () => {
    const state = createInitialGameState()
    const cities = captureCityAt(state.cities, { x: 8, y: 1 }, 'player')

    expect(cities).not.toBe(state.cities)
    expect(cities.find((city) => city.id === 'city-enemy')?.ownerId).toBe(
      'player',
    )
    expect(ownsAllCities(cities, 'player')).toBe(true)
  })
})
