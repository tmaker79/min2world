import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { getReachablePositions, positionKey } from './rules'
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
})

