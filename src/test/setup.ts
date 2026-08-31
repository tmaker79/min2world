import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperty(window.navigator, 'languages', {
  configurable: true,
  value: ['ko-KR'],
})

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
    lineCap: 'butt',
    lineWidth: 1,
    moveTo: () => undefined,
    setTransform: () => undefined,
    stroke: () => undefined,
    strokeStyle: '',
  }
}) as typeof HTMLCanvasElement.prototype.getContext

afterEach(() => {
  cleanup()
})
