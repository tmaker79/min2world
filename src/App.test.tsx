import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.getByTestId('minimap')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '미니맵 접기' })).toBeInTheDocument()
    expect(screen.getByLabelText('정보 패널')).toBeVisible()
    expect(screen.getByLabelText('정보 패널')).toHaveAttribute('data-info-mode', 'empty')
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '도움말' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '범례' })).not.toBeInTheDocument()
  }, 20_000)

  it('collapses and expands the minimap', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '미니맵 접기' }))
    expect(screen.getByTestId('minimap')).toHaveAttribute('data-collapsed', 'true')
    expect(screen.queryByLabelText('미니맵')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '미니맵 펼치기' }))
    expect(screen.getByTestId('minimap')).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByLabelText('미니맵')).toBeInTheDocument()
  })

  it('shows a compact unit summary tooltip on hover without changing selection', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-tooltip')
    const enemy = state.units.find((unit) => unit.factionId === 'enemy')!
    const { container } = renderApp(state)
    const tile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(enemy.position)}"]`,
    )!

    await user.hover(tile)

    expect(document.querySelector(`[data-unit-tooltip="${enemy.id}"]`)).toBeNull()

    const tooltip = await waitFor(() => {
      const next = document.querySelector(`[data-unit-tooltip="${enemy.id}"]`)
      expect(next).toBeVisible()
      return next
    })
    expect(tooltip).toHaveTextContent(enemy.name)
    expect(tooltip).toHaveTextContent('체력')
    expect(tooltip).toHaveTextContent(`${enemy.hp}/${enemy.maxHp}`)

    const infoCard = screen.getByLabelText('지형 정보')
    expect(infoCard).toHaveAttribute('data-info-mode', 'terrain')
    expect(infoCard).toHaveTextContent('이동 비용')
  })

  it('shows terrain details in the info panel while no unit is selected', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-terrain-info')
    const plain = state.tiles.find((tile) => tile.terrain === 'plain')!
    const { container } = renderApp(state)
    const tile = container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(plain.position)}"]`,
    )!

    await user.hover(tile)

    const infoCard = screen.getByLabelText('지형 정보')
    expect(infoCard).toHaveTextContent('평지')
    expect(infoCard).toHaveTextContent(`좌표 ${plain.position.q}, ${plain.position.r}`)
    expect(infoCard).toHaveTextContent('이동 비용')
    expect(infoCard).toHaveTextContent('1')
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
  })

  it('moves the selected unit onto a reachable axial cell', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-move')
    const player = state.units.find((unit) => unit.factionId === 'player')!
    const { container } = renderApp(state)
    await user.click(container.querySelector<HTMLButtonElement>(
      `.map-tile[data-coordinate="${positionKey(player.position)}"]`,
    )!)
    const destination = container.querySelector<HTMLButtonElement>('[data-reachable="true"]')!
    const destinationKey = destination.dataset.coordinate

    await user.click(destination)
    expect(container.querySelector(`[data-unit-id="${player.id}"]`)).toHaveAttribute(
      'data-coordinate',
      destinationKey,
    )
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

  it('offers production only from a production-capable owned site', async () => {
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

    const options = container.querySelectorAll<HTMLButtonElement>('.production-option')
    expect(options).toHaveLength(4)
    await user.click(options[0])
    const destination = container.querySelector<HTMLButtonElement>('[data-deployable="true"]')!
    await user.click(destination)

    expect(container.querySelectorAll('.unit-token')).toHaveLength(7)
    expect(container.querySelector('.status-bar')).toHaveTextContent('5')
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
    fireEvent.click(container.querySelector(`[data-coordinate="${positionKey(capital.position)}"]`)!)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('CAMPAIGN COMPLETE')).toBeInTheDocument()
    expect(screen.getByRole('dialog').querySelectorAll('button')).toHaveLength(2)
  })
})
