# min2world 개발 계획

## 1. 프로젝트 목표

`min2world`는 문명, 삼국지, 대전략에서 아이디어를 얻은 **싱글 플레이 웹 턴제 전략 시뮬레이션 게임**이다.

이 프로젝트의 우선순위는 다음과 같다.

1. 1인 개발 범위 안에서 작지만 완결된 전략 게임을 만든다.
2. 게임을 만들면서 React와 TypeScript를 실전 수준으로 익힌다.
3. 컴포넌트 설계, 상태 관리, 비즈니스 로직 분리, 테스트 경험을 `wizard-web` 개발에 활용한다.

대형 4X 게임을 그대로 재현하는 것이 목표는 아니다. 첫 번째 성공 기준은 제한된 규칙을 가진 게임 한 판을 시작부터 승리 또는 패배까지 플레이할 수 있는 것이다. 이 기준은 Milestone 01–05에서 충족했고, Milestone 06에서 육각 무작위 지도로 확장했다.

현재 구현과 조작 안내는 [루트 README](../README.md), 단계별 기록은 [개발 마일스톤](milestones/README.md)을 따른다. 완료된 마일스톤 문서는 덮어쓰지 않는다.

## 2. 게임 방향

세 작품군의 특징을 다음과 같이 축소해서 결합한다.

- 문명: 타일 기반 지도와 영토 확장
- 삼국지: 세력, 거점, 장수로 확장할 수 있는 데이터 구조
- 대전략: 턴제 유닛 이동, 전투, 거점 점령

초기 버전은 그래픽 연출보다 게임 규칙과 UI에 집중했다. 첫 MVP는 사각 타일로 시작했고, Milestone 06에서 육각 좌표와 seed 기반 무작위 지도로 전환했다. 장수·외교·기술 연구 같은 기능은 핵심 게임이 완성된 뒤 추가한다.

### 핵심 게임 흐름

1. 플레이어 유닛을 선택한다.
2. 이동 가능한 육각 타일로 이동하거나 사거리 안의 적을 공격한다.
3. 거점을 점령하고, 상대 수도를 점령하면 승리한다.
4. 턴을 종료하고 소유 거점에서 자원을 획득한다.
5. AI가 같은 규칙으로 행동하고 생산한다.
6. 한 세력이 상대 수도를 점령하면 게임이 끝난다.

## 3. 구현 범위

### 현재 구현

- axial 좌표의 12×12 뾰족형 육각 지도 144칸
- seed로 재현되는 지형, 거점 8개, 시작 유닛 배치
- 평지, 언덕, 숲, 산, 물의 지형 5종
- 성, 도시, 마을, 광산의 거점 4종
- 플레이어와 AI의 2개 세력
- 세력별 수도(성) 1개와 시작 유닛 3개(보병 2, 기병 1)
- 보병, 기병, 궁병, 창병
- 육각 6방향 이동, 통제 구역, 사거리 공격
- 지형 이동 비용과 방어 보정
- 거점 점령, 수도 점령 승패
- 턴 종료 시 소유 거점 수입과 유닛 생산
- 규칙 기반 AI 턴
- localStorage 저장과 불러오기(스키마 6)
- seed 입력, 무작위 지도, 새 게임

### 아직 제외

- 무한 지도와 월드 스트리밍
- 지도 편집기
- 장수 성장과 장비
- 외교, 기술 연구, 복잡한 내정
- 전장의 안개
- PixiJS 렌더러
- 멀티플레이
- 서버 계정 및 클라우드 저장
- 모바일 전용 UI

새로운 아이디어는 백로그에 기록하고, 다음 마일스톤을 추가한 뒤에 구현한다.

### 첫 MVP(완료)

Milestone 01–05에서 10×10 사각 지도, 지형 3종, 도시 2개, 보병·기병으로 시작해 전투·AI·저장·생산·궁병·창병까지 완성했다. 사각 좌표와 스키마 4·5 저장은 Milestone 06에서 육각 스키마 6으로 교체했으며 이전 저장은 불러오지 않는다.

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
- 이동 가능 타일, 선택 유닛의 공격력 합계 같은 값은 저장하지 않고 계산한다.
- 배열과 객체를 직접 변경하지 않고 새로운 상태를 반환한다.
- UI는 게임 상태를 임의로 수정하지 않고 `GameAction`을 전달한다.
- 게임 엔진 상태와 모달, 전투 연출, seed 입력 같은 일시적인 UI 상태를 구분한다.
- 유닛, 거점, 세력은 화면 위치가 아니라 안정적인 ID로 참조한다.

