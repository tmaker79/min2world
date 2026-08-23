import { useEffect, useRef } from 'react'
import type { MapGestureState, MapGestureStateRef } from './useMapZoom'

const DRAG_THRESHOLD_PX = 6
export const MAP_KEYBOARD_PAN_MAX_SPEED = 0.65
export const MAP_KEYBOARD_PAN_ACCELERATION = 0.004
const MAP_KEYBOARD_PAN_DECELERATION = 0.006
const MAP_KEYBOARD_PAN_STOP_THRESHOLD = 0.01

/** Enables click-drag panning on a scroll container. Returns a ref that is true after a drag so click handlers can ignore it. */
export function useMapPan(
  scrollElement: HTMLElement | null,
  sharedGestureStateRef?: MapGestureStateRef,
  zoom = 1,
  sharedDragMovedRef?: { current: boolean },
) {
  const internalDragMovedRef = useRef(false)
  const dragMovedRef = sharedDragMovedRef ?? internalDragMovedRef
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
    const pressedArrowKeys = new Set<string>()
    let keyboardFrame: number | undefined
    let keyboardFrameTime: number | undefined
    let keyboardVelocityX = 0
    let keyboardVelocityY = 0

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

    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)

    const approach = (current: number, target: number, amount: number) => {
      if (current < target) return Math.min(target, current + amount)
      if (current > target) return Math.max(target, current - amount)
      return current
    }

    const animateKeyboardPan = (time: number) => {
      const elapsed = Math.min(
        32,
        keyboardFrameTime === undefined ? 16 : time - keyboardFrameTime,
      )
      keyboardFrameTime = time

      const directionX =
        (pressedArrowKeys.has('ArrowRight') ? 1 : 0) -
        (pressedArrowKeys.has('ArrowLeft') ? 1 : 0)
      const directionY =
        (pressedArrowKeys.has('ArrowDown') ? 1 : 0) -
        (pressedArrowKeys.has('ArrowUp') ? 1 : 0)
      const directionLength = Math.hypot(directionX, directionY) || 1
      const hasDirection = directionX !== 0 || directionY !== 0
      const maxSpeed = MAP_KEYBOARD_PAN_MAX_SPEED * zoom
      const targetVelocityX = hasDirection
        ? (directionX / directionLength) * maxSpeed
        : 0
      const targetVelocityY = hasDirection
        ? (directionY / directionLength) * maxSpeed
        : 0
      const acceleration =
        (hasDirection
          ? MAP_KEYBOARD_PAN_ACCELERATION
          : MAP_KEYBOARD_PAN_DECELERATION) *
        zoom *
        elapsed

      keyboardVelocityX = approach(
        keyboardVelocityX,
        targetVelocityX,
        acceleration,
      )
      keyboardVelocityY = approach(
        keyboardVelocityY,
        targetVelocityY,
        acceleration,
      )

      scrollElement.scrollBy({
        left: keyboardVelocityX * elapsed,
        top: keyboardVelocityY * elapsed,
        behavior: 'auto',
      })

      if (
        hasDirection ||
        Math.abs(keyboardVelocityX) > MAP_KEYBOARD_PAN_STOP_THRESHOLD ||
        Math.abs(keyboardVelocityY) > MAP_KEYBOARD_PAN_STOP_THRESHOLD
      ) {
        keyboardFrame = window.requestAnimationFrame(animateKeyboardPan)
        return
      }

      keyboardFrame = undefined
      keyboardFrameTime = undefined
      keyboardVelocityX = 0
      keyboardVelocityY = 0
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        isEditableTarget(target) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return
      }

      if (!event.key.startsWith('Arrow')) return

      event.preventDefault()
      if (target instanceof HTMLElement && target.closest('.map-tile')) {
        target.blur()
      }
      pressedArrowKeys.add(event.key)
      if (keyboardFrame === undefined) {
        keyboardFrame = window.requestAnimationFrame(animateKeyboardPan)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedArrowKeys.delete(event.key)
    }

    const handleWindowBlur = () => {
      pressedArrowKeys.clear()
    }

    scrollElement.addEventListener('pointerdown', handlePointerDown)
    scrollElement.addEventListener('pointermove', handlePointerMove)
    scrollElement.addEventListener('pointerup', endPan)
    scrollElement.addEventListener('pointercancel', endPan)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.clearTimeout(clearTimer)
      if (keyboardFrame !== undefined) {
        window.cancelAnimationFrame(keyboardFrame)
      }
      scrollElement.classList.remove('map-scroll--panning')
      scrollElement.removeEventListener('pointerdown', handlePointerDown)
      scrollElement.removeEventListener('pointermove', handlePointerMove)
      scrollElement.removeEventListener('pointerup', endPan)
      scrollElement.removeEventListener('pointercancel', endPan)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [dragMovedRef, gestureStateRef, scrollElement, zoom])

  return dragMovedRef
}
