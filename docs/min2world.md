# min2world 개발 계획

## 1. 프로젝트 목표

`min2world`는 문명, 삼국지, 대전략에서 아이디어를 얻은 **싱글 플레이 웹 턴제 전략 시뮬레이션 게임**이다.

이 프로젝트의 우선순위는 다음과 같다.

1. 1인 개발 범위 안에서 작지만 완결된 전략 게임을 만든다.
2. 게임을 만들면서 React와 TypeScript를 실전 수준으로 익힌다.
3. 컴포넌트 설계, 상태 관리, 비즈니스 로직 분리, 테스트 경험을 `wizard-web` 개발에 활용한다.

대형 4X 게임을 그대로 재현하는 것이 목표는 아니다. 첫 번째 성공 기준은 제한된 규칙을 가진 게임 한 판을 시작부터 승리 또는 패배까지 플레이할 수 있는 것이다. 이 기준은 Milestone 01–05에서 충족했고, Milestone 06에서 육각 무작위 지도로 확장했으며, Milestone 07–08에서 메인 UI·가변 지도·다세력·조작을 다듬었다. Milestone 09에서는 온도 축과 사막·툰드라 기후대를 추가하고 후속 작업으로 세부 지형과 래스터 표현을 확장했다.

현재 구현과 조작 안내는 [루트 README](../README.md), 단계별 기록은 [개발 마일스톤](milestones/README.md)을 따른다. 완료된 마일스톤 문서는 덮어쓰지 않는다.

## 2. 게임 방향

세 작품군의 특징을 다음과 같이 축소해서 결합한다.

- 문명: 타일 기반 지도와 영토 확장
- 삼국지: 세력, 거점, 장수로 확장할 수 있는 데이터 구조
- 대전략: 턴제 유닛 이동, 전투, 거점 점령

초기 버전은 그래픽 연출보다 게임 규칙과 UI에 집중했다. 첫 MVP는 사각 타일로 시작했고, Milestone 06에서 육각 좌표와 seed 기반 무작위 지도로 전환했다. 장수·외교·기술 연구 같은 기능은 핵심 게임이 완성된 뒤 추가한다.

### 지원 화면과 UI 원칙

`min2world`는 여러 육각 타일과 상태 정보, 미니맵, 부대·거점 명령을 함께 확인하는 전략 게임이므로 **데스크톱을 주 플레이 환경이자 UI 설계 기준으로 삼는다.** 데스크톱의 정보량과 전략성을 모바일 대응 때문에 축소하지 않는다.

모바일 지원을 제거하지는 않는다. 현재 구현된 터치 팬·핀치 줌, 지도 맞춤, 접이식 미니맵, 하단 선택 정보 시트와 반응형 레이아웃을 유지해 휴대폰에서도 핵심 플레이와 한 판의 진행이 가능하도록 한다. 다만 게임성이 확정되기 전에는 휴대폰 중심의 별도 UI 재설계에 투자하지 않는다.

화면별 지원 목표는 다음과 같다.

- 데스크톱: 모든 기능과 조작을 제공하는 정식 플레이 환경
- 태블릿 가로 화면: 가능한 한 데스크톱과 동등한 플레이 지원
- 휴대폰: 핵심 플레이가 가능하고 진행이 막히지 않는 기본 호환 환경

반응형 UI는 다음 기준을 지킨다.

- 필수 정보나 행동을 호버 또는 우클릭에만 의존하지 않는다.
- 주요 터치 대상은 가급적 최소 `44px` 크기를 확보한다.
- `390px` 너비에서 레이아웃이 깨지거나 게임 진행이 막히지 않게 한다.
- 태블릿과 모바일 가로 화면에서 지도 탐색과 주요 명령이 정상 동작하게 한다.
- 기능과 화면이 추가될 때 데스크톱 완성도를 우선하고, 모바일에서는 기본 호환 여부를 함께 검증한다.

### 핵심 게임 흐름

