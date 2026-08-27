import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  getHexPixelPosition,
  HEX_DIRECTIONS,
  HEX_HEIGHT,
  HEX_WIDTH,
  positionKey,
} from '../game/hex'
import { getSiteOccupiedPositions } from '../game/siteFootprint'
import type { TerritoryIndex, TerritoryOwner } from '../game/territory'
import type { GameState, Position, Terrain } from '../game/types'

// App.css의 .map-tile--* 배경색과 동기화해야 한다.
// 단색 지형은 같은 값을, 그라디언트 지형은 어두운 쪽 색을 쓴다.
const TERRAIN_FILL: Record<Terrain, string> = {
  plain: '#8db56e',
  bridge: '#9a7045',
  forest: '#365b45',
  hill: '#6a7a48',
  mountain: '#4f5358',
  water: '#365172',
  desert: '#e0b454',
  desertHill: '#b88135',
  oasis: '#4d9b91',
  tundra: '#9eb4c1',
  tundraForest: '#416c66',
  tundraMountain: '#707f8e',
}

const TERRITORY_FILL: Record<TerritoryOwner, string> = {
  player: '#367da4',
  enemy: '#a94d46',
  f1: '#367da4',
  f2: '#a94d46',
  f3: '#a98235',
  f4: '#7951a5',
  contested: '#6f777c',
}

const TERRITORY_STROKE: Record<TerritoryOwner, string> = {
  player: 'rgba(110, 196, 240, 0.58)',
  enemy: 'rgba(239, 116, 102, 0.58)',
  f1: 'rgba(110, 196, 240, 0.58)',
  f2: 'rgba(239, 116, 102, 0.58)',
  f3: 'rgba(241, 202, 104, 0.58)',
  f4: 'rgba(205, 165, 239, 0.58)',
  contested: 'rgba(220, 225, 228, 0.5)',
}

const MINIMAP_MAX_WIDTH = 230
const MINIMAP_MAX_HEIGHT = 160

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
  territoryByKey: TerritoryIndex
  scrollElement: HTMLElement | null
  zoom?: number
}

type MinimapLayout = {
  minimumX: number
  minimumY: number
  mapWidth: number
  mapHeight: number
  scale: number
  width: number
  height: number
  tiles: Array<{
    id: string
    terrain: Terrain
    position: Position
    x: number
    y: number
    key: string
  }>
}

const MinimapTerrain = memo(function MinimapTerrain({
  layout,
  territoryByKey,
}: {
  layout: MinimapLayout
  territoryByKey: TerritoryIndex
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const pixelRatio = window.devicePixelRatio || 1
    canvas.width = Math.ceil(layout.width * pixelRatio)
    canvas.height = Math.ceil(layout.height * pixelRatio)
    canvas.style.width = `${layout.width}px`
    canvas.style.height = `${layout.height}px`
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, layout.width, layout.height)

    const width = HEX_WIDTH * layout.scale * 0.98
    const height = HEX_HEIGHT * layout.scale * 0.98
    const halfWidth = width / 2
    const quarterHeight = height / 4

    const traceHex = (x: number, y: number) => {
      context.beginPath()
      context.moveTo(x, y - height / 2)
      context.lineTo(x + halfWidth, y - quarterHeight)
      context.lineTo(x + halfWidth, y + quarterHeight)
      context.lineTo(x, y + height / 2)
      context.lineTo(x - halfWidth, y + quarterHeight)
      context.lineTo(x - halfWidth, y - quarterHeight)
      context.closePath()
    }

    for (const tile of layout.tiles) {
      traceHex(tile.x, tile.y)
      context.fillStyle = TERRAIN_FILL[tile.terrain]
      context.fill()
    }

    for (const tile of layout.tiles) {
      const owner = territoryByKey.get(tile.key)
      if (!owner) continue
      traceHex(tile.x, tile.y)
      context.fillStyle = TERRITORY_FILL[owner]
      context.fill()
    }

    context.lineWidth = Math.max(1, layout.scale * 3.4)
    context.lineCap = 'round'
    const edgePoints = [
      [halfWidth, -quarterHeight, halfWidth, quarterHeight],
      [0, -height / 2, halfWidth, -quarterHeight],
      [-halfWidth, -quarterHeight, 0, -height / 2],
      [-halfWidth, quarterHeight, -halfWidth, -quarterHeight],
      [0, height / 2, -halfWidth, quarterHeight],
      [halfWidth, quarterHeight, 0, height / 2],
    ]
    for (const tile of layout.tiles) {
      const owner = territoryByKey.get(tile.key)
      if (!owner) continue
      context.strokeStyle = TERRITORY_STROKE[owner]
      HEX_DIRECTIONS.forEach((direction, side) => {
        const neighborKey = positionKey({
          q: tile.position.q + direction.q,
          r: tile.position.r + direction.r,
        })
        if (territoryByKey.get(neighborKey) === owner) return
        const [x1, y1, x2, y2] = edgePoints[side]
        context.beginPath()
        context.moveTo(tile.x + x1, tile.y + y1)
        context.lineTo(tile.x + x2, tile.y + y2)
        context.stroke()
      })
    }
  }, [layout, territoryByKey])

  return <canvas ref={canvasRef} className="minimap__terrain" aria-hidden="true" />
})

