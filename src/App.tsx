import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { GameResultPanel } from './components/GameResultPanel'
import { GameMap } from './components/GameMap'
import type {
  CombatAnimation,
  CombatAnimationPhase,
} from './components/GameMap'
import { InfoPanel } from './components/InfoPanel'
import { Legend } from './components/Legend'
import { StatusBar } from './components/StatusBar'
import { createInitialGameState } from './game/initialState'
import { gameReducer } from './game/reducer'
import { getUnitAt, positionKey, resolveCombat } from './game/rules'
import {
  getSelectedUnit,
  getSelectedUnitAttackableUnits,
  getSelectedUnitEnemyZoneOfControlPositions,
  getSelectedUnitReachablePositions,
} from './game/selectors'
import type { GameState, Tile } from './game/types'
import { useAiTurn } from './hooks/useAiTurn'
import './App.css'

type AppProps = {
  initialState?: GameState
}

function App({ initialState }: AppProps = {}) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initialState ?? createInitialGameState(),
  )
  const [activeCombat, setActiveCombat] = useState<
    Omit<CombatAnimation, 'phase'>
  >()
  const [combatPhase, setCombatPhase] = useState<CombatAnimationPhase>('attack')
  const selectedUnit = getSelectedUnit(state)
  const reachablePositions = useMemo(
    () => getSelectedUnitReachablePositions(state),
    [state],
  )
  const reachableKeys = useMemo(
    () => new Set(reachablePositions.map(positionKey)),
    [reachablePositions],
  )
  const attackableUnits = useMemo(
    () => getSelectedUnitAttackableUnits(state),
    [state],
  )
  const attackableIds = useMemo(
    () => new Set(attackableUnits.map((unit) => unit.id)),
    [attackableUnits],
  )
  const attackableKeys = useMemo(
    () => new Set(attackableUnits.map((unit) => positionKey(unit.position))),
    [attackableUnits],
  )
  const zoneOfControlKeys = useMemo(
    () =>
      new Set(
        getSelectedUnitEnemyZoneOfControlPositions(state).map(positionKey),
      ),
    [state],
  )

  const startCombat = useCallback(
    (attackerId: string, defenderId: string) => {
      const attacker = state.units.find((unit) => unit.id === attackerId)
      const defender = state.units.find((unit) => unit.id === defenderId)

      if (!attacker || !defender) {
        return
      }

      const result = resolveCombat(attacker, defender)
      setCombatPhase('attack')
      setActiveCombat({
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerPosition: { ...attacker.position },
        defenderPosition: { ...defender.position },
        damageToAttacker: attacker.hp - result.attackerHp,
        damageToDefender: defender.hp - result.defenderHp,
        attackerDefeated: result.attackerHp === 0,
        defenderDefeated: result.defenderHp === 0,
      })
    },
    [state.units],
  )

  const aiAnnouncement = useAiTurn({
    state,
    combatActive: Boolean(activeCombat),
    dispatch,
    startCombat,
  })

  useEffect(() => {
    if (!activeCombat) {
      return
    }

    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timings = reducedMotion
      ? { hit: 20, counter: 45, counterHit: 70, complete: 100 }
      : { hit: 180, counter: 440, counterHit: 620, complete: 900 }
    const timers: number[] = []

    timers.push(
      window.setTimeout(() => setCombatPhase('defenderHit'), timings.hit),
    )

    if (!activeCombat.defenderDefeated) {
      timers.push(
        window.setTimeout(() => setCombatPhase('counter'), timings.counter),
      )
      timers.push(
        window.setTimeout(
          () => setCombatPhase('attackerHit'),
          timings.counterHit,
        ),
      )
    }

    timers.push(
      window.setTimeout(() => {
        dispatch({
          type: 'unitAttacked',
          attackerId: activeCombat.attackerId,
          defenderId: activeCombat.defenderId,
        })
        setActiveCombat(undefined)
      }, activeCombat.defenderDefeated ? timings.counterHit : timings.complete),
    )

    return () => timers.forEach(window.clearTimeout)
  }, [activeCombat])

  useEffect(() => {
    if (
      state.phase !== 'playing' ||
      state.activeFactionId !== 'player' ||
      activeCombat
    ) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isEditing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (
        event.key !== 'Enter' ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditing
      ) {
        return
      }

      event.preventDefault()
      dispatch({ type: 'turnEnded' })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeCombat, state.activeFactionId, state.phase])

  const handleTileClick = (tile: Tile) => {
    if (activeCombat || state.activeFactionId !== 'player') {
      return
    }

    const unit = getUnitAt(state, tile.position)

    if (unit?.factionId === 'player') {
      dispatch({ type: 'unitSelected', unitId: unit.id })
      return
    }

    if (selectedUnit && unit && attackableIds.has(unit.id)) {
      startCombat(selectedUnit.id, unit.id)
      return
    }

    if (selectedUnit && reachableKeys.has(positionKey(tile.position))) {
      dispatch({
        type: 'unitMoved',
        unitId: selectedUnit.id,
        destination: tile.position,
      })
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">TURN-BASED STRATEGY</p>
          <h1>min2world</h1>
        </div>
        <p className="site-header__mission">
          푸른 세력의 부대를 지휘해 대륙을 탐색하세요.
        </p>
      </header>

      <StatusBar
        turn={state.turn}
        resource={state.resources.player}
        activeFactionId={state.activeFactionId}
        disabled={
          state.phase !== 'playing' ||
          state.activeFactionId !== 'player' ||
          Boolean(activeCombat)
        }
        onEndTurn={() => dispatch({ type: 'turnEnded' })}
      />

      <main className="game-layout">
        <section className="board-panel" aria-labelledby="map-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE FRONTIER</p>
              <h2 id="map-heading">전략 지도</h2>
            </div>
            <span className="map-size">10 × 10</span>
          </div>

          <div className="map-scroll">
            <GameMap
              state={state}
              reachableKeys={reachableKeys}
              attackableKeys={attackableKeys}
              zoneOfControlKeys={zoneOfControlKeys}
              combatAnimation={
                activeCombat
                  ? { ...activeCombat, phase: combatPhase }
                  : undefined
              }
              disabled={
                state.phase !== 'playing' ||
                state.activeFactionId !== 'player' ||
                Boolean(activeCombat)
              }
              onTileClick={handleTileClick}
            />
          </div>

          {state.phase !== 'playing' && (
            <GameResultPanel
              phase={state.phase}
              turn={state.turn}
              onRestart={() => dispatch({ type: 'gameRestarted' })}
            />
          )}
        </section>

        <aside className="side-panel" aria-label="게임 정보">
          <InfoPanel unit={selectedUnit} />
          <Legend />
          <section className="help-card" aria-labelledby="help-heading">
            <p className="eyebrow">HOW TO PLAY</p>
            <h2 id="help-heading">작전 지침</h2>
            <ol>
              <li>푸른 유닛을 선택합니다.</li>
              <li>금색 타일로 이동하거나 붉은 적을 공격합니다.</li>
              <li>적 통제 구역에 진입하면 이동이 멈춥니다.</li>
              <li>행동 완료 유닛도 선택해 상태를 확인할 수 있습니다.</li>
              <li>모든 행동 후 턴을 종료합니다.</li>
            </ol>
          </section>
        </aside>
      </main>
      {aiAnnouncement && (
        <span className="sr-only" role="status" aria-live="polite">
          {aiAnnouncement}
        </span>
      )}
    </div>
  )
}

export default App
