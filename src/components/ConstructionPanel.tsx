import {
  BUILDING_CATEGORY_LABELS,
  BUILDING_DEFINITIONS,
  BUILDING_IDS,
  canCancelConstruction,
  canStartConstruction,
  getBuildingConstructionCost,
} from '../game/cityAdministration'
import type { BuildingId, GameState, Site } from '../game/types'
import { getFactionUpkeepReserve } from '../game/upkeep'

type ConstructionPanelProps = {
  state: GameState
  site: Site
  onStart: (buildingId: BuildingId) => void
  onCancel: () => void
}

const CATEGORIES = ['economy', 'military', 'civic'] as const

function getBlockedReason(
  state: GameState,
  site: Site,
  buildingId: BuildingId,
): string | undefined {
  if (site.ownerId !== state.humanFactionId) return '비소유 도시'
  const check = canStartConstruction(state, site.id, buildingId)
  if (check.ok) return undefined
  switch (check.reason) {
    case 'alreadyBuilt':
      return '완공'
    case 'alreadyQueued':
      return '건설 중'
    case 'queueOccupied':
      return '다른 건물 건설 중'
    case 'insufficientResources':
      return '자원 부족'
    case 'insufficientUpkeepReserve':
      return `다음 유지비 ${getFactionUpkeepReserve(state, state.humanFactionId)} 자원을 남겨야 합니다.`
    case 'notOwned':
      return '비소유 도시'
    case 'inactiveFaction':
      return '활성 턴 아님'
    case 'notPlaying':
      return '게임 종료'
    case 'notCity':
      return 'City 전용'
    case 'siteNotFound':
      return '도시 없음'
  }
}

export function ConstructionPanel({
  state,
  site,
  onStart,
  onCancel,
}: ConstructionPanelProps) {
  const queue = site.constructionQueue
  const queueDefinition = queue
    ? BUILDING_DEFINITIONS[queue.buildingId]
    : undefined

  return (
    <section
      id="site-panel-construction"
      className="construction-card"
      aria-label="도시 건설"
      role="tabpanel"
      aria-labelledby="site-tab-construction"
    >
      {queue && queueDefinition && (
        <div className="construction-queue" role="status">
          <div>
            <strong>{queueDefinition.label} 건설 중</strong>
            <span>남은 {queue.turnsRemaining}턴</span>
          </div>
          <button
            type="button"
            disabled={!canCancelConstruction(state, site.id)}
            onClick={onCancel}
          >
            건설 취소
          </button>
          <small>취소해도 자원은 환불되지 않습니다.</small>
        </div>
      )}

      {CATEGORIES.map((category) => (
        <div className="construction-group" key={category}>
          <h3>{BUILDING_CATEGORY_LABELS[category]}</h3>
          <div className="construction-list">
            {BUILDING_IDS.filter(
              (buildingId) =>
                BUILDING_DEFINITIONS[buildingId].category === category,
            ).map((buildingId) => {
              const definition = BUILDING_DEFINITIONS[buildingId]
              const cost = getBuildingConstructionCost(
                state,
                state.humanFactionId,
                buildingId,
              )
              const reason = getBlockedReason(state, site, buildingId)
              const built = site.buildings.includes(buildingId)
              const queued = queue?.buildingId === buildingId
              return (
                <button
                  key={buildingId}
                  type="button"
                  className="construction-option"
                  data-building-status={
                    built ? 'completed' : queued ? 'queued' : 'available'
                  }
                  disabled={Boolean(reason)}
                  onClick={() => onStart(buildingId)}
                >
                  <strong>
                    <span>{definition.label}</span>
                    <span>{built ? '완공' : queued ? '건설 중' : `${cost} 자원`}</span>
                  </strong>
                  <span>{definition.turns}턴 · {definition.effect}</span>
                  {reason && !built && !queued && <small>{reason}</small>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
