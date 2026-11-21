import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { TurnSummary } from '../game/turnSummary'
import { useLocalization } from '../i18n/locale'

export function TurnSummaryButton({ summary, children }: { summary: TurnSummary; children: ReactNode }) {
  const { t, unitName, siteName, formatNumber } = useLocalization()
  const [view, setView] = useState<'auto' | 'open' | 'closed'>('auto')
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const expanded = view !== 'closed'

  useEffect(() => {
    if (view !== 'auto') return
    const timer = window.setTimeout(() => setView('closed'), 6000)
    return () => window.clearTimeout(timer)
  }, [view])

  useEffect(() => {
    if (view !== 'open') return
    const dismissOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setView('closed')
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setView('closed')
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [view])

  const change = formatNumber(summary.resourceChange)
  return (
    <div ref={root} className="turn-summary">
      <button
        type="button"
        className="status-bar__turn turn-summary__toggle"
        aria-label={t('turnSummary', { turn: summary.turn })}
        aria-expanded={expanded}
        aria-controls={expanded ? id : undefined}
        onClick={() => setView(expanded ? 'closed' : 'open')}
      >
        {children}
      </button>
      {expanded && (
        <div id={id} role="status" className={`turn-summary__panel turn-summary__panel--${view}`}>
          <strong>{t('turnSummary', { turn: summary.turn })}</strong>
          <p>{t('turnFigures', {
            change: summary.resourceChange > 0 ? '+' + change : change,
            count: summary.readyUnits,
          })}</p>
          {summary.lostUnits.length > 0 && <p>{t('lostUnits', { names: summary.lostUnits.map(unitName).join(', ') })}</p>}
          {summary.lostSites.length > 0 && <p>{t('lostSites', { names: summary.lostSites.map(siteName).join(', ') })}</p>}
          {summary.completed.map(({ city, building }) => (
            <p key={city.id}>{t('completedBuilding', { city: siteName(city), building: t(building) })}</p>
          ))}
        </div>
      )}
    </div>
  )
}
