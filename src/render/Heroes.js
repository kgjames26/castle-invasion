// Héros et objets : chevalier (escouades instanciées, pièces animées), magicien (groupe articulé unique, animé à la main),
// Maison du sorcier, et objets du pack low-poly (assets/items/items.bin, converti par tools/fbx_items.py) : grande épée, cristaux,
// livre, potions, cœur… Les objets sont facultatifs : sans eux, des formes simples les remplacent.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bx, cyl, part, Rig } from './Troops.js';
import { applyNorthFog } from './fog.js';
import { B, mat, WOOD, DARK, GOLD, STEEL } from './Military.js';

const align = o => (o + 3) & ~3;
export const ITEMS = { geo: null };
export async function loadItems(url = 'assets/items/items.bin') {
  const buf = await (await fetch(url)).arrayBuffer(), hl = new DataView(buf).getUint32(0, true), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let off = align(4 + hl); const geo = {};
  for (const it of hdr.items) {
    const idx = new Uint16Array(buf.slice(off, off + it.I * 2)); off = align(off + it.I * 2);
    const q = new Uint16Array(buf.slice(off, off + it.V * 6)); off = align(off + it.V * 6);
    const c = new Uint8Array(buf, off, it.V * 3); off = align(off + it.V * 3);
    const pos = new Float32Array(it.V * 3), col = new Float32Array(it.V * 3);
    for (let i = 0; i < it.V * 3; i++) { pos[i] = it.mn[i % 3] + q[i] / 65535 * (it.mx[i % 3] - it.mn[i % 3]); col[i] = Math.min(1, Math.pow(c[i] / 255, 2.2) * 1.5); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    geo[it.name] = g;
  }
  ITEMS.geo = geo; return geo;
}
// copie d'un objet : hauteur `h`, rotation (rx, ry, rz) puis position ; couleur éventuellement teintée ; non indexée (fusion avec les boîtes)
export function item(name, h, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, tint = null) {
  const src = ITEMS.geo && ITEMS.geo[name]; if (!src) return null;
  const g = src.toNonIndexed(); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(h, h, h)));
  if (tint) { const c = g.attributes.color.array, t = new THREE.Color(tint); for (let i = 0; i < c.length; i += 3) { c[i] *= t.r; c[i + 1] *= t.g; c[i + 2] *= t.b; } }
  return g;
}

