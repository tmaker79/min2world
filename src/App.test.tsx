import { StrictMode } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createInitialGameState } from './game/initialState'
import type { GameState } from './game/types'
import { SAVE_STORAGE_KEY, saveGame } from './storage/saveGame'

function setReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
}

beforeEach(() => {
  window.localStorage.clear()
  setReducedMotion(true)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

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

function createAiCombatUiState(): GameState {
  return {
    ...createInitialGameState(),
    units: [
      {
        id: 'ai-attacker',
        name: 'AI 시험 기병대',
        factionId: 'enemy',
        type: 'cavalry',
        position: { x: 5, y: 5 },
        hp: 10,
        maxHp: 10,
        movementRemaining: 3,
        hasActed: false,
      },
      {
        id: 'player-defender',
        name: '플레이어 시험 보병대',
        factionId: 'player',
        type: 'infantry',
        position: { x: 5, y: 4 },
        hp: 10,
        maxHp: 10,
        movementRemaining: 2,
        hasActed: false,
      },
    ],
  }
}

function createDefeatUiState(): GameState {
  const initial = createInitialGameState()

  return {
    ...initial,
    units: [
      {
        id: 'ai-capturer',
        name: 'AI 점령 부대',
        factionId: 'enemy',
        type: 'infantry',
        position: { x: 1, y: 7 },
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

  it('턴 종료 후 AI가 행동하고 다음 플레이어 라운드를 시작한다', async () => {
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
    expect(within(turnStatus!).getByText('1')).toBeInTheDocument()
    expect(screen.getByText('붉은 제국')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /AI 작전 중/ }),
    ).toBeDisabled()
    for (const tile of within(screen.getByTestId('game-map')).getAllByRole(
      'button',
    )) {
      expect(tile).toBeDisabled()
    }

    expect(
      await within(turnStatus!).findByText('2', {}, { timeout: 2000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('푸른 연맹')).toBeInTheDocument()
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
    expect(screen.getByText('붉은 제국')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(within(turnStatus!).getByText('1')).toBeInTheDocument()
    expect(
      await within(turnStatus!).findByText('2', {}, { timeout: 2000 }),
    ).toBeInTheDocument()
  })

  it('AI가 인접한 플레이어 유닛을 기존 전투 흐름으로 공격한다', async () => {
    const user = userEvent.setup()
    render(<App initialState={createAiCombatUiState()} />)

    await user.click(screen.getByRole('button', { name: '턴 종료' }))

    expect(
      await screen.findByRole(
        'button',
        { name: /플레이어 시험 보병대.*체력 5\/10/ },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /AI 시험 기병대.*체력 7\/10/ }),
    ).toBeInTheDocument()

    const turnStatus = screen.getByText('현재 턴').parentElement
    expect(turnStatus).not.toBeNull()
    expect(
      await within(turnStatus!).findByText('2', {}, { timeout: 1500 }),
    ).toBeInTheDocument()
  })

  it('공격 가능한 적을 강조하고 클릭 전투 결과를 표시한다', async () => {
    setReducedMotion(false)
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
    setReducedMotion(false)
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

  it('AI가 마지막 플레이어 도시를 점령하면 패배한다', async () => {
    const user = userEvent.setup()
    render(<App initialState={createDefeatUiState()} />)

    await user.click(screen.getByRole('button', { name: '턴 종료' }))

    expect(
      await screen.findByRole(
        'dialog',
        { name: '수도 함락' },
        { timeout: 1000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('1턴 만에 패배')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AI 작전 중/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '새 게임' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('푸른 연맹')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '턴 종료' })).toBeEnabled()
  })

  it('Strict Mode에서도 AI 예약 행동을 한 번씩만 실행한다', async () => {
    vi.useFakeTimers()
    const state = {
      ...createDefeatUiState(),
      activeFactionId: 'enemy' as const,
    }

    render(
      <StrictMode>
        <App initialState={state} />
      </StrictMode>,
    )

    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(
      screen.getByRole('button', { name: /AI 점령 부대/ }),
    ).toHaveAttribute('aria-pressed', 'true')

    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(
      screen.getByRole('dialog', { name: '수도 함락' }),
    ).toBeInTheDocument()
  })

  it('게임을 저장하고 이후 진행 상태를 저장 시점으로 복원한다', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)

    expect(screen.getByText('저장된 게임 없음')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '불러오기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /청룡 보병대/ }))
    await user.click(screen.getByRole('button', { name: /^좌표 1, 6, 평지/ }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(screen.getByRole('status')).toHaveTextContent('게임을 저장했습니다')
    expect(screen.getByText('1턴 저장')).toBeInTheDocument()
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull()

    await user.click(screen.getByRole('button', { name: /^좌표 1, 5, 평지/ }))
    expect(
      screen.getByRole('button', { name: /좌표 1, 5, 평지, 청룡 보병대/ }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '불러오기' }))

    expect(window.confirm).toHaveBeenCalledWith(
      '현재 진행을 중단하고 저장된 게임을 불러올까요?',
    )
    expect(
      screen.getByRole('button', { name: /좌표 1, 6, 평지, 청룡 보병대/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/지도에서 푸른 유닛을 선택/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '저장된 게임을 불러왔습니다',
    )
  })

  it('저장 슬롯을 발견하지만 사용자 확인 전에는 자동으로 불러오지 않는다', async () => {
    const savedState = createInitialGameState()
    savedState.turn = 4
    savedState.units = savedState.units.map((unit) =>
      unit.id === 'player-infantry-1'
        ? {
            ...unit,
            position: { x: 1, y: 6 },
            movementRemaining: 1,
          }
        : unit,
    )
    saveGame(savedState, window.localStorage, new Date('2026-08-13T07:30:00Z'))
    const confirm = vi.spyOn(window, 'confirm')
    confirm.mockReturnValueOnce(false).mockReturnValueOnce(true)
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('4턴 저장')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /좌표 1, 7.*청룡 보병대/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '불러오기' }))
    expect(screen.getByText('현재 턴').parentElement).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: /좌표 1, 7.*청룡 보병대/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '불러오기' }))
    expect(screen.getByText('현재 턴').parentElement).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /좌표 1, 6.*청룡 보병대/ })).toBeInTheDocument()
  })

  it('삭제 확인을 취소하거나 승인해 저장 슬롯을 관리한다', async () => {
    saveGame(createInitialGameState())
    const confirm = vi.spyOn(window, 'confirm')
    confirm.mockReturnValueOnce(false).mockReturnValueOnce(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull()
    expect(screen.getByText('1턴 저장')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull()
    expect(screen.getByText('저장된 게임 없음')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '저장된 게임을 삭제했습니다',
    )
  })

  it('손상된 저장을 안내하고 삭제할 수 있게 한다', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, '{broken')
    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      '저장 데이터가 손상되었습니다',
    )
    expect(screen.getByRole('button', { name: '불러오기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('AI 턴과 전투 중 저장과 불러오기를 차단한다', async () => {
    saveGame(createInitialGameState())
    const user = userEvent.setup()
    const aiState = {
      ...createInitialGameState(),
      activeFactionId: 'enemy' as const,
    }
    const { unmount } = render(<App initialState={aiState} />)

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '불러오기' })).toBeDisabled()
    unmount()

    setReducedMotion(false)
    render(<App initialState={createCombatUiState()} />)
    await user.click(screen.getByRole('button', { name: /화면 시험 보병대/ }))
    await user.click(
      screen.getByRole('button', { name: /화면 시험 기병대.*공격 가능/ }),
    )

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '불러오기' })).toBeDisabled()
  })

  it('결과 화면에서 저장된 플레이어 턴을 불러올 수 있다', async () => {
    saveGame(createInitialGameState())
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(
      <App
        initialState={{
          ...createInitialGameState(),
          phase: 'defeat',
          activeFactionId: 'enemy',
        }}
      />,
    )

    expect(screen.getByRole('dialog', { name: '수도 함락' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '불러오기' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '불러오기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('푸른 연맹')).toBeInTheDocument()
  })
})