1. 시작 화면에서 맵 크기·지도 종류·내 세력을 고른다. 세력 수는 현재 2개로 고정한다.
2. 플레이어 유닛을 선택한다.
3. 이동 가능 칸을 우클릭해 이동하거나, 사거리 안의 적을 좌클릭해 공격한다.
4. 거점을 점령하고, 상대 수도를 모두 점령하면 승리한다.
5. 턴을 종료하고 소유 거점 수입에서 유닛 유지비를 뺀 자원을 정산한다.
6. AI가 같은 규칙으로 행동하고 생산한다.
7. 내 수도를 잃거나 상대 수도를 모두 점령하면 게임이 끝난다.

## 3. 구현 범위

### 현재 구현

- axial 좌표의 뾰족형 육각 지도
- 시작 화면에서 지도 크기·지도 종류·내 세력을 선택한다.
- 2인용 15×11, 초소형 21×15, 소형 29×21, 중형 41×29를 지도 크기 드롭다운에서 선택할 수 있다. 세력 수는 현재 2로 고정하며 별도 설정을 표시하지 않는다. 가변 지도와 최대 4세력 생성 로직은 내부에 유지한다.
- 2인용 15×11 지도는 화면 중앙 열을 강으로 고정하고 위에서 네 번째·여덟 번째 행에 대칭인 다리를 둔다. 다리와 좌우 접근 타일은 거점·시작 유닛 배치에서 예약한다.
- 새 지도는 세력별 중립 Farm·Mine·Blacksmith를 하나씩 배치하며 중립 Village·Outpost는 생성하지 않는다.
- 내부 seed와 지도 종류로 재현되는 지형·거점·시작 유닛 배치
- 지도 종류 선택: 균형, 평원, 산악, 삼림
- 평지, 다리, 언덕, 숲, 산, 물, 사막, 사막 언덕, 오아시스, 툰드라, 툰드라 숲, 툰드라 산의 지형 12종
- 일반 숲의 활엽수·침엽수 군락 변형과 지형별 래스터 타일
- Outpost·Keep·Stronghold, Village·Town·City, Farm·Mine·Blacksmith의 거점 9종
- 세력별 수도(성) 1개와 시작 유닛 5개(보병 2, 기병 1, 개척자 1, 건설자 1)
- 보병, 기병, 궁병, 창병, 개척자, 건설자
- 최대 체력 100, 근접/원거리 전투력과 병종 상성
- 궁병 공격은 반격 없음, 반격은 근접 전투력 사용
- 육각 6방향 이동, 통제 구역, 사거리 공격
- 지형 이동 비용과 언덕·숲·사막 언덕·툰드라 숲 전투력 보정(+3)
- 군사 거점 공성, 일반 거점 점령, 다세력 수도 점령 승패
- 턴 종료 시 소유 거점·건물 수입과 병종별 유닛 유지비 정산
- 생산·발전·건설의 예상 유지비 예약액 검사와 플레이어 부대 해산
- 상태바의 수입·유지비·순수입·예약액 및 적자 AI의 선제 반복 해산
- City 전용 건물 7종과 도시당 하나의 건설 대기열
- 곡창·시장 수입, 성벽 방어, 병영 생산비, 선술집·신전 회복, 도서관 개발비 효과
- 규칙 기반 AI 턴(활성 세력 순회)
- localStorage 저장과 불러오기(스키마 12, 스키마 6~11 연쇄 마이그레이션)
- 시작 화면·자동 무작위 지도·새 게임
- 지도 휠 줌·드래그 팬·미니맵
- 지형/유닛 사이드바 미리보기·고정 정보, 성·부대 정보창, 우클릭 이동

### 아직 제외

- 유닛 생산 대기열과 다중 건설 대기열
- 무한 지도와 월드 스트리밍
- 지도 편집기
- 장수 성장과 장비
- 외교, 기술 연구, 복잡한 내정
- 전장의 안개
- PixiJS 렌더러
- 멀티플레이
- 서버 계정 및 클라우드 저장
- 휴대폰 중심의 모바일 전용 UI 재설계 (기본 반응형·터치 호환은 유지)

### 구현된 거점 발전 구조

거점은 숫자 레벨만 공통으로 올리는 대신 역할별 이름과 이미지가 바뀌는 구조를 사용한다.

