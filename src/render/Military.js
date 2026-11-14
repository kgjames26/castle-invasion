// Bâtiments militaires : volumes simples mais lisibles d'un coup d'œil.
//  Caserne = halle rouge + écu aux épées croisées + mannequin et lances · Champ de tir = cibles + grand arc
//  Écurie = grange + enclos + cheval + fer à cheval · Atelier de siège = charpente + catapulte + rondins et boulets.
// Origine du groupe = centre de l'emprise, façade vers le sud (+z, côté caméra). Aucun état de jeu ici.
import * as THREE from 'three';
import { applyNorthFog } from './fog.js';

const mats = new Map();
const mat = (c, ds = false) => { const k = c + (ds ? 'd' : ''); if (!mats.has(k)) mats.set(k, applyNorthFog(new THREE.MeshLambertMaterial({ color: c, flatShading: true, side: ds ? THREE.DoubleSide : THREE.FrontSide }))); return mats.get(k); };

function gableGeo(w, d, h) {   // prisme triangulaire : longueur w (x), largeur d (z), hauteur h
  const a = [-w / 2, 0, -d / 2], b = [-w / 2, 0, d / 2], c = [-w / 2, h, 0], a2 = [w / 2, 0, -d / 2], b2 = [w / 2, 0, d / 2], c2 = [w / 2, h, 0];
  const t = [a, b, c, a2, c2, b2, a, c, c2, a, c2, a2, b, b2, c2, b, c2, c];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(t.flat(), 3)); g.computeVertexNormals(); return g;
}

class B {
  constructor() { this.g = new THREE.Group(); }
  add(geo, c, x, y, z, rx = 0, ry = 0, rz = 0, ds = false) { const m = new THREE.Mesh(geo, mat(c, ds)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); this.g.add(m); return m; }
  box(w, h, d, c, x, y, z, ry = 0, rz = 0, rx = 0) { return this.add(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z, rx, ry, rz); }
  cyl(r, h, c, x, y, z, seg = 8) { return this.add(new THREE.CylinderGeometry(r, r, h, seg), c, x, y + h / 2, z); }
  disc(r, t, c, x, y, z) { return this.add(new THREE.CylinderGeometry(r, r, t, 16), c, x, y, z, Math.PI / 2); }   // disque face au sud
  gable(w, d, h, c, x, y, z) { return this.add(gableGeo(w, d, h), c, x, y, z, 0, 0, 0, true); }
  ball(r, c, x, y, z) { return this.add(new THREE.SphereGeometry(r, 8, 6), c, x, y, z); }
}

const WOOD = 0x7a5a3a, DARK = 0x4a3426, STONE = 0x8d9199, STRAW = 0xd8c06a, RED = 0xc0392b, GOLD = 0xf2d65e, STEEL = 0xcfd6dd;

function barracks() {
  const b = new B();
  b.box(16, 0.5, 11, 0x9a9a98, 0, 0, 0);                                 // dalle
  b.box(15, 1.4, 8, STONE, 0, 0.5, -0.8);                                // soubassement de pierre
  b.box(15, 3.2, 8, 0x8a4545, 0, 1.9, -0.8);                              // halle rouge
  b.gable(15.6, 9.4, 3.2, 0x4a2424, 0, 5.1, -0.8);                        // toit
  b.box(2.2, 3, 0.4, DARK, 0, 0.5, 3.35);                                // porte
  // écu bleu + épées croisées, bien visibles au-dessus de la porte
  b.box(3.4, 3.8, 0.4, 0x2f5fb0, 0, 3.6, 3.4); b.box(2.6, 3.0, 0.45, 0xe8edf2, 0, 4.0, 3.45); b.box(2.6, 1.5, 0.5, 0x2f5fb0, 0, 4.75, 3.5);
  for (const s of [-1, 1]) { b.box(0.32, 5.4, 0.3, STEEL, 0, 3.4, 3.8, 0, s * 0.62); b.box(1.3, 0.3, 0.3, GOLD, s * -0.55, 4.2, 3.85, 0, s * 0.62); }
  // mannequin d'entraînement + râtelier de lances + bannières
  b.cyl(0.18, 3, WOOD, -5, 0, 5); b.box(2, 0.25, 0.25, WOOD, -5, 2.2, 5); b.ball(0.5, STRAW, -5, 3.4, 5); b.box(0.9, 1.4, 0.5, 0x8a6a3a, -5, 1.2, 5);
  for (let i = 0; i < 5; i++) { b.box(0.14, 4.4, 0.14, WOOD, 4.4 + i * 0.55, 0.4, 5, 0, 0.12); b.box(0.4, 0.7, 0.14, STEEL, 4.4 + i * 0.55 - 0.26, 4.6, 5, 0, 0.12); }
  b.box(3.2, 0.3, 0.3, DARK, 5.2, 1.5, 5.3);
  for (const x of [-7.4, 7.4]) { b.cyl(0.14, 7.5, DARK, x, 0, 4.6); b.box(0.15, 2.6, 1.7, RED, x, 4.7, 4.6 + (x < 0 ? 0.0 : 0.0)); }
  return { g: b.g, pips: [0, 7.4, 5.2] };
}

