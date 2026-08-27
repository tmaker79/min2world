import { describe, expect, it } from 'vitest'
import { resolveGameMode } from './gameMode'

describe('game mode resolution', () => {
  it('locks official domains to their assigned modes', () => {
    expect(resolveGameMode('min2world.dev', '?mode=standard')).toBe('quick')
    expect(resolveGameMode('beta.min2world.dev', '?mode=quick')).toBe('standard')
  })

  it('uses query overrides on local and preview hosts', () => {
    expect(resolveGameMode('localhost', '?mode=quick')).toBe('quick')
    expect(resolveGameMode('preview.workers.dev', '?mode=standard')).toBe('standard')
  })

  it('defaults unknown hosts and invalid queries to standard mode', () => {
    expect(resolveGameMode('localhost')).toBe('standard')
    expect(resolveGameMode('localhost', '?mode=unknown')).toBe('standard')
  })
})
