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
// Scierie : grande lame de scie circulaire dorée sur une bille de bois, dessinées
function drawSawmillSign(g) {
  g.save(); g.translate(64, 64);
  g.fillStyle = '#8a5a2b'; g.beginPath(); g.roundRect(-44, 14, 88, 26, 12); g.fill(); g.fillStyle = '#c99a62'; g.beginPath(); g.ellipse(40, 27, 9, 13, 0, 0, 7); g.fill();   // bille
  g.strokeStyle = '#7a4a22'; g.lineWidth = 2; g.beginPath(); g.ellipse(40, 27, 5, 8, 0, 0, 7); g.stroke();
  g.fillStyle = '#c9ced6'; g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, R = i % 2 ? 30 : 37; g.lineTo(Math.cos(a) * R, -6 + Math.sin(a) * R); } g.closePath(); g.fill();   // lame dentée
  g.strokeStyle = '#6a7080'; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = '#e8ecf0'; g.beginPath(); g.arc(0, -6, 22, 0, 7); g.fill(); g.fillStyle = '#d9a63a'; g.beginPath(); g.arc(0, -6, 8, 0, 7); g.fill(); g.fillStyle = '#5a3a1c'; g.beginPath(); g.arc(0, -6, 3, 0, 7); g.fill();
  g.restore();
}
// Caserne : écu rouge et épées croisées, dessinés (pas d'emoji)
function drawBarracksSign(g) {
  g.save(); g.translate(64, 66); const k = 2.6;
  g.beginPath(); g.moveTo(0, -12 * k); g.lineTo(11 * k, -8 * k); g.lineTo(11 * k, 0); g.bezierCurveTo(11 * k, 7 * k, 6 * k, 11 * k, 0, 13 * k); g.bezierCurveTo(-6 * k, 11 * k, -11 * k, 7 * k, -11 * k, 0); g.lineTo(-11 * k, -8 * k); g.closePath();
  g.fillStyle = '#8a2f2f'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#3a1a10'; g.stroke();
  g.beginPath(); g.moveTo(0, -9.6 * k); g.lineTo(9 * k, -6.4 * k); g.lineTo(9 * k, 0); g.bezierCurveTo(9 * k, 5.2 * k, 5 * k, 9 * k, 0, 10.8 * k); g.closePath(); g.fillStyle = '#a84040'; g.fill();
  g.lineCap = 'round';
  const sword = s => { g.save(); g.scale(s, 1); g.rotate(Math.PI / 4);
    g.fillStyle = '#e8e8ee'; g.beginPath(); g.moveTo(0, -17 * k / 1.4); g.lineTo(2.2, -14 * k / 1.4); g.lineTo(2.2, 9 * k / 1.4); g.lineTo(-2.2, 9 * k / 1.4); g.lineTo(-2.2, -14 * k / 1.4); g.closePath(); g.fill(); g.strokeStyle = '#6a7080'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#d9a63a'; g.fillRect(-8, 9 * k / 1.4, 16, 3.4); g.fillStyle = '#5a3a1c'; g.fillRect(-1.8, 9 * k / 1.4 + 3.4, 3.6, 9); g.fillStyle = '#d9a63a'; g.beginPath(); g.arc(0, 9 * k / 1.4 + 14, 3, 0, 7); g.fill(); g.restore(); };
  sword(1); sword(-1); g.restore();
}
export function signSprite(ico) {
  let tex = signCache.get(ico);
  if (!tex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#f4e4bc'; g.beginPath(); g.arc(64, 64, 55, 0, 7); g.fill();
    g.strokeStyle = '#b8924a'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 49, 0, 7); g.stroke();
    if (ico.includes('Scierie')) drawSawmillSign(g); else if (ico.startsWith('<svg')) drawBarracksSign(g);
    else { g.font = '66px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(ico, 64, 70); }
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

// ZONE DE QUARANTAINE : enclos entouré de grillage en maille de fer (poteaux, panneaux grillagés, barbelés), portail au sud,
// cabane de garde et garde, paillasses, brasero, panneau d'avertissement rouge et blanc. Les mordus sont visibles à l'intérieur.
let wireTex = null;
function wireMaterial() {
  if (!wireTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.clearRect(0, 0, 64, 64);
    g.strokeStyle = '#9aa0a8'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();   // maille losangée
    g.strokeStyle = '#5a5f66'; g.lineWidth = 1; g.beginPath(); g.moveTo(1, 33); g.lineTo(33, 1); g.stroke();
    wireTex = new THREE.CanvasTexture(cv); wireTex.wrapS = wireTex.wrapT = THREE.RepeatWrapping; wireTex.anisotropy = 4; wireTex.colorSpace = THREE.SRGBColorSpace;
  }
  return wireTex;
}
function quarantineModel() {
  const b = new B(), W2 = 8, D2 = 6, H = 2.6, POST = 0x4a4d52, WOODH = 0x6b4a2c;
  b.box(W2 * 2, 0.08, D2 * 2, 0x6e6450, 0, 0, 0);                                                                // sol foulé de l'enclos
  const panel = (len, x, z, ry) => { const t = wireMaterial().clone(); t.needsUpdate = true; t.repeat.set(len / 0.45, H / 0.45);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide })); m.position.set(x, 0.1 + H / 2, z); m.rotation.y = ry; b.g.add(m); };
  const side = (x0, z0, x1, z1, gap = null) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 2), ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (let k = 0; k <= n; k++) { const f = k / n, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; if (gap && Math.abs(x - gap) < 1.4 && k % n) continue; b.cyl(0.07, H + 0.5, POST, x, 0, z, 6); b.box(0.06, 0.5, 0.06, POST, x, H + 0.1, z, 0, 0, 0.5 * (z0 === z1 ? (z0 > 0 ? 1 : -1) : 0)); }
    if (gap === null) panel(len, (x0 + x1) / 2, (z0 + z1) / 2, ry);
    else { const l1 = gap - 1.5 - x0, l2 = x1 - (gap + 1.5); panel(l1, x0 + l1 / 2, z0, ry); panel(l2, gap + 1.5 + l2 / 2, z0, ry); }
    for (const y of [0.15, H + 0.05]) b.add(new THREE.CylinderGeometry(0.03, 0.03, len, 4), POST, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ry, Math.PI / 2);   // traverses
    for (const yo of [0.25, 0.42]) b.add(new THREE.CylinderGeometry(0.015, 0.015, len, 3), 0x8a8f96, (x0 + x1) / 2, H + yo, (z0 + z1) / 2, 0, ry, Math.PI / 2);   // barbelés
  };
  side(-W2, -D2, W2, -D2); side(-W2, D2, W2, D2, 0); side(-W2, -D2, -W2, D2); side(W2, -D2, W2, D2);
  // portail grillagé entrouvert
  b.box(0.12, H + 0.2, 0.12, WOODH, -1.5, 0.1, D2); b.box(0.12, H + 0.2, 0.12, WOODH, 1.5, 0.1, D2); b.box(3.2, 0.14, 0.14, WOODH, 0, H + 0.3, D2);
  { const t = wireMaterial().clone(); t.needsUpdate = true; t.repeat.set(1.4 / 0.45, H / 0.45); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, H - 0.2), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide })); m.position.set(-0.75 + 0.5, 0.2 + H / 2, D2 + 0.5); m.rotation.y = -0.8; b.g.add(m); }
  // panneau d'avertissement rouge et blanc
  b.box(0.1, 1.6, 0.1, WOODH, 2.6, 0, D2 + 0.6); for (let k = 0; k < 4; k++) b.box(0.3, 0.6, 0.06, k % 2 ? 0xf2ede0 : 0xc0392b, 2.15 + k * 0.3, 1.4, D2 + 0.64);
  // cabane de garde (coin nord-est), garde et sa lance, brasero, paillasses à l'intérieur
  b.box(2.4, 2.2, 2.0, 0x8a6a44, W2 + 1.8, 0, -D2 + 1.2); b.box(2.8, 0.25, 2.4, 0x5a3a24, W2 + 1.8, 2.2, -D2 + 1.2, 0, 0.12); b.box(0.8, 1.4, 0.06, 0x2a1e14, W2 + 1.8, 0, -D2 + 2.22);
  b.box(0.45, 1.5, 0.45, 0x3a4a6a, W2 + 1.6, 0, D2 - 0.5); b.box(0.4, 0.4, 0.4, SKIN_G, W2 + 1.6, 1.5, D2 - 0.5); b.box(0.48, 0.22, 0.48, 0x8e949c, W2 + 1.6, 1.92, D2 - 0.5); b.box(0.06, 2.8, 0.06, WOODH, W2 + 2.0, 0, D2 - 0.5); b.box(0.12, 0.4, 0.12, 0xcfd6dd, W2 + 2.0, 2.8, D2 - 0.5);
  b.cyl(0.35, 0.7, 0x3a3c42, -W2 - 1.2, 0, D2 - 0.6, 8); b.box(0.45, 0.25, 0.45, 0xffa040, -W2 - 1.2, 0.7, D2 - 0.6);
  for (const [x, z] of [[-5.5, -4], [-2.5, -4], [0.5, -4], [3.5, -4]]) { b.box(1.8, 0.12, 0.9, 0xc9b27a, x, 0.08, z); b.box(0.5, 0.1, 0.4, 0xb59a62, x - 0.6, 0.2, z); }
  b.box(0.5, 0.5, 0.5, 0x6b4a2c, 6.2, 0.08, -4.6); b.cyl(0.25, 0.5, 0x7a5a3a, 6.8, 0.08, -3.6, 8);                 // caisse, seau
  return { g: b.g, top: 4.5 };
}
// ——— Maisons améliorables (v3.1) : niv. 1 chaumière du kit, niv. 2 maison à colombages à étage, niv. 3 grande maison avec appentis
// et lucarne, niv. 4 maison de notable en pierre avec tourelle. Emprise fixe (6 × 6 m) : on gagne en hauteur et en détails.
const HPL = [0xeadcbc, 0xe4d2ae, 0xefe4cc, 0xdcc9a4], HRF = [0x9a3b2a, 0x7a4630, 0x8a3a2c, 0x5a5f6e];
function timberFrame(b, w, h, d, y, c) {     // poutres apparentes sur les quatre faces
  for (const sz of [-1, 1]) { b.box(w + 0.1, 0.22, 0.12, c, 0, y, sz * (d / 2 + 0.03)); b.box(w + 0.1, 0.22, 0.12, c, 0, y + h - 0.22, sz * (d / 2 + 0.03)); for (const x of [-w / 2, -w / 6, w / 6, w / 2]) b.box(0.2, h, 0.12, c, x, y, sz * (d / 2 + 0.03)); b.box(0.16, h * 0.95, 0.1, c, -w / 3, y, sz * (d / 2 + 0.05), 0, 0.55 * sz); }
  for (const sx of [-1, 1]) { b.box(0.12, 0.22, d + 0.1, c, sx * (w / 2 + 0.03), y + h - 0.22, 0); for (const z of [-d / 2, 0, d / 2]) b.box(0.12, h, 0.2, c, sx * (w / 2 + 0.03), y, z); }
}
function windows(b, w, d, y, n, c = 0x3a4a5a) { for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; b.box(0.7, 0.8, 0.1, c, x, y, d / 2 + 0.08); b.box(0.9, 0.12, 0.16, 0x6b4a2c, x, y - 0.08, d / 2 + 0.1); } }
export function houseModel(kit, seed, lv) {
  if (lv <= 1) { if (kit) { const k = seed % 5; return { g: kitModel(kit, 'House' + (k + 1), HOUSE_SC[k], seed), top: 6 }; } return houseFallback(); }
  const b = new B(), pl = HPL[seed % 4], rf = HRF[(seed >> 2) % 4], tb = 0x4e3522, st = 0x9a958c;
  if (lv === 2) {
    b.box(5.4, 0.5, 5.0, st, 0, 0, 0);
    b.box(5.2, 2.5, 4.8, pl, 0, 0.5, 0); timberFrame(b, 5.2, 2.5, 4.8, 0.5, tb);
    b.box(5.6, 2.3, 5.2, pl, 0, 3.0, 0); timberFrame(b, 5.6, 2.3, 5.2, 3.0, tb);           // étage en encorbellement
    b.gable(6.2, 6.0, 2.6, rf, 0, 5.3, 0);
    b.box(1.0, 1.9, 0.15, DARK, 0.9, 0.5, 2.48); windows(b, 5.2, 4.8, 1.8, 2); windows(b, 5.6, 5.2, 4.0, 3);
    b.box(0.7, 2.2, 0.7, 0x8a7f72, -1.8, 6.0, -0.8);                                        // cheminée
    return { g: b.g, top: 8.6 };
  }
  if (lv === 3) {
    b.box(5.8, 0.6, 5.6, st, 0, 0, 0);
    b.box(5.4, 2.6, 5.0, pl, 0, 0.6, -0.2); timberFrame(b, 5.4, 2.6, 5.0, 0.6, tb);
    b.box(5.8, 2.5, 5.4, pl, 0, 3.2, -0.2); timberFrame(b, 5.8, 2.5, 5.4, 3.2, tb);
    b.gable(6.4, 6.4, 3.2, rf, 0, 5.7, -0.2);
    b.box(1.6, 1.2, 1.2, pl, 0, 6.4, 2.4); b.gable(1.8, 1.6, 1.0, rf, 0, 7.6, 2.4); b.box(0.6, 0.7, 0.1, 0x3a4a5a, 0, 6.6, 3.02);   // lucarne
    b.add(new THREE.BoxGeometry(5.4, 0.14, 1.6), rf, 0, 2.7, 2.7, -0.25);                 // auvent au-dessus de l'entrée
    for (const x of [-2.4, 2.4]) b.box(0.18, 2.6, 0.18, tb, x, 0.6, 3.3);
    b.box(1.1, 2.0, 0.15, DARK, 0, 0.6, 2.33); windows(b, 5.4, 4.6, 1.9, 2); windows(b, 5.8, 5.0, 4.3, 3);
    b.box(0.8, 2.6, 0.8, 0x8a7f72, 2.0, 7.2, -1.2);
    for (let i = 0; i < 3; i++) b.box(0.5, 0.5, 0.5, 0x6a8a3a, -2.2 + i * 0.5, 0.6, 3.2);   // jardinière
    return { g: b.g, top: 10 };
  }
  // niveau 4 : maison de notable
  b.box(5.6, 3.0, 5.2, st, 0, 0, -0.2);                                                    // rez-de-chaussée en pierre
  b.box(5.9, 2.6, 5.5, pl, 0, 3.0, -0.2); timberFrame(b, 5.9, 2.6, 5.5, 3.0, tb);
  b.box(5.9, 2.2, 5.5, pl, 0, 5.6, -0.2); timberFrame(b, 5.9, 2.2, 5.5, 5.6, tb);
  b.gable(6.5, 6.5, 3.4, rf, 0, 7.8, -0.2);
  b.cyl(1.25, 9.5, st, 2.6, 0, 2.4, 10); b.cyl(1.4, 0.5, st, 2.6, 9.5, 2.4, 10);                              // tourelle d'escalier
  b.add(new THREE.ConeGeometry(1.6, 2.8, 10), HRF[3], 2.6, 11.4, 2.4); b.box(0.08, 1.2, 0.08, GOLD, 2.6, 12.8, 2.4);
  b.box(0.9, 0.5, 0.08, 0x2f5fb0, 2.6, 13.3, 2.4);                                          // fanion
  b.box(1.4, 2.4, 0.18, DARK, -0.8, 0, 2.43); b.box(1.8, 0.3, 0.25, st, -0.8, 2.4, 2.45);
  windows(b, 5.6, 4.8, 1.8, 2, 0x2e3e52); windows(b, 5.9, 5.1, 4.2, 3); windows(b, 5.9, 5.1, 6.6, 3);
  for (const x of [-2.0, 0.4]) b.box(0.8, 3.0, 0.8, 0x8a7f72, x, 8.6, -1.4);
  return { g: b.g, top: 12 };
}

