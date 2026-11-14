// Charges portées par les villageois (unités = cm, repère du maillage du villageois GLB).
//  bois : fagot de 3 rondins liés, sur l'épaule droite · nourriture : sac de grain sur l'épaule
//  pierre : blocs tenus à deux mains · fer : panier d'osier rempli de minerai rouillé · or : panier de pépites
// Chaque géométrie est centrée sur l'origine ; `at` = position du centre dans le repère du buste (pose sans rotation du dos),
// `clip` = animation de portage, `span` = longueur (cm) à caler dans une brouette / charrette, `axis` = 0 (largeur) ou 2 (longueur).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shape } from './Ores.js';

const cyl = (r, l, n = 7) => new THREE.CylinderGeometry(r, r, l, n), rock = () => new THREE.DodecahedronGeometry(1, 0), ico = () => new THREE.IcosahedronGeometry(1, 0), box = () => new THREE.BoxGeometry(1, 1, 1);
// rondin couché selon z : écorce + bouts coupés clairs (faces dont la normale suit l'axe)
function log(x, y, z, r, l, tilt = 0) {
  const g = cyl(r, l).toNonIndexed(); g.rotateX(Math.PI / 2); g.computeVertexNormals();
  const n = g.attributes.normal, p = g.attributes.position, col = new Float32Array(p.count * 3), bark = new THREE.Color(0x7a4a24), cut = new THREE.Color(0xe6c088), ring = new THREE.Color(0xb98a52);
  for (let i = 0; i < p.count; i += 3) {
    const end = Math.abs(n.getZ(i)) > 0.9, k = 0.85 + 0.3 * ((Math.sin(i * 7.31 + x) * 43758.5) % 1 + 1) % 1, c = end ? (i % 2 ? cut : ring) : bark;
    for (let v = 0; v < 3; v++) { col[(i + v) * 3] = c.r * (end ? 1 : k); col[(i + v) * 3 + 1] = c.g * (end ? 1 : k); col[(i + v) * 3 + 2] = c.b * (end ? 1 : k); }
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.rotateX(tilt); g.translate(x, y, z); return g;
}
function basket(L, w, h, d, wood, band) {
  const t = 2.2;
  L.push(shape(box(), wood, 0, -h / 2 + t / 2, 0, w, t, d, 0, 0, 0, 0.06));                                     // fond
  L.push(shape(box(), wood, 0, 0, d / 2 - t / 2, w, h, t, 0, 0, 0, 0.1), shape(box(), wood, 0, 0, -d / 2 + t / 2, w, h, t, 0, 0, 0, 0.1));
  L.push(shape(box(), wood, w / 2 - t / 2, 0, 0, t, h, d, 0, 0, 0, 0.1), shape(box(), wood, -w / 2 + t / 2, 0, 0, t, h, d, 0, 0, 0, 0.1));
  for (const y of [-h * 0.15, h * 0.32]) L.push(shape(box(), band, 0, y, 0, w + 0.8, 1.6, d + 0.8, 0, 0, 0, 0.05));   // cerclages tressés
  for (const s of [-1, 1]) L.push(shape(box(), band, s * (w / 2 + 0.6), h / 2 - 1, 0, 1.6, 3, 7, 0, 0, 0, 0.05));     // poignées
}
export const LOADS = {
  wood: { clip: 'shoulder', at: [-19, 160, -4], span: 100, axis: 2, geo: () => {
    const L = [log(5.6, -3, 0, 6.6, 100), log(-7, -3.5, 3, 6.2, 94), log(-0.6, 8, -2, 6, 88)];
    for (const z of [-26, 24]) L.push(shape(box(), 0x5a4030, -0.5, 1.5, z, 23, 21, 2, 0, 0, 0, 0.05));              // liens de corde
    const g = mergeGeometries(L, false); g.rotateX(-0.18); return g; } },
  food: { clip: 'shoulder', at: [-19, 160, -6], span: 52, axis: 2, geo: () => mergeGeometries([
    shape(new THREE.SphereGeometry(1, 8, 6), 0xb39c76, 0, 0, 0, 16, 12.5, 24, 0.1, 0, 0.15, 0.07),                      // sac de toile
    shape(new THREE.SphereGeometry(1, 6, 4), 0xa38b66, 0, -3, -9, 14, 9, 12, 0, 0, 0, 0.05),
    shape(cyl(3.2, 7, 6), 0x9c845e, 0, 3, 24, 1, 1, 1, Math.PI / 2 - 0.3, 0, 0, 0.05), shape(cyl(3.8, 2, 6), 0x7a5230, 0, 3.5, 21.5, 1, 1, 1, Math.PI / 2 - 0.3, 0, 0),   // col noué
    shape(ico(), 0xe8c86a, 0, 6, 28, 3.5, 4, 3.5, 0.3, 0, 0, 0.1), shape(box(), 0x9a3a2a, 0, 1, 2, 22, 7, 0.6, 0, 0, 0.12, 0.05),   // épis qui dépassent, bande rouge
  ], false) },
  stone: { clip: 'carry', at: [0, 116, 29], span: 48, axis: 0, geo: () => mergeGeometries([
    shape(rock(), 0x9a9ea3, -6.5, -3, -0.5, 12, 9, 10.5, 0.3, 0.5, 0.1), shape(rock(), 0x878b90, 6.5, -3.5, 1, 10.5, 8.5, 10, 0.8, 0.2, 0),
    shape(rock(), 0xadb1b5, 0, 7, 0, 9.5, 7, 9, 1.2, 0.9, 0.3), shape(box(), 0xf0efe9, -6, -1, 9.6, 10, 0.8, 0.8, 0, 0, 0.3, 0.02),
  ], false).scale(1.45, 1.45, 1.45) },
  iron: { clip: 'carry', at: [0, 107, 27], span: 36, axis: 0, geo: () => { const L = []; basket(L, 32, 14, 21, 0x9a6e3a, 0x6b4a26);
    [[-9, 7, -3, 5.5, 0x4a4f5a], [-2, 9, 4, 6, 0x5d4034], [7, 7.5, -2, 5.2, 0x4a4f5a], [3, 6, 5, 4.5, 0xa4502a], [-6, 6, 6, 4.2, 0x6a717e], [9, 6.5, 6, 4, 0x8a4a2c], [0, 11, -4, 4.6, 0x3e434c]]
      .forEach(([x, y, z, s, c], k) => L.push(shape(rock(), c, x, y, z, s, s * 0.8, s, k, k * 2, 0, 0.12)));
    return mergeGeometries(L, false); } },
  gold: { clip: 'carry', at: [0, 107, 27], span: 34, axis: 0, geo: () => { const L = []; basket(L, 28, 13, 19, 0x6e4a2a, 0x4a3018);
    L.push(shape(box(), 0x3a2a1a, 0, 4.8, 0, 25, 1, 16, 0, 0, 0, 0.05));                                              // fond sombre du panier
    [[-8, 6.5, -3, 4], [-2, 8, 3, 4.6], [5, 7, -2, 4.2], [8, 6.2, 4, 3.4], [-6, 6, 5, 3.2], [1, 9.5, -4, 3.6], [3, 7.5, 6, 3], [-3, 10, 0, 3.4]]
      .forEach(([x, y, z, s], k) => L.push(shape(ico(), k % 3 ? 0xffd447 : 0xf2b62a, x, y, z, s, s * 0.75, s * 0.9, k, k * 1.7, 0, 0.12)));
    return mergeGeometries(L, false); } },
};
// outil rangé dans le dos pendant le portage : poignée du bas à la hanche droite, fer au-dessus de l'épaule gauche, lame vers l'arrière
export function backToolMatrix(handPos) {
  const [hx, hy, hz] = handPos;
  return new THREE.Matrix4().makeTranslation(-12, 104, -21).multiply(new THREE.Matrix4().makeRotationZ(-0.5)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(-hx, -hy, -hz));
}
export function buildLoadMeshes(scene, mat, cap) {
  const out = {};
  for (const r in LOADS) { const g = LOADS[r].geo(); g.computeBoundingSphere(); const m = new THREE.InstancedMesh(g, mat, cap); m.frustumCulled = false; m.count = 0; m.castShadow = true; scene.add(m); out[r] = m; }
  return out;
}
