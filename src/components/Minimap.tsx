import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getHexPixelPosition,
  HEX_HEIGHT,
  HEX_WIDTH,
  positionKey,
} from '../game/hex'
import type { GameState, Terrain } from '../game/types'

const TERRAIN_FILL: Record<Terrain, string> = {
  plain: '#8db56e',
  forest: '#365b45',
  hill: '#6a7a48',
  mountain: '#4f5358',
  water: '#365172',
}

const MINIMAP_MAX_WIDTH = 168
const MINIMAP_MAX_HEIGHT = 168

type Viewport = {
  left: number
  top: number
  width: number
  height: number
  contentWidth: number
  contentHeight: number
}

type MinimapProps = {
  state: GameState
  scrollElement: HTMLElement | null
}

function hexPolygon(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
) {
  const halfWidth = width / 2
  const quarterHeight = height / 4
  return [
    `${centerX},${centerY - height / 2}`,
    `${centerX + halfWidth},${centerY - quarterHeight}`,
    `${centerX + halfWidth},${centerY + quarterHeight}`,
    `${centerX},${centerY + height / 2}`,
    `${centerX - halfWidth},${centerY + quarterHeight}`,
    `${centerX - halfWidth},${centerY - quarterHeight}`,
  ].join(' ')
}

export function Minimap({ state, scrollElement }: MinimapProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>()

  const layout = useMemo(() => {
    const pixels = state.tiles.map((tile) => ({
      tile,
      pixel: getHexPixelPosition(tile.position),
    }))
    const minimumX = Math.min(...pixels.map(({ pixel }) => pixel.x))
    const minimumY = Math.min(...pixels.map(({ pixel }) => pixel.y))
    const maximumX = Math.max(...pixels.map(({ pixel }) => pixel.x))
    const maximumY = Math.max(...pixels.map(({ pixel }) => pixel.y))
    const mapWidth = maximumX - minimumX + HEX_WIDTH
    const mapHeight = maximumY - minimumY + HEX_HEIGHT
    const scale = Math.min(
      MINIMAP_MAX_WIDTH / mapWidth,
      MINIMAP_MAX_HEIGHT / mapHeight,
    )

    return {
      minimumX,
      minimumY,
      mapWidth,
      mapHeight,
      scale,
      width: mapWidth * scale,
      height: mapHeight * scale,
      tiles: pixels.map(({ tile, pixel }) => ({
        id: tile.id,
        terrain: tile.terrain,
        x: (pixel.x - minimumX + HEX_WIDTH / 2) * scale,
        y: (pixel.y - minimumY + HEX_HEIGHT / 2) * scale,
        key: positionKey(tile.position),
      })),
    }
  }, [state.tiles])

  const siteMarkers = useMemo(
    () =>
      state.sites.map((site) => {
        const pixel = getHexPixelPosition(site.position)
        return {
          id: site.id,
          ownerId: site.ownerId,
          x: (pixel.x - layout.minimumX + HEX_WIDTH / 2) * layout.scale,
          y: (pixel.y - layout.minimumY + HEX_HEIGHT / 2) * layout.scale,
        }
      }),
    [layout.minimumX, layout.minimumY, layout.scale, state.sites],
  )

  const unitMarkers = useMemo(
    () =>
      state.units.map((unit) => {
        const pixel = getHexPixelPosition(unit.position)
        return {
          id: unit.id,
          factionId: unit.factionId,
          selected: unit.id === state.selectedUnitId,
          x: (pixel.x - layout.minimumX + HEX_WIDTH / 2) * layout.scale,
          y: (pixel.y - layout.minimumY + HEX_HEIGHT / 2) * layout.scale,
        }
      }),
    [
      layout.minimumX,
      layout.minimumY,
      layout.scale,
      state.selectedUnitId,
      state.units,
    ],
  )

  useEffect(() => {
    if (!scrollElement) {
      setViewport(undefined)
      return
    }

    const updateViewport = () => {
      setViewport({
        left: scrollElement.scrollLeft,
        top: scrollElement.scrollTop,
        width: scrollElement.clientWidth,
        height: scrollElement.clientHeight,
        contentWidth: scrollElement.scrollWidth,
        contentHeight: scrollElement.scrollHeight,
      })
    }

    updateViewport()
    scrollElement.addEventListener('scroll', updateViewport, { passive: true })
    window.addEventListener('resize', updateViewport)
    const frame = window.requestAnimationFrame(updateViewport)

    return () => {
      window.cancelAnimationFrame(frame)
      scrollElement.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
    }
  }, [scrollElement, state.mapSeed, state.tiles.length])

  const panTo = (clientX: number, clientY: number) => {
    if (!scrollElement || !rootRef.current) {
      return
    }

    const bounds = rootRef.current.getBoundingClientRect()
    const ratioX = (clientX - bounds.left) / bounds.width
    const ratioY = (clientY - bounds.top) / bounds.height
    const targetLeft =
      ratioX * scrollElement.scrollWidth - scrollElement.clientWidth / 2
    const targetTop =
      ratioY * scrollElement.scrollHeight - scrollElement.clientHeight / 2

    scrollElement.scrollTo({
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
      behavior: 'auto',
    })
  }

  const viewportRect =
    viewport && viewport.contentWidth > 0 && viewport.contentHeight > 0
      ? {
          x: (viewport.left / viewport.contentWidth) * layout.width,
          y: (viewport.top / viewport.contentHeight) * layout.height,
          width: (viewport.width / viewport.contentWidth) * layout.width,
          height: (viewport.height / viewport.contentHeight) * layout.height,
        }
      : undefined

  return (
    <div
      ref={rootRef}
      className="minimap"
      role="img"
      aria-label="미니맵"
      data-testid="minimap"
      onPointerDown={(event) => {
        event.preventDefault()
        rootRef.current?.setPointerCapture(event.pointerId)
        panTo(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (!rootRef.current?.hasPointerCapture(event.pointerId)) {
          return
        }
        panTo(event.clientX, event.clientY)
      }}
    >
      <svg
        className="minimap__svg"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        aria-hidden="true"
      >
        {layout.tiles.map((tile) => (
          <polygon
            key={tile.id}
            className={`minimap__tile minimap__tile--${tile.terrain}`}
            points={hexPolygon(
              tile.x,
              tile.y,
              HEX_WIDTH * layout.scale * 0.98,
              HEX_HEIGHT * layout.scale * 0.98,
            )}
            fill={TERRAIN_FILL[tile.terrain]}
          />
        ))}

        {siteMarkers.map((site) => (
          <rect
            key={site.id}
            className={`minimap__site minimap__site--${site.ownerId}`}
            x={site.x - 2.2}
            y={site.y - 2.2}
            width={4.4}
            height={4.4}
            rx={0.8}
          />
        ))}

        {unitMarkers.map((unit) => (
          <circle
            key={unit.id}
            className={`minimap__unit minimap__unit--${unit.factionId}${
              unit.selected ? ' minimap__unit--selected' : ''
            }`}
            cx={unit.x}
            cy={unit.y}
            r={unit.selected ? 2.6 : 2.1}
          />
        ))}

        {viewportRect && (
          <rect
            className="minimap__viewport"
            x={viewportRect.x}
            y={viewportRect.y}
            width={Math.max(viewportRect.width, 8)}
            height={Math.max(viewportRect.height, 8)}
          />
        )}
      </svg>
    </div>
  )
}
