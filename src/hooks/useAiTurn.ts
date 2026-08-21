import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import { chooseAiAction } from '../game/ai'
import { SITE_TYPE_LABELS, UNIT_TYPE_LABELS } from '../game/rules'
import { getSiteDevelopmentTarget } from '../game/siteDevelopment'
import type { GameAction, GameState } from '../game/types'

type UseAiTurnOptions = {
  state: GameState
  combatActive: boolean
  dispatch: Dispatch<GameAction>
  startCombat: (attackerId: string, defenderId: string) => void
}

export function getAiActionAnnouncement(
  state: GameState,
  action: GameAction,
): string {
  if (action.type === 'turnEnded') {
    return 'AI 작전이 끝났습니다.'
  }

  if ('unitId' in action) {
    const unit = state.units.find((candidate) => candidate.id === action.unitId)
    if (!unit) {
      return ''
    }

    if (action.type === 'unitSelected') {
      return `${unit.name} 작전 준비`
    }

    if (action.type === 'unitMoved') {
      return `${unit.name} 이동`
    }

    if (action.type === 'unitWaited') {
      return `${unit.name} 대기`
    }
  }

  if (action.type === 'unitAttacked') {
    const attacker = state.units.find(
      (unit) => unit.id === action.attackerId,
    )
    const defender = state.units.find(
      (unit) => unit.id === action.defenderId,
    )
    return attacker && defender
      ? `${attacker.name}이 ${defender.name}을 공격합니다.`
      : 'AI 공격'
  }

  if (action.type === 'unitProduced') {
    const site = state.sites.find(
      (candidate) => candidate.id === action.siteId,
    )
    return `${site?.name ?? '거점'}에서 ${UNIT_TYPE_LABELS[action.unitType]}을 생산합니다.`
  }

  if (action.type === 'siteDeveloped') {
    const site = state.sites.find(
      (candidate) => candidate.id === action.siteId,
    )
    const target = site ? getSiteDevelopmentTarget(site) : undefined
    return site && target
      ? `${site.name}을 ${SITE_TYPE_LABELS[target.kind]}(으)로 발전시킵니다.`
      : 'AI가 거점을 발전시킵니다.'
  }

  return ''
}

export function useAiTurn({
  state,
  combatActive,
  dispatch,
  startCombat,
}: UseAiTurnOptions) {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (
      state.phase !== 'playing' ||
      state.activeFactionId === state.humanFactionId ||
      combatActive
    ) {
      return
    }

    const action = chooseAiAction(state, state.activeFactionId)
    if (!action) {
      return
    }

    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timer = window.setTimeout(
      () => {
        setAnnouncement(getAiActionAnnouncement(state, action))

        if (action.type === 'unitAttacked') {
          startCombat(action.attackerId, action.defenderId)
          return
        }

        dispatch(action)
      },
      reducedMotion ? 50 : 400,
    )

    return () => window.clearTimeout(timer)
  }, [combatActive, dispatch, startCombat, state])

  return announcement
}
