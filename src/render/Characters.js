// Personnages repris de l'ancien jeu (v2) : zombies animés par texture de sommets (VAT), archer « Bard the Bowman »
// (corps + arc, statiques) et villageois humanoïde reconstruit à partir du code de l'ancien jeu (cultivateur).
// Décodeurs adaptés de assets/archive/code-reference/AnimModels.js et Models.js ; aucun squelette n'existe dans les .bin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchNorthFog, applyNorthFog, unitDetail } from './fog.js';
import { loopOps, applyOps } from './subdiv.js';

const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) LIN[i] = Math.pow(i / 255, 2.2);
const align = o => (o + 3) & ~3;
function header(buf) { const hl = new DataView(buf).getUint32(0, true); return { hdr: JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), off: align(4 + hl) }; }
const colorAttr = (bytes, boost = 1) => { const a = new Float32Array(bytes.length); for (let i = 0; i < a.length; i++) a[i] = Math.min(1, LIN[bytes[i]] * boost); return new THREE.BufferAttribute(a, 3); };

async function loadZombies(url) {
  const buf = await (await fetch(url)).arrayBuffer(), { hdr, off: o0 } = header(buf), F = hdr.F; let off = o0; const variants = [];
  for (const v of hdr.variants) {
    const idx = new Uint16Array(buf, off, v.I); off = align(off + v.I * 2);
    const col = new Uint8Array(buf, off, v.V * 3); off = align(off + v.V * 3);
    const q = new Uint16Array(buf, off, F * v.V * 3); off = align(off + F * v.V * 3 * 2);
    const rows = Math.ceil(v.V / 2048), tex = new Float32Array(2048 * rows * F * 4);
    for (let f = 0; f < F; f++) { const base = f * rows * 2048; for (let i = 0; i < v.V; i++) { const s = (f * v.V + i) * 3, d = (base + i) * 4; tex[d] = q[s] / 65535; tex[d + 1] = q[s + 1] / 65535; tex[d + 2] = q[s + 2] / 65535; } }
    const t = new THREE.DataTexture(tex, 2048, rows * F, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    const pos = new Float32Array(v.V * 3); for (let i = 0; i < v.V; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = v.mn[k] + q[i * 3 + k] / 65535 * (v.mx[k] - v.mn[k]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', colorAttr(col, 1.08)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 3);
    variants.push({ geo: g, tex: t, rows, F, mn: v.mn, mx: v.mx, period: v.period });
  }
  return { F, variants };
}
async function loadArcher(url) {
  const buf = await (await fetch(url)).arrayBuffer(), { hdr, off: o0 } = header(buf); let off = o0; const out = {};
  for (const p of hdr.parts) {
    const idx = new Uint16Array(buf, off, p.I); off = align(off + p.I * 2); const col = new Uint8Array(buf, off, p.V * 3); off = align(off + p.V * 3);
    const q = new Uint16Array(buf, off, p.V * 3); off = align(off + p.V * 6); const pos = new Float32Array(p.V * 3);
    for (let i = 0; i < p.V * 3; i++) pos[i] = p.mn[i % 3] + q[i] / 65535 * (p.mx[i % 3] - p.mn[i % 3]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', colorAttr(col)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere(); out[p.name] = g;
  }
  return out;
}
function patchVat(shader, v) {
  shader.uniforms.uVat = { value: v.tex }; shader.uniforms.uMin = { value: new THREE.Vector3(...v.mn) };
  shader.uniforms.uSize = { value: new THREE.Vector3(v.mx[0] - v.mn[0], v.mx[1] - v.mn[1], v.mx[2] - v.mn[2]) }; shader.uniforms.uF = { value: v.F }; shader.uniforms.uRows = { value: v.rows };
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute float aAnim;
      uniform highp sampler2D uVat; uniform vec3 uMin; uniform vec3 uSize; uniform int uF; uniform int uRows;
      vec3 vatPos( int vid, int f ) { vec4 d = texelFetch( uVat, ivec2( vid & 2047, ( vid >> 11 ) + f * uRows ), 0 ); return uMin + d.xyz * uSize; }`)
    .replace('#include <begin_vertex>', `
      int vf0 = int( floor( aAnim ) ) % uF; int vf1 = ( vf0 + 1 ) % uF; float vt = fract( aAnim );
      vec3 transformed = mix( vatPos( gl_VertexID, vf0 ), vatPos( gl_VertexID, vf1 ), vt );`);
}
function vatMaterial(v) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = sh => { patchVat(sh, v); patchNorthFog(sh); }; m.customProgramCacheKey = () => 'vat-nfog'; return m;
}

// cadavres (v3.4) : même animation VAT, figée, + fondu par instance (attribut aFade) ; matériau transparent séparé
export function vatFadeMaterial(v) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true });
  m.onBeforeCompile = sh => {
    patchVat(sh, v); patchNorthFog(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;').replace('#include <project_vertex>', '#include <project_vertex>\nvFade = aFade;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vFade;');
  };
  m.customProgramCacheKey = () => 'vat-fade'; return m;
}
// ——— villageois : humanoïde low-poly (couleurs de sommets), repris du « cultivateur » de l'ancien jeu ———
const _c = new THREE.Color();
function P(geom, color, t = {}) {
  const g = geom.index ? geom.toNonIndexed() : geom; g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx || 0, t.ry || 0, t.rz || 0)), new THREE.Vector3(1, 1, 1)));
  _c.set(color); const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) { const f = 0.94 + ((i * 7919) % 100) / 100 * 0.12; for (let k = 0; k < 3 && i + k < n; k++) { col[(i + k) * 3] = _c.r * f; col[(i + k) * 3 + 1] = _c.g * f; col[(i + k) * 3 + 2] = _c.b * f; } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function villagerGeometry() {
  const legH = 0.8, torsoH = 0.7, SKIN = 0xe0b48c, parts = [
    P(box(0.2, legH, 0.22), 0x4a3b2a, { x: -0.13, y: legH / 2 }), P(box(0.2, legH, 0.22), 0x4a3b2a, { x: 0.13, y: legH / 2 }),
    P(box(0.52, torsoH, 0.32), 0x8a6a3a, { y: legH + torsoH / 2 }), P(box(0.3, 0.3, 0.3), SKIN, { y: legH + torsoH + 0.18 }),
    P(box(0.14, 0.62, 0.14), 0x8a6a3a, { x: -0.34, y: legH + torsoH - 0.33 }), P(box(0.14, 0.62, 0.14), 0x8a6a3a, { x: 0.34, y: legH + torsoH - 0.33 }),
    P(new THREE.ConeGeometry(0.38, 0.22, 8), 0xe8c86a, { y: 1.83 }),                                   // chapeau de paille
    P(box(0.3, 0.3, 0.2), 0x7a5a30, { y: 1.15, z: -0.24 }),                                              // hotte
  ];
  const g = mergeGeometries(parts, false); g.computeBoundingSphere(); return g;
}

// Villageois (modèle GLB Mixamo cuit en VAT par tools/bake_villager.py) : un maillage unique, une variante de couleur par métier, 5 clips (marche, portage devant, portage à l'épaule, coup d'outil, repos).
async function loadVillager(url) {
  const buf = await (await fetch(url)).arrayBuffer(), { hdr, off: o0 } = header(buf); let off = o0; const V = hdr.V, F = hdr.F;
  const idx = new Uint16Array(buf.slice(off, off + hdr.I * 2)); off = align(off + hdr.I * 2);
  const cols = {}; for (const k of hdr.tints) { cols[k] = new Uint8Array(buf, off, V * 3); off = align(off + V * 3); }
  const q = new Uint16Array(buf, off, F * V * 3);
  const rows = Math.ceil(V / 2048), tex = new Float32Array(2048 * rows * F * 4);
  for (let f = 0; f < F; f++) { const base = f * rows * 2048; for (let i = 0; i < V; i++) { const s = (f * V + i) * 3, d = (base + i) * 4; tex[d] = q[s] / 65535; tex[d + 1] = q[s + 1] / 65535; tex[d + 2] = q[s + 2] / 65535; } }
  const t = new THREE.DataTexture(tex, 2048, rows * F, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  const pos = new Float32Array(V * 3); for (let i = 0; i < V; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = hdr.mn[k] + q[i * 3 + k] / 65535 * (hdr.mx[k] - hdr.mn[k]);
  const geos = {};
  for (const k of hdr.tints) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', colorAttr(cols[k], 1)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 95, 0), 200); geos[k] = g; }
  const v = { tex: t, rows, F, mn: hdr.mn, mx: hdr.mx };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => { patchVat(sh, v); patchNorthFog(sh); unitDetail(sh, 0.0095); }; mat.customProgramCacheKey = () => 'vat-nfog-dbl';
  const mats = (arr) => arr.map(a => new THREE.Matrix4().fromArray(a));
  return { geos, mat, F, clips: hdr.clips, tints: hdr.tints, hand: mats(hdr.hand), head: mats(hdr.head), spine: mats(hdr.spine || hdr.head.map(() => new THREE.Matrix4().toArray())), handPos: hdr.handPos, headPos: hdr.headPos, miny: hdr.miny, height: hdr.height };
}

// Cheval (modèle GLB low-poly cuit en VAT par tools/bake_horse.py) : 3 allures (pas, galop, repos), 8 robes, matrices de selle par image.
async function loadHorse(url) {
  const buf = await (await fetch(url)).arrayBuffer(), { hdr, off: o0 } = header(buf); let off = o0; const V0 = hdr.V, F = hdr.F;
  const idx0 = new Uint16Array(buf.slice(off, off + hdr.I * 2)); off = align(off + hdr.I * 2);
  const cols = {}; for (const k of hdr.skins) { cols[k] = new Uint8Array(buf, off, V0 * 3); off = align(off + V0 * 3); }
  const q = new Uint16Array(buf, off, F * V0 * 3);
  // (v9.8) subdivision de Loop : 4 fois plus de triangles, silhouette plus ronde ; appliquée à chaque image de l'animation
  const f0 = new Float32Array(V0 * 3); for (let i = 0; i < V0 * 3; i++) f0[i] = q[i] / 65535;
  const SD = loopOps(f0, idx0, 1e-6), V = SD.V, rows = Math.ceil(V / 2048), tex = new Float32Array(2048 * rows * F * 4);
  for (let f = 0; f < F; f++) { const src = new Float32Array(V0 * 3); for (let i = 0; i < V0 * 3; i++) src[i] = q[f * V0 * 3 + i] / 65535; const o = applyOps(SD.ops, src), base = f * rows * 2048;
    for (let i = 0; i < V; i++) { const d = (base + i) * 4; tex[d] = o[i * 3]; tex[d + 1] = o[i * 3 + 1]; tex[d + 2] = o[i * 3 + 2]; } }
  const t = new THREE.DataTexture(tex, 2048, rows * F, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  const n0 = applyOps(SD.ops, f0), pos = new Float32Array(V * 3); for (let i = 0; i < V; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = hdr.mn[k] + n0[i * 3 + k] * (hdr.mx[k] - hdr.mn[k]);
  const index = V > 65535 ? new Uint32Array(SD.index) : new Uint16Array(SD.index), geos = {};
  for (const k of hdr.skins) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(applyOps(SD.col, colorAttr(cols[k], 1.05).array), 3)); g.setIndex(new THREE.BufferAttribute(index, 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0.5), 3); geos[k] = g; }
  const v = { tex: t, rows, F, mn: hdr.mn, mx: hdr.mx };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.onBeforeCompile = sh => { patchVat(sh, v); patchNorthFog(sh); unitDetail(sh); }; mat.customProgramCacheKey = () => 'vat-nfog-horse';
  return { geos, mat, F, clips: hdr.clips, skins: hdr.skins, seat: hdr.seat.map(a => new THREE.Matrix4().fromArray(a)), backY: hdr.backY };
}

export async function loadCharacters(base = 'assets/characters/') {
  const [zombies, archer, villager, horse] = await Promise.all([loadZombies(base + 'zombies.bin'), loadArcher(base + 'archer.bin'), loadVillager(base + 'villager.bin').catch(e => { console.warn('villageois GLB indisponible', e); return null; }), loadHorse(base + 'horse.bin').catch(e => { console.warn('cheval GLB indisponible', e); return null; })]);
  zombies.mats = zombies.variants.map(vatMaterial); zombies.fadeMats = zombies.variants.map(vatFadeMaterial);
  const solid = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); solid.onBeforeCompile = sh => { patchNorthFog(sh); unitDetail(sh); }; solid.customProgramCacheKey = () => 'unit-detail-s';
  return { zombies, archer, villager, horse, archerMat: solid, villagerGeo: villagerGeometry(), villagerMat: solid };
}
