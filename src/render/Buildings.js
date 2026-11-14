// Modèles de TOUS les bâtiments (hors muraille) : un groupe par structure, base au sol, centre = centre de l'emprise.
// Économie : volumes simples et parlants (scierie = scie + rondins, carrière = blocs + grue, mine = entrée sombre + wagonnet, ferme = sillons).
// Bâtiments à modèle du kit (moulin, entrepôt, grenier, maisons, tour) : le kit est facultatif, sinon repli sur des volumes simples.
import * as THREE from 'three';
import { B, mat, militaryModels, WOOD, DARK, STONE, STRAW, GOLD, STEEL } from './Military.js';
import { STRUCT } from '../content/medieval.js';

const kitModel = (kit, name, sc) => { const g = new THREE.Group(), m = new THREE.Mesh(kit.geo[name], kit.material); m.scale.setScalar(sc); g.add(m); return g; };

function sawmill() {
  const b = new B();
  b.box(9, 0.3, 7, 0xa8916a, 0, 0, 0);
  for (const [x, z] of [[-3.6, -2.4], [3.6, -2.4], [-3.6, 2.4], [3.6, 2.4]]) b.cyl(0.25, 4.2, WOOD, x, 0.3, z);
  b.box(8.8, 0.35, 6.4, 0x6b4a2c, 0, 4.5, 0, 0, 0, -0.08);                          // toit
  b.box(4.2, 1.1, 1.4, 0x9b6a3a, -0.5, 0.3, 0.5);                                   // établi
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 14), mat(STEEL)); blade.rotation.z = Math.PI / 2; blade.rotation.y = 0; blade.rotation.x = Math.PI / 2; blade.position.set(-0.5, 2.0, 0.5); b.g.add(blade);
  for (let i = 0; i < 3; i++) for (let j = 0; j <= 2 - i; j++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3.4, 7), mat(0x8a5a2b)); l.rotation.z = Math.PI / 2; l.position.set(-2.4, 0.7 + i * 0.7, -1.6 - 0.8 * (j - (2 - i) / 2) - 1.6 + 1.6); b.g.add(l); }
  b.box(2.4, 0.9, 1.2, 0xd9b27a, 2.8, 0.3, 2.0); b.box(2.4, 0.5, 1.2, 0xe5c28c, 2.8, 1.2, 2.0);   // planches
  return { g: b.g, top: 6 };
}
function quarry() {
  const b = new B();
  b.box(9, 0.3, 7, 0xb8b2a4, 0, 0, 0);
  for (const [x, z, s] of [[-2.8, -1.6, 2.2], [-0.6, -2.2, 1.7], [1.4, -1.2, 2.5], [-3.2, 0.8, 1.4]]) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(0x8e9298, false)); r.position.set(x, s * 0.7 + 0.2, z); r.rotation.y = x; b.g.add(r); }
  for (let i = 0; i < 3; i++) b.box(1.6, 0.8, 1.1, 0xc9ccd0, 2.4 + (i % 2) * 0.5, 0.3 + i * 0.8, 2.0 - i * 0.15);   // blocs taillés
  b.cyl(0.2, 5, WOOD, 3.4, 0.3, -2.2); b.box(0.2, 0.2, 4.5, WOOD, 3.4, 5.2, -0.1); b.box(0.12, 2.8, 0.12, 0xcfc3a1, 3.4, 2.4, 1.9); b.box(0.9, 0.9, 0.9, 0xc9ccd0, 3.4, 1.4, 1.9);   // grue
  return { g: b.g, top: 6 };
}
function mine() {
  const b = new B();
  b.box(8, 0.3, 8, 0x8a8576, 0, 0, 0);
  const hill = new THREE.Mesh(new THREE.DodecahedronGeometry(4.2, 0), mat(0x6c7078)); hill.position.set(0, 2.3, -1.4); hill.scale.set(1.2, 0.85, 1); b.g.add(hill);
  b.box(3.2, 3, 0.8, 0x15110e, 0, 0.3, 2.0);                                               // entrée
  b.box(0.45, 3.6, 0.6, WOOD, -1.8, 0.3, 2.2); b.box(0.45, 3.6, 0.6, WOOD, 1.8, 0.3, 2.2); b.box(4.4, 0.5, 0.7, WOOD, 0, 3.7, 2.2);
  b.box(0.2, 0.15, 4.5, DARK, -0.7, 0.3, 4.2); b.box(0.2, 0.15, 4.5, DARK, 0.7, 0.3, 4.2);   // rails
  b.box(1.6, 0.9, 1.2, 0x6b4a2c, 0, 0.5, 4.6); b.box(1.2, 0.35, 0.9, 0x4f9fd8, -0.2, 1.4, 4.6); b.box(0.5, 0.35, 0.5, GOLD, 0.35, 1.4, 4.7);   // wagonnet (fer + or)
  b.cyl(0.1, 3, DARK, 2.8, 0.3, 2.8); b.box(0.9, 0.5, 0.2, 0xf0a43a, 2.8, 3.0, 2.8);       // lanterne
  return { g: b.g, top: 7 };
}
function farm() {
  const b = new B();
  b.box(16, 0.25, 10, 0x7a5e3c, 0, 0, 0);
  for (let i = 0; i < 7; i++) b.box(10.5, 0.4, 0.8, i % 2 ? 0xd9b84a : 0xb9a23a, 2.2, 0.25, -3.9 + i * 1.3);   // sillons de blé
  for (const [x, z] of [[-4, -3.6], [-4, 3.6]]) { b.cyl(0.14, 1.2, WOOD, x, 0.25, z, 5); }
  b.box(3.4, 2.2, 3, 0x8a5a2b, -6, 0.25, 0); b.box(3.8, 0.35, 3.4, 0x6b3a22, -6, 2.5, 0, 0, 0, 0.0);   // cabane
  b.box(0.2, 2.6, 0.2, WOOD, 3, 0.25, 2.8); b.box(1.6, 0.2, 0.2, WOOD, 3, 2.1, 2.8); b.box(0.7, 0.8, 0.5, 0xc9b27a, 3, 2.2, 2.8);   // épouvantail
  b.box(1.4, 1.0, 1.0, STRAW, -3.6, 0.25, 3.6);
  return { g: b.g, top: 4 };
}
function forge() {
  const b = new B();
  b.box(10, 0.3, 8, 0x9a9a98, 0, 0, 0);
  b.box(8, 3.6, 5.4, 0x6b6670, -0.4, 0.3, -0.6); b.box(8.6, 0.4, 6, 0x3d3a44, -0.4, 3.9, -0.6, 0, 0, 0);
  b.box(1.4, 5.5, 1.4, 0x55505a, 2.6, 0.3, -1.4); b.box(1.2, 0.5, 1.2, 0xff8a3a, 2.6, 5.8, -1.4);   // cheminée + braises
  b.box(2.4, 1.0, 1.4, 0xff7a2a, -2.2, 0.3, 2.4); b.box(2.6, 0.25, 1.6, DARK, -2.2, 1.3, 2.4);       // foyer
  b.box(1.4, 0.7, 0.8, 0x2a2a30, 1.0, 0.3, 3.0); b.box(0.5, 0.4, 0.5, 0x2a2a30, 1.0, 1.0, 3.0); b.box(1.9, 0.3, 0.6, 0x2a2a30, 1.4, 1.2, 3.0);   // enclume
  b.box(0.12, 1.8, 0.12, STEEL, 3.8, 0.4, 2.8, 0, 0.25); b.box(0.12, 1.5, 0.12, STEEL, 4.2, 0.4, 2.8, 0, -0.2);
  return { g: b.g, top: 6.5 };
}
function houseFallback() {
  const b = new B();
  b.box(5.2, 2.6, 4.8, 0xd8c6a0, 0, 0, 0); b.gable(5.8, 5.6, 2.2, 0x8a3b2a, 0, 2.6, 0); b.box(1, 1.6, 0.2, DARK, 0, 0, 2.45);
  return { g: b.g, top: 5 };
}
function towerFallback() {
  const b = new B();
  b.box(4.4, 10, 4.4, 0xa49d8e, 0, 0, 0); b.box(5.4, 0.8, 5.4, 0x8d877b, 0, 10, 0); const c = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 4), mat(0x8a3b2a)); c.position.y = 12.5; c.rotation.y = Math.PI / 4; b.g.add(c);
  return { g: b.g, top: 14 };
}

