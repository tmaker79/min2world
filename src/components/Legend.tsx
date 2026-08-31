import {
  isMilitarySiteKind,
  SITE_STATS,
  TERRAIN_COMBAT_BONUS,
  TERRAIN_MOVEMENT_COST,
} from '../game/rules'
import type { GameMode, SiteType } from '../game/types'
import { SiteIcon } from './SiteIcon'
import { hasTerrainImage, TerrainIcon } from './TerrainIcon'
import { useLocalization } from '../i18n/locale'

const TERRAIN_ITEMS = [
  ['plain', '평지', '비용 1'],
  ['bridge', '다리', '비용 1'],
  ['desert', '사막', '비용 2'],
  ['desertHill', '사막 언덕', '비용 2 · 전투력 +3'],
  ['oasis', '오아시스', '비용 1'],
  ['tundra', '툰드라', '비용 2'],
  ['tundraForest', '툰드라 숲', '비용 2 · 전투력 +3'],
  ['tundraMountain', '툰드라 산', '이동 불가'],
  ['forest', '숲', '비용 2 · 전투력 +3'],
  ['hill', '언덕', '비용 2 · 전투력 +3'],
  ['mountain', '산', '이동 불가'],
  ['water', '물', '이동 불가'],
] as const

const QUICK_SITE_ITEMS = [
  'city',
  'farm',
  'mine',
  'blacksmith',
] as const satisfies readonly SiteType[]

const STANDARD_SITE_ITEMS = [
  'outpost',
  'keep',
  'stronghold',
  'village',
  'town',
  'city',
  'farm',
  'mine',
  'blacksmith',
] as const satisfies readonly SiteType[]

function getSiteLegendDetail(kind: SiteType, t: ReturnType<typeof useLocalization>['t']) {
  if (isMilitarySiteKind(kind)) {
    return `${t('income')} ${t('none')} · ${t('defensiveSite')}`
  }

  const income = SITE_STATS[kind].income
  if (kind === 'city') return t('cityIncome', { income })
  if (kind === 'blacksmith') {
    return t('smithyIncome', { income })
  }
  return t('siteIncome', { income })
}

type LegendProps = {
  embedded?: boolean
  gameMode: GameMode
}

export function Legend({ embedded = false, gameMode }: LegendProps) {
  const { t, siteLabel, terrainLabel } = useLocalization()
  const siteItems =
    gameMode === 'quick' ? QUICK_SITE_ITEMS : STANDARD_SITE_ITEMS

  return (
    <section
      className={`legend-card${embedded ? ' legend-card--embedded' : ''}`}
      aria-labelledby={embedded ? undefined : 'legend-heading'}
    >
      {!embedded && (
        <>
          <p className="eyebrow">MAP LEGEND</p>
          <h2 id="legend-heading">{t('mapLegend')}</h2>
        </>
      )}
      <ul>
        {TERRAIN_ITEMS.map(([terrain]) => (
          <li key={terrain}>
            <span className={`legend-swatch legend-swatch--${terrain}`}>
              {hasTerrainImage(terrain) && <TerrainIcon terrain={terrain} />}
            </span>
            {terrainLabel(terrain)}{' '}
            <small>
              {TERRAIN_MOVEMENT_COST[terrain] === null
                ? t('noMove')
                : TERRAIN_COMBAT_BONUS[terrain] > 0
                  ? t('costCombat', { cost: TERRAIN_MOVEMENT_COST[terrain]! })
                  : t('cost', { cost: TERRAIN_MOVEMENT_COST[terrain]! })}
            </small>
          </li>
        ))}
        {siteItems.map((kind) => (
          <li key={kind}>
            <span className={`legend-site legend-site--${kind}`}>
              <SiteIcon kind={kind} />
            </span>
            {siteLabel(kind)} <small>{getSiteLegendDetail(kind, t)}</small>
          </li>
        ))}
        <li>
          <span className="legend-flag legend-flag--player" />
          {t('friendlyCapture')}
        </li>
        <li>
          <span className="legend-flag legend-flag--enemy" />
          {t('enemyCapture')}
        </li>
        <li>
          <span className="legend-swatch legend-swatch--friendly-territory" />
          {t('friendlyTerritory')}
        </li>
        <li>
          <span className="legend-swatch legend-swatch--enemy-territory" />
          {t('enemyTerritory')}
        </li>
        <li>
          <span className="legend-swatch legend-swatch--contested-territory" />
          {t('contested')}
        </li>
        <li>
          <span className="legend-swatch legend-swatch--reachable" />
          {t('reachable')} <small>{t('moveCommand')}</small>
        </li>
        <li>
          <span className="legend-swatch legend-swatch--attackable" />
          {t('attackable')}
        </li>
        <li>
          <span className="legend-swatch legend-swatch--deployable" />
          {t('deployable')}
        </li>
      </ul>
    </section>
  )
}
