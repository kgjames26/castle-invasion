// Champs de flux (Dijkstra inversé) : un par secteur ciblé. Les zombies descendent le gradient.
// Buts : devant chaque tronçon intact (attaque) ou derrière chaque brèche (infiltration, plus attractif).
import { GW, GD, CELL, SECTORS, SECTOR_W, SEG_W } from './constants.js';
import { COST, T } from './terrain.js';

const ROW_WALL0 = 71, ROW_WALL1 = 74, ROW_FRONT = 70, ROW_BACK = 76;
const CPS = SECTOR_W / CELL;               // cellules par secteur (20)
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class FlowFields {
  constructor(terrain, wall) {
    this.terrain = terrain; this.wall = wall;
    this.dist = []; this.dirX = []; this.dirZ = [];
    for (let s = 0; s < SECTORS; s++) {
      this.dist.push(new Float32Array(GW * GD));
      this.dirX.push(new Int8Array(GW * GD)); this.dirZ.push(new Int8Array(GW * GD));
    }
    const cap = GW * GD * 10;
    this.hk = new Float32Array(cap); this.hv = new Int32Array(cap); this.hn = 0;
    this.sx = 0; this.sz = 0;
  }
  solid(gx, gz) {
    if (gx < 0 || gz < 0 || gx >= GW || gz >= GD) return true;
    if (this.terrain.type[gz * GW + gx] === T.ROCK) return true;
    if (gz >= ROW_WALL0 && gz <= ROW_WALL1) return this.wall.hp[Math.min(39, (((gx + .5) * CELL) / SEG_W) | 0)] > 0;
    return false;
  }
  push(k, v) {
    let i = this.hn++; const hk = this.hk, hv = this.hv;
    while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
    hk[i] = k; hv[i] = v;
  }
  pop() {
    const hk = this.hk, hv = this.hv, top = hv[0], k = hk[--this.hn], v = hv[this.hn];
    let i = 0, n = this.hn;
    for (;;) {
      let c = 2 * i + 1; if (c >= n) break;
      if (c + 1 < n && hk[c + 1] < hk[c]) c++;
      if (hk[c] >= k) break;
      hk[i] = hk[c]; hv[i] = hv[c]; i = c;
    }
    hk[i] = k; hv[i] = v; return top;
  }
  rebuildAll() { for (let s = 0; s < SECTORS; s++) this.rebuild(s); }
  rebuild(s) {
    const dist = this.dist[s], dx = this.dirX[s], dz = this.dirZ[s], type = this.terrain.type;
    dist.fill(Infinity); this.hn = 0;
    for (let c = 0; c < CPS; c++) {
      const gx = s * CPS + c, seg = Math.min(39, (((gx + .5) * CELL) / SEG_W) | 0);
      if (this.wall.hp[seg] > 0) { dist[ROW_FRONT * GW + gx] = 0; this.push(0, ROW_FRONT * GW + gx); }
      else { dist[ROW_BACK * GW + gx] = -12; this.push(-12, ROW_BACK * GW + gx); }
    }
    while (this.hn > 0) {
      const kd = this.hk[0], cur = this.pop();
      if (kd > dist[cur]) continue;
      const cx = cur % GW, cz = (cur / GW) | 0;
      const cc = COST[type[cur]];
      for (let d = 0; d < 8; d++) {
        const nx = cx + N8[d][0], nz = cz + N8[d][1];
        if (this.solid(nx, nz)) continue;
        if (d >= 4 && (this.solid(cx + N8[d][0], cz) || this.solid(cx, cz + N8[d][1]))) continue;
        const ni = nz * GW + nx, nd = kd + cc * (d >= 4 ? 1.414 : 1);
        if (nd < dist[ni]) { dist[ni] = nd; this.push(nd, ni); }
      }
    }
    for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) {
      const i = gz * GW + gx; dx[i] = 0; dz[i] = 0;
      if (!isFinite(dist[i]) || this.solid(gx, gz)) continue;
      let best = dist[i], bx = 0, bz = 0;
      for (let d = 0; d < 8; d++) {
        const nx = gx + N8[d][0], nz = gz + N8[d][1];
        if (this.solid(nx, nz)) continue;
        if (d >= 4 && (this.solid(gx + N8[d][0], gz) || this.solid(gx, gz + N8[d][1]))) continue;
        const nd = dist[nz * GW + nx];
        if (nd < best) { best = nd; bx = N8[d][0]; bz = N8[d][1]; }
      }
      dx[i] = bx; dz[i] = bz;
    }
  }
  // Vecteur unitaire vers la meilleure cellule voisine (0,0 si but atteint / inaccessible)
  sample(s, x, z) {
    const gx = Math.min(GW - 1, Math.max(0, (x / CELL) | 0)), gz = Math.min(GD - 1, Math.max(0, (z / CELL) | 0));
    const i = gz * GW + gx, ddx = this.dirX[s][i], ddz = this.dirZ[s][i];
    if (ddx === 0 && ddz === 0) { this.sx = 0; this.sz = 0; return false; }
    const vx = (gx + ddx + .5) * CELL - x, vz = (gz + ddz + .5) * CELL - z, l = Math.hypot(vx, vz) || 1;
    this.sx = vx / l; this.sz = vz / l; return true;
  }
  reachableFromNorth(s) {      // contrôle de cohérence de la carte
    const dist = this.dist[s];
    for (let gx = 0; gx < GW; gx++) { if (!this.solid(gx, 1) && !isFinite(dist[GW + gx])) return false; }
    return true;
  }
}
