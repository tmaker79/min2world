import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  getHexPixelPosition,
  HEX_HEIGHT,
  HEX_WIDTH,
  positionKey,
} from '../game/hex'
import { getSiteOccupiedPositions } from '../game/siteFootprint'
import type { GameState, Terrain } from '../game/types'

const TERRAIN_FILL: Record<Terrain, string> = {
  plain: '#8db56e',
  bridge: '#9a7045',
  forest: '#365b45',
  hill: '#6a7a48',
  mountain: '#4f5358',
  water: '#365172',
  desert: '#d8aa49',
  desertHill: '#b88135',
  oasis: '#4d9b91',
  tundra: '#91a8b7',
  tundraForest: '#416c66',
  tundraMountain: '#707f8e',
}

const MINIMAP_MAX_WIDTH = 200
const MINIMAP_MAX_HEIGHT = 140

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
    x: number
    y: number
    key: string
  }>
}

const MinimapTerrain = memo(function MinimapTerrain({
  layout,
}: {
  layout: MinimapLayout
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

    for (const tile of layout.tiles) {
      context.beginPath()
      context.moveTo(tile.x, tile.y - height / 2)
      context.lineTo(tile.x + halfWidth, tile.y - quarterHeight)
      context.lineTo(tile.x + halfWidth, tile.y + quarterHeight)
      context.lineTo(tile.x, tile.y + height / 2)
      context.lineTo(tile.x - halfWidth, tile.y + quarterHeight)
      context.lineTo(tile.x - halfWidth, tile.y - quarterHeight)
      context.closePath()
      context.fillStyle = TERRAIN_FILL[tile.terrain]
      context.fill()
    }
  }, [layout])

  return <canvas ref={canvasRef} className="minimap__terrain" aria-hidden="true" />
})

function MinimapComponent({
  state,
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
  }, [scrollElement, state.mapSeed, state.tiles.length, zoom])

  const panTo = (clientX: number, clientY: number) => {
    if (!scrollElement || !bodyRef.current) {
      return
    }

    const bounds = bodyRef.current.getBoundingClientRect()
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
    <div className="minimap" data-testid="minimap">
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
          <MinimapTerrain layout={layout} />
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
