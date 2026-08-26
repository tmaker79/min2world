import {
  CIVILIAN_UNIT_TYPES,
  getProducibleUnitTypes,
  getUnitProductionCost,
  isCivilianUnitType,
  MILITARY_UNIT_TYPES,
  UNIT_STATS,
  UNIT_TYPE_LABELS,
} from '../game/rules'
import type { GameState, Site, UnitType } from '../game/types'
import {
  canSpendWithUpkeepReserve,
  getUnitUpkeep,
} from '../game/upkeep'
import { UnitIcon } from './UnitIcon'

type ProductionFeedback = {
  type: 'status' | 'error'
  message: string
}

type ProductionPanelProps = {
  site?: Site
  state: GameState
  selectedUnitType?: UnitType
  turn: number
  deployableCount: number
  disabled: boolean
  feedback?: ProductionFeedback
  onUnitTypeSelected: (unitType: UnitType) => void
  onCancel: () => void
}

export function ProductionPanel({
  site,
  state,
  selectedUnitType,
  turn,
  deployableCount,
  disabled,
  feedback,
  onUnitTypeSelected,
  onCancel,
}: ProductionPanelProps) {
  const unavailable =
    disabled || !site || site.lastProducedTurn === turn || deployableCount === 0
  const unlockedTypes = site ? getProducibleUnitTypes(site) : []
  const groups = site?.kind === 'city'
    ? [
        { label: '군사 유닛', types: MILITARY_UNIT_TYPES },
        { label: '민간 유닛', types: CIVILIAN_UNIT_TYPES },
      ]
    : [{ label: '군사 유닛', types: MILITARY_UNIT_TYPES }]

  return (
    <section
      id="site-panel-production"
      className="production-card"
      aria-label="부대 생산"
      role="tabpanel"
      aria-labelledby="site-tab-production"
    >
      {site ? (
        <>
          <div className="production-list">
            {groups.map((group) => (
              <section className="production-group" key={group.label}>
                <h3>{group.label}</h3>
                <div className="production-group__options">
                  {group.types.map((unitType) => {
                    const stats = UNIT_STATS[unitType]
                    const unlocked = unlockedTypes.includes(unitType)
                    const cost = getUnitProductionCost(
                      state,
                      state.humanFactionId,
                      unitType,
                      site,
                    )
                    const spending = canSpendWithUpkeepReserve(
                      state,
                      state.humanFactionId,
                      cost,
                      {
                        upkeepDelta: getUnitUpkeep(
                          state,
                          state.humanFactionId,
                          unitType,
                        ),
                      },
                    )
                    return (
                      <button
                        key={unitType}
                        className={
                          selectedUnitType === unitType
                            ? 'production-option production-option--selected'
                            : 'production-option'
                        }
                        type="button"
                        aria-pressed={selectedUnitType === unitType}
                        disabled={!unlocked || unavailable || !spending.ok}
                        onClick={() => onUnitTypeSelected(unitType)}
                      >
                        <strong>
                          <UnitIcon type={unitType} />
                          {UNIT_TYPE_LABELS[unitType]}
                        </strong>
                        <span>{cost} 자원</span>
                        <small>
                          {!unlocked
                            ? `${site.kind} 단계에서는 해금되지 않은 병종입니다.`
                            : !spending.ok &&
                                  spending.reason === 'insufficientUpkeepReserve'
                                ? `다음 유지비 ${spending.reserve} 자원을 남겨야 합니다.`
                                : !spending.ok
                                  ? '자원이 부족합니다.'
                                  : isCivilianUnitType(unitType)
                                    ? `이동 ${stats.movement} · 비전투 · 유지비 ${getUnitUpkeep(state, state.humanFactionId, unitType)}`
                                    : `이동 ${stats.movement} · 근접 ${stats.melee}${
                                        stats.ranged > 0
                                          ? ` · 원거리 ${stats.ranged}`
                                          : ''
                                      } · 사거리 ${stats.range}`}
                        </small>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {selectedUnitType && (
            <div className="production-card__deployment" role="status">
              <span>청록색 타일에 배치하세요.</span>
              <button type="button" onClick={onCancel}>
                취소 <kbd>Esc</kbd>
              </button>
            </div>
          )}

          {!selectedUnitType && site?.lastProducedTurn === turn && (
            <p className="production-card__notice">이번 라운드 생산 완료</p>
          )}
          {!selectedUnitType && site && deployableCount === 0 && (
            <p className="production-card__notice">배치 가능한 타일 없음</p>
          )}
        </>
      ) : (
        <p className="production-card__empty">생산 가능한 거점이 없습니다.</p>
      )}

      {feedback && (
        <p
          className={`production-card__message ${
            feedback.type === 'error'
              ? 'production-card__message--error'
              : ''
          }`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </section>
  )
}
