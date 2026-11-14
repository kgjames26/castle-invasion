// Muraille v1.1 : panneaux du modèle GLB « dungeon_wall » (façade extérieure + parement intérieur) autour d'un cœur en pierre dont le dessus est
// le chemin de ronde ; escaliers pour monter les archers.
// v1.8 : créneaux (merlons), contreforts, et pour chaque porte un CHÂTELET : deux tours carrées crénelées, une salle au-dessus du passage
// et une HERSE de fer qui monte dans le châtelet quand une escouade doit passer ; bannières aux couleurs du royaume.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SEGS, SEG_W, SECTORS, SECTOR_W, WALK_H, GATE_SEGS, wallOff, wallSlope } from '../sim/constants.js';
import { STAIR_Z0, STAIR_Z1 } from '../sim/army.js';
import { stoneMaterial } from './Stone.js';

// GATE_HS : hauteur de chaque passage (la porte centrale, la grande porte, est plus haute) ; GATE_TH : hauteur des châtelets
export const GATE_HS = [4.4, 6.2, 4.4], GATE_TH = [10.5, 13.2, 10.5];
export const WALL_H = 6.4, GATE_H = 4.4, Z_OUT = 143.5, Z_IN = 148.9, Z_MID = 146.2, THICK = 2.0, STEPS = 12;
// muraille en ARC (v2.1) : un point exprimé dans le repère « muraille droite » (x le long du mur, z en profondeur) est reporté sur l'arc :
// décalé vers le nord de wallOff(x) et tourné selon la pente locale, pour que chaque pièce suive la courbe.
export function arcPoint(x, z, out = {}) {
  const s = wallSlope(x), n = Math.hypot(1, s), nx = -s / n, nz = 1 / n, dz = z - Z_MID;
  out.x = x + nx * dz; out.z = Z_MID + wallOff(x) + nz * dz; out.ry = -Math.atan(s); return out;
}
export function arcObject(o) { const p = arcPoint(o.position.x, o.position.z); o.position.x = p.x; o.position.z = p.z; o.rotation.y += p.ry; return o; }
const _ap = {};
export const STAIR_XS = Array.from({ length: SECTORS * 2 }, (_, i) => ((i / 2) | 0) * SECTOR_W + (i % 2 ? 32 : 8));

export async function loadWall(url) {
  const g = await new GLTFLoader().loadAsync(url); let mesh = null; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);               // le panneau fait 10 × 4 × 0,66 m, pieds à y = 0
  for (const k of ['tangent', 'uv1', 'uv2']) if (geo.attributes[k]) geo.deleteAttribute(k);
  geo.computeBoundingSphere(); const map = mesh.material.map; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  return { geo, map };
}

