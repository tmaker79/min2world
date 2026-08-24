import { createInitialGameState } from './initialState'
import { cloneGameState } from './state'
import { resolveSiteDevelopment } from './siteDevelopment'
import {
  resolveCityTurnStart,
  resolveConstructionCancellation,
  resolveConstructionStart,
} from './cityAdministration'
import {
  canSiteProduceUnit,
  captureSiteAt,
  getAttackableSites,
  getAttackableUnits,
  getCapitalPhase,
  getDeployablePositions,
  getFactionIncome,
  getMovementCost,
  getSiteAt,
  getSiteMaxHp,
  getUnitProductionCost,
  isPositionInEnemyZoneOfControl,
  isFortifiedSite,
  resolveCombat,
  resolveSiteCombat,
  UNIT_MAX_HP,
  UNIT_TYPE_LABELS,
  UNIT_STATS,
} from './rules'
import type { GameAction, GameState } from './types'
import {
  canSpendWithUpkeepReserve,
  getFactionUpkeep,
  UNIT_UPKEEP,
} from './upkeep'

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'gameRestarted') {
    if (
      action.boardSize === undefined &&
      action.factionCount === undefined &&
      action.humanFactionId === undefined &&
      action.mapType === undefined
    ) {
      return createInitialGameState(action.seed)
    }
    return createInitialGameState(action.seed, {
      boardSize: action.boardSize ?? state.boardSize,
      factionCount: action.factionCount ?? state.factionCount,
      humanFactionId: action.humanFactionId ?? state.humanFactionId,
      mapType: action.mapType ?? state.mapType,
    })
  }

  if (action.type === 'gameLoaded') {
    return cloneGameState(action.state, true)
  }

  if (state.phase !== 'playing') {
    return state
  }

  switch (action.type) {
    case 'unitSelected': {
      const unit = state.units.find((candidate) => candidate.id === action.unitId)

      if (!unit || unit.factionId !== state.activeFactionId) {
        return state
      }

      return {
        ...state,
        selectedUnitId:
          state.selectedUnitId === action.unitId ? undefined : action.unitId,
      }
    }

    case 'selectionCleared':
      return state.selectedUnitId ? { ...state, selectedUnitId: undefined } : state

    case 'unitMoved': {
      if (state.selectedUnitId !== action.unitId) {
        return state
      }

      const unit = state.units.find((candidate) => candidate.id === action.unitId)
      if (!unit || unit.factionId !== state.activeFactionId || unit.hasActed) {
        return state
      }

      const destinationSite = getSiteAt(state, action.destination)
      if (
        destinationSite &&
        isFortifiedSite(destinationSite) &&
        destinationSite.ownerId !== unit.factionId
      ) {
        return state
      }

      const movementCost = getMovementCost(state, unit, action.destination)

      if (movementCost === undefined) {
        return state
      }

      const movementAfterCost = unit.movementRemaining - movementCost
      const stoppedByZoneOfControl =
        movementAfterCost > 0 &&
        isPositionInEnemyZoneOfControl(
          state,
          unit.factionId,
          action.destination,
        )
      const movementRemaining = stoppedByZoneOfControl
        ? 0
        : movementAfterCost

      const sites = captureSiteAt(
        state.sites,
        action.destination,
        unit.factionId,
      )
      const defeatedFactionId = sites.find(
        (site) =>
          site.capitalFor &&
          site.capitalFor !== state.humanFactionId &&
          site.capitalFor !== unit.factionId &&
          site.ownerId === unit.factionId,
      )?.capitalFor
      const factionOrder = defeatedFactionId
        ? state.factionOrder.filter((factionId) => factionId !== defeatedFactionId)
        : state.factionOrder

      return {
        ...state,
        phase: getCapitalPhase(
          sites,
          state.humanFactionId,
          state.factionOrder,
        ),
        factionOrder,
        selectedUnitId: unit.id,
        sites,
        units: state.units.map((candidate) =>
          candidate.id === action.unitId
            ? {
                ...candidate,
                position: { ...action.destination },
                movementRemaining,
                hasActed: movementRemaining === 0 && !stoppedByZoneOfControl,
              }
            : candidate,
        ),
      }
    }

    case 'unitAttacked': {
      if (state.selectedUnitId !== action.attackerId) {
        return state
      }

      const attacker = state.units.find(
        (unit) => unit.id === action.attackerId,
      )
      const defender = state.units.find(
        (unit) => unit.id === action.defenderId,
      )

      if (
        !attacker ||
        !defender ||
        attacker.hasActed ||
        attacker.factionId !== state.activeFactionId ||
        defender.factionId === attacker.factionId ||
        !getAttackableUnits(state, attacker).some(
          (unit) => unit.id === defender.id,
        )
      ) {
        return state
      }

      const result = resolveCombat(state, attacker, defender)
      const units = state.units.flatMap((unit) => {
        if (unit.id === attacker.id) {
          return result.attackerHp > 0
            ? [
                {
                  ...unit,
                  hp: result.attackerHp,
                  movementRemaining: 0,
                  hasActed: true,
                },
              ]
            : []
        }

        if (unit.id === defender.id) {
          return result.defenderHp > 0
            ? [{ ...unit, hp: result.defenderHp }]
            : []
        }

        return [unit]
      })

      return {
        ...state,
        selectedUnitId: undefined,
        units,
      }
    }

    case 'siteAttacked': {
      if (state.selectedUnitId !== action.attackerId) {
        return state
      }

      const attacker = state.units.find(
        (unit) => unit.id === action.attackerId,
      )
      const site = state.sites.find(
        (candidate) => candidate.id === action.siteId,
      )
      if (
        !attacker ||
        !site ||
        attacker.hasActed ||
        attacker.factionId !== state.activeFactionId ||
        !getAttackableSites(state, attacker).some(
          (candidate) => candidate.id === site.id,
        )
      ) {
        return state
      }

      const result = resolveSiteCombat(state, attacker, site)
      const captured = result.siteHp <= 0
      const maxHp = getSiteMaxHp(site)!
      const sites = state.sites.map((candidate) =>
        candidate.id === site.id
          ? {
              ...candidate,
              ownerId: captured ? attacker.factionId : candidate.ownerId,
              hp: captured ? Math.ceil(maxHp * 0.5) : result.siteHp,
              maxHp,
            }
          : candidate,
      )
      const defeatedFactionId = captured
        ? sites.find(
            (candidate) =>
              candidate.capitalFor &&
              candidate.capitalFor !== state.humanFactionId &&
              candidate.capitalFor !== attacker.factionId &&
              candidate.ownerId === attacker.factionId,
          )?.capitalFor
        : undefined
      const factionOrder = defeatedFactionId
        ? state.factionOrder.filter(
            (factionId) => factionId !== defeatedFactionId,
          )
        : state.factionOrder

      return {
        ...state,
        phase: getCapitalPhase(
          sites,
          state.humanFactionId,
          state.factionOrder,
        ),
        factionOrder,
        selectedUnitId: undefined,
        sites,
        units: state.units.map((unit) =>
          unit.id === attacker.id
            ? { ...unit, movementRemaining: 0, hasActed: true }
            : unit,
        ),
      }
    }

    case 'unitWaited': {
      if (state.selectedUnitId !== action.unitId) {
        return state
      }

      const unit = state.units.find((candidate) => candidate.id === action.unitId)

      if (!unit || unit.factionId !== state.activeFactionId || unit.hasActed) {
        return state
      }

      return {
        ...state,
        selectedUnitId: undefined,
        units: state.units.map((candidate) =>
          candidate.id === unit.id
            ? { ...candidate, movementRemaining: 0, hasActed: true }
            : candidate,
        ),
      }
    }

    case 'unitProduced': {
      const site = state.sites.find(
        (candidate) => candidate.id === action.siteId,
      )
      const stats = UNIT_STATS[action.unitType]
      const productionCost = getUnitProductionCost(
        state,
        state.activeFactionId,
        action.unitType,
        site,
      )
      const spending = canSpendWithUpkeepReserve(
        state,
        state.activeFactionId,
        productionCost,
        { upkeepDelta: UNIT_UPKEEP[action.unitType] },
      )

      if (
        !site ||
        site.ownerId !== state.activeFactionId ||
        site.lastProducedTurn === state.turn ||
        !stats ||
        !canSiteProduceUnit(site, action.unitType) ||
        !spending.ok ||
        !getDeployablePositions(state, site).some(
          (position) =>
            position.q === action.destination.q &&
            position.r === action.destination.r,
        )
      ) {
        return state
      }

      let sequence = 1
      let unitId = `${state.activeFactionId}-${action.unitType}-produced-${sequence}`
      while (state.units.some((unit) => unit.id === unitId)) {
        sequence += 1
        unitId = `${state.activeFactionId}-${action.unitType}-produced-${sequence}`
      }

      const factionLabels: Record<string, string> = {
        f1: '청색',
        f2: '적색',
        f3: '황금',
        f4: '자색',
      } as const
      const factionLabel = factionLabels[state.activeFactionId]
      const unit = {
        id: unitId,
        name: `${factionLabel} ${UNIT_TYPE_LABELS[action.unitType]} ${sequence}`,
        factionId: state.activeFactionId,
        type: action.unitType,
        position: { ...action.destination },
        hp: UNIT_MAX_HP,
        maxHp: UNIT_MAX_HP,
        movementRemaining: 0,
        hasActed: true,
      }

      return {
        ...state,
        selectedUnitId: undefined,
        resources: {
          ...state.resources,
          [state.activeFactionId]:
            (state.resources[state.activeFactionId] ?? 0) - productionCost,
        },
        units: [...state.units, unit],
        sites: state.sites.map((candidate) =>
          candidate.id === site.id
            ? { ...candidate, lastProducedTurn: state.turn }
            : candidate,
        ),
      }
    }

    case 'unitDisbanded': {
      const unit = state.units.find(
        (candidate) => candidate.id === action.unitId,
      )
      if (!unit || unit.factionId !== state.activeFactionId) return state
      return {
        ...state,
        selectedUnitId:
          state.selectedUnitId === unit.id ? undefined : state.selectedUnitId,
        units: state.units.filter((candidate) => candidate.id !== unit.id),
      }
    }

    case 'siteDeveloped':
      return resolveSiteDevelopment(state, action.siteId, action.footprint)

    case 'constructionStarted':
      return resolveConstructionStart(
        state,
        action.siteId,
        action.buildingId,
      )

    case 'constructionCancelled':
      return resolveConstructionCancellation(state, action.siteId)

    case 'turnEnded': {
      const endingFactionId = state.activeFactionId
      const endingIndex = state.factionOrder.indexOf(endingFactionId)
      const nextFactionId =
        state.factionOrder[(endingIndex + 1) % state.factionOrder.length] ??
        state.humanFactionId
      const completesRound = endingIndex === state.factionOrder.length - 1
      const cityTurnStart = resolveCityTurnStart(state, nextFactionId)

      return {
        ...state,
        turn: state.turn + (completesRound ? 1 : 0),
        activeFactionId: nextFactionId,
        selectedUnitId: undefined,
        resources: {
          ...state.resources,
          [endingFactionId]:
            Math.max(
              0,
              (state.resources[endingFactionId] ?? 0) +
                getFactionIncome(state, endingFactionId) -
                getFactionUpkeep(state, endingFactionId),
            ),
        },
        sites: cityTurnStart.sites,
        units: cityTurnStart.units.map((unit) =>
          unit.factionId === nextFactionId
            ? {
                ...unit,
                movementRemaining: UNIT_STATS[unit.type].movement,
                hasActed: false,
              }
            : unit,
        ),
      }
    }
  }
}
