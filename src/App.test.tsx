import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('10×10 지도와 양쪽 세력의 도시 및 유닛을 표시한다', () => {
    render(<App />)
    const map = screen.getByTestId('game-map')

    expect(within(map).getAllByRole('button')).toHaveLength(100)
    expect(screen.getByRole('button', { name: /푸른 성채/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /붉은 요새/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /청룡 보병대/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /적월 보병대/ })).toBeInTheDocument()
  })

  it('유닛을 선택하면 정보와 이동 가능한 타일을 표시한다', async () => {
    const user = userEvent.setup()
    render(<App />)

    const unitTile = screen.getByRole('button', { name: /청룡 보병대/ })
    await user.click(unitTile)

    expect(unitTile).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('청룡 보병대')).toBeInTheDocument()
    expect(screen.getByText('행동 가능')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-reachable="true"].map-tile').length).toBeGreaterThan(0)
  })

  it('이동 가능한 타일을 클릭하면 유닛을 이동시킨다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /청룡 보병대/ }))
    await user.click(screen.getByRole('button', { name: /^좌표 1, 6, 평지/ }))

    expect(
      screen.getByRole('button', { name: /좌표 1, 6, 평지, 청룡 보병대/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/지도에서 푸른 유닛을 선택하면/)).toBeInTheDocument()
  })

  it('턴 종료 시 턴 번호를 올리고 유닛 행동 상태를 초기화한다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /청룡 보병대/ }))
    await user.click(screen.getByRole('button', { name: /^좌표 1, 6, 평지/ }))
    expect(
      screen.getByRole('button', { name: /청룡 보병대.*행동 완료/ }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '턴 종료' }))

    const turnStatus = screen.getByText('현재 턴').parentElement
    expect(turnStatus).not.toBeNull()
    expect(within(turnStatus!).getByText('2')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /청룡 보병대.*행동 가능/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
