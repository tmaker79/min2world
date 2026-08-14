import { NewGameMenu } from './NewGameMenu'

type AppChromeProps = {
  mapSeed: string
  seedInput: string
  seedFeedback?: string
  canSave: boolean
  onSeedInputChange: (value: string) => void
  onSeedSubmit: () => boolean
  onRandomRestart: () => boolean
  onOpenSave: () => void
  onSave: () => void
}

export function AppChrome({
  mapSeed,
  seedInput,
  seedFeedback,
  canSave,
  onSeedInputChange,
  onSeedSubmit,
  onRandomRestart,
  onOpenSave,
  onSave,
}: AppChromeProps) {
  return (
    <header className="app-chrome">
      <div className="app-chrome__brand">
        <h1>min2world</h1>
      </div>

      <div className="app-chrome__meta">
        <output className="app-chrome__seed" aria-label="현재 seed">
          seed {mapSeed}
        </output>
        <NewGameMenu
          seedInput={seedInput}
          seedFeedback={seedFeedback}
          onSeedInputChange={onSeedInputChange}
          onSeedSubmit={onSeedSubmit}
          onRandomRestart={onRandomRestart}
        />
        <button
          type="button"
          className="app-chrome__button app-chrome__button--save"
          disabled={!canSave}
          onClick={() => {
            onOpenSave()
            onSave()
          }}
        >
          저장
        </button>
      </div>
    </header>
  )
}
