import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteIcon } from './SiteIcon'

describe('SiteIcon', () => {
  it.each(['stronghold', 'village', 'farm', 'mine', 'city'] as const)(
    'uses the eastern asset for non-red %s sites',
    (kind) => {
      const { container } = render(<SiteIcon kind={kind} ownerId="f1" />)

      expect(container.querySelector('img')).toHaveAttribute(
        'data-site-icon-variant',
        'eastern',
      )
    },
  )

  it.each(['stronghold', 'village', 'farm', 'mine', 'city'] as const)(
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

  it('uses the western asset for the legacy red faction ID', () => {
    const { container } = render(<SiteIcon kind="stronghold" ownerId="enemy" />)

    expect(container.querySelector('img')).toHaveAttribute(
      'data-site-icon-variant',
      'western',
    )
  })

  it('uses the dedicated eastern city asset for city sites', () => {
    const { container } = render(<SiteIcon kind="city" />)

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('city-eastern-3tile-roofmatch.png'),
    )
  })
})
