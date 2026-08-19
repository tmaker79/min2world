import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteIcon } from './SiteIcon'

describe('SiteIcon', () => {
  it.each(['f1', 'player'] as const)(
    'uses the eastern stronghold for the blue %s faction',
    (ownerId) => {
      const { container } = render(
        <SiteIcon kind="stronghold" ownerId={ownerId} />,
      )

      expect(container.querySelector('img')).toHaveAttribute(
        'data-site-icon-variant',
        'eastern',
      )
    },
  )

  it('keeps the default stronghold for other factions', () => {
    const { container } = render(<SiteIcon kind="stronghold" ownerId="f2" />)

    expect(container.querySelector('img')).not.toHaveAttribute(
      'data-site-icon-variant',
    )
  })
})
