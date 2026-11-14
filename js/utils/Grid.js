import { MAP } from '../data/Config.js';

// Grille de navigation 48×48 couvrant toute la carte
export class NavGrid {
  constructor(n = MAP.GRID, cell = MAP.CELL) {
    this.n = n;
    this.cell = cell;
    this.half = (n * cell) / 2;
    const N = n * n;
    this.blocked = new Uint8Array(N);   // obstacle statique (château, tours, maisons, bords)
    this.wallSeg = new Int16Array(N).fill(-1); // segment de muraille occupant la cellule
    this.extra = new Float32Array(N);   // surcoût dynamique (gisements…)
    this.building = new Int16Array(N).fill(-1); // bâtiment joueur (centre de récolte)
    this.wallState = null; // fonction (seg) => {broken, gate}
  }
  idx(i, j) { return j * this.n + i; }
  inBounds(i, j) { return i >= 0 && j >= 0 && i < this.n && j < this.n; }
  toCell(x, z) {
    return { i: Math.floor((x + this.half) / this.cell), j: Math.floor((z + this.half) / this.cell) };
  }
  cellI(x) { return Math.max(0, Math.min(this.n - 1, Math.floor((x + this.half) / this.cell))); }
  cellJ(z) { return Math.max(0, Math.min(this.n - 1, Math.floor((z + this.half) / this.cell))); }
  center(i, j) { return { x: -this.half + (i + 0.5) * this.cell, z: -this.half + (j + 0.5) * this.cell }; }
  cx(i) { return -this.half + (i + 0.5) * this.cell; }
  cz(j) { return -this.half + (j + 0.5) * this.cell; }

  // Passage pour une équipe : 'player' (portes ouvertes) ou 'enemy'
  passable(k, team) {
    if (this.blocked[k]) return false;
    if (this.building[k] >= 0) return false;
    const s = this.wallSeg[k];
    if (s >= 0) {
      const st = this.wallState(s);
      if (st.broken) return true;
      return team === 'player' && st.gate;
    }
    return true;
  }
  passableXZ(x, z, team) {
    const i = Math.floor((x + this.half) / this.cell), j = Math.floor((z + this.half) / this.cell);
    if (!this.inBounds(i, j)) return false;
    return this.passable(this.idx(i, j), team);
  }
  isWallCellXZ(x, z) {
    const i = Math.floor((x + this.half) / this.cell), j = Math.floor((z + this.half) / this.cell);
    if (!this.inBounds(i, j)) return -1;
    return this.wallSeg[this.idx(i, j)];
  }
  markCircle(x, z, r, fn) {
    const c0 = this.toCell(x - r, z - r), c1 = this.toCell(x + r, z + r);
    for (let j = Math.max(0, c0.j); j <= Math.min(this.n - 1, c1.j); j++)
      for (let i = Math.max(0, c0.i); i <= Math.min(this.n - 1, c1.i); i++) {
        const dx = this.cx(i) - x, dz = this.cz(j) - z;
        if (dx * dx + dz * dz <= r * r) fn(this.idx(i, j), i, j);
      }
  }
  markRect(x0, z0, x1, z1, fn) {
    const c0 = this.toCell(x0, z0), c1 = this.toCell(x1, z1);
    for (let j = Math.max(0, c0.j); j <= Math.min(this.n - 1, c1.j); j++)
      for (let i = Math.max(0, c0.i); i <= Math.min(this.n - 1, c1.i); i++) fn(this.idx(i, j), i, j);
  }
}

// Hachage spatial pour les requêtes de voisinage (combat, séparation)
export class SpatialHash {
  constructor(cell = 5, half = MAP.HALF + 10) {
    this.cell = cell;
    this.half = half;
    this.n = Math.ceil((half * 2) / cell);
    this.buckets = new Array(this.n * this.n);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
    this.dirty = [];
  }
  clear() {
    for (const b of this.dirty) b.length = 0;
    this.dirty.length = 0;
  }
  key(x, z) {
    let i = Math.floor((x + this.half) / this.cell), j = Math.floor((z + this.half) / this.cell);
    i = i < 0 ? 0 : i >= this.n ? this.n - 1 : i;
    j = j < 0 ? 0 : j >= this.n ? this.n - 1 : j;
    return j * this.n + i;
  }
  insert(e) {
    const b = this.buckets[this.key(e.x, e.z)];
    if (b.length === 0) this.dirty.push(b);
    b.push(e);
  }
  query(x, z, r, out) {
    out.length = 0;
    const i0 = Math.max(0, Math.floor((x - r + this.half) / this.cell)), i1 = Math.min(this.n - 1, Math.floor((x + r + this.half) / this.cell));
    const j0 = Math.max(0, Math.floor((z - r + this.half) / this.cell)), j1 = Math.min(this.n - 1, Math.floor((z + r + this.half) / this.cell));
    const r2 = r * r;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const b = this.buckets[j * this.n + i];
        for (let k = 0; k < b.length; k++) {
          const e = b[k];
          const dx = e.x - x, dz = e.z - z;
          if (dx * dx + dz * dz <= r2) out.push(e);
        }
      }
    return out;
  }
}
