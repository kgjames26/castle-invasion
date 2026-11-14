// Armée : archers sur le chemin de ronde (par secteur), soldats au pied du mur, réserve.
import { SECTORS, SECTOR_W, ARCHER_SLOTS, SOLDIER_SLOTS, ARCHER_Z, SOLDIER_Z } from './constants.js';
import { UNITS } from '../content/medieval.js';

const tmp = new Int32Array(512);
export const archerPos = (s, k) => ({ x: s * SECTOR_W + (k + 0.5) * SECTOR_W / ARCHER_SLOTS, z: ARCHER_Z });

export class Army {
  constructor() {
    this.reserve = { archer: 0, soldier: 0 };
    this.archers = Array.from({ length: SECTORS }, () => ({ n: 0, cd: new Float32Array(ARCHER_SLOTS) }));
    this.soldiers = [];
  }
  count(s, type) { return type === 'archer' ? this.archers[s].n : this.soldiers.reduce((a, u) => a + (u.s === s ? 1 : 0), 0); }
  slots(type) { return type === 'archer' ? ARCHER_SLOTS : SOLDIER_SLOTS; }
  // delta > 0 : affecte depuis la réserve ; delta < 0 : renvoie à la réserve. Renvoie le nombre réellement déplacé.
  assign(s, type, delta) {
    let moved = 0;
    for (let k = 0; k < Math.abs(delta); k++) {
      if (delta > 0) {
        if (this.reserve[type] <= 0 || this.count(s, type) >= this.slots(type)) break;
        this.reserve[type]--; moved++;
        if (type === 'archer') { const a = this.archers[s]; a.cd[a.n] = Math.random() * 0.8; a.n++; }
        else this.soldiers.push({ s, hp: UNITS.soldier.hp, x: 0, z: 0, px: 0, pz: 0, postX: 0, postZ: 0, cd: 0, fresh: true });
      } else {
        if (this.count(s, type) <= 0) break;
        this.reserve[type]++; moved++;
        if (type === 'archer') this.archers[s].n--;
        else { for (let j = this.soldiers.length - 1; j >= 0; j--) if (this.soldiers[j].s === s) { this.soldiers.splice(j, 1); break; } }
      }
    }
    if (type === 'soldier') this.layoutPosts();
    return moved;
  }
  layoutPosts() {
    const idx = new Array(SECTORS).fill(0);
    for (const u of this.soldiers) {
      const k = idx[u.s]++;
      u.postX = u.s * SECTOR_W + (k + 0.5) * SECTOR_W / SOLDIER_SLOTS; u.postZ = SOLDIER_Z;
      if (u.fresh) { u.x = u.px = u.postX; u.z = u.pz = u.postZ; u.fresh = false; }
    }
  }
  hurt(u, dmg) { u.hp -= dmg; u.hit = 2; }

  update(dt, sim) {
    const Z = sim.zombies, hash = sim.hash;
    // archers
    for (let s = 0; s < SECTORS; s++) {
      const a = this.archers[s];
      for (let k = 0; k < a.n; k++) {
        a.cd[k] -= dt; if (a.cd[k] > 0) continue;
        const p = archerPos(s, k);
        const m = hash.query(p.x, p.z, UNITS.archer.range, Z.x, Z.z, tmp);
        let best = -1, bd = Infinity;
        for (let q = 0; q < m; q++) {
          const i = tmp[q]; if (Z.hp[i] <= 0) continue;
          const d = (Z.x[i] - p.x) ** 2 + (Z.z[i] - p.z) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        if (best < 0) { a.cd[k] = 0.25; continue; }
        Z.hit(best, UNITS.archer.dmg);
        sim.arrows.push({ x0: p.x, z0: p.z, x1: Z.x[best], z1: Z.z[best], t: 0 });
        a.cd[k] = UNITS.archer.rate * (0.9 + sim.rng() * 0.2);
      }
    }
    // soldats
    const U = UNITS.soldier;
    for (const u of this.soldiers) {
      u.px = u.x; u.pz = u.z; u.cd -= dt; if (u.hit > 0) u.hit -= dt;
      const m = hash.query(u.postX, u.postZ, U.leash, Z.x, Z.z, tmp);
      let best = -1, bd = Infinity;
      for (let q = 0; q < m; q++) {
        const i = tmp[q]; if (Z.hp[i] <= 0 || Z.z[i] < 150.8) continue;     // ne sort pas du royaume
        const d = (Z.x[i] - u.x) ** 2 + (Z.z[i] - u.z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        const d = Math.sqrt(bd);
        if (d <= U.range) { if (u.cd <= 0) { Z.hit(best, U.dmg); u.cd = U.rate; } }
        else { u.x += (Z.x[best] - u.x) / d * U.speed * dt; u.z += (Z.z[best] - u.z) / d * U.speed * dt; }
      } else {
        const dx = u.postX - u.x, dz = u.postZ - u.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { const st = Math.min(d, U.speed * dt); u.x += dx / d * st; u.z += dz / d * st; }
        if (!(u.hit > 0)) u.hp = Math.min(UNITS.soldier.hp, u.hp + U.regen * dt);
      }
    }
    const before = this.soldiers.length;
    this.soldiers = this.soldiers.filter(u => u.hp > 0);
    if (this.soldiers.length !== before) this.layoutPosts();
  }
}