const HOUSE_SC = [0.85, 0.85, 1.0, 0.8, 1.0];

// Fabrique le modèle d'une structure. `seed` varie l'aspect des maisons. Renvoie { g, top } ; les pastilles de niveau sont ajoutées par le vue.
export function makeModel(type, kit, seed = 0) {
  if (militaryModels[type]) { const m = militaryModels[type](); return { g: m.g, top: m.pips[1] }; }
  if (kit) {
    if (type === 'mill') return { g: kitModel(kit, 'Windmill', 1.05), top: 8 };
    if (type === 'warehouse') return { g: kitModel(kit, 'House4', 1.2), top: 6.5 };
    if (type === 'granary') return { g: kitModel(kit, 'House5', 1.4), top: 6 };
    if (type === 'house') { const k = seed % 5; return { g: kitModel(kit, 'House' + (k + 1), HOUSE_SC[k]), top: 6 }; }
    if (type === 'tower') return { g: kitModel(kit, 'Tower2', 1.1), top: 15.5 };
  } else {
    if (type === 'mill') { const b = new B(); b.box(4.6, 5, 4.6, 0xcfc3a1, 0, 0, 0); const c = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.6, 6), mat(0x8a5a2b)); c.position.y = 6.3; b.g.add(c); for (let i = 0; i < 4; i++) b.box(0.4, 6, 0.2, 0xe9e1c8, 0, 5, 2.4, 0, 0, i * Math.PI / 2); return { g: b.g, top: 8 }; }
    if (type === 'warehouse') { const b = new B(); b.box(8, 3.6, 7, 0x7a6a55, 0, 0, 0); b.gable(8.6, 7.6, 2.4, 0x5a3a24, 0, 3.6, 0); return { g: b.g, top: 6.5 }; }
    if (type === 'granary') { const b = new B(); b.box(7, 3.2, 5.6, 0xb08a4a, 0, 0, 0); b.gable(7.6, 6.2, 2.4, 0x6b3a22, 0, 3.2, 0); return { g: b.g, top: 6 }; }
    if (type === 'house') return houseFallback();
    if (type === 'tower') return towerFallback();
  }
  const f = { sawmill, quarry, mine, farm, forge }[type]; return f ? f() : { g: new THREE.Group(), top: 5 };
}

export function pipsFor(type) { if (type === 'house') return 0; const mx = STRUCT[type].max || 4; return mx > 1 ? mx : 0; }
