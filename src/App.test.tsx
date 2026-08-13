import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createInitialGameState } from './game/initialState'
import type { GameState } from './game/types'

function createCombatUiState(
  defenderHp = 10,
  defenderPosition = { x: 5, y: 4 },
): GameState {
  return {
    ...createInitialGameState(),
    units: [
      {
        id: 'ui-attacker',
        name: '화면 시험 보병대',
        factionId: 'player',
        type: 'infantry',
        position: { x: 5, y: 5 },
        hp: 10,
        maxHp: 10,
        movementRemaining: 2,
        hasActed: false,
      },
      {
        id: 'ui-defender',
        name: '화면 시험 기병대',
        factionId: 'enemy',
        type: 'cavalry',
        position: defenderPosition,
        hp: defenderHp,
        maxHp: 10,
        movementRemaining: 3,
        hasActed: false,
      },
    ],
  }
}

function createVictoryUiState(): GameState {
  return {
    ...createInitialGameState(),
    units: [
      {
        id: 'capturer',
        name: '화면 점령 부대',
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
}

describe('App', () => {
  it('10×10 지도와 양쪽 세력의 도시 및 유닛을 표시한다', () => {
    render(<App />)
    const map = screen.getByTestId('game-map')

    expect(within(map).getAllByRole('button')).toHaveLength(100)
    expect(screen.getByRole('button', { name: /푸른 성채/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /붉은 요새/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /청룡 보병대/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /적월 보병대/ })).toBeInTheDocument()
    expect(document.querySelector('[data-unit-id="player-infantry-1"]')).toHaveAttribute(
      'data-health',
      '10/10',
    )
  })

  it('유닛을 선택하면 정보와 이동 가능한 타일을 표시한다', async () => {
    const user = userEvent.setup()
    render(<App />)

    const unitTile = screen.getByRole('button', { name: /청룡 보병대/ })
    await user.click(unitTile)

    expect(unitTile).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('청룡 보병대')).toBeInTheDocument()
    expect(screen.getByText('행동 가능')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-reachable="true"].map-tile').length).toBeGreaterThan(0)
  })

  it('이동 가능한 타일을 클릭하면 유닛을 이동시킨다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /청룡 보병대/ }))
    await user.click(screen.getByRole('button', { name: /^좌표 1, 6, 평지/ }))

    expect(
      screen.getByRole('button', { name: /좌표 1, 6, 평지, 청룡 보병대/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('청룡 보병대')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('행동 가능')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-reachable="true"].map-tile').length).toBeGreaterThan(0)

    await user.click(
      screen.getByRole('button', { name: /^좌표 1, 5, 평지/ }),
    )

    expect(
      screen.getByRole('button', { name: /좌표 1, 5, 평지, 청룡 보병대/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('0 / 2')).toBeInTheDocument()
    expect(screen.getByText('행동 완료')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-reachable="true"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-attackable="true"]')).toHaveLength(0)
  })

  it('턴 종료 시 턴 번호를 올리고 유닛 행동 상태를 초기화한다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /청룡 보병대/ }))
    await user.click(screen.getByRole('button', { name: /^좌표 1, 5, 평지/ }))
    expect(
      screen.getByRole('button', { name: /청룡 보병대.*행동 완료/ }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '턴 종료' }))

    const turnStatus = screen.getByText('현재 턴').parentElement
    expect(turnStatus).not.toBeNull()
    expect(within(turnStatus!).getByText('2')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /청룡 보병대.*행동 가능/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('Enter 키로 턴을 종료한다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.keyboard('{Enter}')

    const turnStatus = screen.getByText('현재 턴').parentElement
    expect(turnStatus).not.toBeNull()
    expect(within(turnStatus!).getByText('2')).toBeInTheDocument()
  })

  it('공격 가능한 적을 강조하고 클릭 전투 결과를 표시한다', async () => {
    const user = userEvent.setup()
    render(<App initialState={createCombatUiState()} />)

    await user.click(screen.getByRole('button', { name: /화면 시험 보병대/ }))

    const attackableEnemy = screen.getByRole('button', {
      name: /화면 시험 기병대.*공격 가능/,
    })
    expect(attackableEnemy).toHaveAttribute('data-attackable', 'true')
    expect(attackableEnemy).toHaveClass('map-tile--attackable')
    expect(screen.getByText('공격력').parentElement).toHaveTextContent('4')
    expect(screen.getByText('반격력').parentElement).toHaveTextContent('3')

    await user.click(attackableEnemy)

    expect(screen.getByRole('button', { name: '턴 종료' })).toBeDisabled()
    expect(document.querySelector('[data-unit-id="ui-attacker"]')).toHaveClass(
      'unit-token--striking',
    )
    await user.keyboard('{Enter}')
    expect(await screen.findByText('-4')).toBeInTheDocument()

    expect(
      await screen.findByRole(
        'button',
        { name: /화면 시험 보병대.*체력 8\/10.*행동 완료/ },
        { timeout: 1500 },
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /화면 시험 기병대.*체력 6\/10/,
      }),
    ).toBeInTheDocument()
    expect(document.querySelector('[data-unit-id="ui-attacker"]')).toHaveAttribute(
      'data-health',
      '8/10',
    )
    expect(document.querySelector('[data-unit-id="ui-defender"]')).toHaveAttribute(
      'data-health',
      '6/10',
    )
    expect(screen.queryByText('화면 시험 보병대')).not.toBeInTheDocument()
    const turnStatus = screen.getByText('현재 턴').parentElement
    expect(turnStatus).not.toBeNull()
    expect(within(turnStatus!).getByText('1')).toBeInTheDocument()
  })

  it('통제 구역을 표시하고 진입 후 이동을 멈춘 채 공격을 허용한다', async () => {
    const user = userEvent.setup()
    render(<App initialState={createCombatUiState(10, { x: 5, y: 3 })} />)

    await user.click(screen.getByRole('button', { name: /화면 시험 보병대/ }))

    const controlledTile = screen.getByRole('button', {
      name: /좌표 5, 4, 평지, 적 통제 구역/,
    })
    expect(controlledTile).toHaveAttribute('data-reachable', 'true')
    expect(controlledTile).toHaveAttribute('data-zone-of-control', 'true')

    await user.click(controlledTile)

    expect(screen.getByText('0 / 2')).toBeInTheDocument()
    expect(screen.getByText('공격만 가능')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-reachable="true"]')).toHaveLength(0)
    expect(
      screen.getByRole('button', {
        name: /화면 시험 기병대.*공격 가능/,
      }),
    ).toHaveAttribute('data-attackable', 'true')
  })

  it('전투에서 사망한 유닛에 제거 모션을 표시한다', async () => {
    const user = userEvent.setup()
    render(<App initialState={createCombatUiState(4)} />)

    await user.click(screen.getByRole('button', { name: /화면 시험 보병대/ }))
    await user.click(
      screen.getByRole('button', { name: /화면 시험 기병대.*공격 가능/ }),
    )

    expect(await screen.findByText('-4')).toBeInTheDocument()
    expect(document.querySelector('[data-unit-id="ui-defender"]')).toHaveClass(
      'unit-token--defeated',
    )
    expect(
      await screen.findByRole(
        'button',
        { name: /^좌표 5, 4, 평지$/ },
        { timeout: 1200 },
      ),
    ).toBeInTheDocument()
  })

  it('적 도시를 점령하면 승리하고 새 게임으로 초기화한다', async () => {
    const user = userEvent.setup()
    render(<App initialState={createVictoryUiState()} />)

    await user.click(screen.getByRole('button', { name: /화면 점령 부대/ }))
    await user.click(screen.getByRole('button', { name: /붉은 요새/ }))

    expect(
      screen.getByRole('dialog', { name: '대륙 통일' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1턴 만에 승리')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '턴 종료' })).toBeDisabled()
    for (const tile of within(screen.getByTestId('game-map')).getAllByRole(
      'button',
    )) {
      expect(tile).toBeDisabled()
    }

    await user.click(screen.getByRole('button', { name: '새 게임' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /청룡 보병대/ })).toBeEnabled()
    const turnStatus = screen.getByText('현재 턴').parentElement
    expect(turnStatus).not.toBeNull()
    expect(within(turnStatus!).getByText('1')).toBeInTheDocument()
  })
})
