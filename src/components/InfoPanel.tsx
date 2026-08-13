import { UNIT_STATS } from '../game/rules'
import type { Unit } from '../game/types'

const UNIT_TYPE_LABELS = {
  infantry: '보병',
  cavalry: '기병',
} as const

type InfoPanelProps = {
  unit?: Unit
}

export function InfoPanel({ unit }: InfoPanelProps) {
  return (
    <section className="info-card" aria-labelledby="unit-info-heading">
      <p className="eyebrow">SELECTED UNIT</p>
      <h2 id="unit-info-heading">부대 정보</h2>

      {unit ? (
        <div className="unit-details">
          <div className="unit-portrait" aria-hidden="true">
            {unit.type === 'infantry' ? '보' : '기'}
          </div>
          <div className="unit-details__heading">
            <strong>{unit.name}</strong>
            <span>{UNIT_TYPE_LABELS[unit.type]}</span>
          </div>
          <dl>
            <div>
              <dt>체력</dt>
              <dd>
                {unit.hp} / {unit.maxHp}
              </dd>
            </div>
            <div>
              <dt>남은 이동력</dt>
              <dd>
                {unit.movementRemaining} / {UNIT_STATS[unit.type].movement}
              </dd>
            </div>
            <div>
              <dt>공격력</dt>
              <dd>{UNIT_STATS[unit.type].attack}</dd>
            </div>
            <div>
              <dt>반격력</dt>
              <dd>{UNIT_STATS[unit.type].counterAttack}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{unit.hasActed ? '행동 완료' : '행동 가능'}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="empty-selection">
          <span aria-hidden="true">◎</span>
          <p>지도에서 푸른 유닛을 선택하면 이동 가능한 지역을 확인할 수 있습니다.</p>
        </div>
      )}
    </section>
  )
}
