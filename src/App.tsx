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
import { ConstructionPanel } from './components/ConstructionPanel'
import { DevelopmentPanel } from './components/DevelopmentPanel'
import { GameResultPanel } from './components/GameResultPanel'
import { GameMap } from './components/GameMap'
import type {
  CombatAnimation,
  CombatAnimationPhase,
  MapTileActivationSource,
} from './components/GameMap'
import { InfoPanel } from './components/InfoPanel'
import type { FoundingKind } from './components/InfoPanel'
import { Legend } from './components/Legend'
import { MapInfoPanel } from './components/MapInfoPanel'
import { Minimap } from './components/Minimap'
import { ProductionPanel } from './components/ProductionPanel'
import { SavePanel } from './components/SavePanel'
import { StatusBar } from './components/StatusBar'
import { StartScreen } from './components/StartScreen'
import { resolveGameMode } from './game/gameMode'
import { BOARD_SIZE_PRESETS } from './game/hex'
import { createInitialGameState } from './game/initialState'
import {
  createRandomMapSeed,
  STARTING_UNIT_TYPES,
} from './game/mapGenerator'
import { gameReducer } from './game/reducer'
import { getSiteDevelopmentFootprints } from './game/siteDevelopment'
import {
  createProductionSupportIndex,
  getConstructiblePositions,
  getProductionSupportAt,
  getSettlementProductionCapacity,
  getSettleablePositions,
} from './game/settlement'
import {
  getDeployablePositions,
  getFactionIncome,
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
  getSelectedUnitReachablePositions,
} from './game/selectors'
import { getSiteOccupiedPositions } from './game/siteFootprint'
import { getTileIndex } from './game/spatialIndex'
import { createTerritoryIndex } from './game/territory'
import type { GameState, Site, Tile, Unit, UnitType } from './game/types'
import {
  getFactionNetIncome,
  getFactionUpkeep,
  getFactionUpkeepReserve,
} from './game/upkeep'
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

const COMPACT_MAP_OVERLAY_QUERY =
  '(max-width: 700px), (max-width: 980px) and (max-height: 500px)'
const SIDEBAR_OVERLAY_QUERY = '(max-width: 980px)'
const EMPTY_TILE_KEYS = new Set<string>()

type SidebarContent =
  | { kind: 'deployment'; unitType: UnitType }
  | { kind: 'site'; site: Site }
  | { kind: 'unit'; unit: Unit }
  | {
      kind: 'mapInfo'
      tile: Tile
      unit?: Unit
      site?: Site
      preview: boolean
    }
  | { kind: 'empty' }

