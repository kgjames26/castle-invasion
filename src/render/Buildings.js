// Modèles de TOUS les bâtiments (hors muraille) : un groupe par structure, base au sol, centre = centre de l'emprise.
// Économie : volumes simples et parlants (scierie = scie + rondins, carrière = blocs + grue, mine = entrée sombre + wagonnet, ferme = sillons).
// Bâtiments à modèle du kit (moulin, entrepôt, grenier, maisons, tour) : le kit est facultatif, sinon repli sur des volumes simples.
import * as THREE from 'three';
import { B, mat, militaryModels, WOOD, DARK, STONE, STRAW, GOLD, STEEL } from './Military.js';
import { STRUCT } from '../content/medieval.js';

import { kitMaterial } from './Stone.js';
import { wizardModel } from './Heroes.js';
import { infirmaryModel, universityModel } from './Village.js';
// toits : tuile rouge, chaume, ardoise, tuile brune, vert-de-gris ; crépis : crème, ocre clair, chaux
const ROOFS = [0xa8432c, 0xb98a3e, 0x4a5f80, 0x7a3f2a, 0x4f7a64], PLASTERS = [0xecdcbc, 0xe2c99a, 0xf0e8d8];
const kitModel = (kit, name, sc, seed = 0) => { const g = new THREE.Group(), m = new THREE.Mesh(kit.geo[name], kitMaterial(kit.material.map, ROOFS[seed % ROOFS.length], PLASTERS[(seed >> 2) % PLASTERS.length])); m.scale.setScalar(sc); g.add(m); return g; };

// Enseigne : médaillon rond sur un mât, avec l'icône du métier — se lit de loin, d'un coup d'œil.
const signCache = new Map();
export function signSprite(ico) {
  let tex = signCache.get(ico);
  if (!tex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#f4e4bc'; g.beginPath(); g.arc(64, 64, 55, 0, 7); g.fill();
    g.strokeStyle = '#b8924a'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 49, 0, 7); g.stroke();
    g.font = '66px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(ico, 64, 70);
    tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; signCache.set(ico, tex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(3.8, 3.8, 1); return sp;
}
const stack = (b, n, x, z) => { for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) b.add(new THREE.CylinderGeometry(0.42, 0.42, 3.6, 8), 0x8a5a2b, x, 0.5 + i * 0.72, z + (j - (n - i - 1) / 2) * 0.86, 0, 0, Math.PI / 2); };
const sack = (b, x, z, c = 0xd8c690) => { b.add(new THREE.CylinderGeometry(0.35, 0.55, 1.0, 8), c, x, 0.5, z); b.add(new THREE.ConeGeometry(0.35, 0.45, 8), c, x, 1.2, z); };
const crate = (b, x, y, z, c = 0xa8793e) => { b.box(1.4, 1.2, 1.4, c, x, y, z); b.box(1.5, 0.15, 0.2, 0x6b4a2c, x, y + 0.5, z + 0.7); b.box(1.5, 0.15, 0.2, 0x6b4a2c, x, y + 0.5, z - 0.7); };

