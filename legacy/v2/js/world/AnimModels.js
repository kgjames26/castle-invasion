// Modèles animés pré-calculés (zombies du pack « Polyart Zombies » et archer « Bard the Bowman »).
// Les zombies sont stockés en « vertex animation texture » : 16 poses du cycle de marche par modèle,
// lues dans le vertex shader → des centaines de zombies animés en un seul draw call par modèle.
import * as THREE from 'three';

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) LIN[i] = Math.pow(i / 255, 2.2);

function readHeader(buf) {
  const hl = new DataView(buf).getUint32(0, true);
  const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let off = (4 + hl + 3) & ~3;
  return { hdr, off };
}
const align = o => (o + 3) & ~3;

function colorAttr(bytes, boost = 1) {
  const n = bytes.length / 3, a = new Float32Array(n * 3);
  for (let i = 0; i < a.length; i++) a[i] = Math.min(1, LIN[bytes[i]] * boost);
  return new THREE.BufferAttribute(a, 3);
}

export async function loadZombies(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const { hdr, off: o0 } = readHeader(buf);
  const F = hdr.F;
  let off = o0;
  const variants = [];
  for (const v of hdr.variants) {
    const idx = new Uint16Array(buf, off, v.I); off = align(off + v.I * 2);
    const col = new Uint8Array(buf, off, v.V * 3); off = align(off + v.V * 3);
    const q = new Uint16Array(buf, off, F * v.V * 3); off = align(off + F * v.V * 3 * 2);
    const rows = Math.ceil(v.V / 2048);
    const tex = new Float32Array(2048 * rows * F * 4);
    for (let f = 0; f < F; f++) {
      const base = f * rows * 2048;
      for (let i = 0; i < v.V; i++) {
        const s = (f * v.V + i) * 3, d = (base + i) * 4;
        tex[d] = q[s] / 65535; tex[d + 1] = q[s + 1] / 65535; tex[d + 2] = q[s + 2] / 65535;
      }
    }
    const t = new THREE.DataTexture(tex, 2048, rows * F, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    // géométrie de repos (pose 0) : sert aux bornes et au nombre de sommets
    const pos = new Float32Array(v.V * 3);
    for (let i = 0; i < v.V; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = v.mn[k] + q[i * 3 + k] / 65535 * (v.mx[k] - v.mn[k]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', colorAttr(col, 1.08));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 3);
    variants.push({ geo: g, tex: t, rows, F, mn: v.mn, mx: v.mx, period: v.period, V: v.V });
  }
  return { F, variants };
}

export async function loadArcher(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const { hdr, off: o0 } = readHeader(buf);
  let off = o0;
  const out = {};
  for (const p of hdr.parts) {
    const idx = new Uint16Array(buf, off, p.I); off = align(off + p.I * 2);
    const col = new Uint8Array(buf, off, p.V * 3); off = align(off + p.V * 3);
    const q = new Uint16Array(buf, off, p.V * 3); off = align(off + p.V * 6);
    const pos = new Float32Array(p.V * 3);
    for (let i = 0; i < p.V * 3; i++) pos[i] = p.mn[i % 3] + q[i] / 65535 * (p.mx[i % 3] - p.mn[i % 3]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', colorAttr(col, 1.0));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    out[p.name] = g;
  }
  return out;
}

// ---------- Shaders partagés ----------
// Brouillard du nord : sombre au fond, de plus en plus clair vers le sud (selon z monde)
export function makeNorthFog() {
  return {
    uNFogColor: { value: new THREE.Color(0x070b12) },
    uNFogRange: { value: new THREE.Vector2(-28, -56) },
  };
}

export function patchNorthFog(shader, fogU) {
  Object.assign(shader.uniforms, fogU);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vNZ;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 nwp = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
        nwp = instanceMatrix * nwp;
        #endif
        vNZ = ( modelMatrix * nwp ).z; }`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vNZ;\nuniform vec3 uNFogColor;\nuniform vec2 uNFogRange;')
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      { float nf = clamp( ( vNZ - uNFogRange.x ) / ( uNFogRange.y - uNFogRange.x ), 0.0, 1.0 );
        nf = nf * nf * ( 3.0 - 2.0 * nf ) * 0.97;
        gl_FragColor.rgb = mix( gl_FragColor.rgb, uNFogColor, nf ); }`);
}

export function patchVat(shader, v) {
  shader.uniforms.uVat = { value: v.tex };
  shader.uniforms.uMin = { value: new THREE.Vector3(...v.mn) };
  shader.uniforms.uSize = { value: new THREE.Vector3(v.mx[0] - v.mn[0], v.mx[1] - v.mn[1], v.mx[2] - v.mn[2]) };
  shader.uniforms.uF = { value: v.F };
  shader.uniforms.uRows = { value: v.rows };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      attribute float aAnim;
      uniform highp sampler2D uVat; uniform vec3 uMin; uniform vec3 uSize; uniform int uF; uniform int uRows;
      vec3 vatPos( int vid, int f ) {
        vec4 d = texelFetch( uVat, ivec2( vid & 2047, ( vid >> 11 ) + f * uRows ), 0 );
        return uMin + d.xyz * uSize;
      }`)
    .replace('#include <begin_vertex>', `
      int vf0 = int( floor( aAnim ) ) % uF; int vf1 = ( vf0 + 1 ) % uF; float vt = fract( aAnim );
      vec3 transformed = mix( vatPos( gl_VertexID, vf0 ), vatPos( gl_VertexID, vf1 ), vt );`);
}

// Matériau animé d'une variante de zombie (+ matériau de profondeur pour les ombres)
export function makeVatMaterials(v, fogU) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.onBeforeCompile = sh => { patchVat(sh, v); patchNorthFog(sh, fogU); };
  mat.customProgramCacheKey = () => 'vat-nfog';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = sh => patchVat(sh, v);
  depth.customProgramCacheKey = () => 'vat-depth';
  return { mat, depth };
}
