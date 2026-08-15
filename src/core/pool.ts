export interface Poolable {
  active: boolean;
  poolIndex: number;
}

/**
 * Vorab gefüllter Objektpool. obtain()/release() sind O(1) über einen
 * Freilisten-Stack, im Simulationsloop wird nichts neu allokiert.
 */
export class Pool<T extends Poolable> {
  readonly items: readonly T[];
  private readonly free: Int32Array;
  private freeCount: number;
  activeCount = 0;

  constructor(size: number, factory: () => T) {
    const items: T[] = new Array<T>(size);
    this.free = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      const item = factory();
      item.active = false;
      item.poolIndex = i;
      items[i] = item;
      this.free[i] = size - 1 - i;
    }
    this.items = items;
    this.freeCount = size;
  }

  obtain(): T | null {
    if (this.freeCount === 0) return null;
    const index = this.free[--this.freeCount];
    const item = this.items[index];
    item.active = true;
    this.activeCount++;
    return item;
  }

  release(item: T): void {
    if (!item.active) return;
    item.active = false;
    this.free[this.freeCount++] = item.poolIndex;
    this.activeCount--;
  }

  releaseAll(): void {
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].active = false;
      this.free[i] = this.items.length - 1 - i;
    }
    this.freeCount = this.items.length;
    this.activeCount = 0;
  }

  get capacity(): number {
    return this.items.length;
  }
}
