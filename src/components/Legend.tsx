const TERRAIN_ITEMS = [
  ['plain', '평지', '비용 1'],
  ['grassland', '초원', '비용 1'],
  ['steppe', '평원', '비용 1'],
  ['road', '길', '연결 비용 0.5'],
  ['forest', '숲', '비용 2 · 방어 +1'],
  ['hill', '언덕', '비용 2 · 방어 +1'],
  ['mountain', '산', '비용 2 · 방어 +2'],
  ['water', '물', '이동 불가'],
] as const

export function Legend() {
  return (
    <section className="legend-card" aria-labelledby="legend-heading">
      <p className="eyebrow">MAP LEGEND</p>
      <h2 id="legend-heading">지도 범례</h2>
      <ul>
        {TERRAIN_ITEMS.map(([terrain, label, detail]) => (
          <li key={terrain}>
            <span className={`legend-swatch legend-swatch--${terrain}`} />
            {label} <small>{detail}</small>
          </li>
        ))}
        <li><span className="legend-site legend-site--stronghold" />성 <small>수입 5 · 생산</small></li>
        <li><span className="legend-site legend-site--city" />도시 <small>수입 4 · 생산</small></li>
        <li><span className="legend-site legend-site--village" />마을 <small>수입 2</small></li>
        <li><span className="legend-site legend-site--mine" />광산 <small>수입 3</small></li>
        <li><span className="legend-swatch legend-swatch--reachable" />이동 가능</li>
        <li><span className="legend-swatch legend-swatch--attackable" />공격 가능</li>
        <li><span className="legend-swatch legend-swatch--deployable" />생산 배치 가능</li>
        <li><span className="legend-swatch legend-swatch--zoc" />적 통제 구역 <small>진입 시 이동 종료</small></li>
      </ul>
    </section>
  )
}
