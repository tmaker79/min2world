import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getHexNeighbors, HEX_TILE_COUNT, positionKey } from './game/hex'
import { createInitialGameState } from './game/initialState'
import type { GameState, Unit } from './game/types'

function renderApp(state: GameState = createInitialGameState('ui-seed')) {
  return render(<App initialState={state} />)
}

describe('Milestone 07 UI', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('starts only a tiny two-faction game with the selected side', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'min2world' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '지도 크기 선택' })).toHaveValue('tiny')
    expect(screen.getByRole('option', { name: '초소형 · 21 × 14' })).toBeDisabled()
    expect(screen.getByRole('option', { name: '소형 · 42 × 28' })).toBeDisabled()
    expect(screen.getByRole('option', { name: '중형 · 84 × 56' })).toBeDisabled()
    expect(screen.queryByRole('slider', { name: '세력 수' })).not.toBeInTheDocument()
    const factionSelect = screen.getByRole('combobox', { name: '세력 선택' })
    expect(factionSelect.querySelectorAll('option')).toHaveLength(2)
    await user.selectOptions(factionSelect, 'f2')
    await user.click(screen.getByRole('button', { name: '게임 시작' }))

    const map = await screen.findByTestId('game-map')
    expect(map.querySelector('.unit-token--f2')).toBeInTheDocument()
  })

  it('renders visible keyboard-focusable pointy hex tiles and the current seed', () => {
    const { container } = renderApp()
    const map = screen.getByTestId('game-map')
    const tiles = map.querySelectorAll<HTMLButtonElement>('.map-tile')

    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.length).toBeLessThan(HEX_TILE_COUNT)
    expect([...tiles].every((tile) => tile.type === 'button' && !tile.disabled)).toBe(true)
    expect(container.querySelector('.app-chrome__seed')).toHaveTextContent('ui-seed')
    expect(container.querySelectorAll('.site-marker')).toHaveLength(8)
    expect(container.querySelectorAll('.unit-token')).toHaveLength(6)
    expect(container.querySelector('.map-layer--terrain .map-tile')).toBeInTheDocument()
    expect(container.querySelector('.map-layer--sites .site-marker')).toBeInTheDocument()
    expect(container.querySelector('.map-layer--units .unit-token')).toBeInTheDocument()
    expect(container.querySelector('.map-layer--units .unit-health-bar')).toBeInTheDocument()
    expect(container.querySelector('.unit-health-bar')?.closest('.map-tile')).toBeNull()
    expect(container.querySelector('.site-marker')?.closest('.map-tile')).toBeNull()
    const sidebar = screen.getByLabelText('지도 사이드바')
    const minimap = screen.getByTestId('minimap')
    expect(sidebar).toContainElement(minimap)
    expect(container.querySelector('.map-stage')).not.toContainElement(minimap)
    expect(screen.getByLabelText('선택 정보')).toHaveTextContent(
      '유닛이나 거점을 선택하면 상세 정보가 표시됩니다.',
    )
    expect(screen.queryByRole('button', { name: /미니맵 (접기|펼치기)/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('정보 패널')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '도움말' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '범례' })).not.toBeInTheDocument()
  }, 20_000)

  it('keeps the minimap visible without a collapse control', () => {
    renderApp()

    expect(screen.getByLabelText('미니맵')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /미니맵 (접기|펼치기)/ })).not.toBeInTheDocument()
  })

  it('centers the player capital when a game starts', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const state = createInitialGameState('center-capital')
    const capital = state.sites.find((site) => site.capitalFor === 'player')!
    const { container } = renderApp(state)
    const mapScroll = container.querySelector<HTMLElement>('.map-scroll')!
    const capitalTile = container.querySelector<HTMLElement>(
      `.map-tile[data-coordinate="${positionKey(capital.position)}"]`,
    )!

    Object.defineProperties(mapScroll, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, writable: true, value: 0 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    })
    vi.spyOn(mapScroll, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
    } as DOMRect)
    vi.spyOn(capitalTile, 'getBoundingClientRect').mockReturnValue({
      left: 900,
      top: 550,
      width: 58,
      height: 66,
    } as DOMRect)

    act(() => {
      for (const frame of frames.splice(0)) frame(0)
    })

    expect(mapScroll.scrollLeft).toBe(429)
    expect(mapScroll.scrollTop).toBe(233)
  })

  it('shows a compact unit summary tooltip on hover without changing selection', async () => {
    vi.useFakeTimers()
    const state = createInitialGameState('ui-tooltip')
    const enemy = state.units.find((unit) => unit.factionId === 'enemy')!
    const enemyTile = state.tiles.find(
      (tile) => positionKey(tile.position) === positionKey(enemy.position),
    )!
    enemyTile.terrain = 'forest'
    const { container } = renderApp(state)
    const tile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(enemy.position)}"]`,
    )!

    fireEvent.mouseEnter(tile)

    expect(document.querySelector(`[data-unit-tooltip="${enemy.id}"]`)).toBeNull()

    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(document.querySelector(`[data-unit-tooltip="${enemy.id}"]`)).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    const tooltip = document.querySelector(
      `[data-unit-tooltip="${enemy.id}"]`,
    )!
    expect(tooltip).toBeVisible()
    expect(tooltip).toHaveTextContent(`붉은 제국 - ${enemy.name}`)
    expect(tooltip).toHaveTextContent('숲')
    expect(tooltip).toHaveTextContent('이동 비용')
    expect(tooltip).toHaveTextContent('2')
    expect(tooltip).toHaveTextContent('방어 보정치')
    expect(tooltip).toHaveTextContent('+3')
    expect(tooltip.querySelector('dl')).toBeInTheDocument()
    expect(
      [...tooltip.querySelectorAll('dt')].some(
        (label) => label.textContent === '지형',
      ),
    ).toBe(false)
    expect(tooltip).not.toHaveTextContent('체력')

    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows terrain details in a tooltip while no unit is selected', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-terrain-info')
    const plain = state.tiles.find(
      (tile) =>
        tile.terrain === 'plain' &&
        !state.units.some(
          (unit) =>
            unit.position.q === tile.position.q &&
            unit.position.r === tile.position.r,
        ),
    )!
    const { container } = renderApp(state)
    const tile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(plain.position)}"]`,
    )!

    await user.hover(tile)

    const tooltip = await waitFor(() => {
      const next = document.querySelector(
        `[data-terrain-tooltip="${positionKey(plain.position)}"]`,
      )
      expect(next).toBeVisible()
      return next
    }, { timeout: 1500 })
    expect(tooltip).toHaveTextContent('평지')
    expect(tooltip).not.toHaveTextContent('좌표')
    expect(tooltip).toHaveTextContent('이동 비용')
    expect(tooltip).toHaveTextContent('1')
    expect(tooltip).not.toHaveTextContent('방어 보정치')
    expect(tooltip).not.toHaveTextContent('없음')

    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()
  })

  it('selects a unit with keyboard Enter and exposes reachable hexes', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-keyboard')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    const tile = container.querySelector<HTMLButtonElement>(
      `[data-coordinate="${positionKey(player.position)}"]`,
    )!

    tile.focus()
    await user.keyboard('{Enter}')

    expect(tile).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelectorAll('[data-reachable="true"]').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('지도 사이드바')).toContainElement(
      screen.getByLabelText('부대 정보'),
    )
    const unitInfo = screen.getByLabelText('부대 정보')
    const unitMenu = screen.getByRole('toolbar', { name: '유닛 메뉴' })
    expect(
      unitInfo.compareDocumentPosition(unitMenu) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /요새화/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /방어/ })).toBeDisabled()
    expect(screen.queryByText('미구현')).not.toBeInTheDocument()
    expect(container.querySelector('.map-stage')).not.toContainElement(
      unitInfo,
    )
  })

  it('moves the selected unit onto a reachable axial cell with right-click', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-move')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
    )!)
    const destination = container.querySelector<HTMLButtonElement>('[data-reachable="true"]')!
    const destinationKey = destination.dataset.coordinate

    fireEvent.contextMenu(destination)
    expect(container.querySelector(`[data-unit-id="${player.id}"]`)).toHaveAttribute(
      'data-coordinate',
      destinationKey,
    )
  })

  it('does not move on left-click of a reachable cell', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-move-left')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
    )!)
    const destination = container.querySelector<HTMLButtonElement>('[data-reachable="true"]')!
    const originKey = positionKey(player.position)

    await user.click(destination)
    expect(container.querySelector(`[data-unit-id="${player.id}"]`)).toHaveAttribute(
      'data-coordinate',
      originKey,
    )
    expect(container.querySelectorAll('[data-reachable="true"]').length).toBeGreaterThan(0)
  })

  it('starts a deterministic game from a trimmed seed and validates empty input', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()

    await user.click(screen.getByRole('button', { name: '새 게임' }))
    const input = container.querySelector<HTMLInputElement>('.seed-controls input')!
    const submit = container.querySelector<HTMLButtonElement>(
      '.seed-controls button[type="submit"]',
    )!

    await user.clear(input)
    await user.click(submit)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.type(input, '  next-map  ')
    await user.click(submit)
    expect(container.querySelector('.app-chrome__seed')).toHaveTextContent('next-map')
    expect(container.querySelectorAll('.map-tile').length).toBeLessThan(
      HEX_TILE_COUNT,
    )
  })

  it('asks before replacing a game that has progressed', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('progress')
    state.turn = 2
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = renderApp(state)

    await user.click(screen.getByRole('button', { name: '새 게임' }))
    const input = container.querySelector<HTMLInputElement>('.seed-controls input')!

    await user.clear(input)
    await user.type(input, 'blocked-seed')
    await user.click(
      container.querySelector<HTMLButtonElement>('.seed-controls button[type="submit"]')!,
    )

    expect(confirm).toHaveBeenCalledOnce()
    expect(container.querySelector('.app-chrome__seed')).toHaveTextContent('progress')
  })

  it('opens city information before offering production from an owned stronghold', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-production')
    const stronghold = state.sites.find(
      (site) => site.ownerId === 'player' && site.kind === 'stronghold',
    )!
    const { container } = renderApp(state)

    expect(container.querySelector('.production-card')).toBeNull()

    const strongholdTile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(stronghold.position)}"]`,
    )!
    await user.click(strongholdTile)

    const cityInfo = screen.getByLabelText('성 정보')
    const cityMenu = screen.getByRole('tablist', { name: '성 메뉴' })
    expect(cityInfo).toBeVisible()
    expect(screen.getByLabelText('지도 사이드바')).toContainElement(
      cityInfo,
    )
    expect(
      cityInfo.compareDocumentPosition(cityMenu) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText(stronghold.name)).toBeVisible()
    expect(screen.getByRole('tab', { name: /건설/ })).toBeDisabled()
    expect(screen.queryByText('미구현')).not.toBeInTheDocument()
    expect(container.querySelector('.production-card')).toBeNull()

    await user.click(screen.getByRole('tab', { name: '생산' }))
    expect(
      cityMenu.compareDocumentPosition(screen.getByLabelText('부대 생산')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const options = container.querySelectorAll<HTMLButtonElement>('.production-option')
    expect(options).toHaveLength(4)
    await user.click(options[0])

    expect(container.querySelector('.production-card')).toBeNull()
    const deploymentBar = screen.getByLabelText('부대 배치')
    expect(deploymentBar).toHaveTextContent(
      '청록색 타일을 선택하세요.',
    )
    expect(deploymentBar.parentElement).toHaveClass('status-bar-slot')
    expect(deploymentBar.parentElement).toContainElement(
      container.querySelector('.status-bar'),
    )

    const destination = container.querySelector<HTMLButtonElement>('[data-deployable="true"]')!
    await user.click(destination)

    expect(container.querySelectorAll('.unit-token')).toHaveLength(7)
    expect(container.querySelector('.status-bar')).toHaveTextContent('5')
    expect(screen.queryByLabelText('부대 배치')).not.toBeInTheDocument()
    expect(container.querySelector('.production-card')).toBeNull()
    expect(screen.getByLabelText('선택 정보')).toHaveTextContent(
      '유닛이나 거점을 선택하면 상세 정보가 표시됩니다.',
    )
    expect(container.querySelector('.map-tile[aria-pressed="true"]')).toBeNull()
    expect(container.querySelector('[data-site-selected="true"]')).toBeNull()
  })

  it('returns to production options when deployment is cancelled', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-production-cancel')
    const stronghold = state.sites.find(
      (site) => site.ownerId === 'player' && site.kind === 'stronghold',
    )!
    const { container } = renderApp(state)
    const strongholdTile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(stronghold.position)}"]`,
    )!

    await user.click(strongholdTile)
    await user.click(screen.getByRole('tab', { name: '생산' }))
    await user.click(
      container.querySelector<HTMLButtonElement>('.production-option')!,
    )

    expect(screen.getByLabelText('선택 정보')).toHaveTextContent(
      '지도에서 청록색 배치 타일을 선택하세요.',
    )
    await user.click(screen.getByRole('button', { name: '부대 배치 취소' }))

    expect(screen.queryByLabelText('부대 배치')).not.toBeInTheDocument()
    expect(container.querySelector('.production-card')).toBeInTheDocument()
    expect(container.querySelectorAll('.unit-token')).toHaveLength(6)
  })

  it('selects a unit on a stronghold first, then the stronghold on the next click', async () => {
    const user = userEvent.setup()
    const initial = createInitialGameState('ui-stack-select')
    const stronghold = initial.sites.find(
      (site) => site.ownerId === 'player' && site.kind === 'stronghold',
    )!
    const stacked: Unit = {
      id: 'stacked',
      name: 'stacked',
      factionId: 'player',
      type: 'infantry',
      position: { ...stronghold.position },
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const { container } = renderApp({ ...initial, units: [stacked] })
    const tile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(stronghold.position)}"]`,
    )!

    await user.click(tile)
    expect(tile).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('.production-card')).toBeNull()

    await user.click(tile)
    expect(tile).toHaveAttribute('aria-pressed', 'true')
    expect(tile).toHaveAttribute('data-site-selected', 'true')
    expect(container.querySelector('.site-marker--selected')).toBeInTheDocument()
    expect(screen.getByLabelText('성 정보')).toBeVisible()
    expect(container.querySelector('.production-card')).toBeNull()

    await user.click(screen.getByRole('tab', { name: '생산' }))
    expect(container.querySelector('.production-card')).toBeInTheDocument()
    expect(screen.getByLabelText('부대 생산')).toBeVisible()
  })

  it('opens chrome utility menus one at a time from the top bar', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('heading', { name: '저장 관리' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '작전 지침' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '도움말' }))
    expect(screen.getByRole('heading', { name: '작전 지침' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '지도 범례' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '저장 관리' })).not.toBeInTheDocument()
  })

  it('shows victory immediately after occupying the enemy stronghold', async () => {
    const user = userEvent.setup()
    const initial = createInitialGameState('ui-victory')
    const capital = initial.sites.find((site) => site.capitalFor === 'enemy')!
    const start = getHexNeighbors(capital.position)[0]
    const winner: Unit = {
      id: 'winner', name: 'winner', factionId: 'player', type: 'infantry',
      position: start, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const state = {
      ...initial,
      units: [winner],
      tiles: initial.tiles.map((tile) =>
        tile.position.q === capital.position.q && tile.position.r === capital.position.r
          ? { ...tile, terrain: 'plain' as const }
          : tile,
      ),
    }
    const { container } = renderApp(state)

    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(winner.position)}"]`,
    )!)
    fireEvent.contextMenu(
      container.querySelector(`[data-coordinate="${positionKey(capital.position)}"]`)!,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('CAMPAIGN COMPLETE')).toBeInTheDocument()
    expect(screen.getByRole('dialog').querySelectorAll('button')).toHaveLength(2)
  })
})
