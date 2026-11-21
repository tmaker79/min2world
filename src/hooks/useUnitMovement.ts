import { useLayoutEffect, useRef, useState } from 'react'
import { getHexPixelPosition } from '../game/hex'
import type { UnitMovement } from '../game/movement'

export function useUnitMovement(movement: UnitMovement | undefined, humanTurn: boolean) {
  const movingCell = useRef<HTMLSpanElement>(null)
  const [arrived, setArrived] = useState<UnitMovement>()

  useLayoutEffect(() => {
    const cell = movingCell.current
    if (!movement || !cell) return

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const showStop = humanTurn && movement.stoppedByZoneOfControl
    let noticeTimer: number | undefined
    const onArrival = () => {
      if (!showStop) return
      setArrived(movement)
      noticeTimer = window.setTimeout(() => setArrived(undefined), 1600)
    }

    if (motionPreference.matches || !cell.animate) {
      if (showStop) noticeTimer = window.setTimeout(onArrival, 0)
      return () => window.clearTimeout(noticeTimer)
    }

    // The cell is already at its authoritative destination. Animate offsets in map pixels.
    const points = movement.path.map(getHexPixelPosition)
    const end = points[points.length - 1]
    const animation = cell.animate(
      points.map(({ x, y }) => ({ transform: `translate(${x - end.x}px, ${y - end.y}px)` })),
      { duration: Math.min(320, (points.length - 1) * 100), easing: 'linear' },
    )
    animation.onfinish = onArrival
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches && animation.playState !== 'finished') animation.finish()
    }
    motionPreference.addEventListener('change', onPreferenceChange)
    return () => {
      window.clearTimeout(noticeTimer)
      motionPreference.removeEventListener('change', onPreferenceChange)
      animation.onfinish = null
      animation.cancel()
    }
  }, [movement, humanTurn])

  return { movingCell, showStopNotice: Boolean(movement && arrived === movement) }
}