| 분류 | 발전 단계 | 점유 범위 |
| --- | --- | --- |
| 군사·방어 | `Outpost` → `Keep` → `Stronghold` | 모두 1타일 |
| 정착 | `Village` → `Town` → `City` | 모든 단계 1타일 |
| 생산 특화 | `Farm`, `Mine`, `Blacksmith` | 종류를 유지하며 자체 개발 |

City는 Stronghold의 상위 단계가 아니라 정착 계열의 최종 형태다. Village를 Town으로, Town을 City로 발전시켜도 기존 기준 타일 한 칸을 그대로 사용하며 별도의 footprint 방향 선택이나 인접 공간을 요구하지 않는다. 수도 여부는 거점 종류와 별개로 `capitalFor`가 결정한다.

군사 거점의 전투 수치는 다음과 같다.

| 거점 | 최대 HP | 방어력 |
| --- | ---: | ---: |
| Outpost | 50 | 35 |
| Keep | 75 | 42 |
| Stronghold | 100 | 50 |
| City | 120 | 55 |

소유된 군사 거점은 전체 footprint의 인접 칸에 통제 구역을 만들지만 중립 거점은 만들지 않는다. 적 또는 중립 군사 거점에는 공성 공격을 사용하며 거점은 반격하지 않는다. HP가 0이 되면 즉시 공격 세력이 점령하고 최대 HP의 50%를 회복한다. `Outpost → Keep → Stronghold` 발전은 기존 HP 비율을 유지하고, `Town → City`는 최대 HP로 시작한다.

### 구현된 영토 구조

소유된 정착지와 군사 거점은 발전 단계에 따라 주변 타일을 영토로 편입한다. `Village`·`Outpost`는 육각 거리 1, `Town`·`Keep`은 거리 2, `City`·`Stronghold`는 거리 3까지 영향을 준다. 생산 특화 시설과 중립 거점은 영토를 만들지 않는다.

여러 세력의 영향권이 겹치면 가장 가까운 거점의 세력이 타일을 소유하고, 서로 다른 세력의 가장 가까운 거점까지 거리가 같으면 분쟁 지역이 된다. 영토는 거점 상태로부터 계산하는 파생 정보이므로 점령·발전 직후 갱신되며 저장 스키마에는 포함하지 않는다.

Farm·Mine·Blacksmith는 자기 영토에만 건설할 수 있다. 분쟁·적·미편입 지역에는 건설할 수 없으며 기존 지형, 거점 간격, 아군 상위 거점에서 육로 거리 3 이내 조건도 함께 적용한다. Village와 Outpost 건설에는 영토 제한을 적용하지 않는다. 영토는 현재 생산 거점 건설과 지도 표시에만 사용하고 이동·전투·수입에는 보정을 주지 않는다.

새로운 아이디어는 백로그에 기록하고, 다음 마일스톤을 추가한 뒤에 구현한다.

### 첫 MVP(완료)

Milestone 01–05에서 사각 지도·지형·도시·보병·기병으로 시작해 전투·AI·저장·생산·궁병·창병까지 완성했다. Milestone 06에서 육각 스키마로 전환했고, Milestone 07–08에서 UI·가변 지도·다세력을 추가했다. 사각 좌표 기반 스키마 4·5 저장은 불러오지 않는다.

## 4. 기술 스택

| 역할 | 기술 | 선택 이유 |
| --- | --- | --- |
| 개발 환경 | Vite | React와 TypeScript 기반의 단순한 클라이언트 프로젝트 구성 |
| UI | React | 컴포넌트, 이벤트, 폼, 조건부 렌더링 학습 |
| 언어 | TypeScript | 게임 데이터와 명령을 명시적으로 모델링하고 규칙 오류 감소 |
| 지도 | React + CSS 육각 타일 | 좌표는 순수 함수로 두고 화면만 픽셀 배치로 그린다 |
| 게임 상태 | `useReducer` | 상태와 명령의 관계 및 불변 업데이트 학습 |
| 테스트 | Vitest + Testing Library | 규칙 단위 테스트와 사용자 관점 UI 테스트 |
| 저장 | localStorage + JSON | 서버 없이 저장/불러오기 구현 |