const SKIN = 0xe0b48c, PLATE = 0xc9d1da, PLATE_D = 0x8e98a4, LEATHER = 0x5a3a22;
// ——— CHEVALIER : armure de plates, grand heaume à cimier, tabard aux couleurs du royaume, cape, écu en amande, grande épée ———
//  regarde vers +z ; pièces : corps, jambes, bras d'épée, cape (balancement)
export function knightParts(P = KNIGHT) {
  const body = [
    bx(0.56, 0.66, 0.34, PLATE, 0, 1.08, 0), bx(0.5, 0.56, 0.06, P.tabard, 0, 1.0, 0.18), bx(0.12, 0.56, 0.065, P.trim, 0, 1.0, 0.215),       // cuirasse + tabard + bande
    bx(0.6, 0.12, 0.38, LEATHER, 0, 0.76, 0), bx(0.14, 0.1, 0.06, GOLD, 0, 0.76, 0.2),                                                          // ceinture + boucle
    bx(0.3, 0.2, 0.42, PLATE_D, -0.36, 1.38, 0), bx(0.3, 0.2, 0.42, PLATE_D, 0.36, 1.38, 0),                                                   // épaulières
    bx(0.34, 0.36, 0.34, PLATE, 0, 1.6, 0.01), bx(0.36, 0.05, 0.05, 0x1b1d22, 0, 1.63, 0.18), bx(0.05, 0.16, 0.05, 0x1b1d22, 0, 1.56, 0.18),   // grand heaume + fente en croix
    bx(0.38, 0.06, 0.38, P.trim, 0, 1.8, 0.01), bx(0.08, 0.3, 0.44, P.plume, 0, 1.96, -0.02),                                                    // couronne dorée + cimier
    bx(0.13, 0.5, 0.13, PLATE, -0.33, 1.02, 0.02),                                                                                              // bras gauche
    bx(0.09, 0.82, 0.56, P.shield, -0.44, 1.02, 0.12), bx(0.1, 0.7, 0.12, P.trim, -0.49, 1.02, 0.12), bx(0.1, 0.12, 0.44, P.trim, -0.49, 1.12, 0.12),   // écu + croix
    bx(0.1, 0.28, 0.2, P.shield, -0.44, 0.52, 0.12),                                                                                           // pointe de l'écu
  ];
  const leg = () => [bx(0.2, 0.72, 0.22, PLATE_D, 0, -0.36, 0), bx(0.22, 0.12, 0.3, 0x5d646e, 0, -0.67, 0.04), bx(0.2, 0.12, 0.08, PLATE, 0, -0.18, 0.12)];
  const sword = item('Sword_big', 1.35, 0, -0.42, -0.12, Math.PI / 2, 0, 0) || mergeGeometries([bx(0.08, 0.06, 1.2, STEEL, 0, -0.42, 0.6), bx(0.32, 0.07, 0.08, GOLD, 0, -0.42, 0.06)], false);
  const arm = [bx(0.13, 0.5, 0.13, PLATE, 0, -0.18, 0), bx(0.15, 0.12, 0.15, PLATE_D, 0, -0.42, 0), sword];
  const cape = [bx(0.62, 1.1, 0.05, P.cape, 0, -0.55, 0), bx(0.64, 0.1, 0.07, P.trim, 0, -1.08, 0)];
  return [
    part('body', [0, 0, 0], body),
    part('legL', [-0.13, 0.72, 0], leg(), 'rot', true), part('legR', [0.13, 0.72, 0], leg(), 'rot', true),
    part('arm', [0.34, 1.32, 0], arm, 'rot', true),
    part('cape', [0, 1.46, -0.2], cape, 'rot', true),
  ];
}
// ——— CHEVALIER issu du modèle fourni (assets/characters/knight.bin, cuit par tools/bake_knight.py) ———
// Pièces rigides : corps, deux jambes, bras d'épée, cape. Les rangs changent l'armure (terne → dorée), la cape, le cimier et l'épée.
export const KNIGHT_GLB = { parts: null };
export async function loadKnight(url = 'assets/characters/knight.bin') {
  const buf = await (await fetch(url)).arrayBuffer(), hl = new DataView(buf).getUint32(0, true), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let off = align(4 + hl); const parts = {};
  for (const p of hdr.parts) {
    const q = new Uint16Array(buf.slice(off, off + p.V * 6)); off = align(off + p.V * 6); const c = new Uint8Array(buf, off, p.V * 3); off = align(off + p.V * 3);
    const pos = new Float32Array(p.V * 3), col = new Float32Array(p.V * 3);
    for (let i = 0; i < p.V * 3; i++) { pos[i] = p.mn[i % 3] + q[i] / 65535 * (p.mx[i % 3] - p.mn[i % 3]); col[i] = c[i] / 255; }
    parts[p.name] = { pos, col };
  }
  KNIGHT_GLB.parts = parts; return parts;
}
// apparence par rang (0 Recrue … 4 Légende)
export const KNIGHT_TIERS = [
  { armor: [0.62, 0.6, 0.58], gold: 0, cape: 0x6b5236, sword: 'Sword', len: 1.05, plume: null },
  { armor: [0.85, 0.85, 0.86], gold: 0, cape: 0x3d4a66, sword: 'Sword', len: 1.15, plume: null },
  { armor: [1, 1, 1.02], gold: 0.08, cape: 0x2a4f9a, sword: 'Sword_big', len: 1.3, plume: 0xc0392b },
  { armor: [1.08, 1.05, 1.0], gold: 0.22, cape: 0x8a1f24, sword: 'Sword_big', len: 1.45, plume: 0xf2f2f2 },
  { armor: [1.15, 1.05, 0.82], gold: 0.5, cape: 0x6e0f1a, sword: 'Sword_big_Golden', len: 1.75, plume: 0xf2c94a, crown: true },
];
function glbPart(src, recolor) {
  const g = new THREE.BufferGeometry(), col = src.col.slice();
  if (recolor) for (let i = 0; i < col.length; i += 3) recolor(col, i);
  g.setAttribute('position', new THREE.BufferAttribute(src.pos.slice(), 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
export function knightGlbParts(tier = 0) {
  const P = KNIGHT_GLB.parts, T = KNIGHT_TIERS[tier], cape = new THREE.Color(T.cape), GOLDC = [1, 0.78, 0.32];
  const armor = (c, i) => { const l = (c[i] + c[i + 1] + c[i + 2]) / 3; for (let k = 0; k < 3; k++) c[i + k] = Math.min(1, (c[i + k] * (1 - T.gold) + l * GOLDC[k] * 1.25 * T.gold) * T.armor[k]); };
  const capeC = (c, i) => { const l = (c[i] + c[i + 1] + c[i + 2]) / 3, bright = l > 0.62 && T.gold > 0.1; const cc = bright ? GOLDC : [cape.r, cape.g, cape.b]; for (let k = 0; k < 3; k++) c[i + k] = Math.min(1, cc[k] * (0.55 + l * 0.9)); };
  const body = [glbPart(P.body, armor)];
  if (T.plume) body.push(bx(0.07, 0.3, 0.36, T.plume, 0, 2.08, -0.02), bx(0.05, 0.22, 0.26, T.plume, 0, 2.28, -0.08));
  if (T.crown) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; body.push(bx(0.06, 0.14, 0.06, 0xf2c94a, Math.cos(a) * 0.14, 2.0, Math.sin(a) * 0.14)); }
  const sword = item(T.sword, T.len, -0.36, 0.86, -0.06, Math.PI / 2, 0, 0) || bx(0.07, 0.06, T.len, STEEL, -0.36, 0.86, T.len / 2);
  return [
    part('body', [0, 0, 0], body),
    part('legL', [-0.12, 0.92, 0], [glbPart(P.legA, armor)], 'rot'), part('legR', [0.12, 0.92, 0], [glbPart(P.legB, armor)], 'rot'),
    part('arm', [-0.32, 1.45, 0], [glbPart(P.arm, armor), sword], 'rot'),
    part('cape', [0, 1.5, -0.1], [glbPart(P.cape, capeC)], 'rot'),
  ];
}
export const KNIGHT = { tabard: 0x2f5fb0, trim: 0xf2c94a, plume: 0xd03a2a, shield: 0x2f5fb0, cape: 0x1f3f80 };
export const KNIGHT_GOLD = { tabard: 0xf2f2f2, trim: 0xf2c94a, plume: 0xf2c94a, shield: 0xb8322a, cape: 0x8a1f1f };   // rangs Élite et Légende
export function buildKnightRigs(scene) { return { knight: new Rig(scene, knightParts(KNIGHT), 300), knightGold: new Rig(scene, knightParts(KNIGHT_GOLD), 200) }; }
// rig du chevalier pour un rang donné : modèle fourni si chargé, sinon le modèle en boîtes
export function knightRig(scene, tier) { return new Rig(scene, KNIGHT_GLB.parts ? knightGlbParts(tier) : knightParts(tier >= 3 ? KNIGHT_GOLD : KNIGHT), 300); }

// ——— MAGICIEN : robe étoilée, grand chapeau pointu, longue barbe, bâton surmonté d'un cristal ; groupe articulé (un seul personnage) ———
const lamV = applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
function meshOf(list) { const g = mergeGeometries(list.filter(Boolean), false); g.computeBoundingSphere(); return new THREE.Mesh(g, lamV); }
// apparence du magicien selon le niveau de la Maison du sorcier : apprenti en bure → archimage blanc et or
export const MAGE_TIERS = [
  { name: 'Apprenti',  robe: 0x7a6a55, dark: 0x5e5040, trim: 0xb8a276, hat: 0x6b5a45, crystal: 0.3, book: false, hatH: 0.7 },
  { name: 'Mage',      robe: 0x3b5fae, dark: 0x2c4785, trim: 0xcfd6dd, hat: 0x2f4f96, crystal: 0.4, book: false, hatH: 0.8 },
  { name: 'Enchanteur', robe: 0x3b3f9e, dark: 0x2a2d75, trim: 0xf2d65e, hat: 0x2f3290, crystal: 0.48, book: true, hatH: 0.88 },
  { name: 'Sorcier',   robe: 0x5a2a8a, dark: 0x401c66, trim: 0xf2d65e, hat: 0x4a1f78, crystal: 0.6, book: true, hatH: 0.95, pads: true },
  { name: 'Archimage', robe: 0xeeeef5, dark: 0xc9cbd8, trim: 0xf2c94a, hat: 0xf4f4fa, crystal: 0.75, book: true, hatH: 1.1, pads: true, halo: true, cape: 0x6a2a9a },
];
export function makeMage(level = 1) {
  const MT = MAGE_TIERS[Math.max(0, Math.min(4, level - 1))];
  const ROBE = MT.robe, ROBE_D = MT.dark, TRIM = MT.trim, BEARD = 0xeeeef2, HAT = MT.hat;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const cone = (r0, r1, h, c, x, y, z, seg = 10) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg).toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.translate(x, y + h / 2, z); const cc = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { const f = 0.92 + ((i * 7919) % 100) / 100 * 0.14; a[i] = cc.r * f; a[i + 1] = cc.g * f; a[i + 2] = cc.b * f; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const robe = meshOf([
    cone(0.62, 0.3, 1.25, ROBE, 0, 0.05, 0), cone(0.64, 0.6, 0.08, TRIM, 0, 0.05, 0), cone(0.31, 0.27, 0.12, TRIM, 0, 0.82, 0),            // robe évasée + galons
    cone(0.3, 0.24, 0.5, ROBE_D, 0, 1.2, 0), bx(0.18, 0.12, 0.2, 0x3a2a1c, 0.12, 0.05, 0.3), bx(0.18, 0.12, 0.2, 0x3a2a1c, -0.12, 0.05, 0.3),   // buste + bottes
    bx(0.62, 0.16, 0.3, ROBE_D, 0, 1.6, 0),                                                                                                 // épaules
    ...(MT.pads ? [bx(0.3, 0.12, 0.36, TRIM, 0.34, 1.66, 0), bx(0.3, 0.12, 0.36, TRIM, -0.34, 1.66, 0)] : []),
    ...(MT.cape ? [bx(0.66, 1.5, 0.05, MT.cape, 0, 0.2, -0.3), bx(0.68, 0.08, 0.06, TRIM, 0, 0.2, -0.3)] : []),
    ...[[0.2, 0.5, 0.33], [-0.25, 0.75, 0.3], [0.05, 0.3, 0.42], [-0.15, 1.05, 0.25]].map(([x, y, z]) => bx(0.07, 0.07, 0.02, TRIM, x, y, z)),   // étoiles brodées
  ]);
  body.add(robe);
  const head = new THREE.Group(); head.position.set(0, 1.78, 0.02); body.add(head);
  head.add(meshOf([
    bx(0.28, 0.3, 0.28, SKIN, 0, 0, 0), bx(0.06, 0.08, 0.08, 0xd09a74, 0, -0.02, 0.17),                                                     // tête + nez
    bx(0.3, 0.32, 0.12, BEARD, 0, -0.24, 0.12), cone(0.15, 0.02, 0.32, BEARD, 0, -0.68, 0.14, 6),                                           // longue barbe
    bx(0.32, 0.08, 0.24, BEARD, 0, 0.12, -0.04), bx(0.24, 0.05, 0.03, BEARD, 0, 0.06, 0.15),                                                 // cheveux + sourcils
    cone(0.5, 0.48, 0.05, HAT, 0, 0.14, 0, 14), cone(0.24, 0.0, MT.hatH, HAT, 0, 0.16, 0, 10), cone(0.25, 0.235, 0.09, TRIM, 0, 0.18, 0, 10),   // chapeau à large bord
  ]));
  const hatTip = new THREE.Group(); hatTip.position.set(0, 0.95, -0.05); head.add(hatTip);
  // bras droit : bâton + cristal (le cristal brille : lueur ajoutée par le rendu)
  const armR = new THREE.Group(); armR.position.set(0.36, 1.58, 0); body.add(armR);
  const crystal = item('Crystal1', MT.crystal, 0, 1.18, 0.42, 0, 0, 0, level >= 5 ? 0xffe9a0 : null) || (() => { const g = new THREE.OctahedronGeometry(0.2, 0).toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.translate(0, 1.4, 0.42); const a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = 0.5; a[i + 1] = 0.3; a[i + 2] = 1; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; })();
  armR.add(meshOf([bx(0.15, 0.55, 0.15, ROBE, 0, -0.25, 0), bx(0.13, 0.12, 0.13, SKIN, 0, -0.55, 0.04),
    bx(0.07, 2.1, 0.07, 0x6b4a2c, 0, 0.1, 0.42, 0, 0, 0), bx(0.16, 0.1, 0.16, TRIM, 0, 1.12, 0.42), crystal]));
  const tip = new THREE.Group(); tip.position.set(0, 1.42, 0.42); armR.add(tip);
  const armL = new THREE.Group(); armL.position.set(-0.36, 1.58, 0); body.add(armL);
  const book = MT.book ? item('Book1_Open', 0.12, 0, -0.62, 0.22, 0.5, 0, 0) : null;
  armL.add(meshOf([bx(0.15, 0.55, 0.15, ROBE, 0, -0.25, 0), bx(0.13, 0.12, 0.13, SKIN, 0, -0.55, 0.04), book]));
  const handL = new THREE.Group(); handL.position.set(0, -0.62, 0.1); armL.add(handL);
  // cercle magique au sol (visible pendant une incantation)
  const rg = new THREE.RingGeometry(1.1, 1.35, 48); rg.rotateX(-Math.PI / 2);
  const circle = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xa070ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); circle.position.y = 0.12; root.add(circle);
  const rg2 = new THREE.RingGeometry(0.5, 0.6, 6, 1); rg2.rotateX(-Math.PI / 2); const circle2 = new THREE.Mesh(rg2, circle.material); circle2.position.y = 0.13; root.add(circle2);
  // barre de vie/mana au-dessus de la tête
  const bars = new THREE.Group(); bars.position.y = 3.3; bars.scale.setScalar(0.75); root.add(bars);
  const bmat = c => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), bmat(0x120c08)); bg.renderOrder = 12; bars.add(bg);
  const hp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.14), bmat(0x5be37a)); hp.geometry.translate(0.8, 0, 0); hp.position.set(-0.8, 0.09, 0.01); hp.renderOrder = 13; bars.add(hp);
  const mp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.12), bmat(0x6aa8ff)); mp.geometry.translate(0.8, 0, 0); mp.position.set(-0.8, -0.09, 0.01); mp.renderOrder = 13; bars.add(mp);
  let halo = null;
  if (MT.halo) { const hg = new THREE.TorusGeometry(0.42, 0.035, 6, 32); hg.rotateX(Math.PI / 2); halo = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.set(0, 0.55, 0); head.add(halo); }
  root.traverse(o => { if (o.isMesh && o.material === lamV) o.castShadow = true; });
  return { level, tierName: MT.name, halo, root, body, head, armR, armL, tip, handL, circle, circle2, bars, hp, mp, hatTip };
}
// pose du magicien : marche (balancement), repos (bâton qui tape), incantation (bras levés), soin (bras ouverts)
export function poseMage(M, s) {
  const { body, armR, armL, head, circle, circle2 } = M, t = s.t;
  const walk = s.walk, cast = s.cast, heal = s.heal;
  body.position.y = Math.abs(Math.sin(t * 7)) * 0.06 * walk + Math.sin(t * 1.6) * 0.02 * (1 - walk);
  body.rotation.z = Math.sin(t * 7) * 0.04 * walk;
  const idleR = -0.15 + Math.sin(t * 1.3) * 0.05, castR = -2.5 + Math.sin(t * 18) * 0.05, healR = -2.1;
  armR.rotation.x = idleR * (1 - cast - heal) + castR * cast + healR * heal - 0.35 * walk * Math.sin(t * 7) * (1 - cast);
  armR.rotation.z = 0.25 * heal;
  armL.rotation.x = (-0.5 + Math.sin(t * 1.1) * 0.05) * (1 - cast - heal) + (-1.6 + Math.sin(t * 15) * 0.1) * cast + -2.1 * heal + 0.35 * walk * Math.sin(t * 7);
  armL.rotation.z = -0.3 * heal - 0.15 * cast;
  head.rotation.x = -0.15 * cast; head.rotation.y = Math.sin(t * 0.7) * 0.2 * (1 - walk);
  const ca = Math.max(cast, heal); circle.material.opacity = 0.85 * ca; circle.rotation.y = t * 1.5; circle2.rotation.y = -t * 2.2; circle.scale.setScalar(0.8 + 0.4 * ca); circle2.scale.setScalar(1 + 0.2 * Math.sin(t * 6));
}

