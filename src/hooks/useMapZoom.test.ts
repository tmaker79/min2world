import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampMapZoom,
  fitMapZoom,
  getMapCameraGutter,
  MAP_ZOOM_DEFAULT,
  MAP_ZOOM_LEVELS,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  nextMapZoom,
  pinchMapZoom,
  useMapZoom,
  zoomScrollOffset,
  zoomScrollOffsetFromContent,
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
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: 400,
  })
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: 300,
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
    expect(nextMapZoom(1, -100)).toBe(1.1)
    expect(nextMapZoom(1, 100)).toBe(0.9)
    expect(nextMapZoom(MAP_ZOOM_MAX, -100)).toBe(MAP_ZOOM_MAX)
    expect(nextMapZoom(MAP_ZOOM_MIN, 100)).toBe(MAP_ZOOM_MIN)
  })

  it('uses the configured discrete levels for wheel and button steps', () => {
    const zoomedIn: number[] = [MAP_ZOOM_MIN]
    while (zoomedIn.at(-1)! < MAP_ZOOM_MAX) {
      zoomedIn.push(nextMapZoom(zoomedIn.at(-1)!, -100))
    }

    const zoomedOut: number[] = [MAP_ZOOM_MAX]
    while (zoomedOut.at(-1)! > MAP_ZOOM_MIN) {
      zoomedOut.push(nextMapZoom(zoomedOut.at(-1)!, 100))
    }

    expect(zoomedIn).toEqual([...MAP_ZOOM_LEVELS])
    expect(zoomedOut).toEqual([...MAP_ZOOM_LEVELS].reverse())
  })

  it('selects the largest discrete zoom level that fits the viewport', () => {
    expect(fitMapZoom(400, 300, 800, 600)).toBe(0.5)
    expect(fitMapZoom(500, 600, 400, 400)).toBe(1.25)
    expect(fitMapZoom(100, 100, 1000, 1000)).toBe(MAP_ZOOM_MIN)
  })

  it('keeps the content point under the cursor stable', () => {
    expect(zoomScrollOffset(100, 50, 1, 2)).toBe(250)
    expect(zoomScrollOffset(250, 50, 2, 1)).toBe(100)
  })

  it('gives edge tiles enough camera gutter to reach the viewport center', () => {
    expect(getMapCameraGutter(800, 38, 1, 12)).toBe(362)
    expect(getMapCameraGutter(800, 38, 20, 12)).toBe(12)
    expect(getMapCameraGutter(0, 38, 1, 12)).toBe(12)
  })

  it('keeps the map point anchored when the camera gutter changes', () => {
    expect(
      zoomScrollOffsetFromContent(100, 50, 1, 2, 40, 20),
    ).toBe(190)
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

    expect(result.current.zoom).toBe(MAP_ZOOM_DEFAULT)

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

    expect(result.current.zoom).toBeCloseTo(1.1)
    expect(element.scrollLeft).toBeCloseTo(
      zoomScrollOffset(100, 100, 1, 1.1),
    )
    expect(element.scrollTop).toBeCloseTo(
      zoomScrollOffset(80, 60, 1, 1.1),
    )
  })

  it('updates wheel zoom around the map content instead of its camera gutter', () => {
    const element = createScrollElement()
    const mapContent = document.createElement('div')
    mapContent.className = 'map-zoom-shell'
    mapContent.dataset.cameraEdgeCenterX = '38'
    mapContent.dataset.cameraEdgeCenterY = '42'
    mapContent.dataset.cameraMinimumGutterX = '12'
    mapContent.dataset.cameraMinimumGutterY = '8'
    Object.defineProperties(mapContent, {
      offsetLeft: { configurable: true, value: 162 },
      offsetTop: { configurable: true, value: 108 },
    })
    element.appendChild(mapContent)
    const { result } = renderHook(() => useMapZoom(element))

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

    const nextZoom = 1.1
    expect(result.current.zoom).toBeCloseTo(nextZoom)
    expect(element.scrollLeft).toBeCloseTo(
      zoomScrollOffsetFromContent(
        100,
        100,
        1,
        nextZoom,
        162,
        getMapCameraGutter(400, 38, nextZoom, 12),
      ),
    )
    expect(element.scrollTop).toBeCloseTo(
      zoomScrollOffsetFromContent(
        80,
        60,
        1,
        nextZoom,
        108,
        getMapCameraGutter(300, 42, nextZoom, 8),
      ),
    )
  })

  it('steps button zoom around the viewport center and reports its limits', () => {
    const element = createScrollElement()
    const { result } = renderHook(() => useMapZoom(element))

    expect(result.current.canZoomIn).toBe(true)
    expect(result.current.canZoomOut).toBe(true)

    act(() => result.current.zoomIn())

    expect(result.current.zoom).toBeCloseTo(1.1)
    expect(element.scrollLeft).toBeCloseTo(
      zoomScrollOffset(100, 200, 1, 1.1),
    )
    expect(element.scrollTop).toBeCloseTo(
      zoomScrollOffset(80, 150, 1, 1.1),
    )

    act(() => result.current.zoomOut())

    expect(result.current.zoom).toBeCloseTo(MAP_ZOOM_DEFAULT)
    expect(element.scrollLeft).toBeCloseTo(100)
    expect(element.scrollTop).toBeCloseTo(80)

    act(() => {
      for (let step = 0; step < MAP_ZOOM_LEVELS.length; step += 1) {
        result.current.zoomIn()
      }
    })
    expect(result.current.zoom).toBeCloseTo(MAP_ZOOM_MAX)
    expect(result.current.canZoomIn).toBe(false)

    act(() => {
      for (
        let step = 0;
        step < MAP_ZOOM_LEVELS.length;
        step += 1
      ) {
        result.current.zoomOut()
      }
    })
    expect(result.current.zoom).toBeCloseTo(MAP_ZOOM_MIN)
    expect(result.current.canZoomOut).toBe(false)
  })

  it('fits and centers map content in the viewport', () => {
    const element = createScrollElement()
    const mapContent = document.createElement('div')
    mapContent.className = 'map-zoom-shell'
    Object.defineProperties(mapContent, {
      offsetWidth: { configurable: true, value: 800 },
      offsetHeight: { configurable: true, value: 400 },
      offsetLeft: { configurable: true, value: 12 },
      offsetTop: { configurable: true, value: 8 },
    })
    element.appendChild(mapContent)
    const { result } = renderHook(() => useMapZoom(element))

    act(() => result.current.fitToViewport())

    expect(result.current.zoom).toBe(0.5)
    expect(element.scrollLeft).toBeCloseTo(12)
    expect(element.scrollTop).toBe(0)
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

    expect(result.current.zoom).toBeCloseTo(1.2)
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