// TRAVAUX PUBLICS (v3.5) : dépôt de voirie — halle à colombages ouverte sur la cour, tas de gravier, piles de pavés, rouleau de pierre,
// brouette, râtelier d'outils (pelles, pioches, dames), borne milliaire, poteau indicateur. Façade au sud (+z).
function publicWorksModel() {
  const b = new B(), PL = 0xe6d8b8, TB = 0x4e3522, RF = 0x7a4a30, ST = 0x9a958c;
  b.box(12.4, 0.3, 9.2, 0xa8a090, 0, 0, 0);                                                      // cour gravillonnée
  b.box(11.0, 0.5, 4.4, ST, 0, 0.3, -2.2);                                                       // soubassement de la halle
  b.box(11.0, 3.4, 4.0, PL, 0, 0.8, -2.6);                                                       // mur du fond
  for (const x of [-5.3, -1.8, 1.8, 5.3]) b.box(0.32, 3.6, 0.32, TB, x, 0.8, -0.4);                // poteaux de la façade ouverte
  b.box(11.2, 0.3, 0.32, TB, 0, 4.2, -0.4);                                                      // sablière
  for (const x of [-5.3, 5.3]) { b.box(0.3, 3.4, 4.2, PL, x, 0.8, -2.4); for (const z of [-4.4, -2.4, -0.4]) b.box(0.34, 3.4, 0.2, TB, x, 0.8, z); }   // pignons
  for (const x of [-4.6, -2.3, 0, 2.3, 4.6]) b.box(0.2, 3.4, 0.14, TB, x, 0.8, -4.62);
  const roof = b.gable(12.0, 5.4, 2.2, RF, 0, 4.5, -2.4);                                           // toit
  b.box(1.4, 1.6, 0.6, 0x8a7f72, 3.6, 5.6, -3.4);                                                // cheminée
  b.box(4.2, 0.9, 0.12, 0x5a3a24, 0, 3.55, -0.22); b.box(3.9, 0.6, 0.14, 0xe8d29a, 0, 3.55, -0.18);   // enseigne au-dessus de la halle
  // dans la halle : établi, rouleau de pierre, râtelier d'outils
  b.box(3.0, 0.9, 1.0, 0x7a5a3a, -3.4, 0.8, -3.6);
  b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 12), 0x8a8580, 1.4, 1.55, -2.4, 0, 0, Math.PI / 2); b.box(0.12, 0.12, 2.2, TB, 1.4, 1.55, -1.1); b.box(1.9, 0.12, 0.12, TB, 1.4, 1.55, -0.05);
  for (let k = 0; k < 4; k++) { b.box(0.1, 2.2, 0.1, 0x7a5a3a, -0.6 + k * 0.5, 0.8, -4.2, 0, 0.08); b.box(0.36, 0.42, 0.06, 0x8e98a4, -0.6 + k * 0.5, 2.9, -4.2); }
  // cour : tas de gravier, piles de pavés taillés, brouette, bordures en attente
  b.add(new THREE.ConeGeometry(1.7, 1.3, 9), 0xb8b0a0, -4.0, 0.95, 2.4); b.add(new THREE.ConeGeometry(1.0, 0.8, 8), 0xa49c8c, -2.6, 0.7, 3.2);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) for (let k = 0; k < 2; k++) b.box(0.55, 0.32, 0.55, (i + j + k) % 2 ? 0xbab4a8 : 0xa9a397, 0.4 + j * 0.62 + i * 0.31, 0.3 + i * 0.33, 2.0 + k * 0.62);
  for (let k = 0; k < 4; k++) b.box(1.6, 0.35, 0.4, 0xc4beb2, 3.6, 0.3 + k * 0.36, 3.4 - (k % 2) * 0.1);
  { const g = new B(); g.box(1.1, 0.35, 0.8, 0x7a4f2a, 0, 0.55, 0); g.add(new THREE.TorusGeometry(0.28, 0.06, 5, 10), 0x3a3426, 0, 0.32, 0.5, 0, Math.PI / 2); g.box(0.06, 0.06, 1.3, 0x5a3a24, 0.32, 0.55, -0.7, 0.2); g.box(0.06, 0.06, 1.3, 0x5a3a24, -0.32, 0.55, -0.7, 0.2); g.add(new THREE.ConeGeometry(0.4, 0.3, 7), 0xb8b0a0, 0, 0.85, 0); g.g.position.set(-0.8, 0.3, 3.4); g.g.rotation.y = 0.6; b.g.add(g.g); }
  // borne milliaire et poteau indicateur à deux flèches
  b.cyl(0.32, 1.1, ST, 5.4, 0.3, 4.1, 8); b.ball(0.32, ST, 5.4, 1.4, 4.1);
  b.cyl(0.08, 3.0, TB, -5.6, 0.3, 4.2, 5); b.box(1.5, 0.32, 0.08, 0xd9c08a, -5.0, 2.8, 4.2); b.box(1.3, 0.3, 0.08, 0xd9c08a, -6.1, 2.3, 4.2, 0, 0.1);
  return { g: b.g, top: 7.2 };
}

// Fabrique le modèle d'une structure. `seed` varie l'aspect des maisons. Renvoie { g, top } ; les pastilles de niveau sont ajoutées par le vue.
export function makeModel(type, kit, seed = 0, lv = 1) {
  if (type === 'house') return houseModel(kit, seed, lv);
  if (type === 'publicworks') return publicWorksModel();
  if (type === 'wizard') return wizardModel();
  if (type === 'infirmary') return infirmaryModel();
  if (type === 'university') return universityModel();
  if (type === 'prison') return quarantineModel();
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

export function pipsFor(type) { const mx = STRUCT[type].max || 4; return mx > 1 ? mx : 0; }
