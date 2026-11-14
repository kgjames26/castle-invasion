// Modèles low-poly procéduraux (unités, zombies, siège, gisements, projectiles)
// Toutes les géométries portent des couleurs de sommets → un seul matériau, un seul draw call par type.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
function P(geom, color, t = {}) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx || 0, t.ry || 0, t.rz || 0));
  m.compose(new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0), q, new THREE.Vector3(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1));
  g.applyMatrix4(m);
  _c.set(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const jitter = t.jitter ?? 0.06;
  for (let i = 0; i < n; i += 3) {
    const f = 1 - jitter + Math.random() * jitter * 2;
    for (let k = 0; k < 3 && i + k < n; k++) {
      col[(i + k) * 3] = _c.r * f; col[(i + k) * 3 + 1] = _c.g * f; col[(i + k) * 3 + 2] = _c.b * f;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const dode = r => new THREE.DodecahedronGeometry(r, 0);
const oct = r => new THREE.OctahedronGeometry(r, 0);
const merge = parts => { const g = mergeGeometries(parts, false); g.computeBoundingSphere(); return g; };

// ---------- Humanoïde générique ----------
function humanoid(o) {
  const s = o.skin, parts = [];
  const legH = o.legH ?? 0.8, torsoH = o.torsoH ?? 0.7, hunch = o.hunch ?? 0;
  parts.push(P(box(0.2, legH, 0.22), o.pants, { x: -0.13, y: legH / 2 }));
  parts.push(P(box(0.2, legH, 0.22), o.pants, { x: 0.13, y: legH / 2 }));
  parts.push(P(box(0.52, torsoH, 0.32), o.tunic, { y: legH + torsoH / 2, rx: hunch, z: hunch * 0.3 }));
  parts.push(P(box(0.3, 0.3, 0.3), s, { y: legH + torsoH + 0.18, z: hunch * 0.55 + (o.headZ || 0) }));
  const armRx = o.armRx ?? 0, armY = legH + torsoH - 0.05;
  parts.push(P(box(0.14, 0.62, 0.14), o.arms || o.tunic, { x: -0.34, y: armY - 0.28 * Math.cos(armRx), z: 0.28 * Math.sin(armRx) + hunch * 0.3, rx: armRx }));
  parts.push(P(box(0.14, 0.62, 0.14), o.arms || o.tunic, { x: 0.34, y: armY - 0.28 * Math.cos(armRx), z: 0.28 * Math.sin(armRx) + hunch * 0.3, rx: armRx }));
  return parts;
}

export function buildUnitGeometries() {
  const G = {};
  const BLUE = 0x2c4c8c, STEEL = 0xa8b0b8, SKIN = 0xe0b48c, LEATHER = 0x6b4a2b;
  // Cultivateur
  G.cultivator = merge([
    ...humanoid({ skin: SKIN, tunic: 0x8a6a3a, pants: 0x4a3b2a }),
    P(cone(0.38, 0.22, 8), 0xe8c86a, { y: 1.83 }),
    P(box(0.06, 0.9, 0.06), LEATHER, { x: 0.38, y: 1.25, z: 0.12, rx: 0.4 }),
    P(box(0.5, 0.08, 0.08), 0x8890a0, { x: 0.38, y: 1.66, z: 0.3, rx: 0.4 }),
    P(box(0.3, 0.3, 0.2), 0x7a5a30, { y: 1.15, z: -0.24 }), // panier
  ]);
  // Soldat
  G.soldier = merge([
    ...humanoid({ skin: SKIN, tunic: BLUE, pants: 0x2a2a30, arms: 0x8e969e }),
    P(cyl(0.18, 0.2, 0.2, 8), STEEL, { y: 1.78 }),
    P(cone(0.2, 0.18, 8), STEEL, { y: 1.95 }),
    P(box(0.08, 0.6, 0.5), 0x1d3a7a, { x: -0.46, y: 1.0, z: 0.12 }),
    P(box(0.09, 0.62, 0.12), 0xd8c04a, { x: -0.5, y: 1.0, z: 0.12 }),
    P(box(0.05, 0.75, 0.08), STEEL, { x: 0.38, y: 1.15, z: 0.25, rx: 0.5 }),
  ]);
  // Archer
  const bow = new THREE.TorusGeometry(0.45, 0.03, 4, 10, Math.PI);
  G.archer = merge([
    ...humanoid({ skin: SKIN, tunic: 0x2f5a2f, pants: 0x3a3226 }),
    P(cone(0.24, 0.42, 6), 0x24452a, { y: 1.95 }),
    P(bow, 0x5a3a1a, { x: -0.42, y: 1.15, z: 0.15, rz: Math.PI / 2, ry: Math.PI / 2 }),
    P(cyl(0.08, 0.08, 0.6), LEATHER, { y: 1.25, z: -0.22, rx: 0.3 }),
  ]);
  // Cavalier
  const horse = [
    P(box(0.6, 0.65, 1.7), 0x5a3c22, { y: 1.15 }),
    P(box(0.32, 0.7, 0.4), 0x5a3c22, { y: 1.6, z: 0.85, rx: -0.5 }),
    P(box(0.28, 0.3, 0.62), 0x4a3018, { y: 1.95, z: 1.15 }),
    P(box(0.16, 0.85, 0.16), 0x3a2614, { x: -0.2, y: 0.42, z: 0.62 }),
    P(box(0.16, 0.85, 0.16), 0x3a2614, { x: 0.2, y: 0.42, z: 0.62 }),
    P(box(0.16, 0.85, 0.16), 0x3a2614, { x: -0.2, y: 0.42, z: -0.62 }),
    P(box(0.16, 0.85, 0.16), 0x3a2614, { x: 0.2, y: 0.42, z: -0.62 }),
    P(box(0.66, 0.3, 0.9), BLUE, { y: 1.42, z: -0.05 }),
  ];
  const rider = humanoid({ skin: SKIN, tunic: BLUE, pants: 0x2a2a30, arms: 0x8e969e, legH: 0.5 }).map(g => g.translate(0, 1.15, -0.1));
  G.cavalry = merge([...horse, ...rider,
    P(cyl(0.18, 0.2, 0.2, 8), STEEL, { y: 2.55, z: -0.1 }),
    P(cyl(0.035, 0.035, 2.6), 0x8a6a40, { x: 0.38, y: 2.0, z: 0.7, rx: Math.PI / 2 - 0.25 }),
    P(cone(0.07, 0.25, 4), STEEL, { x: 0.38, y: 2.32, z: 2.0, rx: Math.PI / 2 - 0.25 }),
  ]);

  // ---------- Zombies ----------
  const ZSKIN = 0x7c8c5c, ZDARK = 0x4c5a3a, RAG = 0x5a4a3a;
  G.classic = merge(humanoid({ skin: ZSKIN, tunic: RAG, pants: 0x3a3428, arms: ZSKIN, armRx: -1.25, hunch: 0.35 }));
  G.fast = merge([
    ...humanoid({ skin: 0x9aa070, tunic: 0x4a3030, pants: 0x2a2420, arms: 0x9aa070, armRx: -0.6, hunch: 0.6, legH: 0.85, torsoH: 0.6 }),
  ]);
  G.dog = merge([
    P(box(0.4, 0.4, 1.0), ZDARK, { y: 0.6 }),
    P(box(0.3, 0.3, 0.42), 0x5a6a42, { y: 0.78, z: 0.6 }),
    P(box(0.18, 0.12, 0.25), 0x8a2a2a, { y: 0.68, z: 0.86 }),
    P(box(0.1, 0.4, 0.1), ZDARK, { x: -0.14, y: 0.2, z: 0.35 }),
    P(box(0.1, 0.4, 0.1), ZDARK, { x: 0.14, y: 0.2, z: 0.35 }),
    P(box(0.1, 0.4, 0.1), ZDARK, { x: -0.14, y: 0.2, z: -0.35 }),
    P(box(0.1, 0.4, 0.1), ZDARK, { x: 0.14, y: 0.2, z: -0.35 }),
    P(box(0.06, 0.06, 0.4), ZDARK, { y: 0.75, z: -0.6, rx: 0.6 }),
  ]);
  const golemParts = (c1, c2) => [
    P(dode(0.55), c1, { x: -0.45, y: 0.55 }), P(dode(0.55), c1, { x: 0.45, y: 0.55 }),
    P(dode(1.1), c2, { y: 1.9, sx: 1.2, sz: 0.9 }),
    P(dode(0.5), c1, { y: 3.0, z: 0.25 }),
    P(box(0.14, 0.08, 0.05), 0xffa030, { x: -0.16, y: 3.05, z: 0.7, jitter: 0 }),
    P(box(0.14, 0.08, 0.05), 0xffa030, { x: 0.16, y: 3.05, z: 0.7, jitter: 0 }),
    P(dode(0.5), c1, { x: -1.35, y: 1.5, sy: 1.5 }), P(dode(0.5), c1, { x: 1.35, y: 1.5, sy: 1.5 }),
  ];
  G.golem = merge(golemParts(0x5e5a54, 0x6e6a62));
  G.golem_ram = merge([...golemParts(0x5a4c40, 0x6a5a4a),
    P(cyl(0.38, 0.42, 4.6, 7), 0x5a3c22, { y: 1.5, z: 1.4, rx: Math.PI / 2 }),
    P(cyl(0.44, 0.44, 0.3, 7), 0x3a3a40, { y: 1.5, z: 3.6, rx: Math.PI / 2 }),
  ]);
  G.jumper = merge([
    ...humanoid({ skin: 0x7a6a8a, tunic: 0x3a2a4a, pants: 0x2a2030, arms: 0x7a6a8a, armRx: -0.3, hunch: 0.9, legH: 1.0, torsoH: 0.55 }),
    P(box(0.5, 0.06, 0.3), 0x5a4a6a, { y: 1.55, z: -0.15 }),
  ]);
  G.thrower = merge([
    ...humanoid({ skin: 0x6c7c4c, tunic: 0x4a3a2a, pants: 0x2a2620, arms: 0x6c7c4c, armRx: -2.9, hunch: 0.1, torsoH: 0.85 }),
    P(dode(0.42), 0x6a625a, { y: 2.65, z: 0.05 }),
  ]);
  // tronc de bélier porté par le colosse (repère local du zombie, avance le long de +z)
  G.ramlog = merge([
    P(cyl(0.2, 0.22, 2.8, 7), 0x5a3c22, { y: 0.95, z: 0.85, rx: Math.PI / 2 }),
    P(cyl(0.26, 0.26, 0.28, 7), 0x3a3a40, { y: 0.95, z: 2.35, rx: Math.PI / 2 }),
  ]);
  return G;
}

// ---------- Armes de siège (groupes avec pièces animées) ----------
export function buildSiege(type, mat) {
  const g = new THREE.Group();
  const WOOD = 0x7a5530, DARK = 0x4a3420, IRON = 0x5a6068;
  const add = (geom, name) => { const m = new THREE.Mesh(geom, mat); m.castShadow = true; m.name = name || ''; g.add(m); return m; };
  if (type === 'ballista') {
    add(merge([
      P(box(1.6, 0.25, 2.2), WOOD, { y: 0.35 }),
      P(cyl(0.12, 0.18, 1.1), DARK, { y: 1.0 }),
      P(box(0.4, 0.2, 2.4), WOOD, { y: 1.55 }),
      P(box(3.0, 0.14, 0.14), DARK, { y: 1.62, z: 0.6 }),
      P(cyl(0.03, 0.03, 2.2), 0xdddddd, { y: 1.62, z: -0.15, rx: Math.PI / 2, sx: 1, jitter: 0 }),
      P(box(0.08, 0.08, 2.0), 0x8a6a40, { y: 1.72, z: 0.2 }),
      P(cone(0.08, 0.3, 4), IRON, { y: 1.72, z: 1.35, rx: Math.PI / 2 }),
      ...[-0.7, 0.7].flatMap(x => [P(cyl(0.3, 0.3, 0.12, 8), DARK, { x, y: 0.3, z: 0.8, rz: Math.PI / 2 }), P(cyl(0.3, 0.3, 0.12, 8), DARK, { x, y: 0.3, z: -0.8, rz: Math.PI / 2 })]),
    ]));
  } else if (type === 'catapult') {
    add(merge([
      P(box(0.2, 0.25, 3.2), WOOD, { x: -0.8, y: 0.55 }), P(box(0.2, 0.25, 3.2), WOOD, { x: 0.8, y: 0.55 }),
      P(box(1.8, 0.2, 0.25), WOOD, { y: 0.55, z: 1.4 }), P(box(1.8, 0.2, 0.25), WOOD, { y: 0.55, z: -1.4 }),
      P(box(0.18, 1.6, 0.18), WOOD, { x: -0.8, y: 1.3, z: 0.6 }), P(box(0.18, 1.6, 0.18), WOOD, { x: 0.8, y: 1.3, z: 0.6 }),
      P(box(1.8, 0.2, 0.2), DARK, { y: 2.05, z: 0.6 }),
      ...[-0.95, 0.95].flatMap(x => [P(cyl(0.45, 0.45, 0.14, 8), DARK, { x, y: 0.45, z: 1.0, rz: Math.PI / 2 }), P(cyl(0.45, 0.45, 0.14, 8), DARK, { x, y: 0.45, z: -1.0, rz: Math.PI / 2 })]),
    ]));
    const arm = new THREE.Group(); arm.position.set(0, 0.7, -0.9); arm.name = 'arm';
    const am = new THREE.Mesh(merge([P(box(0.22, 0.22, 2.6), 0x8a6238, { z: 1.3 }), P(cyl(0.32, 0.22, 0.3, 8), DARK, { y: 0.15, z: 2.55 })]), mat);
    am.castShadow = true; arm.add(am); arm.rotation.x = -0.15; g.add(arm);
  } else if (type === 'trebuchet') {
    add(merge([
      P(box(0.25, 0.3, 5), WOOD, { x: -1.1, y: 0.2 }), P(box(0.25, 0.3, 5), WOOD, { x: 1.1, y: 0.2 }),
      P(box(2.5, 0.25, 0.3), WOOD, { y: 0.2, z: 2.2 }), P(box(2.5, 0.25, 0.3), WOOD, { y: 0.2, z: -2.2 }),
      P(box(0.25, 5.2, 0.25), WOOD, { x: -1.0, y: 2.7, z: 0, rz: 0.12 }), P(box(0.25, 5.2, 0.25), WOOD, { x: 1.0, y: 2.7, rz: -0.12 }),
      P(box(0.2, 3.5, 0.2), DARK, { x: -1.0, y: 1.8, z: 1.2, rx: -0.45 }), P(box(0.2, 3.5, 0.2), DARK, { x: 1.0, y: 1.8, z: 1.2, rx: -0.45 }),
      P(cyl(0.12, 0.12, 2.4), IRON, { y: 5.1, rz: Math.PI / 2 }),
    ]));
    const arm = new THREE.Group(); arm.position.set(0, 5.1, 0); arm.name = 'arm';
    const am = new THREE.Mesh(merge([
      P(box(0.25, 0.25, 8), 0x8a6238, { z: -1.5 }),
      P(box(1.3, 1.3, 1.3), 0x4a4a50, { y: -0.9, z: 2.0 }),
      P(cyl(0.02, 0.02, 1.6), 0x333333, { y: -0.8, z: -5.5 }),
    ]), mat);
    am.castShadow = true; arm.add(am); arm.rotation.x = 0.7; g.add(arm);
  } else if (type === 'ram') {
    add(merge([
      P(box(2.2, 0.3, 4.4), WOOD, { y: 0.6 }),
      P(box(0.2, 1.6, 0.2), DARK, { x: -1.0, y: 1.5, z: 1.8 }), P(box(0.2, 1.6, 0.2), DARK, { x: 1.0, y: 1.5, z: 1.8 }),
      P(box(0.2, 1.6, 0.2), DARK, { x: -1.0, y: 1.5, z: -1.8 }), P(box(0.2, 1.6, 0.2), DARK, { x: 1.0, y: 1.5, z: -1.8 }),
      P(box(1.5, 0.12, 4.6), 0x6a4a3a, { x: -0.62, y: 2.55, rz: 0.6 }), P(box(1.5, 0.12, 4.6), 0x6a4a3a, { x: 0.62, y: 2.55, rz: -0.6 }),
      ...[-1.15, 1.15].flatMap(x => [P(cyl(0.5, 0.5, 0.16, 8), DARK, { x, y: 0.5, z: 1.4, rz: Math.PI / 2 }), P(cyl(0.5, 0.5, 0.16, 8), DARK, { x, y: 0.5, z: -1.4, rz: Math.PI / 2 })]),
    ]));
    const log = new THREE.Group(); log.name = 'arm'; log.position.set(0, 1.4, 0);
    const lm = new THREE.Mesh(merge([P(cyl(0.3, 0.32, 5, 7), 0x5a3c22, { rx: Math.PI / 2, z: 0.6 }), P(cyl(0.36, 0.36, 0.4, 7), IRON, { rx: Math.PI / 2, z: 3.2 })]), mat);
    lm.castShadow = true; log.add(lm); g.add(log);
  }
  return g;
}

// ---------- Gisements de ressources ----------
export function buildResourceGeometries() {
  const G = {};
  G.wood = merge([
    P(cyl(0.18, 0.25, 1.2, 6), 0x4a3020, { y: 0.6 }),
    P(cone(1.4, 1.8, 7), 0x1f3a2a, { y: 1.9 }),
    P(cone(1.1, 1.5, 7), 0x24452f, { y: 2.8 }),
    P(cone(0.75, 1.3, 7), 0x2a4f36, { y: 3.6 }),
    P(cone(0.35, 0.5, 7), 0xe8eef2, { y: 4.15 }),
  ]);
  G.stone = merge([
    P(dode(1.0), 0x7a7d80, { y: 0.6, sy: 0.75 }), P(dode(0.7), 0x8a8d90, { x: 0.9, y: 0.4, z: 0.3 }),
    P(dode(0.6), 0x6a6d70, { x: -0.8, y: 0.35, z: 0.4 }), P(dode(0.5), 0x9a9da0, { x: 0.2, y: 0.3, z: -0.9 }),
  ]);
  G.gold = merge([
    P(dode(0.95), 0x5a5048, { y: 0.55, sy: 0.8 }), P(dode(0.6), 0x4a4440, { x: 0.85, y: 0.35 }),
    P(oct(0.3), 0xf2c94c, { x: 0.3, y: 1.15, z: 0.4, jitter: 0.15 }), P(oct(0.25), 0xffd860, { x: -0.5, y: 0.9, z: 0.5 }),
    P(oct(0.22), 0xf2c94c, { x: 0.9, y: 0.75, z: -0.3 }), P(oct(0.2), 0xe8b830, { x: -0.2, y: 1.05, z: -0.6 }),
  ]);
  G.metal = merge([
    P(dode(1.0), 0x3a3c42, { y: 0.6, sy: 0.85 }), P(dode(0.65), 0x34363c, { x: -0.9, y: 0.4, z: 0.2 }),
    P(box(0.35, 0.18, 0.5), 0x9fb4c4, { x: 0.35, y: 1.15, z: 0.35, ry: 0.5 }), P(box(0.3, 0.15, 0.4), 0x8aa0b0, { x: -0.5, y: 0.95, z: -0.4, ry: 1 }),
    P(box(0.25, 0.14, 0.3), 0xa86a3a, { x: 0.8, y: 0.8, z: -0.2 }),
  ]);
  G.diamond = merge([
    P(dode(0.8), 0x2a2830, { y: 0.4, sy: 0.6 }),
    P(oct(0.5), 0x56ccf2, { y: 1.3, sy: 2.0, jitter: 0.2 }), P(oct(0.32), 0x8ae0ff, { x: 0.6, y: 1.0, z: 0.2, sy: 1.8, rz: -0.4 }),
    P(oct(0.3), 0x3ab0e0, { x: -0.55, y: 0.95, z: -0.1, sy: 1.8, rz: 0.4 }), P(oct(0.22), 0xb0f0ff, { x: 0.1, y: 0.8, z: 0.6, sy: 1.6, rx: 0.4 }),
  ]);
  G.site = merge([P(cyl(1.1, 1.2, 0.08, 8), 0x5a5048, { y: 0.04 }), P(box(0.1, 0.6, 0.1), 0x8a6a40, { y: 0.3 }), P(box(0.5, 0.3, 0.04), 0xd8c08a, { y: 0.55, z: 0.05 })]);
  G.nest = merge([
    P(cone(4.2, 2.6, 9), 0x2a2228, { y: 1.3 }),
    P(cyl(1.6, 1.8, 0.2, 9), 0x6a2a7a, { y: 2.55, jitter: 0.15 }),
    ...Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return P(cone(0.18, 2.4, 4), 0xd8d0c0, { x: Math.cos(a) * 3.4, y: 1.3, z: Math.sin(a) * 3.4, rx: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5 }); }),
  ]);
  G.deadtree = merge([
    P(cyl(0.12, 0.22, 3, 5), 0x3a2a20, { y: 1.5 }),
    P(cyl(0.05, 0.08, 1.4, 4), 0x3a2a20, { x: 0.4, y: 2.4, rz: -0.9 }),
    P(cyl(0.05, 0.08, 1.2, 4), 0x3a2a20, { x: -0.35, y: 2.0, rz: 0.8 }),
  ]);
  G.rock = merge([P(dode(1.4), 0x4a4c50, { y: 0.7, sy: 0.7 }), P(dode(0.8), 0x56585c, { x: 1.2, y: 0.4, z: 0.4 })]);
  G.cliff = merge([P(dode(3), 0x3c3e44, { y: 1.5, sy: 1.1 }), P(dode(2.2), 0x46484e, { x: 2.5, y: 1.2, z: 1 }), P(dode(1.8), 0x34363c, { x: -2, y: 0.9, z: -1.5 }), P(cone(0.9, 0.6, 6), 0xe8eef2, { y: 3.4 })]);
  G.rubble = merge([
    P(box(1.6, 0.8, 1.2), 0xb8b0a4, { x: -2, y: 0.4, ry: 0.4 }), P(box(1.2, 0.6, 1.0), 0xa8a094, { x: 1.5, y: 0.3, z: 0.6, ry: 1 }),
    P(box(1.0, 0.7, 0.9), 0x9a9286, { x: 0.2, y: 0.35, z: -0.5, ry: 2 }), P(box(2.2, 0.5, 1.4), 0xc0b8ac, { x: -0.5, y: 0.25, z: 0.9, ry: 0.2 }),
    P(dode(0.5), 0x8a8276, { x: 2.8, y: 0.3, z: -0.4 }), P(dode(0.6), 0x8a8276, { x: -3.0, y: 0.3, z: 0.4 }),
  ]);
  return G;
}

// ---------- Projectiles & effets ----------
export function buildProjectileGeometries() {
  return {
    arrow: merge([P(box(0.04, 0.04, 0.9), 0x8a6a40, {}), P(cone(0.05, 0.14, 4), 0x9098a0, { z: 0.5, rx: Math.PI / 2 }), P(box(0.12, 0.02, 0.15), 0xe0e0e0, { z: -0.4 })]),
    bolt: merge([P(box(0.09, 0.09, 1.8), 0x6a4a2a, {}), P(cone(0.12, 0.3, 4), 0x9098a0, { z: 1.0, rx: Math.PI / 2 })]),
    boulder: merge([P(dode(0.55), 0x8a8a88, {})]),
    metalball: merge([P(ico(0.45, 0), 0x50585f, {})]),
    rock: merge([P(dode(0.4), 0x6a5a48, {})]),
  };
}
export function buildEffectGeometries() {
  return {
    particle: P(box(0.22, 0.22, 0.22), 0xffffff, { jitter: 0 }),
    ring: (() => { const g = new THREE.RingGeometry(0.62, 0.8, 24); g.rotateX(-Math.PI / 2); return g; })(),
    disc: (() => { const g = new THREE.CircleGeometry(1, 24); g.rotateX(-Math.PI / 2); return g; })(),
    bar: new THREE.PlaneGeometry(1, 0.14),
  };
}
