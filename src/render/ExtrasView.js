// Vue des systèmes v4.0 (lecture seule de la simulation) : eau (douves du château et douves défensives), poussière des hordes,
// fumées de cheminées, taches de sang et traces, cadavres de soldats et de géants qui s'effacent, villageois de la placette et
// enfants, charrettes sur les routes pavées, oiseaux et cerfs, météo (pluie, neige, brume), pièges, palissade, héros, crachats d'acide.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W, D, SECTORS, SECTOR_W, CASTLE, PLAZA, WALL_STAND_Z, wallOff, wallSlope } from '../sim/constants.js';
import { EXTRA, ZOMBIES } from '../content/medieval.js';
import { palZ, moatBand } from '../sim/extras.js';
import { applyNorthFog, patchNorthFog, fogUniforms } from './fog.js';
import { FadeRig, Rig, villagerParts, VILLAGER_STYLES, footParts, PALETTES } from './Troops.js';
import { golemParts } from './Heroes.js';

const lam = (c, o = {}) => applyNorthFog(new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o }));
// ——— particules : un nuage de points (taille, couleur, opacité par particule) ———
class Particles {
  constructor(scene, cap, blending = THREE.NormalBlending) {
    this.cap = cap; this.n = 0; this.p = [];
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending,
      vertexShader: 'attribute vec4 aCol; attribute float aSize; varying vec4 vC; void main() { vC = aCol; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); gl_PointSize = aSize * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec4 vC; void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep( 0.5, 0.15, length( d ) ); gl_FragColor = vec4( vC.rgb, vC.a * a ); }' });
    this.pts = new THREE.Points(g, m); this.pts.frustumCulled = false; this.pts.renderOrder = 5; scene.add(this.pts);
  }
  add(o) { if (this.p.length < this.cap) this.p.push(o); }
  update(dt) {
    let n = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i]; q.t += dt; if (q.t >= q.life) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= (q.g || 0) * dt;
      const f = q.t / q.life, a = q.a * (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85);
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z; this.col[n * 4] = q.r; this.col[n * 4 + 1] = q.gr; this.col[n * 4 + 2] = q.b; this.col[n * 4 + 3] = a; this.size[n] = q.s * (1 + (q.grow || 0) * f); n++;
    }
    this.pts.geometry.setDrawRange(0, n); for (const k of ['position', 'aCol', 'aSize']) this.pts.geometry.attributes[k].needsUpdate = true;
  }
}
// ——— décalques au sol (sang, traces de terre) qui s'effacent ———
class Decals {
  constructor(scene, cap) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d'); let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 14; k++) { const x = 64 + (r() - 0.5) * 70, y = 64 + (r() - 0.5) * 70, rad = 8 + r() * 24; g.fillStyle = `rgba(${90 + r() * 30 | 0},10,8,${0.5 + r() * 0.35})`; g.beginPath(); g.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, 7); g.fill(); }   // sang
    for (let k = 0; k < 10; k++) { const x = 192 + (r() - 0.5) * 60, y = 64 + (r() - 0.5) * 90, rad = 6 + r() * 16; g.fillStyle = `rgba(70,52,34,${0.3 + r() * 0.3})`; g.beginPath(); g.ellipse(x, y, rad * 0.7, rad, 0, 0, 7); g.fill(); }   // terre foulée
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); this.uvo = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); this.fade = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    geo.setAttribute('aU', this.uvo); geo.setAttribute('aFade', this.fade);
    const m = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false });
    m.onBeforeCompile = sh => { patchNorthFog(sh); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aU;\nattribute float aFade;\nvarying float vFade;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = vec2( vMapUv.x * 0.5 + aU, vMapUv.y );\nvFade = aFade;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vFade;'); };
    m.customProgramCacheKey = () => 'decal';
    this.im = new THREE.InstancedMesh(geo, m, cap); this.im.frustumCulled = false; this.im.count = 0; this.im.renderOrder = 1; scene.add(this.im); this.list = []; this.cap = cap; this.d = new THREE.Object3D();
  }
  add(x, z, kind, s, life) { if (this.list.length >= this.cap) this.list.shift(); this.list.push({ x, z, kind, s, life, t: 0, rot: Math.random() * 6.28 }); }
  update(dt) {
    let n = 0; const d = this.d;
    for (let i = this.list.length - 1; i >= 0; i--) { const c = this.list[i]; c.t += dt; if (c.t > c.life) { this.list.splice(i, 1); continue; }
      d.position.set(c.x, 0.05 + (i % 9) * 0.002, c.z); d.rotation.set(0, c.rot, 0); d.scale.set(c.s, 1, c.s); d.updateMatrix(); this.im.setMatrixAt(n, d.matrix);
      this.uvo.array[n] = c.kind === 'blood' ? 0 : 0.5; this.fade.array[n] = Math.min(1, (c.life - c.t) / (c.life * 0.35)); n++; }
    this.im.count = n; this.im.instanceMatrix.needsUpdate = true; this.uvo.needsUpdate = true; this.fade.needsUpdate = true;
  }
}
// ——— eau : surface ondulée (normales animées), reflets du soleil ———
function waterMaterial() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const a = Math.sin(x / 128 * Math.PI * 6) + Math.sin((x + y) / 128 * Math.PI * 8) * 0.6 + Math.sin(y / 128 * Math.PI * 10) * 0.4, b = Math.cos(y / 128 * Math.PI * 6) + Math.cos((x - y) / 128 * Math.PI * 4) * 0.6, o = (y * 128 + x) * 4; img.data[o] = 128 + a * 30; img.data[o + 1] = 128 + b * 30; img.data[o + 2] = 255; img.data[o + 3] = 255; }
  g.putImageData(img, 0, 0); const n = new THREE.CanvasTexture(cv); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(6, 6);
  const m = new THREE.MeshPhongMaterial({ color: 0x2f5a72, specular: 0xbfd8ff, shininess: 80, normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.9, depthWrite: false });
  m.onBeforeCompile = sh => patchNorthFog(sh); m.customProgramCacheKey = () => 'water'; m.userData.n = n; return m;
}

