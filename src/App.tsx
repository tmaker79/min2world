import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { AppChrome } from './components/AppChrome'
import type { ChromeMenuId } from './components/AppChrome'
import { CityPanel } from './components/CityPanel'
import type { CityPanelTab } from './components/CityPanel'
import { DevelopmentPanel } from './components/DevelopmentPanel'
import { GameResultPanel } from './components/GameResultPanel'
import { GameMap } from './components/GameMap'
import type {
  CombatAnimation,
  CombatAnimationPhase,
} from './components/GameMap'
import { InfoPanel } from './components/InfoPanel'
import { Legend } from './components/Legend'
import { MapInfoPanel } from './components/MapInfoPanel'
import { Minimap } from './components/Minimap'
import { ProductionPanel } from './components/ProductionPanel'
import { SavePanel } from './components/SavePanel'
import { StatusBar } from './components/StatusBar'
import { StartScreen } from './components/StartScreen'
import { createInitialGameState } from './game/initialState'
import { BOARD_SIZE_PRESETS } from './game/hex'
import { createRandomMapSeed, normalizeMapSeed } from './game/mapGenerator'
import { gameReducer } from './game/reducer'
import { getSiteDevelopmentFootprints } from './game/siteDevelopment'
import {
  getDeployablePositions,
  getProducibleUnitTypes,
  getSiteAt,
  getSiteMaxHp,
  getUnitAt,
  positionKey,
  resolveCombat,
  resolveSiteCombat,
  SITE_STATS,
  TERRAIN_LABELS,
  UNIT_TYPE_LABELS,
  UNIT_STATS,
} from './game/rules'
import {
  getSelectedUnit,
  getSelectedUnitAttackableSites,
  getSelectedUnitAttackableUnits,
  getSelectedUnitEnemyZoneOfControlPositions,
  getSelectedUnitReachablePositions,
} from './game/selectors'
import { getSiteOccupiedPositions } from './game/siteFootprint'
import type { GameState, Tile, UnitType } from './game/types'
import { useAiTurn } from './hooks/useAiTurn'
import { useMapPan } from './hooks/useMapPan'
import { useMapZoom } from './hooks/useMapZoom'
import type { MapGestureState } from './hooks/useMapZoom'
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
  const [activeSiteAttack, setActiveSiteAttack] = useState<{
    attackerId: string
    attackerPosition: GameState['units'][number]['position']
    siteId: string
    sitePosition: GameState['sites'][number]['position']
    damage: number
    captured: boolean
  }>()
  const [siteAttackAnnouncement, setSiteAttackAnnouncement] = useState<string>()
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
  const [activeSiteTab, setActiveSiteTab] = useState<CityPanelTab>()
  const [developmentFootprintIndex, setDevelopmentFootprintIndex] = useState(0)
  const [productionUnitType, setProductionUnitType] = useState<UnitType>()
  const [productionFeedback, setProductionFeedback] = useState<{
    type: 'status' | 'error'
    message: string
  }>()
  const [activeMoveUnitId, setActiveMoveUnitId] = useState<string>()
  const [previewTileKey, setPreviewTileKey] = useState<string>()
  const [inspectedTileKey, setInspectedTileKey] = useState<string>()
  const [mobileInfoExpanded, setMobileInfoExpanded] = useState(
    Boolean(initialState.selectedUnitId),
  )
  const [mobileMinimapExpanded, setMobileMinimapExpanded] = useState(false)
  const [openChromeMenu, setOpenChromeMenu] = useState<ChromeMenuId | null>(null)
  const [mapScrollElement, setMapScrollElement] = useState<HTMLDivElement | null>(
    null,
  )
  const mapGestureStateRef = useRef<MapGestureState>({ pinching: false })
  const mapDragMovedRef = useRef(false)
  const isCompactBoard =
    (state.boardSize.columns === BOARD_SIZE_PRESETS.tiny.columns &&
      state.boardSize.rows === BOARD_SIZE_PRESETS.tiny.rows) ||
    (state.boardSize.columns === BOARD_SIZE_PRESETS.small.columns &&
      state.boardSize.rows === BOARD_SIZE_PRESETS.small.rows)
  const {
    zoom: mapZoom,
    zoomIn,
    zoomOut,
    fitToViewport,
    canZoomIn,
    canZoomOut,
  } = useMapZoom(mapScrollElement, mapGestureStateRef, mapDragMovedRef)
  useMapPan(
    mapScrollElement,
    mapGestureStateRef,
    mapZoom,
    mapDragMovedRef,
  )
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
  const cityInfoSite = state.sites.find((site) => site.id === cityInfoSiteId)
  const previewTile = state.tiles.find(
    (tile) => positionKey(tile.position) === previewTileKey,
  )
  const inspectedTile = state.tiles.find(
    (tile) => positionKey(tile.position) === inspectedTileKey,
  )
  const developmentFootprints = useMemo(
    () =>
      cityInfoSite && activeSiteTab === 'development'
        ? getSiteDevelopmentFootprints(state, cityInfoSite)
        : [],
    [activeSiteTab, cityInfoSite, state],
  )
  const developmentFootprintKeys = useMemo(
    () =>
      new Set(
        developmentFootprints.flatMap((footprint) =>
          footprint.map(positionKey),
        ),
      ),
    [developmentFootprints],
  )
  const selectedDevelopmentFootprint = developmentFootprints[
    developmentFootprintIndex
  ]
  const selectedDevelopmentFootprintKeys = useMemo(
    () =>
      new Set(
        (selectedDevelopmentFootprint ?? []).map(positionKey),
      ),
    [selectedDevelopmentFootprint],
  )
  const activeProductionUnitType =
    state.phase === 'playing' &&
    state.activeFactionId === state.humanFactionId &&
    !activeCombat
      ? productionUnitType
      : undefined
  const canPreviewMapInfo =
    !activeProductionUnitType &&
    !activeCombat &&
    !activeSiteAttack &&
    !cityInfoSite &&
    !state.selectedUnitId &&
    !inspectedTile
  const sidebarPreviewTile = canPreviewMapInfo ? previewTile : undefined
  const sidebarMapInfoTile = sidebarPreviewTile ?? inspectedTile
  const sidebarMapInfoUnit = sidebarMapInfoTile
    ? getUnitAt(state, sidebarMapInfoTile.position)
    : undefined
  const sidebarMapInfoSite = sidebarMapInfoTile
    ? getSiteAt(state, sidebarMapInfoTile.position)
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
  const mobileInfoLabel = activeProductionUnitType
    ? `${UNIT_TYPE_LABELS[activeProductionUnitType]} 배치`
    : cityInfoSite?.name ??
      selectedUnit?.name ??
      sidebarMapInfoUnit?.name ??
      sidebarMapInfoSite?.name ??
      (sidebarMapInfoTile
        ? TERRAIN_LABELS[sidebarMapInfoTile.terrain]
        : '선택 정보')
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
  const canEnterMoveMode =
    Boolean(selectedUnit) &&
    state.phase === 'playing' &&
    state.activeFactionId === state.humanFactionId &&
    !activeCombat &&
    !activeSiteAttack &&
    !activeProductionUnitType &&
    reachablePositions.length > 0
  const isMoveMode =
    canEnterMoveMode && activeMoveUnitId === selectedUnit?.id
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
  const attackableSites = useMemo(
    () => getSelectedUnitAttackableSites(state),
    [state],
  )
  const attackableSiteIds = useMemo(
    () => new Set(attackableSites.map((site) => site.id)),
    [attackableSites],
  )
  const attackableSiteKeys = useMemo(
    () =>
      new Set(
        attackableSites.flatMap((site) =>
          getSiteOccupiedPositions(site).map(positionKey),
        ),
      ),
    [attackableSites],
  )
  const zoneOfControlKeys = useMemo(
    () =>
      new Set(
        getSelectedUnitEnemyZoneOfControlPositions(state).map(positionKey),
      ),
    [state],
  )

  useEffect(() => {
    if (!mapScrollElement || !playerCapitalPosition || isCompactBoard) return

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
    isCompactBoard,
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
      setSiteAttackAnnouncement(undefined)
      setActiveMoveUnitId(undefined)
      setProductionUnitType(undefined)
      setActiveSiteTab(undefined)
      setDevelopmentFootprintIndex(0)
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

  const startSiteAttack = useCallback(
    (
      attackerId: string,
      siteId: string,
      sitePosition: GameState['sites'][number]['position'],
    ) => {
      const attacker = state.units.find((unit) => unit.id === attackerId)
      const site = state.sites.find((candidate) => candidate.id === siteId)
      if (!attacker || !site) return false

      const beforeHp = site.hp ?? getSiteMaxHp(site) ?? 0
      const result = resolveSiteCombat(state, attacker, site)
      const damage = beforeHp - result.siteHp
      const captured = result.siteHp === 0
      setCombatPhase('attack')
      setActiveMoveUnitId(undefined)
      setProductionUnitType(undefined)
      setActiveSiteTab(undefined)
      setDevelopmentFootprintIndex(0)
      setSiteAttackAnnouncement(undefined)
      setActiveSiteAttack({
        attackerId,
        attackerPosition: { ...attacker.position },
        siteId,
        sitePosition: { ...sitePosition },
        damage,
        captured,
      })
      return true
    },
    [state],
  )

  const aiAnnouncement = useAiTurn({
    state,
    combatActive: Boolean(activeCombat || activeSiteAttack),
    dispatch,
    startCombat,
    startSiteAttack,
  })

  const canSave =
    state.phase === 'playing' &&
    state.activeFactionId === state.humanFactionId &&
    !activeCombat &&
    !activeSiteAttack
  const canLoad =
    saveSlot.ok &&
    !activeCombat &&
    !activeSiteAttack &&
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
    setActiveMoveUnitId(undefined)
    setProductionUnitType(undefined)
    setActiveSiteTab(undefined)
    setDevelopmentFootprintIndex(0)
    setCityInfoSiteId(undefined)
    setPreviewTileKey(undefined)
    setInspectedTileKey(undefined)
    setMobileInfoExpanded(false)
    setMobileMinimapExpanded(false)
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
    const usesArrowVolley = state.units.some(
      (unit) =>
        unit.id === activeCombat.attackerId && unit.type === 'archer',
    )
    const timings = reducedMotion
      ? { hit: 20, complete: 70 }
      : usesArrowVolley
        ? { hit: 900, complete: 1300 }
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
  }, [activeCombat, state.units])

  useEffect(() => {
    if (!activeSiteAttack) return

    const site = state.sites.find(
      (candidate) => candidate.id === activeSiteAttack.siteId,
    )
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const usesArrowVolley = state.units.some(
      (unit) =>
        unit.id === activeSiteAttack.attackerId && unit.type === 'archer',
    )
    const timings = reducedMotion
      ? { hit: 20, complete: 70 }
      : usesArrowVolley
        ? { hit: 900, complete: 1300 }
        : { hit: 220, complete: 560 }
    const timers = [
      window.setTimeout(() => {
        setCombatPhase('hit')
        if (site) {
          setSiteAttackAnnouncement(
            `${site.name}에 ${activeSiteAttack.damage} 피해${
              activeSiteAttack.captured ? `, ${site.name} 점령` : ''
            }`,
          )
        }
      }, timings.hit),
      window.setTimeout(() => {
        dispatch({
          type: 'siteAttacked',
          attackerId: activeSiteAttack.attackerId,
          siteId: activeSiteAttack.siteId,
        })
        setActiveSiteAttack(undefined)
      }, timings.complete),
    ]

    return () => timers.forEach(window.clearTimeout)
  }, [activeSiteAttack, state.sites, state.units])

  useEffect(() => {
    if (
      state.phase !== 'playing' ||
      state.activeFactionId !== state.humanFactionId ||
      activeCombat ||
      activeSiteAttack
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

      if (
        event.key === 'Escape' &&
        (isMoveMode ||
          activeProductionUnitType ||
          activeSiteTab === 'development')
      ) {
        event.preventDefault()
        setActiveMoveUnitId(undefined)
        setProductionUnitType(undefined)
        setProductionFeedback(undefined)
        setActiveSiteTab(undefined)
        setDevelopmentFootprintIndex(0)
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
        isInteractive ||
        isMoveMode
      ) {
        return
      }

      event.preventDefault()
      setActiveMoveUnitId(undefined)
      setProductionUnitType(undefined)
      setActiveSiteTab(undefined)
      setDevelopmentFootprintIndex(0)
      setCityInfoSiteId(undefined)
      setPreviewTileKey(undefined)
      setInspectedTileKey(undefined)
      setMobileInfoExpanded(false)
      setMobileMinimapExpanded(false)
      dispatch({ type: 'turnEnded' })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeCombat,
    activeSiteAttack,
    activeProductionUnitType,
    activeSiteTab,
    isMoveMode,
    state.activeFactionId,
    state.humanFactionId,
    state.phase,
  ])

  const openMobileInfo = useCallback(() => {
    setMobileInfoExpanded(true)
    setMobileMinimapExpanded(false)
  }, [])

  const handleTileClick = useCallback((tile: Tile) => {
    const unit = getUnitAt(state, tile.position)
    const site = getSiteAt(state, tile.position)

    if (activeCombat || activeSiteAttack) {
      return
    }

    if (state.activeFactionId !== state.humanFactionId) {
      if (site) {
        openMobileInfo()
        setActiveMoveUnitId(undefined)
        setInspectedTileKey(undefined)
        setCityInfoSiteId(site.id)
        setActiveSiteTab(undefined)
        setDevelopmentFootprintIndex(0)
        setProductionUnitType(undefined)
        setProductionFeedback(undefined)
      }
      return
    }

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
      setActiveMoveUnitId(undefined)
      setInspectedTileKey(undefined)
      setProductionUnitType(undefined)
      setActiveSiteTab(undefined)
      setDevelopmentFootprintIndex(0)
      setCityInfoSiteId(undefined)
      setProductionFeedback(undefined)
      return
    }

    if (isMoveMode && selectedUnit) {
      if (!reachableKeys.has(positionKey(tile.position))) {
        return
      }

      dispatch({
        type: 'unitMoved',
        unitId: selectedUnit.id,
        destination: tile.position,
      })
      setActiveMoveUnitId(undefined)
      setInspectedTileKey(undefined)
      return
    }

    if (selectedUnit && unit && attackableIds.has(unit.id)) {
      setInspectedTileKey(undefined)
      startCombat(selectedUnit.id, unit.id)
      return
    }

    if (selectedUnit && site && attackableSiteIds.has(site.id)) {
      setInspectedTileKey(undefined)
      startSiteAttack(selectedUnit.id, site.id, tile.position)
      return
    }

    if (unit?.factionId === state.humanFactionId) {
      openMobileInfo()
      setActiveMoveUnitId(undefined)
      setInspectedTileKey(undefined)
      if (selectedUnit?.id === unit.id && site) {
        dispatch({ type: 'selectionCleared' })
        if (
          site.ownerId === state.humanFactionId &&
          SITE_STATS[site.kind].canProduce
        ) {
          setProductionSiteId(site.id)
        }
        setCityInfoSiteId(site.id)
        setActiveSiteTab(undefined)
        setDevelopmentFootprintIndex(0)
        setProductionUnitType(undefined)
        setProductionFeedback(undefined)
        return
      }

      dispatch({ type: 'unitSelected', unitId: unit.id })
      setCityInfoSiteId(undefined)
      setActiveSiteTab(undefined)
      setDevelopmentFootprintIndex(0)
      setProductionUnitType(undefined)
      setProductionFeedback(undefined)
      return
    }

    if (site) {
      openMobileInfo()
      setActiveMoveUnitId(undefined)
      setInspectedTileKey(undefined)
      dispatch({ type: 'selectionCleared' })
      if (
        site.ownerId === state.humanFactionId &&
        SITE_STATS[site.kind].canProduce
      ) {
        setProductionSiteId(site.id)
      }
      setCityInfoSiteId(site.id)
      setActiveSiteTab(undefined)
      setDevelopmentFootprintIndex(0)
      setProductionUnitType(undefined)
      setProductionFeedback(undefined)
      return
    }

    // Keep selection on reachable cells until a movement command is active.
    if (selectedUnit && reachableKeys.has(positionKey(tile.position))) {
      return
    }

    setActiveMoveUnitId(undefined)
    openMobileInfo()
    dispatch({ type: 'selectionCleared' })
    setCityInfoSiteId(undefined)
    setInspectedTileKey(positionKey(tile.position))
    setActiveSiteTab(undefined)
    setDevelopmentFootprintIndex(0)
    setProductionUnitType(undefined)
    setProductionFeedback(undefined)
  }, [
    activeCombat,
    activeSiteAttack,
    activeProductionUnitType,
    attackableIds,
    attackableSiteIds,
    deployableKeys,
    productionSite,
    reachableKeys,
    isMoveMode,
    openMobileInfo,
    selectedUnit,
    startCombat,
    startSiteAttack,
    state,
  ])

  const handleTileContextMenu = useCallback((tile: Tile) => {
    if (
      activeCombat ||
      activeSiteAttack ||
      state.activeFactionId !== state.humanFactionId
    ) {
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
    setActiveMoveUnitId(undefined)
    setInspectedTileKey(undefined)
  }, [
    activeCombat,
    activeSiteAttack,
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
    setActiveSiteAttack(undefined)
    setCombatPhase('attack')
    setActiveMoveUnitId(undefined)
    setProductionUnitType(undefined)
    setActiveSiteTab(undefined)
    setDevelopmentFootprintIndex(0)
    setCityInfoSiteId(undefined)
    setPreviewTileKey(undefined)
    setInspectedTileKey(undefined)
    setMobileInfoExpanded(false)
    setMobileMinimapExpanded(false)
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
                Boolean(activeCombat || activeSiteAttack)
              }
              onEndTurn={() => {
                setActiveMoveUnitId(undefined)
                setProductionUnitType(undefined)
                setActiveSiteTab(undefined)
                setDevelopmentFootprintIndex(0)
                setCityInfoSiteId(undefined)
                setPreviewTileKey(undefined)
                setInspectedTileKey(undefined)
                setMobileInfoExpanded(false)
                setMobileMinimapExpanded(false)
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
            {isMoveMode && selectedUnit && (
              <section
                className="deployment-bar movement-bar"
                aria-label="부대 이동"
              >
                <div className="deployment-bar__copy">
                  <strong>{selectedUnit.name} 이동</strong>
                  <span className="deployment-bar__message" role="status">
                    금색 타일을 선택하세요.
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="부대 이동 취소"
                  onClick={() => setActiveMoveUnitId(undefined)}
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
                  attackableSiteKeys={attackableSiteKeys}
                  deployableKeys={deployableKeys}
                  developmentFootprintKeys={developmentFootprintKeys}
                  selectedDevelopmentFootprintKeys={
                    selectedDevelopmentFootprintKeys
                  }
                  zoneOfControlKeys={zoneOfControlKeys}
                  selectedSiteId={cityInfoSite?.id}
                  inspectedTileKey={inspectedTileKey}
                  combatAnimation={
                    activeCombat
                      ? { ...activeCombat, phase: combatPhase }
                      : undefined
                  }
                  siteAttackAnimation={
                    activeSiteAttack
                      ? { ...activeSiteAttack, phase: combatPhase }
                      : undefined
                  }
                  disabled={
                    state.phase !== 'playing'
                  }
                  suppressClickRef={mapDragMovedRef}
                  onTileClick={handleTileClick}
                  onTileContextMenu={handleTileContextMenu}
                  onPreviewTileChange={(tileKey) => {
                    setPreviewTileKey(canPreviewMapInfo ? tileKey : undefined)
                  }}
                />
              </div>
              <div className="map-zoom-controls" aria-label="지도 확대/축소">
                <button
                  type="button"
                  aria-label="지도 축소"
                  disabled={!canZoomOut}
                  onClick={zoomOut}
                >
                  −
                </button>
                <output aria-label="현재 지도 배율">
                  {Math.round(mapZoom * 100)}%
                </output>
                <button
                  type="button"
                  aria-label="지도 확대"
                  disabled={!canZoomIn}
                  onClick={zoomIn}
                >
                  +
                </button>
                <button
                  type="button"
                  className="map-zoom-controls__fit"
                  aria-label="지도를 화면에 맞춤"
                  onClick={fitToViewport}
                >
                  맞춤
                </button>
              </div>
            </div>

            <aside className="map-sidebar" aria-label="지도 사이드바">
              <div
                className={`map-minimap-dock${
                  mobileMinimapExpanded ? ' map-minimap-dock--expanded' : ''
                }`}
              >
                <button
                  type="button"
                  className="map-minimap-dock__toggle"
                  aria-expanded={mobileMinimapExpanded}
                  aria-controls="mobile-minimap"
                  onClick={() => {
                    const expanded = !mobileMinimapExpanded
                    setMobileMinimapExpanded(expanded)
                    if (expanded) setMobileInfoExpanded(false)
                  }}
                >
                  {mobileMinimapExpanded ? '미니맵 닫기' : '미니맵 열기'}
                </button>
                <div id="mobile-minimap" className="map-minimap-dock__body">
                  <Minimap
                    state={state}
                    scrollElement={mapScrollElement}
                    zoom={mapZoom}
                  />
                </div>
              </div>

              <section
                className={`map-sidebar__selection mobile-info-sheet${
                  mobileInfoExpanded ? ' mobile-info-sheet--expanded' : ''
                }`}
                aria-label="선택 정보"
              >
                <button
                  type="button"
                  className="mobile-info-sheet__toggle"
                  aria-expanded={mobileInfoExpanded}
                  aria-controls="mobile-info-sheet-body"
                  onClick={() => {
                    const expanded = !mobileInfoExpanded
                    setMobileInfoExpanded(expanded)
                    if (expanded) setMobileMinimapExpanded(false)
                  }}
                >
                  <span className="mobile-info-sheet__handle" aria-hidden="true" />
                  <span>{mobileInfoLabel}</span>
                </button>
                <div
                  id="mobile-info-sheet-body"
                  className="mobile-info-sheet__body"
                >
                {sidebarPreviewTile && sidebarMapInfoTile && (
                  <MapInfoPanel
                    tile={sidebarMapInfoTile}
                    unit={sidebarMapInfoUnit}
                    site={sidebarMapInfoSite}
                    preview
                  />
                )}
                {!sidebarPreviewTile && !activeProductionUnitType && cityInfoSite && (
                  <CityPanel
                    site={cityInfoSite}
                    activeTab={activeSiteTab}
                    canProduce={
                      cityInfoSite.ownerId === state.humanFactionId &&
                      SITE_STATS[cityInfoSite.kind].canProduce
                    }
                    onTabChange={(tab) => {
                      setActiveSiteTab(tab)
                      setDevelopmentFootprintIndex(0)
                      setProductionUnitType(undefined)
                      setProductionFeedback(undefined)
                      if (tab === 'production') {
                        setProductionSiteId(cityInfoSite.id)
                      }
                    }}
                    onClose={() => {
                      setCityInfoSiteId(undefined)
                      setMobileInfoExpanded(false)
                      setActiveSiteTab(undefined)
                      setDevelopmentFootprintIndex(0)
                      setProductionUnitType(undefined)
                      setProductionFeedback(undefined)
                    }}
                  >
                    {activeSiteTab === 'production' && (
                      <ProductionPanel
                        site={productionSite}
                        state={state}
                        selectedUnitType={activeProductionUnitType}
                        resource={state.resources[state.humanFactionId] ?? 0}
                        turn={state.turn}
                        deployableCount={deployablePositions.length}
                        disabled={
                          state.phase !== 'playing' ||
                          state.activeFactionId !== state.humanFactionId ||
                          Boolean(activeCombat || activeSiteAttack)
                        }
                        feedback={productionFeedback}
                        onUnitTypeSelected={(unitType) => {
                          if (
                            !productionSite ||
                            !getProducibleUnitTypes(productionSite).includes(
                              unitType,
                            )
                          ) {
                            return
                          }
                          setProductionUnitType(unitType)
                          setMobileInfoExpanded(false)
                          setProductionFeedback(undefined)
                          dispatch({ type: 'selectionCleared' })
                        }}
                        onCancel={() => {
                          setProductionUnitType(undefined)
                          setProductionFeedback(undefined)
                        }}
                      />
                    )}
                    {activeSiteTab === 'development' && (
                      <DevelopmentPanel
                        state={state}
                        site={cityInfoSite}
                        footprints={developmentFootprints}
                        selectedFootprintIndex={developmentFootprintIndex}
                        onFootprintSelected={setDevelopmentFootprintIndex}
                        onDevelop={() => {
                          dispatch({
                            type: 'siteDeveloped',
                            siteId: cityInfoSite.id,
                            footprint: selectedDevelopmentFootprint,
                          })
                          setActiveSiteTab(undefined)
                          setDevelopmentFootprintIndex(0)
                        }}
                      />
                    )}
                  </CityPanel>
                )}
                {!sidebarPreviewTile && !activeProductionUnitType && selectedUnit && (
                  <InfoPanel
                    unit={selectedUnit}
                    canMove={canEnterMoveMode}
                    moveMode={isMoveMode}
                    onMoveModeChange={(active) => {
                      setActiveMoveUnitId(active ? selectedUnit.id : undefined)
                      if (active) setMobileInfoExpanded(false)
                    }}
                  />
                )}
                {activeProductionUnitType && (
                  <div className="empty-selection empty-selection--compact">
                    <span aria-hidden="true">⌖</span>
                    <p>지도에서 청록색 배치 타일을 선택하세요.</p>
                  </div>
                )}
                {!sidebarPreviewTile &&
                  !activeProductionUnitType &&
                  !cityInfoSite &&
                  !selectedUnit &&
                  inspectedTile &&
                  sidebarMapInfoTile && (
                    <MapInfoPanel
                      tile={sidebarMapInfoTile}
                      unit={sidebarMapInfoUnit}
                      site={sidebarMapInfoSite}
                    />
                  )}
                {!sidebarPreviewTile &&
                  !activeProductionUnitType &&
                  !cityInfoSite &&
                  !selectedUnit &&
                  !inspectedTile && (
                  <div className="empty-selection empty-selection--compact">
                    <span aria-hidden="true">◇</span>
                    <p>지도 타일을 가리키거나 선택하면 상세 정보가 표시됩니다.</p>
                  </div>
                )}
                </div>
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
      {siteAttackAnnouncement && (
        <span className="sr-only" role="status" aria-live="polite">
          {siteAttackAnnouncement}
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