function MinimapComponent({
  state,
  territoryByKey,
  scrollElement,
  zoom = 1,
}: MinimapProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
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
        position: tile.position,
        x: (pixel.x - minimumX + HEX_WIDTH / 2) * scale,
        y: (pixel.y - minimumY + HEX_HEIGHT / 2) * scale,
        key: positionKey(tile.position),
      })),
    } satisfies MinimapLayout
  }, [state.tiles])

  const siteMarkers = useMemo(() => {
    return state.sites.flatMap((site) =>
      getSiteOccupiedPositions(site).map((position) => {
        const pixel = getHexPixelPosition(position)
        return {
          id: `${site.id}:${positionKey(position)}`,
          ownerId: site.ownerId,
          x: (pixel.x - layout.minimumX + HEX_WIDTH / 2) * layout.scale,
          y: (pixel.y - layout.minimumY + HEX_HEIGHT / 2) * layout.scale,
        }
      }),
    )
  }, [layout, state.sites])

  const unitMarkers = useMemo(() => {
    return state.units.map((unit) => {
      const pixel = getHexPixelPosition(unit.position)
      return {
        id: unit.id,
        factionId: unit.factionId,
        selected: unit.id === state.selectedUnitId,
        x: (pixel.x - layout.minimumX + HEX_WIDTH / 2) * layout.scale,
        y: (pixel.y - layout.minimumY + HEX_HEIGHT / 2) * layout.scale,
      }
    })
  }, [layout, state.selectedUnitId, state.units])

  useEffect(() => {
    if (!scrollElement) {
      return
    }

    const updateViewport = () => {
      const mapContent =
        scrollElement.querySelector<HTMLElement>('.map-zoom-shell')
      if (!mapContent) return

      const contentLeft = mapContent.offsetLeft
      const contentTop = mapContent.offsetTop
      const contentWidth = mapContent.offsetWidth
      const contentHeight = mapContent.offsetHeight
      const left = Math.max(0, scrollElement.scrollLeft - contentLeft)
      const top = Math.max(0, scrollElement.scrollTop - contentTop)
      const right = Math.min(
        contentWidth,
        scrollElement.scrollLeft + scrollElement.clientWidth - contentLeft,
      )
      const bottom = Math.min(
        contentHeight,
        scrollElement.scrollTop + scrollElement.clientHeight - contentTop,
      )
      setViewport({
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
        contentWidth,
        contentHeight,
      })
    }

    updateViewport()
    scrollElement.addEventListener('scroll', updateViewport, { passive: true })
    window.addEventListener('resize', updateViewport)
    const frame = window.requestAnimationFrame(updateViewport)
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(updateViewport)
    resizeObserver?.observe(scrollElement)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      scrollElement.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
    }
  }, [scrollElement, state.mapSeed, state.tiles.length, zoom])

  const panTo = (clientX: number, clientY: number) => {
    if (!scrollElement || !bodyRef.current) {
      return
    }

    const bounds = bodyRef.current.getBoundingClientRect()
    const ratioX = (clientX - bounds.left) / bounds.width
    const ratioY = (clientY - bounds.top) / bounds.height
    const mapContent =
      scrollElement.querySelector<HTMLElement>('.map-zoom-shell')
    if (!mapContent) return
    const targetLeft =
      mapContent.offsetLeft +
      ratioX * mapContent.offsetWidth -
      scrollElement.clientWidth / 2
    const targetTop =
      mapContent.offsetTop +
      ratioY * mapContent.offsetHeight -
      scrollElement.clientHeight / 2

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
      className="minimap"
      data-testid="minimap"
      data-territory-count={territoryByKey.size}
    >
      <div
        ref={bodyRef}
        className="minimap__body"
        role="img"
        aria-label="미니맵"
        onPointerDown={(event) => {
          event.preventDefault()
          bodyRef.current?.setPointerCapture(event.pointerId)
          panTo(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (!bodyRef.current?.hasPointerCapture(event.pointerId)) {
            return
          }
          panTo(event.clientX, event.clientY)
        }}
      >
          <MinimapTerrain layout={layout} territoryByKey={territoryByKey} />
          <svg
            className="minimap__svg minimap__overlay"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
          >
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
    </div>
  )
}

export const Minimap = memo(MinimapComponent)
