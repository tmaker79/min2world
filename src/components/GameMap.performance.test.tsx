import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GAME_SCHEMA_VERSION, type GameState, type Tile } from '../game/types'
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
    schemaVersion: GAME_SCHEMA_VERSION,
    mapSeed: 'large-render',
    mapType: 'balanced',
    mapGenerationVersion: 5,
    boardSize: { columns, rows },
    factionCount: 2,
    humanFactionId: 'f1',
    factionOrder: ['f1', 'f2'],
    turn: 1,
    phase: 'playing',
    activeFactionId: 'f1',
    resources: { f1: 0, f2: 0, f3: 0, f4: 0, player: 0, enemy: 0 },
    tiles,
    units: [],
    sites: [
      {
        id: 'blue-capital',
        name: '청색 수도',
        kind: 'stronghold',
        position: { q: 10, r: 10 },
        ownerId: 'f1',
        capitalFor: 'f1',
      },
      {
        id: 'red-capital',
        name: '적색 수도',
        kind: 'stronghold',
        position: { q: 80, r: 80 },
        ownerId: 'f2',
        capitalFor: 'f2',
      },
    ],
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
        showSiteAssetPreview
        disabled={false}
        onTileClick={() => undefined}
      />,
    )

    const renderedTiles = container.querySelectorAll('.map-tile')
    expect(renderedTiles.length).toBeGreaterThan(100)
    expect(renderedTiles.length).toBeLessThan(2_000)
    expect(screenSize(container, 'width')).toBeGreaterThan(5_000)
    expect(screenSize(container, 'height')).toBeGreaterThan(4_000)
    expect(container.querySelectorAll('[data-site-asset-preview]')).toHaveLength(12)
    expect(
      container.querySelectorAll('[data-site-asset-footprint-cell]'),
    ).toHaveLength(14)
    expect(
      container.querySelectorAll('[data-site-asset-footprint-cell="f1"]'),
    ).toHaveLength(7)
    expect(
      container.querySelectorAll('[data-site-asset-footprint-cell="f2"]'),
    ).toHaveLength(7)
    expect(
      container.querySelectorAll('[data-site-asset-footprint-kind="city"]'),
    ).toHaveLength(6)
    for (const cityMarker of container.querySelectorAll(
      '[data-site-asset-preview="city"]',
    )) {
      const cellTops = [
        ...cityMarker.querySelectorAll<HTMLElement>(
          '[data-site-asset-footprint-kind="city"]',
        ),
      ].map((cell) => Number.parseFloat(cell.style.top))
      const upperRow = Math.min(...cellTops)
      const lowerRow = Math.max(...cellTops)
      expect(cellTops.filter((top) => top === upperRow)).toHaveLength(1)
      expect(cellTops.filter((top) => top === lowerRow)).toHaveLength(2)
    }
    const previewMarkers = [
      ...container.querySelectorAll('[data-site-asset-preview]'),
    ]
    const expectedKinds = ['castle', 'city', 'village', 'farm', 'mine', 'smithy']
    const blueMarkers = previewMarkers.filter(
      (marker) => marker.getAttribute('data-site-asset-preview-owner') === 'f1',
    )
    const redMarkers = previewMarkers.filter(
      (marker) => marker.getAttribute('data-site-asset-preview-owner') === 'f2',
    )
    expect(
      blueMarkers.map((marker) => marker.getAttribute('data-site-asset-preview')),
    ).toEqual(expectedKinds)
    expect(
      redMarkers.map((marker) => marker.getAttribute('data-site-asset-preview')),
    ).toEqual(expectedKinds)
    for (const marker of previewMarkers) {
      const kind = marker.getAttribute('data-site-asset-preview')
      expect(marker).toHaveAttribute(
        'data-site-asset-preview-footprint',
        kind === 'castle' ? '4' : kind === 'city' ? '3' : '1',
      )
      expect(marker.querySelector('[data-site-icon]')).toHaveAttribute(
        'data-site-icon',
        marker.getAttribute('data-site-asset-preview'),
      )
      expect(marker.querySelector('[data-site-icon]')).toHaveAttribute(
        'data-site-icon-variant',
        kind === 'farm' ||
          kind === 'mine' ||
          kind === 'smithy' ||
          marker.getAttribute('data-site-asset-preview-owner') === 'f2'
          ? 'western'
          : 'eastern',
      )
    }
    expect(container.querySelector('.site-asset-preview__label')).toBeNull()
  })
})

function screenSize(container: HTMLElement, dimension: 'width' | 'height') {
  const map = container.querySelector<HTMLElement>('.game-map')!
  return Number.parseFloat(map.style[dimension])
}
