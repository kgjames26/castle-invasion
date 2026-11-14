// Rendu des PROGRÈS de l'économie : chaque niveau d'un bâtiment de récolte ajoute des installations visibles,
// les « Chemins pavés » pavent réellement les chemins, les « Chariots » donnent des brouettes puis des charrettes aux porteurs,
// les « Outils » changent la couleur des fers (bois → fer → acier → acier doré). Pure vue.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { B, mat, WOOD, DARK, GOLD, STEEL } from './Military.js';
import { applyNorthFog } from './fog.js';

export const ROADS = [[[[100, 150], [100, 200], [100, 284]], 9], [[[100, 238], [40, 255]], 5], [[[100, 238], [160, 255]], 5], [[[100, 262], [182, 243]], 4.5], [[[100, 262], [18, 238]], 4.5], [[[8, 205], [192, 205]], 4]];
const BANNER = [0xc0392b, 0x2f5fb0, 0xf2c94a];

const logs = (b, n, x, z, len = 3.2) => { for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) b.add(new THREE.CylinderGeometry(0.38, 0.38, len, 8), 0x8a5a2b, x, 0.45 + i * 0.66, z + (j - (n - i - 1) / 2) * 0.78, 0, 0, Math.PI / 2); };
const blocks = (b, n, x, z) => { for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) b.box(1.5, 0.75, 1.1, (i + j) % 2 ? 0xe2e4e6 : 0xcfd2d6, x + j * 1.6 + i * 0.8, 0.3 + i * 0.75, z); };
const wheel = (b, r, x, y, z, ry = 0) => { const m = b.add(new THREE.TorusGeometry(r, 0.08, 5, 12), DARK, x, y, z, 0, ry); for (let k = 0; k < 4; k++) b.box(0.06, r * 2, 0.06, WOOD, x, y - r, z, ry, k * Math.PI / 4); return m; };
const flag = (b, x, z, c, h = 4.2, gold = false) => { b.cyl(0.08, h, DARK, x, 0, z, 5); b.box(1.2, 0.8, 0.06, c, x + 0.62, h - 0.9, z); if (gold) { b.box(1.22, 0.08, 0.08, GOLD, x + 0.62, h - 1.3, z); b.ball(0.14, GOLD, x, h + 0.1, z); } };
const lantern = (b, x, z) => { b.cyl(0.07, 2.4, DARK, x, 0, z, 5); b.box(0.35, 0.4, 0.35, 0xf0a43a, x, 2.4, z); };
function cart(b, x, z, load, ry = 0) {
  const g = new B(); g.box(1.8, 0.5, 1.1, 0x7a4f2a, 0, 0.55, 0); for (const sx of [-0.65, 0.65]) wheel(g, 0.42, sx, 0.42, 0.62); g.box(0.08, 0.08, 1.6, WOOD, 0, 0.6, -1.2);
  if (load) for (let k = 0; k < 4; k++) g.ball(0.28, load, -0.45 + (k % 2) * 0.6, 1.15 + (k >> 1) * 0.2, -0.2 + (k >> 1) * 0.3);
  g.g.position.set(x, 0, z); g.g.rotation.y = ry; b.g.add(g.g);
}

