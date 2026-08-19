import { SiteIcon } from './SiteIcon'
import { hasTerrainImage, TerrainIcon } from './TerrainIcon'

const TERRAIN_ITEMS = [
  ['plain', '평지', '비용 1'],
  ['desert', '사막', '비용 2'],
  ['forest', '숲', '비용 2 · 전투력 +3'],
  ['hill', '언덕', '비용 2 · 전투력 +3'],
  ['mountain', '산', '이동 불가'],
  ['water', '물', '이동 불가'],
] as const

type LegendProps = {
  embedded?: boolean
}

export function Legend({ embedded = false }: LegendProps) {
  const Heading = embedded ? 'h3' : 'h2'

  return (
    <section
      className={`legend-card${embedded ? ' legend-card--embedded' : ''}`}
      aria-labelledby="legend-heading"
    >
      {!embedded && <p className="eyebrow">MAP LEGEND</p>}
      <Heading id="legend-heading">지도 범례</Heading>
      <ul>
        {TERRAIN_ITEMS.map(([terrain, label, detail]) => (
          <li key={terrain}>
            <span className={`legend-swatch legend-swatch--${terrain}`}>
              {hasTerrainImage(terrain) && <TerrainIcon terrain={terrain} />}
            </span>
            {label} <small>{detail}</small>
          </li>
        ))}
        <li>
          <span className="legend-site legend-site--stronghold">
            <SiteIcon kind="stronghold" />
          </span>
          성 <small>수입 5 · 생산</small>
        </li>
        <li>
          <span className="legend-site legend-site--village">
            <SiteIcon kind="village" />
          </span>
          마을 <small>수입 4</small>
        </li>
        <li>
          <span className="legend-site legend-site--farm">
            <SiteIcon kind="farm" />
          </span>
          농장 <small>수입 2</small>
        </li>
        <li>
          <span className="legend-site legend-site--mine">
            <SiteIcon kind="mine" />
          </span>
          광산 <small>수입 3</small>
        </li>
        <li>
          <span className="legend-flag legend-flag--player" />
          아군 점령
        </li>
        <li>
          <span className="legend-flag legend-flag--enemy" />
          적 점령
        </li>
        <li>
          <span className="legend-swatch legend-swatch--reachable" />
          이동 가능 <small>우클릭</small>
        </li>
        <li>
          <span className="legend-swatch legend-swatch--attackable" />
          공격 가능
        </li>
        <li>
          <span className="legend-swatch legend-swatch--deployable" />
          생산 배치 가능
        </li>
        <li>
          <span className="legend-swatch legend-swatch--zoc" />
          적 통제 구역 <small>진입 시 이동 종료</small>
        </li>
      </ul>
    </section>
  )
}
