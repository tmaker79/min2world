import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMapPan } from './useMapPan'
import { useMapZoom } from './useMapZoom'

function createScrollElement() {
  const element = document.createElement('div')
  let scrollLeft = 40
  let scrollTop = 60

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
  element.setPointerCapture = vi.fn()
  element.releasePointerCapture = vi.fn()
  element.hasPointerCapture = vi.fn(() => true)
  element.scrollBy = vi.fn((options: ScrollToOptions) => {
    scrollLeft += options.left ?? 0
    scrollTop += options.top ?? 0
  }) as typeof element.scrollBy
  document.body.appendChild(element)
  return element
}

function mockAnimationFrames() {
  let nextId = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextId += 1
    callbacks.set(nextId, callback)
    return nextId
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id)
  })

  return {
    run(time: number) {
      const pending = [...callbacks.values()]
      callbacks.clear()
      pending.forEach((callback) => callback(time))
    },
  }
}

describe('useMapPan', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('pans the scroll container after the drag threshold and suppresses the following click', () => {
    vi.useFakeTimers()
    const element = createScrollElement()
    const { result } = renderHook(() => useMapPan(element))

    act(() => {
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          isPrimary: true,
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true,
        }),
      )
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: 120,
          clientY: 90,
          bubbles: true,
        }),
      )
    })

    expect(element.scrollLeft).toBe(20)
    expect(element.scrollTop).toBe(70)
    expect(element.classList.contains('map-scroll--panning')).toBe(true)
    expect(result.current.current).toBe(true)

    act(() => {
      element.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 1,
          clientX: 120,
          clientY: 90,
          bubbles: true,
        }),
      )
    })
    expect(result.current.current).toBe(true)

    act(() => {
      vi.runAllTimers()
    })
    expect(result.current.current).toBe(false)
    vi.useRealTimers()
  })

  it('stops panning for the rest of a touch sequence once pinch begins', () => {
    const element = createScrollElement()
    const gestureStateRef = { current: { pinching: false } }
    const { result } = renderHook(() =>
      useMapPan(element, gestureStateRef),
    )

    act(() => {
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerType: 'touch',
          isPrimary: true,
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true,
        }),
      )
      gestureStateRef.current.pinching = true
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: 'touch',
          pointerId: 1,
          clientX: 130,
          clientY: 80,
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    expect(element.scrollLeft).toBe(40)
    expect(element.scrollTop).toBe(60)
    expect(result.current.current).toBe(true)

    act(() => {
      gestureStateRef.current.pinching = false
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: 'touch',
          pointerId: 1,
          clientX: 160,
          clientY: 60,
          bubbles: true,
        }),
      )
    })

    expect(element.scrollLeft).toBe(40)
    expect(element.scrollTop).toBe(60)
  })

  it('keeps the shared click guard active while pinch pointers remain', () => {
    vi.useFakeTimers()
    const element = createScrollElement()
    const gestureStateRef = { current: { pinching: false } }
    const { result } = renderHook(() => {
      const clickGuardRef = useMapPan(element, gestureStateRef)
      useMapZoom(element, gestureStateRef, clickGuardRef)
      return clickGuardRef
    })

    act(() => {
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerType: 'touch',
          isPrimary: true,
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true,
        }),
      )
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: 'touch',
          pointerId: 1,
          clientX: 120,
          clientY: 90,
          bubbles: true,
          cancelable: true,
        }),
      )
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerType: 'touch',
          isPrimary: false,
          pointerId: 2,
          clientX: 220,
          clientY: 90,
          bubbles: true,
          cancelable: true,
        }),
      )
      element.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerType: 'touch',
          isPrimary: true,
          pointerId: 1,
          clientX: 120,
          clientY: 90,
          bubbles: true,
        }),
      )
    })

    act(() => vi.runAllTimers())
    expect(gestureStateRef.current.pinching).toBe(true)
    expect(result.current.current).toBe(true)

    act(() => {
      element.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerType: 'touch',
          isPrimary: false,
          pointerId: 2,
          clientX: 220,
          clientY: 90,
          bubbles: true,
        }),
      )
    })
    expect(result.current.current).toBe(true)

    act(() => vi.runAllTimers())
    expect(result.current.current).toBe(false)
    vi.useRealTimers()
  })

  it('pans the map with arrow keys and clears tile focus', () => {
    const frames = mockAnimationFrames()
    const element = createScrollElement()
    renderHook(() => useMapPan(element))
    const focusedTile = document.createElement('button')
    focusedTile.className = 'map-tile'
    document.body.appendChild(focusedTile)
    focusedTile.focus()

    act(() => {
      focusedTile.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      )
      frames.run(0)
      frames.run(16)
    })

    expect(element.scrollLeft).toBeGreaterThan(40)
    expect(element.scrollTop).toBe(60)
    expect(element.scrollBy).toHaveBeenLastCalledWith({
      left: expect.any(Number),
      top: 0,
      behavior: 'auto',
    })
    expect(document.activeElement).not.toBe(focusedTile)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }))
      frames.run(32)
      frames.run(48)
    })
  })

  it('scales keyboard panning by zoom to preserve map distance', () => {
    const runAtZoom = (zoom: number) => {
      const frames = mockAnimationFrames()
      const element = createScrollElement()
      const { unmount } = renderHook(() =>
        useMapPan(element, undefined, zoom),
      )

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
        frames.run(0)
        frames.run(16)
      })
      const distance = element.scrollLeft - 40
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }))
      })
      unmount()
      return distance
    }

    const distanceAtOneHundredPercent = runAtZoom(1)
    vi.restoreAllMocks()
    const distanceAtTwoHundredPercent = runAtZoom(2)

    expect(distanceAtTwoHundredPercent).toBeCloseTo(
      distanceAtOneHundredPercent * 2,
    )
  })

  it('leaves arrow keys available while editing a form control', () => {
    const element = createScrollElement()
    renderHook(() => useMapPan(element))
    const input = document.createElement('input')
    document.body.appendChild(input)

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    expect(element.scrollLeft).toBe(40)
    expect(element.scrollTop).toBe(60)
  })
})
