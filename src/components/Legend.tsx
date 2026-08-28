import {
  isMilitarySiteKind,
  SITE_STATS,
  SITE_TYPE_LABELS,
} from '../game/rules'
import type { GameMode, SiteType } from '../game/types'
import { SiteIcon } from './SiteIcon'
import { hasTerrainImage, TerrainIcon } from './TerrainIcon'

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

function getSiteLegendDetail(kind: SiteType) {
  if (isMilitarySiteKind(kind)) return '수입 없음 · 방어 거점'

  const income = SITE_STATS[kind].income
  if (kind === 'city') return `수입 ${income} · 생산`
  if (kind === 'blacksmith') {
    return `수입 ${income} · 군사 생산비 할인`
  }
  return `수입 ${income}`
}

type LegendProps = {
  embedded?: boolean
  gameMode: GameMode
}

export function Legend({ embedded = false, gameMode }: LegendProps) {
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
          <h2 id="legend-heading">지도 범례</h2>
        </>
      )}
      <ul>
        {TERRAIN_ITEMS.map(([terrain, label, detail]) => (
          <li key={terrain}>
            <span className={`legend-swatch legend-swatch--${terrain}`}>
              {hasTerrainImage(terrain) && <TerrainIcon terrain={terrain} />}
            </span>
            {label} <small>{detail}</small>
          </li>
        ))}
        {siteItems.map((kind) => (
          <li key={kind}>
            <span className={`legend-site legend-site--${kind}`}>
              <SiteIcon kind={kind} />
            </span>
            {SITE_TYPE_LABELS[kind]} <small>{getSiteLegendDetail(kind)}</small>
          </li>
        ))}
        <li>
          <span className="legend-flag legend-flag--player" />
          아군 점령
        </li>
        <li>
          <span className="legend-flag legend-flag--enemy" />
          적 점령
        </li>
        <li>
          <span className="legend-swatch legend-swatch--friendly-territory" />
          아군 영토
        </li>
        <li>
          <span className="legend-swatch legend-swatch--enemy-territory" />
          적 영토
        </li>
        <li>
          <span className="legend-swatch legend-swatch--contested-territory" />
          분쟁 지역
        </li>
        <li>
          <span className="legend-swatch legend-swatch--reachable" />
          이동 가능 <small>이동 명령 또는 우클릭</small>
        </li>
        <li>
          <span className="legend-swatch legend-swatch--attackable" />
          공격 가능
        </li>
        <li>
          <span className="legend-swatch legend-swatch--deployable" />
          생산 배치 가능
        </li>
      </ul>
    </section>
  )
}
