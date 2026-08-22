import { useEffect, useRef } from 'react'
import type { MapGestureState, MapGestureStateRef } from './useMapZoom'

const DRAG_THRESHOLD_PX = 6

/** Enables click-drag panning on a scroll container. Returns a ref that is true after a drag so click handlers can ignore it. */
export function useMapPan(
  scrollElement: HTMLElement | null,
  sharedGestureStateRef?: MapGestureStateRef,
) {
  const dragMovedRef = useRef(false)
  const internalGestureStateRef = useRef<MapGestureState>({ pinching: false })
  const gestureStateRef =
    sharedGestureStateRef ?? internalGestureStateRef

  useEffect(() => {
    if (!scrollElement) {
      return
    }

    let pointerId: number | undefined
    let startX = 0
    let startY = 0
    let originLeft = 0
    let originTop = 0
    let panning = false
    let clearTimer: number | undefined

    const endPan = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) {
        return
      }

      const endedDuringPinch = gestureStateRef.current.pinching
      pointerId = undefined
      scrollElement.classList.remove('map-scroll--panning')

      if (
        typeof scrollElement.hasPointerCapture === 'function' &&
        scrollElement.hasPointerCapture(event.pointerId)
      ) {
        scrollElement.releasePointerCapture(event.pointerId)
      }

      if (panning || endedDuringPinch) {
        dragMovedRef.current = true
        window.clearTimeout(clearTimer)
        if (!endedDuringPinch) {
          clearTimer = window.setTimeout(() => {
            dragMovedRef.current = false
          }, 0)
        }
      }

      panning = false
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        event.isPrimary === false ||
        gestureStateRef.current.pinching
      ) {
        return
      }

      window.clearTimeout(clearTimer)
      dragMovedRef.current = false
      pointerId = event.pointerId
      startX = event.clientX
      startY = event.clientY
      originLeft = scrollElement.scrollLeft
      originTop = scrollElement.scrollTop
      panning = false
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) {
        return
      }

      if (gestureStateRef.current.pinching) {
        pointerId = undefined
        panning = false
        dragMovedRef.current = true
        window.clearTimeout(clearTimer)
        scrollElement.classList.remove('map-scroll--panning')
        event.preventDefault()
        return
      }

      const deltaX = event.clientX - startX
      const deltaY = event.clientY - startY

      if (!panning) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
          return
        }

        panning = true
        dragMovedRef.current = true
        scrollElement.classList.add('map-scroll--panning')
        if (typeof scrollElement.setPointerCapture === 'function') {
          scrollElement.setPointerCapture(event.pointerId)
        }
      }

      scrollElement.scrollLeft = originLeft - deltaX
      scrollElement.scrollTop = originTop - deltaY
      event.preventDefault()
    }

    scrollElement.addEventListener('pointerdown', handlePointerDown)
    scrollElement.addEventListener('pointermove', handlePointerMove)
    scrollElement.addEventListener('pointerup', endPan)
    scrollElement.addEventListener('pointercancel', endPan)

    return () => {
      window.clearTimeout(clearTimer)
      scrollElement.classList.remove('map-scroll--panning')
      scrollElement.removeEventListener('pointerdown', handlePointerDown)
      scrollElement.removeEventListener('pointermove', handlePointerMove)
      scrollElement.removeEventListener('pointerup', endPan)
      scrollElement.removeEventListener('pointercancel', endPan)
    }
  }, [gestureStateRef, scrollElement])

  return dragMovedRef
}
