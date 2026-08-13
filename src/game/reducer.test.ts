import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'

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
    expect(movedUnit?.hasActed).toBe(true)
    expect(moved.selectedUnitId).toBeUndefined()
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

  it('행동을 마친 유닛은 턴 종료 전까지 다시 선택할 수 없다', () => {
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

    expect(
      gameReducer(moved, {
        type: 'unitSelected',
        unitId: 'player-infantry-1',
      }),
    ).toBe(moved)
  })

  it('턴 종료 시 턴과 행동 상태만 갱신하고 자원은 유지한다', () => {
    const initialState = createInitialGameState()
    const state = {
      ...initialState,
      selectedUnitId: 'player-infantry-1',
      units: initialState.units.map((unit) =>
        unit.id === 'player-infantry-1' ? { ...unit, hasActed: true } : unit,
      ),
    }
    const nextTurn = gameReducer(state, { type: 'turnEnded' })

    expect(nextTurn.turn).toBe(2)
    expect(nextTurn.selectedUnitId).toBeUndefined()
    expect(
      nextTurn.units.find((unit) => unit.id === 'player-infantry-1')?.hasActed,
    ).toBe(false)
    expect(nextTurn.resources).toEqual(state.resources)
  })
})

