// Effets visuels : PURE VUE. Ne modifie jamais src/sim/ : lit l'état (flèches, projectiles, explosions `sim.blasts`, feux au sol,
// zombies tués, tronçons de muraille) et compare aux valeurs de l'image précédente.
// Deux pools fixes (aucune création/destruction par image) : particules opaques (débris, poussière, fumée) et ADDITIVES (feu, magie).
// Plus : ondes de choc (anneaux), traces de brûlure au sol, éclairs (segments), lueurs, secousse de caméra.
import * as THREE from 'three';
import { MAX_Z, SEGS, SEG_W, WALL_Z0 } from '../sim/constants.js';
import { quality } from './config.js';

// Interrupteur global : EFFECTS.enabled = false, ou ajouter ?fx=0 à l'URL, coupe tous les effets (aucun coût CPU hors comparaison).
export const EFFECTS = { enabled: !(typeof location !== 'undefined' && /[?&]fx=0\b/.test(location.search)) };

const PENDING = 96, MAX_EMIT_PER_FRAME = 40;
const TMP = new THREE.Color();
const FLASH = [1, 0.62, 0.25];
const COL = {
  spark: [0.78, 0.72, 0.6], shard: [0.45, 0.85, 0.3], dust: [0.78, 0.74, 0.66], debris: [0.42, 0.4, 0.38], smoke: [0.24, 0.22, 0.22], smokeL: [0.55, 0.52, 0.5],
  fire: [1, 0.45, 0.08], fireY: [1, 0.78, 0.2], ember: [1, 0.85, 0.4], frost: [0.55, 0.85, 1], frostW: [0.9, 0.97, 1], magic: [0.7, 0.35, 1], magicL: [0.9, 0.7, 1],
  heal: [0.35, 1, 0.45], healL: [0.8, 1, 0.6], bolt: [0.75, 0.85, 1], stone: [0.75, 0.8, 0.95],
};

// ——— pool de particules (structure de tableaux typés, un InstancedMesh) ———
class Pool {
  constructor(scene, cap, geo, mat) {
    this.cap = cap; this.next = 0;
    this.px = new Float32Array(cap); this.py = new Float32Array(cap); this.pz = new Float32Array(cap);
    this.vx = new Float32Array(cap); this.vy = new Float32Array(cap); this.vz = new Float32Array(cap);
    this.life = new Float32Array(cap); this.maxLife = new Float32Array(cap); this.size = new Float32Array(cap); this.grav = new Float32Array(cap); this.grow = new Float32Array(cap);
    this.col = new Float32Array(cap * 3); this.base = new Float32Array(cap * 3);
    this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.col, 3); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
    this.d = new THREE.Object3D(); this.fade = false;
  }
  emit(x, y, z, vx, vy, vz, life, size, grav, rgb, grow = 0) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = this.maxLife[i] = life; this.size[i] = size; this.grav[i] = grav; this.grow[i] = grow;
    this.base[i * 3] = rgb[0]; this.base[i * 3 + 1] = rgb[1]; this.base[i * 3 + 2] = rgb[2];
  }
  update(dt) {
    const d = this.d, m = this.mesh; let n = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; if (this.life[i] <= 0) continue;
      this.vy[i] -= this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0) { this.py[i] = 0; this.vy[i] *= -0.25; this.vx[i] *= 0.6; this.vz[i] *= 0.6; }
      const f = this.life[i] / this.maxLife[i], s = this.grow[i] ? this.size[i] * (1 + this.grow[i] * (1 - f)) * Math.min(1, f * 3) : this.size[i] * f;
      d.position.set(this.px[i], this.py[i], this.pz[i]); d.scale.set(s, s, s); d.rotation.set(i * 0.7, i * 1.3 + f, 0); d.updateMatrix(); m.setMatrixAt(n, d.matrix);
      const k = this.fade ? f : 1; this.col[n * 3] = this.base[i * 3] * k; this.col[n * 3 + 1] = this.base[i * 3 + 1] * k; this.col[n * 3 + 2] = this.base[i * 3 + 2] * k; n++;
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.mesh.count = 0; }
}

