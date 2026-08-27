import { describe, expect, it } from 'vitest'
import {
  chooseAiAction,
  chooseAiDecision,
  compareAiSiteDevelopmentCandidates,
  getAiUnitCap,
} from './ai'
import { getHexDistance, getHexNeighbors, positionKey } from './hex'
import { createInitialGameState } from './initialState'
import { gameReducer } from './reducer'
import { getDeployablePositions, getUnitProductionCost } from './rules'
import { getConstructiblePositions } from './settlement'
import type { GameState, Site, Unit } from './types'

function enemyTurn(seed = 'ai-test'): GameState {
  return { ...createInitialGameState(seed), activeFactionId: 'enemy' }
}

function economyState(seed = 'ai-economy'): GameState {
  const initial = enemyTurn(seed)
  return {
    ...initial,
    resources: { ...initial.resources, enemy: 30 },
    tiles: initial.tiles.map((tile) => ({
      ...tile,
      terrain: 'plain' as const,
    })),
    units: [],
  }
}

function enemySite(state: GameState, overrides: Partial<Site> = {}): Site {
  const site = state.sites.find((candidate) => candidate.ownerId === 'enemy')!
  return {
    ...site,
    kind: 'outpost',
    footprint: undefined,
    level: undefined,
    lastProducedTurn: undefined,
    lastDevelopedTurn: undefined,
    ...overrides,
  }
}

function enemyIncomeSite(state: GameState): Site {
  return enemySite(state, {
    id: 'enemy-income',
    kind: 'city',
    ownerId: 'enemy',
    position: { q: 99, r: 99 },
    footprint: [{ q: 99, r: 99 }],
    hp: 120,
    maxHp: 120,
  })
}

