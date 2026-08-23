import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteIcon } from './SiteIcon'

describe('SiteIcon', () => {
  it.each(['village', 'town', 'city'] as const)(
    'uses the eastern asset for non-red %s sites',
    (kind) => {
      const { container } = render(<SiteIcon kind={kind} ownerId="f1" />)

      expect(container.querySelector('img')).toHaveAttribute(
        'data-site-icon-variant',
        'eastern',
      )
    },
  )

  it.each(['stronghold', 'farm', 'mine'] as const)(
    'always uses the western asset for %s sites',
    (kind) => {
      const { container } = render(<SiteIcon kind={kind} ownerId="f1" />)

      expect(container.querySelector('img')).toHaveAttribute(
        'data-site-icon-variant',
        'western',
      )
      expect(container.querySelector('img')).toHaveAttribute(
        'src',
        expect.stringContaining(`/assets/sites/${kind}.png`),
      )
    },
  )

  it.each(
    ['stronghold', 'village', 'farm', 'mine', 'town', 'city'] as const,
  )(
    'uses the western asset for red %s sites',
    (kind) => {
      const { container } = render(<SiteIcon kind={kind} ownerId="f2" />)

      expect(container.querySelector('img')).toHaveAttribute(
        'data-site-icon-variant',
        'western',
      )
      expect(container.querySelector('img')).toHaveAttribute(
        'src',
        expect.stringContaining(`/assets/sites/${kind}.png`),
      )
    },
  )

  it.each(['village', 'town'] as const)(
    'uses the default western asset for neutral %s sites',
    (kind) => {
      const { container } = render(
        <SiteIcon kind={kind} ownerId="neutral" />,
      )

      expect(container.querySelector('img')).toHaveAttribute(
        'data-site-icon-variant',
        'western',
      )
      expect(container.querySelector('img')).toHaveAttribute(
        'src',
        expect.stringContaining(`/assets/sites/${kind}.png`),
      )
    },
  )

  it.each([
    ['f1', 'city-eastern.png', 'eastern'],
    ['f2', 'city.png', 'western'],
  ] as const)(
    'uses the %s city asset for a starting capital',
    (ownerId, fileName, variant) => {
      const { container } = render(
        <SiteIcon kind="city" ownerId={ownerId} />,
      )
      const image = container.querySelector('img')

      expect(image).toHaveAttribute('data-site-icon', 'city')
      expect(image).toHaveAttribute('data-site-icon-variant', variant)
      expect(image).toHaveAttribute(
        'src',
        expect.stringContaining(`/assets/sites/${fileName}`),
      )
    },
  )

  it('uses the western asset for the legacy red faction ID', () => {
    const { container } = render(<SiteIcon kind="stronghold" ownerId="enemy" />)

    expect(container.querySelector('img')).toHaveAttribute(
      'data-site-icon-variant',
      'western',
    )
  })

  it('uses the dedicated eastern town asset for town sites', () => {
    const { container } = render(<SiteIcon kind="town" />)

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('town-eastern-3tile-roofmatch.png'),
    )
  })

  it.each([
    ['outpost', 1, 'outpost.png'],
    ['keep', 1, 'keep.png'],
    ['blacksmith', 1, 'smithy.png'],
    ['blacksmith', 2, 'smithy-level-2.png'],
    ['blacksmith', 3, 'smithy-level-3.png'],
    ['farm', 2, 'farm-level-2.png'],
    ['mine', 3, 'mine-level-3.png'],
  ] as const)('uses the dedicated %s level %s asset', (kind, level, fileName) => {
    const { container } = render(
      <SiteIcon kind={kind} ownerId="neutral" level={level} />,
    )

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining(`/assets/sites/${fileName}`),
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'data-site-level',
      String(level),
    )
  })
})
