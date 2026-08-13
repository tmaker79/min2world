import { describe, expect, it } from 'vitest'
import { chooseAiAction } from './ai'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import { positionKey, UNIT_STATS } from './rules'
import type { GameState, Position, Terrain, Unit } from './types'

function createAiState({
  enemyPosition = { x: 5, y: 5 },
  playerUnits = [],
  playerCityPosition = { x: 5, y: 2 },
  terrain = [],
  selected = true,
}: {
  enemyPosition?: Position
  playerUnits?: Unit[]
  playerCityPosition?: Position
  terrain?: Array<{ position: Position; terrain: Terrain }>
  selected?: boolean
} = {}): GameState {
  const initial = createInitialGameState()
  const terrainByPosition = new Map(
    terrain.map((item) => [positionKey(item.position), item.terrain]),
  )
  const enemy: Unit = {
    id: 'enemy-cavalry',
    name: 'AI 기병대',
    factionId: 'enemy',
    type: 'cavalry',
    position: enemyPosition,
    hp: 10,
    maxHp: 10,
    movementRemaining: UNIT_STATS.cavalry.movement,
    hasActed: false,
  }

  return {
    ...initial,
    activeFactionId: 'enemy',
    selectedUnitId: selected ? enemy.id : undefined,
    tiles: initial.tiles.map((tile) => ({
      ...tile,
      terrain: terrainByPosition.get(positionKey(tile.position)) ?? 'plain',
    })),
    cities: [
      {
        id: 'player-city',
        name: '시험 성채',
        ownerId: 'player',
        position: playerCityPosition,
        resourcePerTurn: 5,
      },
    ],
    units: [enemy, ...playerUnits],
  }
}

function playerUnit(
  id: string,
  position: Position,
  hp = 10,
): Unit {
  return {
    id,
    name: id,
    factionId: 'player',
    type: 'infantry',
    position,
    hp,
    maxHp: 10,
    movementRemaining: UNIT_STATS.infantry.movement,
    hasActed: false,
  }
}

