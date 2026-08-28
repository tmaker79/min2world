import { describe, expect, it } from 'vitest'
import {
  FIRST_TURN_GUIDE_STORAGE_KEYS,
  hasSeenFirstTurnGuide,
  markFirstTurnGuideSeen,
} from './firstTurnGuide'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('first-turn guide storage', () => {
  it('stores quick and standard acknowledgements independently', () => {
    const storage = new MemoryStorage()

    expect(hasSeenFirstTurnGuide('quick', storage)).toBe(false)
    expect(hasSeenFirstTurnGuide('standard', storage)).toBe(false)
    expect(markFirstTurnGuideSeen('quick', storage)).toBe(true)
    expect(hasSeenFirstTurnGuide('quick', storage)).toBe(true)
    expect(hasSeenFirstTurnGuide('standard', storage)).toBe(false)
    expect(storage.getItem(FIRST_TURN_GUIDE_STORAGE_KEYS.quick)).toBe('1')
  })

  it('fails safely when browser storage cannot be read or written', () => {
    const storage = {
      getItem: () => {
        throw new Error('unavailable')
      },
      setItem: () => {
        throw new Error('unavailable')
      },
    }

    expect(hasSeenFirstTurnGuide('quick', storage)).toBe(false)
    expect(markFirstTurnGuideSeen('quick', storage)).toBe(false)
  })
})