### 현재 데이터 모델

```ts
type Position = {
  q: number;
  r: number;
};

type Terrain = "plain" | "mountain" | "water" | "hill" | "forest";
type FactionId = "player" | "enemy";
type SiteOwnerId = FactionId | "neutral";
type SiteType = "stronghold" | "city" | "village" | "mine";
type UnitType = "infantry" | "cavalry" | "archer" | "spearman";
type GamePhase = "playing" | "victory" | "defeat";

type Tile = {
  id: string;
  position: Position;
  terrain: Terrain;
  siteId?: string;
};

type Unit = {
  id: string;
  name: string;
  factionId: FactionId;
  type: UnitType;
  position: Position;
  hp: number;
  maxHp: number;
  movementRemaining: number;
  hasActed: boolean;
};

type Site = {
  id: string;
  name: string;
  kind: SiteType;
  position: Position;
  ownerId: SiteOwnerId;
  capitalFor?: FactionId;
  lastProducedTurn?: number;
};

type GameState = {
  schemaVersion: number;
  mapSeed: string;
  mapGenerationVersion: number;
  turn: number;
  phase: GamePhase;
  activeFactionId: FactionId;
  selectedUnitId?: string;
  resources: Record<FactionId, number>;
  tiles: Tile[];
  units: Unit[];
  sites: Site[];
};
```

구현 중 규칙이 확정되면 타입도 함께 수정한다. 선택 가능한 경우를 문자열 하나로 뭉개지 않고 union 타입으로 표현해 잘못된 상태를 줄인다.

### 현재 명령

```ts
type GameAction =
  | { type: "unitSelected"; unitId: string }
  | { type: "selectionCleared" }
  | { type: "unitMoved"; unitId: string; destination: Position }
  | { type: "unitAttacked"; attackerId: string; defenderId: string }
  | { type: "unitWaited"; unitId: string }
  | {
      type: "unitProduced";
      siteId: string;
      unitType: UnitType;
      destination: Position;
    }
  | { type: "turnEnded" }
  | { type: "gameLoaded"; state: GameState }
  | { type: "gameRestarted"; seed: string };
```

## 6. 디렉터리 구조

```text
src/
├─ game/
│  ├─ types.ts          # 게임 데이터 및 명령 타입
│  ├─ hex.ts            # 육각 좌표, 인접, 거리, 픽셀 위치
│  ├─ mapGenerator.ts   # seed 기반 지도·거점·시작 배치
│  ├─ initialState.ts   # 초기 게임 상태
│  ├─ reducer.ts        # 명령에 따른 상태 전이
│  ├─ rules.ts          # 이동, 전투, 점령, 생산 규칙
│  ├─ selectors.ts      # 이동 가능 범위 등 파생 값
│  ├─ ai.ts             # 규칙 기반 AI 행동 선택
│  └─ state.ts          # 상태 복제
├─ components/
│  ├─ GameMap.tsx
│  ├─ StatusBar.tsx
│  ├─ InfoPanel.tsx
│  ├─ ProductionPanel.tsx
│  ├─ SavePanel.tsx
│  ├─ Legend.tsx
│  ├─ GameResultPanel.tsx
│  └─ UnitIcon.tsx
├─ hooks/
│  └─ useAiTurn.ts
├─ storage/
│  └─ saveGame.ts
├─ App.tsx
└─ main.tsx
```

기능이 작을 때는 불필요하게 폴더와 추상화를 늘리지 않는다. 파일이 커지거나 동일한 책임이 반복될 때 분리한다.

## 7. 개발 단계와 완료 조건

01–06은 완료됐다. 각 단계의 상세 기록은 마일스톤 문서를 따른다.

### 0단계: 프로젝트 기반

- Vite React TypeScript 프로젝트 실행
- lint, format, test 명령 구성
- 기본 화면과 테스트 1개 작성

완료 조건: 새 환경에서 문서의 명령만으로 개발 서버와 테스트를 실행할 수 있다.

