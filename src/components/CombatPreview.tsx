import { getSiteHpAfterCapture, getSiteMaxHp, resolveCombat, resolveSiteCombat } from '../game/rules'
import type { GameState, Site, Unit } from '../game/types'
import { useLocalization } from '../i18n/locale'
import { ConfirmDialog } from './ConfirmDialog'

type Props = {
  state: GameState
  attacker: Unit
  target: Site | Unit
  returnFocusTo: HTMLElement | null
  onConfirm: () => void
  onCancel: () => void
}

export function CombatPreview({ state, attacker, target, returnFocusTo, onConfirm, onCancel }: Props) {
  const { t, siteName, unitName } = useLocalization()
  const site = 'kind' in target
  const maxHp = site ? getSiteMaxHp(target)! : target.maxHp
  const before = target.hp ?? maxHp
  const result = site
    ? { attackerHp: attacker.hp, defenderHp: resolveSiteCombat(state, attacker, target).siteHp }
    : resolveCombat(state, attacker, target)
  const sides = [
    { role: t('attacker'), name: unitName(attacker), hp: attacker.hp, after: result.attackerHp },
    { role: t('defender'), name: site ? siteName(target) : unitName(target), hp: before, after: result.defenderHp },
  ]

  return (
    <ConfirmDialog
      title={t('combatPreview')}
      confirmLabel={t('attack')}
      returnFocusTo={returnFocusTo}
      onConfirm={onConfirm}
      onCancel={onCancel}
      description={
        <div className="combat-preview">
          {sides.map((side) => (
            <div className="combat-preview__row" key={side.role}>
              <span>{side.role} · <strong>{side.name}</strong></span>
              <span>{t('previewHp', { before: side.hp, after: side.after, damage: side.hp - side.after })}</span>
            </div>
          ))}
          {result.attackerHp === 0 && <p>{t('unitDestroyed', { name: sides[0].name })}</p>}
          {result.defenderHp === 0 && (
            <p>{site
              ? t('previewCapture', { name: sides[1].name, hp: getSiteHpAfterCapture(maxHp) })
              : t('unitDestroyed', { name: sides[1].name })}</p>
          )}
        </div>
      }
    />
  )
}
