import type { CSSProperties } from 'react'
import {
  getHexPixelPosition,
  HEX_HEIGHT,
  HEX_WIDTH,
} from '../game/hex'
import type { Position } from '../game/types'

type PixelPosition = {
  x: number
  y: number
}

type ArrowVolleyProps =
  | {
      attacker: Position
      target: Position
      minimumX: number
      minimumY: number
      startPixel?: never
      targetPixel?: never
    }
  | {
      startPixel: PixelPosition
      targetPixel: PixelPosition
      attacker?: never
      target?: never
      minimumX?: never
      minimumY?: never
    }

const START_SPREAD = [
  -14, -8, -2, 4, 10, 14, -11, -5, 1, 7, 13, -13, -7, -1, 5, 11, -9, 9,
] as const
const END_SPREAD = [
  12, -5, 17, -13, 3, -18, 8, -10, 15, -2, -16, 5, -7, 18, -12, 1, 10, -4,
] as const
const IMPACT_DEPTH = [
  -9, 7, -3, 12, -13, 3, 10, -6, 1, -11, 6, 14, -5, 9, -14, 4, -1, 11,
] as const
const BATCH_OFFSETS = [0, 6, 11, 3, 8, 14] as const
const ARROWS = START_SPREAD.map((start, index) => ({
  start,
  end: END_SPREAD[index],
  impactDepth: IMPACT_DEPTH[index],
  arc: 52 + (index % 6) * 4 + Math.floor(index / 6) * 3,
  delay:
    Math.floor(index / BATCH_OFFSETS.length) * 90 +
    BATCH_OFFSETS[index % BATCH_OFFSETS.length],
}))

function toMapPixel(
  position: Position,
  minimumX: number,
  minimumY: number,
): PixelPosition {
  const pixel = getHexPixelPosition(position)
  return {
    x: pixel.x - minimumX + HEX_WIDTH / 2,
    y: pixel.y - minimumY + HEX_HEIGHT / 2,
  }
}

export function ArrowVolley(props: ArrowVolleyProps) {
  const start =
    props.startPixel ??
    toMapPixel(props.attacker, props.minimumX, props.minimumY)
  const target =
    props.targetPixel ??
    toMapPixel(props.target, props.minimumX, props.minimumY)
  const deltaX = target.x - start.x
  const deltaY = target.y - start.y
  const length = Math.hypot(deltaX, deltaY) || 1
  const directionX = deltaX / length
  const directionY = deltaY / length
  const normalX = -deltaY / length
  const normalY = deltaX / length

  return (
    <span className="arrow-volley" data-testid="arrow-volley" aria-hidden="true">
      {ARROWS.map((arrow, index) => {
        const startX = start.x + normalX * arrow.start
        const startY = start.y + normalY * arrow.start
        const endX =
          target.x +
          normalX * arrow.end +
          directionX * arrow.impactDepth
        const endY =
          target.y +
          normalY * arrow.end +
          directionY * arrow.impactDepth
        const riseX = startX + (endX - startX) * 0.24
        const riseY = startY + (endY - startY) * 0.24 - arrow.arc * 0.72
        const midpointX = (startX + endX) / 2
        const midpointY = (startY + endY) / 2 - arrow.arc
        const descentX = startX + (endX - startX) * 0.78
        const descentY = endY - arrow.arc * 0.62
        const startAngle =
          Math.atan2(riseY - startY, riseX - startX) *
          (180 / Math.PI)
        const riseAngle =
          Math.atan2(midpointY - riseY, midpointX - riseX) *
          (180 / Math.PI)
        const midpointAngle =
          Math.atan2(descentY - midpointY, descentX - midpointX) *
          (180 / Math.PI)
        const endAngle =
          Math.atan2(endY - descentY, endX - descentX) * (180 / Math.PI)
        return (
          <span
            key={index}
            className="arrow-volley__arrow"
            data-arrow-index={index}
            style={
              {
                '--arrow-start-x': `${startX}px`,
                '--arrow-start-y': `${startY}px`,
                '--arrow-rise-x': `${riseX}px`,
                '--arrow-rise-y': `${riseY}px`,
                '--arrow-mid-x': `${midpointX}px`,
                '--arrow-mid-y': `${midpointY}px`,
                '--arrow-descent-x': `${descentX}px`,
                '--arrow-descent-y': `${descentY}px`,
                '--arrow-end-x': `${endX}px`,
                '--arrow-end-y': `${endY}px`,
                '--arrow-start-angle': `${startAngle}deg`,
                '--arrow-rise-angle': `${riseAngle}deg`,
                '--arrow-mid-angle': `${midpointAngle}deg`,
                '--arrow-end-angle': `${endAngle}deg`,
                '--arrow-delay': `${arrow.delay}ms`,
              } as CSSProperties
            }
          >
            <span className="arrow-volley__shaft" />
            <span className="arrow-volley__head" />
          </span>
        )
      })}
    </span>
  )
}