function range() {
  const b = new B();
  b.box(18, 0.25, 9, 0x5a7d4a, 0, 0, 0);                                   // pelouse
  b.box(18.4, 0.1, 1.2, 0xc9b27a, 0, 0.25, 2.2);                           // ligne de tir
  // quatre cibles à anneaux, face au sud (côté tireurs), au nord de l'emprise = vers la muraille
  for (const x of [-6.2, -2.1, 2.1, 6.2]) {
    b.box(0.3, 2.2, 0.3, WOOD, x - 0.9, 0, -3.4); b.box(0.3, 2.2, 0.3, WOOD, x + 0.9, 0, -3.4);
    b.disc(1.5, 0.3, 0xf4f4f0, x, 2.7, -3.3); b.disc(1.1, 0.34, 0xc0392b, x, 2.7, -3.28); b.disc(0.7, 0.38, 0xf4f4f0, x, 2.7, -3.26); b.disc(0.32, 0.42, GOLD, x, 2.7, -3.24);
  }
  for (const x of [-8, 8]) b.box(1.6, 1.0, 1.0, STRAW, x, 0.25, -3.8);     // bottes de paille
  // abri avec râtelier d'arcs + grand arc en enseigne
  for (const x of [-3.2, 3.2]) b.cyl(0.18, 3.4, WOOD, x, 0, 3.2);
  b.add(new THREE.BoxGeometry(8.4, 0.25, 3.6), 0x6b4a2c, 0, 3.8, 3.2, -0.25);
  b.box(6, 0.6, 0.3, DARK, 0, 0.5, 3.0);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.22, 6, 14, Math.PI), mat(0x8a5a2a)); bow.rotation.z = -Math.PI / 2; bow.position.set(0.1, 6.3, 4.4); b.g.add(bow);
  b.box(0.06, 4.6, 0.06, 0xe8e8e0, 0, 4.0, 4.4); b.box(0.12, 0.12, 4.2, STEEL, 0, 6.3, 4.4, 0, 0, 0);
  const arrow = b.box(4.2, 0.12, 0.12, WOOD, 0, 6.3, 4.45); arrow.position.y = 6.3;
  return { g: b.g, pips: [0, 7.8, 4.4] };
}

function stable() {
  const b = new B();
  b.box(16, 0.3, 11, 0xb6a384, 0, 0, 0);                                   // terre battue
  b.box(7.6, 4, 8, WOOD, -3.8, 0.3, -1.2);                                  // grange
  b.gable(8.2, 9.4, 3.2, 0x5a3a24, -3.8, 4.3, -1.2);
  b.box(3.4, 3.2, 0.4, DARK, -3.8, 0.3, 2.95); b.box(0.25, 3.2, 0.45, 0xd8c8a0, -3.8, 0.3, 3.0);   // porte à deux battants
  b.box(0.25, 3.8, 0.4, 0xd8c8a0, -3.8, 0.3, 3.05, 0, 0.85); b.box(0.25, 3.8, 0.4, 0xd8c8a0, -3.8, 0.3, 3.05, 0, -0.85);
  const shoe = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.3, 6, 12, Math.PI * 1.45), mat(0xa9b1ba)); shoe.rotation.z = Math.PI / 2 + Math.PI * 0.275 + Math.PI; shoe.position.set(-3.8, 6.8, 3.2); b.g.add(shoe);   // fer à cheval
  // enclos
  for (let i = 0; i <= 6; i++) { const x = 0.4 + i * 1.2; b.cyl(0.14, 1.6, WOOD, x, 0, 4.2, 5); b.cyl(0.14, 1.6, WOOD, x, 0, -4.4, 5); }
  b.box(7.4, 0.14, 0.14, WOOD, 4.1, 1.1, 4.2); b.box(7.4, 0.14, 0.14, WOOD, 4.1, 0.5, 4.2); b.box(7.4, 0.14, 0.14, WOOD, 4.1, 1.1, -4.4); b.box(7.4, 0.14, 0.14, WOOD, 4.1, 0.5, -4.4);
  b.box(0.14, 0.14, 8.6, WOOD, 7.7, 1.1, -0.1); b.box(0.14, 0.14, 8.6, WOOD, 7.7, 0.5, -0.1);
  // cheval (boîtes) : corps, encolure, tête, pattes, queue
  const hc = 0x8b5a2b, hx = 4.3, hz = 0;
  b.box(2.6, 1.2, 1, hc, hx, 1.2, hz); b.box(0.7, 1.5, 0.7, hc, hx + 1.4, 1.7, hz, 0, -0.45); b.box(1.1, 0.55, 0.55, hc, hx + 2.3, 2.9, hz); b.box(0.5, 0.5, 0.2, DARK, hx + 1.9, 3.35, hz - 0.2);
  for (const [dx, dz] of [[-1, -0.3], [-1, 0.3], [1, -0.3], [1, 0.3]]) b.box(0.3, 1.3, 0.3, 0x5a3a1c, hx + dx, 0, hz + dz);
  b.box(0.2, 1.1, 0.4, DARK, hx - 1.4, 1.1, hz, 0, 0.5);
  b.box(1.6, 1.0, 1.0, STRAW, 1.6, 0.3, -2.6); b.ball(0.01, STRAW, 0, 0, 0);       // botte de foin
  return { g: b.g, pips: [-3.8, 8.6, 3.2] };
}

