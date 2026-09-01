/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { FactionId, Site, SiteOwnerId, SiteType, Terrain, Unit, UnitType } from '../game/types'

export type Locale = 'ko' | 'en'
type Params = Record<string, string | number>

const ko = {
  restart: '재시작', save: '저장', help: '도움말', language: '언어',
  gameStatus: '현재 게임 상태', turn: '턴 {turn}', resourcesIncome: '자원 {resource}, 턴 순수입 {income}',
  economyDetails: '경제 상세', income: '수입', upkeep: '유지비', netIncome: '순수입', reservedUpkeep: '예약 유지비',
  aiOperating: 'AI 작전 중…', endTurn: '턴 종료', strategyMap: '전략 지도',
  unitInfo: '부대 정보', closeUnitInfo: '부대 정보 닫기', health: '체력', move: '이동', role: '역할', nonCombat: '비전투', melee: '근접', ranged: '원거리', attack: '공격', unitMenu: '유닛 메뉴',
  moveReady: '이동할 타일을 선택합니다.', moveUnavailable: '이동 가능한 타일이 없습니다.', attackReady: '공격할 대상을 선택합니다.', attackUnavailable: '공격 가능한 대상이 없습니다.',
  siteInfo: '거점 정보', closeSiteInfo: '거점 정보 닫기', owner: '소유자', terrain: '지형', movementCost: '이동 비용', impassable: '통과 불가', defenseBonus: '방어 보정치', defense: '방어력', none: '없음', siteMenu: '거점 메뉴', production: '생산', unitProduction: '부대 생산',
  supportedProductionSites: '지원 생산 거점', supportingSettlement: '지원 정착지', supportStatus: '지원 현황',
  militaryUnits: '군사 유닛', civilianUnits: '민간 유닛', resources: '{cost} 자원', insufficientResources: '자원이 부족합니다.',
  upkeepReserveRequired: '다음 유지비 {reserve} 자원을 남겨야 합니다.',
  militaryStats: '이동 {move} · 근접 {melee}{ranged} · 사거리 {range}', civilianStats: '이동 {move} · 비전투 · 유지비 {upkeep}', rangedStat: ' · 원거리 {ranged}',
  deployPrompt: '청록색 타일에 배치하세요.', productionDone: '이번 라운드 생산 완료', noDeployTile: '배치 가능한 타일 없음', noProductionSite: '생산 가능한 거점이 없습니다.', cancel: '취소',
  tileInfo: '타일 정보', mapPreview: '지도 정보 미리보기', closeTileInfo: '타일 정보 닫기', site: '거점', siteLevel: '거점 단계', siteHealth: '거점 체력',
  minimap: '미니맵', openMinimap: '미니맵 열기', closeMinimap: '미니맵 닫기', selectionInfo: '선택 정보', mapHint: '지도 타일을 가리키거나 선택하면 상세 정보가 표시됩니다.',
  zoomControls: '지도 확대/축소', zoomOut: '지도 축소', zoomIn: '지도 확대', currentZoom: '현재 지도 배율', fitMap: '지도를 화면에 맞춤', fit: '맞춤', mapSidebar: '지도 사이드바',
  saveManagement: '저장 관리', savedTurn: '{turn}턴 저장', noSavedGame: '저장된 게임 없음', saveNeedsCheck: '저장 확인 필요', load: '불러오기', delete: '삭제', legacySaveBlocked: '기존 전체모드 저장은 보존되어 있지만 빠른대전에서는 불러올 수 없습니다.',
  saved: '게임을 저장했습니다.', loaded: '저장된 게임을 불러왔습니다.', deleted: '저장된 게임을 삭제했습니다.', confirmLoad: '현재 진행을 중단하고 저장된 게임을 불러올까요?', confirmDelete: '저장된 게임을 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
  firstTurn: '첫 턴 안내', firstTurnIntro: '세 가지만 기억하고 전투를 시작하세요.', selectUnit: '부대 선택', selectUnitHelp: '지도에서 아군 유닛을 선택하세요.', moveAttack: '이동·공격', moveAttackHelp: '금색 칸은 우클릭으로 이동하고 붉은 대상은 좌클릭해 공격합니다.', produceWin: '병력 생산·승리', produceWinHelp: '도시에서 병력을 생산하고 상대 수도를 점령하세요.', details: '자세히 보기', startGame: '게임 시작', showFirstTurnGuide: '첫 턴 안내 다시 보기',
  helpItems: '도움말 항목', controls: '조작', rules: '규칙', legend: '범례', credits: '크레딧', basicControls: '기본 조작', shortcuts: '단축키', movementCombat: '이동·전투', productionEconomy: '생산·경제', victoryConditions: '승리 조건', terrainTiles: '지형 타일', project: '프로젝트', developer: '개발', sourceAndHistory: '소스 코드와 개발 기록', githubRepository: 'GitHub 저장소',
  creditsBased: '편집·변형 기반 자산', creditsCreator: '제작자', creditsLicense: '라이선스',
  controlSelect: '아군 유닛을 선택한 뒤 이동 또는 공격 명령을 선택하세요.', controlMoveAttack: '금색 칸은 이동 가능 범위이며 우클릭으로 이동합니다. 붉은 표시는 공격 가능 대상으로 좌클릭해 공격합니다.', mapNavigation: '지도를 드래그해 이동하고 마우스 휠이나 핀치로 확대·축소합니다.', shortcutEnd: '현재 턴 종료', quickShortcutCancel: '선택 중인 이동·공격·생산 취소', shortcutCancel: '선택 중인 이동·공격·생산·정착·발전·건설 취소',
  zoneOfControl: '적 통제 구역에 진입하면 추가 이동이 멈춥니다.', quickProduce: '도시에서 군사 유닛을 생산하고 청록색 칸에 배치하세요.', quickCaptureIncome: '중립 농장·광산·대장간으로 이동해 점령하면 턴 수입이 늘어납니다.', economyHelp: '상태바의 자원을 선택하면 수입·유지비·순수입을 확인할 수 있습니다.', captureCapital: '상대 수도를 점령하면 승리합니다.', loseCapital: '내 수도를 빼앗기면 패배합니다.',
  mapLegend: '지도 범례', friendlyCapture: '아군 거점', enemyCapture: '적 거점', friendlyTerritory: '아군 영토', enemyTerritory: '적 영토', contested: '분쟁 지역', reachable: '이동 가능', moveCommand: '이동 명령 또는 우클릭', attackable: '공격 가능', deployable: '생산 배치 가능', cost: '비용 {cost}', costCombat: '비용 {cost} · 전투력 +3', noMove: '이동 불가', siteIncome: '수입 {income}', cityIncome: '수입 {income} · 생산', smithyIncome: '수입 {income} · 군사 생산비 할인',
  victory: '승리', defeat: '패배', victoryHeading: '대륙 통일', defeatHeading: '수도 함락', victoryDescription: '푸른 연맹이 모든 거점을 점령했습니다.', defeatDescription: '붉은 제국이 모든 거점을 점령했습니다.', resultTurns: '{turn}턴 만에 {result}', restartSame: '같은 지도에서 다시 시작', restartNew: '새 지도에서 시작',
  restartTitle: '새 지도로 재시작할까요?', restartDescription: '현재 진행 내용은 사라지며, 새로운 랜덤 지도로 게임을 다시 시작합니다.', restartConfirm: '새 지도로 재시작',
  chooseDeploy: '청록색 타일을 선택하세요.', deploymentMapHint: '지도에서 청록색 배치 타일을 선택하세요.', chooseMove: '금색 타일을 선택하세요.', chooseAttack: '붉은 대상을 선택하세요.', deployUnit: '{unit} 배치', moveUnit: '{unit} 이동', attackUnit: '{unit} 공격', deployArea: '부대 배치', moveArea: '부대 이동', attackArea: '부대 공격', defensiveSite: '방어 거점',
  aiFinished: 'AI 작전이 끝났습니다.', aiMove: '{unit} 이동', aiWait: '{unit} 대기', aiReady: '{unit} 작전 준비', aiAttack: '{attacker}이 {defender}을 공격합니다.', aiAttackFallback: 'AI 공격', siteDamage: '{site}에 {damage} 피해', siteCaptured: '{site}에 {damage} 피해, {site} 점령', producedAt: '{site}에서 {unit}을 생산합니다.',
  invalidDeploy: '선택한 타일에는 부대를 배치할 수 없습니다.', combat: '전투 중', combatBothDamage: '양쪽이 각각 {defender}, {attacker} 피해를 받았습니다', combatDefenderDamage: '방어 유닛이 {damage} 피해를 받았습니다',
  disbandConfirm: '{unit}을 해산할까요? 자원은 환불되지 않습니다.',
  aiSiteAttack: 'AI 거점 공격', developSite: '{site}을 {target}(으)로 발전시킵니다.', aiDevelop: 'AI가 거점을 발전시킵니다.', disbandUnit: '{unit}을 유지비 절감을 위해 해산합니다.', aiDisband: 'AI가 부대를 해산합니다.', constructionStart: '{site}에 {building} 건설을 시작합니다.', aiConstructionCancel: 'AI가 건설을 취소합니다.', genericSite: '거점', genericCity: '도시',
  hexCoordinate: '육각 좌표 {q}, {r}', territoryContested: '영토 분쟁 지역', territoryOwned: '{faction} 영토', unclaimed: '미편입 지역', settleBuild: '정착·건설 가능', developmentSelected: '선택한 발전 영역', developmentCandidate: '발전 영역 후보', actionDone: '행동 완료', actionReady: '행동 가능', attackOnly: '공격만 가능',
} as const

