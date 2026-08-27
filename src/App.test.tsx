import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  BOARD_SIZE_PRESETS,
  getHexNeighbors,
  HEX_TILE_COUNT,
  positionKey,
} from './game/hex'
import { createInitialGameState } from './game/initialState'
import type { MapGenerationOptions } from './game/mapGenerator'
import { getFactionIncome, TERRAIN_LABELS } from './game/rules'
import { getSiteDevelopmentFootprints } from './game/siteDevelopment'
import {
  getConstructiblePositions,
  getSettleablePositions,
} from './game/settlement'
import type { GameState, Unit } from './game/types'
import {
  getFactionNetIncome,
  getFactionUpkeep,
  getFactionUpkeepReserve,
} from './game/upkeep'

function createEasyPlayerState(
  seed: string,
  options?: MapGenerationOptions,
) {
  return createInitialGameState(seed, { ...options, difficulty: 'easy' })
}

function renderApp(state: GameState = createInitialGameState('ui-seed')) {
  return render(<App initialState={state} />)
}

function mockViewport(width: number, height = 800) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    const matches =
      query === '(prefers-reduced-motion: reduce)' ||
      (query === '(max-width: 980px)' && width <= 980) ||
      (query.includes('(max-width: 700px)') &&
        (width <= 700 || (width <= 980 && height <= 500)))
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }
  })
}

function tapTile(
  tile: HTMLElement,
  pointerType: 'touch' | 'pen' = 'touch',
) {
  fireEvent.pointerDown(tile, {
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
  })
  fireEvent.pointerUp(tile, {
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
  })
  fireEvent.click(tile, { detail: 1 })
}