// ——— MAISON DU SORCIER : tour ronde de pierre bleutée, toit conique violet, balcon, fenêtres lumineuses, cristaux qui flottent ———
export function wizardModel() {
  const b = new B(), g = b.g, STONE_B = 0x7d7f9a, STONE_D = 0x5f6180, ROOF = 0x4b2f8a, ROOF_D = 0x3a226e;
  b.box(11, 0.3, 11, 0x8c8a96, 0, 0, 0);
  b.add(new THREE.CylinderGeometry(3.6, 4.3, 1.4, 10), STONE_D, 0, 1.0, 0);                                     // socle
  b.add(new THREE.CylinderGeometry(3.0, 3.5, 8.2, 10), STONE_B, 0, 5.5, 0);                                     // fût de la tour
  b.add(new THREE.CylinderGeometry(3.7, 3.4, 0.6, 12), STONE_D, 0, 9.8, 0);                                     // corniche / balcon
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.box(0.5, 0.7, 0.5, STONE_D, Math.cos(a) * 3.55, 10.0, Math.sin(a) * 3.55); }   // garde-corps crénelé
  b.add(new THREE.CylinderGeometry(2.6, 2.8, 2.6, 10), STONE_B, 0, 11.4, 0);                                    // étage supérieur
  b.add(new THREE.ConeGeometry(3.6, 6.2, 10), ROOF, 0, 15.8, 0);                                                // grand toit pointu
  b.add(new THREE.CylinderGeometry(3.65, 3.65, 0.25, 10), ROOF_D, 0, 12.75, 0);
  b.add(new THREE.ConeGeometry(0.35, 1.4, 6), GOLD, 0, 19.6, 0);                                                // flèche dorée
  // porte en arc + marches
  b.box(1.8, 2.8, 0.4, 0x3b2a1e, 0, 1.6, 3.3); b.add(new THREE.CylinderGeometry(0.9, 0.9, 0.4, 10, 1, false, 0, Math.PI), 0x3b2a1e, 0, 4.4, 3.3, Math.PI / 2, 0, Math.PI / 2);
  b.box(2.6, 0.3, 1.2, STONE_D, 0, 0.3, 4.2); b.box(2.2, 0.3, 0.8, STONE_D, 0, 0.6, 3.9);
  // fenêtres lumineuses (matériau sans éclairage : elles « brillent »)
  const glowM = new THREE.MeshBasicMaterial({ color: 0xc9a0ff }), win = (x, y, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.15), glowM); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); };
  for (const a of [0.6, 2.2, 3.8, 5.2]) win(Math.sin(a) * 3.15, 6.2, Math.cos(a) * 3.15, a);
  for (const a of [0, 2.1, 4.2]) win(Math.sin(a) * 2.72, 11.4, Math.cos(a) * 2.72, a);
  // bannière étoilée
  b.box(0.12, 3.4, 0.12, DARK, 2.8, 8.4, 2.2); b.box(1.4, 2.0, 0.08, 0x3b3f9e, 3.5, 9.6, 2.2); b.box(0.5, 0.5, 0.1, GOLD, 3.5, 9.9, 2.24, 0, Math.PI / 4);
  // jardin du sorcier : pupitre + grimoire, table de potions, cristaux posés
  b.box(0.3, 1.1, 0.3, WOOD, -3.6, 0.3, 3.6); b.box(0.9, 0.12, 0.7, WOOD, -3.6, 1.4, 3.6, 0, 0, 0.35);
  const book = item('Book1_Open', 0.14, -3.6, 1.55, 3.6, 0.35, 0, 0); if (book) g.add(new THREE.Mesh(book, lamV));
  b.box(1.8, 0.12, 0.9, WOOD, 3.6, 0.95, 3.8); for (const x of [2.9, 4.3]) b.box(0.14, 0.85, 0.14, WOOD, x, 0.1, 3.8);
  [['Potion3_Filled', 2.9, 0.75], ['Potion6_Filled', 3.6, 0.9], ['Potion3_Filled', 4.25, 0.6]].forEach(([n, x, h]) => { const p = item(n, h, x, 1.0, 3.8); if (p) g.add(new THREE.Mesh(p, lamV)); });
  const base = item('Crystal5', 1.3, -3.8, 0.3, -2.6); if (base) g.add(new THREE.Mesh(base, lamV)); else b.add(new THREE.OctahedronGeometry(0.7, 0), 0x40c8a0, -3.8, 1, -2.6);
  // cristaux en orbite autour du sommet (animés par Renderer.animateStructs)
  const orbit = new THREE.Group(); orbit.position.y = 14.5; g.add(orbit);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2, cg = item('Crystal1', 1.1, 0, -0.5, 0) || new THREE.OctahedronGeometry(0.45, 0);
    const c = new THREE.Mesh(cg, cg.attributes.color ? lamV : new THREE.MeshBasicMaterial({ color: 0xa070ff })); c.position.set(Math.cos(a) * 4.6, Math.sin(i * 1.7) * 0.6, Math.sin(a) * 4.6); orbit.add(c);
  }
  g.userData.spin = orbit;
  return { g, top: 20 };
}

