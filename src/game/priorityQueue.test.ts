import { describe, expect, it } from 'vitest'
import { MinPriorityQueue } from './priorityQueue'

describe('MinPriorityQueue', () => {
  it('returns values in comparator order', () => {
    const queue = new MinPriorityQueue<{ cost: number; id: string }>(
      (left, right) =>
        left.cost - right.cost || left.id.localeCompare(right.id),
    )

    queue.push({ cost: 3, id: 'c' })
    queue.push({ cost: 1, id: 'b' })
    queue.push({ cost: 1, id: 'a' })
    queue.push({ cost: 2, id: 'd' })

    expect([
      queue.pop(),
      queue.pop(),
      queue.pop(),
      queue.pop(),
      queue.pop(),
    ]).toEqual([
      { cost: 1, id: 'a' },
      { cost: 1, id: 'b' },
      { cost: 2, id: 'd' },
      { cost: 3, id: 'c' },
      undefined,
    ])
  })
})