describe('hex-map AI', () => {
  it('uses the quick cap and chooses military production without investing', () => {
    const initial = createInitialGameState('quick-ai-production', {
      gameMode: 'quick',
      humanFactionId: 'f1',
    })
    const state: GameState = {
      ...initial,
      activeFactionId: 'f2',
      resources: { ...initial.resources, f2: 100 },
      units: initial.units.map((unit) =>
        unit.factionId === 'f2'
          ? { ...unit, hasActed: true, movementRemaining: 0 }
          : unit,
      ),
    }

    expect(getAiUnitCap(state, 'f2')).toBe(8)
    const action = chooseAiAction(state, 'f2')
    expect(action?.type).toBe('unitProduced')
    if (action?.type === 'unitProduced') {
      expect(['infantry', 'cavalry', 'archer', 'spearman']).toContain(
        action.unitType,
      )
    }
  })

  it('does nothing outside the enemy playing phase', () => {
    expect(chooseAiAction(createInitialGameState('ai-player'))).toBeUndefined()
    expect(chooseAiAction({ ...enemyTurn(), phase: 'victory' })).toBeUndefined()
  })

  it('selects the first available enemy unit deterministically', () => {
    const state = enemyTurn()
    const expected = state.units
      .filter((unit) => unit.factionId === 'enemy' && !unit.hasActed)
      .sort((left, right) => left.id.localeCompare(right.id))[0]

    expect(chooseAiAction(state)).toEqual({ type: 'unitSelected', unitId: expected.id })
    expect(chooseAiAction(state)).toEqual(chooseAiAction(state))
  })

  it('attacks an enemy in axial range before moving', () => {
    const enemy: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const player: Unit = {
      id: 'player-target', name: 'target', factionId: 'player', type: 'infantry',
      position: { q: 2, r: -1 }, hp: 30, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const state = { ...enemyTurn(), selectedUnitId: enemy.id, units: [enemy, player] }

    expect(chooseAiAction(state)).toEqual({
      type: 'unitAttacked', attackerId: enemy.id, defenderId: player.id,
    })
  })

  it('attacks an enemy unit before an attackable fortified site', () => {
    const initial = enemyTurn('ai-unit-before-site')
    const attacker: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const defender: Unit = {
      id: 'player-unit', name: 'unit', factionId: 'player', type: 'infantry',
      position: { q: 1, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 0, hasActed: true,
    }
    const site = enemySite(initial, {
      id: 'player-fort', ownerId: 'player', position: { q: 2, r: 0 },
      hp: 1, maxHp: 50,
    })
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker, defender],
      sites: [site, enemyIncomeSite(initial)],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'unitAttacked', attackerId: attacker.id, defenderId: defender.id,
    })
  })

  it('orders attackable sites by immediate capture, damage, then stable id', () => {
    const initial = enemyTurn('ai-site-order')
    const attacker: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const makeSite = (id: string, position: Site['position'], hp: number, capital = false) =>
      enemySite(initial, {
        id, ownerId: 'player', position, hp, maxHp: 50,
        capitalFor: capital ? 'player' : undefined,
      })
    const low = makeSite('a-low', { q: 1, r: 0 }, 1)
    const capital = makeSite('z-capital', { q: 2, r: 0 }, 50, true)
    const state = {
      ...initial, selectedUnitId: attacker.id, units: [attacker],
      tiles: initial.tiles.map((tile) => ({ ...tile, terrain: 'plain' as const })),
      sites: [low, capital, enemyIncomeSite(initial)],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: low.id,
    })

    const equalHpSites = [
      makeSite('z-site', { q: 1, r: 0 }, 10),
      makeSite('a-site', { q: 2, r: 0 }, 10),
      makeSite('m-lowest', { q: 1, r: 1 }, 2),
    ]
    expect(chooseAiAction({
      ...state,
      sites: [...equalHpSites, enemyIncomeSite(initial)],
    })).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: 'a-site',
    })
    expect(chooseAiAction({
      ...state,
      sites: [...equalHpSites.slice(0, 2), enemyIncomeSite(initial)],
    })).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: 'a-site',
    })
  })

  it('attacks a neutral fortified site', () => {
    const initial = enemyTurn('ai-neutral-site')
    const attacker: Unit = {
      id: 'enemy-infantry', name: 'infantry', factionId: 'enemy', type: 'infantry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const neutral = enemySite(initial, {
      id: 'neutral-fort', ownerId: 'neutral', position: { q: 1, r: 0 }, hp: 50,
    })
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker],
      sites: [neutral, enemyIncomeSite(initial)],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: neutral.id,
    })
  })

  it('moves into siege range without entering the fortified footprint', () => {
    const initial = enemyTurn('ai-move-to-siege-range')
    const attacker: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const capital = enemySite(initial, {
      id: 'player-capital', ownerId: 'player', capitalFor: 'player',
      kind: 'city', position: { q: 3, r: 0 },
      footprint: [{ q: 3, r: 0 }, { q: 4, r: 0 }],
      hp: 120, maxHp: 120,
    })
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      tiles: initial.tiles.map((tile) => ({ ...tile, terrain: 'plain' as const })),
      units: [attacker],
      sites: [capital, enemyIncomeSite(initial)],
    }
    const movement = chooseAiAction(state)

    expect(movement).toEqual({
      type: 'unitMoved', unitId: attacker.id, destination: { q: 1, r: 0 },
    })
    const moved = gameReducer(state, movement!)
    expect(capital.footprint).not.toContainEqual(moved.units[0].position)
    expect(chooseAiAction(moved)).toEqual({
      type: 'siteAttacked', attackerId: attacker.id, siteId: capital.id,
    })
  })

  it('moves toward the player capital over a valid weighted hex path', () => {
    const initial = enemyTurn('ai-move-open')
    const capital = initial.sites.find((site) => site.capitalFor === 'player')!
    const movable = initial.units
      .filter((unit) => unit.factionId === 'enemy')
      .map((enemy) => {
        const state = {
          ...initial,
          selectedUnitId: enemy.id,
          units: initial.units.filter((unit) => unit.factionId === 'enemy'),
        }
        return { enemy, state, action: chooseAiAction(state) }
      })
      .find(({ action }) => action?.type === 'unitMoved')

    expect(movable?.action?.type).toBe('unitMoved')
    if (movable?.action?.type === 'unitMoved') {
      expect(movable.action.destination).not.toEqual(movable.enemy.position)
      expect(getHexDistance(movable.action.destination, capital.position)).toBeLessThanOrEqual(
        getHexDistance(movable.enemy.position, capital.position),
      )
      expect(gameReducer(movable.state, movable.action)).not.toBe(movable.state)
    }
  })

  it('produces a valid unit after every enemy unit has acted', () => {
    const initial = enemyTurn('ai-produce')
    const state = {
      ...initial,
      units: initial.units.map((unit) =>
        unit.factionId === 'enemy' ? { ...unit, hasActed: true, movementRemaining: 0 } : unit,
      ),
      sites: initial.sites.map((site) =>
        site.ownerId === 'enemy'
          ? { ...site, lastDevelopedTurn: initial.turn }
          : site,
      ),
    }
    const action = chooseAiAction(state)

    expect(action?.type).toBe('unitProduced')
    if (action?.type === 'unitProduced') {
      const site = state.sites.find((candidate) => candidate.id === action.siteId)!
      expect(site.ownerId).toBe('enemy')
      expect(getDeployablePositions(state, site)).toContainEqual(action.destination)
      expect(gameReducer(state, action).units).toHaveLength(state.units.length + 1)
    }
  })

  it('ends the turn when units are done and production is unaffordable', () => {
    const initial = enemyTurn('ai-end')
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 0 },
      units: initial.units.map((unit) =>
        unit.factionId === 'enemy' ? { ...unit, hasActed: true, movementRemaining: 0 } : unit,
      ),
    }

    expect(chooseAiAction(state)).toEqual({ type: 'turnEnded' })
  })

  it('develops one owned site after every unit has acted', () => {
    const initial = economyState('ai-develop')
    const site = enemySite(initial)
    const state = { ...initial, sites: [site] }

    expect(chooseAiAction(state)).toEqual({
      type: 'siteDeveloped',
      siteId: site.id,
      footprint: undefined,
    })
  })

  it('uses the projected upkeep reserve instead of a fixed development reserve', () => {
    const initial = economyState('ai-development-reserve')
    const site = enemySite(initial)
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 12 },
      sites: [site],
    }

    expect(chooseAiAction(state)).toMatchObject({
      type: 'siteDeveloped',
      siteId: site.id,
    })
  })

  it('repeatedly disbands expensive low-hp units until income covers upkeep', () => {
    const initial = economyState('ai-disband-loop')
    const site = enemySite(initial, { kind: 'farm', level: 1 })
    const units: Unit[] = [
      {
        id: 'cavalry-a', name: 'cavalry a', factionId: 'enemy', type: 'cavalry',
        position: { q: 10, r: 0 }, hp: 50, maxHp: 100,
        movementRemaining: 0, hasActed: true,
      },
      {
        id: 'cavalry-b', name: 'cavalry b', factionId: 'enemy', type: 'cavalry',
        position: { q: 11, r: 0 }, hp: 20, maxHp: 100,
        movementRemaining: 0, hasActed: true,
      },
      {
        id: 'infantry', name: 'infantry', factionId: 'enemy', type: 'infantry',
        position: { q: 12, r: 0 }, hp: 1, maxHp: 100,
        movementRemaining: 0, hasActed: true,
      },
    ]
    const state = { ...initial, sites: [site], units }

    const first = chooseAiAction(state)
    expect(first).toEqual({ type: 'unitDisbanded', unitId: 'cavalry-b' })
    const afterFirst = gameReducer(state, first!)
    const second = chooseAiAction(afterFirst)
    expect(second).toEqual({ type: 'unitDisbanded', unitId: 'cavalry-a' })
    expect(chooseAiAction(gameReducer(afterFirst, second!))?.type)
      .not.toBe('unitDisbanded')
  })

  it('preserves an immediately attackable unit while another disband candidate exists', () => {
    const initial = economyState('ai-preserve-attacker')
    const cavalry: Unit = {
      id: 'attacking-cavalry', name: 'cavalry', factionId: 'enemy', type: 'cavalry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 3, hasActed: false,
    }
    const infantry: Unit = {
      id: 'idle-infantry', name: 'infantry', factionId: 'enemy', type: 'infantry',
      position: { q: 10, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const target: Unit = {
      id: 'player-target', name: 'target', factionId: 'player', type: 'infantry',
      position: { q: 1, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }
    const state = {
      ...initial,
      sites: [enemySite(initial)],
      units: [cavalry, infantry, target],
      selectedUnitId: cavalry.id,
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'unitDisbanded',
      unitId: infantry.id,
    })
  })

  it('does not produce when the new unit would consume the upkeep reserve', () => {
    const initial = economyState('ai-production-upkeep-reserve')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    city.lastDevelopedTurn = initial.turn
    const template = initial.tiles.slice(0, 4)
    const units: Unit[] = ['a', 'b', 'c'].map((id, index) => ({
      id: `cavalry-${id}`,
      name: `cavalry ${id}`,
      factionId: 'enemy',
      type: 'cavalry',
      position: template[index].position,
      hp: 100,
      maxHp: 100,
      movementRemaining: 0,
      hasActed: true,
    }))
    units.push({
      id: 'archer-a', name: 'archer', factionId: 'enemy', type: 'archer',
      position: template[3].position, hp: 100, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    })
    const state = {
      ...initial,
      sites: [city],
      units,
      resources: {
        ...initial.resources,
        enemy: getUnitProductionCost(initial, 'enemy', 'infantry', city),
      },
    }

    expect(chooseAiAction(state)).toEqual({ type: 'turnEnded' })
  })

  it('develops a settlement on its own tile without surrounding land', () => {
    const initial = economyState('ai-no-footprint')
    const site = enemySite(initial, { kind: 'village' })
    const state = {
      ...initial,
      tiles: initial.tiles.map((tile) => ({
        ...tile,
        terrain:
          tile.position.q === site.position.q &&
          tile.position.r === site.position.r
            ? ('plain' as const)
            : ('water' as const),
      })),
      sites: [site],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'siteDeveloped',
      siteId: site.id,
      footprint: [site.position],
    })
  })

  it('allows at most one development for an AI faction each turn', () => {
    const initial = economyState('ai-one-development')
    const developed = enemySite(initial, {
      id: 'developed-farm',
      kind: 'farm',
      lastDevelopedTurn: initial.turn,
    })
    const available = enemySite(initial, {
      id: 'available-farm',
      kind: 'farm',
    })
    const state = { ...initial, sites: [available, developed] }

    expect(chooseAiAction(state)).toEqual({ type: 'turnEnded' })
  })

  it('sorts development candidates by stage, role, and finally site id', () => {
    const initial = economyState('ai-development-sort')
    const sites = [
      enemySite(initial, { id: 'z-keep', kind: 'keep' }),
      enemySite(initial, { id: 'z-farm', kind: 'farm', level: 1 }),
      enemySite(initial, { id: 'z-village', kind: 'village' }),
      enemySite(initial, { id: 'z-outpost', kind: 'outpost' }),
      enemySite(initial, { id: 'a-outpost', kind: 'outpost' }),
    ]

    expect([...sites].sort(compareAiSiteDevelopmentCandidates).map((site) => site.id))
      .toEqual([
        'a-outpost',
        'z-outpost',
        'z-village',
        'z-farm',
        'z-keep',
      ])
    expect(chooseAiAction({ ...initial, sites })).toMatchObject({
      type: 'siteDeveloped',
      siteId: 'z-village',
    })
  })

  it('can produce on the tick after development resolves', () => {
    const initial = economyState('ai-develop-then-produce')
    const site = enemySite(initial, {
      kind: 'town',
      hp: undefined,
      maxHp: undefined,
    })
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 40 },
      sites: [site],
    }
    const development = chooseAiAction(state)!
    const developed = gameReducer(state, development)
    const production = chooseAiAction(developed)

    expect(development.type).toBe('siteDeveloped')
    expect(production).toMatchObject({
      type: 'unitProduced',
      siteId: site.id,
    })
  })

  it('does not produce units from any military site', () => {
    const initial = economyState('ai-locked-production')
    for (const kind of ['outpost', 'keep', 'stronghold'] as const) {
      const site = enemySite(initial, {
        kind,
        lastDevelopedTurn: initial.turn,
      })
      expect(chooseAiAction({ ...initial, sites: [site] })).toEqual({
        type: 'turnEnded',
      })
    }
  })

  it('uses the Blacksmith discount when choosing an affordable unit', () => {
    const initial = economyState('ai-discount-production')
    const city = enemySite(initial, {
      id: 'a-city',
      kind: 'city',
      footprint: undefined,
      hp: 120,
      maxHp: 120,
    })
    const blacksmithPosition = initial.tiles.find(
      (tile) =>
        tile.position.q !== city.position.q ||
        tile.position.r !== city.position.r,
    )!.position
    const blacksmith = enemySite(initial, {
      id: 'blacksmith',
      kind: 'blacksmith',
      level: 1,
      position: blacksmithPosition,
      lastDevelopedTurn: initial.turn,
    })
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 12 },
      sites: [city, blacksmith],
    }

    expect(getUnitProductionCost(state, 'enemy', 'spearman')).toBe(12)
    expect(chooseAiAction(state)).toMatchObject({
      type: 'unitProduced',
      siteId: city.id,
      unitType: 'spearman',
    })
  })

  it('chooses the highest-income efficient building in a peaceful City', () => {
    const initial = economyState('ai-city-construction')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 100 },
      sites: [city],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'constructionStarted',
      siteId: city.id,
      buildingId: 'market',
    })
  })

  it('prioritizes a wall when an enemy threatens a City', () => {
    const initial = economyState('ai-threatened-city')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    const threat: Unit = {
      id: 'nearby-player',
      name: 'Nearby player',
      factionId: 'player',
      type: 'infantry',
      position: city.position,
      hp: 100,
      maxHp: 100,
      movementRemaining: 0,
      hasActed: true,
    }
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 100 },
      sites: [city],
      units: [threat],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'constructionStarted',
      siteId: city.id,
      buildingId: 'wall',
    })
  })

  it('selects the globally best attacker instead of keeping the selected unit', () => {
    const initial = economyState('ai-global-attack')
    const selected: Unit = {
      id: 'a-selected', name: 'selected', factionId: 'enemy', type: 'infantry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const finisher: Unit = {
      id: 'z-finisher', name: 'finisher', factionId: 'enemy', type: 'archer',
      position: { q: 5, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const sturdyTarget: Unit = {
      id: 'player-sturdy', name: 'sturdy', factionId: 'player', type: 'infantry',
      position: { q: 1, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }
    const weakTarget: Unit = {
      id: 'player-weak', name: 'weak', factionId: 'player', type: 'infantry',
      position: { q: 6, r: 0 }, hp: 1, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }
    const state = {
      ...initial,
      selectedUnitId: selected.id,
      units: [selected, finisher, sturdyTarget, weakTarget],
      sites: [enemyIncomeSite(initial)],
    }

    expect(chooseAiDecision(state)).toEqual({
      action: { type: 'unitSelected', unitId: finisher.id },
      reason: 'immediateAttack',
    })
  })

  it('avoids a suicidal attack that cannot remove the target', () => {
    const initial = economyState('ai-avoid-suicide')
    const attacker: Unit = {
      id: 'enemy-low', name: 'low', factionId: 'enemy', type: 'infantry',
      position: { q: 0, r: 0 }, hp: 1, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const defender: Unit = {
      id: 'player-cavalry', name: 'cavalry', factionId: 'player', type: 'cavalry',
      position: { q: 1, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }
    const state = {
      ...initial,
      selectedUnitId: attacker.id,
      units: [attacker, defender],
      sites: [enemyIncomeSite(initial)],
    }

    expect(chooseAiAction(state)?.type).not.toBe('unitAttacked')
  })

  it('prioritizes an immediate enemy capital capture over a unit kill', () => {
    const initial = economyState('ai-capital-capture-first')
    const siege: Unit = {
      id: 'a-siege', name: 'siege', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const finisher: Unit = {
      id: 'b-finisher', name: 'finisher', factionId: 'enemy', type: 'archer',
      position: { q: 5, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const target: Unit = {
      id: 'player-weak', name: 'weak', factionId: 'player', type: 'infantry',
      position: { q: 6, r: 0 }, hp: 1, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }
    const capital = enemySite(initial, {
      id: 'player-capital', ownerId: 'player', capitalFor: 'player',
      kind: 'city', position: { q: 1, r: 0 }, footprint: [{ q: 1, r: 0 }],
      hp: 1, maxHp: 120,
    })
    const state = {
      ...initial,
      selectedUnitId: siege.id,
      units: [siege, finisher, target],
      sites: [capital, enemyIncomeSite(initial)],
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'siteAttacked', attackerId: siege.id, siteId: capital.id,
    })
  })

  it('selects the closest available unit when its capital is threatened', () => {
    const initial = economyState('ai-capital-defense')
    const capital = enemySite(initial, {
      id: 'enemy-capital', ownerId: 'enemy', capitalFor: 'enemy',
      kind: 'city', position: { q: 0, r: 0 }, footprint: [{ q: 0, r: 0 }],
      hp: 120, maxHp: 120,
    })
    const threat: Unit = {
      id: 'player-threat', name: 'threat', factionId: 'player', type: 'infantry',
      position: { q: 2, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }
    const near: Unit = {
      id: 'z-near', name: 'near', factionId: 'enemy', type: 'infantry',
      position: { q: 5, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const far: Unit = {
      id: 'a-far', name: 'far', factionId: 'enemy', type: 'infantry',
      position: { q: 9, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const state = {
      ...initial,
      units: [far, near, threat],
      sites: [capital],
    }

    expect(chooseAiDecision(state)).toEqual({
      action: { type: 'unitSelected', unitId: near.id },
      reason: 'capitalDefense',
    })
  })

  it('captures a reachable neutral Mine before advancing on a distant capital at low income', () => {
    const initial = economyState('ai-economic-expansion')
    const unit: Unit = {
      id: 'enemy-cavalry', name: 'cavalry', factionId: 'enemy', type: 'cavalry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 4, hasActed: false,
    }
    const mine = enemySite(initial, {
      id: 'neutral-mine', ownerId: 'neutral', kind: 'mine',
      position: { q: 3, r: 0 }, capitalFor: undefined,
    })
    const capital = enemySite(initial, {
      id: 'player-capital', ownerId: 'player', capitalFor: 'player',
      kind: 'city', position: { q: 8, r: 0 }, footprint: [{ q: 8, r: 0 }],
      hp: 120, maxHp: 120,
    })
    const state = {
      ...initial,
      selectedUnitId: unit.id,
      units: [unit],
      sites: [enemyIncomeSite(initial), mine, capital],
    }

    expect(chooseAiDecision(state)).toEqual({
      action: { type: 'unitMoved', unitId: unit.id, destination: mine.position },
      reason: 'tacticalMove',
    })
  })

  it('falls back to another enemy capital when the first has no map position', () => {
    const initial = economyState('ai-multiple-capitals')
    const unit: Unit = {
      id: 'enemy-unit', name: 'unit', factionId: 'enemy', type: 'infantry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const unreachable = enemySite(initial, {
      id: 'a-capital', ownerId: 'player', capitalFor: 'player',
      kind: 'city', position: { q: 99, r: 99 }, footprint: [{ q: 99, r: 99 }],
      hp: 120, maxHp: 120,
    })
    const reachable = enemySite(initial, {
      id: 'z-capital', ownerId: 'f1', capitalFor: 'f1',
      kind: 'city', position: { q: 4, r: 0 }, footprint: [{ q: 4, r: 0 }],
      hp: 120, maxHp: 120,
    })
    const state = {
      ...initial,
      selectedUnitId: unit.id,
      units: [unit],
      sites: [enemyIncomeSite(initial), unreachable, reachable],
    }
    const action = chooseAiAction(state)

    expect(action?.type).toBe('unitMoved')
    if (action?.type === 'unitMoved') {
      expect(getHexDistance(action.destination, reachable.position)).toBeLessThan(
        getHexDistance(unit.position, reachable.position),
      )
    }
  })

  it('calculates the AI unit cap from military infrastructure', () => {
    const initial = economyState('ai-unit-cap')
    const sites = [
      enemySite(initial, { id: 'city', kind: 'city', buildings: ['barracks'] }),
      enemySite(initial, { id: 'keep', kind: 'keep' }),
      enemySite(initial, { id: 'stronghold', kind: 'stronghold' }),
      enemySite(initial, { id: 'outpost', kind: 'outpost' }),
    ]

    expect(getAiUnitCap({ ...initial, sites }, 'enemy')).toBe(8)
  })

  it('uses a selected builder on a legal site instead of consuming it', () => {
    const initial = economyState('ai-builder-action')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    const stateWithCity = { ...initial, sites: [city] }
    const position = getConstructiblePositions(stateWithCity, 'enemy', 'farm')[0]
    const builder: Unit = {
      id: 'enemy-builder',
      name: 'Builder',
      factionId: 'enemy',
      type: 'builder',
      position,
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const state = {
      ...stateWithCity,
      selectedUnitId: builder.id,
      units: [builder],
    }

    expect(chooseAiDecision(state)).toEqual({
      action: {
        type: 'siteConstructed',
        unitId: builder.id,
        siteKind: 'farm',
      },
      reason: 'siteConstruction',
    })
  })

  it('skips capped production sites while still evaluating Outpost construction', () => {
    const initial = economyState('ai-production-capacity')
    const origin = initial.tiles[Math.floor(initial.tiles.length / 2)].position
    const positions = initial.tiles
      .filter((tile) => getHexDistance(origin, tile.position) === 2)
      .map((tile) => tile.position)
      .reduce<typeof origin[]>((selected, position) => {
        if (selected.every((other) => getHexDistance(other, position) >= 2)) {
          selected.push(position)
        }
        return selected
      }, [])
    const city = enemySite(initial, {
      id: 'capacity-city',
      name: 'Capacity City',
      kind: 'city',
      position: origin,
      ownerId: 'enemy',
      capitalFor: 'enemy',
      hp: 120,
      maxHp: 120,
    })
    const productionSites: Site[] = positions.slice(0, 4).map((position, index) => ({
      id: `enemy-production-${index}`,
      name: `Production ${index}`,
      kind: (['farm', 'mine', 'blacksmith', 'farm'] as const)[index],
      position,
      ownerId: 'enemy',
      level: 1,
      buildings: [],
    }))
    const builder: Unit = {
      id: 'enemy-builder',
      name: 'Builder',
      factionId: 'enemy',
      type: 'builder',
      position: positions[4],
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 100 },
      sites: [city, ...productionSites],
      units: [builder],
      selectedUnitId: builder.id,
    }

    expect(getConstructiblePositions(state, 'enemy', 'farm')).toEqual([])
    expect(getConstructiblePositions(state, 'enemy', 'outpost').length).toBeGreaterThan(0)
    expect(chooseAiDecision(state)).toEqual({
      action: {
        type: 'siteConstructed',
        unitId: builder.id,
        siteKind: 'outpost',
      },
      reason: 'siteConstruction',
    })
  })

  it('does not choose a production site on contested territory', () => {
    const initial = economyState('ai-contested-construction')
    const center = initial.tiles[Math.floor(initial.tiles.length / 2)].position
    const enemyCity = enemySite(initial, {
      id: 'enemy-city',
      kind: 'city',
      position: { q: center.q - 2, r: center.r },
      ownerId: 'enemy',
      capitalFor: 'enemy',
      hp: 120,
      maxHp: 120,
    })
    const playerCity: Site = {
      ...enemyCity,
      id: 'player-city',
      position: { q: center.q + 2, r: center.r },
      ownerId: 'player',
      capitalFor: 'player',
    }
    const builder: Unit = {
      id: 'enemy-builder',
      name: 'Builder',
      factionId: 'enemy',
      type: 'builder',
      position: center,
      hp: 100,
      maxHp: 100,
      movementRemaining: 2,
      hasActed: false,
    }
    const state = {
      ...initial,
      selectedUnitId: builder.id,
      units: [builder],
      sites: [enemyCity, playerCity],
    }

    expect(chooseAiDecision(state)).toEqual({
      action: {
        type: 'siteConstructed',
        unitId: builder.id,
        siteKind: 'outpost',
      },
      reason: 'siteConstruction',
    })
  })

  it('excludes every tile adjacent to an existing military site from Outpost candidates', () => {
    const initial = economyState('ai-outpost-spacing')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    const militaryPosition = initial.tiles.find(
      (tile) => getHexDistance(city.position, tile.position) === 2,
    )!.position
    const keep: Site = {
      ...city,
      id: 'player-keep',
      kind: 'keep',
      position: militaryPosition,
      footprint: undefined,
      ownerId: 'player',
      capitalFor: undefined,
      hp: 75,
      maxHp: 75,
    }
    const state = { ...initial, sites: [city, keep] }
    const candidateKeys = new Set(
      getConstructiblePositions(state, 'enemy', 'outpost').map(positionKey),
    )

    for (const neighbor of getHexNeighbors(militaryPosition, state.boardSize)) {
      expect(candidateKeys.has(positionKey(neighbor))).toBe(false)
    }
  })

  it('includes unclaimed Outpost candidates beyond the anchor connection range', () => {
    const initial = economyState('ai-unclaimed-outpost')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    const destination = initial.tiles.find(
      (tile) => getHexDistance(city.position, tile.position) === 4,
    )!.position
    const state = { ...initial, sites: [city] }

    expect(getConstructiblePositions(state, 'enemy', 'outpost')).toContainEqual(
      destination,
    )
  })

  it('waits on its chosen construction tile when the builder cannot pay', () => {
    const initial = economyState('ai-builder-waits-for-cost')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    const stateWithCity = { ...initial, sites: [city] }
    const position = getConstructiblePositions(stateWithCity, 'enemy', 'farm')[0]
    const builder: Unit = {
      id: 'enemy-builder', name: 'Builder', factionId: 'enemy', type: 'builder',
      position, hp: 100, maxHp: 100, movementRemaining: 2, hasActed: false,
    }
    const state = {
      ...stateWithCity,
      resources: { ...stateWithCity.resources, enemy: 0 },
      selectedUnitId: builder.id,
      units: [builder],
    }

    expect(chooseAiDecision(state)).toEqual({
      action: { type: 'unitWaited', unitId: builder.id },
      reason: 'siteConstruction',
    })
  })

  it('reuses a reachable builder and does not produce another one', () => {
    const initial = economyState('ai-builder-reuse')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    city.lastDevelopedTurn = initial.turn
    const stateWithCity = { ...initial, sites: [city] }
    const position = getConstructiblePositions(stateWithCity, 'enemy', 'outpost')[0]
    const builder: Unit = {
      id: 'enemy-builder',
      name: 'Builder',
      factionId: 'enemy',
      type: 'builder',
      position,
      hp: 100,
      maxHp: 100,
      movementRemaining: 0,
      hasActed: true,
    }
    const decision = chooseAiDecision({
      ...stateWithCity,
      resources: { ...stateWithCity.resources, enemy: 100 },
      units: [builder],
    })

    expect(decision?.action).not.toMatchObject({
      type: 'unitProduced',
      unitType: 'builder',
    })
  })

  it('excludes civilians from the military production cap', () => {
    const initial = economyState('ai-civilian-cap')
    const city = initial.sites.find(
      (site) => site.ownerId === 'enemy' && site.kind === 'city',
    )!
    city.lastDevelopedTurn = initial.turn
    const foundedVillages = Array.from({ length: 3 }, (_, index) => ({
      ...enemySite(initial),
      id: `founded-village-${index}`,
      kind: 'village' as const,
      position: { q: 70 + index, r: 70 },
      foundedBy: 'enemy' as const,
      lastProducedTurn: initial.turn,
    }))
    const foundedSites = Array.from({ length: 10 }, (_, index) => ({
      ...enemySite(initial),
      id: `founded-site-${index}`,
      position: { q: 80 + index, r: 80 },
      foundedBy: 'enemy' as const,
      lastProducedTurn: initial.turn,
      lastDevelopedTurn: initial.turn,
    }))
    const units: Unit[] = [
      {
        id: 'enemy-infantry-1', name: 'Infantry 1', factionId: 'enemy',
        type: 'infantry', position: initial.tiles[0].position, hp: 100, maxHp: 100,
        movementRemaining: 0, hasActed: true,
      },
      {
        id: 'enemy-infantry-2', name: 'Infantry 2', factionId: 'enemy',
        type: 'infantry', position: initial.tiles[1].position, hp: 100, maxHp: 100,
        movementRemaining: 0, hasActed: true,
      },
      {
        id: 'enemy-builder', name: 'Builder', factionId: 'enemy',
        type: 'builder', position: initial.tiles[2].position, hp: 100, maxHp: 100,
        movementRemaining: 0, hasActed: true,
      },
      {
        id: 'enemy-settler', name: 'Settler', factionId: 'enemy',
        type: 'settler', position: initial.tiles[3].position, hp: 100, maxHp: 100,
        movementRemaining: 0, hasActed: true,
      },
    ]
    const decision = chooseAiDecision({
      ...initial,
      resources: { ...initial.resources, enemy: 100 },
      sites: [city, ...foundedVillages, ...foundedSites],
      units,
    })

    expect(decision?.action).toMatchObject({ type: 'unitProduced' })
    if (decision?.action.type === 'unitProduced') {
      expect(['settler', 'builder']).not.toContain(decision.action.unitType)
    }
  })

  it('prefers a defensive hill when two archer firing positions are available', () => {
    const initial = economyState('ai-defensive-terrain')
    const archer: Unit = {
      id: 'enemy-archer', name: 'archer', factionId: 'enemy', type: 'archer',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 3, hasActed: false,
    }
    const capital = enemySite(initial, {
      id: 'player-capital', ownerId: 'player', capitalFor: 'player',
      kind: 'city', position: { q: 3, r: 0 }, footprint: [{ q: 3, r: 0 }],
      hp: 120, maxHp: 120,
    })
    const state = {
      ...initial,
      selectedUnitId: archer.id,
      units: [archer],
      sites: [enemyIncomeSite(initial), capital],
      tiles: initial.tiles.map((tile) => ({
        ...tile,
        terrain:
          tile.position.q === 1 && tile.position.r === 0
            ? ('hill' as const)
            : ('plain' as const),
      })),
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'unitMoved', unitId: archer.id, destination: { q: 1, r: 0 },
    })
  })

  it('avoids an exposed advance tile when it creates no immediate attack', () => {
    const initial = economyState('ai-exposure')
    const infantry: Unit = {
      id: 'enemy-infantry', name: 'infantry', factionId: 'enemy', type: 'infantry',
      position: { q: 0, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 2, hasActed: false,
    }
    const enemyArcher: Unit = {
      id: 'player-archer', name: 'archer', factionId: 'player', type: 'archer',
      position: { q: 3, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }
    const capital = enemySite(initial, {
      id: 'player-capital', ownerId: 'player', capitalFor: 'player',
      kind: 'city', position: { q: 7, r: 0 }, footprint: [{ q: 7, r: 0 }],
      hp: 120, maxHp: 120,
    })
    const state = {
      ...initial,
      selectedUnitId: infantry.id,
      units: [infantry, enemyArcher],
      sites: [enemyIncomeSite(initial), capital],
    }
    const action = chooseAiAction(state)

    expect(action?.type).toBe('unitMoved')
    if (action?.type === 'unitMoved') {
      expect(getHexDistance(action.destination, enemyArcher.position)).toBeGreaterThan(2)
    }
  })

  it('invests in a barracks before income buildings when at the unit cap', () => {
    const initial = economyState('ai-cap-investment')
    const city = enemySite(initial, {
      id: 'enemy-city', kind: 'city', buildings: [],
      footprint: [{ q: 10, r: 0 }], position: { q: 10, r: 0 },
      hp: 120, maxHp: 120,
    })
    const units: Unit[] = [0, 1, 2, 3].map((index) => ({
      id: `enemy-${index}`, name: `unit ${index}`, factionId: 'enemy',
      type: 'infantry', position: { q: index, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }))
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 100 },
      sites: [city],
      units,
    }

    expect(chooseAiAction(state)).toEqual({
      type: 'constructionStarted', siteId: city.id, buildingId: 'barracks',
    })
  })

  it('uses a completed barracks cap slot without creating an upkeep deficit', () => {
    const initial = economyState('ai-barracks-production')
    const city = enemySite(initial, {
      id: 'enemy-city', kind: 'city', buildings: ['barracks'],
      footprint: [{ q: 10, r: 0 }], position: { q: 10, r: 0 },
      hp: 120, maxHp: 120, lastDevelopedTurn: initial.turn,
    })
    const units: Unit[] = [0, 1, 2, 3].map((index) => ({
      id: `enemy-${index}`, name: `unit ${index}`, factionId: 'enemy',
      type: 'infantry', position: { q: index, r: 0 }, hp: 100, maxHp: 100,
      movementRemaining: 0, hasActed: true,
    }))
    const state = {
      ...initial,
      resources: { ...initial.resources, enemy: 100 },
      sites: [city],
      units,
    }

    expect(chooseAiAction(state)?.type).toBe('unitProduced')
  })

  it('returns deterministic decisions and keeps the action wrapper compatible', () => {
    const state = enemyTurn('ai-decision-determinism')
    const first = chooseAiDecision(state)

    expect(chooseAiDecision(state)).toEqual(first)
    expect(chooseAiAction(state)).toEqual(first?.action)
  })

  it('finishes a complete AI turn within a finite action bound', () => {
    let state = enemyTurn('ai-finite-turn')
    let actions = 0
    while (
      state.phase === 'playing' &&
      state.activeFactionId === 'enemy' &&
      actions < 100
    ) {
      const action = chooseAiAction(state)
      expect(action).toBeDefined()
      state = gameReducer(state, action!)
      actions += 1
    }

    expect(actions).toBeLessThan(100)
    expect(state.activeFactionId).not.toBe('enemy')
  })
})
