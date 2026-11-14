// Troupes et machines de siège : modèles simples en boîtes colorées, animés par pièces (jambes, bras, bras de lancer…).
// Chaque pièce est un InstancedMesh : une matrice par instance ET par pièce (pivot + rotation locale), donc des centaines d'unités
// restent bon marché. Les modèles regardent vers +z (sud) pour les troupes ; les machines de siège regardent vers -z (nord, côté zombies).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyNorthFog } from './fog.js';

const _c = new THREE.Color();
// boîte colorée (couleurs de sommets, léger bruit par face pour casser les aplats) placée en coordonnées « modèle »
function bx(w, h, d, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  _c.set(color); const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) { const f = 0.93 + ((i * 7919) % 100) / 100 * 0.14; for (let k = 0; k < 3; k++) { col[(i + k) * 3] = _c.r * f; col[(i + k) * 3 + 1] = _c.g * f; col[(i + k) * 3 + 2] = _c.b * f; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
function cyl(r, h, color, x, y, z, rx = 0, rz = 0, seg = 8) {   // cylindre coloré
  const g = new THREE.CylinderGeometry(r, r, h, seg).toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1)));
  _c.set(color); const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
// pièce : géométrie fusionnée, exprimée relativement à son pivot ; mode 'rot' (rotation autour de x) ou 'slide' (translation en z) ou 'fix'
function part(name, pivot, list, mode = 'fix', rel = false) {
  const g = mergeGeometries(list, false); if (!rel) g.translate(-pivot[0], -pivot[1], -pivot[2]); g.computeBoundingSphere();
  g.boundingSphere.radius = 12; return { name, pivot: new THREE.Vector3(...pivot), geo: g, mode };
}

const SKIN = 0xe0b48c, STEEL = 0xcfd6dd, DARKSTEEL = 0x8e98a4, LEATHER = 0x5a3a22, WOODC = 0x7a5a3a, DARKWOOD = 0x4a3426, IRON = 0x6f7780;