초기에는 Zustand, PixiJS, Next.js를 사용하지 않는다.

- 전역 UI 상태가 복잡해져 Context와 `useReducer`만으로 관리하기 어려울 때 Zustand를 검토한다.
- CSS 육각 타일의 실제 성능이나 표현력이 요구사항을 충족하지 못할 때 PixiJS를 검토한다.
- 서버 렌더링, 서버 API 또는 라우팅 요구가 생겼을 때만 Next.js를 검토한다.

라이브러리는 문제를 확인한 뒤 도입하고, 학습을 위해 필요한 React와 TypeScript 개념을 라이브러리가 가리지 않도록 한다.

## 5. 설계 원칙

### 게임 규칙과 React 분리

React 컴포넌트는 화면 표시와 사용자 입력을 담당한다. 이동, 전투, 점령, 턴 정산 같은 규칙은 React에 의존하지 않는 순수 TypeScript 함수로 구현한다.

```text
사용자 입력
    ↓
React UI ── GameAction ──> 게임 reducer / 규칙 함수
    ↑                              │
    └──────── GameState ───────────┘
                                   ├─ AI
                                   └─ Save / Load
```

이 구조는 다음 효과가 있다.

- React 렌더링 없이 게임 규칙을 테스트할 수 있다.
- 같은 명령과 초기 상태는 항상 같은 결과를 만든다.
- AI도 플레이어와 동일한 명령과 규칙을 사용한다.
- 이후 PixiJS로 지도를 교체해도 규칙 코드를 재사용할 수 있다.
- `wizard-web`에서도 UI와 비즈니스 로직을 분리하는 경험을 활용할 수 있다.

### 상태 관리 규칙

- `GameState`를 게임 진행의 단일 기준으로 사용한다.
- 이동 가능 타일, 선택 유닛의 전투력 합계 같은 값은 저장하지 않고 계산한다.
- 배열과 객체를 직접 변경하지 않고 새로운 상태를 반환한다.
- UI는 게임 상태를 임의로 수정하지 않고 `GameAction`을 전달한다.
- 게임 엔진 상태와 모달, 전투 연출, seed 입력, 성/생산 HUD 같은 일시적인 UI 상태를 구분한다.
- 유닛, 거점, 세력은 화면 위치가 아니라 안정적인 ID로 참조한다.

### 현재 데이터 모델

```ts
type Position = {
  q: number
  r: number
}

type Terrain =
  | 'plain'
  | 'mountain'
  | 'water'
  | 'hill'
  | 'forest'
  | 'desert'
  | 'desertHill'
  | 'oasis'
  | 'tundra'
  | 'tundraForest'
  | 'tundraMountain'
type MapType = 'balanced' | 'plains' | 'mountainous' | 'forested'
type FactionId = 'f1' | 'f2' | 'f3' | 'f4' | 'player' | 'enemy' // player/enemy는 스키마 6 마이그레이션용
type FactionCount = 2 | 3 | 4
type BoardSize = { columns: number; rows: number }
type SiteOwnerId = FactionId | 'neutral'
type SiteType =
  | 'outpost'
  | 'keep'
  | 'stronghold'
  | 'village'
  | 'town'
  | 'city'
  | 'farm'
  | 'mine'
  | 'blacksmith'
type MilitaryUnitType = 'infantry' | 'cavalry' | 'archer' | 'spearman'
type CivilianUnitType = 'settler' | 'builder'
type UnitType = MilitaryUnitType | CivilianUnitType
type BuildingId =
  | 'granary'
  | 'market'
  | 'wall'
  | 'barracks'
  | 'tavern'
  | 'temple'
  | 'library'
type GamePhase = 'playing' | 'victory' | 'defeat'

type Tile = {
  id: string
  position: Position
  terrain: Terrain
  terrainVariant?: number
  siteId?: string
}

type Unit = {
  id: string
  name: string
  factionId: FactionId
  type: UnitType
  position: Position
  hp: number
  maxHp: number
  movementRemaining: number
  hasActed: boolean
}

type Site = {
  id: string
  name: string
  kind: SiteType
  position: Position
  footprint?: Position[]
  level?: 1 | 2 | 3
  ownerId: SiteOwnerId
  capitalFor?: FactionId
  hp?: number
  maxHp?: number
  buildings: BuildingId[]
  constructionQueue?: {
    buildingId: BuildingId
    turnsRemaining: number
    startedTurn: number
  }
  lastProducedTurn?: number
  lastDevelopedTurn?: number
}

type GameState = {
  schemaVersion: number // 12
  mapSeed: string
  mapType: MapType
  mapGenerationVersion: number // 24
  boardSize: BoardSize
  factionCount: FactionCount
  humanFactionId: FactionId
  factionOrder: FactionId[]
  turn: number
  phase: GamePhase
  activeFactionId: FactionId
  selectedUnitId?: string
  resources: Record<FactionId, number>
  tiles: Tile[]
  units: Unit[]
  sites: Site[]
}
```

