import { useEffect, useId, useRef, useState } from 'react'
import resourceMedallionImage from '../assets/ui/resource-medallion.png'
import turnMedallionImage from '../assets/ui/turn-medallion.png'
import type { FactionId } from '../game/types'

type StatusBarProps = {
  turn: number
  resource: number
  income: number
  upkeep: number
  netIncome: number
  upkeepReserve: number
  activeFactionId: FactionId
  humanFactionId: FactionId
  disabled: boolean
  onEndTurn: () => void
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

export function StatusBar({
  turn,
  resource,
  income,
  upkeep,
  netIncome,
  upkeepReserve,
  activeFactionId,
  humanFactionId,
  disabled,
  onEndTurn,
}: StatusBarProps) {
  const [economyExpanded, setEconomyExpanded] = useState(false)
  const economyRef = useRef<HTMLDivElement>(null)
  const economyDetailsId = useId()

  useEffect(() => {
    if (!economyExpanded) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!economyRef.current?.contains(event.target as Node)) {
        setEconomyExpanded(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEconomyExpanded(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [economyExpanded])

  return (
    <section className="status-bar" aria-label="현재 게임 상태">
      <div className="status-bar__summary">
        <span className="status-bar__turn" aria-label={`턴 ${turn}`}>
          <img
            className="status-bar__turn-image"
            src={turnMedallionImage}
            alt=""
            aria-hidden="true"
          />
          <strong aria-hidden="true">{turn}</strong>
        </span>
        <span className="status-bar__dot" aria-hidden="true">
          ·
        </span>
        <div className="status-bar__economy" ref={economyRef}>
          <button
            type="button"
            className="status-bar__economy-toggle"
            aria-label={`자원 ${resource}, 턴 순수입 ${formatSigned(netIncome)}`}
            aria-expanded={economyExpanded}
            aria-controls={economyDetailsId}
            onClick={() => setEconomyExpanded((expanded) => !expanded)}
          >
            <img
              className="status-bar__resource-image"
              src={resourceMedallionImage}
              alt=""
              aria-hidden="true"
            />
            <strong className="status-bar__resource-value" aria-hidden="true">
              {resource}
            </strong>
            <sup
              className={`status-bar__net-income${
                netIncome > 0
                  ? ' status-bar__net-income--positive'
                  : netIncome < 0
                    ? ' status-bar__deficit'
                    : ''
              }`}
              aria-hidden="true"
            >
              {formatSigned(netIncome)}
            </sup>
            <svg
              className="status-bar__economy-chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m7 9 5 5 5-5" />
            </svg>
          </button>
          {economyExpanded && (
            <div
              id={economyDetailsId}
              className="status-bar__economy-popover"
              role="region"
              aria-label="경제 상세"
            >
              <strong className="status-bar__economy-title">경제 상세</strong>
              <dl>
                <div>
                  <dt>수입</dt>
                  <dd>{formatSigned(income)}</dd>
                </div>
                <div>
                  <dt>유지비</dt>
                  <dd>{upkeep > 0 ? `-${upkeep}` : upkeep}</dd>
                </div>
                <div className={netIncome < 0 ? 'status-bar__deficit' : undefined}>
                  <dt>순수입</dt>
                  <dd>{formatSigned(netIncome)}</dd>
                </div>
                {upkeepReserve > 0 && (
                  <div className="status-bar__deficit">
                    <dt>예약 유지비</dt>
                    <dd>{upkeepReserve}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
      <button
        className="end-turn-button"
        type="button"
        disabled={disabled}
        onClick={onEndTurn}
      >
        {activeFactionId !== humanFactionId ? (
          <>
            AI 작전 중…
            <span aria-hidden="true">◆</span>
          </>
        ) : (
          <>
            턴 종료
            <kbd aria-hidden="true">Enter</kbd>
          </>
        )}
      </button>
    </section>
  )
}
