import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '../game/gameCatalog'
import { UnitIcon } from './UnitIcon'

describe('UnitIcon', () => {
  it.each(UNIT_TYPES)('renders %s using inline vector paths', (type) => {
    const { container } = render(
      <UnitIcon type={type} className="test-unit-icon" />,
    )

    const icon = container.querySelector('svg')

    expect(icon).toHaveClass('test-unit-icon')
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).toHaveAttribute('focusable', 'false')
    expect(icon).toHaveAttribute('data-unit-icon', type)
    expect(icon?.querySelectorAll('path').length).toBeGreaterThan(0)
    expect(icon?.querySelector('image')).toBeNull()
  })

  it.each(['cavalry', 'archer', 'spearman'] as const)(
    'preserves the traced %s silhouette as a filled path',
    (type) => {
      const { container } = render(<UnitIcon type={type} />)
      const icon = container.querySelector('svg')

      expect(icon).toHaveAttribute('fill', 'currentColor')
      expect(icon).toHaveAttribute('stroke', 'none')
      expect(icon?.querySelector('path')).toHaveAttribute('fill-rule', 'evenodd')
    },
  )

  it.each(['infantry', 'settler', 'builder'] as const)(
    'preserves the original %s stroke paths',
    (type) => {
      const { container } = render(<UnitIcon type={type} />)
      const icon = container.querySelector('svg')

      expect(icon).toHaveAttribute('fill', 'none')
      expect(icon).toHaveAttribute('stroke', 'currentColor')
      expect(icon).toHaveAttribute('stroke-width', '1.9')
    },
  )
})
