import { positionKey } from './hex'
import { getFactionLibraryDiscount } from './cityAdministration'
import {
  getSiteMaxHp,
  getSiteIncome,
  isFortifiedSiteKind,
} from './rules'
import { canSpendWithUpkeepReserve } from './upkeep'
import {
  getCityFootprintCandidates,
  getSiteOccupiedPositions,
  getTownFootprintCandidates,
  isValidCityFootprint,
  isValidTownFootprint,
  updateSiteFootprintTiles,
} from './siteFootprint'
import type { GameState, Position, Site, SiteType } from './types'

export type SiteDevelopmentFailure =
  | 'siteNotFound'
  | 'notOwned'
  | 'inactiveFaction'
  | 'notPlaying'
  | 'maxLevel'
  | 'alreadyDeveloped'
  | 'insufficientResources'
  | 'insufficientUpkeepReserve'
  | 'invalidFootprint'

export type SiteDevelopmentCheck =
  | { ok: true; cost: number; footprint: Position[] }
  | { ok: false; reason: SiteDevelopmentFailure }

type DevelopmentTarget = {
  cost: number
  kind: SiteType
  level?: 1 | 2 | 3
}

const PASSABLE_TERRAINS = new Set([
  'plain',
  'hill',
  'forest',
  'desert',
  'desertHill',
  'oasis',
  'tundra',
  'tundraForest',
])

export function getSiteDevelopmentTarget(
  site: Site,
): DevelopmentTarget | undefined {
  switch (site.kind) {
    case 'outpost':
      return { cost: 8, kind: 'keep' }
    case 'keep':
      return { cost: 12, kind: 'stronghold' }
    case 'village':
      return { cost: 10, kind: 'town' }
    case 'town':
      return { cost: 15, kind: 'city' }
    case 'farm':
    case 'mine':
      if ((site.level ?? 1) === 1) {
        return { cost: 6, kind: site.kind, level: 2 }
      }
      if (site.level === 2) {
        return { cost: 10, kind: site.kind, level: 3 }
      }
      return undefined
    case 'blacksmith':
      if ((site.level ?? 1) === 1) {
        return { cost: 7, kind: 'blacksmith', level: 2 }
      }
      if (site.level === 2) {
        return { cost: 11, kind: 'blacksmith', level: 3 }
      }
      return undefined
    case 'stronghold':
    case 'city':
      return undefined
  }
}

export function getSiteDevelopmentCost(
  site: Site,
  state?: GameState,
): number | undefined {
  const cost = getSiteDevelopmentTarget(site)?.cost
  if (cost === undefined || !state || site.ownerId === 'neutral') return cost
  return Math.max(1, cost - getFactionLibraryDiscount(state, site.ownerId))
}

function isFootprintAvailable(
  state: GameState,
  site: Site,
  footprint: readonly Position[],
): boolean {
  const currentKeys = new Set(getSiteOccupiedPositions(site).map(positionKey))
  const otherSiteKeys = new Set(
    state.sites
      .filter((candidate) => candidate.id !== site.id)
      .flatMap((candidate) => [...getSiteOccupiedPositions(candidate)])
      .map(positionKey),
  )
  const unitKeys = new Set(state.units.map((unit) => positionKey(unit.position)))
  const tilesByPosition = new Map(
    state.tiles.map((tile) => [positionKey(tile.position), tile]),
  )

  return footprint.every((position) => {
    const key = positionKey(position)
    if (currentKeys.has(key)) return true
    const tile = tilesByPosition.get(key)
    return Boolean(
      tile &&
        PASSABLE_TERRAINS.has(tile.terrain) &&
        !otherSiteKeys.has(key) &&
        !unitKeys.has(key),
    )
  })
}

export function getSiteDevelopmentFootprints(
  state: GameState,
  siteOrId: Site | string,
): Position[][] {
  const site =
    typeof siteOrId === 'string'
      ? state.sites.find((candidate) => candidate.id === siteOrId)
      : siteOrId
  if (!site) return []

  const candidates =
    site.kind === 'village'
      ? getTownFootprintCandidates(site.position, state.boardSize)
      : site.kind === 'town'
        ? getCityFootprintCandidates(
            site.position,
            state.boardSize,
            getSiteOccupiedPositions(site),
          )
        : [[...getSiteOccupiedPositions(site)]]
  return candidates.filter((footprint) =>
    isFootprintAvailable(state, site, footprint),
  )
}

