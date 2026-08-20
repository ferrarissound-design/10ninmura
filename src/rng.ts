// mulberry32 シード付き擬似乱数生成器。村ごとに異なるシードで初期化する。
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  bool(chance: number): boolean {
    return this.next() < chance;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  weightedPick<T>(items: { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    if (total <= 0) return this.pick(items.map((i) => i.item));
    let r = this.next() * total;
    for (const entry of items) {
      r -= Math.max(0, entry.weight);
      if (r <= 0) return entry.item;
    }
    return items[items.length - 1].item;
  }
}

export function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
