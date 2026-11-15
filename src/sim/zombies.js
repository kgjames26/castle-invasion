// Hordes : agents individuels en tableaux typés (SoA). Dans ce prototype tous les zombies sont simulés ;
// l'architecture prévoit des cohortes agrégées au-delà (voir conception §6).
import { MAX_Z, W, WALL_Z1, WALL_Z0, WALL_STAND_Z, GW, CELL, CASTLE, SECTORS, segOfX, wallOff, sectorOfX } from './constants.js';
import { GOLEM, ZOMBIES, SQUAD, INFECTION, ZOMBIE_PACE, FIRE } from '../content/medieval.js';
import { COST, T } from './terrain.js';

const INSIDE_Z = WALL_Z1 + 0.8;      // + wallOff(x) : la muraille est en arc
const tmp = new Int32Array(64);
const GROUPS = 1024;     // identifiants de hordes (cycliques)

export class ZombieSwarm {
  constructor() {
    const n = MAX_Z;
    this.x = new Float32Array(n); this.z = new Float32Array(n); this.px = new Float32Array(n); this.pz = new Float32Array(n);
    this.hp = new Float32Array(n); this.type = new Uint8Array(n); this.sector = new Uint8Array(n); this.state = new Uint8Array(n);
    this.phase = new Float32Array(n);
    // hordes : chaque zombie garde sa place (ox, oz) autour du centre de son groupe → ils avancent en masse, pas à la file
    this.grp = new Int32Array(n); this.ox = new Float32Array(n); this.oz = new Float32Array(n); this.slow = new Float32Array(n); this.slam = new Float32Array(n); this.slams = [];
    // morsures (v2.4) : bite = temps restant de l'animation, biteK = 1 morsure debout, 2 plongeon, 3 déchirement (géant), 4 coup (lourd) ; turned = ancien soldat
    this.bite = new Float32Array(n); this.biteK = new Uint8Array(n); this.rush = new Uint8Array(n); this.rushD = new Float32Array(n); this.rushK = new Float32Array(n); this.farK = new Float32Array(n); this.turned = new Uint8Array(n); this.atkT = new Float32Array(n);
    this.gx = new Float32Array(GROUPS); this.gz = new Float32Array(GROUPS); this.gn = new Int32Array(GROUPS); this.hpMult = 1;
    this.n = 0; this.kills = 0; this.fallen = []; this.killsBySector = new Float32Array(SECTORS); this.climb = new Float32Array(n); this.flash = new Float32Array(n); this.burnT = new Float32Array(n);   // burnT (v9.8) : secondes pendant lesquelles le zombie brûle   // (v5.0) éclair blanc quand il est touché (vue seulement)
    this.near = new Int16Array(SECTORS);      // zombies proches (z>95) par secteur ciblé
    this.attacking = new Int16Array(SECTORS);
    this.dead = false;
  }
  clear() { this.n = 0; this.near.fill(0); this.attacking.fill(0); }
  spawn(type, x, z, sector, rng, grp = 0, ox = 0, oz = 0) {
    if (this.n >= MAX_Z) return false;
    const i = this.n++;
    this.x[i] = this.px[i] = x; this.z[i] = this.pz[i] = z;
    this.hp[i] = ZOMBIES[type].hp * this.hpMult; this.type[i] = type; this.sector[i] = sector; this.state[i] = 0;
    this.grp[i] = grp; this.ox[i] = ox; this.oz[i] = oz; this.slow[i] = 0; this.slam[i] = 1.5; this.bite[i] = 0; this.biteK[i] = 0; this.rush[i] = 0; this.turned[i] = 0; this.atkT[i] = 0.5; this.climb[i] = 0; if (this.trapped) this.trapped[i] = 0;
    this.phase[i] = rng() * 6.28;
    // allure (v3.1) : chaque horde a sa propre distance de charge (de 12 à 105 m de la muraille), chaque zombie s'en écarte ;
    // quelques isolés chargent n'importe quand → les uns traînent encore quand les autres se ruent déjà
    const gh = ((Math.imul(grp + 7, 2654435761) >>> 0) % 1000) / 1000, P = ZOMBIE_PACE;
    this.rushD[i] = rng() < 0.12 ? P.minD + rng() * (P.maxD - P.minD) : (P.minD + gh * (P.maxD - P.minD)) * (0.65 + rng() * 0.7);
    this.rushK[i] = P.rushMin + rng() * (P.rushMax - P.rushMin); this.farK[i] = P.farMin + rng() * (P.farMax - P.farMin);
    return true;
  }
  // multiplicateur d'allure selon la distance à la muraille : traîne (< 1) au loin, charge (> 1) une fois sa distance franchie
  pace(i, x, z) { if (!this.grp[i]) return 1; const dw = WALL_Z0 + wallOff(x) - z; return dw > this.rushD[i] ? this.farK[i] : dw > -2 ? this.rushK[i] : 1; }
  hit(i, dmg) { if (this.hp[i] > 0) { this.hp[i] -= dmg; if (dmg > 0.5) this.flash[i] = 1; if (this.hp[i] <= 0) { this.kills++; this.dead = true; this.killsBySector[this.sector[i]]++; if (this.type[i] === 7) this.bossDown = true; if (this.fallen.length < 160) this.fallen.push({ x: this.x[i], z: this.z[i], t: this.type[i], ph: this.phase[i], dx: this.x[i] - this.px[i], dz: this.z[i] - this.pz[i] }); } } }   // fallen : cadavres à afficher (vue)
  compact() {
    if (!this.dead) return; this.dead = false;
    for (let i = this.n - 1; i >= 0; i--) if (this.hp[i] <= 0) this.removeAt(i);
  }
  removeAt(i) {
    const l = --this.n; if (i === l) return;
    this.x[i] = this.x[l]; this.z[i] = this.z[l]; this.px[i] = this.px[l]; this.pz[i] = this.pz[l];
    this.flash[i] = this.flash[l]; this.burnT[i] = this.burnT[l]; this.hp[i] = this.hp[l]; this.type[i] = this.type[l]; this.sector[i] = this.sector[l]; this.state[i] = this.state[l]; this.phase[i] = this.phase[l];
    this.grp[i] = this.grp[l]; this.ox[i] = this.ox[l]; this.oz[i] = this.oz[l]; this.slow[i] = this.slow[l]; this.slam[i] = this.slam[l];
    this.bite[i] = this.bite[l]; this.biteK[i] = this.biteK[l]; this.climb[i] = this.climb[l]; if (this.trapped) this.trapped[i] = this.trapped[l]; this.rush[i] = this.rush[l]; this.rushD[i] = this.rushD[l]; this.rushK[i] = this.rushK[l]; this.farK[i] = this.farK[l]; this.turned[i] = this.turned[l]; this.atkT[i] = this.atkT[l];
  }
  // animation d'attaque au contact d'une escouade : morsure (mordeurs), coup (lourds) ; le plongeon et le déchirement sont déclenchés par la morsure elle-même
  // (golem : coup de masse, biteK 5)
  swing(i, dt, rng) { if (this.bite[i] > 0 || (this.atkT[i] -= dt) > 0) return; this.atkT[i] = 1.0 + rng() * 0.7; const t = this.type[i]; if (INFECTION.killers.includes(t)) { if (t === 6) { this.bite[i] = 1.4; this.biteK[i] = 5; this.atkT[i] = 1.8; } else { this.bite[i] = 0.9; this.biteK[i] = 4; } } else if (!INFECTION.tearers.includes(t)) { this.bite[i] = 0.75; this.biteK[i] = 1; } }

