import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type MapGestureState = {
  pinching: boolean
}

export type MapGestureStateRef = {
  current: MapGestureState
}

type ClickSuppressRef = {
  current: boolean
}

type PointerPosition = {
  x: number
  y: number
}

export const MAP_ZOOM_DEFAULT = 1
export const MAP_ZOOM_LEVELS = [
  0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2,
] as const
export const MAP_ZOOM_MIN = MAP_ZOOM_LEVELS[0]
export const MAP_ZOOM_MAX = MAP_ZOOM_LEVELS[MAP_ZOOM_LEVELS.length - 1]

export function clampMapZoom(zoom: number): number {
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, zoom))
}

export function fitMapZoom(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
): number {
  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0
  ) {
    return MAP_ZOOM_DEFAULT
  }

  const limit = Math.min(
    viewportWidth / contentWidth,
    viewportHeight / contentHeight,
  )
  return (
    [...MAP_ZOOM_LEVELS].reverse().find((level) => level <= limit) ??
    MAP_ZOOM_MIN
  )
}

export function nextMapZoom(current: number, deltaY: number): number {
  if (deltaY === 0) return clampMapZoom(current)

  const epsilon = 0.000_001
  if (deltaY < 0) {
    return (
      MAP_ZOOM_LEVELS.find((level) => level > current + epsilon) ??
      MAP_ZOOM_MAX
    )
  }

  return (
    [...MAP_ZOOM_LEVELS]
      .reverse()
      .find((level) => level < current - epsilon) ?? MAP_ZOOM_MIN
  )
}

export function pinchMapZoom(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
): number {
  if (startDistance <= 0) return clampMapZoom(startZoom)
  return clampMapZoom(startZoom * (currentDistance / startDistance))
}

export function zoomScrollOffset(
  scroll: number,
  cursorOffset: number,
  oldZoom: number,
  newZoom: number,
): number {
  return ((scroll + cursorOffset) / oldZoom) * newZoom - cursorOffset
}

export function getMapCameraGutter(
  viewportSize: number,
  edgeTileCenter: number,
  zoom: number,
  minimumGutter: number,
): number {
  return Math.max(
    minimumGutter,
    viewportSize / 2 - edgeTileCenter * zoom,
  )
}

export function zoomScrollOffsetFromContent(
  scroll: number,
  anchorOffset: number,
  oldZoom: number,
  newZoom: number,
  oldContentOffset: number,
  newContentOffset: number,
): number {
  const contentPoint =
    (scroll + anchorOffset - oldContentOffset) / oldZoom
  return newContentOffset + contentPoint * newZoom - anchorOffset
}

type CameraAxis = 'x' | 'y'

function cameraContentOffset(
  scrollElement: HTMLElement,
  mapContent: HTMLElement,
  zoom: number,
  axis: CameraAxis,
): number | undefined {
  const edgeTileCenter = Number(
    axis === 'x'
      ? mapContent.dataset.cameraEdgeCenterX
      : mapContent.dataset.cameraEdgeCenterY,
  )
  const minimumGutter = Number(
    axis === 'x'
      ? mapContent.dataset.cameraMinimumGutterX
      : mapContent.dataset.cameraMinimumGutterY,
  )
  if (!Number.isFinite(edgeTileCenter) || !Number.isFinite(minimumGutter)) {
    return undefined
  }

  return getMapCameraGutter(
    axis === 'x' ? scrollElement.clientWidth : scrollElement.clientHeight,
    edgeTileCenter,
    zoom,
    minimumGutter,
  )
}

