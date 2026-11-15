// Troupes et machines de siège : modèles simples en boîtes colorées, animés par pièces (jambes, bras, bras de lancer…).
// Chaque pièce est un InstancedMesh : une matrice par instance ET par pièce (pivot + rotation locale), donc des centaines d'unités
// restent bon marché. Les modèles regardent vers +z (sud) pour les troupes ; les machines de siège regardent vers -z (nord, côté zombies).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyNorthFog } from './fog.js';

const _c = new THREE.Color();
// boîte colorée (couleurs de sommets, léger bruit par face pour casser les aplats) placée en coordonnées « modèle »
export function bx(w, h, d, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  _c.set(color); const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) { const f = 0.93 + ((i * 7919) % 100) / 100 * 0.14; for (let k = 0; k < 3; k++) { col[(i + k) * 3] = _c.r * f; col[(i + k) * 3 + 1] = _c.g * f; col[(i + k) * 3 + 2] = _c.b * f; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
export function cyl(r, h, color, x, y, z, rx = 0, rz = 0, seg = 8) {   // cylindre coloré
  const g = new THREE.CylinderGeometry(r, r, h, seg).toNonIndexed(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1)));
  _c.set(color); const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
// pièce : géométrie fusionnée, exprimée relativement à son pivot ; mode 'rot' (rotation autour de x) ou 'slide' (translation en z) ou 'fix'
export function part(name, pivot, list, mode = 'fix', rel = false) {
  const g = mergeGeometries(list, false); if (!rel) g.translate(-pivot[0], -pivot[1], -pivot[2]); g.computeBoundingSphere();
  g.boundingSphere.radius = 12; return { name, pivot: new THREE.Vector3(...pivot), geo: g, mode };
}

const SKIN = 0xe0b48c, STEEL = 0xcfd6dd, DARKSTEEL = 0x8e98a4, LEATHER = 0x5a3a22, WOODC = 0x7a5a3a, DARKWOOD = 0x4a3426, IRON = 0x6f7780;

// ——— RANGS (0 Recrue … 4 Légende) : la tenue s'étoffe avec le rang ———
//  Recrue : tunique, calotte de cuir, petit écu de bois, épée courte · Régulier : casque d'acier · Vétéran : cotte de mailles, cimier
//  Élite : plastron, cape, dorures · Légende : armure dorée, heaume à couronne, grand cimier, épée longue étincelante.
const GOLDT = 0xf2c94a, MAIL = 0x7d858f;
function footParts(P, tier = 1) {
  const heavy = !!P.heavy, t = tier, helm = t === 0 ? 0x6b4a2c : t >= 4 ? GOLDT : P.helm, shield = t === 0 ? 0x8a6a3a : P.shield, trim = t >= 3 ? GOLDT : P.trim;
  const body = [
    bx(0.5, 0.62, 0.3, t >= 2 ? MAIL : P.cloth, 0, 1.06, 0), bx(0.52, 0.5, 0.06, P.cloth, 0, 0.98, 0.16),                       // corps (mailles dès Vétéran) + tabard
    bx(0.54, 0.12, 0.34, LEATHER, 0, 0.78, 0),
    bx(0.28, 0.28, 0.28, SKIN, 0, 1.55, 0.01), bx(0.34, t === 0 ? 0.1 : 0.15, 0.36, helm, 0, t === 0 ? 1.66 : 1.69, 0.01),
    bx(0.12, 0.5, 0.12, P.cloth, -0.31, 1.0, 0),                                                                                 // bras gauche
    heavy ? bx(0.1, 0.78, 0.5, shield, -0.4, 1.0, 0.1) : bx(0.08, t === 0 ? 0.42 : 0.52, t === 0 ? 0.36 : 0.42, shield, -0.38, 1.05, 0.1),
  ];
  if (t >= 1) body.push(bx(0.06, 0.34, 0.06, trim, -0.43, 1.05, 0.1), bx(0.1, 0.06, 0.34, trim, -0.43, 1.05, 0.1));             // croix sur l'écu
  if (t >= 1) body.push(bx(0.36, 0.05, 0.05, 0x1b1d22, 0, 1.62, 0.18));                                                          // nasal / visière
  if (t >= 2) body.push(bx(0.07, 0.22 + 0.06 * t, 0.3 + 0.04 * t, t >= 4 ? GOLDT : P.plume, 0, 1.82 + 0.03 * t, -0.02));       // cimier
  if (t >= 2 || heavy) body.push(bx(0.6, 0.2, 0.38, t >= 4 ? GOLDT : DARKSTEEL, 0, 1.3, 0), bx(0.2, 0.14, 0.36, t >= 3 ? trim : DARKSTEEL, 0.34, 1.34, 0), bx(0.2, 0.14, 0.36, t >= 3 ? trim : DARKSTEEL, -0.34, 1.34, 0));   // épaulières
  if (t >= 3) body.push(bx(0.46, 0.44, 0.08, t >= 4 ? 0xe8edf2 : STEEL, 0, 1.12, 0.17), bx(0.5, 0.05, 0.09, trim, 0, 0.9, 0.18));   // plastron + liseré
  if (t >= 3) body.push(bx(0.56, 0.9, 0.05, t >= 4 ? 0x8a1f24 : P.shield, 0, 1.0, -0.19), bx(0.58, 0.07, 0.06, trim, 0, 0.56, -0.19));   // cape
  if (t >= 4) for (let k = 0; k < 5; k++) body.push(bx(0.05, 0.1, 0.05, GOLDT, -0.14 + k * 0.07, 1.8, 0.17));                     // couronne du heaume
  if (t >= 3) body.push(bx(0.12, 0.12, 0.04, GOLDT, -0.44, 1.05, 0.11));                                                         // umbo doré
  const leg = () => [bx(0.18, 0.7, 0.2, t >= 3 ? DARKSTEEL : P.legs, 0, -0.35, 0), bx(0.2, 0.12, 0.28, t >= 4 ? GOLDT : LEATHER, 0, -0.66, 0.03)];
  const L = [0.7, 0.85, 0.95, 1.05, 1.25][t] * (heavy ? 1.08 : 1);
  const sword = [bx(0.12, 0.5, 0.12, t >= 2 ? MAIL : P.cloth, 0, -0.18, 0), bx(0.07, 0.07, L, t >= 4 ? 0xf6f2e0 : STEEL, 0, -0.42, 0.04 + L / 2), bx(0.22 + 0.04 * t, 0.06, 0.07, trim, 0, -0.42, 0.04)];
  if (t >= 4) sword.push(bx(0.09, 0.09, 0.09, 0xff5a3a, 0, -0.42, -0.04));                                                       // pommeau serti
  return [
    part('body', [0, 0, 0], body),
    part('legL', [-0.12, 0.72, 0], leg(), 'rot', true), part('legR', [0.12, 0.72, 0], leg(), 'rot', true),
    part('arm', [0.32, 1.3, 0], sword, 'rot', true),
  ];
}
// ——— cavalier : seul le cavalier est une pièce de boîtes (le cheval est le modèle GLB animé en VAT, voir Renderer.renderSquads) ———
//  repère : selle en (0, 1.6, 0) — dos du cheval cuit par tools/bake_horse.py ; le cavalier est posé dessus et suit le tangage du cheval.
//  rangs : caparaçon de plus en plus long et riche, lance plus longue, armure et heaume dorés pour la Légende.
function horseParts(P, tier = 1) {
  const dy = 0.15, t = tier, helm = t === 0 ? 0x6b4a2c : t >= 4 ? GOLDT : P.helm, trim = t >= 3 ? GOLDT : P.trim;
  const body = [
    bx(0.7, 0.1, 0.9, P.cloth, 0, 1.6, 0), bx(0.1, 0.1, 0.1, LEATHER, 0, 1.68, 0.3),
    bx(0.4, 0.55, 0.26, t >= 2 ? MAIL : P.cloth, 0, 1.78 + dy, 0), bx(0.42, 0.45, 0.05, P.cloth, 0, 1.76 + dy, 0.14), bx(0.26, 0.26, 0.26, SKIN, 0, 2.2 + dy, 0.01), bx(0.32, 0.14, 0.34, helm, 0, 2.34 + dy, 0.01),
    bx(0.1, 0.42, 0.34, t === 0 ? 0x8a6a3a : P.shield, -0.3, 1.72 + dy, 0.1),
    bx(0.11, 0.4, 0.11, P.cloth, -0.26, 1.66 + dy, 0.05),
    bx(0.14, 0.5, 0.16, P.legs, 0.38, 1.55, 0.06, 0, 0, -0.12), bx(0.14, 0.5, 0.16, P.legs, -0.38, 1.55, 0.06, 0, 0, 0.12),
    bx(0.17, 0.12, 0.22, DARKWOOD, 0.42, 1.27, 0.08), bx(0.17, 0.12, 0.22, DARKWOOD, -0.42, 1.27, 0.08),
  ];
  if (t >= 1) body.push(bx(0.06, 0.24 + 0.05 * t, 0.3 + 0.04 * t, t >= 4 ? GOLDT : P.plume, 0, 2.5 + dy + 0.02 * t, 0));
  if (t >= 2) { const drop = 0.35 + 0.15 * t; for (const sx of [-1, 1]) { body.push(bx(0.05, drop, 1.3, P.cloth, sx * 0.5, 1.6 - drop / 2, 0.05), bx(0.06, 0.07, 1.32, trim, sx * 0.51, 1.6 - drop + 0.04, 0.05)); } }   // caparaçon tombant
  if (t >= 3) body.push(bx(0.36, 0.34, 0.06, t >= 4 ? 0xe8edf2 : STEEL, 0, 1.84 + dy, 0.17), bx(0.5, 0.75, 0.05, t >= 4 ? 0x8a1f24 : P.shield, 0, 1.75 + dy, -0.17));   // plastron + cape
  if (t >= 4) for (let k = 0; k < 5; k++) body.push(bx(0.05, 0.1, 0.05, GOLDT, -0.12 + k * 0.06, 2.45 + dy, 0.17));
  const L = [0.85, 1.05, 1.2, 1.35, 1.6][t];
  const arm = [bx(0.11, 0.38, 0.11, P.cloth, 0.3, 1.74 + dy, 0.02), bx(0.07, L, 0.07, t >= 4 ? 0xf6f2e0 : STEEL, 0.3, 1.82 + dy + L / 2, 0.02), bx(0.22 + 0.04 * t, 0.06, 0.07, trim, 0.3, 1.9 + dy, 0.02)];
  if (t >= 3) arm.push(bx(0.04, 0.32, 0.22, t >= 4 ? GOLDT : P.plume, 0.3, 1.82 + dy + L - 0.1, 0.13));     // fanion de lance
  return [part('body', [0, 0, 0], body), part('arm', [0.3, 1.92 + dy, 0.02], arm, 'rot')];
}
export const tierOf = rankIndex => Math.max(0, Math.min(4, rankIndex | 0));
export function siegeRig(scene, type, t) { return new Rig(scene, ({ ballista: ballistaParts, catapult: catapultParts, trebuchet: trebuchetParts })[type](t), 24); }
export function troopRig(scene, type, tier) {
  if (type === 'cavalry') return new Rig(scene, horseParts(PALETTES.cavalry, tier), 600);
  return new Rig(scene, footParts(PALETTES[type], tier), type === 'heavy' ? 600 : 900);
}

// ——— niveaux de l'atelier de siège : 1 bois brut · 2 ferrures et clous de fer, roues cerclées · 3 dorures, bannière, brasero ———
function siegeDeco(t, hw, hd, h) {
  const out = [];
  if (t >= 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(bx(0.36, 0.36, 0.36, IRON, sx * hw, h, sz * hd), bx(0.08, 0.08, 0.08, 0x2a2c30, sx * hw, h + 0.2, sz * hd));
  if (t >= 2) out.push(bx(hw * 2 + 0.2, 0.1, 0.12, IRON, 0, h - 0.1, -hd), bx(hw * 2 + 0.2, 0.1, 0.12, IRON, 0, h - 0.1, hd));
  if (t >= 3) {
    out.push(bx(0.1, 3.2, 0.1, DARKWOOD, hw + 0.3, h + 1.4, hd), bx(0.06, 0.9, 1.1, 0x8a1f24, hw + 0.3, h + 2.5, hd - 0.6), bx(0.07, 0.12, 1.12, 0xf2c94a, hw + 0.31, h + 2.0, hd - 0.6), bx(0.2, 0.2, 0.2, 0xf2c94a, hw + 0.3, h + 3.1, hd));
    out.push(bx(0.5, 0.5, 0.5, 0x3a3a3e, -hw - 0.6, 0.25, hd + 0.4), bx(0.4, 0.25, 0.4, 0xff7a2a, -hw - 0.6, 0.6, hd + 0.4), bx(0.22, 0.25, 0.22, 0xffd24a, -hw - 0.6, 0.85, hd + 0.4));   // brasero : boulets enflammés
    for (const sx of [-1, 1]) out.push(bx(0.1, 0.1, hd * 2, 0xf2c94a, sx * (hw + 0.17), h + 0.2, 0));
  }
  return out;
}
// ——— catapulte : châssis à roues, montants, bras à cuillère, contrepoids (regarde vers -z) ———
function catapultParts(t = 1) {
  const frame = [
    bx(0.3, 0.3, 3.4, WOODC, -0.7, 0.9, 0), bx(0.3, 0.3, 3.4, WOODC, 0.7, 0.9, 0), bx(1.7, 0.28, 0.3, DARKWOOD, 0, 0.95, -1.2), bx(1.7, 0.28, 0.3, DARKWOOD, 0, 0.95, 1.2),
    bx(0.3, 1.6, 0.3, DARKWOOD, -0.7, 1.7, 0.3), bx(0.3, 1.6, 0.3, DARKWOOD, 0.7, 1.7, 0.3), bx(1.7, 0.26, 0.3, DARKWOOD, 0, 2.45, 0.3),
    bx(0.14, 0.14, 1.2, IRON, 0, 1.35, -1.0), bx(0.5, 0.5, 0.5, 0x8a8a88, 0, 1.2, -1.2),                                  // butée + boulet en réserve
    ...[[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]].map(([sx, z]) => cyl(0.62, 0.28, DARKWOOD, sx * 1.0, 0.62, z, 0, Math.PI / 2, 10)),
    ...[[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]].map(([sx, z]) => cyl(0.14, 0.34, IRON, sx * 1.0, 0.62, z, 0, Math.PI / 2, 6)),
  ];
  // bras : le long côté (cuillère) part vers -z, le court côté porte le contrepoids vers +z
  const arm = [bx(0.26, 0.26, 3.1, 0x8a6a3a, 0, 0, -1.1), bx(0.7, 0.2, 0.8, DARKWOOD, 0, 0.1, -2.8), bx(0.5, 0.35, 0.5, 0x8a8a88, 0, 0.35, -2.8), bx(0.8, 0.8, 0.8, 0x5d5d62, 0, -0.1, 0.55)];
  frame.push(...siegeDeco(t, 0.7, 1.2, 1.1));
  return [part('base', [0, 0, 0], frame), part('arm', [0, 2.25, 0.3], arm, 'rot', true)];
}
// ——— trébuchet : portique en A, grand bras, contrepoids en caisse, fronde ———
function trebuchetParts(t = 1) {
  const frame = [
    bx(0.4, 0.4, 4.4, DARKWOOD, -1.2, 0.3, 0), bx(0.4, 0.4, 4.4, DARKWOOD, 1.2, 0.3, 0), bx(2.8, 0.36, 0.4, DARKWOOD, 0, 0.3, -2.0), bx(2.8, 0.36, 0.4, DARKWOOD, 0, 0.3, 2.0),
    // montants en A (deux de chaque côté, penchés)
    bx(0.32, 4.6, 0.32, WOODC, -1.15, 2.6, -0.9, 0, 0, 0.0), bx(0.32, 4.6, 0.32, WOODC, -1.15, 2.6, 0.9), bx(0.32, 4.6, 0.32, WOODC, 1.15, 2.6, -0.9), bx(0.32, 4.6, 0.32, WOODC, 1.15, 2.6, 0.9),
    bx(0.3, 0.3, 2.4, IRON, -1.15, 4.7, 0), bx(0.3, 0.3, 2.4, IRON, 1.15, 4.7, 0), bx(2.8, 0.3, 0.3, DARKWOOD, 0, 2.3, -0.9), bx(2.8, 0.3, 0.3, DARKWOOD, 0, 2.3, 0.9),
    bx(0.5, 0.5, 0.5, 0x8a8a88, 0, 0.7, -1.7),                                                                           // boulet posé
  ];
  const arm = [bx(0.34, 0.34, 6.6, 0x8a6a3a, 0, 0, -1.6), bx(0.16, 0.16, 1.4, LEATHER, 0, -0.1, -5.2), bx(0.6, 0.5, 0.6, LEATHER, 0, -0.35, -5.9), bx(0.9, 0.9, 1.1, 0x5d5d62, 0, -0.1, 1.9), bx(1.4, 0.5, 1.6, DARKSTEEL, 0, -0.9, 1.9)];
  frame.push(...siegeDeco(t, 1.2, 2.0, 0.5));
  return [part('base', [0, 0, 0], frame), part('arm', [0, 4.7, 0], arm, 'rot', true)];
}
// ——— baliste : grand arc sur affût à roues, trait ———
function ballistaParts(t = 1) {
  const frame = [bx(0.4, 0.3, 2.6, WOODC, 0, 0.9, 0), bx(0.3, 0.9, 0.3, DARKWOOD, 0, 0.45, 0.4), bx(2.4, 0.18, 0.2, 0x7a4f2a, 0, 1.4, -0.6, 0, 0.0), bx(0.18, 0.18, 1.0, 0x7a4f2a, -1.2, 1.4, -0.3, 0, 0.5), bx(0.18, 0.18, 1.0, 0x7a4f2a, 1.2, 1.4, -0.3, 0, -0.5),
    ...[-1, 1].map(s => cyl(0.55, 0.22, DARKWOOD, s * 0.7, 0.55, 0.9, 0, Math.PI / 2, 10))];
  const bolt = [bx(0.08, 0.08, 1.7, 0xf5e6b0, 0, 1.55, -0.2), bx(0.16, 0.16, 0.3, STEEL, 0, 1.55, -1.1), bx(1.9, 0.04, 0.04, 0xe8e8e0, 0, 1.45, 0.4)];
  frame.push(...siegeDeco(t, 0.25, 1.2, 1.0));
  return [part('base', [0, 0, 0], frame), part('bolt', [0, 0, 0], bolt, 'slide')];
}

// ——— villageois : un modèle par métier (tunique + chapeau + outil dans la main droite) ———
//  hache (bois) · pic (pierre, fer, or) · houe (ferme) · marteau (chantiers, réparation) · mains nues (libre)
const TOOLS = {
  axe: P => [bx(0.07, 0.07, 0.85, WOODC, 0, -0.42, 0.45), bx(0.06, 0.3, 0.28, STEEL, 0, -0.42, 0.9)],
  pick: P => [bx(0.07, 0.07, 0.95, WOODC, 0, -0.42, 0.5), bx(0.8, 0.09, 0.09, STEEL, 0, -0.42, 0.95), bx(0.1, 0.16, 0.12, STEEL, 0.42, -0.42, 0.95)],
  hoe: P => [bx(0.06, 0.06, 1.25, WOODC, 0, -0.42, 0.65), bx(0.4, 0.07, 0.22, STEEL, 0, -0.42, 1.28)],
  hammer: P => [bx(0.07, 0.07, 0.6, WOODC, 0, -0.42, 0.32), bx(0.3, 0.2, 0.2, 0x55565c, 0, -0.42, 0.66)],
  none: P => [],
};
function villagerParts(P) {
  const body = [
    bx(0.5, 0.62, 0.3, P.tunic, 0, 1.06, 0), bx(0.54, 0.1, 0.34, LEATHER, 0, 0.78, 0), bx(0.4, 0.34, 0.06, P.apron, 0, 0.98, 0.17),
    bx(0.27, 0.27, 0.27, SKIN, 0, 1.54, 0.01), bx(0.12, 0.5, 0.12, P.tunic, -0.31, 1.0, 0),
    ...P.hat(),
  ];
  const leg = () => [bx(0.18, 0.7, 0.2, P.legs, 0, -0.35, 0), bx(0.2, 0.1, 0.27, LEATHER, 0, -0.66, 0.03)];
  const arm = [bx(0.12, 0.5, 0.12, P.tunic, 0, -0.18, 0), ...TOOLS[P.tool](P)];
  return [part('body', [0, 0, 0], body), part('legL', [-0.12, 0.72, 0], leg(), 'rot', true), part('legR', [0.12, 0.72, 0], leg(), 'rot', true), part('arm', [0.32, 1.3, 0], arm, 'rot', true)];
}
const cap = c => () => [bx(0.32, 0.12, 0.34, c, 0, 1.7, 0.01), bx(0.2, 0.05, 0.14, c, 0, 1.66, 0.17)];
const straw = () => [bx(0.62, 0.05, 0.62, 0xe8c86a, 0, 1.68, 0.01), bx(0.3, 0.16, 0.3, 0xe8c86a, 0, 1.76, 0.01)];
const hard = c => () => [bx(0.34, 0.16, 0.36, c, 0, 1.7, 0.01), bx(0.44, 0.04, 0.44, c, 0, 1.64, 0.01)];
export const VILLAGER_STYLES = {
  idle: { tunic: 0xc9b48a, apron: 0xb8a276, legs: 0x4a3b2a, hat: cap(0x7a5a30), tool: 'none' },
  wood: { tunic: 0x5f8a45, apron: 0x4f7438, legs: 0x4a3b2a, hat: cap(0x6b4a2c), tool: 'axe' },
  stone: { tunic: 0x9aa0a6, apron: 0x7c8288, legs: 0x45484f, hat: hard(0xb0b4b8), tool: 'pick' },
  iron: { tunic: 0x5b6b8a, apron: 0x424e68, legs: 0x35384a, hat: hard(0x8a8f99), tool: 'pick' },
  gold: { tunic: 0xd9b43a, apron: 0xb8922a, legs: 0x4a3b2a, hat: hard(0xf2d65e), tool: 'pick' },
  food: { tunic: 0xd9c27a, apron: 0xb89c4a, legs: 0x5a4a30, hat: straw, tool: 'hoe' },
  repair: { tunic: 0xe67e22, apron: 0xb35f14, legs: 0x4a3b2a, hat: hard(0xf2d65e), tool: 'hammer' },
  build: { tunic: 0xf0a24a, apron: 0xc0792a, legs: 0x4a3b2a, hat: hard(0xe8e0c8), tool: 'hammer' },
};
export function buildVillagerRigs(scene) { const o = {}; for (const k in VILLAGER_STYLES) o[k] = new Rig(scene, villagerParts(VILLAGER_STYLES[k]), 720); return o; }

export const PALETTES = {
  soldier: { cloth: 0x3d7bd6, legs: 0x3a3f52, helm: STEEL, plume: 0xc0392b, shield: 0x2f5fb0, trim: 0xf2d65e },
  heavy: { cloth: 0x6f7f9c, legs: 0x4a5266, helm: DARKSTEEL, plume: 0x2a2f3a, shield: 0x8e98a4, trim: 0xc0392b, heavy: true },
  cavalry: { cloth: 0x8c3fb0, legs: 0x4a3426, helm: STEEL, plume: 0xf2d65e, shield: 0x6b2d8a, trim: 0xf2d65e, horse: 0x8b5a2b, mane: 0x3a2a1c },
};
export const MAT = applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));

