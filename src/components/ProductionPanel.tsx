import { UNIT_STATS, UNIT_TYPE_LABELS, UNIT_TYPES } from '../game/rules'
import type { Site, UnitType } from '../game/types'
import { UnitIcon } from './UnitIcon'

type ProductionFeedback = {
  type: 'status' | 'error'
  message: string
}

type ProductionPanelProps = {
  sites: Site[]
  selectedSiteId?: string
  selectedUnitType?: UnitType
  resource: number
  turn: number
  deployableCount: number
  disabled: boolean
  feedback?: ProductionFeedback
  onSiteSelected: (siteId: string) => void
  onUnitTypeSelected: (unitType: UnitType) => void
  onCancel: () => void
}

export function ProductionPanel({
  sites,
  selectedSiteId,
  selectedUnitType,
  resource,
  turn,
  deployableCount,
  disabled,
  feedback,
  onSiteSelected,
  onUnitTypeSelected,
  onCancel,
}: ProductionPanelProps) {
  const site = sites.find((candidate) => candidate.id === selectedSiteId)
  const unavailable =
    disabled || !site || site.lastProducedTurn === turn || deployableCount === 0

  return (
    <section className="production-card" aria-label="부대 생산">
      {sites.length > 0 ? (
        <>
          <label className="production-card__city">
            <select
              aria-label="생산 거점"
              value={selectedSiteId}
              disabled={disabled}
              onChange={(event) => onSiteSelected(event.target.value)}
            >
              {sites.map((candidate) => (
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
                    이동 {stats.movement} · 근접 {stats.melee}
                    {stats.ranged > 0 ? ` · 원거리 ${stats.ranged}` : ''} · 사거리{' '}
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