  update(dt, sim) {
    for (let i = 0; i < this.n; i++) { if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt * 7);
      if (this.burnT[i] > 0) { this.burnT[i] -= dt; if (this.hp[i] > 0) { const b = FIRE.dps * 0.45 * dt; if (this.hp[i] - b <= 0) this.hit(i, b + 1); else this.hp[i] -= b; } } }   // (v9.8) un zombie en feu continue de brûler
    const { flow, wall, terrain, hash, army } = sim;
    const X = this.x, Z = this.z, n = this.n;
    hash.rebuild(X, Z, n);
    this.near.fill(0); this.attacking.fill(0);
    const squads = army.squads, outside = army.outside, INF = sim.infection;
    // centre de chaque horde (zombies encore dehors et en marche)
    const GX = this.gx, GZ = this.gz, GN = this.gn; GN.fill(0); GX.fill(0); GZ.fill(0);
    for (let i = 0; i < n; i++) { const g = this.grp[i]; if (!g || this.hp[i] <= 0 || Z[i] > WALL_STAND_Z + wallOff(X[i]) - 1 || this.state[i] === 1) continue; const k = g % GROUPS; GX[k] += X[i] - this.ox[i]; GZ[k] += Z[i] - this.oz[i]; GN[k]++; }
    for (let k = 0; k < GROUPS; k++) if (GN[k]) { GX[k] /= GN[k]; GZ[k] /= GN[k]; }
    for (let i = 0; i < n; i++) {
      this.px[i] = X[i]; this.pz[i] = Z[i];
      if (this.hp[i] <= 0) continue;
      const t = ZOMBIES[this.type[i]], s = this.sector[i];
      let x = X[i], z = Z[i];
      const gx = Math.min(GW - 1, (x / CELL) | 0), gz = Math.min(159, (z / CELL) | 0);
      const cost = Math.min(2, COST[terrainType(terrain, gx, gz)]);
      let speed = t.speed / cost;
      { const k = this.pace(i, x, z); speed *= k; if (k > 1) this.rush[i] = 1; }
      if (sim.extras && z < INSIDE_Z + wallOff(x)) speed *= sim.extras.zombieStep(this, i, x, z, dt);   // pièges, douves, neige (v4.0)
      if (this.hp[i] <= 0) continue;   // ils traînent, puis se ruent sur la muraille
      if (this.slow[i] > 0) { this.slow[i] -= dt; speed *= 0.4; }
      if (this.bite[i] > 0) { this.bite[i] -= dt; if (this.biteK[i] >= 2) continue; }          // plongeon / déchirement : immobile le temps de l'animation
      // un mordu à terre attire les zombies proches : ils se ruent pour le dévorer
      const prey = INF && INF.list.length ? INF.prey(x, z) : null;
      if (prey) { const vx = prey.x - x, vz = prey.z - z, d = Math.hypot(vx, vz) || 1; if (d > 0.9) { X[i] = x + vx / d * speed * 1.25 * dt; Z[i] = z + vz / d * speed * 1.25 * dt; } else { this.state[i] = 1; if (this.bite[i] <= 0) { this.bite[i] = 0.6; this.biteK[i] = 1; } } continue; }

      if (z > INSIDE_Z + wallOff(x)) {                                   // ——— dans le royaume
        this.state[i] = 2;
        // cible : escouade proche (dans le royaume), sinon château
        let tx = CASTLE.x, tz = CASTLE.z - CASTLE.r * 0.6, ts = null, bd = 100;
        for (let k = 0; k < squads.length; k++) {
          const so = squads[k]; if (so.hp <= 0 || so.z < WALL_Z1 + wallOff(so.x)) continue;
          const d = (so.x - x) * (so.x - x) + (so.z - z) * (so.z - z);
          if (d < bd) { bd = d; ts = so; }
        }
        if (ts) { tx = ts.x; tz = ts.z; }
        // (v4.0) un zombie dans le village mord les villageois qu'il croise : ils se relèvent zombies
        if ((this.atkT[i] -= dt) <= 0) { this.atkT[i] = 0.4; const vs = sim.eco.villagers; for (let q = 0; q < vs.length; q++) { const v = vs[q]; if ((v.x - x) ** 2 + (v.z - z) ** 2 < 1.6) { sim.eco.killVillager(v); if (this.spawn(0, v.x, v.z, sectorOfX(Math.min(W - 1, Math.max(0, v.x))), sim.rng)) this.turned[this.n - 1] = 1; sim.events.push({ type: 'villagerBitten', x: v.x, z: v.z }); break; } } }
        const vx = tx - x, vz = tz - z, d = Math.hypot(vx, vz) || 1;
        if (ts && d < ts.rad + 0.8) { if (ts.attackers < ts.cap) { ts.attackers++; this.swing(i, dt, sim.rng); army.hurtSquad(sim, ts, t.unit * dt, i); } continue; }
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
          const d = Math.hypot(so.x - x, so.z - z) - so.rad, ag = SQUAD.aggro * (army.hpRatio(so) < 0.75 ? INFECTION.blood : 1); if (d < ag && d < bd) { bd = d; engaged = so; }   // l'odeur du sang attire de plus loin
        }
      }
      if (engaged) {
        const ex = engaged.x - x, ez = engaged.z - z, ed = Math.hypot(ex, ez) || 1;
        if (ed < engaged.rad + 0.8) {                       // au contact : frappe si une place est libre sur le front de l'escouade
          if (engaged.attackers < engaged.cap) { engaged.attackers++; this.swing(i, dt, sim.rng); army.hurtSquad(sim, engaged, t.unit * dt, i); this.state[i] = 1; if (Z[i] > 95) this.near[s]++; continue; }
          dx = 0; dz = 0;
        } else { dx = ex / ed; dz = ez / ed; }
      } else if (flow.sample(s, x, z)) {
        dx = flow.sx; dz = flow.sz;
        // (v4.0) trajets variés : chaque horde dérive de son côté, chaque zombie serpente (loin de la muraille seulement)
        { const dw = WALL_Z0 + wallOff(x) - z; if (dw > 6) { const g = this.grp[i], gb = g ? ((g * 0.6180339) % 1 - 0.5) * 0.9 : 0, wv = 0.55 * Math.sin(sim.time * (0.18 + (this.phase[i] % 1) * 0.2) + this.phase[i] * 3 + g) + gb, k = Math.min(1, (dw - 6) / 20) * wv; dx += -dz * k; dz += dx * k * 0.15; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; } }
        const g = this.grp[i], k = g % GROUPS;
        if (g && GN[k] > 2 && z < WALL_STAND_Z + wallOff(x) - 3) {
          // cohésion : rejoindre sa place dans la horde ; ceux qui sont devant ralentissent, ceux qui traînent accélèrent
          const px = GX[k] + this.ox[i] - x, pz = GZ[k] + this.oz[i] - z, pl = Math.hypot(px, pz);
          // au-delà de 14 m, le zombie a perdu sa horde : il suit seul le flux (évite les blocages)
          if (pl > 0.4 && pl < 14) { const f = Math.min(0.6, pl * 0.12); dx += px / pl * f; dz += pz / pl * f; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; }
          const ahead = -(px * flow.sx + pz * flow.sz);
          if (pl < 14) speed *= ahead > 1.5 ? 0.7 : ahead < -1.5 ? 1.2 : 1;
        }
      }
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
      const wo = wallOff(nx), WSZ = WALL_STAND_Z + wo;
      const ty = this.type[i];
      // palissade (v4.0) : arrête la horde plus au nord tant qu'elle tient
      if (sim.extras && !engaged && sim.extras.palisade(nx, nz, t.wall, dt, i)) { nz = Math.min(nz, z); attacking = true; X[i] = nx; Z[i] = nz; this.state[i] = 1; this.attacking[s]++; continue; }
      // cracheur (9) : s'arrête à distance et ronge la pierre à l'acide
      if (ty === 9 && nz > WSZ - 13 && wall.hp[segOfX(nx)] > 0) { nz = Math.min(nz, WSZ - 13); const seg = segOfX(nx); if ((this.slam[i] -= dt) <= 0) { this.slam[i] = 1.6; if (wall.damage(seg, t.wall * 1.6)) sim.onBreach(seg); if (sim.extras && sim.extras.spits.length < 40) sim.extras.spits.push({ x0: nx, z0: nz, x1: nx, z1: WSZ + 0.5, t: 0 }); } X[i] = nx; Z[i] = nz; this.state[i] = 1; this.attacking[s]++; continue; }
      if (nz > WSZ && nz < WALL_Z1 + wo + 0.5) {
        const seg = segOfX(nx);
        if (wall.hp[seg] > 0) {
          nz = Math.min(nz, WSZ); attacking = true;
          if (wall.damage(seg, t.wall * dt)) sim.onBreach(seg);
        }
      } else if (nz >= WSZ - 0.3 && nz <= WSZ + 0.05) {
        // reste au contact : continue d'attaquer
        const seg = segOfX(nx);
        if (wall.hp[seg] > 0) { attacking = true; if (wall.damage(seg, t.wall * dt)) sim.onBreach(seg); }
      }
      // rochers : glissement par axe
      if (terrainType(terrain, Math.min(GW - 1, Math.max(0, (nx / CELL) | 0)), Math.min(159, (z / CELL) | 0)) === T.ROCK) nx = x;
      if (terrainType(terrain, Math.min(GW - 1, Math.max(0, (nx / CELL) | 0)), Math.min(159, Math.max(0, (nz / CELL) | 0))) === T.ROCK) nz = z;
      X[i] = nx < 0.5 ? 0.5 : nx > W - 0.5 ? W - 0.5 : nx; Z[i] = nz < 0.5 ? 0.5 : nz;
      this.state[i] = attacking ? 1 : 0;
      if (attacking && (this.type[i] === 6 || this.type[i] === 7) && (this.slam[i] -= dt) <= 0) { this.slam[i] = this.type[i] === 7 ? GOLEM.every * 0.7 : GOLEM.every; this.slams.push({ x: X[i], seg: segOfX(X[i]), boss: this.type[i] === 7 }); }   // coup sismique du golem / du boss
      if (attacking && ty === 10) { const seg = segOfX(X[i]); for (let d = -1; d <= 1; d++) { const k2 = seg + d; if (k2 >= 0 && k2 < wall.hp.length && wall.hp[k2] > 0 && wall.damage(k2, d ? 90 : 260)) sim.onBreach(k2); } sim.blast('boom', X[i], Z[i], 5); this.hit(i, 1e9); continue; }   // gonflé : explose contre la muraille
      if (attacking && ty === 8 && (this.climb[i] += dt) > 5) { Z[i] = INSIDE_Z + wallOff(X[i]) + 1.5; this.climb[i] = 0; sim.events.push({ type: 'climber', x: X[i] }); }   // grimpeur : passe par-dessus après quelques secondes
      if (attacking) this.attacking[s]++;
      if (Z[i] > 95) this.near[s]++;
    }
  }
}
function terrainType(terrain, gx, gz) { return terrain.type[gz * GW + gx]; }