구현 중 규칙이 확정되면 타입도 함께 수정한다. 선택 가능한 경우를 문자열 하나로 뭉개지 않고 union 타입으로 표현해 잘못된 상태를 줄인다.

### 현재 명령

```ts
type GameAction =
  | { type: 'unitSelected'; unitId: string }
  | { type: 'selectionCleared' }
  | { type: 'unitMoved'; unitId: string; destination: Position }
  | { type: 'unitAttacked'; attackerId: string; defenderId: string }
  | { type: 'siteAttacked'; attackerId: string; siteId: string }
  | { type: 'unitWaited'; unitId: string }
  | { type: 'unitDisbanded'; unitId: string }
  | {
      type: 'unitProduced'
      siteId: string
      unitType: UnitType
      destination: Position
    }
  | { type: 'siteDeveloped'; siteId: string; footprint?: Position[] }
  | { type: 'constructionStarted'; siteId: string; buildingId: BuildingId }
  | { type: 'constructionCancelled'; siteId: string }
  | { type: 'turnEnded' }
  | { type: 'gameLoaded'; state: GameState }
  | {
      type: 'gameRestarted'
      seed: string
      boardSize?: BoardSize
      factionCount?: FactionCount
      humanFactionId?: FactionId
      mapType?: MapType
    }
```

## 6. 디렉터리 구조

```text
src/
├─ game/
│  ├─ types.ts
│  ├─ hex.ts            # 보드 프리셋, 육각 좌표·인접·픽셀
│  ├─ mapGenerator.ts   # seed 기반 지도·거점·시작 배치
│  ├─ initialState.ts
│  ├─ reducer.ts
│  ├─ rules.ts
│  ├─ selectors.ts
│  ├─ ai.ts
│  ├─ spatialIndex.ts
│  ├─ priorityQueue.ts
│  └─ state.ts
├─ components/
│  ├─ StartScreen.tsx
│  ├─ AppChrome.tsx
│  ├─ NewGameMenu.tsx
│  ├─ GameMap.tsx
│  ├─ Minimap.tsx
│  ├─ StatusBar.tsx
│  ├─ InfoPanel.tsx
│  ├─ CityPanel.tsx
│  ├─ ProductionPanel.tsx
│  ├─ SavePanel.tsx
│  ├─ Legend.tsx
│  ├─ GameResultPanel.tsx
│  ├─ SiteIcon.tsx
│  ├─ TerrainIcon.tsx
│  └─ UnitIcon.tsx
├─ hooks/
│  ├─ useAiTurn.ts
│  ├─ useMapPan.ts
│  ├─ useMapZoom.ts
│  └─ useMapViewport.ts
├─ storage/
│  └─ saveGame.ts
├─ App.tsx
└─ main.tsx
```

기능이 작을 때는 불필요하게 폴더와 추상화를 늘리지 않는다. 파일이 커지거나 동일한 책임이 반복될 때 분리한다.

## 7. 개발 단계와 완료 조건

01–09는 완료됐다. 각 단계의 상세 기록은 마일스톤 문서를 따른다.

