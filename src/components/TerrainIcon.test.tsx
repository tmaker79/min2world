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

  it('renders the desert hill asset', () => {
    const { container } = render(<TerrainIcon terrain="desertHill" />)

    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-icon',
      'desertHill',
    )
  })

  it('renders the oasis asset', () => {
    const { container } = render(<TerrainIcon terrain="oasis" />)

    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-icon',
      'oasis',
    )
  })

  it('renders the windswept tundra tile', () => {
    const { container } = render(
      <TerrainIcon terrain="tundra" variantIndex={0} />,
    )

    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-icon',
      'tundra',
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-variant',
      '0',
    )
  })

  it('renders the conifer asset for tundra forest', () => {
    const { container } = render(<TerrainIcon terrain="tundraForest" />)

    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-icon',
      'tundraForest',
    )
  })

  it.each([0, 1])('renders tundra mountain variant %s', (variantIndex) => {
    const { container } = render(
      <TerrainIcon terrain="tundraMountain" variantIndex={variantIndex} />,
    )

    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-icon',
      'tundraMountain',
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'data-terrain-variant',
      String(variantIndex),
    )
  })
})
