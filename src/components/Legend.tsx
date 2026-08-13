export function Legend() {
  return (
    <section className="legend-card" aria-labelledby="legend-heading">
      <p className="eyebrow">MAP LEGEND</p>
      <h2 id="legend-heading">지도 범례</h2>
      <ul>
        <li>
          <span className="legend-swatch legend-swatch--plain" />
          평지 <small>비용 1</small>
        </li>
        <li>
          <span className="legend-swatch legend-swatch--mountain" />
          산 <small>비용 2</small>
        </li>
        <li>
          <span className="legend-swatch legend-swatch--water" />
          물 <small>이동 불가</small>
        </li>
        <li>
          <span className="legend-swatch legend-swatch--reachable" />
          이동 가능
        </li>
      </ul>
    </section>
  )
}

