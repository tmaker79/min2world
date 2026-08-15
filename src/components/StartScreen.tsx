import { useState } from 'react'
import { BOARD_SIZE_PRESETS } from '../game/hex'
import { createRandomMapSeed, normalizeMapSeed } from '../game/mapGenerator'
import type { BoardSize, FactionCount, FactionId } from '../game/types'

type StartScreenProps = {
  onStart: (options: {
    seed: string
    boardSize: BoardSize
    factionCount: FactionCount
    humanFactionId: FactionId
  }) => void
}

const SIZE_OPTIONS = [
  { id: 'tiny', label: '초소형', detail: '15 × 10 · 듀얼' },
  { id: 'small', label: '소형', detail: '21 × 14' },
  { id: 'standard', label: '표준', detail: '42 × 28' },
  { id: 'large', label: '대형', detail: '84 × 56' },
] as const

const FACTION_OPTIONS: Array<{ id: FactionId; label: string }> = [
  { id: 'f1', label: '청색 연맹' },
  { id: 'f2', label: '적색 제국' },
  { id: 'f3', label: '황금 왕국' },
  { id: 'f4', label: '자색 공국' },
]

function isTinyBoard(sizeId: keyof typeof BOARD_SIZE_PRESETS): boolean {
  return sizeId === 'tiny'
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [sizeId, setSizeId] = useState<keyof typeof BOARD_SIZE_PRESETS>('standard')
  const [factionCount, setFactionCount] = useState<FactionCount>(2)
  const [humanFactionId, setHumanFactionId] = useState<FactionId>('f1')
  const [seed, setSeed] = useState(createRandomMapSeed)
  const [error, setError] = useState<string>()
  const duelOnly = isTinyBoard(sizeId)
  const effectiveFactionCount: FactionCount = duelOnly ? 2 : factionCount
  const factions = FACTION_OPTIONS.slice(0, effectiveFactionCount)

  const changeSize = (nextSizeId: keyof typeof BOARD_SIZE_PRESETS) => {
    setSizeId(nextSizeId)
    if (isTinyBoard(nextSizeId)) {
      setFactionCount(2)
      if (humanFactionId !== 'f1' && humanFactionId !== 'f2') {
        setHumanFactionId('f1')
      }
    }
  }

  const changeFactionCount = (count: FactionCount) => {
    if (duelOnly && count !== 2) {
      return
    }
    setFactionCount(count)
    if (!FACTION_OPTIONS.slice(0, count).some((faction) => faction.id === humanFactionId)) {
      setHumanFactionId('f1')
    }
  }

  return (
    <main className="start-screen">
      <section className="start-screen__card" aria-labelledby="start-title">
        <p className="eyebrow">HEX STRATEGY</p>
        <h1 id="start-title">min2world</h1>
        <p className="start-screen__lead">새 전장을 설정하고 원정을 시작하세요.</p>

        <fieldset>
          <legend>맵 크기</legend>
          <div className="start-screen__choices">
            {SIZE_OPTIONS.map((option) => (
              <label key={option.id} className="start-screen__choice">
                <input
                  type="radio"
                  name="map-size"
                  checked={sizeId === option.id}
                  onChange={() => changeSize(option.id)}
                />
                <span>{option.label}</span>
                <small>{option.detail}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>세력 수{duelOnly ? ' (듀얼 전용)' : ''}</legend>
          <div className="start-screen__choices">
            {([2, 3, 4] as const).map((count) => (
              <label
                key={count}
                className={`start-screen__choice${duelOnly && count !== 2 ? ' start-screen__choice--disabled' : ''}`}
              >
                <input
                  type="radio"
                  name="faction-count"
                  checked={effectiveFactionCount === count}
                  disabled={duelOnly && count !== 2}
                  onChange={() => changeFactionCount(count)}
                />
                <span>{count} 세력</span>
                <small>{count === 2 ? '1대1 듀얼' : `나 외 ${count - 1} AI`}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>내 세력</legend>
          <div className="start-screen__choices">
            {factions.map((faction) => (
              <label key={faction.id} className={`start-screen__choice faction-${faction.id}`}>
                <input
                  type="radio"
                  name="human-faction"
                  checked={humanFactionId === faction.id}
                  onChange={() => setHumanFactionId(faction.id)}
                />
                <span>{faction.label}</span>
              </label>
            ))}
          </div>
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
                boardSize: BOARD_SIZE_PRESETS[sizeId],
                factionCount: effectiveFactionCount,
                humanFactionId:
                  effectiveFactionCount < 3 &&
                  humanFactionId !== 'f1' &&
                  humanFactionId !== 'f2'
                    ? 'f1'
                    : humanFactionId,
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
