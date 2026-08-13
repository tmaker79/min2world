import { useMemo, useReducer } from 'react'
import { GameMap } from './components/GameMap'
import { InfoPanel } from './components/InfoPanel'
import { Legend } from './components/Legend'
import { StatusBar } from './components/StatusBar'
import { createInitialGameState } from './game/initialState'
import { gameReducer } from './game/reducer'
import { getUnitAt, positionKey } from './game/rules'
import {
  getSelectedUnit,
  getSelectedUnitReachablePositions,
} from './game/selectors'
import type { Tile } from './game/types'
import './App.css'

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState)
  const selectedUnit = getSelectedUnit(state)
  const reachablePositions = useMemo(
    () => getSelectedUnitReachablePositions(state),
    [state],
  )
  const reachableKeys = useMemo(
    () => new Set(reachablePositions.map(positionKey)),
    [reachablePositions],
  )

  const handleTileClick = (tile: Tile) => {
    const unit = getUnitAt(state, tile.position)

    if (unit?.factionId === 'player') {
      dispatch({ type: 'unitSelected', unitId: unit.id })
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
              onTileClick={handleTileClick}
            />
          </div>
        </section>

        <aside className="side-panel" aria-label="게임 정보">
          <InfoPanel unit={selectedUnit} />
          <Legend />
          <section className="help-card" aria-labelledby="help-heading">
            <p className="eyebrow">HOW TO PLAY</p>
            <h2 id="help-heading">작전 지침</h2>
            <ol>
              <li>푸른 유닛을 선택합니다.</li>
              <li>빛나는 타일을 눌러 이동합니다.</li>
              <li>모든 행동 후 턴을 종료합니다.</li>
            </ol>
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App