### 0단계: 프로젝트 기반

- Vite React TypeScript 프로젝트 실행
- lint, format, test 명령 구성
- 기본 화면과 테스트 1개 작성

완료 조건: 새 환경에서 문서의 명령만으로 개발 서버와 테스트를 실행할 수 있다.

### Milestone 01–07

상세 기록은 [개발 마일스톤](milestones/README.md)의 각 문서를 따른다.

### Milestone 08: 가변 지도·다세력·HUD 조작

상세 기록: [Milestone 08](milestones/08-variable-map-and-hud.md)

- 맵 크기·세력 수·내 세력 시작 설정
- 휠 줌·팬·미니맵
- 우클릭 이동, 성/부대 정보창, 지형·유닛 툴팁
- 스키마 7

### Milestone 09: 지형 확장

상세 기록: [Milestone 09](milestones/09-terrain-expansion.md)

- 온도 축과 사막·툰드라 기후대
- 사막 언덕·오아시스·툰드라 숲·툰드라 산 후속 확장
- 지형 래스터 타일, 미니맵 색, 범례, 툴팁
- 일반 숲의 활엽수·침엽수 군락 변형
- 완료 당시 스키마 8, 맵 생성 버전 20

### Milestone 10: 거점 발전

상세 기록: [Milestone 10](milestones/10-site-development.md)

- Outpost → Keep → Stronghold와 Village → Town → City 발전 계열
- Farm·Mine·Blacksmith 1~3레벨 및 수입·생산 보조 효과
- Village·Town·City의 동일한 1타일 footprint 지도 미리보기
- 거점별 병종 해금, AI 발전, 군사 거점 공성, 스키마 11·맵 생성 버전 22
- 후속 맵 생성 버전 23에서 15×11 2인용 지도에 중앙 강과 두 다리를 추가
- 맵 생성 버전 24에서 신규 중립 거점을 생산 특화 시설(Farm·Mine·Blacksmith)로 제한
- 맵 생성 버전 25에서 Town·City를 기준 위치 한 칸만 점유하도록 변경

### Milestone 11–12: 도시 내정과 유지비

- City 전용 건물 7종, 슬롯 제한 없는 완공 목록과 도시당 하나의 건설 대기열
- 병종별 유지비와 `max(0, 현재 자원 + 수입 - 유지비)` 턴 정산
- 행동 후 경제를 기준으로 한 생산·발전·건설 예약액 검사
- 플레이어 무환불 해산과 적자 AI의 행동 전 반복 해산
- 저장 스키마 12 유지: 경제 요약은 저장하지 않는 파생 정보

### Milestone 13: AI 고도화

- 전체 미행동 유닛의 전투 결과 예측과 수도 점령·방어 우선순위
- 중립 경제 거점, 다중 수도와 대체 공격 목표 탐색
- 적 노출도·방어 지형·병종별 거리를 반영한 전술 이동
- 통합 투자 평가와 AI 병력 상한·생산 후 비적자 정책
- 저장 상태 없이 같은 상태에서 같은 액션과 결정 이유를 반환하는 결정론

## 8. 테스트 전략

전략 게임은 화면보다 규칙 회귀가 큰 위험이므로 게임 규칙을 우선 테스트한다.

### 필수 단위 테스트

- 지도 밖, 산, 물, 다른 유닛이 있는 타일로 이동할 수 없다.
- 이동력이 부족하면 이동할 수 없다.
- 이미 행동한 유닛은 다시 행동할 수 없다.
- 육각 사거리를 벗어난 대상을 공격할 수 없다.
- 체력이 0 이하가 된 유닛은 제거된다.
- 거점 위에 적 유닛이 도착하면 소유권이 변경된다.
- 상대 수도를 점령하면 즉시 승패가 결정된다.
- 턴 종료 시 소유 거점·건물 수입에서 유닛 유지비를 뺀 만큼 정산되고 자원이 0 아래로 내려가지 않는다.
- 생산·발전·건설은 예상 유지비 예약액을 침범하지 않으며 해산은 환불 없이 소유 유닛만 제거한다.
- 같은 seed와 지도 종류는 같은 지도와 시작 배치를 만든다.
- 오아시스는 사막 계열 6칸 내부에만 생성되고 서로 인접하지 않는다.
- 연결된 일반 숲은 같은 활엽수·침엽수 변형을 사용한다.
- 시작 화면에서 선택 가능한 2인용 맵이 2세력으로 생성된다.
- 내부 확장 프리셋·세력 수 조합도 유효한 지도를 생성한다.
- 승리 또는 패배 후 추가 행동으로 상태가 변경되지 않는다.
- 동일한 초기 상태와 명령 목록은 동일한 결과를 만든다.
- 저장 후 불러온 상태가 원래 상태와 같다.

