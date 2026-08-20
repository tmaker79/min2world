import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { AppChrome } from './components/AppChrome'
import type { ChromeMenuId } from './components/AppChrome'
import { CityPanel } from './components/CityPanel'
import { GameResultPanel } from './components/GameResultPanel'
import { GameMap } from './components/GameMap'
import type {
  CombatAnimation,
  CombatAnimationPhase,
} from './components/GameMap'
import { InfoPanel } from './components/InfoPanel'
import { Legend } from './components/Legend'
import { Minimap } from './components/Minimap'
import { ProductionPanel } from './components/ProductionPanel'
import { SavePanel } from './components/SavePanel'
import { StatusBar } from './components/StatusBar'
import { StartScreen } from './components/StartScreen'
import { createInitialGameState } from './game/initialState'
import { BOARD_SIZE_PRESETS } from './game/hex'
import { createRandomMapSeed, normalizeMapSeed } from './game/mapGenerator'
import { gameReducer } from './game/reducer'
import {
  getDeployablePositions,
  getSiteAt,
  getUnitAt,
  positionKey,
  resolveCombat,
  SITE_STATS,
  UNIT_TYPE_LABELS,
  UNIT_STATS,
} from './game/rules'
import {
  getSelectedUnit,
  getSelectedUnitAttackableUnits,
  getSelectedUnitEnemyZoneOfControlPositions,
  getSelectedUnitReachablePositions,
} from './game/selectors'
import type { GameState, Tile, UnitType } from './game/types'
import { useAiTurn } from './hooks/useAiTurn'
import { useMapPan } from './hooks/useMapPan'
import { useMapZoom } from './hooks/useMapZoom'
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

