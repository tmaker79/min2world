import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getHexNeighbors, HEX_TILE_COUNT, positionKey } from './game/hex'
import { createInitialGameState } from './game/initialState'
import { getSiteDevelopmentFootprints } from './game/siteDevelopment'
import type { GameState, Unit } from './game/types'

function renderApp(state: GameState = createInitialGameState('ui-seed')) {
  return render(<App initialState={state} />)
}

describe('Milestone 07 UI', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('starts an available two-faction map with the selected size and side', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'min2world' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '지도 크기 선택' })).toHaveValue('tiny')
    expect(screen.getByRole('option', { name: '초소형 · 21 × 15' })).toBeEnabled()
    expect(screen.getByRole('option', { name: '소형 · 29 × 21' })).toBeEnabled()
    expect(screen.getByRole('option', { name: '중형 · 41 × 29' })).toBeEnabled()
    expect(screen.queryByRole('slider', { name: '세력 수' })).not.toBeInTheDocument()
    const factionSelect = screen.getByRole('combobox', { name: '세력 선택' })
    expect(factionSelect.querySelectorAll('option')).toHaveLength(2)
    await user.selectOptions(
      screen.getByRole('combobox', { name: '지도 크기 선택' }),
      'small',
    )
    await user.selectOptions(factionSelect, 'f2')
    await user.click(screen.getByRole('button', { name: '게임 시작' }))

    const map = await screen.findByTestId('game-map')
    expect(map.querySelector('.unit-token--f2')).toBeInTheDocument()
  })

  it('renders visible keyboard-focusable pointy hex tiles without exposing the seed', () => {
    const { container } = renderApp()
    const map = screen.getByTestId('game-map')
    const tiles = map.querySelectorAll<HTMLButtonElement>('.map-tile')

    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.length).toBeLessThanOrEqual(HEX_TILE_COUNT)
    expect([...tiles].every((tile) => tile.type === 'button' && !tile.disabled)).toBe(true)
    expect(screen.queryByLabelText('현재 seed')).not.toBeInTheDocument()
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
      '지도 타일을 가리키거나 선택하면 상세 정보가 표시됩니다.',
    )
    expect(container.querySelector('.map-minimap-dock__toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByLabelText('정보 패널')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '도움말' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '범례' })).not.toBeInTheDocument()
  }, 20_000)

  it('toggles the mobile minimap dock accessibly', () => {
    const { container } = renderApp()

    expect(screen.getByLabelText('미니맵')).toBeInTheDocument()
    const toggle = container.querySelector<HTMLButtonElement>(
      '.map-minimap-dock__toggle',
    )!
    expect(toggle).toHaveTextContent('미니맵 열기')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveTextContent('미니맵 닫기')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows accessible map zoom controls and updates their state', () => {
    renderApp()

    const zoomControls = screen.getByLabelText('지도 확대/축소')
    const zoomIn = within(zoomControls).getByRole('button', {
      name: '지도 확대',
    })
    const zoomOut = within(zoomControls).getByRole('button', {
      name: '지도 축소',
    })

    expect(zoomIn).toBeEnabled()
    expect(zoomOut).toBeEnabled()
    expect(zoomControls.querySelector('.map-zoom-controls__fit')).toBeEnabled()
    expect(screen.getByLabelText('현재 지도 배율')).toHaveTextContent('100%')

    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(zoomIn)
    }

    expect(screen.getByLabelText('현재 지도 배율')).toHaveTextContent('200%')
    expect(zoomIn).toBeDisabled()
    expect(zoomOut).toBeEnabled()
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

  it('shows unit and terrain details as a sidebar preview on hover', () => {
    const state = createInitialGameState('ui-sidebar-preview')
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

    const preview = screen.getByLabelText('지도 정보 미리보기')
    expect(preview).toHaveTextContent(enemy.name)
    expect(preview).toHaveTextContent('붉은 제국')
    expect(preview).toHaveTextContent('체력')
    expect(preview).toHaveTextContent('숲')
    expect(preview).toHaveTextContent('이동 비용')
    expect(preview).toHaveTextContent('2')
    expect(preview).toHaveTextContent('방어 보정치')
    expect(preview).toHaveTextContent('+3')
    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()

    fireEvent.mouseLeave(tile)

    expect(screen.queryByLabelText('지도 정보 미리보기')).not.toBeInTheDocument()
    expect(screen.getByLabelText('선택 정보')).toHaveTextContent(
      '지도 타일을 가리키거나 선택하면 상세 정보가 표시됩니다.',
    )
  })

  it('pins empty terrain details in the sidebar after a click', () => {
    const state = createInitialGameState('ui-terrain-info')
    const plain = state.tiles.find(
      (tile) =>
        tile.terrain === 'plain' &&
        !state.units.some(
          (unit) =>
            unit.position.q === tile.position.q &&
            unit.position.r === tile.position.r,
        ) &&
        !state.sites.some(
          (site) =>
            site.position.q === tile.position.q &&
            site.position.r === tile.position.r,
        ),
    )!
    const { container } = renderApp(state)
    const tile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(plain.position)}"]`,
    )!

    fireEvent.click(tile)

    const info = screen.getByLabelText('타일 정보')
    expect(info).toHaveTextContent('평지')
    expect(info).toHaveTextContent('좌표')
    expect(info).toHaveTextContent('이동 비용')
    expect(info).toHaveTextContent('1')
    expect(info).not.toHaveTextContent('방어 보정치')
    expect(tile).toHaveClass('map-tile--inspected')
    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()

    const enemy = state.units.find((unit) => unit.factionId === 'enemy')!
    const enemyTile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(enemy.position)}"]`,
    )!
    fireEvent.mouseEnter(enemyTile)

    expect(screen.queryByLabelText('지도 정보 미리보기')).not.toBeInTheDocument()
    expect(screen.getByLabelText('타일 정보')).toHaveTextContent('평지')
  })

  it('keeps selected unit information while hovering an attack target', () => {
    const initial = createInitialGameState('ui-attack-target-preview')
    const attacker: Unit = {
      ...initial.units.find((unit) => unit.factionId === 'player')!,
      id: 'tooltip-archer',
      type: 'archer',
      position: { q: 0, r: 0 },
      hasActed: false,
    }
    const defender: Unit = {
      ...initial.units.find((unit) => unit.factionId === 'enemy')!,
      id: 'tooltip-target',
      position: { q: 1, r: 0 },
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker, defender],
    }
    const { container } = renderApp(state)
    const targetTile = container.querySelector<HTMLButtonElement>(
      `[data-coordinate="${positionKey(defender.position)}"]`,
    )!

    expect(screen.getByLabelText('부대 정보')).toHaveTextContent(attacker.name)

    fireEvent.mouseEnter(targetTile)
    expect(screen.getByLabelText('부대 정보')).toHaveTextContent(attacker.name)
    expect(screen.queryByLabelText('지도 정보 미리보기')).not.toBeInTheDocument()
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
    expect(within(unitMenu).getByRole('button', { name: '이동' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(unitMenu).getByRole('button', { name: '이동' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /요새화/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /방어/ })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '부대 정보 닫기' }),
    ).not.toBeInTheDocument()
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
    expect(
      container.querySelector('.mobile-info-sheet__toggle'),
    ).toHaveAttribute('aria-expanded', 'true')
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

  it('moves onto a reachable cell after entering move mode', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-move-command')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
    )!)
    const destination = container.querySelector<HTMLButtonElement>('[data-reachable="true"]')!
    const destinationKey = destination.dataset.coordinate
    const unitMenu = screen.getByRole('toolbar', { name: '유닛 메뉴' })
    const moveButton = within(unitMenu).getByRole('button', { name: '이동' })

    await user.click(moveButton)
    expect(moveButton).toHaveAttribute('aria-pressed', 'true')
    expect(
      container.querySelector('.mobile-info-sheet__toggle'),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('부대 이동')).toHaveTextContent(
      '금색 타일을 선택하세요.',
    )

    await user.click(destination)
    expect(container.querySelector(`[data-unit-id="${player.id}"]`)).toHaveAttribute(
      'data-coordinate',
      destinationKey,
    )
    expect(screen.queryByLabelText('부대 이동')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('toolbar', { name: '유닛 메뉴' })).getByRole(
        'button',
        { name: '이동' },
      ),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('cancels move mode with Escape without clearing the unit selection', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-move-command-cancel')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    const playerTile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
    )!
    await user.click(playerTile)
    const moveButton = within(
      screen.getByRole('toolbar', { name: '유닛 메뉴' }),
    ).getByRole('button', { name: '이동' })
    await user.click(moveButton)

    await user.keyboard('{Escape}')

    expect(screen.queryByLabelText('부대 이동')).not.toBeInTheDocument()
    expect(moveButton).toHaveAttribute('aria-pressed', 'false')
    expect(playerTile).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('부대 정보')).toBeInTheDocument()
  })

  it('disables the move command when no reachable cells remain', () => {
    const state = createInitialGameState('ui-move-command-disabled')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    player.movementRemaining = 0
    player.hasActed = true
    state.selectedUnitId = player.id

    renderApp(state)

    expect(
      within(screen.getByRole('toolbar', { name: '유닛 메뉴' })).getByRole(
        'button',
        { name: '이동' },
      ),
    ).toBeDisabled()
  })

  it('starts a new random map without exposing seed controls', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '새 게임' }))
    expect(screen.queryByText('MAP SEED')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('현재 seed')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '새 지도로 시작' }))

    expect(screen.getByRole('button', { name: '새 게임' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('asks before replacing a game that has progressed', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('progress')
    state.turn = 2
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderApp(state)

    await user.click(screen.getByRole('button', { name: '새 게임' }))
    await user.click(screen.getByRole('button', { name: '새 지도로 시작' }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '새 게임' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('opens city information before offering production from an owned stronghold', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-production')
    const stronghold = state.sites.find(
      (site) => site.ownerId === 'player' && site.kind === 'city',
    )!
    const { container } = renderApp(state)

    expect(container.querySelector('.production-card')).toBeNull()

    const strongholdTile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(stronghold.position)}"]`,
    )!
    await user.click(strongholdTile)

    const cityInfo = screen.getByLabelText('거점 정보')
    const cityMenu = screen.getByRole('tablist', { name: '거점 메뉴' })
    expect(cityInfo).toBeVisible()
    expect(screen.getByLabelText('지도 사이드바')).toContainElement(
      cityInfo,
    )
    expect(
      cityInfo.compareDocumentPosition(cityMenu) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(within(cityInfo).getByText(stronghold.name)).toBeVisible()
    expect(cityInfo).toHaveTextContent('체력120/120')
    expect(cityInfo).toHaveTextContent('방어력55')
    expect(screen.getByRole('tab', { name: /건설/ })).toBeDisabled()
    expect(screen.queryByText('미구현')).not.toBeInTheDocument()
    expect(container.querySelector('.production-card')).toBeNull()

    await user.click(screen.getByRole('tab', { name: '생산' }))
    expect(screen.queryByRole('combobox', { name: '생산 거점' })).not.toBeInTheDocument()
    expect(
      cityMenu.compareDocumentPosition(screen.getByLabelText('부대 생산')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const options = container.querySelectorAll<HTMLButtonElement>('.production-option')
    expect(options).toHaveLength(4)
    await user.click(options[0])

    expect(
      container.querySelector('.mobile-info-sheet__toggle'),
    ).toHaveAttribute('aria-expanded', 'false')
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
      '지도 타일을 가리키거나 선택하면 상세 정보가 표시됩니다.',
    )
    expect(container.querySelector('.map-tile[aria-pressed="true"]')).toBeNull()
    expect(container.querySelector('[data-site-selected="true"]')).toBeNull()
  })

  it('returns to production options when deployment is cancelled', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-production-cancel')
    const stronghold = state.sites.find(
      (site) => site.ownerId === 'player' && site.kind === 'city',
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
      (site) => site.ownerId === 'player' && site.kind === 'city',
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
    expect(screen.getByLabelText('거점 정보')).toBeVisible()
    expect(container.querySelector('.production-card')).toBeNull()

    await user.click(screen.getByRole('tab', { name: '생산' }))
    expect(container.querySelector('.production-card')).toBeInTheDocument()
    expect(screen.getByLabelText('부대 생산')).toBeVisible()
  })

  it('shows non-owned site development as read-only', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-development-readonly')
    const site = state.sites.find((candidate) => candidate.ownerId === 'neutral')!
    const { container } = renderApp(state)

    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(site.position)}"]`,
    )!)

    expect(screen.getByLabelText('거점 정보')).toHaveTextContent(site.name)
    expect(screen.queryByRole('tab', { name: '생산' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '발전' }))
    expect(screen.getByLabelText('거점 발전')).toHaveTextContent(
      '비소유 거점은 발전 정보를 열람만 할 수 있습니다.',
    )
    expect(screen.queryByRole('button', { name: '발전 확인' })).not.toBeInTheDocument()
  })

  it('separately explains insufficient resources and maximum development', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-development-blocked')
    const site = state.sites.find(
      (candidate) => candidate.ownerId === state.humanFactionId,
    )!
    site.kind = 'outpost'
    site.footprint = undefined
    state.resources[state.humanFactionId] = 0
    const { container, unmount } = renderApp(state)

    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(site.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '발전' }))
    expect(within(screen.getByLabelText('거점 발전')).getByRole('status'))
      .toHaveTextContent('자원이 부족')
    expect(screen.getByRole('button', { name: '발전 확인' })).toBeDisabled()

    unmount()
    const maxState = createInitialGameState('ui-development-max')
    const maxSite = maxState.sites.find(
      (candidate) =>
        candidate.ownerId === maxState.humanFactionId &&
        candidate.kind === 'city',
    )!
    const maximum = renderApp(maxState)
    await user.click(maximum.container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(maxSite.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '발전' }))
    expect(within(screen.getByLabelText('거점 발전')).getByRole('status'))
      .toHaveTextContent('최고 단계')
  })

  it('reports missing footprint space for settlement development', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-development-space')
    const village = state.sites.find((site) => site.kind === 'farm')!
    village.kind = 'village'
    delete village.level
    village.ownerId = state.humanFactionId
    state.sites = [village]
    state.units = []
    state.resources[state.humanFactionId] = 100
    state.tiles = state.tiles.map((tile) => ({
      ...tile,
      terrain:
        positionKey(tile.position) === positionKey(village.position)
          ? 'plain'
          : 'mountain',
    }))
    const { container } = renderApp(state)

    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(village.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '발전' }))

    expect(within(screen.getByLabelText('거점 발전')).getByRole('status'))
      .toHaveTextContent('footprint가 없습니다')
    expect(container.querySelector('[data-development-footprint="true"]')).toBeNull()
  })

  it('previews a selected footprint, develops on confirmation, and cancels with Escape', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-development-footprint')
    const village = state.sites.find((site) => site.kind === 'farm')!
    village.kind = 'village'
    delete village.level
    village.ownerId = state.humanFactionId
    state.sites = [village]
    state.units = []
    state.resources[state.humanFactionId] = 100
    state.tiles = state.tiles.map((tile) => ({ ...tile, terrain: 'plain' }))
    expect(getSiteDevelopmentFootprints(state, village).length).toBeGreaterThan(1)
    const { container } = renderApp(state)
    const anchor = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(village.position)}"]`,
    )!

    await user.click(anchor)
    await user.click(screen.getByRole('tab', { name: '발전' }))
    expect(container.querySelectorAll('[data-development-footprint="true"]').length)
      .toBeGreaterThan(3)
    expect(
      container.querySelectorAll('[data-development-footprint-selected="true"]'),
    ).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: '방향 2' }))
    expect(screen.getByRole('button', { name: '방향 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: '발전 확인' }))
    expect(screen.getByLabelText('거점 정보')).toHaveTextContent('소도시')
    expect(container.querySelector('[data-development-footprint="true"]')).toBeNull()
    const cityMarker = container.querySelector<HTMLElement>('.site-marker--town')!
    expect(cityMarker).toHaveClass('site-marker--multi')
    expect(cityMarker.querySelector('[data-site-icon="town"]')).toBeInTheDocument()
    expect(cityMarker.parentElement).toHaveStyle({
      width: '116px',
      height: '115.5px',
    })

    await user.click(screen.getByRole('tab', { name: '발전' }))
    expect(container.querySelector('[data-development-footprint="true"]')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('거점 발전')).not.toBeInTheDocument()
    expect(container.querySelector('[data-development-footprint="true"]')).toBeNull()
  })

  it('shows locked unit types and applies blacksmith discounts', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-production-unlocks')
    const outpost = state.sites.find(
      (site) => site.ownerId === state.humanFactionId,
    )!
    outpost.kind = 'outpost'
    outpost.footprint = undefined
    const smithy = state.sites.find((site) => site.kind === 'blacksmith')!
    smithy.ownerId = state.humanFactionId
    smithy.level = 3
    state.resources[state.humanFactionId] = 100
    const { container } = renderApp(state)

    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(outpost.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '생산' }))

    const options = container.querySelectorAll<HTMLButtonElement>('.production-option')
    const productionPanel = screen.getByLabelText('부대 생산')
    expect(options).toHaveLength(4)
    expect(within(productionPanel).getByRole('button', { name: /보병.*8 자원/ }))
      .toBeEnabled()
    expect(within(productionPanel).getByRole('button', { name: /기병/ })).toBeDisabled()
    expect(within(productionPanel).getByRole('button', { name: /궁병/ })).toHaveTextContent(
      '해금되지 않은 병종',
    )
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

  it('shows fortified health and resolves a city siege with damage feedback', () => {
    vi.useFakeTimers()
    const initial = createInitialGameState('ui-victory')
    const capital = initial.sites.find((site) => site.capitalFor === 'enemy')!
    const start = getHexNeighbors(capital.position)[0]
    const winner: Unit = {
      id: 'winner', name: 'winner', factionId: 'player', type: 'archer',
      position: start, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const state = {
      ...initial,
      selectedUnitId: winner.id,
      units: [winner],
      sites: initial.sites.map((site) =>
        site.id === capital.id ? { ...site, hp: 1, maxHp: 120 } : site,
      ),
      tiles: initial.tiles.map((tile) =>
        tile.position.q === capital.position.q && tile.position.r === capital.position.r
          ? { ...tile, terrain: 'plain' as const }
          : tile,
      ),
    }
    const { container } = renderApp(state)
    const capitalMarker = container.querySelector<HTMLElement>(
      `[data-site-id="${capital.id}"]`,
    )!
    const target = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(capital.position)}"]`,
    )!

    expect(capitalMarker).toHaveAttribute('data-health', '1/120')
    expect(capitalMarker).toHaveAccessibleName(expect.stringContaining('체력 1/120'))
    expect(target).toHaveClass('map-tile--attackable-site')
    expect(target).toHaveAttribute('data-attackable-site', 'true')

    fireEvent.click(target)
    expect(container.querySelector('[data-testid="arrow-volley"]')).toBeInTheDocument()
    expect(container.querySelector(`[data-unit-id="${winner.id}"]`))
      .not.toHaveClass('unit-token--striking')
    act(() => vi.advanceTimersByTime(20))
    expect(container.querySelector('[data-testid="arrow-volley"]')).toBeNull()
    expect(capitalMarker).toHaveClass('site-marker--hit')
    expect(container.querySelector('.damage-popup')).toHaveTextContent('-1')
    expect(
      screen.getByText(`${capital.name}에 1 피해, ${capital.name} 점령`),
    ).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(50))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('CAMPAIGN COMPLETE')).toBeInTheDocument()
    expect(screen.getByRole('dialog').querySelectorAll('button')).toHaveLength(2)
    expect(container.querySelector(`[data-unit-id="${winner.id}"]`))
      .toHaveClass('unit-token--acted')
    vi.useRealTimers()
  })

  it('attacks an enemy unit before a fortified site on the same tile', () => {
    vi.useFakeTimers()
    const initial = createInitialGameState('ui-site-unit-priority')
    const capital = initial.sites.find((site) => site.capitalFor === 'enemy')!
    const attacker: Unit = {
      id: 'siege-archer', name: 'siege archer', factionId: 'player', type: 'archer',
      position: getHexNeighbors(capital.position)[0],
      hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const defender: Unit = {
      id: 'city-guard', name: 'city guard', factionId: 'enemy', type: 'infantry',
      position: capital.position,
      hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker, defender],
      sites: initial.sites.map((site) =>
        site.id === capital.id ? { ...site, hp: 120, maxHp: 120 } : site,
      ),
    }
    const { container } = renderApp(state)

    fireEvent.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(capital.position)}"]`,
    )!)
    expect(container.querySelector('[data-testid="arrow-volley"]')).toBeInTheDocument()
    expect(container.querySelector(`[data-unit-id="${attacker.id}"]`))
      .not.toHaveClass('unit-token--striking')
    act(() => vi.advanceTimersByTime(20))
    expect(container.querySelector('[data-testid="arrow-volley"]')).toBeNull()
    expect(container.querySelector(`[data-unit-id="${defender.id}"]`))
      .toHaveClass('unit-token--hit')
    expect(container.querySelector('.damage-popup')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(50))

    expect(container.querySelector(`[data-unit-id="${defender.id}"]`))
      .not.toHaveAttribute('data-health', '100/100')
    expect(container.querySelector(`[data-site-id="${capital.id}"]`))
      .toHaveAttribute('data-health', '120/120')
    vi.useRealTimers()
  })

  it('keeps the melee strike animation and does not render arrows for non-archers', () => {
    vi.useFakeTimers()
    const initial = createInitialGameState('ui-melee-strike')
    const defender = initial.units.find(
      (unit) => unit.factionId !== initial.humanFactionId,
    )!
    const attacker: Unit = {
      id: 'melee-attacker',
      name: 'melee attacker',
      factionId: initial.humanFactionId,
      type: 'infantry',
      position: getHexNeighbors(defender.position, initial.boardSize)[0],
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker, defender],
    }
    const { container } = renderApp(state)

    fireEvent.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(defender.position)}"]`,
    )!)

    expect(container.querySelector('[data-testid="arrow-volley"]')).toBeNull()
    expect(container.querySelector(`[data-unit-id="${attacker.id}"]`))
      .toHaveClass('unit-token--striking')
    vi.useRealTimers()
  })
})
