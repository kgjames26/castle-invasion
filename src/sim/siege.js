// Armes de siège : baliste, catapulte, trébuchet. Posées derrière la muraille (3 emplacements par secteur),
// construites par l'Atelier de siège (niveau = 2 armes déployables par niveau, et accès aux armes plus lourdes).
// Les munitions sont prélevées dans les stocks ; les équipages comptent dans la population partagée.
import { SECTORS, SECTOR_W } from './constants.js';
import { SIEGE, SIEGE_ORDER, SIEGE_RULES, FIRE } from '../content/medieval.js';

export const SIEGE_Z = 166;
export const siegePos = (s, slot) => ({ x: s * SECTOR_W + 10 + slot * 10, z: SIEGE_Z });
const tmp = new Int32Array(1024), cand = new Int32Array(40);

export class Siege {
  constructor() { this.weapons = []; this.queue = []; this.nextId = 1; this.shots = []; this.impacts = []; }
  popUsed() { let p = 0; for (const w of this.weapons) p += SIEGE[w.type].crew; for (const q of this.queue) p += SIEGE[q.type].crew; return p; }
  cap(sim) { return SIEGE_RULES.perLevel * sim.eco.level.workshop; }
  deployed() { return this.weapons.length + this.queue.length; }
  inSector(s) { let n = 0; for (const w of this.weapons) if (w.sector === s) n++; for (const q of this.queue) if (q.sector === s) n++; return n; }
  canBuild(sim, type, s) {
    const D = SIEGE[type], lv = sim.eco.level.workshop;
    return lv >= D.level && this.deployed() < this.cap(sim) && this.queue.length < SIEGE_RULES.queueMax
      && this.inSector(s) < SIEGE_RULES.slotsPerSector && sim.eco.popRoom() >= D.crew;
  }
  build(sim, type, s) {
    if (!SIEGE[type] || !this.canBuild(sim, type, s) || !sim.eco.pay(SIEGE[type].cost)) return false;
    const t = SIEGE[type].time / (1 + SIEGE_RULES.speedPerLevel * (sim.eco.level.workshop - 1));
    this.queue.push({ type, sector: s, t, full: t }); return true;
  }
  cancel(sim) {
    const q = this.queue.pop(); if (!q) return false;
    for (const r in SIEGE[q.type].cost) sim.eco.add(r, SIEGE[q.type].cost[r]); return true;
  }
  dismantle(sim, id) {
    const i = this.weapons.findIndex(w => w.id === id); if (i < 0) return false;
    const w = this.weapons[i], C = SIEGE[w.type].cost;
    for (const r in C) sim.eco.add(r, Math.floor(C[r] * SIEGE_RULES.refund));
    this.weapons.splice(i, 1); return true;
  }
  freeSlot(s) { for (let k = 0; k < SIEGE_RULES.slotsPerSector; k++) if (!this.weapons.some(w => w.sector === s && w.slot === k)) return k; return -1; }
  place(type, s, slot, id) {
    const p = siegePos(s, slot); const w = { id: id || this.nextId++, type, sector: s, slot, x: p.x, z: p.z, cd: 2, noAmmo: false, rec: 0 };
    this.weapons.push(w); return w;
  }
  update(dt, sim) {
    // construction (une arme à la fois)
    if (this.queue.length) {
      const q = this.queue[0]; q.t -= dt;
      if (q.t <= 0) { const slot = this.freeSlot(q.sector); if (slot >= 0) this.place(q.type, q.sector, slot); this.queue.shift(); }
    }
    const Z = sim.zombies, hash = sim.hash, eco = sim.eco, dm = 1 + 0.1 * eco.up.weapons;
    for (const w of this.weapons) {
      if (w.rec > 0) w.rec -= dt;
      w.cd -= dt; if (w.cd > 0) continue;
      if (Z.n === 0) { w.cd = 0.5; continue; }
      const D = SIEGE[w.type], m = hash.query(w.x, w.z, D.range, Z.x, Z.z, tmp);
      // candidats : zombies vivants hors portée minimale (échantillonnés pour borner le coût)
      let nc = 0; const step = Math.max(1, (m / 36) | 0);
      for (let k = 0; k < m && nc < 36; k += step) { const i = tmp[k]; if (Z.hp[i] <= 0) continue; const dx = Z.x[i] - w.x, dz = Z.z[i] - w.z; if (dx * dx + dz * dz < D.minRange * D.minRange) continue; cand[nc++] = i; }
      if (!nc) { w.cd = 0.4; continue; }
      let best = cand[0], bs = -1;
      for (let a = 0; a < nc; a++) {
        const i = cand[a]; let sc;
        if (D.aoe > 3) { sc = 0; const r2 = D.aoe * D.aoe; for (let b = 0; b < nc; b++) { const j = cand[b]; if ((Z.x[i] - Z.x[j]) ** 2 + (Z.z[i] - Z.z[j]) ** 2 <= r2) sc += 1 + Z.hp[j] / 200; } }
        else sc = Z.hp[i];                                         // baliste : le plus coriace
        if (sc > bs) { bs = sc; best = i; }
      }
      if (!eco.pay(D.ammo)) { w.noAmmo = true; w.cd = 1; continue; }
      w.noAmmo = false; w.rec = 0.35;
      const tx = Z.x[best], tz = Z.z[best], dist = Math.hypot(tx - w.x, tz - w.z);
      this.shots.push({ type: w.type, x0: w.x, z0: w.z, x1: tx, z1: tz, t: 0, dur: Math.max(0.25, dist / D.speed), dmg: D.dmg * dm, aoe: D.aoe });
      w.cd = D.reload * (0.95 + sim.rng() * 0.1);
    }
    // projectiles en vol : impact = dégâts de zone
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const p = this.shots[i]; p.t += dt; if (p.t < p.dur) continue;
      if (p.type === 'ballista') { const m = hash.query(p.x1, p.z1, p.aoe, Z.x, Z.z, tmp); for (let k = 0; k < m; k++) { const j = tmp[k]; if (Z.hp[j] > 0) Z.hit(j, p.dmg); } sim.blast('bolt', p.x1, p.z1, p.aoe); }
      else sim.explode(p.x1, p.z1, p.aoe, p.dmg, FIRE.catapultFire ? 'fire' : 'rock');      // boulets enflammés : explosion + feu au sol
      p.landed = true; p.t = p.dur; this.impacts.push({ x: p.x1, z: p.z1, r: p.aoe, t: 0 }); this.shots.splice(i, 1);
    }
    for (let i = this.impacts.length - 1; i >= 0; i--) { this.impacts[i].t += dt; if (this.impacts[i].t > 0.5) this.impacts.splice(i, 1); }
  }
  serialize() { return { nextId: this.nextId, weapons: this.weapons.map(w => ({ id: w.id, type: w.type, sector: w.sector, slot: w.slot })), queue: this.queue.map(q => ({ type: q.type, sector: q.sector, t: +q.t.toFixed(2), full: q.full })) }; }
  restore(st) {
    this.weapons = []; this.shots = []; this.impacts = []; this.nextId = st?.nextId || 1;
    for (const o of st?.weapons || []) if (SIEGE[o.type]) this.place(o.type, o.sector, o.slot, o.id);
    this.queue = (st?.queue || []).filter(q => SIEGE[q.type]).map(q => ({ ...q }));
  }
}
