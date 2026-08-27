import { isFortifiedSite } from './gameCatalog'
import { positionsEqual } from './hex'
import type { FactionId, GamePhase, Position, Site } from './types'

export function captureSiteAt(
  sites: Site[],
  position: Position,
  ownerId: FactionId,
  turn: number,
): Site[] {
  let siteCaptured = false
  const nextSites = sites.map((site) => {
    if (
      isFortifiedSite(site) ||
      !positionsEqual(site.position, position) ||
      site.ownerId === ownerId
    ) {
      return site
    }
    siteCaptured = true
    // Block development on the capture turn, matching newly built sites.
    return { ...site, ownerId, lastDevelopedTurn: turn }
  })

  return siteCaptured ? nextSites : sites
}

export function getCapitalPhase(
  sites: Site[],
  humanFactionId: FactionId = 'player',
  factionOrder: readonly FactionId[] = ['player', 'enemy'],
): GamePhase {
  const humanCapital = sites.find(
    (site) => site.capitalFor === humanFactionId,
  )
  if (humanCapital?.ownerId !== humanFactionId) return 'defeat'

  const enemyCapitals = sites.filter(
    (site) =>
      site.capitalFor &&
      site.capitalFor !== humanFactionId &&
      factionOrder.includes(site.capitalFor),
  )
  if (
    enemyCapitals.length > 0 &&
    enemyCapitals.every((site) => site.ownerId === humanFactionId)
  ) {
    return 'victory'
  }
  return 'playing'
}
