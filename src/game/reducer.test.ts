import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import { getUnitAt } from './rules'
import type { GameState, Unit } from './types'

function createCombatState({
  attackerHp = 10,
  defenderHp = 10,
  defenderPosition = { x: 5, y: 4 },
  attackerHasActed = false,
  selected = true,
}: {
  attackerHp?: number
  defenderHp?: number
  defenderPosition?: { x: number; y: number }
  attackerHasActed?: boolean
  selected?: boolean
} = {}): GameState {
  const initialState = createInitialGameState()
  const units: Unit[] = [
    {
      id: 'attacker',
      name: '시험 보병대',
      factionId: 'player',
      type: 'infantry',
      position: { x: 5, y: 5 },
      hp: attackerHp,
      maxHp: 10,
      movementRemaining: 2,
      hasActed: attackerHasActed,
    },
    {
      id: 'defender',
      name: '시험 기병대',
      factionId: 'enemy',
      type: 'cavalry',
      position: defenderPosition,
      hp: defenderHp,
      maxHp: 10,
      movementRemaining: 3,
      hasActed: false,
    },
  ]

  return {
    ...initialState,
    selectedUnitId: selected ? 'attacker' : undefined,
    units,
  }
}

describe('gameReducer', () => {
  it('행동 가능한 플레이어 유닛을 선택하고 다시 선택하면 해제한다', () => {
    const initialState = createInitialGameState()
    const selected = gameReducer(initialState, {
      type: 'unitSelected',
      unitId: 'player-infantry-1',
    })
    const cleared = gameReducer(selected, {
      type: 'unitSelected',
      unitId: 'player-infantry-1',
    })

    expect(selected.selectedUnitId).toBe('player-infantry-1')
    expect(cleared.selectedUnitId).toBeUndefined()
  })

  it('적 유닛 선택 명령은 상태를 변경하지 않는다', () => {
    const state = createInitialGameState()

    expect(
      gameReducer(state, {
        type: 'unitSelected',
        unitId: 'enemy-infantry-1',
      }),
    ).toBe(state)
  })

  it('유효한 위치로 이동하고 원본 상태는 변경하지 않는다', () => {
    const initialState = createInitialGameState()
    const selected = gameReducer(initialState, {
      type: 'unitSelected',
      unitId: 'player-infantry-1',
    })
    const moved = gameReducer(selected, {
      type: 'unitMoved',
      unitId: 'player-infantry-1',
      destination: { x: 1, y: 6 },
    })
    const initialUnit = initialState.units.find(
      (unit) => unit.id === 'player-infantry-1',
    )
    const movedUnit = moved.units.find(
      (unit) => unit.id === 'player-infantry-1',
    )

    expect(initialUnit?.position).toEqual({ x: 1, y: 7 })
    expect(initialUnit?.hasActed).toBe(false)
    expect(movedUnit?.position).toEqual({ x: 1, y: 6 })
    expect(movedUnit?.movementRemaining).toBe(1)
    expect(movedUnit?.hasActed).toBe(false)
    expect(moved.selectedUnitId).toBe('player-infantry-1')
  })

  it('물, 점유 타일, 범위 밖으로 이동할 수 없다', () => {
    const initialState = createInitialGameState()
    const selected = gameReducer(initialState, {
      type: 'unitSelected',
      unitId: 'player-infantry-1',
    })

    for (const destination of [
      { x: 4, y: 7 },
      { x: 2, y: 7 },
      { x: -1, y: 7 },
    ]) {
      expect(
        gameReducer(selected, {
          type: 'unitMoved',
          unitId: 'player-infantry-1',
          destination,
        }),
      ).toBe(selected)
    }
  })

  it('남은 이동력만큼 연속 이동하고 소진 후에는 다시 행동할 수 없다', () => {
    const initialState = createInitialGameState()
    const selected = gameReducer(initialState, {
      type: 'unitSelected',
      unitId: 'player-infantry-1',
    })
    const moved = gameReducer(selected, {
      type: 'unitMoved',
      unitId: 'player-infantry-1',
      destination: { x: 1, y: 6 },
    })

    const exhausted = gameReducer(moved, {
      type: 'unitMoved',
      unitId: 'player-infantry-1',
      destination: { x: 1, y: 5 },
    })
    const exhaustedUnit = exhausted.units.find(
      (unit) => unit.id === 'player-infantry-1',
    )

    expect(exhaustedUnit?.position).toEqual({ x: 1, y: 5 })
    expect(exhaustedUnit?.movementRemaining).toBe(0)
    expect(exhaustedUnit?.hasActed).toBe(true)
    expect(
      gameReducer(exhausted, {
        type: 'unitMoved',
        unitId: 'player-infantry-1',
        destination: { x: 1, y: 4 },
      }),
    ).toBe(exhausted)

    const deselected = gameReducer(exhausted, { type: 'selectionCleared' })
    const inspected = gameReducer(deselected, {
      type: 'unitSelected',
      unitId: 'player-infantry-1',
    })
    expect(inspected.selectedUnitId).toBe('player-infantry-1')
  })

  it('턴 종료 시 턴과 행동 상태만 갱신하고 자원은 유지한다', () => {
    const initialState = createInitialGameState()
    const state = {
      ...initialState,
      selectedUnitId: 'player-infantry-1',
      units: initialState.units.map((unit) =>
        unit.id === 'player-infantry-1'
          ? { ...unit, movementRemaining: 0, hasActed: true }
          : unit,
      ),
    }
    const nextTurn = gameReducer(state, { type: 'turnEnded' })

    expect(nextTurn.turn).toBe(2)
    expect(nextTurn.selectedUnitId).toBeUndefined()
    expect(
      nextTurn.units.find((unit) => unit.id === 'player-infantry-1')?.hasActed,
    ).toBe(false)
    expect(
      nextTurn.units.find((unit) => unit.id === 'player-infantry-1')
        ?.movementRemaining,
    ).toBe(2)
    expect(nextTurn.resources).toEqual(state.resources)
  })

  it('인접한 적을 공격하고 생존한 양쪽 유닛의 체력을 갱신한다', () => {
    const state = createCombatState()
    const result = gameReducer(state, {
      type: 'unitAttacked',
      attackerId: 'attacker',
      defenderId: 'defender',
    })

    expect(result.units.find((unit) => unit.id === 'attacker')).toMatchObject({
      hp: 8,
      movementRemaining: 0,
      hasActed: true,
    })
    expect(result.units.find((unit) => unit.id === 'defender')?.hp).toBe(6)
    expect(result.selectedUnitId).toBeUndefined()
  })

  it('통제 구역 진입 시 이동은 멈추지만 인접한 적을 공격할 수 있다', () => {
    const state = createCombatState({ defenderPosition: { x: 5, y: 3 } })
    const moved = gameReducer(state, {
      type: 'unitMoved',
      unitId: 'attacker',
      destination: { x: 5, y: 4 },
    })
    const result = gameReducer(moved, {
      type: 'unitAttacked',
      attackerId: 'attacker',
      defenderId: 'defender',
    })

    expect(
      moved.units.find((unit) => unit.id === 'attacker')?.movementRemaining,
    ).toBe(0)
    expect(
      moved.units.find((unit) => unit.id === 'attacker')?.hasActed,
    ).toBe(false)
    expect(
      gameReducer(moved, {
        type: 'unitMoved',
        unitId: 'attacker',
        destination: { x: 4, y: 4 },
      }),
    ).toBe(moved)
    expect(result.units.find((unit) => unit.id === 'defender')?.hp).toBe(6)
    expect(
      result.units.find((unit) => unit.id === 'attacker'),
    ).toMatchObject({ movementRemaining: 0, hasActed: true })
  })

  it('통제 구역까지 이동력을 모두 사용한 유닛은 공격할 수 없다', () => {
    const state = createCombatState({ defenderPosition: { x: 5, y: 2 } })
    const moved = gameReducer(state, {
      type: 'unitMoved',
      unitId: 'attacker',
      destination: { x: 5, y: 3 },
    })
    const movedUnit = moved.units.find((unit) => unit.id === 'attacker')

    expect(movedUnit).toMatchObject({
      position: { x: 5, y: 3 },
      movementRemaining: 0,
      hasActed: true,
    })
    expect(
      gameReducer(moved, {
        type: 'unitAttacked',
        attackerId: 'attacker',
        defenderId: 'defender',
      }),
    ).toBe(moved)
  })

  it('공격으로 방어자가 사망하면 제거하고 반격을 적용하지 않는다', () => {
    const state = createCombatState({ defenderHp: 4 })
    const result = gameReducer(state, {
      type: 'unitAttacked',
      attackerId: 'attacker',
      defenderId: 'defender',
    })

    expect(result.units.find((unit) => unit.id === 'defender')).toBeUndefined()
    expect(getUnitAt(result, { x: 5, y: 4 })).toBeUndefined()
    expect(result.units.find((unit) => unit.id === 'attacker')?.hp).toBe(10)
  })

  it('공격자가 반격으로 사망하면 제거한다', () => {
    const state = createCombatState({ attackerHp: 2 })
    const result = gameReducer(state, {
      type: 'unitAttacked',
      attackerId: 'attacker',
      defenderId: 'defender',
    })

    expect(result.units.find((unit) => unit.id === 'attacker')).toBeUndefined()
    expect(result.units.find((unit) => unit.id === 'defender')?.hp).toBe(6)
  })

  it('유효하지 않은 공격은 상태를 변경하지 않는다', () => {
    const friendlyState = createCombatState()
    const states = [
      createCombatState({ defenderPosition: { x: 6, y: 4 } }),
      createCombatState({ attackerHasActed: true }),
      createCombatState({ selected: false }),
      {
        ...friendlyState,
        units: friendlyState.units.map((unit) => ({
          ...unit,
          factionId: 'player' as const,
        })),
      },
    ]

    for (const state of states) {
      expect(
        gameReducer(state, {
          type: 'unitAttacked',
          attackerId: 'attacker',
          defenderId: 'defender',
        }),
      ).toBe(state)
    }

    const state = createCombatState()
    expect(
      gameReducer(state, {
        type: 'unitAttacked',
        attackerId: 'attacker',
        defenderId: 'missing',
      }),
    ).toBe(state)
  })

  it('적 도시로 이동하면 도시를 점령하고 승리한다', () => {
    const initialState = createInitialGameState()
    const state: GameState = {
      ...initialState,
      selectedUnitId: 'capturer',
      units: [
        {
          id: 'capturer',
          name: '점령 부대',
          factionId: 'player',
          type: 'infantry',
          position: { x: 7, y: 1 },
          hp: 10,
          maxHp: 10,
          movementRemaining: 2,
          hasActed: false,
        },
      ],
    }
    const result = gameReducer(state, {
      type: 'unitMoved',
      unitId: 'capturer',
      destination: { x: 8, y: 1 },
    })

    expect(result.cities.find((city) => city.id === 'city-enemy')?.ownerId).toBe(
      'player',
    )
    expect(result.phase).toBe('victory')
  })

  it('승리 후 새 게임 외의 명령을 차단한다', () => {
    const state = { ...createInitialGameState(), phase: 'victory' as const }

    const actions = [
      { type: 'turnEnded' as const },
      { type: 'selectionCleared' as const },
      {
        type: 'unitSelected',
        unitId: 'player-infantry-1',
      } as const,
      {
        type: 'unitMoved',
        unitId: 'player-infantry-1',
        destination: { x: 1, y: 6 },
      } as const,
      {
        type: 'unitAttacked',
        attackerId: 'player-infantry-1',
        defenderId: 'enemy-infantry-1',
      } as const,
    ]

    for (const action of actions) {
      expect(gameReducer(state, action)).toBe(state)
    }
  })

  it('새 게임은 독립된 최신 초기 상태를 반환한다', () => {
    const state = {
      ...createInitialGameState(),
      phase: 'victory' as const,
      turn: 9,
    }
    const restarted = gameReducer(state, { type: 'gameRestarted' })

    expect(restarted).toEqual(createInitialGameState())
    expect(restarted).not.toBe(state)
    expect(restarted.units).not.toBe(state.units)
    expect(restarted.schemaVersion).toBe(3)
  })
})
