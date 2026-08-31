import {
  CIVILIAN_UNIT_TYPES,
  getProducibleUnitTypes,
  getUnitProductionCost,
  isCivilianUnitType,
  MILITARY_UNIT_TYPES,
  UNIT_STATS,
} from '../game/rules'
import type { GameState, Site, UnitType } from '../game/types'
import {
  canSpendWithUpkeepReserve,
  getUnitUpkeep,
} from '../game/upkeep'
import { UnitIcon } from './UnitIcon'
import { useLocalization } from '../i18n/locale'

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
  const { t, unitLabel } = useLocalization()
  const unavailable =
    disabled || !site || site.lastProducedTurn === turn || deployableCount === 0
  const unlockedTypes = site ? getProducibleUnitTypes(site) : []
  const groups = site?.kind === 'city' && state.gameMode === 'standard'
    ? [
        { label: t('militaryUnits'), types: MILITARY_UNIT_TYPES },
        { label: t('civilianUnits'), types: CIVILIAN_UNIT_TYPES },
      ]
    : [{ label: t('militaryUnits'), types: MILITARY_UNIT_TYPES }]

  return (
    <section
      id="site-panel-production"
      className="production-card"
      aria-label={t('unitProduction')}
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
                          {unitLabel(unitType)}
                        </strong>
                        <span>{t('resources', { cost })}</span>
                        <small>
                          {!unlocked
                            ? `${site.kind} 단계에서는 해금되지 않은 병종입니다.`
                            : !spending.ok &&
                                  spending.reason === 'insufficientUpkeepReserve'
                                ? t('upkeepReserveRequired', {
                                    reserve: spending.reserve,
                                  })
                                : !spending.ok
                                  ? t('insufficientResources')
                                  : isCivilianUnitType(unitType)
                                    ? t('civilianStats', { move: stats.movement, upkeep: getUnitUpkeep(state, state.humanFactionId, unitType) })
                                    : t('militaryStats', { move: stats.movement, melee: stats.melee, ranged: stats.ranged > 0 ? t('rangedStat', { ranged: stats.ranged }) : '', range: stats.range })}
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
              <span>{t('deployPrompt')}</span>
              <button type="button" onClick={onCancel}>
                {t('cancel')} <kbd>Esc</kbd>
              </button>
            </div>
          )}

          {!selectedUnitType && site?.lastProducedTurn === turn && (
            <p className="production-card__notice">{t('productionDone')}</p>
          )}
          {!selectedUnitType && site && deployableCount === 0 && (
            <p className="production-card__notice">{t('noDeployTile')}</p>
          )}
        </>
      ) : (
        <p className="production-card__empty">{t('noProductionSite')}</p>
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
