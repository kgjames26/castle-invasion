// Eau (v11.3) : douves du château + ruisseau. On ne traverse l'eau que par un PASSAGE : le pont-levis du château et trois passerelles
// de bois sur le ruisseau. Les villageois (et le prêtre, le magicien) contournent l'eau par le passage le plus court.
// La géométrie des douves est partagée avec la vue (render/ExtrasView.js) : une seule source de vérité.
import { CASTLE } from './constants.js';
import { STREAM } from '../content/medieval.js';

const TAU = Math.PI * 2;
const MOAT_Z = CASTLE.z - 1;                       // centre des douves (un peu au nord du centre du château)
const rr = (th, a, b) => { const c = Math.cos(th), s = Math.sin(th), p = 4.5; return 1 / Math.pow(Math.pow(Math.abs(c) / a, p) + Math.pow(Math.abs(s) / b, p), 1 / p); };
const noise = th => 0.55 * Math.sin(th * 5 + 1.3) + 0.35 * Math.sin(th * 11 + 0.4) + 0.2 * Math.sin(th * 23 + 2.1);
// bords intérieur (ri) et extérieur (ro) de l'eau à l'angle th (th = atan2(dz, dx) depuis le centre des douves)
export function moatProfile(th) {
  const ri = rr(th, 23.5, 18.5) + 0.6 * noise(th), wdt = 4.2 + 0.9 * (0.55 * Math.sin(th * 2 + 3) + 0.35 * Math.sin(th * 6 + 1.1) + 0.2 * Math.sin(th * 13 + 0.5));   // fréquences entières : pas de cassure à θ = 0 / 2π
  return { ri, ro: ri + wdt };
}
export const MOAT = { x: CASTLE.x, z: MOAT_Z };

// tracé du ruisseau : part du milieu de la douve (côté est), puis suit STREAM ; largeur d'eau w(i) comme dans la vue
export function streamPoints() { const p0 = moatProfile(0), sx = MOAT.x + (p0.ri + p0.ro) / 2; return [[sx, MOAT_Z], ...STREAM.filter(p => p[0] > sx + 1)]; }
export const streamHalfWidth = i => 1.3 + 0.35 * Math.sin(i * 0.9) + (i === 0 ? 2.2 : i === 1 ? 1.0 : 0);

// passages : rectangles orientés {x, z, dx, dz (sens de la traversée, unitaire), len, wid}
function buildCrossings() {
  const list = [], th = 1.5 * Math.PI, S = moatProfile(th);   // pont-levis au nord du château, face au village
  list.push({ kind: 'draw', x: MOAT.x, z: MOAT_Z - (S.ri + S.ro) / 2, dx: 0, dz: 1, len: S.ro - S.ri + 2.6, wid: 4.6 });
  const pts = streamPoints();
  for (const sx of [141, 165, 189]) {
    let i = 1; for (let k = 1; k < pts.length - 1; k++) if (Math.abs(pts[k][0] - sx) < Math.abs(pts[i][0] - sx)) i = k;
    const [qx, qz] = pts[i + 1], [ox, oz] = pts[i - 1], tx = qx - ox, tz = qz - oz, l = Math.hypot(tx, tz) || 1, w = streamHalfWidth(i);
    list.push({ kind: 'plank', x: pts[i][0], z: pts[i][1], dx: -tz / l, dz: tx / l, len: 2 * (w + 0.3) + 2.8, wid: 3.2 });
  }
  return list;
}
export const CROSSINGS = buildCrossings();

const inRect = (b, x, z, m = 0) => { const ex = x - b.x, ez = z - b.z, u = ex * b.dx + ez * b.dz, v = -ex * b.dz + ez * b.dx; return Math.abs(u) <= b.len / 2 + m && Math.abs(v) <= b.wid / 2 + m; };
const ends = (b, k) => { const s = (k ? 1 : -1) * (b.len / 2 + 0.8); return { x: b.x + b.dx * s, z: b.z + b.dz * s }; };

const GX0 = 60, GZ0 = 262, GN = 2, GW = 340 * GN, GH = 72 * GN;   // grille de 0,5 m : x 60→230, z 262→334
let GRID = null;
const RX0 = 0, RZ0 = 200, RW = 200, RH = 132;   // domaine de recherche des itinéraires : le village (1 m par cellule)
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)); return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t]; }
function rawWet(x, z) {
  const dx = x - MOAT.x, dz = z - MOAT_Z, r = Math.hypot(dx, dz);
  if (r < 48) { let th = Math.atan2(dz, dx); if (th < 0) th += TAU; const P = moatProfile(th); if (r > P.ri - 0.3 && r < P.ro + 0.3) return true; }
  const pts = streamPoints();
  for (let i = 0; i < pts.length - 1; i++) {
    if (x < pts[i][0] - 6 || x > pts[i + 1][0] + 6) continue;
    const [d, t] = segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]), w = streamHalfWidth(i) * (1 - t) + streamHalfWidth(i + 1) * t;
    if (d < w + 0.3) return true;
  }
  return false;
}
function grid() {
  if (GRID) return GRID; const g = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = GX0 + (i + 0.5) / GN, z = GZ0 + (j + 0.5) / GN; if (rawWet(x, z)) g[j * GW + i] = 1; }
  for (const b of CROSSINGS) for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (g[j * GW + i] === 1 && inRect(b, GX0 + (i + 0.5) / GN, GZ0 + (j + 0.5) / GN, 0.45)) g[j * GW + i] = 2;   // sous un passage : praticable
  return (GRID = g);
}

