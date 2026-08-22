import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampMapZoom,
  MAP_ZOOM_DEFAULT,
  MAP_ZOOM_FACTOR,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  MAP_ZOOM_STEPS_PER_DIRECTION,
  nextMapZoom,
  pinchMapZoom,
  useMapZoom,
  zoomScrollOffset,
} from './useMapZoom'

function createScrollElement() {
  const element = document.createElement('div')
  let scrollLeft = 100
  let scrollTop = 80

  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value
    },
  })
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value
    },
  })
  element.getBoundingClientRect = () =>
    ({
      left: 40,
      top: 20,
      right: 440,
      bottom: 320,
      width: 400,
      height: 300,
      x: 40,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect
  element.setPointerCapture = vi.fn()
  element.releasePointerCapture = vi.fn()
  element.hasPointerCapture = vi.fn(() => true)
  document.body.appendChild(element)
  return element
}

function dispatchTouchPointer(
  element: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  pointerId: number,
  clientX: number,
  clientY: number,
  isPrimary: boolean,
) {
  element.dispatchEvent(
    new PointerEvent(type, {
      pointerId,
      pointerType: 'touch',
      isPrimary,
      button: 0,
      clientX,
      clientY,
      bubbles: true,
      cancelable: true,
    }),
  )
}

describe('map zoom helpers', () => {
  it('zooms in and out and clamps to the configured range', () => {
    expect(nextMapZoom(1, -100)).toBeCloseTo(MAP_ZOOM_FACTOR)
    expect(nextMapZoom(1, 100)).toBeCloseTo(1 / MAP_ZOOM_FACTOR)
    expect(nextMapZoom(MAP_ZOOM_MAX, -100)).toBe(MAP_ZOOM_MAX)
    expect(nextMapZoom(MAP_ZOOM_MIN, 100)).toBe(MAP_ZOOM_MIN)
  })

  it('limits zoom to five steps in either direction from the default', () => {
    let zoomedIn = MAP_ZOOM_DEFAULT
    let zoomedOut = MAP_ZOOM_DEFAULT

    for (let step = 0; step < MAP_ZOOM_STEPS_PER_DIRECTION; step += 1) {
      zoomedIn = nextMapZoom(zoomedIn, -100)
      zoomedOut = nextMapZoom(zoomedOut, 100)
    }

    expect(zoomedIn).toBeCloseTo(MAP_ZOOM_MAX)
    expect(zoomedOut).toBeCloseTo(MAP_ZOOM_MIN)
    expect(nextMapZoom(zoomedIn, -100)).toBe(MAP_ZOOM_MAX)
    expect(nextMapZoom(zoomedOut, 100)).toBe(MAP_ZOOM_MIN)
  })

  it('keeps the content point under the cursor stable', () => {
    expect(zoomScrollOffset(100, 50, 1, 2)).toBe(250)
    expect(zoomScrollOffset(250, 50, 2, 1)).toBe(100)
  })

  it('scales pinch zoom continuously and clamps to the configured range', () => {
    expect(pinchMapZoom(1, 100, 120)).toBeCloseTo(1.2)
    expect(pinchMapZoom(1, 100, 80)).toBeCloseTo(0.8)
    expect(pinchMapZoom(MAP_ZOOM_MAX, 100, 200)).toBe(MAP_ZOOM_MAX)
    expect(pinchMapZoom(MAP_ZOOM_MIN, 100, 20)).toBe(MAP_ZOOM_MIN)
    expect(clampMapZoom(Number.POSITIVE_INFINITY)).toBe(MAP_ZOOM_MAX)
  })
})

describe('useMapZoom', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('updates zoom and scroll from wheel events around the cursor', () => {
    const element = createScrollElement()
    const { result } = renderHook(() => useMapZoom(element))

    expect(result.current).toBe(MAP_ZOOM_DEFAULT)

    act(() => {
      element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -120,
          clientX: 140,
          clientY: 80,
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    expect(result.current).toBeCloseTo(MAP_ZOOM_FACTOR)
    expect(element.scrollLeft).toBeCloseTo(
      zoomScrollOffset(100, 100, 1, MAP_ZOOM_FACTOR),
    )
    expect(element.scrollTop).toBeCloseTo(
      zoomScrollOffset(80, 60, 1, MAP_ZOOM_FACTOR),
    )
  })

  it('prevents the default wheel scroll behavior', () => {
    const element = createScrollElement()
    renderHook(() => useMapZoom(element))
    const event = new WheelEvent('wheel', {
      deltaY: 120,
      clientX: 100,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    act(() => {
      element.dispatchEvent(event)
    })

    expect(preventDefault).toHaveBeenCalled()
  })

  it('zooms around a moving two-finger midpoint', () => {
    const element = createScrollElement()
    const gestureStateRef = { current: { pinching: false } }
    const clickSuppressRef = { current: false }
    const { result } = renderHook(() =>
      useMapZoom(element, gestureStateRef, clickSuppressRef),
    )

    act(() => {
      dispatchTouchPointer(element, 'pointerdown', 1, 140, 100, true)
      dispatchTouchPointer(element, 'pointerdown', 2, 240, 100, false)
      dispatchTouchPointer(element, 'pointermove', 2, 260, 100, false)
    })

    expect(result.current).toBeCloseTo(1.2)
    expect(element.scrollLeft).toBeCloseTo(140)
    expect(element.scrollTop).toBeCloseTo(112)
    expect(gestureStateRef.current.pinching).toBe(true)
    expect(clickSuppressRef.current).toBe(true)
  })

  it('keeps clicks suppressed until every pinch pointer is released', () => {
    vi.useFakeTimers()
    const element = createScrollElement()
    const gestureStateRef = { current: { pinching: false } }
    const clickSuppressRef = { current: false }
    renderHook(() => useMapZoom(element, gestureStateRef, clickSuppressRef))

    act(() => {
      dispatchTouchPointer(element, 'pointerdown', 1, 140, 100, true)
      dispatchTouchPointer(element, 'pointerdown', 2, 240, 100, false)
      dispatchTouchPointer(element, 'pointerup', 1, 140, 100, true)
    })

    expect(gestureStateRef.current.pinching).toBe(true)
    expect(clickSuppressRef.current).toBe(true)

    act(() => {
      dispatchTouchPointer(element, 'pointerup', 2, 240, 100, false)
    })
    expect(gestureStateRef.current.pinching).toBe(false)
    expect(clickSuppressRef.current).toBe(true)

    act(() => vi.runAllTimers())
    expect(clickSuppressRef.current).toBe(false)
  })
})
