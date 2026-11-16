// Prêtre (v2.3) : arrive au village quand l'église est bâtie. Hors assaut, il reste devant l'église ; pendant l'alerte et l'assaut,
// il va prier dans la cour derrière le secteur de muraille le plus menacé. Pouvoirs selon le niveau de l'église (voir PRIEST).
import { PRIEST, INFECTION } from '../content/medieval.js';
import { SECTORS, SECTOR_W, WALL_Z0, WALL_Z1, sectorOfX, wallOff } from './constants.js';

const tmp = new Int32Array(512);
export class Priest {
  constructor() { this.reset(); }
  reset() { this.here = false; this.x = this.px = 0; this.z = this.pz = 0; this.face = Math.PI; this.sector = -1; this.post = false; this.cd = 0; this.cast = 0; this.healT = 0; }
  level(sim) { const s = sim.build.of('church'); return s && (s.state === 'built' || s.state === 'upgrading') ? Math.max(1, sim.eco.level.church || 1) : 0; }
  home(sim) { const s = sim.build.of('church'); return s ? { x: s.x, z: s.z + 9 } : { x: 100, z: 200 }; }
  // secteur le plus menacé : zombies près de la muraille (pondérés par la proximité)
  threat(sim) {
    const Z = sim.zombies, w = new Float32Array(SECTORS); let any = false;
    for (let i = 0; i < Z.n; i++) { if (Z.hp[i] <= 0) continue; const d = WALL_Z0 + wallOff(Z.x[i]) - Z.z[i]; if (d > 60) continue; w[sectorOfX(Z.x[i])] += 1 + Math.max(0, 30 - d) / 10; any = true; }
    if (!any) return this.sector >= 0 ? this.sector : 2;
    let b = 0; for (let s = 1; s < SECTORS; s++) if (w[s] > w[b] * 1.15) b = s;
    return this.sector >= 0 && w[b] < w[this.sector] * 1.6 ? this.sector : b;   // ne change de secteur que si la menace y est nettement plus forte
  }
  blessMult(sim, s) { if (!this.here || !this.post || s !== this.sector) return 1; const L = this.level(sim); return 1 + PRIEST.bless + PRIEST.blessPerLevel * (L - 1); }
  update(dt, sim) {
    this.px = this.x; this.pz = this.z;
    const L = this.level(sim);
    if (!L) { this.here = false; this.post = false; return; }
    if (!this.here) { const h = this.home(sim); this.here = true; this.x = this.px = h.x; this.z = this.pz = h.z; sim.events.push({ type: 'priestArrived', x: h.x, z: h.z }); sim.blast('heal', h.x, h.z, 3); }
    this.cast = Math.max(0, this.cast - dt);
    const fight = sim.phase === 'assault' || sim.phase === 'alert';
    let tx, tz;
    // mordus : le prêtre va les guérir (ceux qui sont relevés et à l'abri des remparts), le plus pressé d'abord
    const I = sim.infection; let pat = null;
    if (I && I.list.length) { let bs = Infinity; for (const b of I.list) { if (b.state === 'down' || I.outside(b)) continue; const sc = b.t + Math.hypot(b.x - this.x, b.z - this.z) / PRIEST.speed; if (sc < bs) { bs = sc; pat = b; } } }
    if (pat) {
      this.post = false; this.sector = -1; const dx = pat.x - this.x, dz = pat.z - this.z, d = Math.hypot(dx, dz), st = PRIEST.speed * dt;
      if (d > 1.4) { this.x += dx / d * Math.min(st, d - 1.2); this.z += dz / d * Math.min(st, d - 1.2); this.face = Math.atan2(dx, dz); this.healing = 0; return; }
      this.face = Math.atan2(dx, dz); this.cast = 0.3; this.healing = (this.healing || 0) + dt; if (this.healing >= INFECTION.heal) { this.healing = 0; I.cure(sim, pat); }
      return;
    }
    this.healing = 0;
    if (fight) { if ((this.reT = (this.reT || 0) - dt) <= 0 || this.sector < 0) { this.reT = 6; this.sector = this.threat(sim); } tx = this.sector * SECTOR_W + SECTOR_W / 2 + 6; tz = WALL_Z1 + wallOff(tx) + 5; }
    else { this.sector = -1; const h = this.home(sim); tx = h.x; tz = h.z; }
    const Wt = sim.water; let det = false; if (Wt) { Wt.eject(this); const a = Wt.aim(this, tx, tz); if (a.x !== tx || a.z !== tz) { tx = a.x; tz = a.z; det = true; } }   // (v11.3) contourne l'eau
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz), st = PRIEST.speed * dt;
    if (d > st || det) { const k = Math.min(st, d); let nx = this.x + dx / (d || 1) * k, nz = this.z + dz / (d || 1) * k; if (Wt) [nx, nz] = Wt.guard(this.x, this.z, nx, nz); this.x = nx; this.z = nz; this.face = Math.atan2(dx, dz); this.post = false; }
    else { this.x = tx; this.z = tz; this.post = fight; if (fight) this.face = Math.PI; }
    if (!this.post) return;
    const Z = sim.zombies;
    // exorcisme : lumière sacrée sur le groupe de zombies le plus proche
    if (L >= PRIEST.exo.level && (this.cd -= dt) <= 0) {
      const E = PRIEST.exo, m = sim.hash.query(this.x, this.z, E.reach, Z.x, Z.z, tmp); let best = -1, bd = Infinity;
      for (let q = 0; q < m; q++) { const i = tmp[q]; if (Z.hp[i] <= 0) continue; const dd = (Z.x[i] - this.x) ** 2 + (Z.z[i] - this.z) ** 2; if (dd < bd) { bd = dd; best = i; } }
      if (best >= 0) {
        const cx = Z.x[best], cz = Z.z[best], dmg = E.dmg * (1 + E.dmgPerLevel * (L - E.level)), k = sim.hash.query(cx, cz, E.r, Z.x, Z.z, tmp);
        for (let q = 0; q < k; q++) { const i = tmp[q]; if (Z.hp[i] > 0) Z.hit(i, dmg * (Z.type[i] === 6 ? E.golem : 1)); }
        sim.blast('holy', cx, cz, E.r); sim.events.push({ type: 'exorcism', x: cx, z: cz }); this.cd = E.cd; this.cast = 1.0;
      } else this.cd = 0.5;
    }
    // sanctuaire : zombies ralentis autour du prêtre (côté muraille), escouades proches soignées
    if (L >= PRIEST.sanct.level) {
      const S = PRIEST.sanct, wx = this.x, wz = WALL_Z0 + wallOff(this.x) - 4, k = sim.hash.query(wx, wz, S.r, Z.x, Z.z, tmp);
      for (let q = 0; q < k; q++) { const i = tmp[q]; if (Z.hp[i] > 0 && Z.slow[i] < 0.25) Z.slow[i] = 0.25; }
      if ((this.healT -= dt) <= 0) { this.healT = 1; for (const sq of sim.army.squads) if (Math.hypot(sq.x - this.x, sq.z - this.z) < S.r * 2 && sim.army.healSquad) sim.army.healSquad(sq, S.heal); }
    }
  }
  serialize() { return this.here ? { x: +this.x.toFixed(2), z: +this.z.toFixed(2) } : null; }
  restore(st) { this.reset(); if (st) { this.here = true; this.x = this.px = st.x; this.z = this.pz = st.z; } }
}