/** Wheel and touch-pinch zoom on a scroll container, keeping the gesture anchor stable. */
export function useMapZoom(
  scrollElement: HTMLElement | null,
  sharedGestureStateRef?: MapGestureStateRef,
  sharedClickSuppressRef?: ClickSuppressRef,
) {
  const [zoom, setZoom] = useState(MAP_ZOOM_DEFAULT)
  const zoomRef = useRef(zoom)
  const scrollElementRef = useRef(scrollElement)
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null)
  const stepZoomRef = useRef<(deltaY: number) => void>(() => undefined)
  const fitZoomRef = useRef<() => void>(() => undefined)
  const internalGestureStateRef = useRef<MapGestureState>({ pinching: false })
  const internalClickSuppressRef = useRef(false)
  const gestureStateRef =
    sharedGestureStateRef ?? internalGestureStateRef
  const clickSuppressRef =
    sharedClickSuppressRef ?? internalClickSuppressRef

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
    const gestureState = gestureStateRef.current

    const touchPointers = new Map<number, PointerPosition>()
    let pinchStart:
      | {
          distance: number
          zoom: number
          contentX: number
          contentY: number
        }
      | undefined
    let clearSuppressTimer: number | undefined

    const pointerPair = () => {
      const [first, second] = [...touchPointers.values()]
      return first && second ? [first, second] as const : undefined
    }

    const midpoint = (
      first: PointerPosition,
      second: PointerPosition,
    ) => ({
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    })

    const distance = (
      first: PointerPosition,
      second: PointerPosition,
    ) => Math.hypot(second.x - first.x, second.y - first.y)

    const commitZoom = (
      nextZoom: number,
      nextScroll: { left: number; top: number },
    ) => {
      pendingScrollRef.current = nextScroll
      if (nextZoom === zoomRef.current) {
        pendingScrollRef.current = null
        scrollElement.scrollLeft = nextScroll.left
        scrollElement.scrollTop = nextScroll.top
        return
      }

      zoomRef.current = nextZoom
      setZoom(nextZoom)
    }

    const zoomAtAnchor = (
      oldZoom: number,
      newZoom: number,
      anchorX: number,
      anchorY: number,
    ) => {
      const mapContent =
        scrollElement.querySelector<HTMLElement>('.map-zoom-shell')
      const nextContentLeft = mapContent
        ? cameraContentOffset(scrollElement, mapContent, newZoom, 'x')
        : undefined
      const nextContentTop = mapContent
        ? cameraContentOffset(scrollElement, mapContent, newZoom, 'y')
        : undefined

      commitZoom(newZoom, {
        left:
          mapContent && nextContentLeft !== undefined
            ? zoomScrollOffsetFromContent(
                scrollElement.scrollLeft,
                anchorX,
                oldZoom,
                newZoom,
                mapContent.offsetLeft,
                nextContentLeft,
              )
            : zoomScrollOffset(
                scrollElement.scrollLeft,
                anchorX,
                oldZoom,
                newZoom,
              ),
        top:
          mapContent && nextContentTop !== undefined
            ? zoomScrollOffsetFromContent(
                scrollElement.scrollTop,
                anchorY,
                oldZoom,
                newZoom,
                mapContent.offsetTop,
                nextContentTop,
              )
            : zoomScrollOffset(
                scrollElement.scrollTop,
                anchorY,
                oldZoom,
                newZoom,
              ),
      })
    }

    stepZoomRef.current = (deltaY) => {
      const oldZoom = zoomRef.current
      const newZoom = nextMapZoom(oldZoom, deltaY)
      if (newZoom === oldZoom) return

      zoomAtAnchor(
        oldZoom,
        newZoom,
        scrollElement.clientWidth / 2,
        scrollElement.clientHeight / 2,
      )
    }

    fitZoomRef.current = () => {
      const oldZoom = zoomRef.current
      const mapContent =
        scrollElement.querySelector<HTMLElement>('.map-zoom-shell')
      if (!mapContent) return

      const contentWidth = mapContent.offsetWidth / oldZoom
      const contentHeight = mapContent.offsetHeight / oldZoom
      const newZoom = fitMapZoom(
        Math.max(0, scrollElement.clientWidth - 24),
        Math.max(0, scrollElement.clientHeight - 16),
        contentWidth,
        contentHeight,
      )
      const nextContentLeft =
        cameraContentOffset(scrollElement, mapContent, newZoom, 'x') ??
        mapContent.offsetLeft
      const nextContentTop =
        cameraContentOffset(scrollElement, mapContent, newZoom, 'y') ??
        mapContent.offsetTop
      commitZoom(newZoom, {
        left: Math.max(
          0,
          nextContentLeft +
            (contentWidth * newZoom - scrollElement.clientWidth) / 2,
        ),
        top: Math.max(
          0,
          nextContentTop +
            (contentHeight * newZoom - scrollElement.clientHeight) / 2,
        ),
      })
    }

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
      zoomAtAnchor(oldZoom, newZoom, cursorX, cursorY)
    }

    const beginPinch = () => {
      const pair = pointerPair()
      if (!pair) return

      const bounds = scrollElement.getBoundingClientRect()
      const center = midpoint(...pair)
      const localX = center.x - bounds.left
      const localY = center.y - bounds.top
      const startZoom = zoomRef.current
      const mapContent =
        scrollElement.querySelector<HTMLElement>('.map-zoom-shell')
      const contentLeft = mapContent
        ? cameraContentOffset(scrollElement, mapContent, startZoom, 'x') !==
          undefined
          ? mapContent.offsetLeft
          : undefined
        : undefined
      const contentTop = mapContent
        ? cameraContentOffset(scrollElement, mapContent, startZoom, 'y') !==
          undefined
          ? mapContent.offsetTop
          : undefined
        : undefined
      pinchStart = {
        distance: distance(...pair),
        zoom: startZoom,
        contentX:
          (scrollElement.scrollLeft + localX - (contentLeft ?? 0)) /
          startZoom,
        contentY:
          (scrollElement.scrollTop + localY - (contentTop ?? 0)) /
          startZoom,
      }
      gestureState.pinching = true
      clickSuppressRef.current = true
      window.clearTimeout(clearSuppressTimer)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return

      touchPointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
      if (typeof scrollElement.setPointerCapture === 'function') {
        scrollElement.setPointerCapture(event.pointerId)
      }
      if (touchPointers.size === 2) {
        event.preventDefault()
        beginPinch()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (
        event.pointerType !== 'touch' ||
        !touchPointers.has(event.pointerId)
      ) {
        return
      }

      touchPointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
      const pair = pointerPair()
      if (!pinchStart || !pair) return

      event.preventDefault()
      clickSuppressRef.current = true
      const bounds = scrollElement.getBoundingClientRect()
      const center = midpoint(...pair)
      const localX = center.x - bounds.left
      const localY = center.y - bounds.top
      const nextZoom = pinchMapZoom(
        pinchStart.zoom,
        pinchStart.distance,
        distance(...pair),
      )
      const mapContent =
        scrollElement.querySelector<HTMLElement>('.map-zoom-shell')
      const nextContentLeft = mapContent
        ? cameraContentOffset(scrollElement, mapContent, nextZoom, 'x') ?? 0
        : 0
      const nextContentTop = mapContent
        ? cameraContentOffset(scrollElement, mapContent, nextZoom, 'y') ?? 0
        : 0
      commitZoom(nextZoom, {
        left: nextContentLeft + pinchStart.contentX * nextZoom - localX,
        top: nextContentTop + pinchStart.contentY * nextZoom - localY,
      })
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (
        event.pointerType !== 'touch' ||
        !touchPointers.has(event.pointerId)
      ) {
        return
      }

      if (gestureState.pinching) {
        clickSuppressRef.current = true
      }
      touchPointers.delete(event.pointerId)
      pinchStart = undefined
      if (
        typeof scrollElement.hasPointerCapture === 'function' &&
        scrollElement.hasPointerCapture(event.pointerId)
      ) {
        scrollElement.releasePointerCapture(event.pointerId)
      }

      if (touchPointers.size === 0) {
        gestureState.pinching = false
        window.clearTimeout(clearSuppressTimer)
        clearSuppressTimer = window.setTimeout(() => {
          clickSuppressRef.current = false
        }, 0)
      }
    }

    scrollElement.addEventListener('wheel', handleWheel, { passive: false })
    scrollElement.addEventListener('pointerdown', handlePointerDown)
    scrollElement.addEventListener('pointermove', handlePointerMove)
    scrollElement.addEventListener('pointerup', handlePointerEnd)
    scrollElement.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.clearTimeout(clearSuppressTimer)
      stepZoomRef.current = () => undefined
      fitZoomRef.current = () => undefined
      gestureState.pinching = false
      clickSuppressRef.current = false
      scrollElement.removeEventListener('wheel', handleWheel)
      scrollElement.removeEventListener('pointerdown', handlePointerDown)
      scrollElement.removeEventListener('pointermove', handlePointerMove)
      scrollElement.removeEventListener('pointerup', handlePointerEnd)
      scrollElement.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [clickSuppressRef, gestureStateRef, scrollElement])

  return {
    zoom,
    zoomIn: () => stepZoomRef.current(-1),
    zoomOut: () => stepZoomRef.current(1),
    fitToViewport: () => fitZoomRef.current(),
    canZoomIn: zoom < MAP_ZOOM_MAX,
    canZoomOut: zoom > MAP_ZOOM_MIN,
  }
}
