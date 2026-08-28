import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HelpPanel } from './HelpPanel'

describe('HelpPanel', () => {
  it('starts on controls and switches tabs with click and keyboard navigation', () => {
    render(<HelpPanel gameMode="standard" />)

    const controlsTab = screen.getByRole('tab', { name: '조작' })
    const rulesTab = screen.getByRole('tab', { name: '규칙' })
    const legendTab = screen.getByRole('tab', { name: '범례' })

    expect(controlsTab).toHaveAttribute('aria-selected', 'true')
    expect(rulesTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { name: '기본 조작' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '생산·경제' })).not.toBeInTheDocument()

    fireEvent.click(rulesTab)
    expect(rulesTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '생산·경제' })).toBeVisible()

    rulesTab.focus()
    fireEvent.keyDown(rulesTab, { key: 'ArrowRight' })
    expect(legendTab).toHaveFocus()
    expect(legendTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '지도 범례' })).toBeVisible()

    fireEvent.keyDown(legendTab, { key: 'ArrowRight' })
    expect(controlsTab).toHaveFocus()
    expect(controlsTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(controlsTab, { key: 'End' })
    expect(legendTab).toHaveFocus()
    fireEvent.keyDown(legendTab, { key: 'Home' })
    expect(controlsTab).toHaveFocus()
    fireEvent.keyDown(controlsTab, { key: 'ArrowLeft' })
    expect(legendTab).toHaveFocus()
  })
})
