// Cour intérieure au pied de la muraille (v4.3) : décor qui raconte la vie du rempart, sans gêner les troupes.
// Tonneaux, caisses, bottes de foin, râteliers de lances, piles de bûches, braseros (flamme qui vacille, lueur la nuit)
// et grandes bannières bleues accrochées à la face intérieure du mur. Tout est fusionné en quelques maillages.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SECTORS, SECTOR_W } from '../sim/constants.js';
import { GATE_XS } from '../sim/constants.js';
import { arcPoint, STAIR_XS, Z_IN } from './WallView.js';
import { applyNorthFog, applyFlutterFog } from './fog.js';

const lam = (c, o = {}) => applyNorthFog(new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o }));
const _p = {};
// halo doux (dégradé radial) pour la lueur des braseros au sol
function flameTex() { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d'), r = g.createLinearGradient(0, 64, 0, 0); r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(0.35, 'rgba(255,170,70,.9)'); r.addColorStop(0.75, 'rgba(220,70,20,.5)'); r.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 8, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export class Bailey {
  constructor(scene) {
    this.scene = scene; let sd = 911; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const wood = [], dark = [], hay = [], metal = [], cloth = [], gold = [], flames = [], stone = [];
    // place une géométrie dans le repère « muraille droite » (x le long du mur, z en profondeur) → suit l'arc
    const put = (list, g, x, y, z, ry = 0) => { const p = arcPoint(x, z, _p); g.rotateY(ry + p.ry); g.translate(p.x, y, p.z); list.push(g.toNonIndexed ? (g.index ? g.toNonIndexed() : g) : g); };
    const free = x => STAIR_XS.every(s => Math.abs(x - s) > 3.2) && GATE_XS.every(g => Math.abs(x - g) > 7.5) && x > 4 && x < SECTORS * SECTOR_W - 4;
    const FACE = Z_IN + 1.05, z0 = FACE + 0.9;     // juste au pied du mur, côté cour
    const barrel = (x, z) => { const h = 1.0, r = 0.42; put(wood, new THREE.CylinderGeometry(r * 0.92, r * 0.92, h, 10).translate(0, h / 2, 0), x, 0, z); for (const y of [0.18, 0.82]) put(metal, new THREE.CylinderGeometry(r * 1.0, r * 1.0, 0.07, 10).translate(0, y, 0), x, 0, z); put(dark, new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.02, 10).translate(0, h + 0.005, 0), x, 0, z); };
    const crate = (x, z, s, y = 0, ry = 0) => { put(wood, new THREE.BoxGeometry(s, s, s).translate(0, y + s / 2, 0), x, 0, z, ry); for (const o of [-1, 1]) put(dark, new THREE.BoxGeometry(s * 1.02, 0.08, 0.08).translate(0, y + s / 2 + o * s * 0.35, s * 0.51), x, 0, z, ry); };
    const bale = (x, z, y = 0, ry = 0) => put(hay, new THREE.BoxGeometry(1.3, 0.6, 0.7).translate(0, y + 0.3, 0), x, 0, z, ry);
    const logs = (x, z) => { for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) put(wood, new THREE.CylinderGeometry(0.17, 0.17, 1.6, 7).rotateZ(Math.PI / 2).translate(0, 0.17 + r * 0.3, (k - (3 - r) / 2) * 0.34), x, 0, z); };
    const rack = (x, z) => { for (const o of [-0.8, 0.8]) put(dark, new THREE.BoxGeometry(0.1, 1.5, 0.1).translate(o, 0.75, 0), x, 0, z); put(dark, new THREE.BoxGeometry(1.8, 0.08, 0.1).translate(0, 1.2, 0), x, 0, z); put(dark, new THREE.BoxGeometry(1.8, 0.08, 0.1).translate(0, 0.35, 0), x, 0, z);
      for (let k = 0; k < 5; k++) { const lx = -0.6 + k * 0.3; put(wood, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4).rotateX(-0.12).translate(lx, 1.2, -0.1), x, 0, z); put(metal, new THREE.ConeGeometry(0.06, 0.28, 4).translate(lx, 2.5, -0.25), x, 0, z); }
      put(metal, new THREE.CylinderGeometry(0.45, 0.45, 0.06, 12).rotateX(Math.PI / 2).translate(1.25, 0.55, -0.1), x, 0, z); put(cloth, new THREE.CylinderGeometry(0.3, 0.3, 0.07, 12).rotateX(Math.PI / 2).translate(1.25, 0.55, -0.06), x, 0, z); };
    this.flames = [];
    const brazier = (x, z) => { put(metal, new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5).translate(0, 0.5, 0), x, 0, z); put(metal, new THREE.CylinderGeometry(0.45, 0.25, 0.35, 9, 1, true).translate(0, 1.15, 0), x, 0, z); put(stone, new THREE.CylinderGeometry(0.5, 0.55, 0.1, 9).translate(0, 0.05, 0), x, 0, z);
      const p = arcPoint(x, z, _p); this.flames.push({ x: p.x, z: p.z, ph: rn() * 6 }); };
    // une vignette différente entre chaque paire d'escaliers / porte
    const KINDS = ['barrels', 'crates', 'hay', 'rack', 'logs', 'mix'];
    let kk = 0;
    for (let x = 8; x < SECTORS * SECTOR_W - 6; x += 5) {
      if (!free(x)) continue; const z = z0 + rn() * 0.6, kind = KINDS[kk++ % KINDS.length];
      if (kind === 'barrels') { barrel(x - 0.5, z); barrel(x + 0.45, z + 0.15); barrel(x, z + 0.9); }
      else if (kind === 'crates') { crate(x - 0.5, z + 0.1, 0.9, 0, 0.1); crate(x + 0.55, z + 0.2, 0.75, 0, -0.2); crate(x - 0.4, z + 0.1, 0.65, 0.9, 0.3); }
      else if (kind === 'hay') { bale(x - 0.3, z + 0.1, 0, 0.05); bale(x + 0.9, z + 0.15, 0, -0.08); bale(x + 0.3, z + 0.12, 0.6, 0.1); }
      else if (kind === 'rack') rack(x, z + 0.2);
      else if (kind === 'logs') logs(x, z + 0.4);
      else { barrel(x - 0.7, z + 0.1); crate(x + 0.4, z + 0.2, 0.8, 0, 0.25); bale(x + 0.2, z + 1.2, 0, 1.4); }
    }
    // braseros de part et d'autre des portes (là où passent les troupes)
    for (const g of GATE_XS) for (const o of [-5.2, 5.2]) brazier(g + o, FACE + 1.2);
    // bannières sur la face intérieure du mur, au milieu de chaque tronçon libre
    for (let s = 0; s < SECTORS; s++) for (const f of [0.3, 0.7]) { const x = s * SECTOR_W + f * SECTOR_W; if (!free(x)) continue;
      put(cloth, new THREE.PlaneGeometry(1.7, 2.8, 1, 4).translate(0, 3.2, 0), x, 0, FACE + 0.12);
      put(gold, new THREE.BoxGeometry(1.9, 0.12, 0.12).translate(0, 4.65, 0), x, 0, FACE + 0.16);
      put(gold, new THREE.BoxGeometry(0.55, 0.55, 0.04).rotateZ(Math.PI / 4).translate(0, 3.4, 0), x, 0, FACE + 0.18); }
    const mesh = (list, m, cast = true) => { if (!list.length) return null; const mm = new THREE.Mesh(mergeGeometries(list.map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })), m); mm.castShadow = cast; mm.receiveShadow = true; scene.add(mm); return mm; };
    mesh(wood, lam(0x8a5a32)); mesh(dark, lam(0x4a3220)); mesh(hay, lam(0xd8b45a)); mesh(metal, lam(0x4a4c52)); mesh(stone, lam(0x7d7a72)); mesh(gold, lam(0xf2c94a));
    mesh(cloth, applyFlutterFog(new THREE.MeshLambertMaterial({ color: 0x2f5fb0, side: THREE.DoubleSide }), 0.05), false);
    // flammes des braseros : petites pyramides lumineuses qui vacillent
    // flamme : trois langues croisées (dégradé vertical, mélange additif) + un cœur jaune vif
    const tongue = (r, h, a) => new THREE.ConeGeometry(r, h, 5, 1, true).translate(0, h / 2, 0).rotateY(a), fl = mergeGeometries([tongue(0.34, 0.95, 0), tongue(0.26, 1.15, 1.1).translate(0.06, 0, 0.04), tongue(0.22, 0.8, 2.2).translate(-0.07, 0, -0.03)]);
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a30, map: flameTex(), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.flameM = new THREE.InstancedMesh(fl, this.flameMat, this.flames.length); this.flameM.castShadow = false; scene.add(this.flameM);
    this.coreM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.5, 6).translate(0, 0.25, 0), new THREE.MeshBasicMaterial({ color: 0xffe38a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }), this.flames.length); scene.add(this.coreM);
    this.glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff9a40, map: glowTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), this.flames.length); scene.add(this.glow);
    this.d = new THREE.Object3D(); this.t = 0;
  }
  update(dt, light = 1) {
    this.t += dt; const d = this.d, night = Math.max(0, Math.min(1, (0.8 - light) / 0.5));
    this.flames.forEach((f, i) => { const k = 0.85 + 0.25 * Math.sin(this.t * 9 + f.ph) + 0.1 * Math.sin(this.t * 23 + f.ph * 2);
      d.position.set(f.x, 1.2, f.z); d.rotation.set(0.06 * Math.sin(this.t * 5 + f.ph), this.t * 1.5 + f.ph, 0.06 * Math.cos(this.t * 6 + f.ph)); d.scale.set(1, k, 1); d.updateMatrix(); this.flameM.setMatrixAt(i, d.matrix); d.scale.set(1, 0.8 + 0.3 * k, 1); d.updateMatrix(); this.coreM.setMatrixAt(i, d.matrix);
      d.position.set(f.x, 0.04, f.z); d.rotation.set(0, 0, 0); d.scale.setScalar(0.9 + 0.1 * k); d.updateMatrix(); this.glow.setMatrixAt(i, d.matrix); });
    this.flameM.instanceMatrix.needsUpdate = true; this.coreM.instanceMatrix.needsUpdate = true; this.glow.instanceMatrix.needsUpdate = true; this.glow.material.opacity = 0.03 + 0.55 * night;
  }
}
