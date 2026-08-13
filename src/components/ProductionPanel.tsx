import { UNIT_STATS, UNIT_TYPE_LABELS, UNIT_TYPES } from '../game/rules'
import type { City, UnitType } from '../game/types'
import { UnitIcon } from './UnitIcon'

type ProductionFeedback = {
  type: 'status' | 'error'
  message: string
}

type ProductionPanelProps = {
  cities: City[]
  selectedCityId?: string
  selectedUnitType?: UnitType
  resource: number
  turn: number
  deployableCount: number
  disabled: boolean
  feedback?: ProductionFeedback
  onCitySelected: (cityId: string) => void
  onUnitTypeSelected: (unitType: UnitType) => void
  onCancel: () => void
}

export function ProductionPanel({
  cities,
  selectedCityId,
  selectedUnitType,
  resource,
  turn,
  deployableCount,
  disabled,
  feedback,
  onCitySelected,
  onUnitTypeSelected,
  onCancel,
}: ProductionPanelProps) {
  const city = cities.find((candidate) => candidate.id === selectedCityId)
  const unavailable =
    disabled || !city || city.lastProducedTurn === turn || deployableCount === 0

  return (
    <section className="production-card" aria-labelledby="production-heading">
      <p className="eyebrow">CITY PRODUCTION</p>
      <h2 id="production-heading">부대 생산</h2>

      {cities.length > 0 ? (
        <>
          <label className="production-card__city">
            <span>생산 도시</span>
            <select
              value={selectedCityId}
              disabled={disabled}
              onChange={(event) => onCitySelected(event.target.value)}
            >
              {cities.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                  {candidate.lastProducedTurn === turn ? ' · 생산 완료' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="production-list">
            {UNIT_TYPES.map((unitType) => {
              const stats = UNIT_STATS[unitType]
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
                  disabled={unavailable || resource < stats.cost}
                  onClick={() => onUnitTypeSelected(unitType)}
                >
                  <strong>
                    <UnitIcon type={unitType} />
                    {UNIT_TYPE_LABELS[unitType]}
                  </strong>
                  <span>{stats.cost} 자원</span>
                  <small>
                    이동 {stats.movement} · 공격 {stats.attack} · 사거리{' '}
                    {stats.range}
                  </small>
                </button>
              )
            })}
          </div>

          {selectedUnitType && (
            <div className="production-card__deployment" role="status">
              <span>청록색 타일에 배치하세요.</span>
              <button type="button" onClick={onCancel}>
                취소 <kbd>Esc</kbd>
              </button>
            </div>
          )}

          {!selectedUnitType && city?.lastProducedTurn === turn && (
            <p className="production-card__notice">이번 라운드 생산 완료</p>
          )}
          {!selectedUnitType && city && deployableCount === 0 && (
            <p className="production-card__notice">배치 가능한 타일 없음</p>
          )}
        </>
      ) : (
        <p className="production-card__empty">생산 가능한 도시가 없습니다.</p>
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
