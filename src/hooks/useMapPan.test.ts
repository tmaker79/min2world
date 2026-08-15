import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMapPan } from './useMapPan'

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
  document.body.appendChild(element)
  return element
}

describe('useMapPan', () => {
  afterEach(() => {
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
})
