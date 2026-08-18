import { useState } from 'react'
import { BOARD_SIZE_PRESETS } from '../game/hex'
import { createRandomMapSeed, normalizeMapSeed } from '../game/mapGenerator'
import type { BoardSize, FactionCount, FactionId, MapType } from '../game/types'

type StartScreenProps = {
  onStart: (options: {
    seed: string
    boardSize: BoardSize
    factionCount: FactionCount
    humanFactionId: FactionId
    mapType: MapType
  }) => void
}

const SIZE_OPTIONS = [
  { id: 'tiny', label: '2인용', detail: '15 × 10', available: true },
  { id: 'small', label: '초소형', detail: '21 × 14', available: false },
  { id: 'standard', label: '소형', detail: '42 × 28', available: false },
  { id: 'large', label: '중형', detail: '84 × 56', available: false },
] as const
const ACTIVE_FACTION_COUNT: FactionCount = 2

const MAP_TYPE_OPTIONS: Array<{ id: MapType; label: string }> = [
  { id: 'balanced', label: '균형' },
  { id: 'plains', label: '평원' },
  { id: 'mountainous', label: '산악' },
  { id: 'forested', label: '삼림' },
]

const FACTION_OPTIONS: Array<{ id: FactionId; label: string }> = [
  { id: 'f1', label: '청색 연맹' },
  { id: 'f2', label: '적색 제국' },
]

export function StartScreen({ onStart }: StartScreenProps) {
  const [humanFactionId, setHumanFactionId] = useState<FactionId>('f1')
  const [mapType, setMapType] = useState<MapType>('balanced')
  const [seed, setSeed] = useState(createRandomMapSeed)
  const [error, setError] = useState<string>()

  return (
    <main className="start-screen">
      <section className="start-screen__card" aria-labelledby="start-title">
        <p className="eyebrow">HEX STRATEGY</p>
        <h1 id="start-title">min2world</h1>
        <p className="start-screen__lead">새 전장을 설정하고 원정을 시작하세요.</p>

        <fieldset>
          <legend>지도 크기 선택</legend>
          <select
            className="start-screen__select"
            aria-label="지도 크기 선택"
            defaultValue="tiny"
          >
            {SIZE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id} disabled={!option.available}>
                {option.label} · {option.detail}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>지도 종류 선택</legend>
          <select
            className="start-screen__select"
            aria-label="지도 종류 선택"
            value={mapType}
            onChange={(event) => setMapType(event.target.value as MapType)}
          >
            {MAP_TYPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>세력 선택</legend>
          <select
            className="start-screen__select"
            aria-label="세력 선택"
            value={humanFactionId}
            onChange={(event) => setHumanFactionId(event.target.value as FactionId)}
          >
            {FACTION_OPTIONS.map((faction) => (
              <option key={faction.id} value={faction.id}>{faction.label}</option>
            ))}
          </select>
        </fieldset>

        <label className="start-screen__seed">
          <span>MAP SEED</span>
          <input
            value={seed}
            maxLength={64}
            onChange={(event) => {
              setSeed(event.target.value)
              setError(undefined)
            }}
          />
        </label>
        <div className="start-screen__actions">
          <button type="button" onClick={() => setSeed(createRandomMapSeed())}>
            무작위 seed
          </button>
          <button
            type="button"
            className="start-screen__start"
            onClick={() => {
              const normalized = normalizeMapSeed(seed)
              if (!normalized) {
                setError('seed는 공백이 아닌 1~64자로 입력해 주세요.')
                return
              }
              onStart({
                seed: normalized,
                boardSize: BOARD_SIZE_PRESETS.tiny,
                factionCount: ACTIVE_FACTION_COUNT,
                humanFactionId,
                mapType,
              })
            }}
          >
            게임 시작
          </button>
        </div>
        {error && <p className="new-game-menu__error" role="alert">{error}</p>}
      </section>
    </main>
  )
}