function footprintsEqual(
  left: readonly Position[],
  right: readonly Position[],
): boolean {
  if (left.length !== right.length) return false
  const rightKeys = new Set(right.map(positionKey))
  return left.every((position) => rightKeys.has(positionKey(position)))
}

export function canDevelopSite(
  state: GameState,
  siteId: string,
  footprint?: readonly Position[],
): SiteDevelopmentCheck {
  const site = state.sites.find((candidate) => candidate.id === siteId)
  if (!site) return { ok: false, reason: 'siteNotFound' }
  if (site.ownerId === 'neutral') return { ok: false, reason: 'notOwned' }
  if (site.ownerId !== state.activeFactionId) {
    return { ok: false, reason: 'inactiveFaction' }
  }
  if (state.phase !== 'playing') return { ok: false, reason: 'notPlaying' }

  const target = getSiteDevelopmentTarget(site)
  if (!target) return { ok: false, reason: 'maxLevel' }
  if (site.lastDevelopedTurn === state.turn) {
    return { ok: false, reason: 'alreadyDeveloped' }
  }
  const cost = getSiteDevelopmentCost(site, state)!
  const projectedSite: Site = {
    ...site,
    kind: target.kind,
    level: target.level,
  }
  const spending = canSpendWithUpkeepReserve(state, site.ownerId, cost, {
    incomeDelta: getSiteIncome(projectedSite) - getSiteIncome(site),
  })
  if (!spending.ok) {
    return { ok: false, reason: spending.reason }
  }

  const requiresFootprint = site.kind === 'village' || site.kind === 'town'
  const selectedFootprint = footprint ?? getSiteOccupiedPositions(site)
  const isExpectedShape =
    site.kind === 'village'
      ? isValidTownFootprint(site.position, selectedFootprint, state.boardSize)
      : site.kind === 'town'
        ? isValidCityFootprint(site.position, selectedFootprint, state.boardSize)
        : footprintsEqual(selectedFootprint, getSiteOccupiedPositions(site))
  const isCandidate = getSiteDevelopmentFootprints(state, site).some(
    (candidate) => footprintsEqual(candidate, selectedFootprint),
  )
  if (
    (requiresFootprint && !footprint) ||
    !isExpectedShape ||
    !isCandidate
  ) {
    return { ok: false, reason: 'invalidFootprint' }
  }

  return {
    ok: true,
    cost,
    footprint: selectedFootprint.map((position) => ({ ...position })),
  }
}

export const canDevelop = canDevelopSite

export function resolveSiteDevelopment(
  state: GameState,
  siteId: string,
  footprint?: readonly Position[],
): GameState {
  const check = canDevelopSite(state, siteId, footprint)
  if (!check.ok) return state

  const site = state.sites.find((candidate) => candidate.id === siteId)!
  const target = getSiteDevelopmentTarget(site)!
  const previousFootprint = getSiteOccupiedPositions(site)
  const targetMaxHp = getSiteMaxHp(target.kind)
  const currentMaxHp = getSiteMaxHp(site)
  const targetHp =
    target.kind === 'city'
      ? targetMaxHp
      : isFortifiedSiteKind(target.kind) && targetMaxHp && currentMaxHp
        ? Math.ceil(((site.hp ?? currentMaxHp) / currentMaxHp) * targetMaxHp)
        : undefined
  return {
    ...state,
    resources: {
      ...state.resources,
      [state.activeFactionId]:
        (state.resources[state.activeFactionId] ?? 0) - check.cost,
    },
    sites: state.sites.map((candidate) => {
      if (candidate.id !== site.id) return candidate
      const {
        hp: _hp,
        maxHp: _maxHp,
        ...withoutCombatStats
      } = candidate
      void _hp
      void _maxHp
      return {
        ...withoutCombatStats,
        kind: target.kind,
        level: target.level,
        lastDevelopedTurn: state.turn,
        footprint: check.footprint,
        ...(targetHp !== undefined && targetMaxHp !== undefined
          ? { hp: targetHp, maxHp: targetMaxHp }
          : {}),
      }
    }),
    tiles: updateSiteFootprintTiles(
      state.tiles,
      site.id,
      previousFootprint,
      check.footprint,
    ),
  }
}