### UI 테스트

- 시작 화면에서 맵·세력 설정을 고르고 게임을 시작할 수 있다.
- 유닛 선택 시 부대 정보창과 이동 가능 타일이 보인다.
- 이동은 우클릭으로 수행된다.
- 성 클릭 시 성 정보창이 열리고 생산 메뉴로 부대 생산이 가능하다.
- 선택 정보가 없을 때 지형 호버·포커스 시 사이드바 미리보기가 표시되고 일반 클릭 시 정보가 고정된다.
- 사용자에게 seed를 노출하지 않고 새로운 무작위 지도로 게임을 시작할 수 있다.
- 유효하지 않은 타일 클릭 시 유닛이 이동하거나 생산되지 않는다.
- 턴 종료 버튼이 올바른 단계에서 동작한다.
- 적 수도 점령 시 승리 메시지가 표시된다.
- 상태바에 경제 요약과 적자 예약액이 표시되고, 해산 확인 및 유지비 차단 사유가 동작한다.

## 9. 저장 정책

localStorage 데이터는 브라우저를 닫아도 일반적으로 유지되지만 사용자가 사이트 데이터를 삭제하거나 저장 공간이 제한되면 사라질 수 있다. 따라서 저장은 편의 기능으로 간주하며 영구 보관을 보장하지 않는다.

- 저장 데이터에 `schemaVersion`, `mapSeed`, `mapType`, `mapGenerationVersion`, `boardSize`, `factionCount`, `humanFactionId`, `factionOrder`를 포함한다.
- 현재 스키마는 12다.
- 스키마 6은 `player`/`enemy`를 `f1`/`f2`로 바꾼 뒤 연쇄 마이그레이션한다.
- 스키마 7은 기존 `city`(마을)를 `village`로, `village`(농장)를 `farm`으로 바꿔 불러온다.
- 스키마 8 저장에 `mapType`이 없으면 기존 생성 방식인 `balanced`로 불러온다.
- 스키마 8의 기존 거점은 종류와 생산 특화 시설 레벨을 연쇄 마이그레이션하고, 스키마 13 이하의 Town·City footprint는 기준 위치 한 칸으로 정규화한다.
- 스키마 9의 군사 거점은 종류별 최대 HP로 채워 스키마 10으로 불러온다.
- 스키마 10의 `city`는 `town`, `castle`은 `city`로 바꿔 스키마 11로 불러온다.
- 스키마 11의 모든 거점은 빈 건물 목록과 건설 대기열 없음으로 채워 스키마 12로 불러온다.
- 마이그레이션은 저장된 `mapGenerationVersion`을 바꾸지 않으며, 새 지도 생성 버전은 24를 사용한다.
- 맵 생성 버전 5부터 현재 버전 24까지 저장된 타일을 재생성하지 않고 지원한다.
- JSON을 읽은 뒤 필요한 필드와 값의 범위를 검증한다.
- 스키마 4·5를 포함한 지원하지 않는 버전은 불러오지 않고 사용자에게 알린다.
- 파생 상태와 일시적인 UI 상태는 저장하지 않는다.
- 개발 중 스키마가 바뀌면 마이그레이션하거나 기존 저장을 명시적으로 거부한다.

## 10. React·TypeScript 학습 목표

