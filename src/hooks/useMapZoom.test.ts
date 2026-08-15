import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAP_ZOOM_DEFAULT,
  MAP_ZOOM_FACTOR,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  nextMapZoom,
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
  document.body.appendChild(element)
  return element
}

describe('map zoom helpers', () => {
  it('zooms in and out and clamps to the configured range', () => {
    expect(nextMapZoom(1, -100)).toBeCloseTo(MAP_ZOOM_FACTOR)
    expect(nextMapZoom(1, 100)).toBeCloseTo(1 / MAP_ZOOM_FACTOR)
    expect(nextMapZoom(MAP_ZOOM_MAX, -100)).toBe(MAP_ZOOM_MAX)
    expect(nextMapZoom(MAP_ZOOM_MIN, 100)).toBe(MAP_ZOOM_MIN)
  })

  it('keeps the content point under the cursor stable', () => {
    expect(zoomScrollOffset(100, 50, 1, 2)).toBe(250)
    expect(zoomScrollOffset(250, 50, 2, 1)).toBe(100)
  })
})

describe('useMapZoom', () => {
  afterEach(() => {
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
})
