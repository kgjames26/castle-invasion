// Chargeur du « kit » de décor (assets/world) : géométries compactes + palette de textures partagée.
// Les maillages sont recentrés (centre X/Z, base à Y=0) et exprimés en mètres.
import * as THREE from 'three';
import { applyNorthFog } from './fog.js';

export async function loadKit(base = 'assets/world/') {
  const [meta, buf] = await Promise.all([fetch(base + 'kit.json').then(r => r.json()), fetch(base + 'kit.bin').then(r => r.arrayBuffer())]);
  const tex = await new THREE.TextureLoader().loadAsync(base + 'kit.png');
  tex.flipY = false; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4;
  const material = applyNorthFog(new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  const geo = {}, size = {};
  for (const name in meta.meshes) {
    const m = meta.meshes[name]; let o = m.off; const pad = n => (n + 3) & ~3;
    const q = new Int16Array(buf, o, m.v * 3); o += pad(m.v * 6);
    const nq = new Int8Array(buf, o, m.v * 4); o += pad(m.v * 4);
    const uq = new Int16Array(buf, o, m.v * 2); o += pad(m.v * 4);
    const ix = m.idx32 ? new Uint32Array(buf, o, m.i) : new Uint16Array(buf, o, m.i);
    const pos = new Float32Array(m.v * 3), nor = new Float32Array(m.v * 3), uv = new Float32Array(m.v * 2), e = m.ext;
    for (let i = 0; i < m.v; i++) {
      pos[i * 3] = q[i * 3] / 32767 * e[0]; pos[i * 3 + 1] = q[i * 3 + 1] / 32767 * e[1]; pos[i * 3 + 2] = q[i * 3 + 2] / 32767 * e[2];
      nor[i * 3] = nq[i * 4] / 127; nor[i * 3 + 1] = nq[i * 4 + 1] / 127; nor[i * 3 + 2] = nq[i * 4 + 2] / 127;
      uv[i * 2] = uq[i * 2] / 8192; uv[i * 2 + 1] = uq[i * 2 + 1] / 8192;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(m.idx32 ? new Uint32Array(ix) : new Uint16Array(ix), 1));
    g.computeBoundingSphere(); geo[name] = g; size[name] = m.size;
  }
  return { geo, size, material, names: Object.keys(geo) };
}
