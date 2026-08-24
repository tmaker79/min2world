import {
  getDisplayedCombatStrength,
  UNIT_STATS,
  UNIT_TYPE_LABELS,
} from '../game/rules'
import type { Unit } from '../game/types'
import { UNIT_UPKEEP } from '../game/upkeep'
import { UnitIcon } from './UnitIcon'

type InfoPanelProps = {
  unit: Unit
  canMove: boolean
  moveMode: boolean
  onMoveModeChange: (active: boolean) => void
  canDisband: boolean
  onDisband: () => void
}

export function InfoPanel({
  unit,
  canMove,
  moveMode,
  onMoveModeChange,
  canDisband,
  onDisband,
}: InfoPanelProps) {
  const stats = UNIT_STATS[unit.type]

  return (
    <div className="city-stack">
      <section className="city-card" aria-label="부대 정보" data-info-mode="unit">
        <div className="city-card__summary">
          <span
            className={`city-card__icon unit-card__icon unit-card__icon--${unit.factionId}`}
            aria-hidden="true"
          >
            <UnitIcon type={unit.type} />
          </span>
          <div>
            <strong>{unit.name}</strong>
            <span>{UNIT_TYPE_LABELS[unit.type]}</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>체력</dt>
            <dd>
              {unit.hp} / {unit.maxHp}
            </dd>
          </div>
          <div>
            <dt>이동</dt>
            <dd>
              {unit.movementRemaining} / {stats.movement}
            </dd>
          </div>
          <div>
            <dt>근접</dt>
            <dd>{getDisplayedCombatStrength(unit, 'melee')}</dd>
          </div>
          <div>
            <dt>유지비</dt>
            <dd>{UNIT_UPKEEP[unit.type]} 자원/턴</dd>
          </div>
          {stats.ranged > 0 && (
            <div>
              <dt>원거리</dt>
              <dd>{getDisplayedCombatStrength(unit, 'ranged')}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="city-card__menu" role="toolbar" aria-label="유닛 메뉴">
        <button
          type="button"
          aria-pressed={moveMode}
          disabled={!canMove}
          title={canMove ? '이동할 타일을 선택합니다.' : '이동 가능한 타일이 없습니다.'}
          onClick={() => onMoveModeChange(!moveMode)}
        >
          이동
        </button>
        <button
          type="button"
          disabled={!canDisband}
          title={canDisband ? '이 부대를 해산합니다.' : '현재 해산할 수 없습니다.'}
          onClick={onDisband}
        >
          해산
        </button>
      </div>
    </div>
  )
}
