import {
  getDisplayedCombatStrength,
  isCivilianUnitType,
  SITE_TYPE_LABELS,
  UNIT_STATS,
} from '../game/rules'
import {
  BUILDABLE_SITE_TYPES,
  canConstruct,
  canSettle,
  createProductionSupportIndex,
  getProductionSupportAt,
  getSiteConstructionCost,
} from '../game/settlement'
import type { SiteActionFailure } from '../game/settlement'
import type {
  BuildableSiteType,
  GameState,
  Unit,
} from '../game/types'
import { getUnitUpkeep } from '../game/upkeep'
import { UnitActionIcon } from './UnitActionIcon'
import { UnitIcon } from './UnitIcon'
import { useLocalization } from '../i18n/locale'

type InfoPanelProps = {
  state: GameState
  unit: Unit
  canMove: boolean
  moveMode: boolean
  onMoveModeChange: (active: boolean) => void
  canAttack: boolean
  attackMode: boolean
  onAttackModeChange: (active: boolean) => void
  canDisband: boolean
  onDisband: () => void
  foundingKind?: FoundingKind
  onFoundingKindSelected: (kind: FoundingKind) => void
  onFoundingCancel: () => void
  onFoundingConfirm: () => void
  onClose: () => void
}

export type FoundingKind = 'village' | BuildableSiteType

function failureMessage(reason: SiteActionFailure) {
  switch (reason) {
    case 'invalidTerrain':
      return '현재 지형에는 이 거점을 건설할 수 없습니다.'
    case 'siteOccupied':
      return '현재 타일에 이미 거점이 있습니다.'
    case 'tooCloseToSite':
      return '기존 거점과의 최소 거리가 부족합니다.'
    case 'tooCloseToMilitarySite':
      return '군사 거점 사이에는 최소 한 칸을 두어야 합니다.'
    case 'notConnected':
      return '아군 Town·City에서 통행 가능한 육지 거리 3 이내여야 합니다.'
    case 'outsideTerritory':
      return '생산 거점은 자기 영토에만 건설할 수 있습니다.'
    case 'enemyTerritory':
      return '적 영토에는 군사 거점을 건설할 수 없습니다.'
    case 'productionCapacityReached':
      return '이 정착지의 생산 거점 한도에 도달했습니다.'
    case 'insufficientResources':
      return '건설 비용을 지불할 자원이 부족합니다.'
    case 'insufficientUpkeepReserve':
      return '다음 유지비 예약액을 남겨야 합니다.'
    case 'alreadyActed':
      return '이 유닛은 이번 턴 행동을 마쳤습니다.'
    case 'notSelected':
    case 'inactiveFaction':
    case 'notPlaying':
      return '현재는 이 행동을 실행할 수 없습니다.'
    case 'tileNotFound':
    case 'unitNotFound':
    case 'wrongUnitType':
      return '정착·건설 대상을 확인할 수 없습니다.'
  }
}