### Milestone 01: 지도와 유닛 이동

상세 기록: [Milestone 01: 지도와 유닛 이동](milestones/01-map-and-movement.md)

첫 구현은 10×10 사각 지도에서 선택과 이동을 완성했다. 현재 지도는 Milestone 06의 육각 좌표를 사용한다.

### Milestone 02: 전투와 도시 점령

상세 기록: [Milestone 02: 전투와 도시 점령](milestones/02-combat-and-capture.md)

### Milestone 03: 규칙 기반 AI와 턴 전환

상세 기록: [Milestone 03: 규칙 기반 AI와 턴 전환](milestones/03-rule-based-ai.md)

### Milestone 04: 저장과 불러오기

상세 기록: [Milestone 04: 저장과 불러오기](milestones/04-save-and-load.md)

### Milestone 05: 도시 자원과 유닛 생산

상세 기록: [Milestone 05: 도시 자원과 유닛 생산](milestones/05-economy-and-production.md)

### Milestone 06: 무작위 육각 지도와 seed

상세 기록: [Milestone 06: 무작위 육각 지도와 seed](milestones/06-procedural-hex-map.md)

- 육각 좌표와 6방향 이동·전투·통제 구역
- seed로 재현 가능한 무작위 지도
- 평지, 산, 물, 언덕, 숲
- 성, 도시, 마을, 광산

완료 조건: 같은 seed로 같은 육각 지도를 만들고 확장 지형과 거점에서 한 판을 끝낼 수 있다.

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
- 턴 종료 시 소유 거점 수입만큼 자원이 정확히 증가한다.
- 같은 seed는 같은 지도와 시작 배치를 만든다.
- 승리 또는 패배 후 추가 행동으로 상태가 변경되지 않는다.
- 동일한 초기 상태와 명령 목록은 동일한 결과를 만든다.
- 저장 후 불러온 상태가 원래 상태와 같다.

### UI 테스트

- 144칸 육각 지도와 현재 seed가 보인다.
- 유닛 선택 시 정보와 이동 가능 타일이 보인다.
- seed 입력으로 결정론적 새 게임을 시작할 수 있다.
- 유효하지 않은 타일 클릭 시 유닛이 이동하거나 생산되지 않는다.
- 턴 종료 버튼이 올바른 단계에서 동작한다.
- 적 수도 점령 시 승리 메시지가 표시된다.

## 9. 저장 정책

localStorage 데이터는 브라우저를 닫아도 일반적으로 유지되지만 사용자가 사이트 데이터를 삭제하거나 저장 공간이 제한되면 사라질 수 있다. 따라서 저장은 편의 기능으로 간주하며 영구 보관을 보장하지 않는다.

- 저장 데이터에 `schemaVersion`과 `mapSeed`, `mapGenerationVersion`을 포함한다.
- 현재 스키마는 6이다.
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

## 11. Milestone 07 이후 후보

실제 플레이 결과를 확인한 뒤 다음 기능의 우선순위를 정한다.

- 장수와 능력치
- 기술 연구
- 세력 외교
- 전장의 안개
- PixiJS 렌더러
- Zustand 기반 UI 상태 관리
- 서버 저장 및 게임 기록 공유

## 12. 현재 개발 목표

첫 구현 시나리오와 육각 지도·메인 UI 재구성은 완료됐다. 현재 기준 시나리오는 다음과 같다.

> seed로 만든 12×12 육각 지도가 화면 중심에 있고, 유닛을 선택하면 이동·공격 칸이 표시되며, 거점을 점령하거나 부대를 생산하고 상대 수도를 점령하면 한 판이 끝난다. seed·저장은 상단과 우측 탭에서 다루며 같은 seed는 같은 지도를 재현한다.

다음 기능을 추가할 때는 새 마일스톤 문서를 만들고, 이 시나리오의 규칙 테스트와 UI 테스트가 계속 통과하는지 확인한다.

### Milestone 07: 메인 UI 재구성

상세 기록: [Milestone 07: 메인 UI 재구성](milestones/07-main-ui.md)

- compact brand bar와 새 게임 드롭다운으로 seed 조작 분리
- 우측 정보/생산 + 범례|저장|도움말 탭
- 맵 우선 레이아웃