describe('chooseAiAction', () => {
  it('AI 턴이 아니거나 게임이 끝났으면 행동하지 않는다', () => {
    const state = createAiState()

    expect(
      chooseAiAction({ ...state, activeFactionId: 'player' }),
    ).toBeUndefined()
    expect(chooseAiAction({ ...state, phase: 'victory' })).toBeUndefined()
    expect(chooseAiAction({ ...state, phase: 'defeat' })).toBeUndefined()
  })

  it('미행동 유닛을 ID 오름차순으로 선택한다', () => {
    const state = createAiState({ selected: false })
    const second = {
      ...state.units[0],
      id: 'enemy-infantry',
      type: 'infantry' as const,
    }

    expect(chooseAiAction({ ...state, units: [state.units[0], second] })).toEqual({
      type: 'unitSelected',
      unitId: 'enemy-cavalry',
    })
  })

  it('인접한 대상 중 체력이 낮고 ID가 빠른 적을 우선 공격한다', () => {
    const state = createAiState({
      playerUnits: [
        playerUnit('target-b', { x: 5, y: 4 }, 4),
        playerUnit('target-a', { x: 6, y: 5 }, 4),
      ],
    })

    expect(chooseAiAction(state)).toEqual({
      type: 'unitAttacked',
      attackerId: 'enemy-cavalry',
      defenderId: 'target-a',
    })
  })

  it('공격 대상이 없으면 가중 경로로 플레이어 도시를 향해 이동한다', () => {
    const state = createAiState()

    expect(chooseAiAction(state)).toEqual({
      type: 'unitMoved',
      unitId: 'enemy-cavalry',
      destination: { x: 5, y: 2 },
    })
  })

  it('물과 산 비용을 피해 더 저렴한 도시 경로를 선택한다', () => {
    const state = createAiState({
      terrain: [
        { position: { x: 5, y: 4 }, terrain: 'water' },
        { position: { x: 4, y: 4 }, terrain: 'mountain' },
      ],
    })
    const action = chooseAiAction(state)

    expect(action).toEqual({
      type: 'unitMoved',
      unitId: 'enemy-cavalry',
      destination: { x: 6, y: 3 },
    })
  })

  it('적 통제 구역을 관통하지 않고 플레이어 유닛 앞에서 멈춘다', () => {
    const state = createAiState({
      playerCityPosition: { x: 5, y: 1 },
      playerUnits: [playerUnit('guard', { x: 6, y: 3 })],
    })
    const action = chooseAiAction(state)

    expect(action).toEqual({
      type: 'unitMoved',
      unitId: 'enemy-cavalry',
      destination: { x: 5, y: 3 },
    })
  })

  it('도시가 고립되면 도달 가능한 플레이어 유닛을 추적한다', () => {
    const state = createAiState({
      playerCityPosition: { x: 0, y: 0 },
      playerUnits: [playerUnit('field-unit', { x: 7, y: 5 })],
      terrain: [
        { position: { x: 1, y: 0 }, terrain: 'water' },
        { position: { x: 0, y: 1 }, terrain: 'water' },
      ],
    })

    expect(chooseAiAction(state)).toEqual({
      type: 'unitMoved',
      unitId: 'enemy-cavalry',
      destination: { x: 7, y: 4 },
    })
  })

  it('이동과 공격이 모두 불가능하면 대기한다', () => {
    const state = createAiState({
      terrain: [
        { position: { x: 5, y: 4 }, terrain: 'water' },
        { position: { x: 6, y: 5 }, terrain: 'water' },
        { position: { x: 5, y: 6 }, terrain: 'water' },
        { position: { x: 4, y: 5 }, terrain: 'water' },
      ],
    })

    expect(chooseAiAction(state)).toEqual({
      type: 'unitWaited',
      unitId: 'enemy-cavalry',
    })
  })

  it('모든 AI 유닛이 행동했으면 턴을 종료한다', () => {
    const state = createAiState({ selected: false })

    expect(
      chooseAiAction({
        ...state,
        units: state.units.map((unit) => ({ ...unit, hasActed: true })),
      }),
    ).toEqual({ type: 'turnEnded' })
  })

  it('모든 부대 행동 후 부족한 병종을 도시에서 생산한다', () => {
    const initial = createInitialGameState()
    const state: GameState = {
      ...initial,
      activeFactionId: 'enemy',
      units: initial.units.map((unit) =>
        unit.factionId === 'enemy'
          ? { ...unit, movementRemaining: 0, hasActed: true }
          : unit,
      ),
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'unitProduced',
      cityId: 'city-enemy',
      unitType: 'spearman',
      destination: { x: 8, y: 1 },
    })
  })

  it('자원이 부족하거나 도시가 이미 생산했으면 AI 턴을 종료한다', () => {
    const initial = createInitialGameState()
    const actedUnits = initial.units.map((unit) =>
      unit.factionId === 'enemy'
        ? { ...unit, movementRemaining: 0, hasActed: true }
        : unit,
    )
    const base: GameState = {
      ...initial,
      activeFactionId: 'enemy',
      units: actedUnits,
      resources: { ...initial.resources, enemy: 9 },
    }

    expect(chooseAiAction(base)).toEqual({ type: 'turnEnded' })
    expect(
      chooseAiAction({
        ...base,
        resources: { ...base.resources, enemy: 15 },
        cities: base.cities.map((city) =>
          city.id === 'city-enemy'
            ? { ...city, lastProducedTurn: base.turn }
            : city,
        ),
      }),
    ).toEqual({ type: 'turnEnded' })
  })

  it('같은 상태에서 같은 행동을 반환하고 원본을 변경하지 않는다', () => {
    const state = createAiState()
    const snapshot = structuredClone(state)

    expect(chooseAiAction(state)).toEqual(chooseAiAction(state))
    expect(state).toEqual(snapshot)
  })

  it('초기 배치의 AI 턴을 유효한 행동만으로 끝낸다', () => {
    const initial = createInitialGameState()
    let state = gameReducer(initial, { type: 'turnEnded' })

    for (let actionCount = 0; actionCount < 20; actionCount += 1) {
      const action = chooseAiAction(state)
      expect(action).toBeDefined()

      const nextState = gameReducer(state, action!)
      expect(nextState).not.toBe(state)
      state = nextState

      if (state.activeFactionId === 'player') {
        break
      }
    }

    expect(state.activeFactionId).toBe('player')
    expect(state.turn).toBe(2)
    expect(
      state.units
        .filter((unit) => unit.factionId === 'enemy')
        .some((unit) => unit.hasActed),
    ).toBe(true)
  })
})
