import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type {
  ProductionSupport,
  SettlementProductionCapacity,
} from '../game/settlement'
import type { Site } from '../game/types'
import { CityPanel } from './CityPanel'

const town: Site = {
  id: 'town',
  name: '북부 마을',
  kind: 'town',
  position: { q: 0, r: 0 },
  ownerId: 'player',
  buildings: [],
}

describe('CityPanel production support', () => {
  it('shows a settlement production usage and capacity', () => {
    const settlementCapacity: SettlementProductionCapacity = {
      settlement: town,
      used: 2,
      capacity: 2,
    }

    render(
      <CityPanel
        site={town}
        canProduce={false}
        settlementCapacity={settlementCapacity}
        onTabChange={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByText('지원 생산 거점').nextElementSibling).toHaveTextContent(
      '2 / 2',
    )
  })

  it('shows the supporting settlement from a production site', () => {
    const farm: Site = {
      id: 'farm',
      name: '북부 농장',
      kind: 'farm',
      position: { q: 2, r: 0 },
      ownerId: 'player',
      level: 1,
      buildings: [],
    }
    const productionSupport: ProductionSupport = {
      settlement: town,
      distance: 2,
      used: 1,
      capacity: 2,
    }

    render(
      <CityPanel
        site={farm}
        canProduce={false}
        showProductionSupport
        productionSupport={productionSupport}
        onTabChange={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByText('지원 정착지').nextElementSibling).toHaveTextContent(
      '북부 마을',
    )
    expect(screen.getByText('지원 현황').nextElementSibling).toHaveTextContent(
      '1 / 2',
    )
  })

  it('shows when an owned production site has no supporting settlement', () => {
    const farm: Site = {
      id: 'unsupported-farm',
      name: '외딴 농장',
      kind: 'farm',
      position: { q: 4, r: 0 },
      ownerId: 'player',
      level: 1,
      buildings: [],
    }

    render(
      <CityPanel
        site={farm}
        canProduce={false}
        showProductionSupport
        onTabChange={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByText('지원 정착지').nextElementSibling).toHaveTextContent(
      '없음',
    )
  })
})
