// Feux de bois (v9.8) : beaucoup de feux de camp dans le village et la cour, et une équipe d'ALLUMEURS autonomes
// (villageois hors quota, qu'on ne commande pas) qui font la tournée : ils prennent des bûches au tas, ravivent les feux
// qui faiblissent et les allument tous à la tombée de la nuit, une torche à la main. Purement visuel : la simulation
// n'en dépend pas. Un feu dont l'emplacement est couvert par un bâtiment disparaît simplement.
// Contient aussi FlameSet, les flammes réutilisées pour les palissades et les zombies en feu.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CASTLE, PLAZA } from '../sim/constants.js';
import { STREAM, STRUCT } from '../content/medieval.js';
import { applyNorthFog } from './fog.js';
import { Rig, villagerParts } from './Troops.js';

const lam = (c, o = {}) => applyNorthFog(new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o }));
const strip = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g; };
function grad(w, h, stops, radial) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const r = radial ? g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2) : g.createLinearGradient(0, h, 0, 0);
  for (const [o, col] of stops) r.addColorStop(o, col); g.fillStyle = r; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let TEX = null;
const tex = () => TEX || (TEX = {
  flame: grad(8, 64, [[0, 'rgba(255,245,210,1)'], [0.3, 'rgba(255,185,80,.95)'], [0.7, 'rgba(230,80,20,.55)'], [1, 'rgba(120,20,0,0)']]),
  glow: grad(64, 64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']], true),
});

// ——— flammes instanciées : trois langues croisées en dégradé, un cœur jaune, un halo au sol ———
export class FlameSet {
  constructor(scene, cap, glow = true) {
    const tongue = (r, h, a) => new THREE.ConeGeometry(r, h, 6, 1, true).translate(0, h / 2, 0).rotateY(a);
    const g = mergeGeometries([tongue(0.34, 0.95, 0), tongue(0.26, 1.2, 1.1).translate(0.07, 0, 0.04), tongue(0.22, 0.8, 2.2).translate(-0.08, 0, -0.03), tongue(0.18, 0.7, 3.0).translate(0.02, 0, -0.08)].map(strip));
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    this.tongues = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xf07a28, map: tex().flame, side: THREE.DoubleSide, opacity: 0.8, ...add }), cap);
    this.core = new THREE.InstancedMesh(strip(new THREE.ConeGeometry(0.16, 0.55, 6).translate(0, 0.27, 0)), new THREE.MeshBasicMaterial({ color: 0xffe08a, opacity: 0.9, ...add }), cap);
    this.glow = glow ? new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff9a40, map: tex().glow, opacity: 0.5, ...add }), cap) : null;
    for (const m of [this.tongues, this.core, this.glow]) if (m) { m.frustumCulled = false; m.count = 0; m.renderOrder = 4; scene.add(m); }
    this.cap = cap; this.n = 0; this.d = new THREE.Object3D(); this.t = 0;
  }
  begin(t) { this.n = 0; this.t = t; }
  // s : taille ; ph : phase (vacillement) ; g : intensité du halo (0 = aucun)
  add(x, y, z, s, ph, g = 0) {
    if (this.n >= this.cap) return; const d = this.d, t = this.t, i = this.n++, k = 0.85 + 0.22 * Math.sin(t * 9 + ph) + 0.12 * Math.sin(t * 23 + ph * 2);
    d.position.set(x, y, z); d.rotation.set(0.07 * Math.sin(t * 5 + ph), t * 1.4 + ph, 0.07 * Math.cos(t * 6 + ph)); d.scale.set(s, s * k, s); d.updateMatrix(); this.tongues.setMatrixAt(i, d.matrix);
    d.scale.set(s, s * (0.75 + 0.35 * k), s); d.updateMatrix(); this.core.setMatrixAt(i, d.matrix);
    if (this.glow) { d.position.set(x, 0.05, z); d.rotation.set(0, 0, 0); const gs = Math.max(1e-3, g * s * 7 * (0.92 + 0.08 * k)); d.scale.set(gs, 1, gs); d.updateMatrix(); this.glow.setMatrixAt(i, d.matrix); }
  }
  end() { for (const m of [this.tongues, this.core, this.glow]) if (m) { m.count = this.n; m.instanceMatrix.needsUpdate = true; } }
}

