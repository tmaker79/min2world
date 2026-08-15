import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

HTMLCanvasElement.prototype.getContext = ((
  contextId: string,
) => {
  if (contextId !== '2d') return null
  return {
    beginPath: () => undefined,
    clearRect: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    fillStyle: '',
    lineTo: () => undefined,
    moveTo: () => undefined,
    setTransform: () => undefined,
  }
}) as typeof HTMLCanvasElement.prototype.getContext

afterEach(() => {
  cleanup()
})
