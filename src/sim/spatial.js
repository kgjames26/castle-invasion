// Hachage spatial à liste chaînée (reconstruit à chaque tick, sans allocation).
import { W, D } from './constants.js';
export class SpatialHash {
  constructor(cell = 4, capacity = 4096) {
    this.cell = cell; this.cw = Math.ceil(W / cell); this.ch = Math.ceil(D / cell);
    this.head = new Int32Array(this.cw * this.ch);
    this.next = new Int32Array(capacity);
  }
  rebuild(xs, zs, n) {
    this.head.fill(-1);
    const c = this.cell, cw = this.cw, ch = this.ch;
    for (let i = 0; i < n; i++) {
      const cx = Math.min(cw - 1, Math.max(0, (xs[i] / c) | 0)), cz = Math.min(ch - 1, Math.max(0, (zs[i] / c) | 0));
      const k = cz * cw + cx;
      this.next[i] = this.head[k]; this.head[k] = i;
    }
  }
  // remplit `out` (tableau réutilisé) avec les indices à portée ; renvoie le nombre
  query(x, z, r, xs, zs, out) {
    const c = this.cell, cw = this.cw, ch = this.ch, r2 = r * r;
    const x0 = Math.max(0, ((x - r) / c) | 0), x1 = Math.min(cw - 1, ((x + r) / c) | 0);
    const z0 = Math.max(0, ((z - r) / c) | 0), z1 = Math.min(ch - 1, ((z + r) / c) | 0);
    let m = 0;
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = this.head[cz * cw + cx]; i !== -1; i = this.next[i]) {
        const dx = xs[i] - x, dz = zs[i] - z;
        if (dx * dx + dz * dz <= r2) out[m++] = i;
      }
    }
    return m;
  }
}
