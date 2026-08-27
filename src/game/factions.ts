export const FACTION_LABELS: Record<string, string> = {
  player: '푸른 연맹',
  enemy: '붉은 제국',
  f1: '청색 연맹',
  f2: '적색 제국',
  f3: '황금 왕국',
  f4: '자색 공국',
  neutral: '중립',
}

export function getFactionLabel(factionId: string): string {
  return FACTION_LABELS[factionId] ?? factionId
}
