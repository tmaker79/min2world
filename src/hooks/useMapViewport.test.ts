import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useMapViewport } from './useMapViewport'

describe('useMapViewport', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('tracks scroll position and viewport dimensions', async () => {
    const element = document.createElement('div')
    let scrollLeft = 0
    let scrollTop = 0
    Object.defineProperties(element, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft,
        set: (value: number) => {
          scrollLeft = value
        },
      },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value
        },
      },
    })
    document.body.appendChild(element)

    const { result } = renderHook(() => useMapViewport(element))
    await waitFor(() =>
      expect(result.current).toEqual({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    )

    act(() => {
      element.scrollLeft = 420
      element.scrollTop = 180
      element.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() =>
      expect(result.current).toEqual({
        left: 420,
        top: 180,
        width: 800,
        height: 600,
      }),
    )
  })
})