export function InfoPanel({
  state,
  unit,
  canMove,
  moveMode,
  onMoveModeChange,
  canAttack,
  attackMode,
  onAttackModeChange,
  canDisband,
  onDisband,
  foundingKind,
  onFoundingKindSelected,
  onFoundingCancel,
  onFoundingConfirm,
  onClose,
}: InfoPanelProps) {
  const { t, unitLabel, unitName } = useLocalization()
  const stats = UNIT_STATS[unit.type]
  const civilian = isCivilianUnitType(unit.type)
  const upkeep = getUnitUpkeep(state, unit.factionId, unit.type)
  const foundingCheck = state.gameMode === 'quick'
    ? undefined
    : foundingKind === 'village'
    ? canSettle(state, unit.id)
    : foundingKind
      ? canConstruct(state, unit.id, foundingKind)
      : undefined
  const productionSupport =
    foundingKind && foundingKind !== 'village' && foundingKind !== 'outpost'
      ? getProductionSupportAt(
          createProductionSupportIndex(state, unit.factionId),
          unit.position,
        )
      : undefined

  return (
    <div className="city-stack">
      <section className="city-card" aria-label={t('unitInfo')} data-info-mode="unit">
        <div className="city-card__summary">
          <span
            className={`city-card__icon unit-card__icon unit-card__icon--${unit.factionId}`}
            aria-hidden="true"
          >
            <UnitIcon type={unit.type} />
          </span>
          <div>
            <strong>{unitName(unit)}</strong>
            <span>{unitLabel(unit.type)}</span>
          </div>
          <button
            type="button"
            className="city-card__close"
            aria-label={t('closeUnitInfo')}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <dl>
          <div>
            <dt>{t('health')}</dt>
            <dd>
              {unit.hp} / {unit.maxHp}
            </dd>
          </div>
          <div>
            <dt>{t('move')}</dt>
            <dd>
              {unit.movementRemaining} / {stats.movement}
            </dd>
          </div>
          {civilian ? (
            <div>
              <dt>{t('role')}</dt>
              <dd>{t('nonCombat')}</dd>
            </div>
          ) : (
            <div>
              <dt>{t('melee')}</dt>
              <dd>{getDisplayedCombatStrength(unit, 'melee')}</dd>
            </div>
          )}
          <div>
            <dt>{t('upkeep')}</dt>
            <dd>{upkeep}</dd>
          </div>
          {stats.ranged > 0 && (
            <div>
              <dt>{t('ranged')}</dt>
              <dd>{getDisplayedCombatStrength(unit, 'ranged')}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="city-card__menu" role="toolbar" aria-label={t('unitMenu')}>
        <button
          className="command-button"
          type="button"
          aria-label={t('move')}
          aria-pressed={moveMode}
          disabled={!canMove}
          title={canMove ? t('moveReady') : t('moveUnavailable')}
          onClick={() => onMoveModeChange(!moveMode)}
        >
          <UnitActionIcon action="move" className="command-button__icon" />
        </button>
        <button
          className="command-button"
          type="button"
          aria-label={t('attack')}
          aria-pressed={attackMode}
          disabled={!canAttack}
          title={canAttack ? t('attackReady') : t('attackUnavailable')}
          onClick={() => onAttackModeChange(!attackMode)}
        >
          <UnitActionIcon action="attack" className="command-button__icon" />
        </button>
        {state.gameMode === 'standard' && unit.type === 'settler' && (
          <button
            type="button"
            aria-pressed={foundingKind === 'village'}
            onClick={() => onFoundingKindSelected('village')}
          >
            정착
          </button>
        )}
        {state.gameMode === 'standard' && (
          <button
            type="button"
            disabled={!canDisband}
            title={canDisband ? '이 부대를 해산합니다.' : '현재 해산할 수 없습니다.'}
            onClick={onDisband}
          >
            해산
          </button>
        )}
      </div>

      {state.gameMode === 'standard' && unit.type === 'builder' && !foundingKind && (
        <section className="civilian-action-card" aria-label="거점 종류 선택">
          <h3>건설할 거점</h3>
          <div className="civilian-action-card__options">
            {BUILDABLE_SITE_TYPES.map((siteKind) => (
              <button
                key={siteKind}
                type="button"
                onClick={() => onFoundingKindSelected(siteKind)}
              >
                <strong>{SITE_TYPE_LABELS[siteKind]}</strong>
                <span>
                  {getSiteConstructionCost(state, unit.factionId, siteKind)} 자원
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {state.gameMode === 'standard' && foundingKind && (
        <section className="civilian-action-card" aria-label="정착 및 건설 확인">
          <h3>{SITE_TYPE_LABELS[foundingKind]} 건설</h3>
          <p>
            {foundingKind === 'village'
              ? '개척자가 소모됩니다.'
              : `${getSiteConstructionCost(state, unit.factionId, foundingKind)} 자원을 지불하고 건설자는 행동을 종료합니다.`}
          </p>
          {productionSupport && (
            <p>
              지원: {productionSupport.settlement.name} · 생산 거점{' '}
              {productionSupport.used}/{productionSupport.capacity}
            </p>
          )}
          {foundingCheck && !foundingCheck.ok && (
            <p className="civilian-action-card__error" role="alert">
              {failureMessage(foundingCheck.reason)}
            </p>
          )}
          <div className="civilian-action-card__confirm">
            <button
              type="button"
              disabled={!foundingCheck?.ok}
              onClick={onFoundingConfirm}
            >
              건설 확인
            </button>
            <button type="button" onClick={onFoundingCancel}>
              취소 <kbd>Esc</kbd>
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