// SCIERIE : hangar ouvert, scie circulaire géante sur son établi, billes de bois empilées, planches claires, hache plantée dans une souche
function sawmill() {
  const b = new B();
  b.box(10.6, 0.3, 8.4, 0xb59a6a, 0, 0, 0);
  for (const [x, z] of [[-4.4, -3.2], [4.4, -3.2], [-4.4, 1.4], [4.4, 1.4]]) b.cyl(0.28, 4.6, WOOD, x, 0.3, z);
  b.box(10.4, 0.35, 5.8, 0x7a4f2a, 0, 4.7, -0.9, -0.16);                                       // toit incliné
  b.box(5.6, 1.0, 1.7, 0x9b6a3a, -0.4, 0.3, -0.6);                                              // établi
  b.box(4.8, 0.5, 0.9, 0xd9b27a, -0.4, 1.3, -0.6);                                              // planche en cours de sciage
  const blade = b.disc(1.7, 0.16, STEEL, -0.4, 2.3, -0.6);                                       // grande scie circulaire (face au sud)
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; b.box(0.34, 0.34, 0.2, STEEL, -0.4 + Math.cos(a) * 1.75, 2.3 + Math.sin(a) * 1.75 - 0.17, -0.6, 0, a); }
  b.box(0.3, 0.3, 0.3, 0x55565c, -0.4, 2.15, -0.6);
  stack(b, 3, -4.0, 2.6);                                                                       // billes
  b.box(2.8, 0.9, 1.6, 0xe5c28c, 3.3, 0.3, 2.4); b.box(2.8, 0.7, 1.6, 0xd9b27a, 3.3, 1.2, 2.4); b.box(2.8, 0.5, 1.6, 0xe5c28c, 3.3, 1.9, 2.4);   // planches
  b.cyl(0.6, 0.9, 0x8a5a2b, 3.8, 0.3, -2.4); b.box(0.12, 1.5, 0.12, WOOD, 3.8, 1.2, -2.4, 0, 0.9); b.box(0.5, 0.28, 0.12, STEEL, 4.3, 2.1, -2.4, 0, 0.9);   // souche + hache
  b.box(1.4, 0.15, 1.2, 0xe9d7a5, -1.4, 0.3, 2.0);                                              // sciure
  return { g: b.g, top: 6.4 };
}
// CARRIÈRE : parois taillées en gradins, blocs de pierre empilés, grue à poulie, chariot de cailloux, pic planté
function quarry() {
  const b = new B();
  b.box(10.6, 0.3, 8.4, 0xc4beb0, 0, 0, 0);
  b.box(7.4, 1.4, 3.4, 0x9a9ea4, -1.0, 0.3, -2.6); b.box(5.4, 1.4, 2.8, 0x8c9096, -1.6, 1.7, -2.8); b.box(3.4, 1.4, 2.2, 0x7e8288, -2.2, 3.1, -3.0);   // gradins
  for (const [x, z, sz] of [[2.8, -2.4, 1.3], [3.6, -1.2, 0.9], [-4.4, -0.8, 1.1]]) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), mat(0x8e9298)); r.position.set(x, sz * 0.7 + 0.3, z); b.g.add(r); }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) b.box(1.7, 0.8, 1.2, i % 2 ? 0xe2e4e6 : 0xd2d5d8, -3.6 + j * 1.8 + i * 0.9, 0.3 + i * 0.8, 1.9);   // blocs taillés
  b.cyl(0.25, 6, WOOD, 3.6, 0.3, 1.6); b.box(0.22, 0.22, 5.2, WOOD, 2.4, 6.1, 1.6); b.box(0.12, 3.6, 0.12, 0xcfc3a1, 0.2, 2.5, 1.6); b.box(1.1, 1.1, 1.1, 0xd2d5d8, 0.2, 1.4, 1.6);   // grue + corde + bloc
  b.box(2.2, 0.8, 1.4, 0x6b4a2c, 3.2, 0.6, -0.2); for (const x of [2.5, 3.9]) b.cyl(0.4, 0.2, DARK, x, 0.4, 0.55, 8).rotation.x = Math.PI / 2;   // chariot
  for (let i = 0; i < 4; i++) b.ball(0.3 + (i % 2) * 0.1, 0x8e9298, 2.6 + i * 0.35, 1.4, -0.2);
  b.box(0.1, 1.6, 0.1, WOOD, -4.6, 0.3, 2.8, 0, 0.5); b.box(0.9, 0.12, 0.12, STEEL, -4.9, 1.8, 2.8, 0, 0.5);   // pic planté
  return { g: b.g, top: 7.4 };
}
// MINE : butte de roc, entrée sombre étayée de bois, deux pioches croisées en enseigne, rails et wagonnet plein de minerai, lanterne
function mine() {
  const b = new B();
  b.box(9, 0.3, 9, 0x8a8576, 0, 0, 0);
  const hill = new THREE.Mesh(new THREE.DodecahedronGeometry(4.6, 0), mat(0x666b74)); hill.position.set(0, 2.4, -1.6); hill.scale.set(1.25, 0.9, 1); b.g.add(hill);
  const h2 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 0), mat(0x7a7f88)); h2.position.set(-3.2, 1.3, -0.6); b.g.add(h2);
  b.box(3.4, 3.2, 1.0, 0x0d0a08, 0, 0.3, 1.8);                                                  // entrée
  b.box(0.5, 3.8, 0.7, WOOD, -2.0, 0.3, 2.2); b.box(0.5, 3.8, 0.7, WOOD, 2.0, 0.3, 2.2); b.box(4.6, 0.55, 0.8, WOOD, 0, 3.9, 2.2);   // cadre de bois
  b.box(0.16, 2.6, 0.14, WOOD, 0, 4.9, 2.7, 0, 0.9); b.box(1.5, 0.2, 0.14, STEEL, -0.55, 5.5, 2.75, 0, 0.9); b.box(0.16, 2.6, 0.14, WOOD, 0, 4.9, 2.7, 0, -0.9); b.box(1.5, 0.2, 0.14, STEEL, 0.55, 5.5, 2.75, 0, -0.9);   // pioches croisées
  b.box(0.2, 0.15, 5.2, DARK, -0.8, 0.3, 4.6); b.box(0.2, 0.15, 5.2, DARK, 0.8, 0.3, 4.6);        // rails
  for (let i = 0; i < 5; i++) b.box(2, 0.12, 0.25, WOOD, 0, 0.25, 2.8 + i * 1.0);
  b.box(2.0, 1.1, 1.5, 0x6b4a2c, 0, 0.6, 5.0); for (const x of [-0.8, 0.8]) b.cyl(0.35, 0.2, DARK, x, 0.35, 5.8, 8).rotation.x = Math.PI / 2;
  for (const [x, z, c] of [[-0.5, 4.8, 0x5b8fd8], [0.2, 5.3, 0x4f9fd8], [0.55, 4.7, GOLD], [-0.2, 5.2, GOLD], [0.1, 4.6, 0x7aa8e0]]) b.ball(0.38, c, x, 1.85, z);   // minerai : fer bleuté + pépites d'or
  b.cyl(0.1, 3.2, DARK, 3.4, 0.3, 3.4); b.box(0.8, 0.6, 0.6, 0xf0a43a, 3.4, 3.4, 3.4);          // lanterne
  return { g: b.g, top: 8.2 };
}
// FERME : grange rouge à croix blanches, silo, meules de foin, enclos de blé doré (PAS de terre labourée), épouvantail
function farm() {
  const b = new B();
  b.box(8.2, 4.4, 6, 0xb83a2a, -4.2, 0, -1.6); b.gable(8.8, 6.8, 2.8, 0x5a3a24, -4.2, 4.4, -1.6);                        // grange
  b.box(3.4, 3.2, 0.3, 0xe8e0c8, -4.2, 0.1, 1.5); b.box(0.3, 3.9, 0.34, 0xb83a2a, -4.2, 0.0, 1.6, 0, 0.74); b.box(0.3, 3.9, 0.34, 0xb83a2a, -4.2, 0.0, 1.6, 0, -0.74);   // porte à croix
  b.box(0.2, 3.5, 0.2, 0xe8e0c8, -8.4, 0.1, 1.2); b.box(0.2, 3.5, 0.2, 0xe8e0c8, -0.2, 0.1, 1.2);
  b.cyl(1.5, 7, 0xc9ccd0, 0.8, 0, -3.2, 12); const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 6, 0, 7, 0, Math.PI / 2), mat(0x7a7f88)); dome.position.set(0.8, 7, -3.2); b.g.add(dome);   // silo
  for (const [x, z] of [[-1.6, 2.4], [-0.2, 3.2]]) b.add(new THREE.CylinderGeometry(0.8, 0.8, 1.3, 10), 0xe5c25a, x, 0.8, z, 0, 0, Math.PI / 2);   // bottes de foin
  // enclos de blé : rangs dorés debout, clôture basse
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) b.box(0.22, 0.9 + ((r * 3 + c) % 3) * 0.2, 0.22, (r + c) % 2 ? 0xe2c04a : 0xd0aa38, 2.6 + c * 0.7, 0, -3.2 + r * 1.5);
  for (let i = 0; i <= 6; i++) { b.box(0.14, 1.3, 0.14, WOOD, 2.0 + i * 1.0, 0, 3.4); b.box(0.14, 1.3, 0.14, WOOD, 2.0 + i * 1.0, 0, -4.4); }
  b.box(6.2, 0.12, 0.12, WOOD, 5.0, 0.95, 3.4); b.box(6.2, 0.12, 0.12, WOOD, 5.0, 0.95, -4.4);
  b.box(0.2, 2.8, 0.2, WOOD, 6.6, 0, 0.4); b.box(1.8, 0.2, 0.2, WOOD, 6.6, 2.2, 0.4); b.box(0.8, 0.9, 0.5, 0xc9b27a, 6.6, 2.3, 0.4); b.box(1.1, 0.14, 1.1, 0xe8c86a, 6.6, 3.2, 0.4);   // épouvantail
  return { g: b.g, top: 7.6 };
}
// FORGE : atelier de pierre, grande cheminée rougeoyante, enclume et marteau, seau d'eau, épées au râtelier
function forge() {
  const b = new B();
  b.box(11, 0.3, 8.6, 0x9a9a98, 0, 0, 0);
  b.box(8, 3.8, 5.4, 0x6b6670, -0.6, 0.3, -1.0); b.box(8.8, 0.45, 6.2, 0x3d3a44, -0.6, 4.1, -1.0);
  b.box(1.7, 6.4, 1.7, 0x55505a, 2.4, 0.3, -2.0); b.box(1.45, 0.5, 1.45, 0xff8a3a, 2.4, 6.8, -2.0); b.box(0.9, 0.9, 0.9, 0xffc14a, 2.4, 7.3, -2.0);   // cheminée + flamme
  b.box(3.2, 2.0, 0.5, 0x2a2428, -2.4, 0.3, 1.7); b.box(2.4, 1.2, 0.3, 0xff7a2a, -2.4, 0.5, 1.95); b.box(1.4, 0.7, 0.3, 0xffc14a, -2.4, 0.7, 2.1);   // grand foyer ardent
  b.box(1.8, 0.8, 1.0, 0x2a2a30, 0.8, 0.3, 3.0); b.box(0.7, 0.6, 0.7, 0x2a2a30, 0.8, 1.1, 3.0); b.box(2.6, 0.45, 0.8, 0x33343a, 0.8, 1.7, 3.0); b.box(0.9, 0.35, 0.5, 0x33343a, 2.4, 1.75, 3.0);   // enclume
  b.box(0.12, 1.1, 0.12, WOOD, 0.0, 2.1, 3.0, 0, 0.8); b.box(0.5, 0.35, 0.3, 0x55565c, -0.4, 2.7, 3.0, 0, 0.8);   // marteau
  b.cyl(0.6, 1.0, 0x4f6a8a, 3.6, 0.3, 2.8, 10);                                                 // seau d'eau
  for (let i = 0; i < 3; i++) { b.box(0.14, 1.9, 0.08, STEEL, -4.4 + i * 0.5, 1.3, 1.6, 0, 0.12); b.box(0.5, 0.1, 0.12, GOLD, -4.4 + i * 0.5, 1.4, 1.6); }   // épées
  return { g: b.g, top: 8.6 };
}
// Accessoires reconnaissables ajoutés aux modèles du kit
function millProps() { const b = new B(); sack(b, 3.4, 3.6); sack(b, 4.2, 3.2); sack(b, 3.8, 4.3, 0xe6dcb0); b.box(1.6, 0.9, 1.0, 0xe5c25a, -3.6, 0, 3.6); return b.g; }
function warehouseProps() { const b = new B(); crate(b, 4.4, 0, 3.6); crate(b, 5.9, 0, 3.6, 0xb88a4a); crate(b, 5.1, 1.2, 3.6, 0x93673a); b.cyl(0.55, 1.3, 0x7a5a3a, -4.6, 0, 3.8, 10); b.cyl(0.55, 1.3, 0x7a5a3a, -5.8, 0, 3.4, 10); return b.g; }
function granaryProps() { const b = new B(); sack(b, 4.0, 3.6); sack(b, 4.9, 3.2); sack(b, 4.4, 4.3, 0xe6dcb0); sack(b, 3.3, 4.1, 0xcdb878); for (let i = 0; i < 5; i++) b.box(0.18, 1.1, 0.18, 0xe2c04a, -4.8 + i * 0.4, 0, 3.8); return b.g; }
const withProps = (m, props) => { m.g.add(props()); return m; };

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