type TranslationKey = keyof typeof ko
type TranslationTable = Record<TranslationKey, string>

const en: TranslationTable = {
  restart: 'Restart', save: 'Save', help: 'Help', language: 'Language', gameStatus: 'Current game status', turn: 'Turn {turn}', resourcesIncome: 'Resources {resource}, net income {income} this turn', economyDetails: 'Economy details', income: 'Income', upkeep: 'Upkeep', netIncome: 'Net income', reservedUpkeep: 'Reserved upkeep', aiOperating: 'AI operating…', endTurn: 'End Turn', strategyMap: 'Strategy map',
  unitInfo: 'Unit information', closeUnitInfo: 'Close unit information', health: 'Health', move: 'Move', role: 'Role', nonCombat: 'Non-combat', melee: 'Melee', ranged: 'Ranged', attack: 'Attack', unitMenu: 'Unit commands', moveReady: 'Select a destination tile.', moveUnavailable: 'No reachable tiles.', attackReady: 'Select a target to attack.', attackUnavailable: 'No targets in range.',
  siteInfo: 'Site information', closeSiteInfo: 'Close site information', owner: 'Owner', terrain: 'Terrain', movementCost: 'Movement cost', impassable: 'Impassable', defenseBonus: 'Defense bonus', defense: 'Defense', none: 'None', siteMenu: 'Site commands', production: 'Production', unitProduction: 'Unit production', supportedProductionSites: 'Supported production sites', supportingSettlement: 'Supporting settlement', supportStatus: 'Support status', militaryUnits: 'Military units', civilianUnits: 'Civilian units', resources: '{cost} resources', insufficientResources: 'Not enough resources.', upkeepReserveRequired: 'Keep {reserve} resources for the next upkeep payment.', militaryStats: 'Move {move} · Melee {melee}{ranged} · Range {range}', civilianStats: 'Move {move} · Non-combat · Upkeep {upkeep}', rangedStat: ' · Ranged {ranged}', deployPrompt: 'Deploy on a teal tile.', productionDone: 'Production complete this round', noDeployTile: 'No deployment tiles available', noProductionSite: 'No production site is available.', cancel: 'Cancel',
  tileInfo: 'Tile information', mapPreview: 'Map information preview', closeTileInfo: 'Close tile information', site: 'Site', siteLevel: 'Site level', siteHealth: 'Site health', minimap: 'Minimap', openMinimap: 'Open minimap', closeMinimap: 'Close minimap', selectionInfo: 'Selection information', mapHint: 'Hover over or select a map tile to see details.', zoomControls: 'Map zoom controls', zoomOut: 'Zoom out', zoomIn: 'Zoom in', currentZoom: 'Current map zoom', fitMap: 'Fit map to screen', fit: 'Fit', mapSidebar: 'Map sidebar',
  saveManagement: 'Save Management', savedTurn: 'Saved on turn {turn}', noSavedGame: 'No saved game', saveNeedsCheck: 'Save requires attention', load: 'Load', delete: 'Delete', legacySaveBlocked: 'Your standard-mode save is preserved but cannot be loaded in Quick Match.', saved: 'Game saved.', loaded: 'Saved game loaded.', deleted: 'Saved game deleted.', confirmLoad: 'Stop the current game and load the saved game?', confirmDelete: 'Delete the saved game? This cannot be undone.',
  firstTurn: 'First Turn Guide', firstTurnIntro: 'Remember these three things and begin the battle.', selectUnit: 'Select a unit', selectUnitHelp: 'Select one of your units on the map.', moveAttack: 'Move & Attack', moveAttackHelp: 'Right-click gold tiles to move and left-click red targets to attack.', produceWin: 'Produce & Win', produceWinHelp: 'Produce troops in your city and capture the enemy capital.', details: 'View Details', startGame: 'Start Game', showFirstTurnGuide: 'Show First Turn Guide Again',
  helpItems: 'Help topics', controls: 'Controls', rules: 'Rules', legend: 'Legend', credits: 'Credits', basicControls: 'Basic Controls', shortcuts: 'Shortcuts', movementCombat: 'Movement & Combat', productionEconomy: 'Production & Economy', victoryConditions: 'Victory Conditions', terrainTiles: 'Terrain Tiles', project: 'Project', developer: 'Developer', sourceAndHistory: 'Source code and development history', githubRepository: 'GitHub repository', controlSelect: 'Select one of your units, then choose the Move or Attack command.', controlMoveAttack: 'Gold tiles are reachable; right-click to move. Red markers are attackable targets; left-click to attack.', mapNavigation: 'Drag the map to pan, and use the mouse wheel or pinch gesture to zoom.', shortcutEnd: 'End the current turn', quickShortcutCancel: 'Cancel the selected move, attack, or production command', shortcutCancel: 'Cancel the selected move, attack, production, settlement, development, or construction command', zoneOfControl: 'Entering an enemy zone of control ends further movement.', quickProduce: 'Produce military units in your city and deploy them on teal tiles.', quickCaptureIncome: 'Capture neutral farms, mines, and blacksmiths to increase turn income.', economyHelp: 'Select resources in the status bar to view income, upkeep, and net income.', captureCapital: 'Capture the enemy capital to win.', loseCapital: 'Lose your capital and you are defeated.',
  creditsBased: 'Adapted from', creditsCreator: 'Creator', creditsLicense: 'License',
  mapLegend: 'Map Legend', friendlyCapture: 'Friendly site', enemyCapture: 'Enemy site', friendlyTerritory: 'Friendly territory', enemyTerritory: 'Enemy territory', contested: 'Contested territory', reachable: 'Reachable', moveCommand: 'Move command or right-click', attackable: 'Attackable', deployable: 'Production deployment', cost: 'Cost {cost}', costCombat: 'Cost {cost} · Combat +3', noMove: 'Impassable', siteIncome: 'Income {income}', cityIncome: 'Income {income} · Production', smithyIncome: 'Income {income} · Military production discount',
  victory: 'Victory', defeat: 'Defeat', victoryHeading: 'Continent United', defeatHeading: 'Capital Fallen', victoryDescription: 'The Blue Alliance has captured every strategic site.', defeatDescription: 'The Red Empire has captured every strategic site.', resultTurns: '{result} in {turn} turns', restartSame: 'Restart on Same Map', restartNew: 'Start on New Map', restartTitle: 'Restart on a new map?', restartDescription: 'Current progress will be lost and a new game will begin on a random map.', restartConfirm: 'Restart on New Map',
  chooseDeploy: 'Select a teal deployment tile.', deploymentMapHint: 'Select a teal deployment tile on the map.', chooseMove: 'Select a gold destination tile.', chooseAttack: 'Select a red target.', deployUnit: 'Deploy {unit}', moveUnit: 'Move {unit}', attackUnit: 'Attack with {unit}', deployArea: 'Unit deployment', moveArea: 'Unit movement', attackArea: 'Unit attack', defensiveSite: 'Defensive site', aiFinished: 'AI operation complete.', aiMove: '{unit} moves', aiWait: '{unit} waits', aiReady: '{unit} prepares to act', aiAttack: '{attacker} attacks {defender}.', aiAttackFallback: 'AI attack', siteDamage: '{site} takes {damage} damage', siteCaptured: '{site} takes {damage} damage and is captured', producedAt: '{site} produces {unit}.', invalidDeploy: 'A unit cannot be deployed on the selected tile.', combat: 'Combat in progress', combatBothDamage: 'Defender takes {defender} damage; attacker takes {attacker} damage', combatDefenderDamage: 'Defender takes {damage} damage', disbandConfirm: 'Disband {unit}? Resources will not be refunded.', aiSiteAttack: 'AI site attack', developSite: 'Developing {site} into a {target}.', aiDevelop: 'AI develops a site.', disbandUnit: 'Disbanding {unit} to reduce upkeep.', aiDisband: 'AI disbands a unit.', constructionStart: 'Starting construction of {building} at {site}.', aiConstructionCancel: 'AI cancels construction.', genericSite: 'site', genericCity: 'city', hexCoordinate: 'Hex coordinates {q}, {r}', territoryContested: 'Contested territory', territoryOwned: '{faction} territory', unclaimed: 'Unclaimed territory', settleBuild: 'Settlement or construction available', developmentSelected: 'Selected development area', developmentCandidate: 'Development area candidate', actionDone: 'Action complete', actionReady: 'Ready to act', attackOnly: 'Attack only',
}

