export class MinPriorityQueue<T> {
  private readonly items: T[] = []

  constructor(private readonly compare: (left: T, right: T) => number) {}

  get size() {
    return this.items.length
  }

  push(item: T) {
    this.items.push(item)
    this.bubbleUp(this.items.length - 1)
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined
    const first = this.items[0]
    const last = this.items.pop()!

    if (this.items.length > 0) {
      this.items[0] = last
      this.sinkDown(0)
    }

    return first
  }

  private bubbleUp(startIndex: number) {
    let index = startIndex
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.compare(this.items[index], this.items[parentIndex]) >= 0) break
      ;[this.items[index], this.items[parentIndex]] = [
        this.items[parentIndex],
        this.items[index],
      ]
      index = parentIndex
    }
  }

  private sinkDown(startIndex: number) {
    let index = startIndex

    while (true) {
      const leftIndex = index * 2 + 1
      const rightIndex = leftIndex + 1
      let smallestIndex = index

      if (
        leftIndex < this.items.length &&
        this.compare(this.items[leftIndex], this.items[smallestIndex]) < 0
      ) {
        smallestIndex = leftIndex
      }
      if (
        rightIndex < this.items.length &&
        this.compare(this.items[rightIndex], this.items[smallestIndex]) < 0
      ) {
        smallestIndex = rightIndex
      }
      if (smallestIndex === index) break

      ;[this.items[index], this.items[smallestIndex]] = [
        this.items[smallestIndex],
        this.items[index],
      ]
      index = smallestIndex
    }
  }
}
