import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteIcon } from './SiteIcon'

describe('SiteIcon', () => {
  it.each(['stronghold', 'village', 'farm', 'mine', 'city'] as const)(
    'uses the eastern asset for %s sites',
    (kind) => {
      const { container } = render(<SiteIcon kind={kind} ownerId="f2" />)

      expect(container.querySelector('img')).toHaveAttribute(
        'data-site-icon-variant',
        'eastern',
      )
    },
  )
})