const UNIT_LABELS: Record<Locale, Record<UnitType, string>> = {
  ko: { infantry: '보병', cavalry: '기병', archer: '궁병', spearman: '창병', settler: '개척자', builder: '건설자' },
  en: { infantry: 'Infantry', cavalry: 'Cavalry', archer: 'Archer', spearman: 'Spearman', settler: 'Settler', builder: 'Builder' },
}
const SITE_LABELS: Record<Locale, Record<SiteType, string>> = {
  ko: { outpost: '전초기지', keep: '요새', stronghold: '성채', village: '마을', town: '소도시', city: '도시', farm: '농장', mine: '광산', blacksmith: '대장간' },
  en: { outpost: 'Outpost', keep: 'Keep', stronghold: 'Stronghold', village: 'Village', town: 'Town', city: 'City', farm: 'Farm', mine: 'Mine', blacksmith: 'Blacksmith' },
}
const TERRAIN_LABELS: Record<Locale, Record<Terrain, string>> = {
  ko: { plain: '평지', bridge: '다리', mountain: '산', water: '물', hill: '언덕', forest: '숲', desert: '사막', desertHill: '사막 언덕', oasis: '오아시스', tundra: '툰드라', tundraForest: '툰드라 숲', tundraMountain: '툰드라 산' },
  en: { plain: 'Plain', bridge: 'Bridge', mountain: 'Mountain', water: 'Water', hill: 'Hill', forest: 'Forest', desert: 'Desert', desertHill: 'Desert Hill', oasis: 'Oasis', tundra: 'Tundra', tundraForest: 'Tundra Forest', tundraMountain: 'Tundra Mountain' },
}
const FACTION_LABELS: Record<Locale, Record<SiteOwnerId, string>> = {
  ko: { player: '푸른 연맹', enemy: '붉은 제국', f1: '청색 연맹', f2: '적색 제국', f3: '황금 왕국', f4: '자색 공국', neutral: '중립' },
  en: { player: 'Blue Alliance', enemy: 'Red Empire', f1: 'Blue Alliance', f2: 'Red Empire', f3: 'Golden Kingdom', f4: 'Violet Duchy', neutral: 'Neutral' },
}
const EN_UNIT_NAMES: Record<string, string> = {
  '청룡 보병대': 'Azure Dragon Infantry', '백호 보병대': 'White Tiger Infantry', '바람 기병대': 'Gale Cavalry', '청색 궁병대': 'Blue Archers', '청색 창병대': 'Blue Spearmen',
  '적월 보병대': 'Red Moon Infantry', '철창 보병대': 'Iron Spear Infantry', '흑염 기병대': 'Black Flame Cavalry', '적색 궁병대': 'Red Archers', '적색 창병대': 'Red Spearmen',
}
const FACTION_ADJECTIVES: Record<FactionId, string> = { player: 'Blue', enemy: 'Red', f1: 'Blue', f2: 'Red', f3: 'Golden', f4: 'Violet' }