export class ExtrasView {
  constructor(rd) {
    this.rd = rd; const scene = this.scene = rd.scene, sim = this.sim = rd.sim; this.d = new THREE.Object3D(); this.c = new THREE.Color(); this.t = 0;
    this.dust = new Particles(scene, 700); this.smoke = new Particles(scene, 500); this.fx = new Particles(scene, 300, THREE.AdditiveBlending);
    this.decals = new Decals(scene, 260); this.water = waterMaterial();
    this.buildCastleMoat();
    // douves défensives (une bande d'eau ou de terre par secteur, suivant l'arc de la muraille)
    this.moatMeshes = [];
    // pièges
    const spikes = mergeGeometries([new THREE.BoxGeometry(3.6, 0.12, 3.6).translate(0, 0.06, 0), ...Array.from({ length: 9 }, (_, k) => new THREE.ConeGeometry(0.12, 0.9, 4).translate(-1.1 + (k % 3) * 1.1, 0.45, -1.1 + ((k / 3) | 0) * 1.1))].map(g => g.toNonIndexed()));
    const calt = mergeGeometries(Array.from({ length: 14 }, (_, k) => new THREE.TetrahedronGeometry(0.16).translate(Math.cos(k * 2.4) * (0.4 + k * 0.16), 0.1, Math.sin(k * 2.4) * (0.4 + k * 0.16))).map(g => g.toNonIndexed()));
    const barrel = mergeGeometries([new THREE.CylinderGeometry(0.5, 0.45, 1.1, 10).translate(0, 0.55, 0), new THREE.TorusGeometry(0.5, 0.05, 4, 12).rotateX(Math.PI / 2).translate(0, 0.25, 0), new THREE.TorusGeometry(0.5, 0.05, 4, 12).rotateX(Math.PI / 2).translate(0, 0.85, 0)].map(g => g.toNonIndexed()));
    const mk = (g, m, n) => { const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; im.count = 0; im.castShadow = true; scene.add(im); return im; };
    this.trapM = { spikes: mk(spikes, lam(0x5a4632), 40), caltrops: mk(calt, lam(0x3a3c42), 40), pitch: mk(barrel, lam(0x4a3220), 40) };
    // palissade : pieux taillés en pointe, un par mètre, par secteur
    const stake = mergeGeometries([new THREE.CylinderGeometry(0.22, 0.26, 3.4, 6).translate(0, 1.7, 0), new THREE.ConeGeometry(0.22, 0.6, 6).translate(0, 3.7, 0)].map(g => g.toNonIndexed()));
    this.stakes = mk(stake, lam(0xffffff), SECTORS * 44); this.stakes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SECTORS * 44 * 3), 3);
    // héros : étendard doré au-dessus de son escouade
    this.heroFlag = new THREE.Group(); { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 5), lam(0x4a3426)); p.position.y = 2.5; const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.06), lam(0xd9b43a)); f.position.set(0.82, 4.3, 0); const cr = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 5), lam(0xf2d65e, { emissive: 0x6a5010 })); cr.position.y = 5.3; this.heroFlag.add(p, f, cr); }
    this.heroFlag.visible = false; scene.add(this.heroFlag);
    // cadavres de soldats (rig fondu) et de géants
    this.soldierDead = new FadeRig(scene, footParts(PALETTES.soldier, 0), 80); this.golemDead = new FadeRig(scene, golemParts(), 8); this.corpses = [];
    // villageois de la placette (assis, qui bavardent) et enfants qui courent
    this.folk = new Rig(scene, villagerParts(VILLAGER_STYLES.idle), 24); this.folk.blob = 0.8;
    this.folkList = Array.from({ length: 9 }, (_, k) => ({ x: PLAZA.x - 20 + k * 5 + (k % 2) * 1.5, z: PLAZA.z + 7 + (k % 3) * 1.2, ph: k * 1.7, sit: k % 3 !== 1 }));
    this.kids = Array.from({ length: 5 }, (_, k) => ({ cx: 60 + k * 22, cz: 232 + (k % 2) * 30, r: 4 + k % 3, ph: k * 2.1 }));
    // charrettes (routes pavées)
    const cart = mergeGeometries([new THREE.BoxGeometry(1.6, 0.6, 2.4).translate(0, 0.9, 0), new THREE.CylinderGeometry(0.5, 0.5, 0.14, 10).rotateZ(Math.PI / 2).translate(-0.85, 0.5, 0.4), new THREE.CylinderGeometry(0.5, 0.5, 0.14, 10).rotateZ(Math.PI / 2).translate(0.85, 0.5, 0.4), new THREE.BoxGeometry(0.1, 0.1, 1.8).translate(0, 0.8, -2), new THREE.SphereGeometry(0.5, 6, 4).scale(1.4, 0.6, 1).translate(0, 1.4, 0)].map(g => g.toNonIndexed()));
    this.carts = mk(cart, lam(0x7a4f2a), 6);
    // oiseaux (petits V qui battent des ailes) et cerfs
    const bird = new THREE.BufferGeometry(); bird.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.2, -0.7, 0.15, -0.1, 0, 0, -0.1, 0, 0, 0.2, 0, 0, -0.1, 0.7, 0.15, -0.1], 3)); bird.computeVertexNormals();
    this.birdM = mk(bird, lam(0x1e1c1a, { side: THREE.DoubleSide }), 40); this.birdM.castShadow = false;
    this.birds = Array.from({ length: 40 }, (_, k) => ({ a: k * 0.6, r: 14 + (k % 7) * 3, cx: k < 20 ? -30 : W + 30, cz: 60 + (k % 5) * 25, h: 14 + (k % 4) * 3, fl: 0 }));
    const deer = mergeGeometries([new THREE.BoxGeometry(0.55, 0.6, 1.4).translate(0, 1.15, 0), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => new THREE.CylinderGeometry(0.06, 0.05, 0.9, 4).translate(sx * 0.2, 0.45, sz * 0.5))), new THREE.BoxGeometry(0.22, 0.6, 0.25).rotateX(-0.6).translate(0, 1.55, 0.75), new THREE.BoxGeometry(0.24, 0.24, 0.45).translate(0, 1.85, 0.95), new THREE.BoxGeometry(0.04, 0.5, 0.04).rotateZ(0.4).translate(-0.12, 2.2, 0.85), new THREE.BoxGeometry(0.04, 0.5, 0.04).rotateZ(-0.4).translate(0.12, 2.2, 0.85)].map(g => g.toNonIndexed()));
    this.deerM = mk(deer, lam(0x8a6040), 10);
    this.deer = Array.from({ length: 10 }, (_, k) => { const left = k % 2 === 0, x = left ? -12 - (k % 3) * 6 : W + 12 + (k % 3) * 6, z = 40 + k * 15; return { x, z, hx: x, hz: z, ry: left ? Math.PI / 2 : -Math.PI / 2, run: 0, ph: k }; });
    // météo : pluie (traits) et neige (flocons) qui suivent la caméra
    this.rain = new Particles(scene, 900); this.weatherT = 0;
    // crachats d'acide
    this.spitM = mk(new THREE.SphereGeometry(0.28, 6, 4), new THREE.MeshBasicMaterial({ color: 0xa8ff4a }), 40); this.spitM.castShadow = false;
    this.lastN = new Map();
  }
  buildCastleMoat() {
    const hw = 24, hd = 19, w = 4, x0 = CASTLE.x, z0 = CASTLE.z - 1, shape = new THREE.Shape([new THREE.Vector2(-hw - w, -hd - w), new THREE.Vector2(hw + w, -hd - w), new THREE.Vector2(hw + w, hd + w), new THREE.Vector2(-hw - w, hd + w)]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(-hw, -hd), new THREE.Vector2(-hw, hd), new THREE.Vector2(hw, hd), new THREE.Vector2(hw, -hd)]));
    const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2);
    const bank = new THREE.Mesh(g.clone(), lam(0x4a3a28)); bank.position.set(x0, 0.02, z0); bank.scale.set(1.04, 1, 1.05); this.scene.add(bank);   // berges de terre
    const water = new THREE.Mesh(g, this.water); water.position.set(x0, 0.09, z0); water.renderOrder = 2; this.scene.add(water); water.receiveShadow = true;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, w + 3), lam(0x6b4a2c)); bridge.position.set(x0, 0.3, z0 + hd + w / 2); bridge.castShadow = bridge.receiveShadow = true; this.scene.add(bridge);   // pont-levis
    for (const sx of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), lam(0x3a3c42)); ch.position.set(x0 + sx * 2, 3, z0 + hd + 1.2); ch.rotation.x = 0.55; this.scene.add(ch); }
  }
  rebuildMoats() {
    const X = this.sim.extras; const key = [...X.moat].join(); if (key === this.moatKey) return; this.moatKey = key;
    for (const m of this.moatMeshes) { this.scene.remove(m); m.geometry.dispose(); } this.moatMeshes = [];
    for (let s = 0; s < SECTORS; s++) { const lv = X.moat[s]; if (!lv) continue;
      const pts = [], N = 12; for (let k = 0; k <= N; k++) { const x = s * SECTOR_W + k * SECTOR_W / N, [a, b] = moatBand(x); pts.push(x, 0, a, x, 0, b); }
      const g = new THREE.BufferGeometry(), idx = []; for (let k = 0; k < N; k++) { const o = k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
      const uv = []; for (let k = 0; k <= N; k++) uv.push(k / N * 4, 0, k / N * 4, 1); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const dirt = new THREE.Mesh(g, lam(0x3e3022)); dirt.position.y = 0.04; this.scene.add(dirt); this.moatMeshes.push(dirt);
      if (lv >= 2) { const wm = new THREE.Mesh(g.clone(), this.water); wm.position.y = 0.1; wm.renderOrder = 2; this.scene.add(wm); this.moatMeshes.push(wm); }
      if (lv >= 3) { const st = []; for (let x = s * SECTOR_W + 1.5; x < (s + 1) * SECTOR_W; x += 2.2) { const [a, b] = moatBand(x); for (const zz of [a + 1.2, b - 1.2]) st.push(new THREE.ConeGeometry(0.12, 1.4, 4).rotateX(zz < (a + b) / 2 ? 0.5 : -0.5).translate(x, 0.6, zz).toNonIndexed()); }
        const sm = new THREE.Mesh(mergeGeometries(st), lam(0x6a5038)); this.scene.add(sm); this.moatMeshes.push(sm); } }
  }
  update(dt, alpha) {
    const sim = this.sim, X = sim.extras, Z = sim.zombies, d = this.d, c = this.c; this.t += dt; const t = this.t;
    this.water.userData.n.offset.set(t * 0.02, t * 0.013);
    // poussière des hordes qui chargent + traces au sol
    // (v4.1) poussière très discrète : un zombie sur cinq, rarement, voile léger
    for (let i = 0; i < Z.n; i += 5) { if (!Z.rush[i] || Z.state[i] === 1 || Math.random() > dt * 0.9) continue; const x = Z.x[i], z = Z.z[i]; this.dust.add({ x: x + (Math.random() - 0.5), y: 0.25, z, vx: (Math.random() - 0.5) * 0.5, vy: 0.4 + Math.random() * 0.3, vz: -0.5, t: 0, life: 1.2, a: 0.14, r: 0.62, gr: 0.55, b: 0.45, s: 1.0, grow: 1.2 }); if (Math.random() < 0.08) this.decals.add(x, z, 'dirt', 1 + Math.random() * 0.6, 12); }
    // fumées : cheminées des maisons de niveau 2+, forge, Travaux publics, château
    this.smokeT = (this.smokeT || 0) + dt;
    if (this.smokeT > 0.25) { this.smokeT = 0;
      for (const s of sim.build.items) { if (s.state !== 'built') continue; const h = s.type === 'house' ? (s.level >= 2 ? [8, 10, 11.5][s.level - 2] : 0) : s.type === 'forge' ? 7 : s.type === 'publicworks' ? 7.2 : 0; if (!h || Math.random() > 0.5) continue;
        this.smoke.add({ x: s.x + (s.type === 'house' ? -1.8 : 2), y: h, z: s.z - 0.8, vx: 0.3 + Math.random() * 0.2, vy: 0.9 + Math.random() * 0.4, vz: -0.1, t: 0, life: 5, a: 0.28, r: 0.78, gr: 0.78, b: 0.8, s: 1.2, grow: 3 }); }
      if (Math.random() < 0.6) this.smoke.add({ x: CASTLE.x + 13.5, y: 13, z: CASTLE.z + 1, vx: 0.3, vy: 1, vz: 0, t: 0, life: 6, a: 0.25, r: 0.75, gr: 0.75, b: 0.78, s: 1.6, grow: 3 }); }
    // sang sous les zombies tombés, poussière d'explosion
    for (const b of sim.blasts) { if (b.seenX) continue; b.seenX = 1; if (b.kind === 'boom') for (let k = 0; k < 14; k++) this.dust.add({ x: b.x, y: 1, z: b.z, vx: (Math.random() - 0.5) * 8, vy: 2 + Math.random() * 4, vz: (Math.random() - 0.5) * 8, g: 6, t: 0, life: 1.4, a: 0.5, r: 0.55, gr: 0.6, b: 0.25, s: 2, grow: 2 }); }
    for (const cp of this.rd.corpses || []) if (!cp.bl) { cp.bl = 1; this.decals.add(cp.x, cp.z, 'blood', 1.4 + Math.random() * 1.2, 26); }
    // cadavres de soldats (pertes des escouades) et de géants
    for (const f of sim.fallenUnits.splice(0)) { this.corpses.push({ ...f, t0: t, golem: false }); this.decals.add(f.x, f.z, 'blood', 1.6, 30); }
    this.soldierDead.begin(); this.golemDead.begin();
    for (let j = this.corpses.length - 1; j >= 0; j--) { const cp = this.corpses[j], a = t - cp.t0, FALL = 0.6, LIE = 5, FADE = 1.4; if (a > FALL + LIE + FADE) { this.corpses.splice(j, 1); continue; }
      const e = Math.min(1, a / FALL), sc = cp.golem ? ZOMBIES[cp.boss ? 7 : 6].size * 1.75 * 1.8 / 2.95 : 1.75 * 0.6, fade = a < FALL + LIE ? 1 : 1 - (a - FALL - LIE) / FADE;
      d.position.set(cp.x, 0.05, cp.z); d.rotation.set(-1.45 * e * e, cp.rot, 0, 'YXZ'); d.scale.setScalar(sc); d.updateMatrix(); c.setScalar(0.7);
      (cp.golem ? this.golemDead : this.soldierDead).pushFade(d.matrix, c, [0, 0.3, -0.2, -1.2, -0.6, 0.4], fade); }
    this.soldierDead.end(); this.golemDead.end();
    // villageois de la placette et enfants
    this.folk.begin();
    if (sim.phase !== 'assault') for (const f of this.folkList) { d.position.set(f.x, f.sit ? -0.32 : 0, f.z); d.rotation.set(0, Math.PI + Math.sin(t * 0.3 + f.ph) * 0.4, 0); d.scale.setScalar(1.75); d.updateMatrix(); this.folk.push(d.matrix, c.setScalar(1), [0, f.sit ? -1.4 : 0, f.sit ? -1.4 : 0, -0.3 + 0.4 * Math.max(0, Math.sin(t * 2 + f.ph))]); }
    if (sim.phase !== 'assault') for (const k of this.kids) { const a = t * 1.6 + k.ph, x = k.cx + Math.cos(a) * k.r, z = k.cz + Math.sin(a) * k.r * 0.7, sw = Math.sin(t * 12 + k.ph) * 0.8; d.position.set(x, Math.abs(Math.sin(t * 12 + k.ph)) * 0.12, z); d.rotation.set(0, -a, 0); d.scale.setScalar(1.05); d.updateMatrix(); this.folk.push(d.matrix, c.setRGB(1, 0.9, 0.8), [0, sw, -sw, sw]); }
    this.folk.end();
    // charrettes : seulement sur des routes pavées (Travaux publics niv. 3), en aller-retour
    { let n = 0; const R = sim.roads; if (R.quality(sim) >= 3) for (const r of R.list) { if (n >= 6 || r.kind !== 'base' || r.built < 1) continue; const L = Math.hypot(r.x1 - r.x0, r.z1 - r.z0); if (L < 30) continue; const f = (Math.sin(t * 6 / L + r.id) + 1) / 2, x = r.x0 + (r.x1 - r.x0) * f, z = r.z0 + (r.z1 - r.z0) * f; if (z < 212 && z > 140) continue; d.position.set(x + 1.2, 0, z); d.rotation.set(0, Math.atan2(r.x1 - r.x0, r.z1 - r.z0), 0); d.scale.setScalar(1); d.updateMatrix(); this.carts.setMatrixAt(n++, d.matrix); }
      this.carts.count = n; this.carts.instanceMatrix.needsUpdate = true; }
    // oiseaux : tournent au-dessus des forêts ; s'envolent quand la horde est là
    const scare = sim.phase === 'assault' && Z.n > 15;
    this.birds.forEach((b, k) => { b.fl = Math.max(0, Math.min(1, b.fl + (scare ? dt * 0.4 : -dt * 0.1))); b.a += dt * (0.4 + 0.3 * b.fl); const x = b.cx + Math.cos(b.a) * b.r * (1 + b.fl * 3), z = b.cz + Math.sin(b.a) * b.r - b.fl * 120, y = b.h + b.fl * 40 + Math.sin(t * 2 + k) * 1.2;
      d.position.set(x, y, z); d.rotation.set(0, -b.a, Math.sin(t * 14 + k) * 0.6); d.scale.setScalar(1.2); d.updateMatrix(); this.birdM.setMatrixAt(k, d.matrix); });
    this.birdM.count = 40; this.birdM.instanceMatrix.needsUpdate = true;
    // cerfs : broutent à l'orée ; s'enfuient si des zombies approchent
    this.deer.forEach((e, k) => { let near = false; for (let i = 0; i < Z.n; i += 3) if (Math.abs(Z.x[i] - e.x) < 30 && Math.abs(Z.z[i] - e.z) < 30) { near = true; break; }
      if (near) e.run = 1; if (e.run > 0) { e.run -= dt * 0.15; const dir = e.hx < 0 ? -1 : 1; e.x += dir * dt * 9; e.ry = dir < 0 ? -Math.PI / 2 : Math.PI / 2; if (e.run <= 0) { e.x = e.hx; e.z = e.hz; } }
      const graze = e.run > 0 ? 0 : (Math.sin(t * 0.5 + e.ph) > 0 ? 0.5 : 0); d.position.set(e.x, e.run > 0 ? Math.abs(Math.sin(t * 9 + k)) * 0.3 : 0, e.z); d.rotation.set(graze * 0.3, e.ry + (e.run > 0 ? 0 : Math.sin(t * 0.2 + k) * 0.6), 0); d.scale.setScalar(1.3); d.updateMatrix(); this.deerM.setMatrixAt(k, d.matrix); });
    this.deerM.count = 10; this.deerM.instanceMatrix.needsUpdate = true;
    // pièges
    const cnt = { spikes: 0, caltrops: 0, pitch: 0 };
    for (const tp of X.traps) { const im = this.trapM[tp.kind]; if (!im || cnt[tp.kind] >= 40 || (tp.kind === 'pitch' && tp.lit)) continue; d.position.set(tp.x, tp.kind === 'spikes' && tp.uses <= 0 ? -0.3 : 0, tp.z); d.rotation.set(0, tp.id, 0); d.scale.setScalar(1); d.updateMatrix(); im.setMatrixAt(cnt[tp.kind]++, d.matrix); }
    for (const k in this.trapM) { this.trapM[k].count = cnt[k]; this.trapM[k].instanceMatrix.needsUpdate = true; }
    // palissade
    { let n = 0; for (let s = 0; s < SECTORS; s++) { const hp = X.pal[s] / EXTRA.palisade.hp; if (hp <= 0 && !(X.palWork[s] > 0)) continue; const building = X.palWork[s] > 0, frac = building ? 1 - X.palWork[s] / EXTRA.palisade.time : 1;
        for (let k = 0; k < 40; k++) { if (k / 40 > frac) break; if (!building && hp < 0.5 && (k * 7 + s) % 5 === 0) continue; const x = s * SECTOR_W + 0.5 + k; d.position.set(x, 0, palZ(x)); d.rotation.set((k % 3 - 1) * 0.06, 0, (k % 2 ? 0.05 : -0.04)); d.scale.set(1, 0.85 + ((k * 13) % 7) * 0.04, 1); d.updateMatrix(); this.stakes.setMatrixAt(n, d.matrix); this.stakes.setColorAt(n, c.setHex(0x7a5a3a).lerp(this.c2 || (this.c2 = new THREE.Color(0x3a2a1a)), building ? 0.4 : 1 - hp)); n++; } }
      this.stakes.count = n; this.stakes.instanceMatrix.needsUpdate = true; if (this.stakes.instanceColor) this.stakes.instanceColor.needsUpdate = true; }
    this.rebuildMoats();
    // héros
    const h = X.hero, hq = h && sim.army.squads.find(q => q.id === h.sq); this.heroFlag.visible = !!hq; if (hq) { this.heroFlag.position.set(hq.x + hq.rad * 0.6, 0, hq.z); this.heroFlag.children[1].rotation.y = Math.sin(t * 3) * 0.25; this.heroFlag.children[2].material.emissive.setHex(X.rally > 0 ? 0xffc040 : 0x6a5010); }
    // crachats d'acide
    { let n = 0; for (const sp of X.spits) { if (n >= 40) break; const f = Math.min(1, sp.t / 0.9); d.position.set(sp.x0 + (sp.x1 - sp.x0) * f, 1.4 + Math.sin(Math.PI * f) * 4, sp.z0 + (sp.z1 - sp.z0) * f); d.scale.setScalar(1); d.rotation.set(0, 0, 0); d.updateMatrix(); this.spitM.setMatrixAt(n++, d.matrix); if (f > 0.95 && !sp.hit) { sp.hit = 1; for (let k = 0; k < 6; k++) this.fx.add({ x: sp.x1, y: 2, z: sp.z1, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, g: 6, t: 0, life: 0.8, a: 0.8, r: 0.6, gr: 1, b: 0.2, s: 0.7 }); } }
      this.spitM.count = n; this.spitM.instanceMatrix.needsUpdate = true; }
    // météo : particules autour de la cible de caméra
    const wx = X.weather, cam = this.rd.camera.position, cx = this.rd.camCenter ? this.rd.camCenter.x : cam.x, cz = this.rd.camCenter ? this.rd.camCenter.z : cam.z - 40;
    if (wx === 'rain' || wx === 'snow') { const k = wx === 'rain' ? 60 : 30; for (let q = 0; q < k * dt * 10; q++) this.rain.add(wx === 'rain' ? { x: cx + (Math.random() - 0.5) * 140, y: 30 + Math.random() * 20, z: cz + (Math.random() - 0.5) * 110, vx: 2, vy: -38, vz: 4, t: 0, life: 1.2, a: 0.45, r: 0.75, gr: 0.82, b: 0.95, s: 0.35 } : { x: cx + (Math.random() - 0.5) * 140, y: 25 + Math.random() * 15, z: cz + (Math.random() - 0.5) * 110, vx: 1.2 + Math.sin(t + q) * 0.6, vy: -3.2, vz: 0.6, t: 0, life: 9, a: 0.9, r: 1, gr: 1, b: 1, s: 0.6 }); }
    for (const p of [this.dust, this.smoke, this.fx, this.rain]) p.update(dt); this.decals.update(dt);
  }
}