// ——— fantassin : tunique, bouclier, casque, épée ; « lourd » = armure d'acier, grand bouclier, cimier ———
function footParts(P) {
  const heavy = !!P.heavy;
  const body = [
    bx(0.5, 0.62, 0.3, P.cloth, 0, 1.06, 0), bx(0.54, 0.12, 0.34, LEATHER, 0, 0.78, 0),
    bx(0.28, 0.28, 0.28, SKIN, 0, 1.55, 0.01), bx(0.34, 0.15, 0.36, P.helm, 0, 1.69, 0.01), bx(0.07, 0.2, 0.3, P.plume, 0, 1.8, 0, 0.0),
    bx(0.12, 0.5, 0.12, P.cloth, -0.31, 1.0, 0),                                               // bras gauche
    heavy ? bx(0.1, 0.78, 0.5, P.shield, -0.4, 1.0, 0.1) : bx(0.08, 0.52, 0.42, P.shield, -0.38, 1.05, 0.1),
    bx(0.06, 0.34, 0.06, P.trim, -0.43, 1.05, 0.1, 0, 0, 0), bx(0.1, 0.06, 0.34, P.trim, -0.43, 1.05, 0.1),   // croix sur l'écu
  ];
  if (heavy) body.push(bx(0.6, 0.2, 0.38, DARKSTEEL, 0, 1.3, 0), bx(0.18, 0.14, 0.34, DARKSTEEL, 0.34, 1.34, 0), bx(0.18, 0.14, 0.34, DARKSTEEL, -0.34, 1.34, 0));
  const leg = () => [bx(0.18, 0.7, 0.2, P.legs, 0, -0.35, 0), bx(0.2, 0.12, 0.28, LEATHER, 0, -0.66, 0.03)];
  const sword = [bx(0.12, 0.5, 0.12, P.cloth, 0, -0.18, 0), bx(0.07, 0.07, 0.95, STEEL, 0, -0.42, 0.5), bx(0.22, 0.06, 0.07, P.trim, 0, -0.42, 0.04)];   // relatif à l'épaule
  return [
    part('body', [0, 0, 0], body),
    part('legL', [-0.12, 0.72, 0], leg(), 'rot', true), part('legR', [0.12, 0.72, 0], leg(), 'rot', true),
    part('arm', [0.32, 1.3, 0], sword, 'rot', true),
  ];
}
// ——— cavalier : cheval brun caparaçonné, cavalier casqué à l'épée dressée ———
function horseParts(P) {
  const H = P.horse;
  const body = [
    bx(0.62, 0.62, 1.5, H, 0, 1.1, 0), bx(0.66, 0.1, 0.8, P.cloth, 0, 1.45, 0), bx(0.5, 0.52, 0.4, H, 0, 1.18, 0.72),   // croupe, caparaçon, poitrail
    bx(0.24, 0.7, 0.3, H, 0, 1.62, 0.92, 0.5), bx(0.22, 0.26, 0.55, H, 0, 1.98, 1.2, 0.2), bx(0.06, 0.3, 0.12, P.mane, 0, 1.74, 0.82, 0.5), bx(0.2, 0.06, 0.1, DARKWOOD, 0, 1.96, 1.5),
    bx(0.1, 0.3, 0.1, H, 0.07, 2.18, 1.1), bx(0.1, 0.3, 0.1, H, -0.07, 2.18, 1.1),            // oreilles
    bx(0.1, 0.5, 0.14, P.mane, 0, 1.2, -0.85, -0.5),                                          // queue
    bx(0.4, 0.55, 0.26, P.cloth, 0, 1.78, 0), bx(0.26, 0.26, 0.26, SKIN, 0, 2.2, 0.01), bx(0.32, 0.14, 0.34, P.helm, 0, 2.34, 0.01), bx(0.06, 0.24, 0.3, P.plume, 0, 2.5, 0),
    bx(0.1, 0.42, 0.34, P.shield, -0.3, 1.72, 0.1), bx(0.1, 0.1, 0.1, LEATHER, 0.07, 1.46, 0.5),   // bouclier + selle
    bx(0.11, 0.4, 0.11, P.cloth, -0.26, 1.66, 0.05),
  ];
  const leg = (x, z) => [bx(0.15, 0.9, 0.16, H, x, -0.45, z), bx(0.17, 0.12, 0.19, DARKWOOD, x, -0.86, z)];
  return [
    part('body', [0, 0, 0], body),
    part('fl', [0, 0.84, 0.56], [...leg(0.2, 0), ...leg(-0.2, 0)], 'rot', true), part('bl', [0, 0.84, -0.56], [...leg(0.2, 0), ...leg(-0.2, 0)], 'rot', true),
    part('arm', [0.3, 1.92, 0.02], [bx(0.11, 0.38, 0.11, P.cloth, 0.3, 1.74, 0.02), bx(0.07, 1.05, 0.07, STEEL, 0.3, 2.35, 0.02), bx(0.22, 0.06, 0.07, P.trim, 0.3, 1.9, 0.02)], 'rot'),
  ];
}

