import { useEffect, useState } from 'react'

export type MapViewport = {
  left: number
  top: number
  width: number
  height: number
}

const DEFAULT_VIEWPORT: MapViewport = {
  left: 0,
  top: 0,
  width: 1600,
  height: 1000,
}

export function useMapViewport(scrollElement: HTMLElement | null) {
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_VIEWPORT)

  useEffect(() => {
    if (!scrollElement) return

    let frame: number | undefined

    const update = () => {
      frame = undefined
      const width = scrollElement.clientWidth
      const height = scrollElement.clientHeight
      if (width <= 0 || height <= 0) return

      const next = {
        left: scrollElement.scrollLeft,
        top: scrollElement.scrollTop,
        width,
        height,
      }
      setViewport((current) =>
        current.left === next.left &&
        current.top === next.top &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      )
    }

    const scheduleUpdate = () => {
      if (frame !== undefined) return
      frame = window.requestAnimationFrame(update)
    }

    scheduleUpdate()
    scrollElement.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(scheduleUpdate)
    resizeObserver?.observe(scrollElement)

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      scrollElement.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [scrollElement])

  return viewport
}
