import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import { chooseAiAction } from '../game/ai'
import { UNIT_TYPE_LABELS } from '../game/rules'
import type { GameAction, GameState } from '../game/types'

type UseAiTurnOptions = {
  state: GameState
  combatActive: boolean
  dispatch: Dispatch<GameAction>
  startCombat: (attackerId: string, defenderId: string) => void
}

function getActionAnnouncement(state: GameState, action: GameAction): string {
  if (action.type === 'turnEnded') {
    return 'AI 작전이 끝났습니다. 플레이어 턴을 시작합니다.'
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
      state.activeFactionId !== 'enemy' ||
      combatActive
    ) {
      return
    }

    const action = chooseAiAction(state)
    if (!action) {
      return
    }

    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timer = window.setTimeout(
      () => {
        setAnnouncement(getActionAnnouncement(state, action))

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