export class Effects {
  constructor(scene, opts = {}) {
    this.enabled = opts.enabled ?? EFFECTS.enabled; this.q = quality;
    this.P = new Pool(scene, 1000, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    // flammes et magie : facettes pleines (lisibles même sur la neige, où l'additif « brûle » en blanc), qui gonflent puis rétrécissent
    this.A = new Pool(scene, 1400, new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.A.mesh.renderOrder = 7;
    // ondes de choc : anneaux additifs qui s'élargissent au sol
    const rg = new THREE.RingGeometry(0.82, 1, 40); rg.rotateX(-Math.PI / 2);
    this.RCAP = 32; this.rings = []; this.ringMesh = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), this.RCAP);
    this.ringMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.RCAP * 3), 3); this.ringMesh.frustumCulled = false; this.ringMesh.count = 0; this.ringMesh.renderOrder = 6; scene.add(this.ringMesh);
    // brûlures au sol : disques sombres qui s'estompent lentement
    const sg = new THREE.CircleGeometry(1, 14); sg.rotateX(-Math.PI / 2);
    this.SCAP = 64; this.scorches = []; this.scorchMesh = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true }), this.SCAP);
    this.scorchMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.SCAP * 3), 3); this.scorchMesh.frustumCulled = false; this.scorchMesh.count = 0; this.scorchMesh.renderOrder = 1; scene.add(this.scorchMesh);
    // éclairs : segments additifs, refaits à chaque frappe
    this.BV = 600; this.boltPos = new Float32Array(this.BV * 3); this.boltCol = new Float32Array(this.BV * 3); this.bolts = [];
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3)); bg.setAttribute('color', new THREE.BufferAttribute(this.boltCol, 3));
    this.boltMesh = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.boltMesh.frustumCulled = false; this.boltMesh.renderOrder = 8; scene.add(this.boltMesh);
    this.dummy = new THREE.Object3D();
    // impacts de flèches différés (la flèche met ~0,3 s à arriver)
    this.pendT = new Float32Array(PENDING); this.pendX = new Float32Array(PENDING); this.pendZ = new Float32Array(PENDING); this.pendN = 0;
    this.seenArrows = new WeakSet(); this.lastBlast = 0;
    this.prevAlive = new Uint8Array(MAX_Z); this.prevHp = null;
    // lueurs additives (pas de post-traitement : sphères additives) : éclairs transitoires + torches + lueurs permanentes (projectiles, feux)
    this.GCAP = 72; this.gx = new Float32Array(this.GCAP * 3); this.gl = new Float32Array(this.GCAP); this.gMax = new Float32Array(this.GCAP); this.gs = new Float32Array(this.GCAP); this.gc = new Float32Array(this.GCAP * 3); this.gnext = 0;
    this.live = [];
    this.glow = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false }), this.GCAP + 96);   // lueurs translucides (l'additif « brûle » en blanc sur la neige)
    this.glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((this.GCAP + 96) * 3), 3); this.glow.frustumCulled = false; this.glow.renderOrder = 6; scene.add(this.glow);
    this.torch = []; this.smokeT = 0; this.shake = 0; this.fireAcc = 0;
    this.setEnabled(this.enabled);
  }
  setQuality(q) { this.q = q; this.glow.visible = this.enabled && q.glow; }
  setEnabled(on) {
    this.enabled = !!on; for (const m of [this.P.mesh, this.A.mesh, this.ringMesh, this.scorchMesh, this.boltMesh]) m.visible = this.enabled;
    this.glow.visible = this.enabled && this.q.glow; if (!on) { this.P.clear(); this.A.clear(); this.rings = []; this.scorches = []; this.bolts = []; }
  }
  // éclair de lumière bref (impact, explosion)
  flash(x, y, z, size, life, rgb = null) {
    if (!this.q.glow || !this.enabled) return; const i = this.gnext; this.gnext = (this.gnext + 1) % this.GCAP;
    this.gx[i * 3] = x; this.gx[i * 3 + 1] = y; this.gx[i * 3 + 2] = z; this.gl[i] = this.gMax[i] = life; this.gs[i] = size;
    const c = rgb || FLASH; this.gc[i * 3] = c[0]; this.gc[i * 3 + 1] = c[1]; this.gc[i * 3 + 2] = c[2];
  }
  // lueur pour UNE image (boules de feu en vol, feux au sol, bâton du magicien)
  glowNow(x, y, z, s, r, g, b) { if (this.live.length < 96) this.live.push(x, y, z, s, r, g, b); }
  setTorches(pos, gates, clock) { this.torch = pos; this.gatesOpen = gates; this.tClock = clock; }
  addShake(a) { this.shake = Math.min(1.6, this.shake + a); }
  // ——— émission ———
  emit(x, y, z, vx, vy, vz, life, size, grav, rgb) { this.P.emit(x, y, z, vx, vy, vz, life, size, grav, rgb); }
  burst(x, y, z, n, spread, up, life, size, grav, rgb, add = false, grow = 0) {
    n = Math.max(1, Math.round(n * this.q.particles)); const pool = add ? this.A : this.P;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, s = spread * (0.4 + 0.6 * Math.random()), u = up * (0.5 + Math.random());
      pool.emit(x, y, z, Math.cos(a) * s, u, Math.sin(a) * s, life * (0.7 + 0.5 * Math.random()), size * (0.7 + 0.6 * Math.random()), grav, rgb, grow);
    }
  }
  ring(x, z, r, life, rgb, y = 0.3) { if (this.rings.length < this.RCAP) this.rings.push({ x, z, r, y, t: 0, life, c: rgb }); }
  scorch(x, z, r) { if (this.scorches.length >= this.SCAP) this.scorches.shift(); this.scorches.push({ x, z, r, t: 0, life: 14, a: Math.random() * 6 }); }
  // ——— événements visuels ———
  arrowImpact(x, z) { this.flash(x, 0.8, z, 0.9, 0.12); this.burst(x, 0.6, z, 4, 1.6, 2.2, 0.35, 0.22, 9, COL.spark); }
  zombieDeath(x, z) {
    this.burst(x, 0.8, z, 8, 3.2, 3.8, 0.55, 0.22, 14, COL.shard);
    this.burst(x, 0.3, z, 4, 1.4, 1.2, 0.9, 0.7, 0, COL.dust);
  }
  wallHit(x, z, big = false) {
    this.flash(x, 3, z, big ? 3.5 : 1.4, big ? 0.35 : 0.15, [1, 0.8, 0.5]);
    this.burst(x, 2.5, z, big ? 18 : 4, big ? 4 : 2, big ? 4.5 : 1.6, big ? 1.3 : 0.6, big ? 0.6 : 0.3, 12, COL.debris);
    this.burst(x, 1.5, z, big ? 14 : 3, 1.6, big ? 1.4 : 0.6, big ? 2.2 : 1.2, big ? 1.6 : 0.9, -0.3, COL.dust);
    if (big) { this.addShake(0.5); this.ring(x, z, 9, 0.6, [0.6, 0.5, 0.4]); }
  }
  // grande explosion de feu : boule de feu, braises, débris, colonne de fumée, onde de choc, brûlure, secousse
  explosion(x, z, r, kind = 'fire') {
    const big = kind === 'meteor', k = big ? 1.5 : 1;
    this.flash(x, 2, z, 2.2 + r * 0.45 * k, 0.4 * k, [0.9, 0.5, 0.15]); this.flash(x, 0.8, z, 1.5 + r * 0.3, 0.8, [0.7, 0.25, 0.04]);
    this.burst(x, 1.2, z, 22 * k, 2 + r * 0.7, 3 + r * 0.4, 0.55, 0.7 + r * 0.07, -1.5, [0.9, 0.32, 0.05], true, 1.2);
    this.burst(x, 1.0, z, 12 * k, 1 + r * 0.5, 5 + r * 0.3, 0.4, 0.5 + r * 0.05, 0, [0.8, 0.55, 0.12], true, 1.0);
    this.burst(x, 0.5, z, 16 * k, 3 + r * 0.9, 7, 1.1, 0.22, 14, COL.ember, true);
    this.burst(x, 0.6, z, 12 * k, 2 + r * 0.6, 6, 1.2, 0.4, 14, COL.debris);
    this.burst(x, 1.5, z, 10 * k, 1 + r * 0.3, 2.5, 2.8, 1.6 + r * 0.15, -0.6, COL.smoke, false, 1.5);
    this.ring(x, z, r * 2.2 * k, 0.55, [1, 0.6, 0.25]);
    this.scorch(x, z, r * 0.9);
    this.addShake(big ? 0.55 : 0.18 + r * 0.03);
  }
  rockImpact(x, z, r) { this.flash(x, 1.5, z, 2 + r * 0.6, 0.3, [1, 0.85, 0.6]); this.burst(x, 0.5, z, 16, 2 + r * 0.6, 5, 1.0, 0.5, 14, COL.debris); this.burst(x, 0.6, z, 10, 1.5 + r * 0.3, 1.2, 1.8, 1.3, -0.3, COL.dust, false, 1.2); this.ring(x, z, r * 1.6, 0.45, [0.7, 0.6, 0.45]); this.addShake(0.12); }
  boltImpact(x, z) { this.burst(x, 0.5, z, 6, 2, 2, 0.6, 0.3, 12, COL.debris); this.burst(x, 0.4, z, 4, 1, 0.8, 1, 0.8, 0, COL.dust); }
  lightning(pts) {
    this.flash(pts[0][0], 4, pts[0][1], 3, 0.25, COL.bolt);
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], y0 = i === 1 ? 4.2 : 1.2;
      this.bolts.push({ x0, y0, z0, x1, y1: 1.1, z1, t: 0, life: 0.35, seed: Math.random() * 100 });
      this.flash(x1, 1.2, z1, 2.4, 0.3, COL.bolt); this.burst(x1, 1, z1, 6, 2.5, 3, 0.4, 0.35, 6, COL.bolt, true);
      for (let q = 0; q <= 12; q++) { const f = q / 12; this.A.emit(x0 + (x1 - x0) * f + (Math.random() - 0.5) * 0.8, y0 + (1.1 - y0) * f + (Math.random() - 0.5) * 0.6, z0 + (z1 - z0) * f + (Math.random() - 0.5) * 0.8, 0, 0, 0, 0.28, 0.42, 0, [0.55, 0.65, 1]); }
    }
    this.addShake(0.08);
  }
  heal(x, z, r, from) {
    for (let k = 0; k < Math.round(36 * this.q.particles); k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); this.A.emit(x + Math.cos(a) * rr, 0.3, z + Math.sin(a) * rr, 0, 1.5 + Math.random() * 2, 0, 1.4, 0.5 + Math.random() * 0.4, -0.2, Math.random() < 0.5 ? COL.heal : COL.healL); }
    this.ring(x, z, r + 1.5, 0.9, [0.3, 1, 0.45]); this.flash(x, 1.5, z, r + 1, 0.6, [0.4, 1, 0.5]);
    if (from) this.beam(from[0], 2.6, from[1], x, 1.2, z, COL.heal);
  }
  mend(x, z, from) {
    this.burst(x, 0.5, z - 2, 24, 2.5, 4, 1.2, 0.55, 4, COL.stone, true); this.burst(x, 4, z, 10, 2, 1.5, 1.4, 0.7, 6, COL.debris);
    this.flash(x, 4, z, 4, 0.7, [0.5, 0.7, 1]); this.ring(x, z - 3, 6, 0.8, [0.5, 0.7, 1]);
    if (from) this.beam(from[0], 2.6, from[1], x, 4, z, COL.stone);
  }
  nova(x, z, r) { this.ring(x, z, r, 0.7, [0.5, 0.9, 1]); this.ring(x, z, r * 0.6, 0.5, [0.85, 0.95, 1]); this.burst(x, 0.8, z, 40, r * 1.2, 1.5, 0.8, 0.45, 2, COL.frost, true); this.burst(x, 0.8, z, 20, r, 2.5, 1.2, 0.25, 8, COL.frostW); this.flash(x, 1, z, r * 0.8, 0.5, [0.5, 0.85, 1]); this.addShake(0.15); }
  summon(x, z) { for (let k = 0; k < 40; k++) { const a = k / 40 * 12.56; this.A.emit(x + Math.cos(a) * 1.5, k * 0.12, z + Math.sin(a) * 1.5, -Math.sin(a) * 2, 1.5, Math.cos(a) * 2, 1.6, 0.6, -0.4, k % 2 ? COL.magic : COL.magicL); } this.ring(x, z, 5, 1, [0.7, 0.4, 1]); this.flash(x, 2, z, 4, 0.9, [0.7, 0.4, 1]); }
  cast(x, z, spell) { const c = spell === 'heal' ? COL.heal : spell === 'mend' ? COL.stone : spell === 'nova' ? COL.frost : spell === 'lightning' ? COL.bolt : spell === 'meteor' ? COL.fire : COL.magic; this.burst(x, 2.8, z, 10, 1.2, 1.5, 0.6, 0.35, -1, c, true); }
  beam(x0, y0, z0, x1, y1, z1, c) { this.bolts.push({ x0, y0, z0, x1, y1, z1, t: 0, life: 0.45, seed: -1, c }); const n = 10; for (let k = 0; k <= n; k++) { const f = k / n; this.A.emit(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, z0 + (z1 - z0) * f, 0, 0.6, 0, 0.5, 0.35, 0, c); } }
  // ——— lecture de l'état (chaque image) ———
  observe(sim) {
    if (!this.enabled) { this.sync(sim); return; }
    let budget = MAX_EMIT_PER_FRAME;
    for (const a of sim.arrows) if (!this.seenArrows.has(a)) {
      this.seenArrows.add(a);
      if (this.pendN < PENDING) { this.pendT[this.pendN] = 0.3; this.pendX[this.pendN] = a.x1; this.pendZ[this.pendN] = a.z1; this.pendN++; }
    }
    // explosions et sorts publiés par la simulation (chaque blast a un identifiant croissant : traité une seule fois)
    for (const b of sim.blasts || []) {
      if (b.id <= this.lastBlast) continue; this.lastBlast = b.id;
      switch (b.kind) {
        case 'fire': case 'meteor': this.explosion(b.x, b.z, b.r, b.kind); break;
        case 'rock': this.rockImpact(b.x, b.z, b.r); break;
        case 'bolt': this.boltImpact(b.x, b.z); break;
        case 'lightning': this.lightning(b.pts); break;
        case 'heal': this.heal(b.x, b.z, b.r, b.from); break;
        case 'mend': this.mend(b.x, b.z, b.from); break;
        case 'nova': this.nova(b.x, b.z, b.r); break;
        case 'summon': this.summon(b.x, b.z); break;
        case 'mageDown': this.burst(b.x, 1, b.z, 30, 3, 3, 1.2, 0.6, -0.5, COL.magic, true); this.flash(b.x, 1.5, b.z, 4, 0.6, [0.7, 0.4, 1]); break;
        case 'cast': this.cast(b.x, b.z, b.spell); break;
        case 'meteorCall': this.ring(b.x, b.z, b.r, 1.4, [1, 0.4, 0.1]); break;
      }
    }
    // projectiles enflammés en vol (catapulte, trébuchet, boule de feu, météores) : traînée de feu + lueur
    this.trails(sim);
    // feux au sol : flammes qui dansent
    this.fireAcc += this.q.particles;
    for (const f of sim.fires || []) {
      const life = Math.min(1, f.t / 1.5);
      this.glowNow(f.x, 0.8, f.z, f.r * 0.9 * life, 0.5 * life, 0.22 * life, 0.04);
      if (this.fireAcc >= 1) for (let k = 0; k < 2; k++) { const a = Math.random() * 6.283, rr = f.r * Math.sqrt(Math.random()); this.A.emit(f.x + Math.cos(a) * rr, 0.2, f.z + Math.sin(a) * rr, 0, 2 + Math.random() * 2, 0, 0.6, 0.5 + Math.random() * 0.5, -1, Math.random() < 0.6 ? COL.fire : COL.fireY, 0.6); if (Math.random() < 0.15) this.P.emit(f.x + Math.cos(a) * rr, 1, f.z + Math.sin(a) * rr, 0.2, 1.4, 0.1, 2.4, 1.0, -0.2, COL.smoke, 1.4); }
    }
    if (this.fireAcc >= 1) this.fireAcc = 0;
    // zombies : passage vivant → mort
    const Z = sim.zombies;
    for (let i = 0; i < Z.n; i++) {
      const alive = Z.hp[i] > 0 ? 1 : 0;
      if (this.prevAlive[i] && !alive && budget-- > 0) this.zombieDeath(Z.x[i], Z.z[i]);
      this.prevAlive[i] = alive;
    }
    const W = sim.wall;
    if (!this.prevHp) this.prevHp = Float32Array.from(W.hp);
    for (let i = 0; i < SEGS; i++) {
      const d = this.prevHp[i] - W.hp[i];
      if (d > 0 && budget > 0) { budget--; this.wallHit(i * SEG_W + SEG_W / 2, WALL_Z0 + 4, W.hp[i] <= 0 && this.prevHp[i] > 0); }
      this.prevHp[i] = W.hp[i];
    }
  }
  trails(sim) {
    const em = this.q.particles;
    const fireball = (x, y, z, s) => {
      this.glowNow(x, y, z, s * 0.85, 1, 0.55, 0.15);
      if (Math.random() < em) { this.A.emit(x, y, z, (Math.random() - 0.5), 0.8, (Math.random() - 0.5), 0.45, s * 1.1, 0, COL.fire, 0.4); this.A.emit(x, y, z, 0, 0.3, 0, 0.3, s * 0.8, 0, COL.fireY); }
      if (Math.random() < em * 0.35) this.P.emit(x, y, z, 0, 0.5, 0, 1.2, s * 0.9, -0.3, COL.smoke, 1);
    };
    for (const p of sim.siege.shots) {
      if (p.type === 'ballista') continue; const f = Math.min(1, p.t / p.dur), arc = 14;
      fireball(p.x0 + (p.x1 - p.x0) * f, 3 + arc * Math.sin(Math.PI * f), p.z0 + (p.z1 - p.z0) * f, p.type === 'trebuchet' ? 1.1 : 0.8);
    }
    if (sim.mages) {
      for (const p of sim.mages.shots) { const f = Math.min(1, p.t / p.dur); fireball(p.x0 + (p.x1 - p.x0) * f, 2.8 + 3 * Math.sin(Math.PI * f) - 1.6 * f, p.z0 + (p.z1 - p.z0) * f, 0.7); }
      for (const m of sim.mages.meteors) { if (m.t < 0) continue; const f = Math.min(1, m.t / m.dur); fireball(m.x - 14 * (1 - f), 40 * (1 - f) + 0.5, m.z - 10 * (1 - f), 1.5); }
    }
  }
  sync(sim) {
    const Z = sim.zombies; for (let i = 0; i < Z.n; i++) this.prevAlive[i] = Z.hp[i] > 0 ? 1 : 0;
    this.prevHp = Float32Array.from(sim.wall.hp);
    for (const a of sim.arrows) this.seenArrows.add(a);
    for (const b of sim.blasts || []) this.lastBlast = Math.max(this.lastBlast, b.id);
    this.pendN = 0;
  }
  // ——— physique et écriture des matrices (une fois par image) ———
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (!this.enabled) { this.live.length = 0; return; }
    dt = Math.min(dt, 0.05);
    for (let k = 0; k < this.pendN;) {
      this.pendT[k] -= dt;
      if (this.pendT[k] <= 0) { this.arrowImpact(this.pendX[k], this.pendZ[k]); this.pendX[k] = this.pendX[this.pendN - 1]; this.pendZ[k] = this.pendZ[this.pendN - 1]; this.pendT[k] = this.pendT[this.pendN - 1]; this.pendN--; }
      else k++;
    }
    this.updateGlow(dt); this.smoke(dt);
    this.P.update(dt); this.A.update(dt);
    this.updateRings(dt); this.updateScorch(dt); this.updateBolts(dt);
  }
  updateRings(dt) {
    const d = this.dummy, m = this.ringMesh; let n = 0;
    this.rings = this.rings.filter(r => (r.t += dt) < r.life);
    for (const r of this.rings) { const f = r.t / r.life, s = r.r * (0.2 + 0.8 * Math.sqrt(f)), a = 1; d.position.set(r.x, r.y + (1 - f) * 0.01, r.z); d.scale.set(s * (f < 0.85 ? 1 : 1 - (f - 0.85) * 2), 1, s * (f < 0.85 ? 1 : 1 - (f - 0.85) * 2)); d.rotation.set(0, 0, 0); d.updateMatrix(); m.setMatrixAt(n, d.matrix); m.setColorAt(n, TMP.setRGB(r.c[0] * a, r.c[1] * a, r.c[2] * a)); n++; }
    m.count = n; m.instanceMatrix.needsUpdate = true; if (n) m.instanceColor.needsUpdate = true;
  }
  updateScorch(dt) {
    const d = this.dummy, m = this.scorchMesh; let n = 0;
    this.scorches = this.scorches.filter(s => (s.t += dt) < s.life);
    for (const s of this.scorches) { const f = s.t / s.life, k = 0.35 + 0.65 * f; d.position.set(s.x, 0.09 + n * 0.0005, s.z); d.scale.set(s.r, 1, s.r * 0.9); d.rotation.set(0, s.a, 0); d.updateMatrix(); m.setMatrixAt(n, d.matrix); m.setColorAt(n, TMP.setRGB(k, k * 0.97, k * 0.95)); n++; }
    m.count = n; m.instanceMatrix.needsUpdate = true; if (n) m.instanceColor.needsUpdate = true;
  }
  updateBolts(dt) {
    this.bolts = this.bolts.filter(b => (b.t += dt) < b.life);
    const P = this.boltPos, C = this.boltCol; let v = 0;
    for (const b of this.bolts) {
      const a = 1 - b.t / b.life, seg = b.seed < 0 ? 1 : 7, c = b.c || [0.75, 0.85, 1];
      let px = b.x0, py = b.y0, pz = b.z0;
      for (let k = 1; k <= seg && v < this.BV - 2; k++) {
        const f = k / seg, j = k === seg || b.seed < 0 ? 0 : 1.2, r = Math.sin(b.seed * 13 + k * 7.1 + b.t * 40);
        const x = b.x0 + (b.x1 - b.x0) * f + r * j, y = b.y0 + (b.y1 - b.y0) * f + Math.cos(b.seed + k * 3.3 + b.t * 30) * j * 0.6, z = b.z0 + (b.z1 - b.z0) * f + Math.cos(b.seed * 5 + k * 2.7) * j;
        P[v * 3] = px; P[v * 3 + 1] = py; P[v * 3 + 2] = pz; P[v * 3 + 3] = x; P[v * 3 + 4] = y; P[v * 3 + 5] = z;
        for (let q = 0; q < 2; q++) { C[(v + q) * 3] = c[0] * a * 1.4; C[(v + q) * 3 + 1] = c[1] * a * 1.4; C[(v + q) * 3 + 2] = c[2] * a * 1.4; }
        v += 2; px = x; py = y; pz = z;
      }
    }
    const g = this.boltMesh.geometry; g.setDrawRange(0, v); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  }
  smoke(dt) {
    if (!this.sim_ || this.q.particles < 0.4) return; this.smokeT -= dt; if (this.smokeT > 0) return; this.smokeT = 0.5;
    let n = 0;
    for (const s of this.sim_.build.items) {
      if (s.state !== 'built' || (s.type !== 'house' && s.type !== 'forge' && s.type !== 'barracks')) continue;
      if (Math.random() < 0.35 && n++ < 6) { const forge = s.type === 'forge'; this.P.emit(s.x + 1.2, forge ? 7 : 5, s.z - 0.8, 0.25, 1.1, 0.15, forge ? 2.6 : 2.2, forge ? 1.1 : 0.8, -0.05, forge ? [0.35, 0.33, 0.33] : [0.7, 0.7, 0.72]); }
    }
  }
  updateGlow(dt) {
    const g = this.glow; if (!this.q.glow || !this.enabled) { g.visible = false; this.live.length = 0; return; } g.visible = true;
    const d = this.dummy; let n = 0;
    for (let i = 0; i < this.GCAP; i++) {
      if (this.gl[i] <= 0) continue; this.gl[i] -= dt; const f = Math.max(0, this.gl[i] / this.gMax[i]), s = this.gs[i] * (0.5 + 0.5 * f) * 0.8;
      d.position.set(this.gx[i * 3], this.gx[i * 3 + 1], this.gx[i * 3 + 2]); d.scale.set(s, s, s); d.updateMatrix(); g.setMatrixAt(n, d.matrix); g.setColorAt(n, TMP.setRGB(this.gc[i * 3], this.gc[i * 3 + 1], this.gc[i * 3 + 2])); n++;
    }
    const L = this.live;
    for (let i = 0; i < L.length; i += 7) { d.position.set(L[i], L[i + 1], L[i + 2]); d.scale.setScalar(L[i + 3]); d.updateMatrix(); g.setMatrixAt(n, d.matrix); g.setColorAt(n, TMP.setRGB(Math.min(1, L[i + 4] * 1.4), Math.min(1, L[i + 5] * 1.4), Math.min(1, L[i + 6] * 1.4))); n++; }
    L.length = 0;
    const open = this.gatesOpen || [], t = this.tClock || 0;
    for (let k = 0; k < this.torch.length && n < this.GCAP + 96; k++) {
      const p = this.torch[k], o = open[(k / 2) | 0] || 0, fl = 0.85 + 0.15 * Math.sin(t * 9 + k * 2.1) * Math.sin(t * 5.3 + k), s = (1.1 + 0.9 * o) * fl;
      d.position.set(p[0], p[1], p[2]); d.scale.set(s, s, s); d.updateMatrix(); g.setMatrixAt(n, d.matrix); g.setColorAt(n, TMP.setRGB(1, 0.6 * fl + 0.15 * o, 0.2)); n++;
    }
    g.count = n; g.instanceMatrix.needsUpdate = true; if (g.instanceColor) g.instanceColor.needsUpdate = true;
  }
  frame(sim, dt) { this.sim_ = sim; this.observe(sim); this.update(dt); }
}
