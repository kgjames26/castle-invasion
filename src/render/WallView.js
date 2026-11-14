// Muraille v1.1 : panneaux du modèle GLB « dungeon_wall » (façade extérieure + parement intérieur) autour d'un cœur en pierre dont le dessus est
// le chemin de ronde ; escaliers pour monter les archers ; au centre, deux battants (le même panneau) pivotent pour laisser passer les troupes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SEGS, SEG_W, SECTORS, SECTOR_W, WALK_H, GATE_SEGS } from '../sim/constants.js';
import { STAIR_Z0, STAIR_Z1 } from '../sim/army.js';

export const WALL_H = 6.4, GATE_H = 4.4, Z_OUT = 143.5, Z_IN = 148.9, Z_MID = 146.2, THICK = 2.0, STEPS = 12;
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
    const panelMat = fog(new THREE.MeshLambertMaterial({ map: asset.map, side: THREE.DoubleSide })), stone = fog(new THREE.MeshLambertMaterial({ color: 0xffffff })), unit = new THREE.BoxGeometry(1, 1, 1);
    const mk = (geo, mat, cap) => { const im = new THREE.InstancedMesh(geo, mat, cap); im.frustumCulled = false; im.count = 0; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(im); return im; };
    this.outer = mk(asset.geo, panelMat, SEGS + 2); this.inner = mk(asset.geo, panelMat, SEGS + 2); this.core = mk(unit, stone, SEGS + 2);
    this.leaves = mk(asset.geo, panelMat, 2); this.steps = mk(unit, stone, STAIR_XS.length * STEPS);
    // portes : une par passage (gauche, centre, droite) ; chacune a ses deux battants et son linteau
    this.gates = GATE_SEGS.map(([a, b], g) => ({ g, segs: [a, b], x0: a * SEG_W, x1: (b + 1) * SEG_W }));
    this.stairs();
  }
  stairs() {
    const d = this.d, dz = (STAIR_Z0 - STAIR_Z1) / STEPS; let n = 0;
    for (const x of STAIR_XS) for (let i = 0; i < STEPS; i++) {
      const top = (i + 1) * WALK_H / STEPS; d.position.set(x, top / 2, STAIR_Z0 - (i + 0.5) * dz); d.scale.set(3.4, top, dz + 0.02); d.rotation.set(0, 0, 0); d.updateMatrix(); this.steps.setMatrixAt(n, d.matrix); this.steps.setColorAt(n, this.c.setRGB(0.5 + 0.012 * (i & 1), 0.48, 0.45)); n++;
    }
    this.steps.count = n; this.steps.instanceMatrix.needsUpdate = true; this.steps.instanceColor.needsUpdate = true;
  }
  place(im, k, x, y, z, ry, sx, sy, sz) { const d = this.d; d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); im.setMatrixAt(k, d.matrix); }
  tint(im, k, ratio, breached, base = 1) { const c = this.c; if (breached) c.setRGB(0.35, 0.27, 0.24); else c.setRGB(base, base, base).lerp(this.c2, (1 - ratio) * 0.85); im.setColorAt(k, c); }
  update() {
    const wall = this.sim.wall, gates = this.sim.army.gate, ease = t => t * t * (3 - 2 * t); let n = 0, nl = 0;
    for (let i = 0; i < SEGS; i++) {
      const hp = wall.hp[i], ratio = hp / wall.segMax(i), br = hp <= 0, lvl = wall.level[wall.sectorOf(i)], x = i * SEG_W + SEG_W / 2, H = WALL_H + 0.3 * (lvl - 1), k = n;
      if (wall.isGate(i)) {                                                                  // porte : deux battants + linteau
        const G = this.gates.find(q => q.segs[0] <= i && i <= q.segs[1]), gc = (G.x0 + G.x1) / 2, left = x < gc, px = left ? G.x0 : G.x1;
        const a = (br ? 0 : 1.35 * ease(gates[G.g])) * (left ? -1 : 1), m = this.m, m2 = this.m2;
        if (!br) {
          m.makeTranslation(px, 0, Z_OUT); m2.makeRotationY(a); m.multiply(m2); m2.makeTranslation(left ? SEG_W / 2 : -SEG_W / 2, 0, 0); m.multiply(m2); m2.makeScale(0.5, GATE_H / 4, THICK); m.multiply(m2);
          this.leaves.setMatrixAt(nl, m); this.tint(this.leaves, nl, ratio, false, 0.9); nl++;
        }
        continue;
      }
      this.place(this.outer, k, x, 0, Z_OUT, 0, 0.5, br ? 0.2 : H / 4, THICK); this.tint(this.outer, k, ratio, br);
      this.place(this.inner, k, x, 0, Z_IN, Math.PI, 0.5, br ? 0.2 : WALK_H / 4, THICK); this.tint(this.inner, k, ratio, br);
      this.place(this.core, k, x, br ? 0.5 : WALK_H / 2, Z_MID, 0, SEG_W, br ? 1 : WALK_H, 4.7); this.tint(this.core, k, ratio, br, 0.5); n++;
    }
    // linteau au-dessus de la porte (panneau extérieur + dalle du chemin de ronde)
    let lintels = 0;
    for (const G of this.gates) {
      const gw = G.x1 - G.x0, gc = (G.x0 + G.x1) / 2, intact = wall.hp[G.segs[0]] > 0 || wall.hp[G.segs[1]] > 0;
      if (!intact) continue;
      this.place(this.outer, n, gc, GATE_H, Z_OUT, 0, gw / 10, (WALL_H - GATE_H) / 4, THICK); this.tint(this.outer, n, 1, false);
      this.place(this.core, n, gc, (GATE_H + WALL_H - 1.2) / 2 + 0.0, Z_MID, 0, gw, WALK_H - GATE_H, 4.7); this.core.setColorAt(n, this.c.setRGB(0.5, 0.5, 0.5)); n++; lintels++;
    }
    this.outer.count = n; this.core.count = n; this.inner.count = n - lintels; this.leaves.count = nl;
    for (const im of [this.outer, this.inner, this.core, this.leaves]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }
}
