import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SITE_STATS, SITE_TYPE_LABELS } from '../game/rules'
import type { SiteType } from '../game/types'
import { Legend } from './Legend'

function getSiteRow(kind: SiteType) {
  return screen.getByText(SITE_TYPE_LABELS[kind]).closest('li')
}

describe('Legend', () => {
  it('shows only quick-mode sites with catalog-backed economy details', () => {
    render(<Legend embedded gameMode="quick" />)

    expect(getSiteRow('city')).toHaveTextContent(
      `수입 ${SITE_STATS.city.income} · 생산`,
    )
    expect(getSiteRow('farm')).toHaveTextContent(
      `수입 ${SITE_STATS.farm.income}`,
    )
    expect(getSiteRow('mine')).toHaveTextContent(
      `수입 ${SITE_STATS.mine.income}`,
    )
    expect(getSiteRow('blacksmith')).toHaveTextContent(
      `수입 ${SITE_STATS.blacksmith.income} · 군사 생산비 할인`,
    )
    expect(screen.queryByText(SITE_TYPE_LABELS.stronghold)).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_TYPE_LABELS.village)).not.toBeInTheDocument()
    expect(screen.getByText('아군 거점')).toBeVisible()
    expect(screen.getByText('적 거점')).toBeVisible()
    expect(screen.queryByText('적 통제 구역')).not.toBeInTheDocument()
  })

  it('shows every standard-mode site and identifies military sites as defensive', () => {
    render(<Legend embedded gameMode="standard" />)

    const siteKinds: SiteType[] = [
      'outpost',
      'keep',
      'stronghold',
      'village',
      'town',
      'city',
      'farm',
      'mine',
      'blacksmith',
    ]
    for (const kind of siteKinds) {
      expect(getSiteRow(kind)).toBeInTheDocument()
    }

    expect(getSiteRow('outpost')).toHaveTextContent('수입 없음 · 방어 거점')
    expect(getSiteRow('keep')).toHaveTextContent('수입 없음 · 방어 거점')
    expect(getSiteRow('stronghold')).toHaveTextContent('수입 없음 · 방어 거점')
    expect(getSiteRow('town')).toHaveTextContent(
      `수입 ${SITE_STATS.town.income}`,
    )
    expect(getSiteRow('city')).toHaveTextContent(
      `수입 ${SITE_STATS.city.income} · 생산`,
    )
    expect(screen.queryByText('적 통제 구역')).not.toBeInTheDocument()
  })
})