const HOUSE_SC = [0.85, 0.85, 1.0, 0.8, 1.0], SKIN_G = 0xe0b48c;

// Fabrique le modèle d'une structure. `seed` varie l'aspect des maisons. Renvoie { g, top } ; les pastilles de niveau sont ajoutées par le vue.
export function makeModel(type, kit, seed = 0) {
  if (type === 'wizard') return wizardModel();
  if (type === 'infirmary') return infirmaryModel();
  if (type === 'university') return universityModel();
  if (type === 'prison') {   // GEÔLE : bâtisse de pierre au fond, cour-cage à barreaux devant (les mordus y sont visibles), garde à la porte, torche
    const b = new B(), ST = 0x77736c, STD = 0x5a5650, IRON = 0x2e3036;
    b.box(10, 0.3, 8, 0x8a8680, 0, 0, 0);
    b.box(10, 4.2, 2.8, ST, 0, 0.3, -2.6); b.box(10.6, 0.5, 3.4, STD, 0, 4.5, -2.6); for (let k = 0; k < 6; k++) b.box(0.8, 0.7, 0.6, STD, -4.4 + k * 1.76, 5.0, -1.2);   // créneaux
    for (const x of [-3, 0, 3]) b.box(0.9, 0.9, 0.1, 0x1a1612, x, 2.4, -1.15);                                                                   // soupiraux
    for (let k = 0; k <= 16; k++) b.box(0.09, 2.6, 0.09, IRON, -4.9 + k * 0.6125, 0.3, 3.6);                                                     // barreaux, façade
    for (const x of [-4.9, 4.9]) for (let k = 0; k <= 7; k++) b.box(0.09, 2.6, 0.09, IRON, x, 0.3, -1.2 + k * 0.68);                             // barreaux, côtés
    for (const y of [0.5, 2.85]) { b.box(10, 0.12, 0.12, IRON, 0, y, 3.6); for (const x of [-4.9, 4.9]) b.box(0.12, 0.12, 4.8, IRON, x, y, 1.2); }
    for (let k = 1; k < 4; k++) b.box(0.09, 2.6, 4.8, IRON, -4.9 + k * 2.45, 0.3, 1.2);                                                          // séparations des cellules
    b.box(1.4, 0.4, 0.6, 0x6b4a2c, -3.6, 0.3, 0.2); b.box(0.5, 0.5, 0.5, 0x8a6a3a, 3.8, 0.3, 2.6);                                               // paillasse, seau
    b.box(0.5, 1.5, 0.5, 0x3a4a6a, 5.6, 0.3, 3.2); b.box(0.42, 0.42, 0.42, SKIN_G, 5.6, 1.8, 3.2); b.box(0.5, 0.25, 0.5, 0x8e949c, 5.6, 2.25, 3.2); b.box(0.06, 2.8, 0.06, 0x6b4a2c, 6.0, 0.3, 3.2); b.box(0.12, 0.4, 0.12, 0xcfd6dd, 6.0, 3.1, 3.2);   // garde et sa lance
    b.box(0.15, 1.4, 0.15, 0x4a3426, -5.4, 2.2, 3.4); b.box(0.35, 0.4, 0.35, 0xffb45a, -5.4, 3.6, 3.4);                                         // torche
    return { g: b.g, top: 7 };
  }
  if (type === 'church') { if (kit) return { g: kitModel(kit, 'Church', 1.32, 3), top: 14.5 }; const b = new B(); b.box(6, 5, 9, 0xe6dccb, 0, 0, 0.6); b.gable(6.6, 9.6, 2.6, 0x7a3f2a, 0, 5, 0.6); b.box(3.2, 9, 3.2, 0xd8ccb6, 0, 0, -4.2); b.add(new THREE.ConeGeometry(2.4, 3.6, 4), 0x4a5f80, 0, 10.8, -4.2, 0, Math.PI / 4); b.box(0.25, 1.6, 0.25, GOLD, 0, 12.6, -4.2); b.box(1.0, 0.25, 0.25, GOLD, 0, 13.0, -4.2); return { g: b.g, top: 14 }; }
  if (militaryModels[type]) { const m = militaryModels[type](); return { g: m.g, top: m.pips[1] }; }
  if (kit) {
    if (type === 'mill') return withProps({ g: kitModel(kit, 'Windmill', 1.05, 1), top: 8 }, millProps);
    if (type === 'warehouse') return withProps({ g: kitModel(kit, 'House4', 1.2, 3), top: 6.5 }, warehouseProps);
    if (type === 'granary') return withProps({ g: kitModel(kit, 'House5', 1.4, 1), top: 6 }, granaryProps);
    if (type === 'house') { const k = seed % 5; return { g: kitModel(kit, 'House' + (k + 1), HOUSE_SC[k], seed), top: 6 }; }
    if (type === 'tower') return { g: kitModel(kit, 'Tower2', 1.1, 2), top: 15.5 };
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
