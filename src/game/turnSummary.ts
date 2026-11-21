import type { UnitMovement } from './movement'
import { gameReducer, resolveUnitMove } from './reducer'
import { getActionablePlayerUnits } from './selectors'
import type { BuildingId, GameAction, GameState, Site, Unit } from './types'

export type TurnSummary = {
  turn: number
  resourceChange: number
  readyUnits: number
  lostUnits: Unit[]
  lostSites: Site[]
  completed: { city: Site; building: BuildingId }[]
}

type GameSession = {
  game: GameState
  beforeAi?: GameState
  movement?: UnitMovement
  summary?: TurnSummary
}

export function createGameSession(game: GameState): GameSession {
  // The player may choose a faction that takes its first turn after an AI.
  return game.phase === 'playing' && game.activeFactionId !== game.humanFactionId
    ? { game, beforeAi: game }
    : { game }
}

function summarizeTurn(before: GameState, after: GameState): TurnSummary {
  const player = after.humanFactionId
  const survivingUnits = new Set(after.units.map((unit) => unit.id))
  const ownedSites = new Map(after.sites.filter((site) => site.ownerId === player).map((site) => [site.id, site]))
  const previousSites = before.sites.filter((site) => site.ownerId === player)
  const completed: TurnSummary['completed'] = []
  for (const site of previousSites) {
    const building = site.constructionQueue?.buildingId
    const city = ownedSites.get(site.id)
    if (building && city?.buildings.includes(building) && !site.buildings.includes(building)) {
      completed.push({ city, building })
    }
  }
  return {
    turn: after.turn,
    resourceChange: (after.resources[player] ?? 0) - (before.resources[player] ?? 0),
    readyUnits: getActionablePlayerUnits(after).size,
    lostUnits: before.units.filter((unit) => unit.factionId === player && !survivingUnits.has(unit.id)),
    lostSites: previousSites.filter((site) => !ownedSites.has(site.id)),
    completed,
  }
}

export function gameSessionReducer(session: GameSession, action: GameAction): GameSession {
  const before = session.game
  if (action.type === 'unitMoved') {
    const move = resolveUnitMove(before, action)
    if (!move) return session
    return move.game.phase === 'playing' ? { ...session, ...move } : createGameSession(move.game)
  }
  const game = gameReducer(before, action)
  if (game === before) return session
  if (action.type === 'gameLoaded' || action.type === 'gameRestarted' || game.phase !== 'playing') {
    return createGameSession(game)
  }
  if (action.type === 'turnEnded') {
    if (before.activeFactionId === before.humanFactionId) return { game, beforeAi: before }
    if (game.activeFactionId === game.humanFactionId && session.beforeAi) {
      return { game, summary: summarizeTurn(session.beforeAi, game) }
    }
  }
  return { ...session, game, movement: undefined }
}