// tenue des allumeurs : tunique rouge brique, tablier de cuir, tête nue
const KEEPER = { tunic: 0x8a3a24, apron: 0x5a3a22, legs: 0x3a2e24, hat: () => [], tool: 'none' };

export class Campfires {
  constructor(scene, sim, fx, smoke) {
    this.scene = scene; this.sim = sim; this.fx = fx; this.smoke = smoke; let sd = 5150; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    // emplacements : grille irrégulière dans le village et la cour, loin du château, du ruisseau, de la placette et des routes de départ
    const near = (x, z, r) => STREAM.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < r);
    this.sites = [];
    for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 9; gx++) {
      const x = 12 + gx * 22 + (rn() - 0.5) * 10, z = 208 + gz * 19 + (rn() - 0.5) * 9;
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 36 || near(x, z, 6) || (Math.abs(x - PLAZA.x) < PLAZA.hw + 3 && Math.abs(z - PLAZA.z) < PLAZA.hd + 6) || Math.abs(x - 100) < 4) continue;
      this.sites.push({ x, z, fuel: rn() * 0.8, lit: rn() < 0.35, claim: 0, free: true, ph: rn() * 6 });
    }
    for (let k = 0; k < 10; k++) { const x = 14 + k * 19 + (rn() - 0.5) * 6, z = 172 + (rn() - 0.5) * 8; if (Math.abs(x - 100) < 9) continue; this.sites.push({ x, z, fuel: rn(), lit: rn() < 0.5, claim: 0, free: true, ph: rn() * 6 }); }
    // tas de bûches où l'équipe se ravitaille
    this.depots = [[56, 214], [146, 214], [72, 262], [128, 262], [100, 176]];
    // modèles : foyer (cercle de pierres + bûches en tipi) et tas de bûches
    const stones = [], logs = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; stones.push(strip(new THREE.DodecahedronGeometry(0.22, 0).scale(1, 0.6, 1).translate(Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75))); }
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, g = new THREE.CylinderGeometry(0.07, 0.09, 1.0, 6); g.rotateZ(0.55); g.translate(0.22, 0.38, 0); g.rotateY(a); logs.push(strip(g)); }
    const im = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; };
    this.stoneM = im(mergeGeometries(stones), lam(0x7a766e), this.sites.length); this.logM = im(mergeGeometries(logs), lam(0x4a3220), this.sites.length);
    this.ashM = im(strip(new THREE.CircleGeometry(0.62, 12).rotateX(-Math.PI / 2).translate(0, 0.03, 0)), lam(0x2a2420), this.sites.length);
    const pile = []; for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) pile.push(strip(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 7).rotateZ(Math.PI / 2).translate(0, 0.16 + r * 0.29, (k - (3 - r) / 2) * 0.33)));
    this.pileM = im(mergeGeometries(pile), lam(0x7a5232), this.depots.length);
    // allumeurs (hors quota) : un modèle de villageois en tunique rouge, des bûches portées sur l'épaule, une torche la nuit
    const N = 14; this.keepers = Array.from({ length: N }, (_, k) => { const [dx, dz] = this.depots[k % this.depots.length]; return { x: dx + (rn() - 0.5) * 4, z: dz + (rn() - 0.5) * 4, ang: 0, st: 'idle', t: rn() * 2, target: -1, carry: false, ph: rn() * 6, sp: 2.6 + rn() * 0.9 }; });
    this.rig = new Rig(scene, villagerParts(KEEPER), N); this.rig.blob = 0.8;
    this.bundleM = im(strip(mergeGeometries([0, 1, 2].map(k => strip(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6).rotateZ(Math.PI / 2).translate(0, k * 0.12, (k % 2) * 0.1))))), lam(0x6b4a2c), N);
    this.torchM = im(strip(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 5)), lam(0x3a2a1c), N);
    this.flames = new FlameSet(scene, this.sites.length + N + 4);
    this.d = new THREE.Object3D(); this.t = 0; this.freeT = 0;
  }
  // emplacements recouverts par un bâtiment : feu masqué, l'équipe l'ignore
  refreshFree() {
    const B = this.sim.build.items;
    for (const s of this.sites) s.free = !B.some(b => { const S = STRUCT[b.type], sz = S && S.size ? Math.max(S.size[0], S.size[2]) / 2 + 2 : 5; return Math.abs(b.x - s.x) < sz && Math.abs(b.z - s.z) < sz; });
    for (const s of this.sites) if (!s.free) { s.lit = false; s.claim = 0; }
  }
  update(dt, t) {
    const sim = this.sim, L = sim.night.light(), d = this.d, sp = sim.speed || 0, gdt = dt * Math.min(sp, 4), night = L < 0.62; this.t = t;
    if ((this.freeT -= dt) <= 0) { this.freeT = 1.5; this.refreshFree(); }
    const want = night ? 1 : 0.3, assault = sim.phase === 'assault';
    // les feux se consument (plus vite le jour : ce sont des feux de cuisine)
    let lit = 0, nFree = 0; for (const s of this.sites) { if (!s.free) continue; nFree++; if (s.lit) { s.fuel -= gdt / (night ? 150 : 70); if (s.fuel <= 0) { s.fuel = 0; s.lit = false; } else lit++; } }
    // allumeurs : chercher des bûches → aller au feu le plus utile → l'attiser/allumer → recommencer
    for (const k of this.keepers) {
      if (!sp) break;
      if (k.st === 'idle') { k.t -= gdt; if (k.t > 0) continue;
        const needLit = lit < want * nFree; let best = -1, bs = -1e9;
        this.sites.forEach((s, i) => { if (!s.free || s.claim) return; const sc = (s.lit ? (s.fuel < 0.35 ? 40 : -1e9) : needLit ? 60 : -1e9) - Math.hypot(s.x - k.x, s.z - k.z) * 0.6 + (s.ph % 1) * 8; if (sc > bs) { bs = sc; best = i; } });
        if (best < 0) { k.t = 1.5 + Math.random() * 2; k.wander = [k.x + (Math.random() - 0.5) * 10, k.z + (Math.random() - 0.5) * 10]; k.st = 'stroll'; continue; }
        this.sites[best].claim = 1; k.target = best; const dp = this.depots.reduce((a, p) => Math.hypot(p[0] - k.x, p[1] - k.z) < Math.hypot(a[0] - k.x, a[1] - k.z) ? p : a); k.goal = [dp[0] + (Math.random() - 0.5), dp[1] + 1.2]; k.st = 'fetch'; }
      const go = (gx, gz, next) => { const dx = gx - k.x, dz = gz - k.z, l = Math.hypot(dx, dz); if (l < 0.6) { k.st = next; k.t = 0; return; } const v = Math.min(l, k.sp * gdt); k.x += dx / l * v; k.z += dz / l * v; k.ang = Math.atan2(dx, dz); };
      if (k.st === 'stroll') { go(k.wander[0], k.wander[1], 'idle'); if (k.st === 'idle') k.t = 1 + Math.random() * 2; }
      else if (k.st === 'fetch') go(k.goal[0], k.goal[1], 'load');
      else if (k.st === 'load') { k.t += gdt; if (k.t > 1.2) { k.carry = true; k.st = 'carry'; } }
      else if (k.st === 'carry') { const s = this.sites[k.target]; if (!s || !s.free) { k.carry = false; k.st = 'idle'; if (s) s.claim = 0; continue; } go(s.x + 0.9, s.z + 0.6, 'tend'); }
      else if (k.st === 'tend') { const s = this.sites[k.target]; k.t += gdt; k.ang = Math.atan2(s.x - k.x, s.z - k.z); if (k.t > 2.2) { s.fuel = 1; if (!s.lit) { s.lit = true; for (let q = 0; q < 14; q++) this.fx.add({ x: s.x, y: 0.4, z: s.z, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 2, t: 0, life: 0.8, a: 1, r: 1, gr: 0.6, b: 0.2, s: 0.35, g: 2 }); } s.claim = 0; k.carry = false; k.st = 'idle'; k.t = 0.5 + Math.random(); } }
    }
    // dessin : foyers, flammes, fumée, étincelles
    this.flames.begin(t); let n = 0, ns = 0;
    this.sites.forEach((s, i) => {
      if (!s.free) return; d.position.set(s.x, 0, s.z); d.rotation.set(0, s.ph, 0); d.scale.setScalar(1); d.updateMatrix();
      this.stoneM.setMatrixAt(ns, d.matrix); this.ashM.setMatrixAt(ns, d.matrix); d.scale.setScalar(s.lit ? 0.75 + 0.35 * s.fuel : 0.85); d.updateMatrix(); this.logM.setMatrixAt(ns, d.matrix); ns++;
      if (!s.lit) { if (s.fuel <= 0 && Math.random() < dt * 0.4) this.smoke.add({ x: s.x, y: 0.3, z: s.z, vx: 0.2, vy: 0.5, vz: 0, t: 0, life: 3, a: 0.18, r: 0.5, gr: 0.5, b: 0.5, s: 0.8, grow: 1.5 }); return; }
      const sz = (0.75 + 0.6 * s.fuel) * (night ? 1.1 : 0.85); this.flames.add(s.x, 0.12, s.z, sz, s.ph, night ? 1 : 0.25);
      if (Math.random() < dt * (night ? 5 : 2)) this.fx.add({ x: s.x + (Math.random() - 0.5) * 0.4, y: 0.9 * sz, z: s.z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 0.6, vy: 1.6 + Math.random() * 1.8, vz: (Math.random() - 0.5) * 0.6, t: 0, life: 1.2 + Math.random(), a: 1, r: 1, gr: 0.62, b: 0.22, s: 0.16 });
      if (Math.random() < dt * 1.2) this.smoke.add({ x: s.x, y: 1.3 * sz, z: s.z, vx: 0.35, vy: 0.8, vz: 0.1, t: 0, life: 4, a: 0.22, r: 0.42, gr: 0.4, b: 0.4, s: 0.9, grow: 2.2 });
    });
    for (const m of [this.stoneM, this.ashM, this.logM]) { m.count = ns; m.instanceMatrix.needsUpdate = true; }
    this.depots.forEach(([x, z], i) => { d.position.set(x, 0, z); d.rotation.set(0, i * 0.7, 0); d.scale.setScalar(1); d.updateMatrix(); this.pileM.setMatrixAt(i, d.matrix); }); this.pileM.instanceMatrix.needsUpdate = true;
    // allumeurs (cachés pendant les vagues : ils se mettent à l'abri)
    this.rig.begin(); let nb = 0, nt = 0;
    if (!assault) for (const k of this.keepers) {
      const moving = k.st === 'fetch' || k.st === 'carry' || k.st === 'stroll', kneel = k.st === 'tend' || k.st === 'load', sw = moving && sp ? Math.sin(t * 9 + k.ph) * 0.7 : 0;
      d.position.set(k.x, kneel ? -0.25 : 0, k.z); d.rotation.set(0, k.ang, 0); d.scale.setScalar(1.75); d.updateMatrix();
      this.rig.push(d.matrix, this.white || (this.white = new THREE.Color(1, 1, 1)), [0, kneel ? -1.2 : sw, kneel ? 0.2 : -sw, kneel ? -1.1 + 0.3 * Math.sin(t * 6 + k.ph) : (k.carry ? -2.6 : sw * 0.8)]);
      const ca = Math.cos(k.ang), sa = Math.sin(k.ang);
      if (k.carry) { d.position.set(k.x + ca * 0.55 * 1.75 * 0.3, 1.75 * 1.55, k.z - sa * 0.55 * 1.75 * 0.3); d.rotation.set(0, k.ang + Math.PI / 2, 0); d.scale.setScalar(1); d.updateMatrix(); this.bundleM.setMatrixAt(nb++, d.matrix); }
      if (night) { const hx = k.x - ca * 0.6 + sa * 0.5, hz = k.z + sa * 0.6 + ca * 0.5; d.position.set(hx, 1.75, hz); d.rotation.set(0.25, k.ang, 0); d.scale.setScalar(1); d.updateMatrix(); this.torchM.setMatrixAt(nt++, d.matrix); this.flames.add(hx, 2.1, hz, 0.32, k.ph, 0.45); }
    }
    this.rig.end(); this.bundleM.count = nb; this.torchM.count = nt; this.bundleM.instanceMatrix.needsUpdate = true; this.torchM.instanceMatrix.needsUpdate = true;
    this.flames.end();
  }
}
