import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HelpPanel } from './HelpPanel'

describe('HelpPanel', () => {
  it('starts on controls and switches tabs with click and keyboard navigation', () => {
    render(<HelpPanel gameMode="standard" />)

    const controlsTab = screen.getByRole('tab', { name: '조작' })
    const rulesTab = screen.getByRole('tab', { name: '규칙' })
    const legendTab = screen.getByRole('tab', { name: '범례' })
    const creditsTab = screen.getByRole('tab', { name: '크레딧' })

    expect(controlsTab).toHaveAttribute('aria-selected', 'true')
    expect(rulesTab).toHaveAttribute('aria-selected', 'false')
    expect(creditsTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { name: '기본 조작' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '생산·경제' })).not.toBeInTheDocument()

    fireEvent.click(rulesTab)
    expect(rulesTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '생산·경제' })).toBeVisible()

    rulesTab.focus()
    fireEvent.keyDown(rulesTab, { key: 'ArrowRight' })
    expect(legendTab).toHaveFocus()
    expect(legendTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('지도 범례')).not.toBeInTheDocument()
    expect(screen.getByText('아군 영토')).toBeVisible()

    fireEvent.keyDown(legendTab, { key: 'ArrowRight' })
    expect(creditsTab).toHaveFocus()
    expect(creditsTab).toHaveAttribute('aria-selected', 'true')

    expect(
      screen.getByRole('link', { name: 'Hex Tiles: Fantasy' }),
    ).toHaveAttribute(
      'href',
      'https://cmartins.itch.io/hex-tiles-fantasy',
    )
    expect(screen.getByRole('link', { name: 'cmartins.art' })).toHaveAttribute(
      'href',
      'https://cmartins.itch.io/',
    )
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    )

    fireEvent.keyDown(creditsTab, { key: 'ArrowRight' })
    expect(controlsTab).toHaveFocus()
    expect(controlsTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(controlsTab, { key: 'End' })
    expect(creditsTab).toHaveFocus()
    fireEvent.keyDown(creditsTab, { key: 'Home' })
    expect(controlsTab).toHaveFocus()
    fireEvent.keyDown(controlsTab, { key: 'ArrowLeft' })
    expect(creditsTab).toHaveFocus()
  })
})