// ——— GOLEM ZOMBIE : corps de blocs de pierre liés par de la chair verdâtre, yeux braisés, poings énormes ———
//  regarde vers +z, ≈ 2,6 m à l'échelle 1 ; pièces : corps, jambes, bras gauche et droit (coup de poing sismique à deux mains)
export function golemParts() {
  const ST = 0x8a857c, STD = 0x6a665f, MOSS = 0x5d7a3a, FLESH = 0x6f8a5a, EYE = 0xff7a20;
  const body = [
    bx(1.5, 1.1, 1.0, ST, 0, 1.55, 0, 0.08, 0.05), bx(1.2, 0.7, 0.9, STD, 0, 0.95, 0.02, -0.06), bx(1.7, 0.45, 1.05, ST, 0, 2.2, -0.02, 0, 0.04),   // torse en blocs
    bx(0.9, 0.5, 0.7, FLESH, 0, 1.3, 0.38), bx(0.5, 0.3, 0.2, MOSS, -0.4, 2.3, 0.45), bx(0.6, 0.2, 0.3, MOSS, 0.5, 1.9, -0.45),                     // chair à vif, mousse
    bx(0.62, 0.55, 0.6, STD, 0, 2.62, 0.18, 0.1), bx(0.16, 0.1, 0.06, EYE, -0.15, 2.66, 0.49), bx(0.16, 0.1, 0.06, EYE, 0.15, 2.66, 0.49),         // tête + yeux braisés
    bx(0.5, 0.14, 0.12, 0x2a2622, 0, 2.47, 0.48), bx(0.35, 0.5, 0.35, ST, -0.55, 2.55, -0.25, 0.3), bx(0.3, 0.45, 0.3, ST, 0.6, 2.5, -0.2, -0.25),   // mâchoire, pics dorsaux
  ];
  const leg = () => [bx(0.6, 0.95, 0.65, STD, 0, -0.48, 0), bx(0.75, 0.3, 0.85, ST, 0, -0.85, 0.08)];
  const arm = sx => [bx(0.65, 0.6, 0.65, ST, 0, -0.1, 0), bx(0.5, 0.8, 0.5, FLESH, 0, -0.65, 0), bx(0.5, 0.7, 0.55, STD, 0, -1.2, 0.05), bx(0.95, 0.85, 0.95, ST, 0, -1.85, 0.1), bx(0.25, 0.25, 0.2, MOSS, sx * 0.3, -1.6, 0.5)];
  return [
    part('body', [0, 0, 0], body),
    part('legL', [-0.42, 0.95, 0], leg(), 'rot', true), part('legR', [0.42, 0.95, 0], leg(), 'rot', true),
    part('armL', [-1.0, 2.15, 0], arm(-1), 'rot', true), part('armR', [1.0, 2.15, 0], arm(1), 'rot', true),
  ];
}
export function golemRig(scene) { return new Rig(scene, golemParts(), 32); }
