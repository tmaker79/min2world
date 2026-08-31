import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Site, Unit } from '../game/types'
import { GameResultPanel } from '../components/GameResultPanel'
import {
  LocalizationProvider,
  QUICK_LOCALE_STORAGE_KEY,
  resolveQuickLocale,
  useLocalization,
} from './locale'

function memoryStorage(value: string | null) {
  return {
    getItem: (key: string) =>
      key === QUICK_LOCALE_STORAGE_KEY ? value : null,
  }
}

describe('quick-match localization', () => {
  it('prefers a valid saved locale over browser languages', () => {
    expect(resolveQuickLocale(memoryStorage('en'), ['ko-KR'])).toBe('en')
    expect(resolveQuickLocale(memoryStorage('ko'), ['en-US'])).toBe('ko')
  })

  it('uses Korean for a Korean browser and English otherwise', () => {
    expect(resolveQuickLocale(memoryStorage(null), ['ko-KR', 'en-US'])).toBe(
      'ko',
    )
    expect(resolveQuickLocale(memoryStorage(null), ['ja-JP', 'en-US'])).toBe(
      'en',
    )
    expect(resolveQuickLocale(memoryStorage('invalid'), ['en-US'])).toBe('en')
  })

  it('localizes initial, produced, capital, and neutral display names', () => {
    const initialUnit: Unit = {
      id: 'f1-infantry-1',
      name: '청룡 보병대',
      factionId: 'f1',
      type: 'infantry',
      position: { q: 0, r: 0 },
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const producedUnit: Unit = {
      ...initialUnit,
      id: 'f1-archer-produced-3',
      name: '청색 궁병 3',
      type: 'archer',
    }
    const capital: Site = {
      id: 'site-f1-city',
      name: '청색 도시',
      kind: 'city',
      position: { q: 0, r: 0 },
      ownerId: 'f1',
      capitalFor: 'f1',
      buildings: [],
    }
    const neutral: Site = {
      ...capital,
      id: 'site-mine-2',
      name: '중립 광산 2',
      kind: 'mine',
      ownerId: 'neutral',
      capitalFor: undefined,
    }

    function Probe() {
      const { unitName, siteName } = useLocalization()
      return (
        <output>
          {[
            unitName(initialUnit),
            unitName(producedUnit),
            siteName(capital),
            siteName(neutral),
          ].join('|')}
        </output>
      )
    }

    render(
      <LocalizationProvider locale="en">
        <Probe />
      </LocalizationProvider>,
    )

    expect(screen.getByText(/Azure Dragon Infantry/)).toHaveTextContent(
      'Azure Dragon Infantry|Blue Archer 3|Blue City|Neutral Mine 2',
    )
  })

  it('renders quick-match results in either locale', () => {
    const actions = { onRestart: () => undefined, onRandomRestart: () => undefined }
    const view = render(
      <LocalizationProvider locale="en">
        <GameResultPanel phase="victory" turn={7} {...actions} />
      </LocalizationProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Continent United' })).toBeVisible()
    expect(screen.getByText('Victory in 7 turns')).toBeVisible()

    view.rerender(
      <LocalizationProvider locale="ko">
        <GameResultPanel phase="victory" turn={7} {...actions} />
      </LocalizationProvider>,
    )
    expect(screen.getByRole('heading', { name: '대륙 통일' })).toBeVisible()
    expect(screen.getByText('7턴 만에 승리')).toBeVisible()
  })
})
