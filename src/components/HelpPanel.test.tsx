import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpPanel } from './HelpPanel'

describe('HelpPanel', () => {
  it('starts on controls and switches tabs with click and keyboard navigation', () => {
    const onShowFirstTurnGuide = vi.fn()
    render(
      <HelpPanel
        gameMode="standard"
        onShowFirstTurnGuide={onShowFirstTurnGuide}
      />,
    )

    const controlsTab = screen.getByRole('tab', { name: '조작' })
    const rulesTab = screen.getByRole('tab', { name: '규칙' })
    const legendTab = screen.getByRole('tab', { name: '범례' })
    const creditsTab = screen.getByRole('tab', { name: '크레딧' })

    expect(controlsTab).toHaveAttribute('aria-selected', 'true')
    expect(rulesTab).toHaveAttribute('aria-selected', 'false')
    expect(creditsTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { name: '기본 조작' })).toBeVisible()
    expect(
      screen.getByText('지도를 드래그해 이동하고 마우스 휠이나 핀치로 확대·축소합니다.'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '첫 턴 안내 다시 보기' }))
    expect(onShowFirstTurnGuide).toHaveBeenCalledOnce()
    expect(screen.queryByRole('heading', { name: '생산·경제' })).not.toBeInTheDocument()

    fireEvent.click(rulesTab)
    expect(rulesTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '이동·전투' })).toBeVisible()
    expect(
      screen.getByText('적 통제 구역에 진입하면 추가 이동이 멈춥니다.'),
    ).toBeVisible()
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
    expect(screen.getByText('편집·변형 기반 자산:')).toBeVisible()
    expect(screen.getByText('제작자:')).toBeVisible()
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    )
    expect(screen.getByText('개발:').parentElement).toHaveTextContent(
      '개발: Honghyun',
    )
    expect(screen.getByRole('link', { name: 'GitHub 저장소' })).toHaveAttribute(
      'href',
      'https://github.com/tmaker79/min2world',
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

  it('shows quick-match shortcuts without standard-mode actions', () => {
    render(<HelpPanel gameMode="quick" onShowFirstTurnGuide={() => undefined} />)

    expect(screen.getByText('선택 중인 이동·공격·생산 취소')).toBeVisible()
    expect(
      screen.queryByText('선택 중인 이동·공격·생산·정착·발전·건설 취소'),
    ).not.toBeInTheDocument()
  })
})
