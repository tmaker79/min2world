import { getSiteHpAfterCapture, getSiteMaxHp, resolveCombat, resolveSiteCombat } from '../game/rules'
import type { GameState, Site, Unit } from '../game/types'
import { useLocalization } from '../i18n/locale'

type Props = {
  state: GameState
  attacker: Unit
  target: Site | Unit
}

export function CombatPreview({ state, attacker, target }: Props) {
  const { t, siteName, unitName } = useLocalization()
  const site = 'kind' in target
  const maxHp = site ? getSiteMaxHp(target)! : target.maxHp
  const before = target.hp ?? maxHp
  const result = site
    ? { attackerHp: attacker.hp, defenderHp: resolveSiteCombat(state, attacker, target).siteHp }
    : resolveCombat(state, attacker, target)
  const sides = [
    { role: t('attacker'), name: unitName(attacker), hp: attacker.hp, after: result.attackerHp, max: attacker.maxHp },
    { role: t('defender'), name: site ? siteName(target) : unitName(target), hp: before, after: result.defenderHp, max: maxHp },
  ]

  return (
    <section className="combat-preview" aria-label={t('combatPreview')}>
      <div className="combat-preview__sides">
        {sides.map((side) => (
          <div className="combat-preview__side" key={side.role}>
            <span>{side.role} · <strong>{side.name}</strong></span>
            <span className="combat-preview__health" aria-hidden="true">
              <span style={{ width: `${100 * side.after / side.max}%` }} />
              <span style={{ width: `${100 * (side.hp - side.after) / side.max}%` }} />
            </span>
            <span>{t('previewHp', { before: side.hp, after: side.after, damage: side.hp - side.after })}</span>
            {side.after === 0 && <strong className="combat-preview__outcome">
              {site && side === sides[1]
                ? t('previewCapture', { name: side.name, hp: getSiteHpAfterCapture(maxHp) })
                : t('unitDestroyed', { name: side.name })}
            </strong>}
          </div>
        ))}
      </div>
    </section>
  )
}
