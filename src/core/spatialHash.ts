/**
 * Räumliches Gitter mit fester Zellgröße. Alle Puffer sind vorab allokiert,
 * clear()/insert()/query() legen zur Laufzeit nichts an.
 */
export class SpatialHash {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cellSize: number;
  private readonly perCell: number;
  private readonly buckets: Int32Array;
  private readonly counts: Int32Array;
  private readonly stamp: Int32Array;
  private queryStamp = 0;
  readonly result: Int32Array;
  resultCount = 0;

  constructor(worldSize: number, cellSize: number, maxEntities: number, perCell = 48) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldSize / cellSize);
    this.rows = this.cols;
    this.perCell = perCell;
    this.buckets = new Int32Array(this.cols * this.rows * perCell);
    this.counts = new Int32Array(this.cols * this.rows);
    this.stamp = new Int32Array(maxEntities);
    this.result = new Int32Array(maxEntities);
  }

  clear(): void {
    this.counts.fill(0);
  }

  insert(id: number, x: number, y: number): void {
    const cx = this.clampCol(x);
    const cy = this.clampCol(y);
    const cell = cy * this.cols + cx;
    const count = this.counts[cell];
    if (count >= this.perCell) return; // Überlauf: extrem selten, wird verworfen
    this.buckets[cell * this.perCell + count] = id;
    this.counts[cell] = count + 1;
  }

  /** Sucht alle Ids im Kreis (x,y,r). Ergebnis in this.result / this.resultCount. */
  query(x: number, y: number, radius: number): void {
    const minX = this.clampCol(x - radius);
    const maxX = this.clampCol(x + radius);
    const minY = this.clampCol(y - radius);
    const maxY = this.clampCol(y + radius);
    this.collect(minX, minY, maxX, maxY);
  }

  queryRect(x0: number, y0: number, x1: number, y1: number): void {
    const minX = this.clampCol(Math.min(x0, x1));
    const maxX = this.clampCol(Math.max(x0, x1));
    const minY = this.clampCol(Math.min(y0, y1));
    const maxY = this.clampCol(Math.max(y0, y1));
    this.collect(minX, minY, maxX, maxY);
  }

  private collect(minX: number, minY: number, maxX: number, maxY: number): void {
    const stampId = ++this.queryStamp;
    let n = 0;
    for (let cy = minY; cy <= maxY; cy++) {
      const rowBase = cy * this.cols;
      for (let cx = minX; cx <= maxX; cx++) {
        const cell = rowBase + cx;
        const count = this.counts[cell];
        const base = cell * this.perCell;
        for (let i = 0; i < count; i++) {
          const id = this.buckets[base + i];
          if (this.stamp[id] === stampId) continue;
          this.stamp[id] = stampId;
          this.result[n++] = id;
        }
      }
    }
    this.resultCount = n;
  }

  private clampCol(v: number): number {
    const c = Math.floor(v / this.cellSize);
    if (c < 0) return 0;
    if (c >= this.cols) return this.cols - 1;
    return c;
  }
}
