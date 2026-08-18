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

    await user.selectOptions(mapTypeSelect, 'forested')
    await user.click(screen.getByRole('button', { name: '게임 시작' }))

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        mapType: 'forested',
        factionCount: 2,
      }),
    )
  })
})
