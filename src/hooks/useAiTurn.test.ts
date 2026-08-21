import { act, renderHook } from '@testing-library/react'
import { useCallback, useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from '../game/initialState'
import { gameReducer } from '../game/reducer'
import { getHexNeighbors, SITE_TYPE_LABELS } from '../game/rules'
import { getSiteDevelopmentTarget } from '../game/siteDevelopment'
import type { GameAction, GameState, Site, Unit } from '../game/types'
import { getAiActionAnnouncement } from './useAiTurn'
import { useAiTurn } from './useAiTurn'

function siegeState(siteHp = 50): GameState {
  const initial = createInitialGameState(`ai-siege-hook-${siteHp}`)
  const originalSite = initial.sites.find(
    (site) => site.capitalFor === initial.humanFactionId,
  )!
  const site: Site = {
    ...originalSite,
    kind: 'outpost',
    footprint: undefined,
    hp: siteHp,
    maxHp: 50,
  }
  const attacker: Unit = {
    id: 'ai-siege-unit',
    name: 'AI 궁병',
    factionId: initial.factionOrder.find(
      (factionId) => factionId !== initial.humanFactionId,
    )!,
    type: 'archer',
    position: getHexNeighbors(site.position, initial.boardSize)[0],
    hp: 100,
    maxHp: 100,
    movementRemaining: 2,
    hasActed: false,
  }
  return {
    ...initial,
    activeFactionId: attacker.factionId,
    resources: { ...initial.resources, [attacker.factionId]: 0 },
    units: [attacker],
    sites: [site],
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useAiTurn announcements', () => {
  it('announces AI site development with its target type', () => {
    const initial = createInitialGameState('ai-development-announcement')
    const site = initial.sites.find(
      (candidate) =>
        candidate.ownerId !== initial.humanFactionId &&
        getSiteDevelopmentTarget(candidate),
    )!
    const target = getSiteDevelopmentTarget(site)!

    expect(
      getAiActionAnnouncement(initial, {
        type: 'siteDeveloped',
        siteId: site.id,
      }),
    ).toBe(`${site.name}을 ${SITE_TYPE_LABELS[target.kind]}(으)로 발전시킵니다.`)
  })

  it('calculates site damage and capture announcements from before and after state', () => {
    const damaged = siegeState(50)
    const selected = gameReducer(damaged, {
      type: 'unitSelected',
      unitId: damaged.units[0].id,
    })
    const action: GameAction = {
      type: 'siteAttacked',
      attackerId: selected.units[0].id,
      siteId: selected.sites[0].id,
    }
    const afterDamage = gameReducer(selected, action)
    const damage = 50 - (afterDamage.sites[0].hp ?? 50)

    expect(getAiActionAnnouncement(selected, action, afterDamage)).toBe(
      `${selected.sites[0].name}에 ${damage} 피해`,
    )

    const capturable = { ...selected, sites: [{ ...selected.sites[0], hp: 1 }] }
    const captured = gameReducer(capturable, action)
    expect(getAiActionAnnouncement(capturable, action, captured)).toBe(
      `${capturable.sites[0].name}에 1 피해, ${capturable.sites[0].name} 점령`,
    )
  })

  it('starts AI site combat through the App callback without dispatching damage early', () => {
    vi.useFakeTimers()
    const initial = siegeState()
    const dispatched = vi.fn<(action: GameAction) => void>()
    const startCombat = vi.fn()
    const startSiteAttack = vi.fn(() => true)
    const { result } = renderHook(() => {
      const [state, reduce] = useReducer(gameReducer, initial)
      const dispatch = useCallback((action: GameAction) => {
        dispatched(action)
        reduce(action)
      }, [])
      const announcement = useAiTurn({
        state,
        combatActive: false,
        dispatch,
        startCombat,
        startSiteAttack,
      })
      return { state, announcement }
    })

    act(() => vi.advanceTimersByTime(50))
    expect(dispatched.mock.calls.map(([action]) => action.type)).toEqual([
      'unitSelected',
    ])

    act(() => vi.advanceTimersByTime(50))
    expect(dispatched.mock.calls.map(([action]) => action.type)).toEqual([
      'unitSelected',
    ])
    expect(startSiteAttack).toHaveBeenCalledWith(
      initial.units[0].id,
      initial.sites[0].id,
      initial.sites[0].position,
    )
    expect(result.current.announcement).toBe('AI 거점 공격')
    expect(startCombat).not.toHaveBeenCalled()
  })
})
