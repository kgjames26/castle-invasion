// Hordes : agents individuels en tableaux typés (SoA). Dans ce prototype tous les zombies sont simulés ;
// l'architecture prévoit des cohortes agrégées au-delà (voir conception §6).
import { MAX_Z, W, WALL_Z1, WALL_Z0, WALL_STAND_Z, GW, CELL, CASTLE, SECTORS, segOfX } from './constants.js';
import { ZOMBIES, SQUAD } from '../content/medieval.js';
import { COST, T } from './terrain.js';

const INSIDE_Z = WALL_Z1 + 0.8;
const tmp = new Int32Array(64);

export class ZombieSwarm {
  constructor() {
    const n = MAX_Z;
    this.x = new Float32Array(n); this.z = new Float32Array(n); this.px = new Float32Array(n); this.pz = new Float32Array(n);
    this.hp = new Float32Array(n); this.type = new Uint8Array(n); this.sector = new Uint8Array(n); this.state = new Uint8Array(n);
    this.phase = new Float32Array(n);
    this.n = 0; this.kills = 0;
    this.near = new Int16Array(SECTORS);      // zombies proches (z>95) par secteur ciblé
    this.attacking = new Int16Array(SECTORS);
    this.dead = false;
  }
  clear() { this.n = 0; this.near.fill(0); this.attacking.fill(0); }
  spawn(type, x, z, sector, rng) {
    if (this.n >= MAX_Z) return false;
    const i = this.n++;
    this.x[i] = this.px[i] = x; this.z[i] = this.pz[i] = z;
    this.hp[i] = ZOMBIES[type].hp; this.type[i] = type; this.sector[i] = sector; this.state[i] = 0;
    this.phase[i] = rng() * 6.28;
    return true;
  }
  hit(i, dmg) { if (this.hp[i] > 0) { this.hp[i] -= dmg; if (this.hp[i] <= 0) { this.kills++; this.dead = true; } } }
  compact() {
    if (!this.dead) return; this.dead = false;
    for (let i = this.n - 1; i >= 0; i--) if (this.hp[i] <= 0) this.removeAt(i);
  }
  removeAt(i) {
    const l = --this.n; if (i === l) return;
    this.x[i] = this.x[l]; this.z[i] = this.z[l]; this.px[i] = this.px[l]; this.pz[i] = this.pz[l];
    this.hp[i] = this.hp[l]; this.type[i] = this.type[l]; this.sector[i] = this.sector[l]; this.state[i] = this.state[l]; this.phase[i] = this.phase[l];
  }