export class Water {
  constructor() { this.cache = new WeakMap(); grid(); }
  // vrai si (x, z) est dans l'eau, hors d'un passage
  wet(x, z) { const i = Math.floor((x - GX0) * GN), j = Math.floor((z - GZ0) * GN); if (i < 0 || j < 0 || i >= GW || j >= GH) return false; return GRID[j * GW + i] === 1; }
  clear(x0, z0, x1, z1) { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 0.6)); for (let k = 0; k <= n; k++) if (this.wet(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n)) return false; return true; }
  // itinéraire de (x0,z0) à (x1,z1) : null si la ligne droite est libre, sinon les points de passage d'un chemin contournant l'eau
  // (A* sur une grille de 1 m, puis lissage par lignes droites libres ; passe donc forcément par un passage)
  route(x0, z0, x1, z1) {
    if (this.clear(x0, z0, x1, z1)) return null;
    const cx = v => Math.max(0, Math.min(RW - 1, Math.floor(v - RX0))), cz = v => Math.max(0, Math.min(RH - 1, Math.floor(v - RZ0)));
    const sI = cz(z0) * RW + cx(x0), gI = cz(z1) * RW + cx(x1), N = RW * RH;
    if (!this.rg) { this.rg = new Float32Array(N); this.rp = new Int32Array(N); this.rc = new Uint8Array(N); this.rb = new Int8Array(N).fill(-1); }
    const G = this.rg, P = this.rp, C = this.rc, Bk = this.rb; G.fill(Infinity); C.fill(0);
    const blocked = i => { let b = Bk[i]; if (b < 0) { const x = RX0 + (i % RW) + 0.5, z = RZ0 + ((i / RW) | 0) + 0.5; b = 0; for (let a = -1; a <= 1 && !b; a++) for (let c = -1; c <= 1; c++) if (this.wet(x + a * 0.7, z + c * 0.7)) { b = 1; break; } Bk[i] = b; } return b === 1; };   // ~0,7 m de marge avec l'eau
    const gx = RX0 + (gI % RW) + 0.5, gz = RZ0 + ((gI / RW) | 0) + 0.5, h = i => Math.hypot(RX0 + (i % RW) + 0.5 - gx, RZ0 + ((i / RW) | 0) + 0.5 - gz);
    const heap = [[h(sI), sI]]; G[sI] = 0; P[sI] = -1; let found = false;
    const push = e => { heap.push(e); let k = heap.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    while (heap.length) {
      const [, i] = pop(); if (C[i]) continue; C[i] = 1; if (i === gI) { found = true; break; }
      const ix = i % RW, iz = (i / RW) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = ix + dx, nz = iz + dz; if (nx < 0 || nz < 0 || nx >= RW || nz >= RH) continue; const j = nz * RW + nx; if (C[j]) continue;
        if (j !== gI && blocked(j)) continue; if (dx && dz && (blocked(iz * RW + nx) || blocked(nz * RW + ix))) continue;   // pas de coupe d'angle à travers l'eau
        const g = G[i] + (dx && dz ? 1.4142 : 1); if (g < G[j]) { G[j] = g; P[j] = i; push([g + h(j), j]); }
      }
    }
    if (!found) return null;
    const cells = []; for (let i = gI; i >= 0; i = P[i]) cells.push({ x: RX0 + (i % RW) + 0.5, z: RZ0 + ((i / RW) | 0) + 0.5 }); cells.reverse();
    const out = []; let a = { x: x0, z: z0 }, k = 0;   // lissage : on saute tant que la ligne droite reste libre
    while (k < cells.length - 1) { let j = cells.length - 1; while (j > k + 1 && !this.clear(a.x, a.z, cells[j].x, cells[j].z)) j--; out.push(cells[j]); a = cells[j]; k = j; }
    if (out.length && Math.hypot(out[out.length - 1].x - x1, out[out.length - 1].z - z1) < 1.2) out.pop();
    return out;
  }
  // point à viser pour aller en (tx, tz) : la cible si la voie est libre, sinon le prochain bout de passage
  aim(o, tx, tz) {
    let c = this.cache.get(o); if (!c || c.tx !== tx || c.tz !== tz) { c = { tx, tz, n: 0, wp: this.route(o.x, o.z, tx, tz) }; this.cache.set(o, c); }
    while (c.wp && c.wp.length && Math.hypot(c.wp[0].x - o.x, c.wp[0].z - o.z) < 0.35) c.wp.shift();
    return c.wp && c.wp.length ? c.wp[0] : { x: tx, z: tz };
  }
  // bloqué par la rive depuis un moment : l'itinéraire est recalculé depuis la position actuelle
  stuck(o) { const c = this.cache.get(o); if (c && ++c.n > 12) this.cache.delete(o); }
  // sorti de l'eau : au point sec le plus proche (partie chargée au milieu du ruisseau, par exemple)
  eject(o) {
    if (!this.wet(o.x, o.z)) return false;
    for (let r = 0.5; r < 16; r += 0.5) for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r; if (!this.wet(x, z)) { o.x = x; o.z = z; this.cache.delete(o); return true; } }
    return false;
  }
  // un pas de (x,z) vers (nx,nz) sans entrer dans l'eau : glisse le long de la rive, sinon reste sur place
  guard(x, z, nx, nz) { if (!this.wet(nx, nz)) return [nx, nz]; if (!this.wet(nx, z)) return [nx, z]; if (!this.wet(x, nz)) return [x, nz]; return [x, z]; }
}
