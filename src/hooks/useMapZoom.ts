import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export const MAP_ZOOM_DEFAULT = 1
export const MAP_ZOOM_FACTOR = 1.1
export const MAP_ZOOM_STEPS_PER_DIRECTION = 5
export const MAP_ZOOM_MIN =
  MAP_ZOOM_DEFAULT / MAP_ZOOM_FACTOR ** MAP_ZOOM_STEPS_PER_DIRECTION
export const MAP_ZOOM_MAX =
  MAP_ZOOM_DEFAULT * MAP_ZOOM_FACTOR ** MAP_ZOOM_STEPS_PER_DIRECTION

export function nextMapZoom(current: number, deltaY: number): number {
  const next =
    deltaY < 0 ? current * MAP_ZOOM_FACTOR : current / MAP_ZOOM_FACTOR
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, next))
}

export function zoomScrollOffset(
  scroll: number,
  cursorOffset: number,
  oldZoom: number,
  newZoom: number,
): number {
  return ((scroll + cursorOffset) / oldZoom) * newZoom - cursorOffset
}

/** Wheel zoom on a scroll container, keeping the cursor point stable. */
export function useMapZoom(scrollElement: HTMLElement | null) {
  const [zoom, setZoom] = useState(MAP_ZOOM_DEFAULT)
  const zoomRef = useRef(zoom)
  const scrollElementRef = useRef(scrollElement)
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    scrollElementRef.current = scrollElement
  }, [scrollElement])

  useLayoutEffect(() => {
    const element = scrollElementRef.current
    const pending = pendingScrollRef.current
    if (!element || !pending) {
      return
    }

    pendingScrollRef.current = null
    element.scrollLeft = pending.left
    element.scrollTop = pending.top
  }, [zoom])

  useEffect(() => {
    if (!scrollElement) {
      return
    }

    scrollElementRef.current = scrollElement

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const oldZoom = zoomRef.current
      const newZoom = nextMapZoom(oldZoom, event.deltaY)
      if (newZoom === oldZoom) {
        return
      }

      const bounds = scrollElement.getBoundingClientRect()
      const cursorX = event.clientX - bounds.left
      const cursorY = event.clientY - bounds.top
      pendingScrollRef.current = {
        left: zoomScrollOffset(
          scrollElement.scrollLeft,
          cursorX,
          oldZoom,
          newZoom,
        ),
        top: zoomScrollOffset(
          scrollElement.scrollTop,
          cursorY,
          oldZoom,
          newZoom,
        ),
      }
      setZoom(newZoom)
    }

    scrollElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => scrollElement.removeEventListener('wheel', handleWheel)
  }, [scrollElement])

  return zoom
}