// Installations ajoutées par niveau (2, 3, 4, 5) : toujours dans l'emprise du bâtiment ou juste à côté
export function levelProps(type, level, hw, hd) {
  const b = new B(); if (level < 2) return b.g;
  const L = level;
  switch (type) {
    case 'sawmill':
      logs(b, 3, hw - 1.6, -hd + 1.4);
      if (L >= 3) { for (const x of [-hw + 0.8, -hw + 3.4]) { b.cyl(0.18, 3.2, WOOD, x, 0, -hd - 0.4); } b.box(3.2, 0.2, 0.2, WOOD, -hw + 2.1, 3.2, -hd - 0.4); for (let k = 0; k < 5; k++) b.box(0.12, 2.4, 0.9, 0xe5c28c, -hw + 0.9 + k * 0.6, 0.6, -hd - 0.4); }   // séchoir à planches
      if (L >= 4) { cart(b, hw + 0.4, hd + 0.2, 0xd9b27a, -0.4); wheel(b, 1.5, -hw - 0.3, 1.6, 0.5, Math.PI / 2); b.box(0.5, 0.6, 3.6, 0x4f7aa8, -hw - 0.3, 0, 0.5); flag(b, hw - 0.6, -hd + 0.3, 0x5f8a45, 5, true); }   // roue à aubes + bief
      break;
    case 'quarry':
      blocks(b, 3, hw - 4.2, hd - 0.3);
      if (L >= 3) { const g = new B(); wheel(g, 1.4, 0, 1.5, 0); wheel(g, 1.4, 0, 1.5, 0.9); for (let k = 0; k < 8; k++) g.box(0.9, 0.08, 0.08, WOOD, 0, 1.5 + Math.sin(k * 0.785) * 1.4, 0.45 + Math.cos(k * 0.785) * 0, 0, 0, k * 0.785); g.box(0.2, 5.5, 0.2, WOOD, 0.3, 0, 0.45, 0, 0, -0.25); g.box(3.2, 0.2, 0.2, WOOD, 1.2, 5.2, 0.45); g.g.position.set(-hw + 1.2, 0, hd - 1); b.g.add(g.g); }   // grue à roue de carrier
      if (L >= 4) { b.box(3.6, 2.6, 2.6, 0x8a8d92, hw - 1.8, 0.3, -hd + 1.3); b.gable(4, 3, 1.2, 0x5a3a24, hw - 1.8, 2.9, -hd + 1.3); cart(b, -hw - 0.6, -0.5, 0xc4c8cc, 0.3); flag(b, -hw + 0.4, -hd + 0.4, 0x9aa0a6, 5, true); }   // atelier de taille
      break;
    case 'mine':
      cart(b, hw - 1.2, hd + 0.6, 0x5b8fd8, 0.2);
      if (L >= 3) { for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.22, 6.4, 0.22, WOOD, hw - 2 + x * 0.8, 0, -hd + 2.2 + z * 0.8, 0, x * -0.06, z * 0.06); b.box(2, 0.25, 2, DARK, hw - 2, 6.2, -hd + 2.2); wheel(b, 0.9, hw - 2, 7.2, -hd + 2.2, Math.PI / 2); }   // chevalement à poulie
      if (L >= 4) { lantern(b, -hw + 0.4, hd); lantern(b, hw - 0.4, hd + 1.2); b.box(2.8, 2.0, 2.0, 0x6b4a2c, -hw + 1.6, 0, hd - 1.2); b.gable(3.2, 2.4, 1, 0x4a3426, -hw + 1.6, 2, hd - 1.2); for (let k = 0; k < 3; k++) b.ball(0.32, k % 2 ? GOLD : 0x5b8fd8, -hw + 0.9 + k * 0.6, 2.15, hd - 0.1); }
      break;
    case 'farm': {
      const field = (x0, z0, cols, rows, c) => { for (let r = 0; r < rows; r++) for (let c2 = 0; c2 < cols; c2++) b.box(0.22, 0.8 + ((r * 3 + c2) % 3) * 0.2, 0.22, (r + c2) % 2 ? c : 0xd0aa38, x0 + c2 * 0.7, 0, z0 + r * 1.2); };
      field(-hw + 0.6, hd + 0.6, 10, 2, 0xe2c04a);
      if (L >= 3) { field(hw - 3.6, -hd - 1.6, 6, 1, 0x7ab84a); const g = new B(); g.box(1.6, 1.0, 1.2, 0xb08a4a, 0, 0, 0); g.gable(1.8, 1.4, 0.6, 0x6b3a22, 0, 1.0, 0); for (let k = 0; k < 4; k++) g.ball(0.18, 0xf4f0e6, -0.6 + k * 0.4, 0.15, 0.9); g.g.position.set(-hw - 0.4, 0, -1); b.g.add(g.g); }   // potager + poulailler
      if (L >= 4) { for (let k = 0; k < 4; k++) { b.cyl(0.14, 1.1, WOOD, hw + 0.6, 0, -hd + 1 + k * 2.2, 5); b.ball(0.8, k % 2 ? 0x4f8a3c : 0x5f9a44, hw + 0.6, 1.6, -hd + 1 + k * 2.2); b.ball(0.12, 0xd03a2a, hw + 1.1, 1.6, -hd + 1.3 + k * 2.2); } cart(b, 0, hd + 3.4, 0xe5c25a, 1.4); }   // verger + charrette de foin
      break;
    }
    case 'mill': case 'granary': case 'warehouse': {
      for (let k = 0; k < L - 1; k++) b.box(1.2, 1.0, 1.2, 0xa8793e, -hw + 0.8 + k * 1.4, 0, hd + 0.6);
      if (L >= 3) cart(b, hw + 0.4, hd + 0.4, type === 'warehouse' ? 0x9aa0a6 : 0xe5c25a, -0.5);
      if (L >= 4) flag(b, -hw + 0.3, -hd + 0.3, BANNER[2], 5, true);
      break;
    }
    default: {    // bâtiments militaires et Maison du sorcier : bannières (une par niveau), dorées aux plus hauts niveaux
      for (let k = 0; k < Math.min(4, L - 1); k++) flag(b, -hw + 0.4 + k * ((hw * 2 - 0.8) / 3), hd + 0.9, type === 'wizard' ? 0x5a2a8a : BANNER[k % 3], 4.6 + 0.3 * k, L >= 4);
      if (L >= 5) { lantern(b, -hw - 0.6, hd + 0.6); lantern(b, hw + 0.6, hd + 0.6); }
    }
  }
  return b.g;
}

