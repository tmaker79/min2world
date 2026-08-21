import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../game/initialState'
import { SITE_TYPE_LABELS } from '../game/rules'
import { getSiteDevelopmentTarget } from '../game/siteDevelopment'
import { getAiActionAnnouncement } from './useAiTurn'

describe('useAiTurn announcements', () => {
  it('announces AI site development with its target type', () => {
    const initial = createInitialGameState('ai-development-announcement')
    const site = initial.sites.find(
      (candidate) =>
        candidate.ownerId !== initial.humanFactionId &&
        getSiteDevelopmentTarget(candidate),
    )!
    const target = getSiteDevelopmentTarget(site)!

    expect(
      getAiActionAnnouncement(initial, {
        type: 'siteDeveloped',
        siteId: site.id,
      }),
    ).toBe(`${site.name}을 ${SITE_TYPE_LABELS[target.kind]}(으)로 발전시킵니다.`)
  })
})
