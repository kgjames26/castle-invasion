// A* (unités du joueur, coûts dynamiques) + flow field (vagues de zombies)

class MinHeap {
  constructor(cap) { this.k = new Int32Array(cap); this.v = new Float32Array(cap); this.n = 0; }
  clear() { this.n = 0; }
  push(key, val) {
    let i = this.n++;
    this.k[i] = key; this.v[i] = val;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.v[p] <= this.v[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop() {
    const top = this.k[0];
    this.n--;
    if (this.n > 0) {
      this.k[0] = this.k[this.n]; this.v[0] = this.v[this.n];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.n && this.v[l] < this.v[m]) m = l;
        if (r < this.n && this.v[r] < this.v[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  swap(a, b) {
    const k = this.k[a]; this.k[a] = this.k[b]; this.k[b] = k;
    const v = this.v[a]; this.v[a] = this.v[b]; this.v[b] = v;
  }
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
const WALL_COST = 34, GATE_COST = 44, BROKEN_COST = 0.6, CENTER_COST = 18;

export class PathfindingSystem {
  constructor(game) {
    this.game = game;
    this.grid = game.grid;
    const N = this.grid.n * this.grid.n;
    this.heap = new MinHeap(N * 8);
    this.g = new Float32Array(N);
    this.came = new Int32Array(N);
    this.closed = new Uint8Array(N);
    this.flow = new Float32Array(N).fill(Infinity);
    this.dirty = true;
    this.targets = [];
  }

  invalidate() { this.dirty = true; }

  // cibles du flow field : cellules libres autour du château
  setTargets(castle) {
    const gr = this.grid;
    this.targets = [];
    const r = castle.rect;
    gr.markRect(r.x0 - 3, r.z0 - 3, r.x1 + 3, r.z1 + 3, (k, i, j) => {
      if (gr.blocked[k]) return;
      const x = gr.cx(i), z = gr.cz(j);
      if (castle.distTo(x, z) < 3.2) this.targets.push(k);
    });
  }

  enemyCost(k) {
    const gr = this.grid;
    if (gr.blocked[k]) return Infinity;
    let c = 1 + gr.extra[k] * 0.3;
    const s = gr.wallSeg[k];
    if (s >= 0) {
      const st = gr.wallState(s);
      c = st.broken ? BROKEN_COST : (st.gate ? GATE_COST : WALL_COST);
    }
    if (gr.building[k] >= 0) c += CENTER_COST;
    return c;
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.computeFlow();
  }

  computeFlow() {
    const gr = this.grid, n = gr.n, flow = this.flow, h = this.heap;
    flow.fill(Infinity);
    h.clear();
    for (const k of this.targets) { flow[k] = 0; h.push(k, 0); }
    while (h.n) {
      const k = h.pop();
      const d = flow[k];
      const i = k % n, j = (k / n) | 0;
      for (const [di, dj, w] of DIRS) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nk = nj * n + ni;
        if (di && dj && (gr.blocked[j * n + ni] || gr.blocked[nj * n + i])) continue;
        const c = this.enemyCost(nk);
        if (c === Infinity) continue;
        const nd = d + w * c;
        if (nd < flow[nk]) { flow[nk] = nd; h.push(nk, nd); }
      }
    }
  }

  // Prochain point vers lequel avancer (centre de la meilleure cellule voisine)
  flowStep(x, z) {
    const gr = this.grid, n = gr.n;
    const i = gr.cellI(x), j = gr.cellJ(z);
    const k = j * n + i;
    let best = -1, bv = this.flow[k];
    if (bv === Infinity) bv = 1e9;
    for (const [di, dj] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      if (di && dj && (gr.blocked[j * n + ni] || gr.blocked[nj * n + i])) continue;
      const nk = nj * n + ni;
      if (this.flow[nk] < bv) { bv = this.flow[nk]; best = nk; }
    }
    if (best < 0) {
      if (this.flow[k] === 0) return null;
      return { x: gr.cx(i), z: gr.cz(j) + 1 };
    }
    return { x: gr.cx(best % n), z: gr.cz((best / n) | 0) };
  }

  // A* sur la grille 48×48 avec lissage du chemin
  findPath(sx, sz, tx, tz, team = 'player') {
    const gr = this.grid, n = gr.n;
    const si = gr.cellI(sx), sj = gr.cellJ(sz);
    let ti = gr.cellI(tx), tj = gr.cellJ(tz);
    const start = sj * n + si;
    let goal = tj * n + ti;
    let exactEnd = true;
    if (!gr.passable(goal, team)) {
      goal = this.nearestPassable(ti, tj, team, sx, sz);
      if (goal < 0) return null;
      exactEnd = false;
    }
    if (start === goal) return [{ x: exactEnd ? tx : gr.cx(goal % n), z: exactEnd ? tz : gr.cz((goal / n) | 0) }];
    if (this.lineOfSight(sx, sz, tx, tz, team) && exactEnd) return [{ x: tx, z: tz }];
    const g = this.g, came = this.came, closed = this.closed, h = this.heap;
    g.fill(Infinity); closed.fill(0); h.clear();
    const gi = goal % n, gj = (goal / n) | 0;
    const heur = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
    g[start] = 0; came[start] = -1;
    h.push(start, heur(si, sj));
    let found = false, iter = 0;
    while (h.n && iter++ < 6000) {
      const k = h.pop();
      if (closed[k]) continue;
      if (k === goal) { found = true; break; }
      closed[k] = 1;
      const i = k % n, j = (k / n) | 0;
      for (const [di, dj, w] of DIRS) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nk = nj * n + ni;
        if (closed[nk] || !gr.passable(nk, team)) continue;
        if (di && dj && (!gr.passable(j * n + ni, team) || !gr.passable(nj * n + i, team))) continue;
        let c = w * (1 + gr.extra[nk]);
        const s = gr.wallSeg[nk];
        if (s >= 0 && gr.wallState(s).broken) c *= 0.8; // zones détruites = coût réduit
        const ng = g[k] + c;
        if (ng < g[nk]) { g[nk] = ng; came[nk] = k; h.push(nk, ng + heur(ni, nj)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = goal; k !== -1; k = came[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map(k => ({ x: gr.cx(k % n), z: gr.cz((k / n) | 0) }));
    if (exactEnd) pts[pts.length - 1] = { x: tx, z: tz };
    return this.smooth(sx, sz, pts, team);
  }

  smooth(sx, sz, pts, team) {
    const out = [];
    let cx = sx, cz = sz, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineOfSight(cx, cz, pts[j].x, pts[j].z, team)) j--;
      out.push(pts[j]);
      cx = pts[j].x; cz = pts[j].z;
      i = j + 1;
    }
    return out;
  }

  lineOfSight(x0, z0, x1, z1, team) {
    const gr = this.grid;
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(d / (gr.cell * 0.4));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (!gr.passableXZ(x, z, team)) return false;
      const k = gr.idx(gr.cellI(x), gr.cellJ(z));
      if (gr.extra[k] > 0 && s < steps - 1) return false;
    }
    return true;
  }

  nearestPassable(ti, tj, team, sx, sz) {
    const gr = this.grid, n = gr.n;
    let best = -1, bd = Infinity;
    for (let r = 1; r < 10 && best < 0; r++) {
      for (let j = tj - r; j <= tj + r; j++)
        for (let i = ti - r; i <= ti + r; i++) {
          if (Math.max(Math.abs(i - ti), Math.abs(j - tj)) !== r || !gr.inBounds(i, j)) continue;
          const k = j * n + i;
          if (!gr.passable(k, team)) continue;
          const d = Math.hypot(gr.cx(i) - sx, gr.cz(j) - sz) * 0.2 + r;
          if (d < bd) { bd = d; best = k; }
        }
    }
    return best;
  }
}