describe('Milestone 07 UI', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/?mode=standard')
    vi.restoreAllMocks()
  })

  it('starts a quick match immediately when requested by the runtime mode', () => {
    window.history.replaceState({}, '', '/?mode=quick')
    render(<App />)

    expect(screen.getByTestId('game-map')).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: '지도 크기 선택' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('민간 유닛')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '발전' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '건설' })).not.toBeInTheDocument()
  })

  it('offers only military production and no management tabs in quick mode', () => {
    const state = createInitialGameState('quick-ui-controls', {
      gameMode: 'quick',
      humanFactionId: 'f1',
    })
    const city = state.sites.find(
      (site) => site.ownerId === state.humanFactionId && site.kind === 'city',
    )!
    const { container } = renderApp(state)

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        `.map-tile[data-coordinate="${positionKey(city.position)}"]`,
      )!,
    )

    expect(screen.getByRole('tab', { name: '생산' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '발전' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '건설' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '생산' }))
    expect(screen.queryByText('민간 유닛')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.production-option')).toHaveLength(4)
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
    expect(container.querySelectorAll('[data-site-asset-preview]')).toHaveLength(0)
    expect(container.querySelectorAll('.unit-token')).toHaveLength(10)
    expect(container.querySelectorAll('.unit-token--military')).toHaveLength(6)
    expect(container.querySelectorAll('.unit-token--civilian')).toHaveLength(4)
    expect(
      [...container.querySelectorAll('.unit-token--military')].every(
        (token) => token.getAttribute('data-unit-role') === 'military',
      ),
    ).toBe(true)
    expect(
      [...container.querySelectorAll('.unit-token--civilian')].every(
        (token) => token.getAttribute('data-unit-role') === 'civilian',
      ),
    ).toBe(true)
    expect(container.querySelector('.map-layer--terrain .map-tile')).toBeInTheDocument()
    expect(container.querySelector('.map-layer--sites .site-marker')).toBeInTheDocument()
    expect(container.querySelector('.map-layer--units .unit-token')).toBeInTheDocument()
    expect(container.querySelector('.map-layer--units .unit-health-bar')).toBeInTheDocument()
    expect(container.querySelectorAll('.territory-mark').length).toBeGreaterThan(0)
    expect(
      [...tiles].every((tile) => tile.hasAttribute('data-territory-owner')),
    ).toBe(true)
    expect(container.querySelector('.unit-health-bar')?.closest('.map-tile')).toBeNull()
    expect(container.querySelector('.site-marker')?.closest('.map-tile')).toBeNull()
    const sidebar = screen.getByLabelText('지도 사이드바')
    const minimap = screen.getByTestId('minimap')
    expect(sidebar.firstElementChild).toHaveClass('map-minimap-dock')
    expect(sidebar).toContainElement(minimap)
    expect(Number(minimap.getAttribute('data-territory-count'))).toBeGreaterThan(0)
    expect(container.querySelector('.map-stage')).not.toContainElement(minimap)
    expect(screen.getByLabelText('선택 정보')).toHaveTextContent(
      '지도 타일을 가리키거나 선택하면 상세 정보가 표시됩니다.',
    )
    expect(container.querySelector('.map-minimap-dock__toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.queryByLabelText('정보 패널')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()
    const restartButton = screen.getByRole('button', { name: '재시작' })
    const saveButton = screen.getByRole('button', { name: '저장' })
    const helpButton = screen.getByRole('button', { name: '도움말' })
    expect(restartButton).toHaveAttribute('title', '재시작')
    expect(saveButton).toHaveAttribute('title', '저장')
    expect(helpButton).toHaveAttribute('title', '도움말')
    for (const button of [restartButton, saveButton, helpButton]) {
      expect(button).toHaveTextContent('')
      expect(button.querySelector('.app-chrome__icon')).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: '범례' })).not.toBeInTheDocument()
  }, 20_000)

  it('keeps impassable mountain and water tiles inspectable with a pointer cursor', () => {
    const state = createInitialGameState('ui-impassable-cursor')
    state.tiles[0].terrain = 'mountain'
    state.tiles[1].terrain = 'water'
    const { container } = renderApp(state)
    const mountain = container.querySelector<HTMLElement>(
      `.map-tile[data-coordinate="${positionKey(state.tiles[0].position)}"]`,
    )!
    const water = container.querySelector<HTMLElement>(
      `.map-tile[data-coordinate="${positionKey(state.tiles[1].position)}"]`,
    )!

    expect(getComputedStyle(mountain).cursor).toBe('pointer')
    expect(getComputedStyle(water).cursor).toBe('pointer')
  })

  it('keeps the minimap fallback toggle accessible', () => {
    const { container } = renderApp()

    expect(screen.getByLabelText('미니맵')).toBeInTheDocument()
    const toggle = container.querySelector<HTMLButtonElement>(
      '.map-minimap-dock__toggle',
    )!
    expect(toggle).toHaveAttribute('aria-label', '미니맵 닫기')
    expect(toggle).toHaveTextContent('미니맵')
    expect(toggle.querySelector('.map-minimap-dock__icon')).toBeInTheDocument()
    expect(toggle.querySelectorAll('.map-minimap-dock__icon path')).toHaveLength(1)
    expect(toggle.querySelector('.map-minimap-dock__icon--collapse')).toBeInTheDocument()
    expect(toggle.querySelector('.map-minimap-dock__pin')).not.toBeInTheDocument()
    expect(toggle.querySelector('.map-minimap-dock__icon circle')).toBeNull()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-label', '미니맵 열기')
    expect(toggle).toHaveTextContent('미니맵')
    expect(toggle.querySelectorAll('.map-minimap-dock__icon path')).toHaveLength(3)
    expect(toggle.querySelector('.map-minimap-dock__icon--collapse')).not.toBeInTheDocument()
    expect(toggle.querySelector('.map-minimap-dock__pin')).not.toBeInTheDocument()
    expect(toggle.querySelector('.map-minimap-dock__icon circle')).toBeNull()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('starts with the minimap collapsed on compact screens', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }))
    const { container } = renderApp()

    expect(
      container.querySelector('.map-minimap-dock__toggle'),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it.each([
    [1200, 'true'],
    [900, 'false'],
  ])(
    'keeps the minimap state appropriate when information opens at %ipx',
    (width, expectedMinimapExpanded) => {
      mockViewport(width)
      const state = createInitialGameState(`sidebar-viewport-${width}`)
      const emptyTile = state.tiles.find(
        (tile) =>
          !state.units.some(
            (unit) => positionKey(unit.position) === positionKey(tile.position),
          ) &&
          !state.sites.some(
            (site) => positionKey(site.position) === positionKey(tile.position),
          ),
      )!
      const { container } = renderApp(state)
      const minimapToggle = container.querySelector<HTMLButtonElement>(
        '.map-minimap-dock__toggle',
      )!
      const infoToggle = container.querySelector<HTMLButtonElement>(
        '.mobile-info-sheet__toggle',
      )!

      expect(minimapToggle).toHaveAttribute('aria-expanded', 'true')
      fireEvent.click(
        container.querySelector<HTMLButtonElement>(
          `.map-tile[data-coordinate="${positionKey(emptyTile.position)}"]`,
        )!,
      )

      expect(infoToggle).toHaveAttribute('aria-expanded', 'true')
      expect(minimapToggle).toHaveAttribute(
        'aria-expanded',
        expectedMinimapExpanded,
      )
    },
  )

  it('keeps the minimap and information sheet mutually exclusive at 700px', () => {
    mockViewport(700)
    const state = createInitialGameState('sidebar-viewport-700')
    const emptyTile = state.tiles.find(
      (tile) =>
        !state.units.some(
          (unit) => positionKey(unit.position) === positionKey(tile.position),
        ) &&
        !state.sites.some(
          (site) => positionKey(site.position) === positionKey(tile.position),
        ),
    )!
    const { container } = renderApp(state)
    const minimapToggle = container.querySelector<HTMLButtonElement>(
      '.map-minimap-dock__toggle',
    )!
    const infoToggle = container.querySelector<HTMLButtonElement>(
      '.mobile-info-sheet__toggle',
    )!

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        `.map-tile[data-coordinate="${positionKey(emptyTile.position)}"]`,
      )!,
    )
    expect(infoToggle).toHaveAttribute('aria-expanded', 'true')
    expect(minimapToggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(minimapToggle)
    expect(minimapToggle).toHaveAttribute('aria-expanded', 'true')
    expect(infoToggle).toHaveAttribute('aria-expanded', 'false')
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

  it.each([
    ['2인용', BOARD_SIZE_PRESETS.tiny],
    ['초소형', BOARD_SIZE_PRESETS.small],
    ['소형', BOARD_SIZE_PRESETS.standard],
  ])('centers the player capital when a %s game does not fit', (_, boardSize) => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const state = createInitialGameState(`center-capital-${boardSize.columns}`, {
      boardSize,
      factionCount: 2,
      humanFactionId: 'f1',
    })
    const capital = state.sites.find(
      (site) => site.capitalFor === state.humanFactionId,
    )!
    const { container } = renderApp(state)
    const mapScroll = container.querySelector<HTMLElement>('.map-scroll')!
    const capitalTile = container.querySelector<HTMLElement>(
      `.map-tile[data-coordinate="${positionKey(capital.position)}"]`,
    )!
    const mapContent = container.querySelector<HTMLElement>('.map-zoom-shell')!

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
    vi.spyOn(mapContent, 'getBoundingClientRect').mockReturnValue({
      left: 200,
      top: 100,
      width: 1200,
      height: 900,
    } as DOMRect)

    act(() => {
      for (const frame of frames.splice(0)) frame(0)
    })

    expect(mapScroll.scrollLeft).toBe(429)
    expect(mapScroll.scrollTop).toBe(233)
  })

  it('centers the whole map instead of the capital when it fits the viewport', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const state = createInitialGameState('center-whole-map')
    const capital = state.sites.find(
      (site) => site.capitalFor === state.humanFactionId,
    )!
    const { container } = renderApp(state)
    const mapScroll = container.querySelector<HTMLElement>('.map-scroll')!
    const capitalTile = container.querySelector<HTMLElement>(
      `.map-tile[data-coordinate="${positionKey(capital.position)}"]`,
    )!
    const mapContent = container.querySelector<HTMLElement>('.map-zoom-shell')!

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
    vi.spyOn(mapContent, 'getBoundingClientRect').mockReturnValue({
      left: 300,
      top: 200,
      width: 600,
      height: 400,
    } as DOMRect)

    act(() => {
      for (const frame of frames.splice(0)) frame(0)
    })

    expect(mapScroll.scrollLeft).toBe(100)
    expect(mapScroll.scrollTop).toBe(50)
  })

  it.each([
    {
      axis: 'horizontal',
      mapWidth: 600,
      mapHeight: 900,
      expectedLeft: 77,
      expectedTop: 274,
    },
    {
      axis: 'vertical',
      mapWidth: 1200,
      mapHeight: 400,
      expectedLeft: 466,
      expectedTop: 61,
    },
  ])(
    'centers the map on the $axis axis when the map already fits that axis',
    ({ mapWidth, mapHeight, expectedLeft, expectedTop }) => {
      const frames: FrameRequestCallback[] = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.push(callback)
        return frames.length
      })
      const state = createInitialGameState(
        `center-capital-single-axis-${mapWidth}-${mapHeight}`,
      )
      const capital = state.sites.find(
        (site) => site.capitalFor === state.humanFactionId,
      )!
      const { container } = renderApp(state)
      const mapScroll = container.querySelector<HTMLElement>('.map-scroll')!
      const capitalTile = container.querySelector<HTMLElement>(
        `.map-tile[data-coordinate="${positionKey(capital.position)}"]`,
      )!
      const mapContent = container.querySelector<HTMLElement>('.map-zoom-shell')!

      Object.defineProperties(mapScroll, {
        clientWidth: { configurable: true, value: 800 },
        clientHeight: { configurable: true, value: 600 },
        scrollLeft: { configurable: true, writable: true, value: 37 },
        scrollTop: { configurable: true, writable: true, value: 41 },
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
      vi.spyOn(mapContent, 'getBoundingClientRect').mockReturnValue({
        left: 240,
        top: 170,
        width: mapWidth,
        height: mapHeight,
      } as DOMRect)

      act(() => {
        for (const frame of frames.splice(0)) frame(0)
      })

      expect(mapScroll.scrollLeft).toBe(expectedLeft)
      expect(mapScroll.scrollTop).toBe(expectedTop)
    },
  )

  it.each([
    {
      edge: 'start',
      tileLeft: 310,
      tileTop: 210,
      expectedLeft: 200,
      expectedTop: 150,
    },
    {
      edge: 'end',
      tileLeft: 1440,
      tileTop: 1030,
      expectedLeft: 600,
      expectedTop: 450,
    },
  ])(
    'stops initial capital centering at the map frame near the $edge edge',
    ({ tileLeft, tileTop, expectedLeft, expectedTop }) => {
      const frames: FrameRequestCallback[] = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.push(callback)
        return frames.length
      })
      const state = createInitialGameState(
        `center-capital-at-frame-${tileLeft}-${tileTop}`,
      )
      const capital = state.sites.find(
        (site) => site.capitalFor === state.humanFactionId,
      )!
      const { container } = renderApp(state)
      const mapScroll = container.querySelector<HTMLElement>('.map-scroll')!
      const capitalTile = container.querySelector<HTMLElement>(
        `.map-tile[data-coordinate="${positionKey(capital.position)}"]`,
      )!
      const mapContent = container.querySelector<HTMLElement>('.map-zoom-shell')!

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
        left: tileLeft,
        top: tileTop,
        width: 58,
        height: 66,
      } as DOMRect)
      vi.spyOn(mapContent, 'getBoundingClientRect').mockReturnValue({
        left: 300,
        top: 200,
        width: 1200,
        height: 900,
      } as DOMRect)

      act(() => {
        for (const frame of frames.splice(0)) frame(0)
      })

      expect(mapScroll.scrollLeft).toBe(expectedLeft)
      expect(mapScroll.scrollTop).toBe(expectedTop)
    },
  )

  it('does not recenter the player capital after ending the turn', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const state = createInitialGameState('center-capital-once', {
      boardSize: BOARD_SIZE_PRESETS.tiny,
      factionCount: 2,
      humanFactionId: 'f1',
    })
    const { container } = renderApp(state)
    const mapScroll = container.querySelector<HTMLElement>('.map-scroll')!

    act(() => {
      for (const frame of frames.splice(0)) frame(0)
    })
    mapScroll.scrollLeft = 321
    mapScroll.scrollTop = 123

    fireEvent.click(screen.getByRole('button', { name: '턴 종료' }))

    expect(frames).toHaveLength(0)
    expect(mapScroll.scrollLeft).toBe(321)
    expect(mapScroll.scrollTop).toBe(123)
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
    const mapTerrainImage = tile.querySelector<HTMLImageElement>(
      '[data-terrain-icon]',
    )!
    const infoTerrainImage = info.querySelector<HTMLImageElement>(
      '[data-terrain-icon]',
    )!
    expect(info).toHaveTextContent('평지')
    expect(infoTerrainImage.getAttribute('src')).toBe(
      mapTerrainImage.getAttribute('src'),
    )
    expect(infoTerrainImage).toHaveAttribute(
      'data-terrain-variant',
      mapTerrainImage.dataset.terrainVariant,
    )
    expect(info).toHaveTextContent('좌표')
    expect(info).toHaveTextContent('이동 비용')
    expect(info).toHaveTextContent('영토')
    expect(info).toHaveTextContent('1')
    expect(info).not.toHaveTextContent('방어 보정치')
    expect(tile).toHaveAttribute('data-territory-owner')
    expect(tile.getAttribute('aria-label')).toMatch(/영토|미편입 지역/)
    expect(tile).toHaveClass('map-tile--inspected')
    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()

    const enemy = state.units.find((unit) => unit.factionId === 'enemy')!
    const enemyTile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(enemy.position)}"]`,
    )!
    fireEvent.mouseEnter(enemyTile)

    expect(screen.queryByLabelText('지도 정보 미리보기')).not.toBeInTheDocument()
    expect(screen.getByLabelText('타일 정보')).toHaveTextContent('평지')

    fireEvent.click(screen.getByRole('button', { name: '타일 정보 닫기' }))
    expect(screen.queryByLabelText('타일 정보')).not.toBeInTheDocument()
    expect(tile).not.toHaveClass('map-tile--inspected')
    expect(
      container.querySelector('.mobile-info-sheet__toggle'),
    ).toHaveAttribute('aria-expanded', 'false')
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
    expect(container.querySelectorAll('.reachable-area-mark').length).toBeGreaterThan(0)
    expect(
      container.querySelectorAll('[data-reachable-boundary="true"]').length,
    ).toBeGreaterThan(0)
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
    expect(within(unitMenu).getByRole('button', { name: '공격' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /요새화/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /방어/ })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '부대 정보 닫기' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('미구현')).not.toBeInTheDocument()
    expect(container.querySelector('.map-stage')).not.toContainElement(
      unitInfo,
    )

    await user.click(screen.getByRole('button', { name: '부대 정보 닫기' }))
    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()
    expect(tile).toHaveAttribute('aria-pressed', 'false')
  })

  it('collapses overlay information without clearing its selection', async () => {
    mockViewport(900)
    const user = userEvent.setup()
    const state = createInitialGameState('sidebar-collapse-selection')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    const playerTile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
    )!
    const infoToggle = container.querySelector<HTMLButtonElement>(
      '.mobile-info-sheet__toggle',
    )!

    await user.click(playerTile)
    expect(infoToggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(infoToggle)
    expect(infoToggle).toHaveAttribute('aria-expanded', 'false')
    expect(playerTile).toHaveAttribute('aria-pressed', 'true')

    await user.click(infoToggle)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(infoToggle).toHaveAttribute('aria-expanded', 'false')
    expect(playerTile).toHaveAttribute('aria-pressed', 'true')
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

  it.each(['touch', 'pen'] as const)(
    'moves directly on a reachable-cell %s tap and keeps unit information collapsed',
    (pointerType) => {
      mockViewport(700)
      const state = createInitialGameState(`ui-move-${pointerType}-tap`)
      const player = state.units.find((unit) => unit.factionId === 'player')!
      const { container } = renderApp(state)
      const playerTile = container.querySelector<HTMLButtonElement>(
        `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
      )!

      tapTile(playerTile, pointerType)

      const infoToggle = container.querySelector<HTMLButtonElement>(
        '.mobile-info-sheet__toggle',
      )!
      expect(playerTile).toHaveAttribute('aria-pressed', 'true')
      expect(infoToggle).toHaveAttribute('aria-expanded', 'false')

      const destination = container.querySelector<HTMLButtonElement>(
        '[data-reachable="true"]',
      )!
      const destinationKey = destination.dataset.coordinate
      tapTile(destination, pointerType)

      expect(container.querySelector(`[data-unit-id="${player.id}"]`)).toHaveAttribute(
        'data-coordinate',
        destinationKey,
      )
    },
  )

  it('does not move directly when a reachable cell is keyboard-activated', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-move-keyboard-command')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
    )!)
    const destination = container.querySelector<HTMLButtonElement>(
      '[data-reachable="true"]',
    )!
    const originKey = positionKey(player.position)

    fireEvent.click(destination, { detail: 0 })

    expect(container.querySelector(`[data-unit-id="${player.id}"]`)).toHaveAttribute(
      'data-coordinate',
      originKey,
    )
  })

  it('does not treat a touch drag ending on a reachable cell as a move tap', () => {
    mockViewport(700)
    const state = createInitialGameState('ui-move-touch-drag')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    const playerTile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
    )!
    tapTile(playerTile)
    const destination = container.querySelector<HTMLButtonElement>(
      '[data-reachable="true"]',
    )!
    const originKey = positionKey(player.position)

    fireEvent.pointerDown(destination, {
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerMove(destination, {
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: true,
      buttons: 1,
      clientX: 120,
      clientY: 120,
    })
    fireEvent.pointerUp(destination, {
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: 120,
      clientY: 120,
    })
    fireEvent.click(destination, { detail: 1 })

    expect(container.querySelector(`[data-unit-id="${player.id}"]`)).toHaveAttribute(
      'data-coordinate',
      originKey,
    )
  })

  it('attacks an enemy unit by touch while move mode is active', () => {
    vi.useFakeTimers()
    const initial = createInitialGameState('ui-touch-attack-in-move-mode')
    const attacker: Unit = {
      ...initial.units.find((unit) => unit.factionId === 'player')!,
      id: 'touch-attacker',
      type: 'infantry',
      position: { q: 0, r: 0 },
      hasActed: false,
      movementRemaining: 2,
    }
    const defender: Unit = {
      ...initial.units.find((unit) => unit.factionId === 'enemy')!,
      id: 'touch-defender',
      position: { q: 1, r: 0 },
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker, defender],
      tiles: initial.tiles.map((tile) => ({ ...tile, terrain: 'plain' as const })),
    }
    const { container } = renderApp(state)
    fireEvent.click(
      within(screen.getByRole('toolbar', { name: '유닛 메뉴' })).getByRole(
        'button',
        { name: '이동' },
      ),
    )
    const target = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(defender.position)}"]`,
    )!

    expect(target).toHaveAttribute('data-attackable', 'true')
    tapTile(target)

    expect(container.querySelector(`[data-unit-id="${attacker.id}"]`))
      .toHaveClass('unit-token--striking')
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('enters attack mode from the unit menu and attacks the selected target', () => {
    vi.useFakeTimers()
    const initial = createInitialGameState('ui-attack-command')
    const attacker: Unit = {
      ...initial.units.find((unit) => unit.factionId === 'player')!,
      id: 'command-attacker',
      type: 'infantry',
      position: { q: 0, r: 0 },
      hasActed: false,
      movementRemaining: 2,
    }
    const defender: Unit = {
      ...initial.units.find((unit) => unit.factionId === 'enemy')!,
      id: 'command-defender',
      position: { q: 1, r: 0 },
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker, defender],
      tiles: initial.tiles.map((tile) => ({ ...tile, terrain: 'plain' as const })),
    }
    const { container } = renderApp(state)
    const attackButton = within(
      screen.getByRole('toolbar', { name: '유닛 메뉴' }),
    ).getByRole('button', { name: '공격' })

    expect(attackButton).toBeEnabled()
    fireEvent.click(attackButton)
    expect(attackButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('부대 공격')).toHaveTextContent(
      '붉은 대상을 선택하세요.',
    )
    expect(
      container.querySelector('.mobile-info-sheet__toggle'),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('[data-zone-of-control]')).toBeNull()
    expect(container.querySelector('.map-tile--zoc')).toBeNull()

    fireEvent.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(defender.position)}"]`,
    )!)

    expect(screen.queryByLabelText('부대 공격')).not.toBeInTheDocument()
    expect(container.querySelector(`[data-unit-id="${attacker.id}"]`))
      .toHaveClass('unit-token--striking')
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('attacks an enemy site by touch tap', () => {
    vi.useFakeTimers()
    const initial = createInitialGameState('ui-touch-site-attack')
    const capital = initial.sites.find((site) => site.capitalFor === 'enemy')!
    const attacker: Unit = {
      id: 'touch-site-attacker',
      name: 'touch site attacker',
      factionId: 'player',
      type: 'archer',
      position: getHexNeighbors(capital.position)[0],
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker],
      tiles: initial.tiles.map((tile) =>
        positionKey(tile.position) === positionKey(capital.position)
          ? { ...tile, terrain: 'plain' as const }
          : tile,
      ),
    }
    const { container } = renderApp(state)
    const target = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(capital.position)}"]`,
    )!

    expect(target).toHaveAttribute('data-attackable-site', 'true')
    tapTile(target)

    expect(container.querySelector('[data-testid="arrow-volley"]'))
      .toBeInTheDocument()
    vi.clearAllTimers()
    vi.useRealTimers()
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
    expect(
      container.querySelector('.mobile-info-sheet__toggle'),
    ).toHaveAttribute('aria-expanded', 'true')
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

  it('starts a new random map without exposing seed controls', () => {
    renderApp(
      createInitialGameState('ui-random-restart', {
        boardSize: BOARD_SIZE_PRESETS.tiny,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: '재시작' }))
    expect(screen.queryByText('MAP SEED')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('현재 seed')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '새 랜덤 지도로 재시작' }))

    expect(screen.getByRole('button', { name: '재시작' })).toHaveAttribute(
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

    await user.click(screen.getByRole('button', { name: '재시작' }))
    await user.click(screen.getByRole('button', { name: '새 랜덤 지도로 재시작' }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '재시작' })).toHaveAttribute(
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
    expect(screen.getByRole('tab', { name: /건설/ })).toBeEnabled()
    expect(screen.queryByText('미구현')).not.toBeInTheDocument()
    expect(container.querySelector('.production-card')).toBeNull()

    await user.click(screen.getByRole('tab', { name: '생산' }))
    expect(screen.queryByRole('combobox', { name: '생산 거점' })).not.toBeInTheDocument()
    expect(
      cityMenu.compareDocumentPosition(screen.getByLabelText('부대 생산')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const options = container.querySelectorAll<HTMLButtonElement>('.production-option')
    expect(options).toHaveLength(6)
    const civilianGroup = within(screen.getByLabelText('부대 생산'))
      .getByText('민간 유닛')
      .closest('section')!
    expect(civilianGroup.querySelectorAll('.production-option')).toHaveLength(2)
    expect(civilianGroup).toHaveTextContent('비전투')
    expect(civilianGroup).not.toHaveTextContent('사거리')
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

    expect(container.querySelectorAll('.unit-token')).toHaveLength(11)
    expect(container.querySelector('.status-bar')).toHaveTextContent('10')
    expect(screen.queryByLabelText('부대 배치')).not.toBeInTheDocument()
    expect(container.querySelector('.production-card')).toBeNull()
    expect(screen.getByLabelText('선택 정보')).toHaveTextContent(
      '지도 타일을 가리키거나 선택하면 상세 정보가 표시됩니다.',
    )
    expect(container.querySelector('.map-tile[aria-pressed="true"]')).toBeNull()
    expect(container.querySelector('[data-site-selected="true"]')).toBeNull()
  })

  it('clears a selected site when its information panel is closed', async () => {
    mockViewport(900)
    const user = userEvent.setup()
    const state = createInitialGameState('sidebar-site-close')
    const site = state.sites.find(
      (candidate) => candidate.ownerId === state.humanFactionId,
    )!
    const { container } = renderApp(state)
    const tile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(site.position)}"]`,
    )!

    await user.click(tile)
    expect(tile).toHaveAttribute('data-site-selected', 'true')

    await user.click(screen.getByRole('button', { name: '거점 정보 닫기' }))

    expect(screen.queryByLabelText('거점 정보')).not.toBeInTheDocument()
    expect(tile).not.toHaveAttribute('data-site-selected', 'true')
    expect(
      container.querySelector('.mobile-info-sheet__toggle'),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it.each([
    ['발전', '거점 발전'],
    ['건설', '도시 건설'],
  ])(
    'returns to site information when %s mode is cancelled with Escape',
    async (tabName, panelLabel) => {
      mockViewport(900)
      const user = userEvent.setup()
      const state = createInitialGameState(`sidebar-${tabName}-escape`)
      const city = state.sites.find(
        (site) =>
          site.ownerId === state.humanFactionId && site.kind === 'city',
      )!
      const { container } = renderApp(state)

      await user.click(container.querySelector<HTMLButtonElement>(
        `.map-tile[data-coordinate="${positionKey(city.position)}"]`,
      )!)
      await user.click(screen.getByRole('tab', { name: tabName }))
      expect(screen.getByLabelText(panelLabel)).toBeInTheDocument()

      await user.keyboard('{Escape}')

      expect(screen.queryByLabelText(panelLabel)).not.toBeInTheDocument()
      expect(screen.getByLabelText('거점 정보')).toHaveTextContent(city.name)
      expect(
        container.querySelector('.mobile-info-sheet__toggle'),
      ).toHaveAttribute('aria-expanded', 'true')
    },
  )

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
    expect(container.querySelectorAll('.unit-token')).toHaveLength(10)
    expect(
      container.querySelector('.mobile-info-sheet__toggle'),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('starts and cancels free player City construction without a slot limit', async () => {
    const user = userEvent.setup()
    const state = createEasyPlayerState('ui-construction')
    const city = state.sites.find(
      (site) =>
        site.ownerId === state.humanFactionId && site.kind === 'city',
    )!
    state.resources[state.humanFactionId] = 0
    const { container } = renderApp(state)

    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(city.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '건설' }))

    const panel = screen.getByLabelText('도시 건설')
    expect(within(panel).getAllByRole('button')).toHaveLength(7)
    expect(within(panel).getByRole('button', { name: /곡창.*0 자원/ }))
      .toBeEnabled()

    await user.click(
      within(panel).getByRole('button', { name: /곡창.*0 자원/ }),
    )
    expect(within(panel).getByText('곡창 건설 중')).toBeVisible()
    expect(within(panel).getByText('남은 1턴')).toBeVisible()
    expect(screen.getByLabelText('거점 정보')).toHaveTextContent('건물0 / 7')
    expect(screen.getByLabelText('현재 게임 상태')).toHaveTextContent('자원 0')

    await user.click(within(panel).getByRole('button', { name: '건설 취소' }))
    expect(within(panel).queryByText('곡창 건설 중')).not.toBeInTheDocument()
    expect(screen.getByLabelText('현재 게임 상태')).toHaveTextContent('자원 0')
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

  it('allows read-only inspection of units, terrain, and sites during an opponent turn', () => {
    const state = createInitialGameState('sidebar-opponent-inspection')
    state.activeFactionId = 'enemy'
    const enemy = state.units.find(
      (unit) =>
        unit.factionId === 'enemy' &&
        !state.sites.some(
          (site) => positionKey(site.position) === positionKey(unit.position),
        ),
    )!
    const emptyTile = state.tiles.find(
      (tile) =>
        !state.units.some(
          (unit) => positionKey(unit.position) === positionKey(tile.position),
        ) &&
        !state.sites.some(
          (site) => positionKey(site.position) === positionKey(tile.position),
        ),
    )!
    const playerSite = state.sites.find(
      (site) => site.ownerId === state.humanFactionId,
    )!
    playerSite.kind = 'outpost'
    playerSite.footprint = undefined
    const { container } = renderApp(state)

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        `.map-tile[data-coordinate="${positionKey(enemy.position)}"]`,
      )!,
    )
    expect(screen.getByLabelText('타일 정보')).toHaveTextContent(enemy.name)
    expect(screen.queryByRole('toolbar', { name: '유닛 메뉴' })).not.toBeInTheDocument()

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        `.map-tile[data-coordinate="${positionKey(emptyTile.position)}"]`,
      )!,
    )
    expect(screen.getByLabelText('타일 정보')).toHaveTextContent(
      TERRAIN_LABELS[emptyTile.terrain],
    )

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        `.map-tile[data-coordinate="${positionKey(playerSite.position)}"]`,
      )!,
    )
    expect(screen.getByLabelText('거점 정보')).toHaveTextContent(playerSite.name)
    expect(screen.queryByRole('tab', { name: '생산' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '발전' }))
    expect(screen.getByRole('button', { name: '발전 확인' })).toBeDisabled()
  })

  it('allows free player development and separately explains maximum development', async () => {
    const user = userEvent.setup()
    const state = createEasyPlayerState('ui-development-blocked')
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
    expect(screen.getByLabelText('거점 정보')).toHaveTextContent('수입없음')
    expect(screen.queryByRole('tab', { name: '생산' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '발전' }))
    const developmentPanel = screen.getByLabelText('거점 발전')
    expect(developmentPanel).toHaveTextContent('비용0 자원')
    expect(developmentPanel).toHaveTextContent('수입없음')
    expect(developmentPanel).toHaveTextContent(
      '최대 체력과 방어력이 강화됩니다.',
    )
    expect(screen.getByRole('button', { name: '발전 확인' })).toBeEnabled()

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

  it('allows one-tile settlement development without surrounding space', async () => {
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

    expect(
      within(screen.getByLabelText('거점 발전')).queryByRole('status'),
    ).toBeNull()
    expect(
      container.querySelectorAll('[data-development-footprint="true"]'),
    ).toHaveLength(1)
  })

  it('previews a one-tile footprint, develops on confirmation, and cancels with Escape', () => {
    const state = createInitialGameState('ui-development-footprint')
    const village = state.sites.find((site) => site.kind === 'farm')!
    village.kind = 'village'
    delete village.level
    village.ownerId = state.humanFactionId
    state.sites = [village]
    state.units = []
    state.resources[state.humanFactionId] = 100
    state.tiles = state.tiles.map((tile) => ({ ...tile, terrain: 'plain' }))
    expect(getSiteDevelopmentFootprints(state, village)).toEqual([
      [village.position],
    ])
    const { container } = renderApp(state)
    const anchor = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(village.position)}"]`,
    )!

    fireEvent.click(anchor)
    fireEvent.click(screen.getByRole('tab', { name: '발전' }))
    expect(
      container.querySelectorAll('[data-development-footprint="true"]'),
    ).toHaveLength(1)
    expect(
      container.querySelectorAll('[data-development-footprint-selected="true"]'),
    ).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '발전 확인' }))
    expect(screen.getByLabelText('거점 정보')).toHaveTextContent('소도시')
    expect(container.querySelector('[data-development-footprint="true"]')).toBeNull()
    const cityMarker = container.querySelector<HTMLElement>('.site-marker--town')!
    expect(cityMarker).not.toHaveClass('site-marker--multi')
    expect(cityMarker.querySelector('[data-site-icon="town"]')).toBeInTheDocument()
    expect(cityMarker.parentElement).toHaveStyle({
      width: '58px',
      height: '66px',
    })

    fireEvent.click(screen.getByRole('tab', { name: '발전' }))
    expect(container.querySelector('[data-development-footprint="true"]')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByLabelText('거점 발전')).not.toBeInTheDocument()
    expect(container.querySelector('[data-development-footprint="true"]')).toBeNull()
  })

  it('shows City unit types and waives player production costs', async () => {
    const user = userEvent.setup()
    const state = createEasyPlayerState('ui-production-unlocks')
    const city = state.sites.find(
      (site) =>
        site.ownerId === state.humanFactionId && site.kind === 'city',
    )!
    const smithy = state.sites.find((site) => site.kind === 'blacksmith')!
    smithy.ownerId = state.humanFactionId
    smithy.level = 3
    state.resources[state.humanFactionId] = 0
    const { container } = renderApp(state)

    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(city.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '생산' }))

    const options = container.querySelectorAll<HTMLButtonElement>('.production-option')
    const productionPanel = screen.getByLabelText('부대 생산')
    expect(options).toHaveLength(6)
    expect(within(productionPanel).getByRole('button', { name: /보병.*0 자원/ }))
      .toBeEnabled()
    expect(within(productionPanel).getByRole('button', { name: /기병.*0 자원/ }))
      .toBeEnabled()
    expect(within(productionPanel).getByRole('button', { name: /건설자.*0 자원/ }))
      .toBeEnabled()
  })

  it('opens chrome utility menus one at a time from the top bar', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('heading', { name: '저장 관리' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '작전 지침' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '도움말' }))
    expect(screen.getByRole('heading', { name: '작전 지침' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '지도 범례' })).toBeVisible()
    expect(screen.getByText('아군 영토')).toBeVisible()
    expect(screen.getByText('적 영토')).toBeVisible()
    expect(screen.getByText('분쟁 지역')).toBeVisible()
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

  it('besieges the fortified site instead of the garrisoned unit on the same tile', () => {
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
    expect(container.querySelector(`[data-site-id="${capital.id}"]`))
      .toHaveClass('site-marker--hit')
    expect(container.querySelector(`[data-unit-id="${defender.id}"]`))
      .not.toHaveClass('unit-token--hit')
    expect(container.querySelector('.damage-popup')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(50))

    expect(container.querySelector(`[data-unit-id="${defender.id}"]`))
      .toHaveAttribute('data-health', '100/100')
    expect(container.querySelector(`[data-site-id="${capital.id}"]`))
      .not.toHaveAttribute('data-health', '120/120')
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

  it('shows a compact net income summary with an accessible economy popover', async () => {
    const user = userEvent.setup()
    const initial = createEasyPlayerState('ui-upkeep-status')
    const factionId = initial.humanFactionId
    const income = getFactionIncome(initial, factionId)
    const upkeep = getFactionUpkeep(initial, factionId)
    const netIncome = getFactionNetIncome(initial, factionId)
    const signedNetIncome = netIncome > 0 ? `+${netIncome}` : `${netIncome}`
    const initialView = renderApp(initial)
    const status = initialView.container.querySelector<HTMLElement>('.status-bar')!
    const economyToggle = within(status).getByRole('button', {
      name: `순수입 ${signedNetIncome}/턴`,
    })

    expect(status).toHaveTextContent('자원 20')
    expect(status).toHaveTextContent(`순수입 ${signedNetIncome}/턴`)
    expect(status).not.toHaveTextContent(`수입 ${income}`)
    expect(status).not.toHaveTextContent('유지비')
    expect(status).not.toHaveTextContent('예약')
    expect(economyToggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(economyToggle)

    const economyDetails = screen.getByRole('region', { name: '경제 상세' })
    expect(economyToggle).toHaveAttribute('aria-expanded', 'true')
    expect(economyDetails).toHaveTextContent(`수입+${income}`)
    expect(economyDetails).toHaveTextContent(`유지비${upkeep}`)
    expect(economyDetails).toHaveTextContent(`순수입${signedNetIncome}/턴`)
    expect(economyDetails).not.toHaveTextContent('예약 유지비')

    await user.click(economyToggle)
    expect(screen.queryByRole('region', { name: '경제 상세' })).not.toBeInTheDocument()

    await user.click(economyToggle)
    await user.click(document.body)
    expect(screen.queryByRole('region', { name: '경제 상세' })).not.toBeInTheDocument()

    await user.click(economyToggle)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: '경제 상세' })).not.toBeInTheDocument()
    initialView.unmount()

    const deficitState = {
      ...initial,
      sites: initial.sites.filter(
        (site) => site.ownerId !== initial.humanFactionId,
      ),
    }
    const deficitNetIncome = getFactionNetIncome(deficitState, factionId)
    const deficitReserve = getFactionUpkeepReserve(deficitState, factionId)
    const deficitView = renderApp(deficitState)
    const deficitStatus = deficitView.container.querySelector<HTMLElement>(
      '.status-bar',
    )!
    const deficitToggle = within(deficitStatus).getByRole('button', {
      name: `순수입 ${deficitNetIncome}/턴`,
    })

    expect(deficitToggle).not.toHaveClass('status-bar__deficit')
    expect(deficitStatus).not.toHaveTextContent('예약 유지비')

    await user.click(deficitToggle)

    const deficitDetails = screen.getByRole('region', { name: '경제 상세' })
    expect(deficitDetails).toHaveTextContent(`순수입${deficitNetIncome}/턴`)
    expect(deficitReserve).toBe(0)
    expect(deficitDetails).not.toHaveTextContent('예약 유지비')
    deficitView.unmount()
  })

  it('confirms player disbanding, clears selection, and gives no refund', async () => {
    const user = userEvent.setup()
    const initial = createEasyPlayerState('ui-unit-disband')
    const unit = initial.units.find(
      (candidate) => candidate.factionId === initial.humanFactionId,
    )!
    const confirm = vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    const { container } = renderApp({
      ...initial,
      selectedUnitId: unit.id,
    })

    const info = screen.getByLabelText('부대 정보')
    expect(info).toHaveTextContent('유지비')
    expect(info).toHaveTextContent('0 자원/턴')
    const disband = screen.getByRole('button', { name: '해산' })
    await user.click(disband)
    expect(container.querySelector(`[data-unit-id="${unit.id}"]`))
      .toBeInTheDocument()

    await user.click(disband)
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(container.querySelector(`[data-unit-id="${unit.id}"]`))
      .not.toBeInTheDocument()
    expect(screen.queryByLabelText('부대 정보')).not.toBeInTheDocument()
    expect(screen.getByLabelText('현재 게임 상태')).toHaveTextContent('자원 20')
  })

  it('disables disbanding outside the player active turn', () => {
    const initial = createInitialGameState('ui-unit-disband-inactive')
    const unit = initial.units.find(
      (candidate) => candidate.factionId === initial.humanFactionId,
    )!
    const enemyFactionId = initial.factionOrder.find(
      (factionId) => factionId !== initial.humanFactionId,
    )!

    renderApp({
      ...initial,
      activeFactionId: enemyFactionId,
      selectedUnitId: unit.id,
    })

    expect(screen.getByRole('button', { name: '해산' })).toBeDisabled()
  })

  it('waives projected upkeep and production costs for the player', async () => {
    const user = userEvent.setup()
    const initial = createEasyPlayerState('ui-production-reserve')
    const city = initial.sites.find(
      (site) =>
        site.ownerId === initial.humanFactionId && site.kind === 'city',
    )!
    const humanUnits = initial.units
      .filter((unit) => unit.factionId === initial.humanFactionId)
      .map((unit) => ({ ...unit, type: 'cavalry' as const }))
    const extraPosition = initial.tiles.find(
      (tile) =>
        !initial.units.some(
          (unit) =>
            unit.position.q === tile.position.q &&
            unit.position.r === tile.position.r,
        ) &&
        !initial.sites.some(
          (site) =>
            site.position.q === tile.position.q &&
            site.position.r === tile.position.r,
        ),
    )!.position
    const extra = {
      ...humanUnits[0],
      id: 'reserve-cavalry-extra',
      position: extraPosition,
    }
    const state = {
      ...initial,
      resources: { ...initial.resources, [initial.humanFactionId]: 11 },
      units: [
        ...initial.units.filter(
          (unit) => unit.factionId !== initial.humanFactionId,
        ),
        ...humanUnits,
        extra,
      ],
    }
    const { container } = renderApp(state)

    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(city.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '생산' }))
    const production = screen.getByLabelText('부대 생산')
    const infantry = within(production).getByRole('button', { name: /보병/ })
    expect(infantry).toBeEnabled()
    expect(infantry).toHaveTextContent('0 자원')
    expect(infantry).not.toHaveTextContent('다음 유지비')
  })

  it('waives upkeep reservation on player development and construction', async () => {
    const user = userEvent.setup()
    const initial = createEasyPlayerState('ui-investment-reserve')
    const city = initial.sites.find(
      (site) =>
        site.ownerId === initial.humanFactionId && site.kind === 'city',
    )!
    const cavalry = initial.units
      .filter((unit) => unit.factionId === initial.humanFactionId)
      .map((unit) => ({ ...unit, type: 'cavalry' as const }))
    const developmentState = {
      ...initial,
      resources: { ...initial.resources, [initial.humanFactionId]: 10 },
      units: [
        ...initial.units.filter(
          (unit) => unit.factionId !== initial.humanFactionId,
        ),
        ...cavalry,
      ],
      sites: initial.sites.map((site) =>
        site.id === city.id
          ? {
              ...site,
              kind: 'outpost' as const,
              footprint: undefined,
              hp: 50,
              maxHp: 50,
            }
          : site,
      ),
    }
    const development = renderApp(developmentState)
    await user.click(development.container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(city.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '발전' }))
    expect(screen.getByLabelText('거점 발전')).toHaveTextContent('비용0 자원')
    expect(screen.getByRole('button', { name: '발전 확인' })).toBeEnabled()
    development.unmount()

    const constructionState = {
      ...initial,
      resources: { ...initial.resources, [initial.humanFactionId]: 15 },
      units: [
        ...initial.units.filter(
          (unit) => unit.factionId !== initial.humanFactionId,
        ),
        ...cavalry,
        {
          ...cavalry[0],
          id: 'construction-reserve-extra',
          position: initial.tiles.find(
            (tile) =>
              !initial.units.some(
                (unit) =>
                  unit.position.q === tile.position.q &&
                  unit.position.r === tile.position.r,
              ) &&
              !initial.sites.some(
                (site) =>
                  site.position.q === tile.position.q &&
                  site.position.r === tile.position.r,
              ),
          )!.position,
        },
      ],
    }
    const construction = renderApp(constructionState)
    await user.click(construction.container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(city.position)}"]`,
    )!)
    await user.click(screen.getByRole('tab', { name: '건설' }))
    const granary = within(screen.getByLabelText('도시 건설')).getByRole(
      'button',
      { name: /곡창/ },
    )
    expect(granary).toBeEnabled()
    expect(granary).toHaveTextContent('0 자원')
    expect(granary).not.toHaveTextContent('다음 유지비')
    construction.unmount()
  })

  it('confirms settlement inline, highlights candidates, and consumes the settler', () => {
    const state = createInitialGameState('ui-settlement', {
      boardSize: BOARD_SIZE_PRESETS.tiny,
    })
    const factionId = state.humanFactionId
    state.resources[factionId] = 100
    state.units = []
    const position = getSettleablePositions(state, factionId)[0]
    const settler: Unit = {
      id: 'ui-settler',
      name: '개척자',
      factionId,
      type: 'settler',
      position,
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    state.units = [settler]
    state.selectedUnitId = settler.id
    const { container } = renderApp(state)

    expect(screen.getByLabelText('부대 정보')).toHaveTextContent('비전투')
    expect(screen.getByLabelText('부대 정보')).not.toHaveTextContent('사거리')
    expect(container.querySelectorAll('[data-founding-candidate="true"].map-tile').length)
      .toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '정착' }))
    expect(screen.getByLabelText('정착 및 건설 확인')).toHaveTextContent(
      '개척자가 소모됩니다.',
    )
    const confirm = screen.getByRole('button', { name: '건설 확인' })
    expect(confirm).toBeEnabled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByLabelText('정착 및 건설 확인')).not.toBeInTheDocument()
    expect(screen.getByLabelText('부대 정보')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '정착' }))
    fireEvent.click(screen.getByRole('button', { name: '건설 확인' }))
    expect(container.querySelector(`[data-unit-id="${settler.id}"]`)).toBeNull()
    expect(container.querySelector('[data-site-icon="village"]')).toBeInTheDocument()
  })

  it('constructs for free while keeping the builder after its action ends', () => {
    const state = createEasyPlayerState('ui-builder-construction', {
      boardSize: BOARD_SIZE_PRESETS.tiny,
    })
    const factionId = state.humanFactionId
    state.resources[factionId] = 0
    state.units = []
    const position = getConstructiblePositions(state, factionId, 'outpost')[0]
    const builder: Unit = {
      id: 'ui-builder',
      name: '건설자',
      factionId,
      type: 'builder',
      position,
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    state.units = [builder]
    state.selectedUnitId = builder.id
    const { container } = renderApp(state)

    expect(container.querySelector('[data-unit-icon="builder"]')).toBeInTheDocument()
    const builderToken = container.querySelector(`[data-unit-id="${builder.id}"]`)!
    expect(builderToken).toHaveClass(
      'unit-token--civilian',
      'unit-token--selected',
    )
    expect(builderToken).toHaveAttribute('data-unit-role', 'civilian')
    expect(builderToken.querySelector('.unit-health-bar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /전초기지.*0 자원/ }))
    expect(screen.getByLabelText('정착 및 건설 확인')).toHaveTextContent(
      '0 자원을 지불하고 건설자는 행동을 종료합니다.',
    )
    expect(container.querySelectorAll('[data-founding-candidate="true"].map-tile').length)
      .toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '건설 확인' }))

    expect(container.querySelector(`[data-unit-id="${builder.id}"]`))
      .toHaveClass('unit-token--civilian', 'unit-token--acted')
    expect(container.querySelector('[data-site-icon="outpost"]')).toBeInTheDocument()
  })
})
