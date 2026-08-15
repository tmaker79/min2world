import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GameState, Tile } from '../game/types'
import { GameMap } from './GameMap'

function createLargeRenderState(columns: number, rows: number): GameState {
  const tiles: Tile[] = []
  for (let r = 0; r < rows; r += 1) {
    for (let q = 0; q < columns; q += 1) {
      tiles.push({
        id: `tile-${q}-${r}`,
        position: { q, r },
        terrain: 'plain',
      })
    }
  }

  return {
    schemaVersion: 6,
    mapSeed: 'large-render',
    mapGenerationVersion: 4,
    turn: 1,
    phase: 'playing',
    activeFactionId: 'player',
    resources: { player: 0, enemy: 0 },
    tiles,
    units: [],
    sites: [],
  }
}

describe('GameMap large-map rendering', () => {
  it('keeps a 10,000-tile map canvas while mounting only the viewport window', () => {
    const state = createLargeRenderState(100, 100)
    const { container } = render(
      <GameMap
        state={state}
        scrollElement={null}
        reachableKeys={new Set()}
        attackableKeys={new Set()}
        deployableKeys={new Set()}
        zoneOfControlKeys={new Set()}
        disabled={false}
        onTileClick={() => undefined}
      />,
    )

    const renderedTiles = container.querySelectorAll('.map-tile')
    expect(renderedTiles.length).toBeGreaterThan(100)
    expect(renderedTiles.length).toBeLessThan(2_000)
    expect(screenSize(container, 'width')).toBeGreaterThan(5_000)
    expect(screenSize(container, 'height')).toBeGreaterThan(4_000)
  })
})

function screenSize(container: HTMLElement, dimension: 'width' | 'height') {
  const map = container.querySelector<HTMLElement>('.game-map')!
  return Number.parseFloat(map.style[dimension])
}
