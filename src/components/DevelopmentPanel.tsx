import {
  canDevelopSite,
  getSiteDevelopmentCost,
  getSiteDevelopmentTarget,
} from '../game/siteDevelopment'
import {
  getSiteIncome,
  isMilitarySiteKind,
  SITE_TYPE_LABELS,
} from '../game/rules'
import type { GameState, Position, Site } from '../game/types'
import {
  formatUpkeepReserveMessage,
  getProjectedUpkeepReserve,
} from '../game/upkeep'

type DevelopmentPanelProps = {
  state: GameState
  site: Site
  footprints: Position[][]
  selectedFootprintIndex: number
  onFootprintSelected: (index: number) => void
  onDevelop: () => void
}

function developmentEffect(site: Site, targetKind?: Site['kind']) {
  if (!targetKind) return '최고 단계에 도달했습니다.'
  if (site.kind === 'blacksmith') return '부대 생산 비용 할인이 강화됩니다.'
  if (site.kind === 'farm' || site.kind === 'mine') {
    return '턴당 자원 수입이 1 증가합니다.'
  }
  if (isMilitarySiteKind(site.kind)) {
    return '최대 체력과 방어력이 강화됩니다.'
  }
  if (site.kind === 'village') return '같은 타일에서 수입이 증가하는 소도시로 발전합니다.'
  if (site.kind === 'town') return '수입이 증가하고 병력 생산이 가능한 1타일 도시가 됩니다.'
  return '수입과 생산 가능한 병종이 강화됩니다.'
}

export function DevelopmentPanel({
  state,
  site,
  footprints,
  selectedFootprintIndex,
  onFootprintSelected,
  onDevelop,
}: DevelopmentPanelProps) {
  const target = getSiteDevelopmentTarget(site)
  const cost = getSiteDevelopmentCost(site, state)
  const owned = site.ownerId === state.humanFactionId
  const requiresFootprint = footprints.length > 1
  const selectedFootprint = footprints[selectedFootprintIndex]
  const check = canDevelopSite(state, site.id, selectedFootprint)
  const nextSite = target
    ? { ...site, kind: target.kind, level: target.level }
    : undefined
  const projectedReserve = getProjectedUpkeepReserve(
    state,
    state.humanFactionId,
    {
      incomeDelta: nextSite
        ? getSiteIncome(nextSite) - getSiteIncome(site)
        : 0,
    },
  )
  let blockedReason: string | undefined

  if (!owned) blockedReason = '비소유 거점은 발전 정보를 열람만 할 수 있습니다.'
  else if (state.phase !== 'playing') blockedReason = '게임이 종료되어 발전할 수 없습니다.'
  else if (state.activeFactionId !== state.humanFactionId) {
    blockedReason = '현재 플레이어의 활성 턴이 아닙니다.'
  } else if (!target) blockedReason = '최고 단계에 도달했습니다.'
  else if (site.lastDevelopedTurn === state.turn) {
    blockedReason = '이번 턴에는 이미 발전을 완료했습니다.'
  } else if (requiresFootprint && footprints.length === 0) {
    blockedReason = '발전에 필요한 공간 또는 유효한 footprint가 없습니다.'
  } else if ((state.resources[state.humanFactionId] ?? 0) < (cost ?? 0)) {
    blockedReason = '발전에 필요한 자원이 부족합니다.'
  } else if (!check.ok) {
    blockedReason =
      check.reason === 'invalidFootprint'
        ? '발전에 필요한 공간 또는 유효한 footprint가 없습니다.'
        : check.reason === 'insufficientUpkeepReserve'
          ? formatUpkeepReserveMessage(projectedReserve)
        : '현재 이 거점을 발전할 수 없습니다.'
  }

  return (
    <section
      id="site-panel-development"
      className="development-card"
      aria-label="거점 발전"
      role="tabpanel"
      aria-labelledby="site-tab-development"
    >
      <dl className="development-card__details">
        <div>
          <dt>현재 단계</dt>
          <dd>
            {SITE_TYPE_LABELS[site.kind]}
            {site.level ? ` Lv.${site.level}` : ''}
          </dd>
        </div>
        <div>
          <dt>다음 단계</dt>
          <dd>
            {target
              ? `${SITE_TYPE_LABELS[target.kind]}${
                  target.level ? ` Lv.${target.level}` : ''
                }`
              : '최고 단계'}
          </dd>
        </div>
        <div>
          <dt>비용</dt>
          <dd>{cost === undefined ? '—' : `${cost} 자원`}</dd>
        </div>
        <div>
          <dt>수입</dt>
          <dd>
            {isMilitarySiteKind(site.kind)
              ? '없음'
              : `${getSiteIncome(site)}${
                  nextSite ? ` → ${getSiteIncome(nextSite)}` : ''
                } 자원/턴`}
          </dd>
        </div>
        <div>
          <dt>효과</dt>
          <dd>{developmentEffect(site, target?.kind)}</dd>
        </div>
      </dl>

      {owned && target && requiresFootprint && footprints.length > 0 && (
        <div className="development-card__directions" aria-label="발전 방향">
          {footprints.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={selectedFootprintIndex === index}
              onClick={() => onFootprintSelected(index)}
            >
              방향 {index + 1}
            </button>
          ))}
        </div>
      )}

      {blockedReason && (
        <p className="development-card__status" role="status">
          {blockedReason}
        </p>
      )}

      {owned && target && (
        <button
          type="button"
          className="development-card__confirm"
          disabled={Boolean(blockedReason)}
          onClick={onDevelop}
        >
          발전 확인
        </button>
      )}
    </section>
  )
}