| 게임 기능 | React·TypeScript 학습 내용 | wizard-web 활용 |
| --- | --- | --- |
| 타일과 유닛 | 컴포넌트, props, 목록 렌더링, key | 반복 UI와 컴포넌트 분리 |
| 선택과 이동 | 이벤트, 상태, 불변 업데이트 | 폼 및 상호작용 상태 처리 |
| 턴 진행 | `useReducer`, action, 상태 전이 | 복잡한 화면 흐름 관리 |
| 정보 패널 | 조건부 렌더링, 파생 상태 | 상세 패널과 대시보드 |
| 게임 모델 | type, interface, union, narrowing | API 및 도메인 모델링 |
| 게임 규칙 | 순수 함수, 모듈 경계 | 비즈니스 로직 분리 |
| 저장 | JSON, 런타임 검증, 오류 처리 | API 응답과 로컬 캐시 처리 |
| 테스트 | 단위·컴포넌트 테스트 | 회귀 방지와 리팩터링 |
| 성능 개선 | memoization, 렌더링 측정 | 대규모 목록과 대시보드 최적화 |

학습 결과는 단순히 라이브러리를 사용했다는 사실보다 다음 능력으로 확인한다.

- 데이터 타입과 상태 전이를 설명할 수 있다.
- React 렌더링과 게임 규칙의 책임을 구분할 수 있다.
- 오류를 재현하는 테스트를 먼저 작성할 수 있다.
- 성능 문제를 추측이 아니라 측정 결과로 판단할 수 있다.

## 11. Milestone 09–16 로드맵

상세 명세는 [개발 마일스톤](milestones/README.md)의 각 문서를 따른다.

| 단계 | 목표 | 상태 |
| --- | --- | --- |
| [09](milestones/09-terrain-expansion.md) | 사막·툰드라와 후속 지형 확장 | 완료 |
| [10](milestones/10-site-development.md) | 역할별 거점 발전 | 완료 |
| [11](milestones/11-city-administration.md) | City 전용 건물·대기열 | 완료 |
| [12](milestones/12-upkeep.md) | 유지비(소프트 제약) | 완료 |
| [13](milestones/13-ai-refinement.md) | 경제를 보는 AI | 완료 |
| [14](milestones/14-settlement-construction.md) | 개척자·건설자의 신규 거점 건설 | 완료 |
| [15](milestones/15-supply-and-morale.md) | 보급·사기(라이트) | 다음 목표 |
| [16](milestones/16-site-expansion.md) | 농장 본체와 인접 농지 확장 | 예정 |

### 로드맵 밖 후보

- 여러 저장 슬롯, 자동 저장, 전장의 안개
- 장수·장비·경험치, 기술·외교
- PixiJS 렌더러, 서버 저장

## 12. 현재 개발 목표

다음 구현 목표는 [Milestone 15: 보급, 사기](milestones/15-supply-and-morale.md)이다.

Milestone 11에서 City에 슬롯 제한 없는 건물 7종과 도시당 하나의 건설 대기열을 추가했다. Milestone 12에서는 병종별 유지비와 적자 해산을 연결했고, Milestone 13에서는 전투·방어·경제 확장·투자·병력 상한을 함께 판단하는 결정론적 AI로 확장했다. Milestone 14에서는 개척자·영구 건설자, 신규 거점 건설, 민간 유닛 규칙과 AI 확장을 추가했으며 이후 정착·군사 거점의 단계별 영토와 생산 거점 건설 제한을 연결했다. 다음 단계에서는 이 거점망 위에 보급·사기 시스템을 연결한다.

가변 지도·다세력·HUD까지 반영한 현재 기준 시나리오는 다음과 같다.

> 시작 화면에서 맵 크기·지도 종류·내 세력을 고르고, 무작위 육각 지도에서 유닛을 좌클릭으로 선택·공격하고 이동 칸은 우클릭으로 이동한다. 성에서 부대를 생산하고, 상대 수도를 모두 점령하면 한 판이 끝난다. 내부 seed와 지도 종류가 같으면 같은 지도를 재현한다.

새 기능을 넣을 때는 해당 마일스톤 명세를 기준으로 하고, 이 시나리오의 규칙·UI 테스트가 계속 통과하는지 확인한다.