function getCombatTimings(units: readonly Unit[], attackerId: string) {
  const reducedMotion = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches
  const usesArrowVolley = units.some(
    (unit) => unit.id === attackerId && unit.type === 'archer',
  )
  return reducedMotion
    ? { hit: 20, complete: 70 }
    : usesArrowVolley
      ? { hit: 900, complete: 1300 }
      : { hit: 220, complete: 560 }
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
  const [saveSlot, setSaveSlot] = useState(() =>
    inspectSavedGame(undefined, initialState.gameMode),
  )
  const [hasBlockedLegacySave] = useState(
    () =>
      initialState.gameMode === 'quick' &&
      inspectSavedGame(undefined, 'standard').ok,
  )
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'status' | 'error'
    message: string
  }>()
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
  const [activeAttackUnitId, setActiveAttackUnitId] = useState<string>()
  const [foundingSelection, setFoundingSelection] = useState<{
    unitId: string
    kind: FoundingKind
  }>()
  const [previewTileKey, setPreviewTileKey] = useState<string>()
  const [inspectedTileKey, setInspectedTileKey] = useState<string>()
  const [mobileInfoExpanded, setMobileInfoExpanded] = useState(
    Boolean(initialState.selectedUnitId),
  )
  const [minimapExpanded, setMinimapExpanded] = useState(
    () => !window.matchMedia(COMPACT_MAP_OVERLAY_QUERY).matches,
  )
  const [openChromeMenu, setOpenChromeMenu] = useState<ChromeMenuId | null>(null)
  const [mapScrollElement, setMapScrollElement] = useState<HTMLDivElement | null>(
    null,
  )
  const hasCenteredInitialMapRef = useRef(false)
  const mapGestureStateRef = useRef<MapGestureState>({ pinching: false })
  const mapDragMovedRef = useRef(false)
  const closeCompactMinimap = useCallback(() => {
    if (window.matchMedia(COMPACT_MAP_OVERLAY_QUERY).matches) {
      setMinimapExpanded(false)
    }
  }, [])
  const closeSidebarOverlayMinimap = useCallback(() => {
    if (window.matchMedia(SIDEBAR_OVERLAY_QUERY).matches) {
      setMinimapExpanded(false)
    }
  }, [])
  const openSidebarInfo = useCallback(() => {
    setMobileInfoExpanded(true)
    closeSidebarOverlayMinimap()
  }, [closeSidebarOverlayMinimap])
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
  const playerProductionSupportIndex = useMemo(
    () => createProductionSupportIndex(state, state.humanFactionId),
    [state],
  )
  const cityInfoSettlementCapacity =
    cityInfoSite?.ownerId === state.humanFactionId
      ? getSettlementProductionCapacity(
          playerProductionSupportIndex,
          cityInfoSite.id,
        )
      : undefined
  const cityInfoProductionSupport =
    cityInfoSite?.ownerId === state.humanFactionId &&
    (cityInfoSite.kind === 'farm' ||
      cityInfoSite.kind === 'mine' ||
      cityInfoSite.kind === 'blacksmith')
      ? getProductionSupportAt(
          playerProductionSupportIndex,
          cityInfoSite.position,
        )
      : undefined
  const tileIndex = getTileIndex(state)
  const previewTile = previewTileKey
    ? tileIndex.get(previewTileKey)
    : undefined
  const inspectedTile = inspectedTileKey
    ? tileIndex.get(inspectedTileKey)
    : undefined
  const territoryByKey = useMemo(
    () => createTerritoryIndex({ sites: state.sites, tiles: state.tiles }),
    [state.sites, state.tiles],
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
  const selectedUnit = getSelectedUnit(state)
  const foundingKind =
    foundingSelection && foundingSelection.unitId === selectedUnit?.id
      ? foundingSelection.kind
      : undefined
  const setFoundingKind = useCallback(
    (kind: FoundingKind | undefined) => {
      setFoundingSelection(
        kind && selectedUnit ? { unitId: selectedUnit.id, kind } : undefined,
      )
    },
    [selectedUnit],
  )
  const canPreviewMapInfo =
    !activeProductionUnitType &&
    !activeCombat &&
    !activeSiteAttack &&
    !cityInfoSite &&
    !state.selectedUnitId &&
    !inspectedTile
  const handlePreviewTileChange = useCallback(
    (tileKey?: string) => {
      setPreviewTileKey(canPreviewMapInfo ? tileKey : undefined)
    },
    [canPreviewMapInfo],
  )
  let sidebarContent: SidebarContent
  if (activeProductionUnitType) {
    sidebarContent = {
      kind: 'deployment',
      unitType: activeProductionUnitType,
    }
  } else if (cityInfoSite) {
    sidebarContent = { kind: 'site', site: cityInfoSite }
  } else if (selectedUnit) {
    sidebarContent = { kind: 'unit', unit: selectedUnit }
  } else if (inspectedTile) {
    sidebarContent = {
      kind: 'mapInfo',
      tile: inspectedTile,
      unit: getUnitAt(state, inspectedTile.position),
      site: getSiteAt(state, inspectedTile.position),
      preview: false,
    }
  } else if (canPreviewMapInfo && previewTile) {
    sidebarContent = {
      kind: 'mapInfo',
      tile: previewTile,
      unit: getUnitAt(state, previewTile.position),
      site: getSiteAt(state, previewTile.position),
      preview: true,
    }
  } else {
    sidebarContent = { kind: 'empty' }
  }
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
  const mobileInfoLabel = (() => {
    switch (sidebarContent.kind) {
      case 'deployment':
        return `${UNIT_TYPE_LABELS[sidebarContent.unitType]} 배치`
      case 'site':
        return sidebarContent.site.name
      case 'unit':
        return sidebarContent.unit.name
      case 'mapInfo':
        return (
          sidebarContent.unit?.name ??
          sidebarContent.site?.name ??
          TERRAIN_LABELS[sidebarContent.tile.terrain]
        )
      case 'empty':
        return '선택 정보'
    }
  })()
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
  const canEnterAttackMode =
    Boolean(selectedUnit) &&
    state.phase === 'playing' &&
    state.activeFactionId === state.humanFactionId &&
    !activeCombat &&
    !activeSiteAttack &&
    !activeProductionUnitType &&
    attackableUnits.length + attackableSites.length > 0
  const isAttackMode =
    canEnterAttackMode && activeAttackUnitId === selectedUnit?.id

  const foundingCandidateKeys = useMemo(() => {
    if (!selectedUnit) return new Set<string>()
    if (selectedUnit.type === 'settler') {
      return new Set(
        getSettleablePositions(state, selectedUnit.factionId).map(positionKey),
      )
    }
    if (selectedUnit.type === 'builder' && foundingKind && foundingKind !== 'village') {
      return new Set(
        getConstructiblePositions(
          state,
          selectedUnit.factionId,
          foundingKind,
        ).map(positionKey),
      )
    }
    return new Set<string>()
  }, [foundingKind, selectedUnit, state])

  useEffect(() => {
    if (
      hasCenteredInitialMapRef.current ||
      !mapScrollElement ||
      !playerCapitalPosition
    ) return

    const frame = window.requestAnimationFrame(() => {
      const capitalTile = mapScrollElement.querySelector<HTMLElement>(
        `.map-tile[data-coordinate="${positionKey(playerCapitalPosition)}"]`,
      )
      const mapContent = mapScrollElement.querySelector<HTMLElement>(
        '.map-zoom-shell',
      )
      if (!capitalTile || !mapContent) return

      const scrollBounds = mapScrollElement.getBoundingClientRect()
      const tileBounds = capitalTile.getBoundingClientRect()
      const mapBounds = mapContent.getBoundingClientRect()
      const mapFitsWidth = mapBounds.width <= mapScrollElement.clientWidth
      const mapFitsHeight = mapBounds.height <= mapScrollElement.clientHeight
      const horizontalFocusBounds = mapFitsWidth ? mapBounds : tileBounds
      const verticalFocusBounds = mapFitsHeight ? mapBounds : tileBounds

      const targetScrollLeft =
        mapScrollElement.scrollLeft +
          horizontalFocusBounds.left +
          horizontalFocusBounds.width / 2 -
          scrollBounds.left -
          mapScrollElement.clientWidth / 2
      const targetScrollTop =
        mapScrollElement.scrollTop +
          verticalFocusBounds.top +
          verticalFocusBounds.height / 2 -
          scrollBounds.top -
          mapScrollElement.clientHeight / 2

      const minimumScrollLeft =
        mapScrollElement.scrollLeft + mapBounds.left - scrollBounds.left
      const maximumScrollLeft =
        minimumScrollLeft + mapBounds.width - mapScrollElement.clientWidth
      const minimumScrollTop =
        mapScrollElement.scrollTop + mapBounds.top - scrollBounds.top
      const maximumScrollTop =
        minimumScrollTop + mapBounds.height - mapScrollElement.clientHeight

      mapScrollElement.scrollLeft = Math.max(
        0,
        mapFitsWidth
          ? targetScrollLeft
          : Math.min(
              maximumScrollLeft,
              Math.max(minimumScrollLeft, targetScrollLeft),
            ),
      )
      mapScrollElement.scrollTop = Math.max(
        0,
        mapFitsHeight
          ? targetScrollTop
          : Math.min(
              maximumScrollTop,
              Math.max(minimumScrollTop, targetScrollTop),
            ),
      )
      hasCenteredInitialMapRef.current = true
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
      setSiteAttackAnnouncement(undefined)
      setActiveMoveUnitId(undefined)
      setActiveAttackUnitId(undefined)
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
      setActiveAttackUnitId(undefined)
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
    saveSlot.value.gameState.gameMode === state.gameMode &&
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

    const result = loadGame(undefined, state.gameMode)
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
    closeCompactMinimap()
    setProductionSiteId(
      result.value.gameState.sites.find(
        (site) =>
          site.ownerId === result.value.gameState.humanFactionId &&
          SITE_STATS[site.kind].canProduce,
      )?.id ?? '',
    )
    hasCenteredInitialMapRef.current = false
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

    const result = deleteSavedGame(undefined, state.gameMode)
    if (!result.ok) {
      setSaveFeedback({ type: 'error', message: result.message })
      return
    }

    setSaveSlot(inspectSavedGame(undefined, state.gameMode))
    setSaveFeedback({ type: 'status', message: '저장된 게임을 삭제했습니다.' })
  }

  useEffect(() => {
    if (!activeCombat) {
      return
    }

    const timings = getCombatTimings(state.units, activeCombat.attackerId)
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
    const timings = getCombatTimings(state.units, activeSiteAttack.attackerId)
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
      const isNonMapInteractive =
        (target instanceof HTMLButtonElement &&
          !target.classList.contains('map-tile')) ||
        target instanceof HTMLAnchorElement

      if (
        event.key === 'Escape' &&
        (isMoveMode ||
          isAttackMode ||
          activeProductionUnitType ||
          foundingKind ||
          activeSiteTab === 'development' ||
          activeSiteTab === 'construction')
      ) {
        event.preventDefault()
        setActiveMoveUnitId(undefined)
        setActiveAttackUnitId(undefined)
        setProductionUnitType(undefined)
        setProductionFeedback(undefined)
        setFoundingKind(undefined)
        setActiveSiteTab(undefined)
        setDevelopmentFootprintIndex(0)
        openSidebarInfo()
        return
      }

      if (
        event.key === 'Escape' &&
        mobileInfoExpanded &&
        window.matchMedia(SIDEBAR_OVERLAY_QUERY).matches
      ) {
        event.preventDefault()
        setMobileInfoExpanded(false)
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
        isNonMapInteractive ||
        isMoveMode ||
        isAttackMode ||
        state.activeFactionId !== state.humanFactionId
      ) {
        return
      }

      event.preventDefault()
      setActiveMoveUnitId(undefined)
      setActiveAttackUnitId(undefined)
      setProductionUnitType(undefined)
      setFoundingKind(undefined)
      setActiveSiteTab(undefined)
      setDevelopmentFootprintIndex(0)
      setCityInfoSiteId(undefined)
      setPreviewTileKey(undefined)
      setInspectedTileKey(undefined)
      setMobileInfoExpanded(false)
      closeCompactMinimap()
      dispatch({ type: 'turnEnded' })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeCombat,
    activeSiteAttack,
    activeProductionUnitType,
    activeSiteTab,
    foundingKind,
    isMoveMode,
    isAttackMode,
    mobileInfoExpanded,
    openSidebarInfo,
    setFoundingKind,
    state.activeFactionId,
    state.humanFactionId,
    state.phase,
    closeCompactMinimap,
  ])

  const handleTileClick = useCallback((
    tile: Tile,
    activationSource: MapTileActivationSource,
  ) => {
    const unit = getUnitAt(state, tile.position)
    const site = getSiteAt(state, tile.position)
    const isDirectPointerAction =
      activationSource === 'touch' || activationSource === 'pen'

    if (activeCombat || activeSiteAttack) {
      return
    }

    if (state.activeFactionId !== state.humanFactionId) {
      openSidebarInfo()
      setActiveMoveUnitId(undefined)
      setProductionUnitType(undefined)
      setProductionFeedback(undefined)
      setActiveSiteTab(undefined)
      setDevelopmentFootprintIndex(0)
      dispatch({ type: 'selectionCleared' })
      if (site) {
        setInspectedTileKey(undefined)
        setCityInfoSiteId(site.id)
      } else {
        setCityInfoSiteId(undefined)
        setInspectedTileKey(positionKey(tile.position))
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

    if (isAttackMode) {
      return
    }

    if (selectedUnit && (isMoveMode || isDirectPointerAction)) {
      if (reachableKeys.has(positionKey(tile.position))) {
        dispatch({
          type: 'unitMoved',
          unitId: selectedUnit.id,
          destination: tile.position,
        })
        setActiveMoveUnitId(undefined)
        setInspectedTileKey(undefined)
        return
      }

      if (isMoveMode) {
        return
      }
    }

    if (unit?.factionId === state.humanFactionId) {
      setActiveAttackUnitId(undefined)
      if (isDirectPointerAction) {
        setMobileInfoExpanded(false)
        closeSidebarOverlayMinimap()
      } else {
        openSidebarInfo()
      }
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
      openSidebarInfo()
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
    openSidebarInfo()
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
    closeSidebarOverlayMinimap,
    deployableKeys,
    productionSite,
    reachableKeys,
    isMoveMode,
    isAttackMode,
    openSidebarInfo,
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
    state.units.length !== state.factionCount * STARTING_UNIT_TYPES.length ||
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
    if (
      confirmProgress &&
      hasProgress &&
      !window.confirm('현재 진행을 중단하고 새 랜덤 지도로 재시작할까요?')
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
    closeCompactMinimap()
    setProductionFeedback(undefined)
    setSaveFeedback(undefined)
    hasCenteredInitialMapRef.current = false
    dispatch(
      state.humanFactionId === 'player'
        ? { type: 'gameRestarted', seed }
        : {
            type: 'gameRestarted',
            seed,
            boardSize: state.boardSize,
            factionCount: state.factionCount,
            humanFactionId: state.humanFactionId,
            mapType: state.mapType,
            difficulty: state.difficulty,
            gameMode: state.gameMode,
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
        openMenu={openChromeMenu}
        onOpenMenuChange={setOpenChromeMenu}
        onRandomRestart={() => restartRandomGame(true)}
        savePanel={
          <SavePanel
            slot={saveSlot}
            canSave={canSave}
            canLoad={canLoad}
            canDelete={canDelete}
            hasBlockedLegacySave={hasBlockedLegacySave}
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
            {state.gameMode === 'quick' ? (
              <ol>
                <li>푸른 군사 유닛을 이동해 적 부대와 수도를 공격합니다.</li>
                <li>아군 도시에서 군사 유닛을 생산하고 중립 거점을 점령해 수입을 늘립니다.</li>
                <li>모든 행동 후 턴을 종료합니다. 상대 수도를 점령하면 승리합니다.</li>
              </ol>
            ) : (
              <ol>
                <li>푸른 유닛을 선택해 금색 칸으로 이동하거나 붉은 적을 공격합니다.</li>
                <li>아군 성을 선택해 생산하고, 상단 메뉴에서 재시작·저장을 엽니다.</li>
                <li>모든 행동 후 턴을 종료합니다. 상세 규칙은 README를 참고하세요.</li>
              </ol>
            )}
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
              income={getFactionIncome(state, state.humanFactionId)}
              upkeep={getFactionUpkeep(state, state.humanFactionId)}
              netIncome={getFactionNetIncome(state, state.humanFactionId)}
              upkeepReserve={getFactionUpkeepReserve(
                state,
                state.humanFactionId,
              )}
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
                closeCompactMinimap()
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
                    openSidebarInfo()
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
                  onClick={() => {
                    setActiveMoveUnitId(undefined)
                    openSidebarInfo()
                  }}
                >
                  취소 <kbd>Esc</kbd>
                </button>
              </section>
            )}
            {isAttackMode && selectedUnit && (
              <section
                className="deployment-bar attack-bar"
                aria-label="부대 공격"
              >
                <div className="deployment-bar__copy">
                  <strong>{selectedUnit.name} 공격</strong>
                  <span className="deployment-bar__message" role="status">
                    붉은 대상을 선택하세요.
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="부대 공격 취소"
                  onClick={() => {
                    setActiveAttackUnitId(undefined)
                    openSidebarInfo()
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
                className="map-scroll"
                ref={setMapScrollElement}
              >
                <GameMap
                  state={state}
                  territoryByKey={territoryByKey}
                  scrollElement={mapScrollElement}
                  zoom={mapZoom}
                  reachableKeys={isAttackMode ? EMPTY_TILE_KEYS : reachableKeys}
                  attackableKeys={attackableKeys}
                  attackableSiteKeys={attackableSiteKeys}
                  deployableKeys={deployableKeys}
                  developmentFootprintKeys={developmentFootprintKeys}
                  foundingCandidateKeys={foundingCandidateKeys}
                  selectedDevelopmentFootprintKeys={
                    selectedDevelopmentFootprintKeys
                  }
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
                  onPreviewTileChange={handlePreviewTileChange}
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
                  minimapExpanded ? ' map-minimap-dock--expanded' : ''
                }`}
              >
                <button
                  type="button"
                  className="map-minimap-dock__toggle"
                  aria-label={
                    minimapExpanded ? '미니맵 닫기' : '미니맵 열기'
                  }
                  aria-expanded={minimapExpanded}
                  aria-controls="map-minimap"
                  title={
                    minimapExpanded ? '미니맵 닫기' : '미니맵 열기'
                  }
                  onClick={() => {
                    const expanded = !minimapExpanded
                    setMinimapExpanded(expanded)
                    if (expanded) setMobileInfoExpanded(false)
                  }}
                >
                  <span className="map-minimap-dock__label">미니맵</span>
                  {minimapExpanded ? (
                    <svg
                      className="map-minimap-dock__icon map-minimap-dock__icon--collapse"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                    </svg>
                  ) : (
                    <svg
                      className="map-minimap-dock__icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M3 5 8 3l6 2 7-3v17l-7 3-6-2-5 2Z" />
                      <path d="M8 3v17" />
                      <path d="M14 5v17" />
                    </svg>
                  )}
                </button>
                <div id="map-minimap" className="map-minimap-dock__body">
                  <Minimap
                    state={state}
                    territoryByKey={territoryByKey}
                    scrollElement={mapScrollElement}
                    selectedSiteId={cityInfoSite?.id}
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
                    if (expanded) closeSidebarOverlayMinimap()
                  }}
                >
                  <span className="mobile-info-sheet__handle" aria-hidden="true" />
                  <span>{mobileInfoLabel}</span>
                </button>
                <div
                  id="mobile-info-sheet-body"
                  className="mobile-info-sheet__body"
                >
                {sidebarContent.kind === 'site' && (
                  <CityPanel
                    site={sidebarContent.site}
                    tile={tileIndex.get(positionKey(sidebarContent.site.position))!}
                    gameMode={state.gameMode}
                    activeTab={activeSiteTab}
                    showProductionSupport={
                      sidebarContent.site.ownerId === state.humanFactionId &&
                      sidebarContent.site.foundedBy !== undefined &&
                      (sidebarContent.site.kind === 'farm' ||
                        sidebarContent.site.kind === 'mine' ||
                        sidebarContent.site.kind === 'blacksmith')
                    }
                    productionSupport={cityInfoProductionSupport}
                    settlementCapacity={cityInfoSettlementCapacity}
                    canProduce={
                      state.activeFactionId === state.humanFactionId &&
                      sidebarContent.site.ownerId === state.humanFactionId &&
                      SITE_STATS[sidebarContent.site.kind].canProduce
                    }
                    onTabChange={(tab) => {
                      setActiveSiteTab(tab)
                      setDevelopmentFootprintIndex(0)
                      setProductionUnitType(undefined)
                      setProductionFeedback(undefined)
                      if (tab === 'production') {
                        setProductionSiteId(sidebarContent.site.id)
                      }
                    }}
                    onClose={() => {
                      setCityInfoSiteId(undefined)
                      setMobileInfoExpanded(false)
                      setActiveSiteTab(undefined)
                      setDevelopmentFootprintIndex(0)
                      setProductionUnitType(undefined)
                      setProductionFeedback(undefined)
                      dispatch({ type: 'selectionCleared' })
                    }}
                  >
                    {activeSiteTab === 'production' && (
                      <ProductionPanel
                        site={productionSite}
                        state={state}
                        selectedUnitType={activeProductionUnitType}
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
                          openSidebarInfo()
                        }}
                      />
                    )}
                    {state.gameMode === 'standard' &&
                      activeSiteTab === 'development' && (
                      <DevelopmentPanel
                        state={state}
                        site={sidebarContent.site}
                        footprints={developmentFootprints}
                        selectedFootprintIndex={developmentFootprintIndex}
                        onFootprintSelected={setDevelopmentFootprintIndex}
                        onDevelop={() => {
                          dispatch({
                            type: 'siteDeveloped',
                            siteId: sidebarContent.site.id,
                            footprint: selectedDevelopmentFootprint,
                          })
                          setActiveSiteTab(undefined)
                          setDevelopmentFootprintIndex(0)
                        }}
                      />
                    )}
                    {state.gameMode === 'standard' &&
                      activeSiteTab === 'construction' &&
                      sidebarContent.site.kind === 'city' && (
                        <ConstructionPanel
                          state={state}
                          site={sidebarContent.site}
                          onStart={(buildingId) => {
                            dispatch({
                              type: 'constructionStarted',
                              siteId: sidebarContent.site.id,
                              buildingId,
                            })
                          }}
                          onCancel={() => {
                            dispatch({
                              type: 'constructionCancelled',
                              siteId: sidebarContent.site.id,
                            })
                          }}
                        />
                      )}
                  </CityPanel>
                )}
                {sidebarContent.kind === 'unit' && (
                  <InfoPanel
                    state={state}
                    unit={sidebarContent.unit}
                    canMove={canEnterMoveMode}
                    moveMode={isMoveMode}
                    canAttack={canEnterAttackMode}
                    attackMode={isAttackMode}
                    canDisband={
                      state.phase === 'playing' &&
                      state.activeFactionId === state.humanFactionId &&
                      sidebarContent.unit.factionId === state.humanFactionId &&
                      !activeCombat &&
                      !activeSiteAttack
                    }
                    onMoveModeChange={(active) => {
                      setActiveAttackUnitId(undefined)
                      setActiveMoveUnitId(
                        active ? sidebarContent.unit.id : undefined,
                      )
                      if (active) setMobileInfoExpanded(false)
                    }}
                    onAttackModeChange={(active) => {
                      setActiveMoveUnitId(undefined)
                      setActiveAttackUnitId(
                        active ? sidebarContent.unit.id : undefined,
                      )
                      if (active) setMobileInfoExpanded(false)
                    }}
                    onDisband={() => {
                      if (
                        !window.confirm(
                          `${sidebarContent.unit.name}을 해산할까요? 자원은 환불되지 않습니다.`,
                        )
                      ) {
                        return
                      }
                      setActiveMoveUnitId(undefined)
                      setActiveAttackUnitId(undefined)
                      dispatch({
                        type: 'unitDisbanded',
                        unitId: sidebarContent.unit.id,
                      })
                    }}
                    foundingKind={foundingKind}
                    onFoundingKindSelected={(kind) => {
                      setFoundingKind(kind)
                      setActiveMoveUnitId(undefined)
                      setActiveAttackUnitId(undefined)
                    }}
                    onFoundingCancel={() => setFoundingKind(undefined)}
                    onFoundingConfirm={() => {
                      if (foundingKind === 'village') {
                        dispatch({
                          type: 'siteSettled',
                          unitId: sidebarContent.unit.id,
                        })
                      } else if (foundingKind) {
                        dispatch({
                          type: 'siteConstructed',
                          unitId: sidebarContent.unit.id,
                          siteKind: foundingKind,
                        })
                      }
                      setFoundingKind(undefined)
                      setActiveMoveUnitId(undefined)
                      setActiveAttackUnitId(undefined)
                    }}
                    onClose={() => {
                      setActiveMoveUnitId(undefined)
                      setFoundingKind(undefined)
                      setMobileInfoExpanded(false)
                      dispatch({ type: 'selectionCleared' })
                    }}
                  />
                )}
                {sidebarContent.kind === 'deployment' && (
                  <div className="empty-selection empty-selection--compact">
                    <span aria-hidden="true">⌖</span>
                    <p>지도에서 청록색 배치 타일을 선택하세요.</p>
                  </div>
                )}
                {sidebarContent.kind === 'mapInfo' && (
                  <MapInfoPanel
                    tile={sidebarContent.tile}
                    mapSeed={state.mapSeed}
                    unit={sidebarContent.unit}
                    site={sidebarContent.site}
                    territoryOwner={territoryByKey.get(
                      positionKey(sidebarContent.tile.position),
                    )}
                    preview={sidebarContent.preview}
                    onClose={
                      sidebarContent.preview
                        ? undefined
                        : () => {
                            setInspectedTileKey(undefined)
                            setMobileInfoExpanded(false)
                            dispatch({ type: 'selectionCleared' })
                          }
                    }
                  />
                )}
                {sidebarContent.kind === 'empty' && (
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
  const gameMode = resolveGameMode(window.location.hostname, window.location.search)
  const [gameState, setGameState] = useState<GameState | undefined>(() =>
    initialState ??
    (gameMode === 'quick'
      ? createInitialGameState(createRandomMapSeed(), {
          boardSize: BOARD_SIZE_PRESETS.tiny,
          factionCount: 2,
          humanFactionId: 'f1',
          mapType: 'balanced',
          difficulty: 'normal',
          gameMode: 'quick',
        })
      : undefined),
  )

  if (!gameState) {
    return (
      <StartScreen
        onStart={({ seed, boardSize, factionCount, humanFactionId, mapType, difficulty }) => {
          setGameState(
            createInitialGameState(seed, {
              boardSize,
              factionCount,
              humanFactionId,
              mapType,
              difficulty,
              gameMode: 'standard',
            }),
          )
        }}
      />
    )
  }

  return <GameApp initialState={gameState} />
}

export default App