// ——— catapulte : châssis à roues, montants, bras à cuillère, contrepoids (regarde vers -z) ———
function catapultParts() {
  const frame = [
    bx(0.3, 0.3, 3.4, WOODC, -0.7, 0.9, 0), bx(0.3, 0.3, 3.4, WOODC, 0.7, 0.9, 0), bx(1.7, 0.28, 0.3, DARKWOOD, 0, 0.95, -1.2), bx(1.7, 0.28, 0.3, DARKWOOD, 0, 0.95, 1.2),
    bx(0.3, 1.6, 0.3, DARKWOOD, -0.7, 1.7, 0.3), bx(0.3, 1.6, 0.3, DARKWOOD, 0.7, 1.7, 0.3), bx(1.7, 0.26, 0.3, DARKWOOD, 0, 2.45, 0.3),
    bx(0.14, 0.14, 1.2, IRON, 0, 1.35, -1.0), bx(0.5, 0.5, 0.5, 0x8a8a88, 0, 1.2, -1.2),                                  // butée + boulet en réserve
    ...[[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]].map(([sx, z]) => cyl(0.62, 0.28, DARKWOOD, sx * 1.0, 0.62, z, 0, Math.PI / 2, 10)),
    ...[[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]].map(([sx, z]) => cyl(0.14, 0.34, IRON, sx * 1.0, 0.62, z, 0, Math.PI / 2, 6)),
  ];
  // bras : le long côté (cuillère) part vers -z, le court côté porte le contrepoids vers +z
  const arm = [bx(0.26, 0.26, 3.1, 0x8a6a3a, 0, 0, -1.1), bx(0.7, 0.2, 0.8, DARKWOOD, 0, 0.1, -2.8), bx(0.5, 0.35, 0.5, 0x8a8a88, 0, 0.35, -2.8), bx(0.8, 0.8, 0.8, 0x5d5d62, 0, -0.1, 0.55)];
  return [part('base', [0, 0, 0], frame), part('arm', [0, 2.25, 0.3], arm, 'rot', true)];
}
// ——— trébuchet : portique en A, grand bras, contrepoids en caisse, fronde ———
function trebuchetParts() {
  const frame = [
    bx(0.4, 0.4, 4.4, DARKWOOD, -1.2, 0.3, 0), bx(0.4, 0.4, 4.4, DARKWOOD, 1.2, 0.3, 0), bx(2.8, 0.36, 0.4, DARKWOOD, 0, 0.3, -2.0), bx(2.8, 0.36, 0.4, DARKWOOD, 0, 0.3, 2.0),
    // montants en A (deux de chaque côté, penchés)
    bx(0.32, 4.6, 0.32, WOODC, -1.15, 2.6, -0.9, 0, 0, 0.0), bx(0.32, 4.6, 0.32, WOODC, -1.15, 2.6, 0.9), bx(0.32, 4.6, 0.32, WOODC, 1.15, 2.6, -0.9), bx(0.32, 4.6, 0.32, WOODC, 1.15, 2.6, 0.9),
    bx(0.3, 0.3, 2.4, IRON, -1.15, 4.7, 0), bx(0.3, 0.3, 2.4, IRON, 1.15, 4.7, 0), bx(2.8, 0.3, 0.3, DARKWOOD, 0, 2.3, -0.9), bx(2.8, 0.3, 0.3, DARKWOOD, 0, 2.3, 0.9),
    bx(0.5, 0.5, 0.5, 0x8a8a88, 0, 0.7, -1.7),                                                                           // boulet posé
  ];
  const arm = [bx(0.34, 0.34, 6.6, 0x8a6a3a, 0, 0, -1.6), bx(0.16, 0.16, 1.4, LEATHER, 0, -0.1, -5.2), bx(0.6, 0.5, 0.6, LEATHER, 0, -0.35, -5.9), bx(0.9, 0.9, 1.1, 0x5d5d62, 0, -0.1, 1.9), bx(1.4, 0.5, 1.6, DARKSTEEL, 0, -0.9, 1.9)];
  return [part('base', [0, 0, 0], frame), part('arm', [0, 4.7, 0], arm, 'rot', true)];
}
// ——— baliste : grand arc sur affût à roues, trait ———
function ballistaParts() {
  const frame = [bx(0.4, 0.3, 2.6, WOODC, 0, 0.9, 0), bx(0.3, 0.9, 0.3, DARKWOOD, 0, 0.45, 0.4), bx(2.4, 0.18, 0.2, 0x7a4f2a, 0, 1.4, -0.6, 0, 0.0), bx(0.18, 0.18, 1.0, 0x7a4f2a, -1.2, 1.4, -0.3, 0, 0.5), bx(0.18, 0.18, 1.0, 0x7a4f2a, 1.2, 1.4, -0.3, 0, -0.5),
    ...[-1, 1].map(s => cyl(0.55, 0.22, DARKWOOD, s * 0.7, 0.55, 0.9, 0, Math.PI / 2, 10))];
  const bolt = [bx(0.08, 0.08, 1.7, 0xf5e6b0, 0, 1.55, -0.2), bx(0.16, 0.16, 0.3, STEEL, 0, 1.55, -1.1), bx(1.9, 0.04, 0.04, 0xe8e8e0, 0, 1.45, 0.4)];
  return [part('base', [0, 0, 0], frame), part('bolt', [0, 0, 0], bolt, 'slide')];
}

