// Gisements de minerai en 3D (pierre, fer, or) : affleurements rocheux modélisés en volumes facettés, couleurs de sommets.
//  pierre : blocs gris taillés et veinés de blanc · fer : roche brun-rouge rouillée, cristaux d'hématite sombres · or : roche ocre, filons et pépites dorées.
// La taille suit la quantité restante ; un gisement caché sous une mine ou une carrière n'est pas dessiné.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TASKS, RES_INFO } from '../content/medieval.js';
import { applyNorthFog } from './fog.js';

const C = new THREE.Color();
function shape(geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, jitter = 0.08, seed = 1) {
  const g = geo.toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const n = g.attributes.position.count, col = new Float32Array(n * 3); C.set(color);
  for (let i = 0; i < n; i += 3) { const k = 1 - jitter + ((Math.sin((i + seed) * 12.9898) * 43758.5453) % 1 + 1) % 1 * jitter * 2; for (let v = 0; v < 3; v++) { col[(i + v) * 3] = C.r * k; col[(i + v) * 3 + 1] = C.g * k; col[(i + v) * 3 + 2] = C.b * k; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const rock = (r = 1) => new THREE.DodecahedronGeometry(r, 0), crystal = () => new THREE.OctahedronGeometry(1, 0), block = () => new THREE.BoxGeometry(1, 1, 1);

export function oreGeometry(res) {
  const L = [];
  if (res === 'stone') {
    L.push(shape(rock(), 0x9a9c9e, 0, 1.0, 0, 2.2, 1.5, 1.9, 0.3, 0.4, 0.1), shape(rock(), 0x86888c, 1.9, 0.7, 0.8, 1.4, 1.0, 1.3, 0.8, 1.1, 0), shape(rock(), 0xa8aaac, -1.8, 0.6, -0.6, 1.3, 0.9, 1.2, 1.3, 0.2, 0.5));
    L.push(shape(block(), 0xc9cbcd, 0.4, 2.3, 0.2, 1.2, 0.7, 0.9, 0, 0.5, 0.1), shape(block(), 0xd8dadc, -0.9, 0.35, 1.7, 1.1, 0.7, 0.8, 0, 0.9, 0), shape(block(), 0xbfc1c3, 2.0, 0.3, -1.4, 0.9, 0.6, 0.7, 0, 0.3, 0));
    L.push(shape(block(), 0xf2f2f0, 0, 1.3, 1.55, 2.2, 0.08, 0.1, 0, 0, 0.35), shape(block(), 0xf2f2f0, 1.6, 1.0, 1.3, 1.2, 0.07, 0.09, 0, 0.6, -0.4));   // veines blanches
    for (let k = 0; k < 5; k++) L.push(shape(rock(0.3), 0x8e9094, Math.cos(k * 1.3) * 2.9, 0.15, Math.sin(k * 1.3) * 2.4, 1, 0.8, 1, k, k));   // éboulis
  } else if (res === 'iron') {
    L.push(shape(rock(), 0x6e4a3c, 0, 1.1, 0, 2.0, 1.7, 1.8, 0.2, 0.7, 0.1), shape(rock(), 0x5c3e33, 1.8, 0.8, -0.5, 1.4, 1.2, 1.3, 1.1, 0.3, 0), shape(rock(), 0x7a5242, -1.7, 0.7, 0.7, 1.3, 1.1, 1.2, 0.5, 1.4, 0.3));
    L.push(shape(rock(), 0xb5562a, 0.6, 1.9, 1.0, 0.8, 0.45, 0.6, 0.4, 0.2, 0), shape(rock(), 0xc4652e, -1.2, 1.4, -0.9, 0.6, 0.4, 0.55, 1, 0, 0));       // plaques de rouille
    for (const [x, y, z, s, ry] of [[0.2, 2.6, -0.2, 0.55, 0.3], [1.4, 1.9, 0.3, 0.42, 1.1], [-0.9, 2.0, 0.4, 0.38, 2], [2.2, 1.1, -1.2, 0.34, 0.6], [-2.1, 1.3, -0.2, 0.3, 1.7]])
      L.push(shape(crystal(), 0x3a3d44, x, y, z, s * 0.6, s * 1.5, s * 0.6, 0.2, ry, 0.25, 0.15), shape(crystal(), 0x6a6f7a, x + 0.12, y + 0.1, z + 0.1, s * 0.25, s * 0.7, s * 0.25, 0.3, ry, -0.2));   // cristaux d'hématite
    for (let k = 0; k < 5; k++) L.push(shape(rock(0.3), 0x5a3a2e, Math.cos(k * 1.5) * 2.8, 0.15, Math.sin(k * 1.5) * 2.4, 1, 0.8, 1, k, k));
  } else {
    L.push(shape(rock(), 0x8a7458, 0, 1.0, 0, 2.0, 1.5, 1.8, 0.4, 0.2, 0.1), shape(rock(), 0x7a6650, -1.8, 0.7, 0.4, 1.3, 1.0, 1.2, 0.9, 1.0, 0.2), shape(rock(), 0x96805f, 1.7, 0.6, 0.9, 1.2, 0.9, 1.1, 1.4, 0.4, 0));
    L.push(shape(block(), 0xf2c94a, 0.1, 1.5, 1.45, 1.8, 0.12, 0.12, 0, 0.1, 0.5, 0.05), shape(block(), 0xe8b830, -0.6, 2.1, 0.6, 1.1, 0.1, 0.1, 0.3, 0.9, -0.3, 0.05), shape(block(), 0xf2c94a, 1.3, 1.1, 0.4, 0.9, 0.1, 0.1, 0, 1.4, 0.6, 0.05));   // filons
    for (const [x, y, z, s] of [[0.5, 2.35, 0.3, 0.35], [-0.4, 1.9, 1.2, 0.28], [1.6, 1.3, 1.2, 0.3], [-1.6, 1.4, 0.9, 0.25], [2.4, 0.3, -0.8, 0.32], [-2.3, 0.3, -1.2, 0.27], [0.4, 0.3, 2.3, 0.3]])
      L.push(shape(new THREE.IcosahedronGeometry(1, 0), 0xffd84a, x, y, z, s, s * 0.8, s, x, y, 0, 0.1));                                          // pépites
    L.push(shape(block(), 0x6b4a2c, 2.7, 0.35, 1.6, 0.9, 0.6, 0.6, 0, 0.4, 0), shape(new THREE.IcosahedronGeometry(1, 0), 0xffd84a, 2.7, 0.75, 1.6, 0.32, 0.22, 0.25, 0, 0, 0));   // caisse de pépites
  }
  return mergeGeometries(L, false);
}

export class OreView {
  constructor(scene) {
    const mat = applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.meshes = {}; this.cap = 20;
    for (const r of ['stone', 'iron', 'gold']) { const m = new THREE.InstancedMesh(oreGeometry(r), mat, this.cap); m.frustumCulled = false; m.count = 0; m.castShadow = true; m.receiveShadow = true; scene.add(m); this.meshes[r] = m; }
    this.d = new THREE.Object3D(); this.t = 0;
  }
  // gisements de départ (sites des tâches) + gisements découverts ; échelle selon la réserve ; masqués sous une mine/carrière
  update(sim, clock) {
    const E = sim.eco, B = sim.build, d = this.d, n = { stone: 0, iron: 0, gold: 0 };
    const covered = (x, z) => B.items.some(s => (s.type === 'mine' || s.type === 'quarry') && Math.hypot(s.x - x, s.z - z) < 5.5);
    const put = (r, x, z, f, seed) => {
      if (f <= 0.01 || n[r] >= this.cap || covered(x, z)) return; const sc = 0.55 + 0.6 * Math.sqrt(f);
      d.position.set(x, 0, z); d.rotation.set(0, seed * 2.3, 0); d.scale.set(sc, sc, sc); d.updateMatrix(); this.meshes[r].setMatrixAt(n[r]++, d.matrix);
    };
    for (const r of ['stone', 'iron', 'gold']) {
      const T = TASKS[r]; put(r, T.site.x, T.site.z, T.deposit ? Math.min(1, E.deposit[r] / T.deposit) : 1, r.length);
      E.extra[r].forEach((e, i) => put(r, e.x, e.z, e.amount / e.max, i + 3));
    }
    for (const r in this.meshes) { const m = this.meshes[r]; m.count = n[r]; m.instanceMatrix.needsUpdate = true; }
  }
}
export { RES_INFO };
