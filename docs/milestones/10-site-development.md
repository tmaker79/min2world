# Milestone 10: 거점 발전

## 상태

완료

## 목표

숫자 레벨만 오르는 공통 개발 방식 대신, 거점의 역할이 이름과 이미지로 드러나는 발전 계열을 도입한다. 군사·방어 거점과 정착지를 분리하고, 생산 특화 시설은 종류를 유지한 채 자체 개발한다. 신규 거점 건설은 Milestone 14에서 다룬다.

## 확정 발전 구조

| 분류 | 발전 단계 | 핵심 역할 |
| --- | --- | --- |
| 군사·방어 | `Outpost` → `Keep` → `Stronghold` | 시야·주둔·방어·병력 생산 |
| 정착 | `Village` → `City` → `Castle` | 인구·수입·내정·최종 정착지 |
| 생산 특화 | `Farm`, `Mine`, `Blacksmith` | 식량·광물·장비 및 생산 보조 |

- `Castle`은 `Stronghold`의 상위 단계가 아니다. 정착 계열의 최종 단계다.
- `Stronghold`는 군사·방어 계열의 최종 단계이며 1타일을 유지한다.
- `Village`는 1타일, `City`는 위 1칸·아래 2칸으로 서로 인접한 삼각형 3타일, `Castle`은 가로형 마름모 4타일을 사용한다.
- `Farm`, `Mine`, `Blacksmith`는 서로 승급하지 않는다. 필요하면 같은 종류 안에서 1~3단계로 개발한다.
- 수도 여부는 거점 종류가 아니라 기존 `capitalFor`로 구분한다. 따라서 수도와 발전 계열은 독립적이다.

## 의존

- Milestone 05 경제·생산
- Milestone 08 거점 정보창과 건설 메뉴 자리

## 포함 범위

### 데이터

구현된 거점 종류는 다음과 같다.

```ts
type SiteType =
  | 'outpost'
  | 'keep'
  | 'stronghold'
  | 'village'
  | 'city'
  | 'castle'
  | 'farm'
  | 'mine'
  | 'blacksmith'
```

- 군사·방어 및 정착 계열의 단계는 `kind` 자체로 표현한다. 별도 숫자 레벨과 중복 저장하지 않는다.
- 생산 특화 시설에만 `level: 1 | 2 | 3`을 사용한다.
- 당해 세력 턴에 거점을 개발했는지 판단하기 위해 `lastDevelopedTurn?: number`를 추가한다.
- City와 Castle은 여러 위치를 하나의 논리 거점에 연결한다. 기준 위치는 기존 `Site.position`을 유지하고, 나머지 점유 위치를 별도 footprint 데이터로 저장한다.
- 저장 검증은 City footprint가 지도 안의 통행 가능한 육지 3칸으로 이루어진 위 1칸·아래 2칸 삼각형인지 확인한다. Castle footprint는 같은 조건의 4칸 가로형 마름모인지 확인한다. 두 종류 모두 다른 거점 footprint와 겹칠 수 없다.
- 현재 스키마 8의 `stronghold`, `village`, `farm`, `mine`은 같은 종류로 보존한다. 기존 거점을 하위 단계로 강제 변환하지 않는다.
- 새 타입과 footprint를 추가할 때 스키마를 9로 올리고, 기존 저장에는 빈 footprint와 생산 특화 시설 기본 레벨을 채운다.

### 발전 규칙

- 발전은 활성 세력이 소유한 거점에서, 해당 세력의 턴에, 자원이 충분할 때 즉시 적용한다.
- 각 거점은 자신을 소유한 세력의 턴마다 1회만 발전할 수 있다. `lastDevelopedTurn === turn`이면 거부한다.
- `Outpost → Keep → Stronghold`와 `Village → City → Castle`은 `kind`를 다음 단계로 변경한다.
- `Village → City`는 기존 Village 타일과 인접한 빈 2타일을 더해 유효한 3타일 삼각형을 만들 수 있을 때만 가능하다.
- `City → Castle`은 기존 City의 3타일 footprint에 빈 1타일을 더해 유효한 가로형 4타일 마름모를 완성할 수 있을 때만 가능하다.
- 가능한 방향이 여럿이면 발전 전에 전체 footprint를 미리 표시하고 방향을 선택한다.
- City와 Castle은 여러 타일을 사용하지만 소유권·수입·점령 상태는 각각 하나의 `Site`에서 관리한다. 점령 기준은 기존 `Site.position`인 기준(anchor) 타일로 유지한다.
- City와 Castle의 추가 점유 타일은 다른 거점과 생산 특화 시설의 건설을 막는다. 유닛 이동과 전투는 기존 거점 타일 규칙을 따른다.
- 점령 시 발전 단계, 생산 특화 시설 레벨과 Castle footprint를 유지한다.