// Pavés : une maille instanciée par chemin ; le niveau de « Chemins pavés » règle la densité (1 = pierres espacées, 2 = pavage, 3 = pavage + bordures + lanternes)
export class Paving {
  constructor(scene) {
    const stones = [], curbs = [], lamps = []; let sd = 7; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (const [pts, w] of ROADS) for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, ang = Math.atan2(ux, uz), hw = w * 0.42;
      for (let d = 0.6; d < len; d += 0.9) for (let o = -hw; o <= hw; o += 0.95) { const jit = (rn() - 0.5) * 0.18; stones.push([x0 + ux * d - uz * (o + jit), z0 + uz * d + ux * (o + jit), ang + (rn() - 0.5) * 0.3, 0.75 + rn() * 0.2, rn()]); }
      for (let d = 0.5; d < len; d += 1.3) for (const sgn of [-1, 1]) curbs.push([x0 + ux * d - uz * sgn * (hw + 0.6), z0 + uz * d + ux * sgn * (hw + 0.6), ang]);
      for (let d = 6; d < len; d += 16) lamps.push([x0 + ux * d - uz * (hw + 1.4), z0 + uz * d + ux * (hw + 1.4)]);
    }
    stones.sort((a, b) => a[4] - b[4]);         // ordre aléatoire : la densité croît uniformément
    const m = applyNorthFog(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    const mk = (geo, list, put) => { const im = new THREE.InstancedMesh(geo, m, list.length); const d = new THREE.Object3D(), c = new THREE.Color(); list.forEach((p, i) => { put(d, p, i); d.updateMatrix(); im.setMatrixAt(i, d.matrix); c.setHSL(0.08, 0.06, 0.48 + ((i * 7919) % 100) / 100 * 0.16); im.setColorAt(i, c); }); im.count = 0; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
    this.stones = mk(new THREE.BoxGeometry(0.85, 0.12, 0.8), stones, (d, p) => { d.position.set(p[0], 0.06, p[1]); d.rotation.set(0, p[2], 0); d.scale.set(p[3], 1, p[3]); });
    this.curbs = mk(new THREE.BoxGeometry(0.5, 0.28, 1.2), curbs, (d, p) => { d.position.set(p[0], 0.14, p[1]); d.rotation.set(0, p[2], 0); });
    const lg = mergeGeometries([new THREE.CylinderGeometry(0.08, 0.1, 2.6, 5).translate(0, 1.3, 0), new THREE.BoxGeometry(0.36, 0.42, 0.36).translate(0, 2.8, 0)]);
    this.lamps = mk(lg, lamps, (d, p) => { d.position.set(p[0], 0, p[1]); });
    this.lampPos = lamps; this.level = -1;
  }
  set(level) {
    if (level === this.level) return; this.level = level; const n = this.stones.instanceMatrix.count;
    this.stones.count = level <= 0 ? 0 : level === 1 ? Math.round(n * 0.3) : n;
    this.curbs.count = level >= 3 ? this.curbs.instanceMatrix.count : 0; this.lamps.count = level >= 3 ? this.lamps.instanceMatrix.count : 0;
  }
}
// brouette (Chariots niv. 1) puis charrette à bras (niv. 2+) : poussée devant le porteur ; le chargement prend la couleur de la ressource
export function carrierGeometry(level) {
  const parts = [], bxg = (w, h, d, c, x, y, z, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.rotateX(rx); g.translate(x, y, z); const cc = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = cc.r; a[i + 1] = cc.g; a[i + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  // le chargement (cube teinté à la couleur de la ressource) est dessiné à part : load = position et taille relatives
  if (level === 1) { parts.push(bxg(0.9, 0.35, 1.1, 0x7a4f2a, 0, -0.75, 0.2), bxg(0.12, 0.5, 0.5, 0x3a2a1c, 0, -1.1, 0.9), bxg(0.06, 0.06, 1.0, WOOD, 0.35, -0.75, -0.6), bxg(0.06, 0.06, 1.0, WOOD, -0.35, -0.75, -0.6)); return { geo: mergeGeometries(parts, false), load: [0, -0.42, 0.2, 0.75, 0.4, 0.85] }; }
  parts.push(bxg(1.3, 0.45, 1.5, 0x7a4f2a, 0, -0.6, 0.6), bxg(0.12, 0.8, 0.8, 0x3a2a1c, 0.72, -0.95, 0.6), bxg(0.12, 0.8, 0.8, 0x3a2a1c, -0.72, -0.95, 0.6), bxg(0.06, 0.06, 1.2, WOOD, 0.4, -0.5, -0.5), bxg(0.06, 0.06, 1.2, WOOD, -0.4, -0.5, -0.5));
  return { geo: mergeGeometries(parts, false), load: [0, -0.15, 0.6, 1.1, 0.55, 1.3] };
}
export const TOOL_TINT = [0x9a7a55, 0x8e949c, 0xd8e0e8, 0xf2d65e, 0xffe08a];     // Outils niv. 0 → 4 : bois/pierre → fer → acier → doré
