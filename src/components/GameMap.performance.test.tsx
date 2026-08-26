import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { positionKey } from '../game/hex'
import { GAME_SCHEMA_VERSION, type GameState, type Tile } from '../game/types'
import { createTerritoryIndex } from '../game/territory'
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
        buildings: [],
      },
      {
        id: 'red-capital',
        name: '적색 수도',
        kind: 'stronghold',
        position: { q: 80, r: 80 },
        ownerId: 'f2',
        capitalFor: 'f2',
        buildings: [],
      },
    ],
  }
}

describe('GameMap large-map rendering', () => {
  it('keeps a 10,000-tile map canvas while mounting only the viewport window', () => {
    const state = createLargeRenderState(100, 100)
    const foundingCandidateKeys = new Set(
      state.tiles.map((tile) => positionKey(tile.position)),
    )
    const { container } = render(
      <GameMap
        state={state}
        territoryByKey={createTerritoryIndex(state)}
        scrollElement={null}
        reachableKeys={new Set()}
        attackableKeys={new Set()}
        attackableSiteKeys={new Set()}
        deployableKeys={new Set()}
        foundingCandidateKeys={foundingCandidateKeys}
        zoneOfControlKeys={new Set()}
        showSiteAssetPreview
        disabled={false}
        onTileClick={() => undefined}
      />,
    )

    const renderedTiles = container.querySelectorAll('.map-tile')
    expect(renderedTiles.length).toBeGreaterThan(100)
    expect(renderedTiles.length).toBeLessThan(2_000)
    expect(
      container.querySelectorAll('[data-founding-candidate="true"]'),
    ).toHaveLength(renderedTiles.length)
    expect(screenSize(container, 'width')).toBeGreaterThan(5_000)
    expect(screenSize(container, 'height')).toBeGreaterThan(4_000)
    const previewMarkers = [
      ...container.querySelectorAll('[data-site-asset-preview]'),
    ]
    expect(previewMarkers).toHaveLength(14)
    expect(
      previewMarkers.map((marker) =>
        marker.getAttribute('data-site-asset-preview'),
      ),
    ).toEqual([
      'farm-1',
      'farm-2',
      'farm-3',
      'mine-1',
      'mine-2',
      'mine-3',
      'smithy-1',
      'smithy-2',
      'smithy-3',
      'village',
      'town',
      'outpost',
      'keep',
      'stronghold',
    ])
    const expectedSiteDetails = [
      ['farm', '1'],
      ['farm', '2'],
      ['farm', '3'],
      ['mine', '1'],
      ['mine', '2'],
      ['mine', '3'],
      ['blacksmith', '1'],
      ['blacksmith', '2'],
      ['blacksmith', '3'],
      ['village', '1'],
      ['town', '1'],
      ['outpost', '1'],
      ['keep', '1'],
      ['stronghold', '1'],
    ]
    for (const [index, marker] of previewMarkers.entries()) {
      expect(marker).toHaveAttribute('data-site-asset-preview-footprint', '1')
      expect(marker.querySelector('[data-site-icon]')).toHaveAttribute(
        'data-site-icon',
        expectedSiteDetails[index][0],
      )
      expect(marker.querySelector('[data-site-icon]')).toHaveAttribute(
        'data-site-level',
        expectedSiteDetails[index][1],
      )
      expect(marker.querySelector('[data-site-icon]')).toHaveAttribute(
        'data-site-icon-variant',
        index === 9 || index === 10 ? 'eastern' : 'western',
      )
    }
    expect(container.querySelector('.site-asset-preview__label')).toBeNull()
  })
})

function screenSize(container: HTMLElement, dimension: 'width' | 'height') {
  const map = container.querySelector<HTMLElement>('.game-map')!
  return Number.parseFloat(map.style[dimension])
}
