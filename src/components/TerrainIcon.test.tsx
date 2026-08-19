import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TerrainIcon } from './TerrainIcon'

describe('TerrainIcon', () => {
  it.each([0, 1, 2])('renders desert variant %s', (variantIndex) => {
    const { container } = render(
      <TerrainIcon terrain="desert" variantIndex={variantIndex} />,
    )

    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-icon',
      'desert',
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-variant',
      String(variantIndex),
    )
  })

  it.each([0, 1])('renders tundra variant %s', (variantIndex) => {
    const { container } = render(
      <TerrainIcon terrain="tundra" variantIndex={variantIndex} />,
    )

    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-icon',
      'tundra',
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-variant',
      String(variantIndex),
    )
  })

  it('renders the conifer asset for tundra forest', () => {
    const { container } = render(<TerrainIcon terrain="tundraForest" />)

    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-icon',
      'tundraForest',
    )
  })
})
