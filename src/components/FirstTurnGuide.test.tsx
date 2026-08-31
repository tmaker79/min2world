import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FirstTurnGuide } from './FirstTurnGuide'

describe('FirstTurnGuide', () => {
  it('shows concise quick guidance and supports both actions', () => {
    const onDismiss = vi.fn()
    const onOpenHelp = vi.fn()
    const { container } = render(
      <FirstTurnGuide
        gameMode="quick"
        onDismiss={onDismiss}
        onOpenHelp={onOpenHelp}
      />,
    )

    expect(screen.getByRole('dialog', { name: '첫 턴 안내' })).toBeVisible()
    expect(
      container.querySelector('.first-turn-guide__hero img'),
    ).toHaveAttribute('src', '/icons/main-game-icon.png')
    expect(container.querySelectorAll('.first-turn-guide__steps li')).toHaveLength(3)
    expect(screen.getByText('부대 선택')).toBeVisible()
    expect(screen.getByText('이동·공격')).toBeVisible()
    expect(screen.getByText('병력 생산·승리')).toBeVisible()
    expect(screen.getByText(/도시에서 병력을 생산하고 상대 수도를 점령하세요/))
      .toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '자세히 보기' }))
    expect(onOpenHelp).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '게임 시작' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('shows standard expansion guidance and traps focus until dismissed', () => {
    const onDismiss = vi.fn()
    const { container } = render(
      <FirstTurnGuide
        gameMode="standard"
        onDismiss={onDismiss}
        onOpenHelp={vi.fn()}
      />,
    )
    const detailsButton = screen.getByRole('button', { name: '자세히 보기' })
    const startButton = screen.getByRole('button', { name: '게임 시작' })

    expect(screen.getByText('확장·승리')).toBeVisible()
    expect(screen.getByText(/생산하고 정착·건설하며 상대 수도를 점령하세요/))
      .toBeVisible()
    expect(startButton).toHaveFocus()

    fireEvent.keyDown(startButton, { key: 'Tab' })
    expect(detailsButton).toHaveFocus()
    fireEvent.keyDown(detailsButton, { key: 'Tab', shiftKey: true })
    expect(startButton).toHaveFocus()
    fireEvent.keyDown(startButton, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledOnce()

    fireEvent.mouseDown(container.querySelector('.first-turn-guide__backdrop')!)
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })
})
