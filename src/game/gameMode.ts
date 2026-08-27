import type { GameMode } from './types'

const QUICK_HOSTNAME = 'min2world.dev'
const STANDARD_HOSTNAME = 'beta.min2world.dev'

export function resolveGameMode(
  hostname: string,
  search = '',
): GameMode {
  const normalizedHostname = hostname.toLowerCase()
  if (normalizedHostname === QUICK_HOSTNAME) return 'quick'
  if (normalizedHostname === STANDARD_HOSTNAME) return 'standard'

  const requestedMode = new URLSearchParams(search).get('mode')
  return requestedMode === 'quick' || requestedMode === 'standard'
    ? requestedMode
    : 'standard'
}