### 현재 밸런스

| 발전 | 비용 |
| --- | ---: |
| Outpost → Keep / Keep → Stronghold | 8 / 12 |
| Village → City / City → Castle | 10 / 15 |
| Farm·Mine Lv.2 / Lv.3 | 6 / 10 |
| Blacksmith Lv.2 / Lv.3 | 7 / 11 |

- 턴 수입은 Outpost·Keep·Stronghold가 2·3·5, Village·City·Castle이 3·5·7이다.
- Farm은 레벨별 2·3·4, Mine은 3·4·5, Blacksmith는 2·3·4를 지급한다.
- Outpost는 보병, Keep은 보병·창병·궁병, Stronghold와 Castle은 모든 병종을 생산한다.
- 소유 Blacksmith의 최고 레벨을 적용해 Lv.1은 보병·창병 생산비 -1, Lv.2는 궁병까지 -1, Lv.3은 모든 병종 생산비 -2를 제공한다.
- AI는 발전 뒤 자원 5 이상을 남기며 세력 턴마다 최대 한 거점만 발전한다.

### UI

- 군사·방어 거점과 정착지 정보창에는 현재 단계, 다음 단계, 역할 변화와 발전 조건을 표시한다.
- 생산 특화 시설 정보창에는 현재 레벨, 다음 레벨 효과와 개발 조건을 표시한다.
- City와 Castle 발전 화면에는 가능한 3타일·4타일 footprint를 실제 지도 육각 테두리로 미리 표시한다.
- 비소유 거점에서는 발전 정보를 읽기 전용으로 표시하고 발전 버튼을 숨긴다.
- 자원 부족, 해당 턴 발전 완료, 최고 단계, City·Castle 공간 부족을 서로 다른 사유로 안내한다.

### AI

- 모든 유닛이 행동한 뒤, 발전 후에도 안전 자원을 남길 수 있으면 발전 가능한 소유 거점 하나를 선택한다.
- City와 Castle 후보는 각각 유효한 3타일·4타일 footprint가 있을 때만 평가한다.
- 같은 가치의 후보는 현재 단계, 거점 역할 우선순위, 거점 ID 순으로 안정 정렬한다.
- 세력 턴당 AI 발전은 최대 1회다.
- 구체적인 경제·군사 성향은 Milestone 13에서 다룬다.

## 구현 내역

1. 새 `SiteType`, 생산 특화 시설 레벨, Castle footprint 데이터와 스키마 마이그레이션을 추가한다.
2. 두 발전 계열과 생산 특화 시설 개발 규칙을 순수 함수로 구현한다.
3. City의 3타일과 Castle의 4타일 탐색·방향 선택·중복 검증을 구현한다.
4. 거점 정보창의 발전 UI와 footprint 미리보기를 연결한다.
5. AI 거점 선택과 저장·점령·UI 테스트를 추가한다.

## 제외 범위

- 신규 거점 건설(Milestone 14)
- 건물 슬롯·대기열(Milestone 11)
- 유지비(Milestone 12)
- 발전 단계 하락·거점 파괴

## 완료 조건

- 군사·방어 계열이 `Outpost → Keep → Stronghold` 순서로 발전한다.
- 정착 계열이 `Village → City → Castle` 순서로 발전한다.
- Stronghold는 1타일을 유지하고, 정착 계열은 Village 1타일 → City 3타일 → Castle 4타일로 확장된다.
- Farm, Mine, Blacksmith가 생산 특화 시설로 분류되고 다른 종류로 승급하지 않는다.
- 비소유 거점, 자원 부족, 같은 턴 중복 발전, 최고 단계와 City·Castle 공간 부족을 거부한다.
- 저장·불러오기와 점령 후에도 종류·레벨·Castle footprint가 유지된다.
- 플레이어와 AI가 같은 발전·배치 검증 규칙을 사용한다.
- 관련 테스트와 빌드가 통과한다.

## 후속 목표

[Milestone 11: 거점 내정](11-city-administration.md)
