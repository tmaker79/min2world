import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../game/initialState'
import type { Site, Unit } from '../game/types'
import { InfoPanel } from './InfoPanel'

describe('InfoPanel territory feedback', () => {
  it('explains that production sites require owned territory', () => {
    const initial = createInitialGameState('territory-builder-feedback')
    const factionId = initial.activeFactionId
    const enemyFactionId = initial.factionOrder.find(
      (candidate) => candidate !== factionId,
    )!
    const center = initial.tiles[Math.floor(initial.tiles.length / 2)].position
    const city = initial.sites.find((site) => site.ownerId === factionId)!
    const ownedCity: Site = {
      ...city,
      kind: 'city',
      position: { q: center.q - 2, r: center.r },
      footprint: undefined,
      ownerId: factionId,
      hp: 120,
      maxHp: 120,
    }
    const enemyCity: Site = {
      ...ownedCity,
      id: 'territory-enemy-city',
      position: { q: center.q + 2, r: center.r },
      ownerId: enemyFactionId,
      capitalFor: enemyFactionId,
    }
    const builder: Unit = {
      id: 'territory-builder',
      name: '건설자',
      factionId,
      type: 'builder',
      position: center,
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const state = {
      ...initial,
      resources: { ...initial.resources, [factionId]: 100 },
      selectedUnitId: builder.id,
      units: [builder],
      sites: [ownedCity, enemyCity],
      tiles: initial.tiles.map((tile) => ({
        ...tile,
        terrain: 'plain' as const,
        siteId: undefined,
      })),
    }

    render(
      <InfoPanel
        state={state}
        unit={builder}
        canMove={false}
        moveMode={false}
        onMoveModeChange={() => undefined}
        canDisband={false}
        onDisband={() => undefined}
        foundingKind="farm"
        onFoundingKindSelected={() => undefined}
        onFoundingCancel={() => undefined}
        onFoundingConfirm={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      '생산 거점은 자기 영토에만 건설할 수 있습니다.',
    )
    expect(screen.getByRole('button', { name: '건설 확인' })).toBeDisabled()
  })
})
