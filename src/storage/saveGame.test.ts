import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../game/initialState'
import { GAME_SCHEMA_VERSION } from '../game/types'
import {
  deleteSavedGame,
  inspectSavedGame,
  loadGame,
  SAVE_STORAGE_KEY,
  saveGame,
} from './saveGame'
import type { StorageLike } from './saveGame'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

function getEnvelope(storage: StorageLike) {
  return JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as Record<
    string,
    unknown
  >
}

function setEnvelope(storage: StorageLike, envelope: unknown) {
  storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(envelope))
}

describe('saveGame storage', () => {
  it('게임을 독립된 상태로 저장하고 같은 핵심 상태를 불러온다', () => {
    const storage = new MemoryStorage()
    const state = {
      ...createInitialGameState(),
      turn: 4,
      selectedUnitId: 'player-infantry-1',
      resources: { player: 12, enemy: 7 },
      units: createInitialGameState().units.map((unit) =>
        unit.id === 'player-infantry-1' ? { ...unit, hp: 6 } : unit,
      ),
    }
    const saved = saveGame(
      state,
      storage,
      new Date('2026-08-13T07:30:00.000Z'),
    )

    expect(saved).toMatchObject({
      ok: true,
      value: {
        schemaVersion: GAME_SCHEMA_VERSION,
        savedAt: '2026-08-13T07:30:00.000Z',
      },
    })

    state.units[0].hp = 1
    const loaded = loadGame(storage)

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) {
      return
    }

    expect(loaded.value.gameState).toMatchObject({
      turn: 4,
      resources: { player: 12, enemy: 7 },
    })
    expect(loaded.value.gameState.selectedUnitId).toBeUndefined()
    expect(
      loaded.value.gameState.units.find(
        (unit) => unit.id === 'player-infantry-1',
      )?.hp,
    ).toBe(6)
    expect(loaded.value.gameState).not.toBe(state)
    expect(loaded.value.gameState.units).not.toBe(state.units)
  })

  it('저장이 없으면 notFound를 반환하고 삭제할 수 있다', () => {
    const storage = new MemoryStorage()

    expect(inspectSavedGame(storage)).toMatchObject({
      ok: false,
      code: 'notFound',
    })

    saveGame(createInitialGameState(), storage)
    expect(deleteSavedGame(storage)).toEqual({ ok: true, value: undefined })
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull()
  })

  it('저장할 수 없는 게임 단계와 AI 턴을 거부한다', () => {
    const storage = new MemoryStorage()
    const state = createInitialGameState()

    for (const invalidState of [
      { ...state, phase: 'victory' as const },
      { ...state, phase: 'defeat' as const },
      { ...state, activeFactionId: 'enemy' as const },
    ]) {
      expect(saveGame(invalidState, storage)).toMatchObject({
        ok: false,
        code: 'invalidData',
      })
    }
  })

  it('손상된 JSON과 지원하지 않는 버전을 구분한다', () => {
    const storage = new MemoryStorage()
    storage.setItem(SAVE_STORAGE_KEY, '{broken')

    expect(loadGame(storage)).toMatchObject({
      ok: false,
      code: 'invalidData',
    })

    setEnvelope(storage, {
      schemaVersion: GAME_SCHEMA_VERSION + 1,
      savedAt: new Date().toISOString(),
      gameState: createInitialGameState(),
    })
    expect(loadGame(storage)).toMatchObject({
      ok: false,
      code: 'unsupportedVersion',
    })
  })

  it('누락 필드와 중복 좌표를 거부한다', () => {
    const storage = new MemoryStorage()
    saveGame(createInitialGameState(), storage)
    const missingTiles = getEnvelope(storage)
    const missingState = missingTiles.gameState as Record<string, unknown>
    delete missingState.tiles
    setEnvelope(storage, missingTiles)

    expect(loadGame(storage)).toMatchObject({
      ok: false,
      code: 'invalidData',
    })

    saveGame(createInitialGameState(), storage)
    const duplicated = getEnvelope(storage)
    const duplicatedState = duplicated.gameState as {
      tiles: Array<Record<string, unknown>>
    }
    duplicatedState.tiles[1].position = duplicatedState.tiles[0].position
    setEnvelope(storage, duplicated)

    expect(loadGame(storage)).toMatchObject({
      ok: false,
      code: 'invalidData',
    })
  })

  it('잘못된 도시 참조와 물 위 유닛을 거부한다', () => {
    const storage = new MemoryStorage()
    saveGame(createInitialGameState(), storage)
    const invalidCity = getEnvelope(storage)
    const cityState = invalidCity.gameState as {
      tiles: Array<Record<string, unknown>>
    }
    const cityTile = cityState.tiles.find((tile) => tile.cityId)
    expect(cityTile).toBeDefined()
    cityTile!.cityId = 'missing-city'
    setEnvelope(storage, invalidCity)

    expect(loadGame(storage)).toMatchObject({
      ok: false,
      code: 'invalidData',
    })

    saveGame(createInitialGameState(), storage)
    const waterUnit = getEnvelope(storage)
    const unitState = waterUnit.gameState as {
      units: Array<Record<string, unknown>>
    }
    unitState.units[0].position = { x: 4, y: 0 }
    setEnvelope(storage, waterUnit)

    expect(loadGame(storage)).toMatchObject({
      ok: false,
      code: 'invalidData',
    })
  })

  it('알 수 없는 필드를 불러온 상태에서 제거한다', () => {
    const storage = new MemoryStorage()
    saveGame(createInitialGameState(), storage)
    const envelope = getEnvelope(storage)
    const state = envelope.gameState as Record<string, unknown>
    const units = state.units as Array<Record<string, unknown>>
    state.unknownState = 'ignored'
    units[0].unknownUnit = true
    setEnvelope(storage, envelope)

    const loaded = loadGame(storage)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) {
      return
    }

    expect(loaded.value.gameState).not.toHaveProperty('unknownState')
    expect(loaded.value.gameState.units[0]).not.toHaveProperty('unknownUnit')
  })

  it('스키마 4 저장을 생산 기록이 없는 스키마 5 상태로 변환한다', () => {
    const storage = new MemoryStorage()
    saveGame(createInitialGameState(), storage)
    const envelope = getEnvelope(storage)
    const state = envelope.gameState as Record<string, unknown>
    envelope.schemaVersion = 4
    state.schemaVersion = 4
    const cities = state.cities as Array<Record<string, unknown>>
    cities.forEach((city) => delete city.lastProducedTurn)
    setEnvelope(storage, envelope)

    const loaded = loadGame(storage)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) {
      return
    }

    expect(loaded.value.schemaVersion).toBe(5)
    expect(loaded.value.gameState.schemaVersion).toBe(5)
    expect(
      loaded.value.gameState.cities.every(
        (city) => !Object.hasOwn(city, 'lastProducedTurn'),
      ),
    ).toBe(true)
  })

  it('신규 병종과 도시 생산 기록을 저장하고 잘못된 생산 턴은 거부한다', () => {
    const storage = new MemoryStorage()
    const initial = createInitialGameState()
    const state = {
      ...initial,
      units: [
        ...initial.units,
        {
          ...initial.units[0],
          id: 'saved-archer',
          name: '저장 궁병',
          type: 'archer' as const,
          position: { x: 0, y: 0 },
          movementRemaining: 0,
          hasActed: true,
        },
      ],
      cities: initial.cities.map((city) =>
        city.id === 'city-player'
          ? { ...city, lastProducedTurn: initial.turn }
          : city,
      ),
    }

    expect(saveGame(state, storage).ok).toBe(true)
    const loaded = loadGame(storage)
    expect(loaded.ok && loaded.value.gameState).toMatchObject({
      units: expect.arrayContaining([
        expect.objectContaining({ id: 'saved-archer', type: 'archer' }),
      ]),
      cities: expect.arrayContaining([
        expect.objectContaining({
          id: 'city-player',
          lastProducedTurn: 1,
        }),
      ]),
    })

    const invalid = getEnvelope(storage)
    const invalidState = invalid.gameState as {
      cities: Array<Record<string, unknown>>
    }
    invalidState.cities[0].lastProducedTurn = 2
    setEnvelope(storage, invalid)
    expect(loadGame(storage)).toMatchObject({
      ok: false,
      code: 'invalidData',
    })
  })

  it('저장소 읽기, 쓰기와 삭제 예외를 안전하게 반환한다', () => {
    const throwingStorage: StorageLike = {
      getItem: () => {
        throw new Error('read failed')
      },
      setItem: () => {
        throw new Error('write failed')
      },
      removeItem: () => {
        throw new Error('delete failed')
      },
    }

    expect(loadGame(throwingStorage)).toMatchObject({
      ok: false,
      code: 'storageUnavailable',
    })
    expect(saveGame(createInitialGameState(), throwingStorage)).toMatchObject({
      ok: false,
      code: 'storageUnavailable',
    })
    expect(deleteSavedGame(throwingStorage)).toMatchObject({
      ok: false,
      code: 'storageUnavailable',
    })
  })
})
