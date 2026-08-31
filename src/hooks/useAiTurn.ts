import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import { chooseAiDecision } from '../game/ai'
import { comparePositions, getHexDistance } from '../game/hex'
import {
  getSiteMaxHp,
  SITE_TYPE_LABELS,
  UNIT_TYPE_LABELS,
} from '../game/rules'
import { getSiteDevelopmentTarget } from '../game/siteDevelopment'
import { getSiteOccupiedPositions } from '../game/siteFootprint'
import { BUILDING_DEFINITIONS } from '../game/cityAdministration'
import type { GameAction, GameState } from '../game/types'
import type { Localization } from '../i18n/locale'

type AiLocalization = Pick<
  Localization,
  't' | 'unitLabel' | 'siteLabel' | 'unitName' | 'siteName'
>

type UseAiTurnOptions = {
  state: GameState
  combatActive: boolean
  dispatch: Dispatch<GameAction>
  startCombat: (attackerId: string, defenderId: string) => void
  startSiteAttack: (
    attackerId: string,
    siteId: string,
    sitePosition: GameState['sites'][number]['position'],
  ) => boolean
  localization?: AiLocalization
}

export function getAiActionAnnouncement(
  state: GameState,
  action: GameAction,
  nextState?: GameState,
  localization?: AiLocalization,
): string {
  const t = localization?.t
  const displayUnitName = localization?.unitName ?? ((unit) => unit.name)
  const displaySiteName = localization?.siteName ?? ((site) => site.name)
  if (action.type === 'turnEnded') {
    return t?.('aiFinished') ?? 'AI 작전이 끝났습니다.'
  }

  if ('unitId' in action) {
    const unit = state.units.find((candidate) => candidate.id === action.unitId)
    if (!unit) {
      return ''
    }

    if (action.type === 'unitSelected') {
      return t?.('aiReady', { unit: displayUnitName(unit) }) ?? `${unit.name} 작전 준비`
    }

    if (action.type === 'unitMoved') {
      return t?.('aiMove', { unit: displayUnitName(unit) }) ?? `${unit.name} 이동`
    }

    if (action.type === 'unitWaited') {
      return t?.('aiWait', { unit: displayUnitName(unit) }) ?? `${unit.name} 대기`
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
      ? t?.('aiAttack', {
          attacker: displayUnitName(attacker),
          defender: displayUnitName(defender),
        }) ?? `${attacker.name}이 ${defender.name}을 공격합니다.`
      : t?.('aiAttackFallback') ?? 'AI 공격'
  }

  if (action.type === 'siteAttacked') {
    const site = state.sites.find(
      (candidate) => candidate.id === action.siteId,
    )
    const nextSite = nextState?.sites.find(
      (candidate) => candidate.id === action.siteId,
    )
    if (!site || !nextSite) {
      return t?.('aiSiteAttack') ?? 'AI 거점 공격'
    }

    const beforeHp = site.hp ?? getSiteMaxHp(site) ?? 0
    const captured = nextSite.ownerId !== site.ownerId
    const damage = captured
      ? beforeHp
      : beforeHp - (nextSite.hp ?? getSiteMaxHp(nextSite) ?? beforeHp)
    return t?.(captured ? 'siteCaptured' : 'siteDamage', {
      site: displaySiteName(site),
      damage,
    }) ?? (captured
      ? `${site.name}에 ${damage} 피해, ${site.name} 점령`
      : `${site.name}에 ${damage} 피해`)
  }

  if (action.type === 'unitProduced') {
    const site = state.sites.find(
      (candidate) => candidate.id === action.siteId,
    )
    return t?.('producedAt', {
      site: site ? displaySiteName(site) : t('genericSite'),
      unit: localization?.unitLabel(action.unitType) ?? UNIT_TYPE_LABELS[action.unitType],
    }) ?? `${site?.name ?? '거점'}에서 ${UNIT_TYPE_LABELS[action.unitType]}을 생산합니다.`
  }

  if (action.type === 'siteDeveloped') {
    const site = state.sites.find(
      (candidate) => candidate.id === action.siteId,
    )
    const target = site ? getSiteDevelopmentTarget(site) : undefined
    return site && target
      ? t?.('developSite', {
          site: displaySiteName(site),
          target: localization?.siteLabel(target.kind) ?? SITE_TYPE_LABELS[target.kind],
        }) ?? `${site.name}을 ${SITE_TYPE_LABELS[target.kind]}(으)로 발전시킵니다.`
      : t?.('aiDevelop') ?? 'AI가 거점을 발전시킵니다.'
  }

  if (action.type === 'unitDisbanded') {
    const unit = state.units.find(
      (candidate) => candidate.id === action.unitId,
    )
    return unit
      ? t?.('disbandUnit', { unit: displayUnitName(unit) }) ?? `${unit.name}을 유지비 절감을 위해 해산합니다.`
      : t?.('aiDisband') ?? 'AI가 부대를 해산합니다.'
  }

  if (action.type === 'constructionStarted') {
    const site = state.sites.find(
      (candidate) => candidate.id === action.siteId,
    )
    return t?.('constructionStart', {
      site: site ? displaySiteName(site) : t('genericCity'),
      building: BUILDING_DEFINITIONS[action.buildingId].label,
    }) ?? `${site?.name ?? '도시'}에 ${BUILDING_DEFINITIONS[action.buildingId].label} 건설을 시작합니다.`
  }

  if (action.type === 'constructionCancelled') {
    return t?.('aiConstructionCancel') ?? 'AI가 건설을 취소합니다.'
  }

  return ''
}

export function useAiTurn({
  state,
  combatActive,
  dispatch,
  startCombat,
  startSiteAttack,
  localization,
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

    const decision = chooseAiDecision(state, state.activeFactionId)
    if (!decision) {
      return
    }
    const action = decision.action
    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      console.debug(
        `[AI] ${state.activeFactionId} ${decision.reason} ${action.type}`,
      )
    }

    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timer = window.setTimeout(
      () => {
        if (action.type === 'unitAttacked') {
          setAnnouncement(getAiActionAnnouncement(state, action, undefined, localization))
          startCombat(action.attackerId, action.defenderId)
          return
        }

        if (action.type === 'siteAttacked') {
          const attacker = state.units.find(
            (unit) => unit.id === action.attackerId,
          )
          const site = state.sites.find(
            (candidate) => candidate.id === action.siteId,
          )
          if (!attacker || !site) {
            dispatch({ type: 'unitWaited', unitId: action.attackerId })
            return
          }
          const targetPosition = [...getSiteOccupiedPositions(site)].sort(
            (left, right) =>
              getHexDistance(attacker.position, left) -
                getHexDistance(attacker.position, right) ||
              comparePositions(left, right),
          )[0]
          setAnnouncement(getAiActionAnnouncement(state, action, undefined, localization))
          const started = startSiteAttack(
            action.attackerId,
            action.siteId,
            targetPosition,
          )
          if (started === false) {
            dispatch({ type: 'unitWaited', unitId: action.attackerId })
          }
          return
        }

        setAnnouncement(getAiActionAnnouncement(state, action, undefined, localization))
        dispatch(action)
      },
      reducedMotion ? 50 : 400,
    )

    return () => window.clearTimeout(timer)
  }, [combatActive, dispatch, localization, startCombat, startSiteAttack, state])

  return announcement
}
