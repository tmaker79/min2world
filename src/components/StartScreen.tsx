import { useState } from 'react'
import { BOARD_SIZE_PRESETS } from '../game/hex'
import { createRandomMapSeed } from '../game/mapGenerator'
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
  { id: 'tiny', label: '2인용', detail: '15 × 11', available: true },
  { id: 'small', label: '초소형', detail: '21 × 15', available: true },
  { id: 'standard', label: '소형', detail: '29 × 21', available: true },
  { id: 'large', label: '중형', detail: '41 × 29', available: true },
] as const
type SizeOptionId = (typeof SIZE_OPTIONS)[number]['id']
const ACTIVE_FACTION_COUNT: FactionCount = 2

const MAP_TYPE_OPTIONS: Array<{ id: MapType; label: string; description: string }> = [
  { id: 'balanced', label: '균형', description: '평지와 험지가 고르게 분포합니다.' },
  { id: 'plains', label: '평원', description: '평지가 많아 이동과 확장이 쉽습니다.' },
  { id: 'mountainous', label: '산악', description: '언덕과 산이 많아 이동 경로가 제한됩니다.' },
  { id: 'forested', label: '삼림', description: '숲이 많아 방어적인 전장이 형성됩니다.' },
]

const FACTION_OPTIONS: Array<{ id: FactionId; label: string }> = [
  { id: 'f1', label: '청색 연맹' },
  { id: 'f2', label: '적색 제국' },
]

export function StartScreen({ onStart }: StartScreenProps) {
  const [sizeId, setSizeId] = useState<SizeOptionId>('tiny')
  const [humanFactionId, setHumanFactionId] = useState<FactionId>('f1')
  const [mapType, setMapType] = useState<MapType>('balanced')
  const mapTypeDescription = MAP_TYPE_OPTIONS.find(
    (option) => option.id === mapType,
  )?.description

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
            value={sizeId}
            onChange={(event) => setSizeId(event.target.value as SizeOptionId)}
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
            aria-describedby="map-type-description"
            value={mapType}
            onChange={(event) => setMapType(event.target.value as MapType)}
          >
            {MAP_TYPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <p id="map-type-description" className="start-screen__helper">
            {mapTypeDescription}
          </p>
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

        <div className="start-screen__actions">
          <button
            type="button"
            className="start-screen__start"
            onClick={() => {
              onStart({
                seed: createRandomMapSeed(),
                boardSize: BOARD_SIZE_PRESETS[sizeId],
                factionCount: ACTIVE_FACTION_COUNT,
                humanFactionId,
                mapType,
              })
            }}
          >
            <span>게임 시작</span>
            <span className="start-screen__start-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  )
}