  update(dt, sim) {
    const { flow, wall, terrain, hash, army } = sim;
    const X = this.x, Z = this.z, n = this.n;
    hash.rebuild(X, Z, n);
    this.near.fill(0); this.attacking.fill(0);
    const squads = army.squads, outside = army.outside;
    for (let i = 0; i < n; i++) {
      this.px[i] = X[i]; this.pz[i] = Z[i];
      if (this.hp[i] <= 0) continue;
      const t = ZOMBIES[this.type[i]], s = this.sector[i];
      let x = X[i], z = Z[i];
      const gx = Math.min(GW - 1, (x / CELL) | 0), gz = Math.min(159, (z / CELL) | 0);
      const cost = Math.min(2, COST[terrainType(terrain, gx, gz)]);
      const speed = t.speed / cost;

      if (z > INSIDE_Z) {                                   // ——— dans le royaume
        this.state[i] = 2;
        // cible : escouade proche (dans le royaume), sinon château
        let tx = CASTLE.x, tz = CASTLE.z - CASTLE.r * 0.6, ts = null, bd = 100;
        for (let k = 0; k < squads.length; k++) {
          const so = squads[k]; if (so.hp <= 0 || so.z < WALL_Z1) continue;
          const d = (so.x - x) * (so.x - x) + (so.z - z) * (so.z - z);
          if (d < bd) { bd = d; ts = so; }
        }
        if (ts) { tx = ts.x; tz = ts.z; }
        const vx = tx - x, vz = tz - z, d = Math.hypot(vx, vz) || 1;
        if (ts && d < ts.rad + 0.8) { if (ts.attackers < ts.cap) { ts.attackers++; army.hurtSquad(sim, ts, t.unit * dt); } continue; }
        if (!ts && d < CASTLE.r * 0.6 + 1.2) { sim.hurtCastle(t.wall * 0.5 * dt); continue; }
        X[i] = x + vx / d * speed * dt; Z[i] = z + vz / d * speed * dt;
        continue;
      }
      // ——— à l'extérieur : escouade en sortie à proximité ? sinon champ de flux ; puis séparation
      let dx = 0, dz = 1, engaged = null;
      if (outside.length) {
        let bd = Infinity;
        for (let k = 0; k < outside.length; k++) {
          const so = outside[k]; if (so.hp <= 0) continue;
          const d = Math.hypot(so.x - x, so.z - z) - so.rad; if (d < SQUAD.aggro && d < bd) { bd = d; engaged = so; }
        }
      }
      if (engaged) {
        const ex = engaged.x - x, ez = engaged.z - z, ed = Math.hypot(ex, ez) || 1;
        if (ed < engaged.rad + 0.8) {                       // au contact : frappe si une place est libre sur le front de l'escouade
          if (engaged.attackers < engaged.cap) { engaged.attackers++; army.hurtSquad(sim, engaged, t.unit * dt); this.state[i] = 1; if (Z[i] > 95) this.near[s]++; continue; }
          dx = 0; dz = 0;
        } else { dx = ex / ed; dz = ez / ed; }
      } else if (flow.sample(s, x, z)) { dx = flow.sx; dz = flow.sz; }
      let sx = 0, sz = 0;
      const m = hash.query(x, z, 1.1, X, Z, tmp);
      for (let k = 0, c = 0; k < m && c < 6; k++) {
        const j = tmp[k]; if (j === i) continue; c++;
        const ox = x - X[j], oz = z - Z[j], d2 = ox * ox + oz * oz || 0.01, d = Math.sqrt(d2);
        const f = (1.1 - d) / 1.1; sx += ox / d * f; sz += oz / d * f;
      }
      let vx = dx * speed + sx * speed * 1.1, vz = dz * speed + sz * speed * 1.1;
      let nx = x + vx * dt, nz = z + vz * dt;
      // mur
      let attacking = false;
      if (nz > WALL_STAND_Z && nz < WALL_Z1 + 0.5) {
        const seg = segOfX(nx);
        if (wall.hp[seg] > 0) {
          nz = Math.min(nz, WALL_STAND_Z); attacking = true;
          if (wall.damage(seg, t.wall * dt)) sim.onBreach(seg);
        }
      } else if (nz >= WALL_STAND_Z - 0.3 && nz <= WALL_STAND_Z + 0.05) {
        // reste au contact : continue d'attaquer
        const seg = segOfX(nx);
        if (wall.hp[seg] > 0) { attacking = true; if (wall.damage(seg, t.wall * dt)) sim.onBreach(seg); }
      }
      // rochers : glissement par axe
      if (terrainType(terrain, Math.min(GW - 1, Math.max(0, (nx / CELL) | 0)), Math.min(159, (z / CELL) | 0)) === T.ROCK) nx = x;
      if (terrainType(terrain, Math.min(GW - 1, Math.max(0, (nx / CELL) | 0)), Math.min(159, Math.max(0, (nz / CELL) | 0))) === T.ROCK) nz = z;
      X[i] = nx < 0.5 ? 0.5 : nx > W - 0.5 ? W - 0.5 : nx; Z[i] = nz < 0.5 ? 0.5 : nz;
      this.state[i] = attacking ? 1 : 0;
      if (attacking) this.attacking[s]++;
      if (Z[i] > 95) this.near[s]++;
    }
  }
}
function terrainType(terrain, gx, gz) { return terrain.type[gz * GW + gx]; }