export const PALETTES = {
  soldier: { cloth: 0x3d7bd6, legs: 0x3a3f52, helm: STEEL, plume: 0xc0392b, shield: 0x2f5fb0, trim: 0xf2d65e },
  heavy: { cloth: 0x6f7f9c, legs: 0x4a5266, helm: DARKSTEEL, plume: 0x2a2f3a, shield: 0x8e98a4, trim: 0xc0392b, heavy: true },
  cavalry: { cloth: 0x8c3fb0, legs: 0x4a3426, helm: STEEL, plume: 0xf2d65e, shield: 0x6b2d8a, trim: 0xf2d65e, horse: 0x8b5a2b, mane: 0x3a2a1c },
};
const MAT = applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));

// Jeu de pièces instanciées pour un modèle.
export class Rig {
  constructor(scene, parts, cap) {
    this.parts = parts; this.cap = cap; this.n = 0;
    this.meshes = parts.map(p => { const im = new THREE.InstancedMesh(p.geo, MAT, cap); im.frustumCulled = false; im.count = 0; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(im); return im; });
    this._m = new THREE.Matrix4(); this._l = new THREE.Matrix4();
  }
  begin() { this.n = 0; }
  // base : matrice de l'instance ; r : g, b teinte (>1 = éclaircit) ; ang : valeur par pièce (angle pour 'rot', décalage en z pour 'slide')
  push(base, tint, ang) {
    if (this.n >= this.cap) return;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i], l = this._l;
      if (p.mode === 'rot') { l.makeRotationX(ang[i] || 0); l.setPosition(p.pivot.x, p.pivot.y, p.pivot.z); }
      else if (p.mode === 'slide') l.makeTranslation(p.pivot.x, p.pivot.y, p.pivot.z + (ang[i] || 0));
      else l.makeTranslation(p.pivot.x, p.pivot.y, p.pivot.z);
      this._m.multiplyMatrices(base, l); this.meshes[i].setMatrixAt(this.n, this._m); this.meshes[i].setColorAt(this.n, tint);
    }
    this.n++;
  }
  end() { for (const m of this.meshes) { m.count = this.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
}

export function buildTroopRigs(scene) {
  return {
    soldier: new Rig(scene, footParts(PALETTES.soldier), 900), heavy: new Rig(scene, footParts(PALETTES.heavy), 600), cavalry: new Rig(scene, horseParts(PALETTES.cavalry), 600),
    ballista: new Rig(scene, ballistaParts(), 24), catapult: new Rig(scene, catapultParts(), 24), trebuchet: new Rig(scene, trebuchetParts(), 24),
  };
}

// Angle du bras de lancer selon le temps écoulé depuis le tir (e) et la durée de rechargement (R) : armé → détente rapide → remontée lente
const ARM = { catapult: { c: Math.PI + 0.55, f: 0.85 }, trebuchet: { c: Math.PI + 0.95, f: 0.55 } };
export function throwAngle(type, e, R, noAmmo) {
  const A = ARM[type]; if (!A) return 0; if (noAmmo || e < 0 || e > R) return A.c;
  if (e < 0.35) { const f = e / 0.35; return A.c + (A.f - A.c) * f * f; }
  if (e < 1.0) return A.f + 0.05 * Math.sin((e - 0.35) * 14) * (1 - (e - 0.35) / 0.65);
  const t = Math.min(1, (e - 1.0) / Math.max(0.5, R - 1.8)); return A.f + (A.c - A.f) * t;
}
