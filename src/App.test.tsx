import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getHexNeighbors, positionKey } from './game/hex'
import { createInitialGameState } from './game/initialState'
import type { GameState, Unit } from './game/types'

function renderApp(state: GameState = createInitialGameState('ui-seed')) {
  return render(<App initialState={state} />)
}

describe('Milestone 06 UI', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders all 91 keyboard-focusable pointy hex tiles and the current seed', () => {
    const { container } = renderApp()
    const map = screen.getByTestId('game-map')
    const tiles = map.querySelectorAll<HTMLButtonElement>('.map-tile')

    expect(tiles).toHaveLength(91)
    expect([...tiles].every((tile) => tile.type === 'button' && !tile.disabled)).toBe(true)
    expect(container.querySelector('.map-size')).toHaveTextContent('91 HEX')
    expect(container.querySelector('.seed-controls output')).toHaveTextContent('ui-seed')
    expect(container.querySelectorAll('.site-marker')).toHaveLength(8)
    expect(container.querySelectorAll('.unit-token')).toHaveLength(6)
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
    await user.click(container.querySelector(`[data-unit-id="${player.id}"]`)!.closest('button')!)
    const destination = container.querySelector<HTMLButtonElement>('[data-reachable="true"]')!

    await user.click(destination)
    expect(destination.querySelector(`[data-unit-id="${player.id}"]`)).toBeInTheDocument()
  })

  it('starts a deterministic game from a trimmed seed and validates empty input', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()
    const input = container.querySelector<HTMLInputElement>('.seed-controls input')!
    const submit = container.querySelector<HTMLButtonElement>('.seed-controls button[type="submit"]')!

    await user.clear(input)
    await user.click(submit)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.type(input, '  next-map  ')
    await user.click(submit)
    expect(container.querySelector('.seed-controls output')).toHaveTextContent('next-map')
    expect(container.querySelectorAll('.map-tile')).toHaveLength(91)
  })

  it('asks before replacing a game that has progressed', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('progress')
    state.turn = 2
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = renderApp(state)
    const input = container.querySelector<HTMLInputElement>('.seed-controls input')!

    await user.clear(input)
    await user.type(input, 'blocked-seed')
    await user.click(container.querySelector<HTMLButtonElement>('.seed-controls button[type="submit"]')!)

    expect(confirm).toHaveBeenCalledOnce()
    expect(container.querySelector('.seed-controls output')).toHaveTextContent('progress')
  })

  it('offers production only from a production-capable owned site', async () => {
    const user = userEvent.setup()
    const state = createInitialGameState('ui-production')
    const { container } = renderApp(state)
    const options = container.querySelectorAll<HTMLButtonElement>('.production-option')

    expect(options).toHaveLength(4)
    await user.click(options[0])
    const destination = container.querySelector<HTMLButtonElement>('[data-deployable="true"]')!
    await user.click(destination)

    expect(container.querySelectorAll('.unit-token')).toHaveLength(7)
    expect(container.querySelector('.status-bar')).toHaveTextContent('5')
  })

  it('shows victory immediately after occupying the enemy stronghold', async () => {
    const user = userEvent.setup()
    const initial = createInitialGameState('ui-victory')
    const capital = initial.sites.find((site) => site.capitalFor === 'enemy')!
    const start = getHexNeighbors(capital.position)[0]
    const winner: Unit = {
      id: 'winner', name: 'winner', factionId: 'player', type: 'infantry',
      position: start, hp: 10, maxHp: 10, movementRemaining: 2, hasActed: false,
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

    await user.click(container.querySelector(`[data-unit-id="${winner.id}"]`)!.closest('button')!)
    fireEvent.click(container.querySelector(`[data-coordinate="${positionKey(capital.position)}"]`)!)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('CAMPAIGN COMPLETE')).toBeInTheDocument()
    expect(screen.getByRole('dialog').querySelectorAll('button')).toHaveLength(2)
  })
})
