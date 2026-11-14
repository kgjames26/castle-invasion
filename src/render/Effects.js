// Effets visuels à base de particules : PURE VUE. Ne modifie jamais src/sim/ : lit l'état (flèches, impacts de siège,
// zombies tués, tronçons de muraille) et compare aux valeurs de l'image précédente.
// Pool fixe (aucune création/destruction par image) rendu en un seul InstancedMesh.
import * as THREE from 'three';
import { MAX_Z, SEGS, SEG_W, WALL_Z0 } from '../sim/constants.js';

// Interrupteur global : EFFECTS.enabled = false, ou ajouter ?fx=0 à l'URL, coupe tous les effets (aucun coût CPU hors comparaison).
export const EFFECTS = { enabled: !(typeof location !== 'undefined' && /[?&]fx=0\b/.test(location.search)) };

const CAP = 900, PENDING = 96, MAX_EMIT_PER_FRAME = 40;
const COL = { spark: [0.78, 0.72, 0.6], shard: [0.45, 0.85, 0.3], shardDark: [0.22, 0.45, 0.16], dust: [0.78, 0.74, 0.66], debris: [0.42, 0.4, 0.38], fire: [1, 0.55, 0.18], ember: [1, 0.85, 0.4] };

export class Effects {
  constructor(scene, opts = {}) {
    this.enabled = opts.enabled ?? EFFECTS.enabled;
    // pool de particules (structure de tableaux typés)
    this.px = new Float32Array(CAP); this.py = new Float32Array(CAP); this.pz = new Float32Array(CAP);
    this.vx = new Float32Array(CAP); this.vy = new Float32Array(CAP); this.vz = new Float32Array(CAP);
    this.life = new Float32Array(CAP); this.maxLife = new Float32Array(CAP); this.size = new Float32Array(CAP); this.grav = new Float32Array(CAP);
    this.col = new Float32Array(CAP * 3); this.next = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), CAP);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.col, 3); this.mesh.frustumCulled = false; this.mesh.count = CAP;
    this.mesh.visible = this.enabled; scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    // impacts de flèches différés (la flèche met ~0,3 s à arriver)
    this.pendT = new Float32Array(PENDING); this.pendX = new Float32Array(PENDING); this.pendZ = new Float32Array(PENDING); this.pendN = 0;
    // mémoire de l'image précédente (pour détecter les variations)
    this.seenArrows = new WeakSet(); this.seenImpacts = new WeakSet();
    this.prevAlive = new Uint8Array(MAX_Z); this.prevHp = null; this.emitted = 0; this.clockFx = 0;
    for (let i = 0; i < CAP; i++) this.life[i] = 0;
  }
  setEnabled(on) { this.enabled = !!on; this.mesh.visible = this.enabled; if (!on) this.life.fill(0); }
  // ——— émission (pool circulaire : écrase la plus ancienne si plein) ———
  emit(x, y, z, vx, vy, vz, life, size, grav, rgb) {
    const i = this.next; this.next = (this.next + 1) % CAP;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = this.maxLife[i] = life; this.size[i] = size; this.grav[i] = grav;
    this.col[i * 3] = rgb[0]; this.col[i * 3 + 1] = rgb[1]; this.col[i * 3 + 2] = rgb[2];
  }
  burst(x, y, z, n, spread, up, life, size, grav, rgb) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, s = spread * (0.4 + 0.6 * Math.random()), u = up * (0.5 + Math.random());
      this.emit(x, y, z, Math.cos(a) * s, u, Math.sin(a) * s, life * (0.7 + 0.5 * Math.random()), size * (0.7 + 0.6 * Math.random()), grav, rgb);
    }
  }
  // ——— événements visuels (appelables directement depuis le Renderer) ———
  arrowImpact(x, z) { this.burst(x, 0.6, z, 4, 1.6, 2.2, 0.35, 0.22, 9, COL.spark); }
  zombieDeath(x, z) {
    this.burst(x, 0.8, z, 8, 3.2, 3.8, 0.55, 0.22, 14, COL.shard);
    this.burst(x, 0.3, z, 4, 1.4, 1.2, 0.9, 0.7, 0, COL.dust);
  }
  wallHit(x, z, big = false) {
    this.burst(x, 2.5, z, big ? 14 : 4, big ? 3.5 : 2, big ? 3.2 : 1.6, big ? 1.1 : 0.6, big ? 0.5 : 0.3, 12, COL.debris);
    this.burst(x, 1.5, z, big ? 8 : 3, 1.2, 0.6, 1.2, 0.9, 0, COL.dust);
  }
  explosion(x, z, r) {
    this.burst(x, 0.6, z, 26, 2 + r * 0.6, 5 + r * 0.2, 0.7, 0.45, 10, COL.fire);
    this.burst(x, 0.4, z, 12, 1 + r * 0.4, 2.5, 0.5, 0.25, 16, COL.ember);
    this.burst(x, 0.5, z, 10, 1.6 + r * 0.3, 1.0, 1.4, 1.1, 0, COL.dust);
  }
  // ——— lecture de l'état (appelée à chaque image, après le rendu des entités) ———
  observe(sim) {
    if (!this.enabled) { this.sync(sim); return; }
    let budget = MAX_EMIT_PER_FRAME;
    // flèches d'archers et de tours : impact différé à l'arrivée
    for (const a of sim.arrows) if (!this.seenArrows.has(a)) {
      this.seenArrows.add(a);
      if (this.pendN < PENDING) { this.pendT[this.pendN] = 0.3; this.pendX[this.pendN] = a.x1; this.pendZ[this.pendN] = a.z1; this.pendN++; }
    }
    // impacts de projectiles de siège : explosion au moment de l'impact
    for (const im of sim.siege.impacts) if (!this.seenImpacts.has(im)) { this.seenImpacts.add(im); this.explosion(im.x, im.z, im.r); }
    // zombies : passage vivant → mort (lu dans les tableaux, sans modifier la simulation)
    const Z = sim.zombies;
    for (let i = 0; i < Z.n; i++) {
      const alive = Z.hp[i] > 0 ? 1 : 0;
      if (this.prevAlive[i] && !alive && budget-- > 0) this.zombieDeath(Z.x[i], Z.z[i]);
      this.prevAlive[i] = alive;
    }
    // muraille : perte de points de vie par tronçon (poussière, débris ; grosse gerbe à la brèche)
    const W = sim.wall;
    if (!this.prevHp) this.prevHp = Float32Array.from(W.hp);
    for (let i = 0; i < SEGS; i++) {
      const d = this.prevHp[i] - W.hp[i];
      if (d > 0 && budget > 0) {
        budget--; const x = i * SEG_W + SEG_W / 2, z = WALL_Z0 + 4;
        this.wallHit(x, z, W.hp[i] <= 0 && this.prevHp[i] > 0);
      }
      this.prevHp[i] = W.hp[i];
    }
  }
  // resynchronise la mémoire sans émettre (fin d'une désactivation, nouvelle partie)
  sync(sim) {
    const Z = sim.zombies; for (let i = 0; i < Z.n; i++) this.prevAlive[i] = Z.hp[i] > 0 ? 1 : 0;
    this.prevHp = Float32Array.from(sim.wall.hp);
    for (const a of sim.arrows) this.seenArrows.add(a);
    for (const im of sim.siege.impacts) this.seenImpacts.add(im);
    this.pendN = 0;
  }
  // ——— mise à jour physique et écriture des matrices (une fois par image) ———
  update(dt) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);
    // impacts différés de flèches
    for (let k = 0; k < this.pendN;) {
      this.pendT[k] -= dt;
      if (this.pendT[k] <= 0) { this.arrowImpact(this.pendX[k], this.pendZ[k]); this.pendX[k] = this.pendX[this.pendN - 1]; this.pendZ[k] = this.pendZ[this.pendN - 1]; this.pendT[k] = this.pendT[this.pendN - 1]; this.pendN--; }
      else k++;
    }
    const d = this.dummy, m = this.mesh;
    for (let i = 0; i < CAP; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.vy[i] -= this.grav[i] * dt;
        this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
        if (this.py[i] < 0) { this.py[i] = 0; this.vy[i] *= -0.25; this.vx[i] *= 0.6; this.vz[i] *= 0.6; }
        const s = this.size[i] * Math.max(0, this.life[i] / this.maxLife[i]);
        d.position.set(this.px[i], this.py[i], this.pz[i]); d.scale.set(s, s, s);
      } else { d.position.set(0, -10, 0); d.scale.set(0, 0, 0); }
      d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }
  // appel par image : observation puis physique
  frame(sim, dt) { this.observe(sim); this.update(dt); }
}