function workshop() {
  const b = new B();
  b.box(14, 0.4, 10, 0xa59a86, 0, 0, 0);
  for (const [x, z] of [[-6, -3.5], [6, -3.5], [-6, 0.5], [6, 0.5]]) b.cyl(0.3, 5.2, WOOD, x, 0.4, z);   // charpente ouverte (fond)
  b.box(12.8, 0.35, 5, 0x6a4a2c, 0, 5.4, -1.5, 0, 0, -0.12); b.box(12.8, 0.3, 0.3, DARK, 0, 4.2, 0.6); b.box(12.8, 0.3, 0.3, DARK, 0, 4.2, -3.5);
  b.box(12.8, 3.2, 0.3, 0x6a5a45, 0, 0.4, -3.6);                                // mur du fond
  // catapulte en façade
  const cx = -1.5, cz = 3;
  b.box(5, 0.5, 2.4, WOOD, cx, 1.0, cz); b.box(0.5, 2.4, 0.5, WOOD, cx - 0.9, 1.5, cz - 0.8); b.box(0.5, 2.4, 0.5, WOOD, cx - 0.9, 1.5, cz + 0.8);
  for (const dz of [-1.4, 1.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.35, 12), mat(DARK)); w.rotation.x = Math.PI / 2; w.position.set(cx - 1.4, 0.95, cz + dz); b.g.add(w); const w2 = w.clone(); w2.position.x = cx + 1.4; b.g.add(w2); }
  b.box(0.35, 4.6, 0.35, 0x8a6a3a, cx + 0.2, 2.0, cz, 0, 0.55); b.box(1.2, 0.5, 1.4, DARK, cx + 2.2, 4.6, cz, 0, 0.55);   // bras et cuillère
  b.box(1.0, 1.0, 1.4, 0x6a6a6a, cx - 1.8, 0.9, cz, 0, 0.55);                   // contrepoids
  b.ball(0.5, 0x8a8a88, cx + 2.2, 5.2, cz);
  // roue dentée en enseigne
  const cog = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 12), mat(0x6f7780)); cog.rotation.x = Math.PI / 2; cog.position.set(5, 3.4, 5); b.g.add(cog);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.box(0.55, 0.55, 0.4, 0x6f7780, 5 + Math.cos(a) * 1.7, 3.4 + Math.sin(a) * 1.7 - 0.27, 5, 0, a); }
  b.cyl(0.15, 2.4, DARK, 5, 0, 5);
  // rondins et boulets
  for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 6), mat(0x8a6a3a)); l.rotation.z = Math.PI / 2; l.position.set(-5, 0.7 + i * 0.6, 3.2 + (j - i / 2) * 0.75); b.g.add(l); }
  for (const [x, z] of [[2.5, 4.2], [3.3, 4.6], [3, 3.6]]) b.ball(0.55, 0x8a8a88, x, 0.95, z);
  return { g: b.g, pips: [0, 6.8, -1.5] };
}

const BUILD = { barracks, range, stable, workshop };

// Renvoie { g: Group, pips: Mesh[] } ou null si pas de modèle. Les pastilles dorées affichent le niveau.
export function buildMilitary(id) {
  const f = BUILD[id]; if (!f) return null;
  const { g, pips } = f(), pg = new THREE.BoxGeometry(0.7, 0.7, 0.7), pm = mat(GOLD), arr = [];
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(pg, pm); p.position.set(pips[0] + (i - 2) * 1.0, pips[1], pips[2]); p.rotation.y = Math.PI / 4; g.add(p); arr.push(p); }
  return { g, pips: arr };
}