// Jeu de pièces instanciées pour un modèle.
// ombres de contact (v3.6) : chaque personnage dessiné par un Rig laisse sa position ici ; le Renderer en fait des taches au sol
export const BLOBS = [];
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
    if (this.blob !== 0) { const e = base.elements; BLOBS.push(e[12], e[13], e[14], Math.hypot(e[0], e[1], e[2]) * (this.blob || 1)); }
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

// ——— accessoires du villageois GLB (unités = cm, repère du maillage ; origine = pose de bind, T-pose) ———
// outil : poignée vers +z à partir de la main droite (hx,hy,hz) ; chapeau : posé sur la tête (hx,hy,hz = position de la tête)
export function toolGeometry(kind, [hx, hy, hz]) {
  const W = 0x7a5a3a, S = 0xcfd6dd, D = 0x55565c;
  const L = {
    axe: [bx(5, 5, 66, W, 0, 0, 26), bx(4, 20, 16, S, 0, 3, 56), bx(5, 6, 8, D, 0, -3, 48)],
    pick: [bx(5, 5, 74, W, 0, 0, 28), bx(60, 6, 6, S, 0, 0, 64), bx(7, 11, 7, S, 32, 0, 64), bx(7, 11, 7, S, -32, 0, 64)],
    hoe: [bx(4, 4, 96, W, 0, 0, 36), bx(18, 4, 12, S, 0, 0, 90)],
    hammer: [bx(5, 5, 46, W, 0, 0, 14), bx(15, 13, 10, D, 0, 0, 40)],
  }[kind]; if (!L) return null;
  const g = mergeGeometries(L, false); g.translate(hx, hy, hz); return g;
}
export function hatGeometry(kind, [hx, hy, hz]) {
  const top = 172;                                       // sommet du crâne (maillage) ≈ 180 cm ; chapeau posé à ~ y = 172..186
  const L = {
    cap: [bx(24, 9, 26, 0x7a5a30, 0, top + 5, 0), bx(14, 3, 10, 0x7a5a30, 0, top + 2, 15)],
    hard: [bx(26, 12, 28, 0xf2d65e, 0, top + 7, 0), bx(34, 3, 34, 0xf2d65e, 0, top + 1.5, 0)],
    hardGrey: [bx(26, 12, 28, 0xb0b4b8, 0, top + 7, 0), bx(34, 3, 34, 0xb0b4b8, 0, top + 1.5, 0)],
    hardOrange: [bx(26, 12, 28, 0xe67e22, 0, top + 7, 0), bx(34, 3, 34, 0xe67e22, 0, top + 1.5, 0)],
    straw: [bx(38, 3, 38, 0xe8c86a, 0, top + 2, 0), bx(21, 9, 21, 0xe8c86a, 0, top + 7, 0)],
  }[kind]; if (!L) return null; return mergeGeometries(L, false);
}