export class WallView {
  constructor(scene, asset, sim, fog) {
    this.sim = sim; this.d = new THREE.Object3D(); this.c = new THREE.Color(); this.c2 = new THREE.Color(1, 0.35, 0.25); this.m = new THREE.Matrix4(); this.m2 = new THREE.Matrix4(); this.m3 = new THREE.Matrix4();
    const panelMat = fog(new THREE.MeshLambertMaterial({ map: asset.map, side: THREE.DoubleSide })), stone = stoneMaterial(0xffffff), unit = new THREE.BoxGeometry(1, 1, 1);
    const mk = (geo, mat, cap) => { const im = new THREE.InstancedMesh(geo, mat, cap); im.frustumCulled = false; im.count = 0; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(im); return im; };
    this.outer = mk(asset.geo, panelMat, SEGS + 2); this.inner = mk(asset.geo, panelMat, SEGS + 2); this.core = mk(unit, stone, SEGS + 2);
    this.leaves = mk(asset.geo, panelMat, 2); this.steps = mk(unit, stone, STAIR_XS.length * STEPS);
    this.merlons = mk(unit, stone, SEGS * 3 + 64); this.butt = mk(unit, stone, SEGS + 2);
    // herse : grille de barreaux de fer, pointes en bas (une instance par porte)
    const bars = [], iron = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); bars.push(g); };
    const GW = SEG_W * 2 - 0.4; for (let k = 0; k <= 8; k++) { const x = -GW / 2 + k * GW / 8; iron(0.16, GATE_H, 0.16, x, GATE_H / 2, 0); const c = new THREE.ConeGeometry(0.14, 0.4, 4); c.rotateX(Math.PI); c.translate(x, -0.15, 0); bars.push(c); }
    for (let k = 0; k < 5; k++) iron(GW, 0.14, 0.2, 0, 0.5 + k * (GATE_H - 0.8) / 4, 0);
    this.portcullis = new THREE.InstancedMesh(mergeGeometries(bars.map(g => g.index ? g.toNonIndexed() : g), false), fog(new THREE.MeshLambertMaterial({ color: 0x3a3c42, flatShading: true })), GATE_SEGS.length); this.portcullis.frustumCulled = false; scene.add(this.portcullis);
    // châtelets : tours, salle au-dessus du passage, créneaux, toits, bannières (statiques : construits une fois)
    this.gatehouse = new THREE.Group(); scene.add(this.gatehouse);
    const st = stoneMaterial(0xb0aca4), dark = stoneMaterial(0x6a6660), roof = fog(new THREE.MeshLambertMaterial({ color: 0x7a3a2a, flatShading: true })), wood = fog(new THREE.MeshLambertMaterial({ color: 0x4a3426, flatShading: true }));
    const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; arcObject(o); o.castShadow = o.receiveShadow = true; this.gatehouse.add(o); return o; };
    const wallSkin = (w, h, x, y, z, ry) => { const o = add(asset.geo, panelMat, x, y, z, ry); o.scale.set(w / 10, h / 4, 0.35); return o; };   // parement du modèle de muraille
    GATE_SEGS.forEach(([a, b], gi) => {
      const x0 = a * SEG_W, x1 = (b + 1) * SEG_W, gc = (x0 + x1) / 2, TH = GATE_TH[gi], GH = GATE_HS[gi], RW = x1 - x0 + 0.4, RD = THICK + 1.6, RZ = Z_OUT + 0.4, RY0 = GH - 0.6, RH = TH - RY0;
      add(new THREE.BoxGeometry(RW, RH, RD), dark, gc, RY0 + RH / 2, RZ);                                                                   // salle de la herse (cœur)
      wallSkin(RW + 0.1, RH, gc, RY0, RZ - RD / 2 - 0.08, 0); wallSkin(RW + 0.1, RH, gc, RY0, RZ + RD / 2 + 0.08, Math.PI);                    // façades : même parement que la muraille
      add(new THREE.BoxGeometry(RW + 0.5, 0.35, RD + 0.5), dark, gc, RY0 - 0.1, RZ);                                                          // linteau sombre au-dessus de la herse
      for (const tx of [x0 - 2.2, x1 + 2.2]) {
        add(new THREE.BoxGeometry(4.4, TH + 1.2, 6.4), st, tx, (TH + 1.2) / 2, Z_MID - 0.6);                                                       // tour du châtelet
        for (let i = 0; i < 4; i++) for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { if (i % 2) continue; const ox = dx ? dx * 2.0 : -1.6 + i * 1.1, oz = dz ? dz * 3.0 : -2.4 + i * 1.6; add(new THREE.BoxGeometry(dx ? 0.5 : 0.9, 1.0, dz ? 0.5 : 0.9), st, tx + ox, TH + 1.7, Z_MID - 0.6 + oz); }
        add(new THREE.ConeGeometry(3.5, 3.6, 4), roof, tx, TH + 3.6, Z_MID - 0.6, Math.PI / 4);
        add(new THREE.BoxGeometry(0.5, 1.1, 0.2), wood, tx, TH * 0.63, Z_OUT - 1.25).material = new THREE.MeshBasicMaterial({ color: 0x1a120c });       // meurtrière
      }
      for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.9, 0.9, 0.6), st, x0 + 0.8 + i * (x1 - x0 - 1.6) / 4, TH - 0.15, Z_OUT - 0.4);          // créneaux du châtelet
      // bannières suspendues de part et d'autre du passage
      for (const bx of [gc - 3.4, gc + 3.4]) { add(new THREE.BoxGeometry(1.5, 3.2, 0.08), fog(new THREE.MeshLambertMaterial({ color: 0x2f5fb0, side: THREE.DoubleSide })), bx, GH + 2.6, Z_OUT - 1.62); add(new THREE.BoxGeometry(1.55, 0.18, 0.1), fog(new THREE.MeshLambertMaterial({ color: 0xf2c94a })), bx, GH + 1.05, Z_OUT - 1.64); add(new THREE.BoxGeometry(0.5, 0.5, 0.1), fog(new THREE.MeshLambertMaterial({ color: 0xf2c94a })), bx, GH + 2.9, Z_OUT - 1.67, Math.PI / 4); }
    });
    // portes : une par passage (gauche, centre, droite) ; chacune a ses deux battants et son linteau
    this.gates = GATE_SEGS.map(([a, b], g) => ({ g, segs: [a, b], x0: a * SEG_W, x1: (b + 1) * SEG_W }));
    this.stairs();
  }
  stairs() {
    const d = this.d, dz = (STAIR_Z0 - STAIR_Z1) / STEPS; let n = 0;
    for (const x of STAIR_XS) for (let i = 0; i < STEPS; i++) {
      const top = (i + 1) * WALK_H / STEPS, p = arcPoint(x, STAIR_Z0 - (i + 0.5) * dz, _ap); d.position.set(p.x, top / 2, p.z); d.scale.set(3.4, top, dz + 0.02); d.rotation.set(0, p.ry, 0); d.updateMatrix(); this.steps.setMatrixAt(n, d.matrix); this.steps.setColorAt(n, this.c.setRGB(0.5 + 0.012 * (i & 1), 0.48, 0.45)); n++;
    }
    this.steps.count = n; this.steps.instanceMatrix.needsUpdate = true; this.steps.instanceColor.needsUpdate = true;
  }
  place(im, k, x, y, z, ry, sx, sy, sz) { const d = this.d, p = arcPoint(x, z, _ap); d.position.set(p.x, y, p.z); d.rotation.set(0, ry + p.ry, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); im.setMatrixAt(k, d.matrix); }
  tint(im, k, ratio, breached, base = 1) { const c = this.c; if (breached) c.setRGB(0.35, 0.27, 0.24); else c.setRGB(base, base, base).lerp(this.c2, (1 - ratio) * 0.85); im.setColorAt(k, c); }
  update() {
    const wall = this.sim.wall, gates = this.sim.army.gate, ease = t => t * t * (3 - 2 * t); let n = 0, nl = 0;
    for (let i = 0; i < SEGS; i++) {
      const hp = wall.hp[i], ratio = hp / wall.segMax(i), br = hp <= 0, lvl = wall.level[wall.sectorOf(i)], x = i * SEG_W + SEG_W / 2, H = WALL_H + 0.3 * (lvl - 1), k = n;
      if (wall.isGate(i)) continue;                                                           // porte : herse (plus bas)
      this.place(this.outer, k, x, 0, Z_OUT, 0, 0.5, br ? 0.2 : H / 4, THICK); this.tint(this.outer, k, ratio, br);
      this.place(this.inner, k, x, 0, Z_IN, Math.PI, 0.5, br ? 0.2 : WALK_H / 4, THICK); this.tint(this.inner, k, ratio, br);
      this.place(this.core, k, x, br ? 0.5 : WALK_H / 2, Z_MID, 0, SEG_W, br ? 1 : WALK_H, 4.7); this.tint(this.core, k, ratio, br, 0.5); n++;
    }
    // linteau au-dessus de la porte (panneau extérieur + dalle du chemin de ronde)
    let lintels = 0;
    for (const G of this.gates) {
      const gw = G.x1 - G.x0, gc = (G.x0 + G.x1) / 2, intact = wall.hp[G.segs[0]] > 0 || wall.hp[G.segs[1]] > 0, GH = GATE_HS[G.g];
      if (!intact) continue;
      this.place(this.outer, n, gc, GH, Z_OUT, 0, gw / 10, Math.max(0.05, WALL_H - GH) / 4, THICK); this.tint(this.outer, n, 1, false);
      const top = Math.max(WALK_H, GH + 0.4); this.place(this.core, n, gc, (GH + top) / 2, Z_MID, 0, gw, top - GH, 4.7); this.core.setColorAt(n, this.c.setRGB(0.5, 0.5, 0.5)); n++; lintels++;
    }
    this.outer.count = n; this.core.count = n; this.inner.count = n - lintels; this.leaves.count = nl;
    // herses : montent dans le châtelet à l'ouverture ; disparaissent si la porte est détruite
    this.gates.forEach((G, k) => {
      const GH = GATE_HS[G.g], intact = wall.hp[G.segs[0]] > 0 || wall.hp[G.segs[1]] > 0, up = ease(gates[G.g]) * (GH - 0.3);
      this.place(this.portcullis, k, (G.x0 + G.x1) / 2, intact ? up : -20, Z_OUT + 0.15, 0, 1, GH / GATE_H, 1.25);
      const r = Math.min(wall.hp[G.segs[0]] / wall.segMax(G.segs[0]), wall.hp[G.segs[1]] / wall.segMax(G.segs[1])); this.portcullis.setColorAt(k, this.c.setRGB(1, 1, 1).lerp(this.c2, (1 - Math.max(0, r)) * 0.8));
    });
    this.portcullis.instanceMatrix.needsUpdate = true; if (this.portcullis.instanceColor) this.portcullis.instanceColor.needsUpdate = true;
    // créneaux (3 merlons par tronçon intact, plus hauts selon le niveau) et contreforts sur la face nord
    let nm = 0, nb = 0;
    for (let i = 0; i < SEGS; i++) {
      if (wall.isGate(i) || wall.hp[i] <= 0) continue;
      const lvl = wall.level[wall.sectorOf(i)], H = WALL_H + 0.3 * (lvl - 1), ratio = wall.hp[i] / wall.segMax(i);
      for (let k = 0; k < 3; k++) { if (ratio < 0.5 && k === ((i * 7) % 3)) continue; this.place(this.merlons, nm, i * SEG_W + 0.85 + k * 1.65, H + 0.45, Z_OUT - 0.1, 0, 1.0, 0.9 + 0.08 * lvl, 0.7); this.tint(this.merlons, nm, ratio, false, 0.95); nm++; }
      const nx = i + 1; if (nx < SEGS && !wall.isGate(nx) && wall.hp[nx] > 0 && (i & 1)) { this.place(this.butt, nb, nx * SEG_W, 1.6, Z_OUT - 1.0, 0, 1.1, 3.2 + 0.2 * lvl, 1.6); this.tint(this.butt, nb, ratio, false, 0.8); nb++; }
    }
    this.merlons.count = nm; this.butt.count = nb;
    for (const im of [this.merlons, this.butt]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
    for (const im of [this.outer, this.inner, this.core, this.leaves]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }
}