function GameApp({ initialState }: { initialState: GameState }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const [activeCombat, setActiveCombat] = useState<
    Omit<CombatAnimation, 'phase'>
  >()
  const [combatPhase, setCombatPhase] = useState<CombatAnimationPhase>('attack')
  const [saveSlot, setSaveSlot] = useState(() => inspectSavedGame())
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'status' | 'error'
    message: string
  }>()
  const [seedInput, setSeedInput] = useState(state.mapSeed)
  const [seedFeedback, setSeedFeedback] = useState<string>()
  const [productionSiteId, setProductionSiteId] = useState<string>(() =>
    state.sites.find(
      (site) =>
        site.ownerId === state.humanFactionId &&
        SITE_STATS[site.kind].canProduce,
    )?.id ?? '',
  )
  const [cityInfoSiteId, setCityInfoSiteId] = useState<string>()
  const [productionPanelOpen, setProductionPanelOpen] = useState(false)
  const [productionUnitType, setProductionUnitType] = useState<UnitType>()
  const [productionFeedback, setProductionFeedback] = useState<{
    type: 'status' | 'error'
    message: string
  }>()
  const [openChromeMenu, setOpenChromeMenu] = useState<ChromeMenuId | null>(null)
  const [mapScrollElement, setMapScrollElement] = useState<HTMLDivElement | null>(
    null,
  )
  const mapDragMovedRef = useMapPan(mapScrollElement)
  const isCompactBoard =
    (state.boardSize.columns === BOARD_SIZE_PRESETS.tiny.columns &&
      state.boardSize.rows === BOARD_SIZE_PRESETS.tiny.rows) ||
    (state.boardSize.columns === BOARD_SIZE_PRESETS.small.columns &&
      state.boardSize.rows === BOARD_SIZE_PRESETS.small.rows)
  const mapZoom = useMapZoom(mapScrollElement)
  const playerProductionSites = useMemo(
    () =>
      state.sites.filter(
        (site) =>
          site.ownerId === state.humanFactionId &&
          SITE_STATS[site.kind].canProduce,
      ),
    [state.humanFactionId, state.sites],
  )
  const availableProductionSiteId = playerProductionSites.some(
    (site) => site.id === productionSiteId,
  )
    ? productionSiteId
    : playerProductionSites[0]?.id
  const productionSite = playerProductionSites.find(
    (site) => site.id === availableProductionSiteId,
  )
  const cityInfoSite = state.sites.find(
    (site) =>
      site.id === cityInfoSiteId &&
      site.ownerId === state.humanFactionId &&
      site.kind === 'stronghold',
  )
  const activeProductionUnitType =
    state.phase === 'playing' &&
    state.activeFactionId === state.humanFactionId &&
    !activeCombat
      ? productionUnitType
      : undefined
  const deployablePositions = useMemo(
    () =>
      productionSite ? getDeployablePositions(state, productionSite) : [],
    [productionSite, state],
  )
  const deployableKeys = useMemo(
    () =>
      activeProductionUnitType
        ? new Set(deployablePositions.map(positionKey))
        : new Set<string>(),
    [activeProductionUnitType, deployablePositions],
  )
  const selectedUnit = getSelectedUnit(state)
  const playerCapital = state.sites.find(
    (site) => site.capitalFor === state.humanFactionId,
  )
  const playerCapitalPosition = playerCapital?.position
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

  useEffect(() => {
    if (!mapScrollElement || !playerCapitalPosition) return

    const frame = window.requestAnimationFrame(() => {
      const capitalTile = mapScrollElement.querySelector<HTMLElement>(
        `.map-tile[data-coordinate="${positionKey(playerCapitalPosition)}"]`,
      )
      if (!capitalTile) return

      const scrollBounds = mapScrollElement.getBoundingClientRect()
      const tileBounds = capitalTile.getBoundingClientRect()
      mapScrollElement.scrollLeft = Math.max(
        0,
        mapScrollElement.scrollLeft +
          tileBounds.left +
          tileBounds.width / 2 -
          scrollBounds.left -
          mapScrollElement.clientWidth / 2,
      )
      mapScrollElement.scrollTop = Math.max(
        0,
        mapScrollElement.scrollTop +
          tileBounds.top +
          tileBounds.height / 2 -
          scrollBounds.top -
          mapScrollElement.clientHeight / 2,
      )
    })

    return () => window.cancelAnimationFrame(frame)
  }, [
    mapScrollElement,
    playerCapitalPosition,
    state.tiles,
  ])

  const startCombat = useCallback(
    (attackerId: string, defenderId: string) => {
      const attacker = state.units.find((unit) => unit.id === attackerId)
      const defender = state.units.find((unit) => unit.id === defenderId)

      if (!attacker || !defender) {
        return
      }

      const result = resolveCombat(state, attacker, defender)
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
    [state],
  )

  const aiAnnouncement = useAiTurn({
    state,
    combatActive: Boolean(activeCombat),
    dispatch,
    startCombat,
  })

  const canSave =
    state.phase === 'playing' &&
    state.activeFactionId === state.humanFactionId &&
    !activeCombat
  const canLoad =
    saveSlot.ok &&
    !activeCombat &&
    (state.phase !== 'playing' || state.activeFactionId === state.humanFactionId)
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
    setProductionPanelOpen(false)
    setCityInfoSiteId(undefined)
    setProductionSiteId(
      result.value.gameState.sites.find(
        (site) =>
          site.ownerId === result.value.gameState.humanFactionId &&
          SITE_STATS[site.kind].canProduce,
      )?.id ?? '',
    )
    setSeedInput(result.value.gameState.mapSeed)
    setSeedFeedback(undefined)
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
      ? { hit: 20, complete: 70 }
      : { hit: 220, complete: 560 }
    const timers: number[] = []

    timers.push(
      window.setTimeout(() => setCombatPhase('hit'), timings.hit),
    )

    timers.push(
      window.setTimeout(() => {
        dispatch({
          type: 'unitAttacked',
          attackerId: activeCombat.attackerId,
          defenderId: activeCombat.defenderId,
        })
        setActiveCombat(undefined)
      }, timings.complete),
    )

    return () => timers.forEach(window.clearTimeout)
  }, [activeCombat])

  useEffect(() => {
    if (
      state.phase !== 'playing' ||
      state.activeFactionId !== state.humanFactionId ||
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
      const isInteractive =
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement

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
        isEditing ||
        isInteractive
      ) {
        return
      }

      event.preventDefault()
      setProductionUnitType(undefined)
      setProductionPanelOpen(false)
      setCityInfoSiteId(undefined)
      dispatch({ type: 'turnEnded' })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeCombat,
    activeProductionUnitType,
    state.activeFactionId,
    state.humanFactionId,
    state.phase,
  ])

  const handleTileClick = useCallback((tile: Tile) => {
    if (activeCombat || state.activeFactionId !== state.humanFactionId) {
      return
    }

    const unit = getUnitAt(state, tile.position)
    const site = getSiteAt(state, tile.position)

    if (activeProductionUnitType && productionSite) {
      if (!deployableKeys.has(positionKey(tile.position))) {
        setProductionFeedback({
          type: 'error',
          message: '선택한 타일에는 부대를 배치할 수 없습니다.',
        })
        return
      }

      dispatch({
        type: 'unitProduced',
        siteId: productionSite.id,
        unitType: activeProductionUnitType,
        destination: tile.position,
      })
      setProductionUnitType(undefined)
      setProductionPanelOpen(false)
      setCityInfoSiteId(undefined)
      setProductionFeedback(undefined)
      return
    }

    if (selectedUnit && unit && attackableIds.has(unit.id)) {
      startCombat(selectedUnit.id, unit.id)
      return
    }

    if (unit?.factionId === state.humanFactionId) {
      const canSelectSite =
        site &&
        site.ownerId === state.humanFactionId &&
        SITE_STATS[site.kind].canProduce

      if (selectedUnit?.id === unit.id && canSelectSite) {
        dispatch({ type: 'selectionCleared' })
        setProductionSiteId(site.id)
        setCityInfoSiteId(site.id)
        setProductionPanelOpen(false)
        setProductionUnitType(undefined)
        setProductionFeedback(undefined)
        return
      }

      dispatch({ type: 'unitSelected', unitId: unit.id })
      setCityInfoSiteId(undefined)
      setProductionPanelOpen(false)
      setProductionUnitType(undefined)
      setProductionFeedback(undefined)
      return
    }

    if (
      site &&
      site.ownerId === state.humanFactionId &&
      SITE_STATS[site.kind].canProduce
    ) {
      dispatch({ type: 'selectionCleared' })
      setProductionSiteId(site.id)
      setCityInfoSiteId(site.id)
      setProductionPanelOpen(false)
      setProductionUnitType(undefined)
      setProductionFeedback(undefined)
      return
    }

    // Movement uses right-click; keep selection on accidental left-click.
    if (selectedUnit && reachableKeys.has(positionKey(tile.position))) {
      return
    }

    dispatch({ type: 'selectionCleared' })
    setCityInfoSiteId(undefined)
    setProductionPanelOpen(false)
    setProductionUnitType(undefined)
    setProductionFeedback(undefined)
  }, [
    activeCombat,
    activeProductionUnitType,
    attackableIds,
    deployableKeys,
    productionSite,
    reachableKeys,
    selectedUnit,
    startCombat,
    state,
  ])

  const handleTileContextMenu = useCallback((tile: Tile) => {
    if (activeCombat || state.activeFactionId !== state.humanFactionId) {
      return
    }

    if (activeProductionUnitType) {
      return
    }

    if (!selectedUnit || !reachableKeys.has(positionKey(tile.position))) {
      return
    }

    dispatch({
      type: 'unitMoved',
      unitId: selectedUnit.id,
      destination: tile.position,
    })
  }, [
    activeCombat,
    activeProductionUnitType,
    reachableKeys,
    selectedUnit,
    state.activeFactionId,
    state.humanFactionId,
  ])

  const hasProgress =
    state.turn > 1 ||
    state.units.length !== state.factionCount * 3 ||
    state.units.some(
      (unit) =>
        unit.hasActed ||
        unit.hp !== unit.maxHp ||
        unit.movementRemaining !== UNIT_STATS[unit.type].movement,
    ) ||
    state.sites.some(
      (site) =>
        (site.capitalFor && site.ownerId !== site.capitalFor) ||
        (!site.capitalFor && site.ownerId !== 'neutral'),
    )

  const restartGame = (seed: string, confirmProgress: boolean) => {
    const normalizedSeed = normalizeMapSeed(seed)
    if (!normalizedSeed) {
      setSeedFeedback('seed는 공백이 아닌 1~64자로 입력해 주세요.')
      return false
    }
    if (
      confirmProgress &&
      hasProgress &&
      !window.confirm('현재 진행을 중단하고 새 지도를 시작할까요?')
    ) {
      return false
    }
    setActiveCombat(undefined)
    setCombatPhase('attack')
    setProductionUnitType(undefined)
    setProductionPanelOpen(false)
    setCityInfoSiteId(undefined)
    setProductionFeedback(undefined)
    setSaveFeedback(undefined)
    setSeedInput(normalizedSeed)
    setSeedFeedback(undefined)
    dispatch(
      state.humanFactionId === 'player'
        ? { type: 'gameRestarted', seed: normalizedSeed }
        : {
            type: 'gameRestarted',
            seed: normalizedSeed,
            boardSize: state.boardSize,
            factionCount: state.factionCount,
            humanFactionId: state.humanFactionId,
            mapType: state.mapType,
          },
    )
    return true
  }

  const restartRandomGame = (confirmProgress: boolean) => {
    return restartGame(createRandomMapSeed(), confirmProgress)
  }

  return (
    <div className="app-shell">
      <AppChrome
        mapSeed={state.mapSeed}
        openMenu={openChromeMenu}
        onOpenMenuChange={setOpenChromeMenu}
        seedInput={seedInput}
        seedFeedback={seedFeedback}
        onSeedInputChange={(value) => {
          setSeedInput(value)
          setSeedFeedback(undefined)
        }}
        onSeedSubmit={() => restartGame(seedInput, true)}
        onRandomRestart={() => restartRandomGame(true)}
        savePanel={
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
        }
        helpPanel={
          <section className="help-card" aria-labelledby="help-heading">
            <p className="eyebrow">HOW TO PLAY</p>
            <h2 id="help-heading">작전 지침</h2>
            <ol>
              <li>푸른 유닛을 선택해 금색 칸으로 이동하거나 붉은 적을 공격합니다.</li>
              <li>아군 성을 선택해 생산하고, 상단 메뉴에서 새 지도·저장을 엽니다.</li>
              <li>모든 행동 후 턴을 종료합니다. 상세 규칙은 README를 참고하세요.</li>
            </ol>
            <Legend embedded />
          </section>
        }
      />

      <main className="game-layout">
        <section className="board-panel" aria-label="전략 지도">
          <div className="status-bar-slot">
            <StatusBar
              turn={state.turn}
              resource={state.resources[state.humanFactionId] ?? 0}
              activeFactionId={state.activeFactionId}
              humanFactionId={state.humanFactionId}
              disabled={
                state.phase !== 'playing' ||
                state.activeFactionId !== state.humanFactionId ||
                Boolean(activeCombat)
              }
              onEndTurn={() => {
                setProductionUnitType(undefined)
                setProductionPanelOpen(false)
                setCityInfoSiteId(undefined)
                setProductionFeedback(undefined)
                dispatch({ type: 'turnEnded' })
              }}
            />

            {activeProductionUnitType && (
              <section className="deployment-bar" aria-label="부대 배치">
                <div className="deployment-bar__copy">
                  <strong>
                    {UNIT_TYPE_LABELS[activeProductionUnitType]} 배치
                  </strong>
                  <span
                    className={
                      productionFeedback?.type === 'error'
                        ? 'deployment-bar__message deployment-bar__message--error'
                        : 'deployment-bar__message'
                    }
                    role={
                      productionFeedback?.type === 'error' ? 'alert' : undefined
                    }
                  >
                    {productionFeedback?.type === 'error'
                      ? productionFeedback.message
                      : '청록색 타일을 선택하세요.'}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="부대 배치 취소"
                  onClick={() => {
                    setProductionUnitType(undefined)
                    setProductionFeedback(undefined)
                  }}
                >
                  취소 <kbd>Esc</kbd>
                </button>
              </section>
            )}
          </div>

          <div className="board-workspace">
            <div className="map-stage">
              <div
                className={`map-scroll${isCompactBoard ? ' map-scroll--fit' : ''}`}
                ref={setMapScrollElement}
              >
                <GameMap
                  state={state}
                  scrollElement={mapScrollElement}
                  zoom={mapZoom}
                  reachableKeys={reachableKeys}
                  attackableKeys={attackableKeys}
                  deployableKeys={deployableKeys}
                  zoneOfControlKeys={zoneOfControlKeys}
                  selectedSiteId={
                    cityInfoSite?.id ??
                    (productionPanelOpen ? availableProductionSiteId : undefined)
                  }
                  combatAnimation={
                    activeCombat
                      ? { ...activeCombat, phase: combatPhase }
                      : undefined
                  }
                  disabled={
                    state.phase !== 'playing' ||
                    state.activeFactionId !== state.humanFactionId ||
                    Boolean(activeCombat)
                  }
                  suppressClickRef={mapDragMovedRef}
                  onTileClick={handleTileClick}
                  onTileContextMenu={handleTileContextMenu}
                />
              </div>
            </div>

            <aside className="map-sidebar" aria-label="지도 사이드바">
              <Minimap
                state={state}
                scrollElement={mapScrollElement}
                zoom={mapZoom}
              />

              <section className="map-sidebar__selection" aria-label="선택 정보">
                {!activeProductionUnitType && cityInfoSite && (
                  <CityPanel
                    site={cityInfoSite}
                    productionOpen={productionPanelOpen}
                    onProductionOpen={() => {
                      setProductionSiteId(cityInfoSite.id)
                      setProductionPanelOpen(true)
                      setProductionUnitType(undefined)
                      setProductionFeedback(undefined)
                    }}
                    onClose={() => {
                      setCityInfoSiteId(undefined)
                      setProductionPanelOpen(false)
                      setProductionUnitType(undefined)
                      setProductionFeedback(undefined)
                    }}
                  >
                    {productionPanelOpen && (
                      <ProductionPanel
                        site={productionSite}
                        selectedUnitType={activeProductionUnitType}
                        resource={state.resources[state.humanFactionId] ?? 0}
                        turn={state.turn}
                        deployableCount={deployablePositions.length}
                        disabled={
                          state.phase !== 'playing' ||
                          state.activeFactionId !== state.humanFactionId ||
                          Boolean(activeCombat)
                        }
                        feedback={productionFeedback}
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
                    )}
                  </CityPanel>
                )}
                {!activeProductionUnitType && selectedUnit && (
                  <InfoPanel
                    unit={selectedUnit}
                    onClose={() => dispatch({ type: 'selectionCleared' })}
                  />
                )}
                {activeProductionUnitType && (
                  <div className="empty-selection empty-selection--compact">
                    <span aria-hidden="true">⌖</span>
                    <p>지도에서 청록색 배치 타일을 선택하세요.</p>
                  </div>
                )}
                {!activeProductionUnitType && !cityInfoSite && !selectedUnit && (
                  <div className="empty-selection empty-selection--compact">
                    <span aria-hidden="true">◇</span>
                    <p>유닛이나 거점을 선택하면 상세 정보가 표시됩니다.</p>
                  </div>
                )}
              </section>
            </aside>
          </div>

          {state.phase !== 'playing' && (
            <GameResultPanel
              phase={state.phase}
              turn={state.turn}
              onRestart={() => {
                restartGame(state.mapSeed, false)
              }}
              onRandomRestart={() => restartRandomGame(false)}
            />
          )}
        </section>
      </main>
      {aiAnnouncement && (
        <span className="sr-only" role="status" aria-live="polite">
          {aiAnnouncement}
        </span>
      )}
    </div>
  )
}

function App({ initialState }: AppProps = {}) {
  const [gameState, setGameState] = useState<GameState | undefined>(initialState)

  if (!gameState) {
    return (
      <StartScreen
        onStart={({ seed, boardSize, factionCount, humanFactionId, mapType }) => {
          setGameState(
            createInitialGameState(seed, {
              boardSize,
              factionCount,
              humanFactionId,
              mapType,
            }),
          )
        }}
      />
    )
  }

  return <GameApp initialState={gameState} />
}

export default App
