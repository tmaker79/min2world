import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StartScreen } from './StartScreen'

describe('StartScreen', () => {
  it('starts with the selected map type', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<StartScreen onStart={onStart} />)

    const mapTypeSelect = screen.getByRole('combobox', {
      name: '지도 종류 선택',
    })
    expect(mapTypeSelect.querySelectorAll('option')).toHaveLength(4)
    expect(mapTypeSelect).toHaveValue('balanced')
    expect(screen.getByText('평지와 험지가 고르게 분포합니다.')).toBeInTheDocument()
    expect(screen.queryByText('MAP SEED')).not.toBeInTheDocument()

    await user.selectOptions(
      screen.getByRole('combobox', { name: '지도 크기 선택' }),
      'large',
    )
    await user.selectOptions(mapTypeSelect, 'forested')
    expect(screen.getByText('숲이 많아 방어적인 전장이 형성됩니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '게임 시작' }))

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        boardSize: { columns: 41, rows: 29 },
        mapType: 'forested',
        factionCount: 2,
        seed: expect.any(String),
      }),
    )
  })
})
