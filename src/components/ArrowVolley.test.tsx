import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArrowVolley } from './ArrowVolley'

describe('ArrowVolley', () => {
  it('renders a dense deterministic arrow rain in grouped batches', () => {
    render(
      <ArrowVolley
        startPixel={{ x: 20, y: 30 }}
        targetPixel={{ x: 160, y: 90 }}
      />,
    )

    const arrows = screen.getByTestId('arrow-volley').querySelectorAll(
      '.arrow-volley__arrow',
    )
    expect(arrows).toHaveLength(18)
    expect(
      [...arrows].map((arrow) =>
        (arrow as HTMLElement).style.getPropertyValue('--arrow-delay'),
      ),
    ).toEqual(
      [
        0, 6, 11, 3, 8, 14,
        90, 96, 101, 93, 98, 104,
        180, 186, 191, 183, 188, 194,
      ].map((delay) => `${delay}ms`),
    )

    for (const arrow of arrows) {
      const style = (arrow as HTMLElement).style
      expect(style.getPropertyValue('--arrow-start-x')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-start-y')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-rise-x')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-rise-y')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-mid-x')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-mid-y')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-descent-x')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-descent-y')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-end-x')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-end-y')).toMatch(/px$/)
      expect(style.getPropertyValue('--arrow-start-angle')).toMatch(/deg$/)
      expect(style.getPropertyValue('--arrow-rise-angle')).toMatch(/deg$/)
      expect(style.getPropertyValue('--arrow-mid-angle')).toMatch(/deg$/)
      expect(style.getPropertyValue('--arrow-end-angle')).toMatch(/deg$/)
    }

    const impactAngle = Number.parseFloat(
      (arrows[0] as HTMLElement).style.getPropertyValue('--arrow-end-angle'),
    )
    expect(impactAngle).toBeGreaterThan(45)

    const impacts = [...arrows].map((arrow) => {
      const style = (arrow as HTMLElement).style
      return {
        x: Number.parseFloat(style.getPropertyValue('--arrow-end-x')),
        y: Number.parseFloat(style.getPropertyValue('--arrow-end-y')),
      }
    })
    expect(new Set(impacts.map(({ x, y }) => `${x},${y}`)).size).toBe(18)
    expect(Math.max(...impacts.map(({ x }) => x)) - Math.min(...impacts.map(({ x }) => x)))
      .toBeGreaterThan(20)
    expect(Math.max(...impacts.map(({ y }) => y)) - Math.min(...impacts.map(({ y }) => y)))
      .toBeGreaterThan(20)
  })
})
