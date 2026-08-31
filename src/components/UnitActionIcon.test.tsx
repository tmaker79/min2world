import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UnitActionIcon } from './UnitActionIcon'

describe('UnitActionIcon', () => {
  it.each(['move', 'attack'] as const)('renders the %s vector icon', (action) => {
    const { container } = render(
      <UnitActionIcon action={action} className="test-action-icon" />,
    )
    const icon = container.querySelector('svg')

    expect(icon).toHaveClass('test-action-icon')
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).toHaveAttribute('focusable', 'false')
    expect(icon).toHaveAttribute('data-unit-action-icon', action)
    expect(icon?.querySelectorAll('path').length).toBeGreaterThan(0)
  })

  it('renders attack as a solid single-color pictogram', () => {
    const { container } = render(<UnitActionIcon action="attack" />)
    const icon = container.querySelector('[data-unit-action-icon="attack"]')
    const filledParts = icon?.querySelectorAll('[fill="currentColor"]')

    expect(filledParts?.length).toBeGreaterThan(0)
    filledParts?.forEach((part) => expect(part).toHaveAttribute('stroke', 'none'))
  })
})
