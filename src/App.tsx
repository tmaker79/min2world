import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { GameResultPanel } from './components/GameResultPanel'
import { GameMap } from './components/GameMap'
import type {
  CombatAnimation,
  CombatAnimationPhase,
} from './components/GameMap'
import { InfoPanel } from './components/InfoPanel'
import { Legend } from './components/Legend'
import { ProductionPanel } from './components/ProductionPanel'
import { SavePanel } from './components/SavePanel'
import { StatusBar } from './components/StatusBar'
import { createInitialGameState } from './game/initialState'
import { gameReducer } from './game/reducer'
import {
  getDeployablePositions,
  getUnitAt,
  positionKey,
  resolveCombat,
  UNIT_TYPE_LABELS,
} from './game/rules'
import {
  getSelectedUnit,
  getSelectedUnitAttackableUnits,
  getSelectedUnitEnemyZoneOfControlPositions,
  getSelectedUnitReachablePositions,
} from './game/selectors'
import type { GameState, Tile, UnitType } from './game/types'
import { useAiTurn } from './hooks/useAiTurn'
import {
  deleteSavedGame,
  inspectSavedGame,
  loadGame,
  saveGame,
} from './storage/saveGame'
import type { SavedGame, StorageResult } from './storage/saveGame'
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
  const [saveSlot, setSaveSlot] = useState(() => inspectSavedGame())
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'status' | 'error'
    message: string
  }>()
  const [productionCityId, setProductionCityId] = useState<string>(() =>
    state.cities.find((city) => city.ownerId === 'player')?.id ?? '',
  )
  const [productionUnitType, setProductionUnitType] = useState<UnitType>()
  const [productionFeedback, setProductionFeedback] = useState<{
    type: 'status' | 'error'
    message: string
  }>()
  const playerCities = useMemo(
    () => state.cities.filter((city) => city.ownerId === 'player'),
    [state.cities],
  )
  const availableProductionCityId = playerCities.some(
    (city) => city.id === productionCityId,
  )
    ? productionCityId
    : playerCities[0]?.id
  const productionCity = playerCities.find(
    (city) => city.id === availableProductionCityId,
  )
  const activeProductionUnitType =
    state.phase === 'playing' &&
    state.activeFactionId === 'player' &&
    !activeCombat
      ? productionUnitType
      : undefined
  const deployablePositions = useMemo(
    () =>
      productionCity ? getDeployablePositions(state, productionCity) : [],
    [productionCity, state],
  )
  const deployableKeys = useMemo(
    () =>
      activeProductionUnitType
        ? new Set(deployablePositions.map(positionKey))
        : new Set<string>(),
    [activeProductionUnitType, deployablePositions],
  )
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
      setProductionUnitType(undefined)
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

  const canSave =
    state.phase === 'playing' &&
    state.activeFactionId === 'player' &&
    !activeCombat
  const canLoad =
    saveSlot.ok &&
    !activeCombat &&
    (state.phase !== 'playing' || state.activeFactionId === 'player')
  const canDelete =
    saveSlot.ok ||
    (!saveSlot.ok &&
      (saveSlot.code === 'invalidData' ||
        saveSlot.code === 'unsupportedVersion'))

  const updateSlotFromResult = (
    result: StorageResult<SavedGame>,
  ) => {
    setSaveSlot(result)
  }

  const handleSave = () => {
    if (!canSave) {
      return
    }

    const result = saveGame(state)
    updateSlotFromResult(result)
    setSaveFeedback(
      result.ok
        ? { type: 'status', message: '게임을 저장했습니다.' }
        : { type: 'error', message: result.message },
    )
  }

  const handleLoad = () => {
    if (
      !canLoad ||
      !window.confirm('현재 진행을 중단하고 저장된 게임을 불러올까요?')
    ) {
      return
    }

    const result = loadGame()
    updateSlotFromResult(result)

    if (!result.ok) {
      setSaveFeedback({ type: 'error', message: result.message })
      return
    }

    setActiveCombat(undefined)
    setCombatPhase('attack')
    setProductionUnitType(undefined)
    dispatch({ type: 'gameLoaded', state: result.value.gameState })
    setSaveFeedback({ type: 'status', message: '저장된 게임을 불러왔습니다.' })
  }

  const handleDeleteSave = () => {
    if (
      !canDelete ||
      !window.confirm('저장된 게임을 삭제할까요? 이 작업은 되돌릴 수 없습니다.')
    ) {
      return
    }

    const result = deleteSavedGame()
    if (!result.ok) {
      setSaveFeedback({ type: 'error', message: result.message })
      return
    }

    setSaveSlot(inspectSavedGame())
    setSaveFeedback({ type: 'status', message: '저장된 게임을 삭제했습니다.' })
  }

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

    if (!activeCombat.defenderDefeated && activeCombat.damageToAttacker > 0) {
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
      }, activeCombat.defenderDefeated || activeCombat.damageToAttacker === 0 ? timings.counterHit : timings.complete),
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

      if (event.key === 'Escape' && activeProductionUnitType) {
        event.preventDefault()
        setProductionUnitType(undefined)
        setProductionFeedback(undefined)
        return
      }

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
      setProductionUnitType(undefined)
      dispatch({ type: 'turnEnded' })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeCombat,
    activeProductionUnitType,
    state.activeFactionId,
    state.phase,
  ])

  const handleTileClick = (tile: Tile) => {
    if (activeCombat || state.activeFactionId !== 'player') {
      return
    }

    const unit = getUnitAt(state, tile.position)

    if (activeProductionUnitType && productionCity) {
      if (!deployableKeys.has(positionKey(tile.position))) {
        setProductionFeedback({
          type: 'error',
          message: '선택한 타일에는 부대를 배치할 수 없습니다.',
        })
        return
      }

      dispatch({
        type: 'unitProduced',
        cityId: productionCity.id,
        unitType: activeProductionUnitType,
        destination: tile.position,
      })
      setProductionFeedback({
        type: 'status',
        message: `${UNIT_TYPE_LABELS[activeProductionUnitType]} 생산을 완료했습니다.`,
      })
      setProductionUnitType(undefined)
      return
    }

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
        onEndTurn={() => {
          setProductionUnitType(undefined)
          dispatch({ type: 'turnEnded' })
        }}
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
              deployableKeys={deployableKeys}
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
              onRestart={() => {
                setProductionUnitType(undefined)
                setProductionFeedback(undefined)
                dispatch({ type: 'gameRestarted' })
              }}
            />
          )}
        </section>

        <aside className="side-panel" aria-label="게임 정보">
          <InfoPanel unit={selectedUnit} />
          <ProductionPanel
            cities={playerCities}
            selectedCityId={availableProductionCityId}
            selectedUnitType={activeProductionUnitType}
            resource={state.resources.player}
            turn={state.turn}
            deployableCount={deployablePositions.length}
            disabled={
              state.phase !== 'playing' ||
              state.activeFactionId !== 'player' ||
              Boolean(activeCombat)
            }
            feedback={productionFeedback}
            onCitySelected={(cityId) => {
              setProductionCityId(cityId)
              setProductionUnitType(undefined)
              setProductionFeedback(undefined)
            }}
            onUnitTypeSelected={(unitType) => {
              setProductionUnitType(unitType)
              setProductionFeedback(undefined)
              dispatch({ type: 'selectionCleared' })
            }}
            onCancel={() => {
              setProductionUnitType(undefined)
              setProductionFeedback(undefined)
            }}
          />
          <SavePanel
            slot={saveSlot}
            canSave={canSave}
            canLoad={canLoad}
            canDelete={canDelete}
            feedback={saveFeedback}
            onSave={handleSave}
            onLoad={handleLoad}
            onDelete={handleDeleteSave}
          />
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
