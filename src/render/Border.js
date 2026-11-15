// Bordure de la carte (v3.1) : la partie jouable est cernée d'une crête de collines basses et de rochers, au lieu d'un simple
// changement de texture. Au nord, la crête s'évase vers l'extérieur (couloir d'arrivée des hordes qui s'ouvre vers le haut).
// Au-delà : sol de sous-bois (même matière que la carte, plus sombre) puis la forêt de bordure.
import * as THREE from 'three';
import { W, D } from '../sim/constants.js';
import { FRONTIER } from '../content/medieval.js';
import { applyNorthFog } from './fog.js';
import { groundMaterial } from './Ground.js';

const FLARE_Z = 78, FLARE_K = 0.9;   // en dessous de z = 78, la crête s'écarte de 0,9 m par mètre vers le nord
export const westEdge = z => -3 - Math.max(0, FLARE_Z - z) * FLARE_K;
export const eastEdge = z => W + 3 + Math.max(0, FLARE_Z - z) * FLARE_K;
const ZF = FRONTIER.z0 - 4, XL = FRONTIER.left[0] - 6, XR = FRONTIER.right[1] + 6, ZS = D + 4;

// tracé fermé de la crête (sens horaire vu du ciel), avec pour chaque point la normale vers l'extérieur
function outline() {
  const pts = [];
  const seg = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 5)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); };
  for (let z = -70; z < ZF; z += 5) pts.push([westEdge(z), z]);
  seg(-3, ZF, XL, ZF); seg(XL, ZF, XL, ZS); seg(XL, ZS, XR, ZS); seg(XR, ZS, XR, ZF); seg(XR, ZF, W + 3, ZF);
  for (let z = ZF; z > -70; z -= 5) pts.push([eastEdge(z), z]);
  return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1; return [p[0], p[1], -tz / l, tx / l]; });
}
// point hors de la zone jouable ? (pour écarter les arbres de bordure de l'intérieur)
export function outsidePlay(x, z) {
  if (z < ZF) return x < westEdge(z) - 2 || x > eastEdge(z) + 2;
  if (z < ZS) return x < XL - 2 || x > XR + 2;
  return true;
}

function hillGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const grass = new THREE.Color(0x5d7a3e), dry = new THREE.Color(0x7f7c52), rock = new THREE.Color(0x6a6760);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + 0.18 * Math.sin(x * 5.1 + z * 3.7) + 0.12 * Math.sin(z * 7.3 - y * 4.1);
    y = y < 0 ? -0.15 : y; p.setXYZ(i, x * n, y * n, z * n);
    const t = Math.max(0, y); c.copy(grass).lerp(dry, Math.min(1, t * 0.9 + 0.15 * Math.sin(x * 9 + z * 6)));
    if (Math.abs(Math.sin(x * 11.3 + z * 8.1)) > 0.86 && t > 0.15) c.copy(rock);   // affleurements rocheux
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}

export function buildBorder(scene, shadowize) {
  let sd = 4242; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + (b - a) * r();
  const pts = outline(), hills = [], rocks = [];
  for (const [x, z, nx, nz] of pts) {
    const big = r() < 0.55;
    if (big) { const o = rr(3, 8); hills.push([x + nx * o, z + nz * o, rr(4, 9), rr(1.8, 5), rr(4, 8), r() * 6.3]); }
    const k = 1 + (r() * 3 | 0);
    for (let j = 0; j < k; j++) { const o = rr(-1.5, 6), t = rr(-2.5, 2.5); rocks.push([x + nx * o - nz * t, z + nz * o + nx * t, rr(0.9, 3.6), r() * 6.3]); }
    if (r() < 0.2) hills.push([x + nx * rr(10, 16), z + nz * rr(10, 16), rr(6, 11), rr(2.5, 6), rr(6, 10), r() * 6.3]);   // second rang, plus haut
  }
  const d = new THREE.Object3D(), c = new THREE.Color();
  const hm = new THREE.InstancedMesh(hillGeometry(), applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })), hills.length);
  hills.forEach(([x, z, sx, sy, sz, ry], i) => { d.position.set(x, -0.2, z); d.rotation.set(0, ry, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); hm.setMatrixAt(i, d.matrix); hm.setColorAt(i, c.setScalar(0.85 + r() * 0.25)); });
  const rg = new THREE.DodecahedronGeometry(1, 0), rm = new THREE.InstancedMesh(rg, applyNorthFog(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })), rocks.length);
  rocks.forEach(([x, z, s, ry], i) => { d.position.set(x, s * 0.35, z); d.rotation.set(r() * 0.6, ry, r() * 0.6); d.scale.set(s * rr(0.8, 1.4), s * rr(0.6, 1.0), s * rr(0.8, 1.3)); d.updateMatrix(); rm.setMatrixAt(i, d.matrix); const v = 0.22 + r() * 0.12; rm.setColorAt(i, c.setRGB(v, v * 0.98, v * 0.93)); });
  for (const m of [hm, rm]) { m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; scene.add(m); if (shadowize) shadowize(m); }

  // sol au-delà de la carte : prairie de sous-bois, mêmes textures de détail que la carte (herbe mêlée de terre)
  const X0 = -360, Z0 = -90, SW = W + 720, SD = D + 180, k = 1, cv = document.createElement('canvas'); cv.width = SW * k; cv.height = SD * k; const g = cv.getContext('2d');
  const sv = document.createElement('canvas'); sv.width = SW / 2; sv.height = SD / 2; const sp = sv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, SD * k);
  for (const [z, col] of [[-90, '#4a6436'], [0, '#4f6a3a'], [40, '#5f7d42'], [100, '#6a8445'], [138, '#6f8446'], [205, '#6e8a45'], [260, '#6a8a43'], [320, '#5f7e3e'], [D + 90, '#587639']]) grad.addColorStop((z - Z0) / SD, col);   // mêmes teintes que la carte, à la même latitude
  g.fillStyle = grad; g.fillRect(0, 0, cv.width, cv.height); sp.fillStyle = '#000'; sp.fillRect(0, 0, sv.width, sv.height);
  for (let i = 0; i < 700; i++) {      // grandes nappes douces, comme sur la carte ; sous la forêt, un sous-bois à peine plus sombre
    const x = r() * SW, z = r() * SD, rad = rr(18, 46), t = r(), a = rr(0.05, 0.11);
    const col = t < 0.5 ? `rgba(84,112,52,${a})` : t < 0.8 ? `rgba(128,132,72,${a})` : `rgba(70,92,46,${a})`;
    const gr = g.createRadialGradient(x * k, z * k, 0, x * k, z * k, rad * k); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.fillRect((x - rad) * k, (z - rad) * k, rad * 2 * k, rad * 2 * k);
    if (t > 0.92) { const gs = sp.createRadialGradient(x / 2, z / 2, 0, x / 2, z / 2, rad / 4); gs.addColorStop(0, 'rgba(255,0,0,.25)'); gs.addColorStop(1, 'rgba(255,0,0,0)'); sp.fillStyle = gs; sp.fillRect((x - rad / 2) / 2, (z - rad / 2) / 2, rad / 2, rad / 2); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const stex = new THREE.CanvasTexture(sv);
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(SW, SD), groundMaterial(tex, stex));
  skirt.rotation.x = -Math.PI / 2; skirt.position.set(X0 + SW / 2, -0.06, Z0 + SD / 2); skirt.receiveShadow = true; scene.add(skirt);
  return { hills: hm, rocks: rm, skirt };
}
