// Gisements de minerai en 3D (pierre, fer, or) : de petits blocs de minerai modélisés (3 variantes par ressource), multipliés en grappe.
//  pierre : rocher veiné, blocs taillés, dalles empilées · fer : roche rouillée à cristaux d'hématite, roche à nodules de métal, amas de cristaux
//  or : roche ocre à filon, quartz moucheté d'or, tas de pépites.
// Chaque gisement = un gros bloc central + une vingtaine de blocs autour ; quand il s'épuise, les blocs disparaissent un à un depuis l'extérieur.
// Un gisement caché sous une mine ou une carrière n'est pas dessiné.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TASKS, RES_INFO } from '../content/medieval.js';
import { applyNorthFog } from './fog.js';

const C = new THREE.Color();
const rnd = s => { const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
export function shape(geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, jitter = 0.08, seed = 1) {
  const g = geo.toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const n = g.attributes.position.count, col = new Float32Array(n * 3); C.set(color);
  for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rnd(i + seed * 31) * jitter * 2; for (let v = 0; v < 3; v++) { col[(i + v) * 3] = C.r * k; col[(i + v) * 3 + 1] = C.g * k; col[(i + v) * 3 + 2] = C.b * k; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
// assombrit le pied des blocs (occlusion ambiante simple) : donne du volume et « pose » le bloc dans le sol
function grounded(list, h = 0.9) {
  const g = mergeGeometries(list, false), p = g.attributes.position.array, c = g.attributes.color.array;
  for (let i = 0; i < p.length; i += 3) { const k = 0.62 + 0.38 * Math.min(1, Math.max(0, p[i + 1] / h)); c[i] *= k; c[i + 1] *= k; c[i + 2] *= k; }
  g.computeBoundingSphere(); return g;
}
const rock = (r = 1, d = 0) => new THREE.DodecahedronGeometry(r, d), ico = () => new THREE.IcosahedronGeometry(1, 0), crystal = () => new THREE.OctahedronGeometry(1, 0), block = () => new THREE.BoxGeometry(1, 1, 1);
const spike = (L, col, tip, x, y, z, s, len, rx, rz, ry = 0) => { L.push(shape(crystal(), col, x, y, z, s, len, s, rx, ry, rz, 0.15)); L.push(shape(crystal(), tip, x + Math.sin(-rz) * len * 0.55, y + len * 0.55, z + Math.sin(rx) * len * 0.55, s * 0.45, len * 0.45, s * 0.45, rx, ry, rz, 0.1)); };

// ——— petits blocs de minerai (≈ 1 m), 3 variantes par ressource ———
export function oreChunks(res) {
  if (res === 'stone') return [
    (() => { const L = [shape(rock(), 0x9a9c9e, 0, 0.5, 0, 0.95, 0.72, 0.85, 0.3, 0.4, 0.1), shape(rock(), 0x8a8c90, 0.62, 0.22, 0.38, 0.42, 0.32, 0.4, 1, 0.3, 0)];
      L.push(shape(block(), 0xf4f3ee, 0, 0.62, 0.62, 1.15, 0.06, 0.07, 0, 0, 0.3, 0.03), shape(block(), 0xf4f3ee, 0.55, 0.45, 0.3, 0.06, 0.4, 0.06, 0, 0.6, 0.5, 0.03)); return grounded(L); })(),   // rocher veiné de blanc
    (() => grounded([shape(block(), 0xc9cbcd, 0, 0.27, 0, 0.95, 0.55, 0.72, 0, 0.15, 0), shape(block(), 0xd8dadc, 0.12, 0.76, 0.04, 0.62, 0.42, 0.52, 0, 0.55, 0), shape(block(), 0xb7b9bc, -0.62, 0.3, 0.42, 0.45, 0.6, 0.38, 0.12, 0.3, -0.35), shape(rock(0.2), 0x8e9094, 0.55, 0.12, 0.5, 1, 0.7, 1)]))(),   // blocs taillés
    (() => grounded([shape(rock(), 0xa6a8aa, 0, 0.14, 0, 1.05, 0.22, 0.9, 0, 0.2, 0), shape(rock(), 0x949699, 0.1, 0.4, 0.05, 0.82, 0.2, 0.68, 0.05, 1.1, 0.04), shape(rock(), 0xb4b6b8, -0.05, 0.62, 0, 0.55, 0.18, 0.48, 0, 2, -0.05)]))(),   // dalles empilées
  ];
  if (res === 'iron') return [
    (() => { const L = [shape(rock(), 0x6a4638, 0, 0.5, 0, 0.9, 0.72, 0.85, 0.2, 0.7, 0.1), shape(rock(), 0x8e4a2c, 0.25, 0.86, 0.32, 0.3, 0.12, 0.26, 0.3, 0.2, 0), shape(rock(), 0x9a5032, -0.55, 0.45, -0.3, 0.2, 0.16, 0.22, 1, 0, 0.4)];
      spike(L, 0x34373e, 0x7d8592, 0.1, 0.95, -0.15, 0.16, 0.5, 0.15, 0.2); spike(L, 0x3a3d44, 0x8a93a0, -0.32, 0.85, 0.15, 0.13, 0.4, -0.3, -0.4); spike(L, 0x2f3238, 0x7d8592, 0.45, 0.7, -0.2, 0.11, 0.32, 0.2, 0.7); return grounded(L, 1.1); })(),   // roche rouillée à cristaux d'hématite
    (() => { const L = [shape(rock(), 0x5c3e33, 0, 0.45, 0, 0.95, 0.65, 0.8, 0.6, 0.2, 0), shape(rock(), 0x7a5242, 0.55, 0.25, -0.35, 0.45, 0.35, 0.42, 0.2, 1.2, 0)];
      for (let k = 0; k < 6; k++) { const a = k * 1.9, r = 0.62 + 0.1 * (k % 2); L.push(shape(ico(), k % 2 ? 0x8a93a0 : 0x5d6672, Math.cos(a) * r * 0.8, 0.45 + 0.28 * Math.sin(k * 2.3), Math.sin(a) * r * 0.7, 0.13, 0.11, 0.13, k, k, 0, 0.12)); }
      L.push(shape(rock(), 0x8e4a2c, -0.2, 0.86, 0.1, 0.24, 0.09, 0.22, 0, 0.5, 0)); return grounded(L); })(),   // roche à nodules de métal
    (() => { const L = [shape(rock(), 0x4e3a32, 0, 0.18, 0, 0.75, 0.3, 0.7, 0, 0.3, 0)];
      [[0, 0.3, 0, 0.2, 0.75, 0.05, 0.08], [0.28, 0.25, 0.12, 0.15, 0.55, 0.35, 0.5], [-0.25, 0.25, 0.1, 0.14, 0.5, -0.4, 0.3], [0.05, 0.22, -0.3, 0.13, 0.45, -0.1, -0.5], [-0.1, 0.22, 0.32, 0.11, 0.38, 0.45, -0.2]].forEach(([x, y, z, s, l, rz, rx]) => spike(L, 0x383b42, 0x9aa3b0, x, y + l * 0.5, z, s, l, rx, rz));
      return grounded(L, 1.0); })(),   // amas de cristaux
  ];
  return [
    (() => { const L = [shape(rock(), 0x8a7458, 0, 0.5, 0, 0.95, 0.72, 0.85, 0.4, 0.2, 0.1), shape(rock(), 0x7a6650, -0.6, 0.25, 0.35, 0.42, 0.32, 0.4, 0.9, 1.0, 0.2)];
      L.push(shape(block(), 0xf2c94a, 0, 0.62, 0.66, 1.0, 0.08, 0.08, 0, 0.1, 0.4, 0.05), shape(block(), 0xe8b830, 0.3, 0.88, 0.25, 0.6, 0.07, 0.07, 0.3, 0.9, -0.3, 0.05), shape(block(), 0xf7d460, -0.35, 0.5, 0.6, 0.06, 0.4, 0.06, 0, 0, 0.3, 0.05));
      for (const [x, y, z, s] of [[0.45, 0.95, 0.15, 0.1], [-0.2, 0.98, 0.3, 0.08], [0.65, 0.5, 0.45, 0.09]]) L.push(shape(ico(), 0xffd84a, x, y, z, s, s * 0.8, s, x, y, 0, 0.1)); return grounded(L); })(),   // roche ocre à filon d'or
    (() => { const L = [shape(rock(), 0xe6e1d4, 0, 0.45, 0, 0.85, 0.65, 0.8, 0.5, 0.6, 0.2, 0.06), shape(rock(), 0xd6d0c0, 0.5, 0.22, 0.4, 0.38, 0.3, 0.35, 0.3, 0.1, 0.5, 0.06)];
      for (let k = 0; k < 7; k++) { const a = k * 2.4, r = 0.55 + 0.12 * (k % 3) / 2; L.push(shape(ico(), k % 2 ? 0xffd84a : 0xf0b828, Math.cos(a) * r * 0.85, 0.35 + 0.35 * rnd(k + 4), Math.sin(a) * r * 0.75, 0.09, 0.07, 0.09, k, k, 0, 0.1)); }
      return grounded(L); })(),   // quartz moucheté d'or
    (() => { const L = [shape(rock(), 0x7a6650, 0, 0.12, 0, 0.8, 0.22, 0.7, 0, 0.4, 0)];
      for (const [x, z, s] of [[0, 0, 0.26], [0.32, 0.12, 0.2], [-0.28, 0.16, 0.18], [0.1, -0.3, 0.19], [-0.15, -0.18, 0.15], [0.25, 0.38, 0.14]]) L.push(shape(ico(), 0xffd84a, x, 0.24 + s * 0.6, z, s, s * 0.75, s * 0.9, x * 3, z * 3, 0, 0.12));
      return grounded(L, 0.6); })(),   // tas de pépites
  ];
}

// disposition d'une grappe (ordonnée du centre vers l'extérieur) : [x, z, échelle, variante, lacet, inclinaison]
const K = 22;
function layout(seed) {
  const L = [[0, 0, 1.8, 0, seed, 0]];
  for (let i = 1; i < 4; i++) { const a = seed * 1.7 + i * 2.09, r = 1.25 + 0.2 * rnd(seed + i); L.push([Math.cos(a) * r, Math.sin(a) * r, 1.35 + 0.25 * rnd(seed * 3 + i), i % 3, a * 2, 0.08]); }
  for (let i = 4; i < K; i++) { const a = seed * 0.9 + i * 2.399, r = 1.9 + 2.4 * Math.sqrt((i - 4) / (K - 4)) + 0.35 * rnd(seed + i * 7); L.push([Math.cos(a) * r, Math.sin(a) * r, 0.42 + 0.55 * rnd(seed * 5 + i) * (1 - (i - 4) / (K - 4) * 0.5), (i + (seed | 0)) % 3, a * 3.1, 0.25 * (rnd(i + seed) - 0.5)]); }
  return L;
}

export class OreView {
  constructor(scene) {
    const mat = applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.meshes = {}; this.cap = 20 * K;
    for (const r of ['stone', 'iron', 'gold']) this.meshes[r] = oreChunks(r).map(g => { const m = new THREE.InstancedMesh(g, mat, this.cap); m.frustumCulled = false; m.count = 0; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; });
    this.d = new THREE.Object3D(); this.layouts = new Map();
  }
  // gisements de départ (sites des tâches) + gisements découverts ; nombre de blocs selon la réserve ; masqués sous une mine/carrière
  update(sim) {
    const E = sim.eco, B = sim.build, d = this.d, n = {}; for (const r in this.meshes) n[r] = [0, 0, 0];
    const covered = (x, z) => B.items.some(s => (s.type === 'mine' || s.type === 'quarry') && Math.hypot(s.x - x, s.z - z) < 5.5);
    const put = (r, x, z, f, seed) => {
      if (f <= 0.01 || covered(x, z)) return;
      let lay = this.layouts.get(seed); if (!lay) { lay = layout(seed); this.layouts.set(seed, lay); }
      const cnt = Math.max(1, Math.ceil(K * Math.min(1, f))), M = this.meshes[r], c = n[r];
      for (let i = 0; i < cnt; i++) {
        const [lx, lz, s0, v, yaw, tilt] = lay[i], s = i === 0 ? s0 * (0.55 + 0.45 * Math.min(1, f)) : s0; if (c[v] >= this.cap) continue;
        d.position.set(x + lx, -0.06 * s, z + lz); d.rotation.set(tilt, yaw, tilt * 0.6); d.scale.set(s, s * (0.85 + 0.3 * rnd(seed + i)), s); d.updateMatrix(); M[v].setMatrixAt(c[v]++, d.matrix);
      }
    };
    for (const r of ['stone', 'iron', 'gold']) {
      const T = TASKS[r]; put(r, T.site.x, T.site.z, T.deposit ? Math.min(1, E.deposit[r] / T.deposit) : 1, r.length * 3.1);
      E.extra[r].forEach((e, i) => put(r, e.x, e.z, e.amount / e.max, Math.round(e.x * 7 + e.z * 3) % 997 + 0.5));
    }
    for (const r in this.meshes) this.meshes[r].forEach((m, v) => { m.count = n[r][v]; m.instanceMatrix.needsUpdate = true; });
  }
}
export { RES_INFO };