function interpolate(
  template: string,
  params?: Params,
  formatNumber: (value: number) => string = String,
) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    return typeof value === 'number'
      ? formatNumber(value)
      : String(value ?? `{${key}}`)
  })
}

export type Localization = {
  locale: Locale
  t: (key: TranslationKey, params?: Params) => string
  unitLabel: (type: UnitType) => string
  siteLabel: (type: SiteType) => string
  terrainLabel: (terrain: Terrain) => string
  factionLabel: (id: SiteOwnerId) => string
  unitName: (unit: Unit) => string
  siteName: (site: Site) => string
  formatNumber: (value: number) => string
}

function createLocalization(locale: Locale): Localization {
  const numberFormatter = new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US')
  const formatNumber = (value: number) => numberFormatter.format(value)
  const t = (key: TranslationKey, params?: Params) =>
    interpolate((locale === 'ko' ? ko : en)[key], params, formatNumber)
  const unitName = (unit: Unit) => {
    if (locale === 'ko') return unit.name
    if (EN_UNIT_NAMES[unit.name]) return EN_UNIT_NAMES[unit.name]
    const produced = unit.id.match(
      /^(player|enemy|f[1-4])-[a-z]+-produced-(\d+)$/,
    )
    return produced
      ? `${FACTION_ADJECTIVES[unit.factionId]} ${UNIT_LABELS.en[unit.type]} ${produced[2]}`
      : unit.name
  }
  const siteName = (site: Site) => {
    if (locale === 'ko') return site.name
    if (site.capitalFor) return `${FACTION_ADJECTIVES[site.capitalFor]} City`
    if (site.ownerId === 'neutral') {
      const sequence = site.name.match(/(\d+)$/)?.[1]
      return `Neutral ${SITE_LABELS.en[site.kind]}${sequence ? ` ${sequence}` : ''}`
    }
    return site.name
  }
  return {
    locale,
    t,
    unitLabel: (type) => UNIT_LABELS[locale][type],
    siteLabel: (type) => SITE_LABELS[locale][type],
    terrainLabel: (terrain) => TERRAIN_LABELS[locale][terrain],
    factionLabel: (id) => FACTION_LABELS[locale][id],
    unitName,
    siteName,
    formatNumber,
  }
}

const LocalizationContext = createContext<Localization>(createLocalization('ko'))

export function LocalizationProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => createLocalization(locale), [locale])
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}

export function useLocalization() {
  return useContext(LocalizationContext)
}

export const QUICK_LOCALE_STORAGE_KEY = 'min2world:quick:locale:v1'

export function resolveQuickLocale(storage: Pick<Storage, 'getItem'> | undefined, languages: readonly string[] = []): Locale {
  try {
    const stored = storage?.getItem(QUICK_LOCALE_STORAGE_KEY)
    if (stored === 'ko' || stored === 'en') return stored
  } catch { /* fall through to browser language */ }
  return languages[0]?.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export function persistQuickLocale(locale: Locale, storage: Pick<Storage, 'setItem'> | undefined) {
  try { storage?.setItem(QUICK_LOCALE_STORAGE_KEY, locale); return true } catch { return false }
}
