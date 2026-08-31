import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteCommandIcon } from './SiteCommandIcon'

describe('SiteCommandIcon', () => {
  it('renders the production pictogram accessibly', () => {
    const { container } = render(<SiteCommandIcon className="test-command-icon" />)
    const icon = container.querySelector('svg')

    expect(icon).toHaveClass('test-command-icon')
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).toHaveAttribute('focusable', 'false')
    expect(icon).toHaveAttribute('data-site-command-icon', 'production')
    expect(icon?.querySelector('circle')).toBeInTheDocument()
    expect(icon?.querySelectorAll('path')).toHaveLength(2)
  })
})
