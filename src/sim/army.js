// Armée : réserve, archers de garnison (chemin de ronde), ESCOUADES avec formations (garnison ou sortie sur le champ de bataille),
// files d'entraînement. Les escouades agissent comme une seule entité : points de vie en réserve commune, membres dessinés par formation.
import { SECTORS, SECTOR_W, ARCHER_SLOTS, ARCHER_Z, GARRISON_Z, GATE_X, WALL_Z0, WALL_Z1 } from './constants.js';
import { UNITS, UNIT_ORDER, FORMATIONS, SQUAD, TRAIN } from '../content/medieval.js';

const tmp = new Int32Array(1024), tmp2 = new Int32Array(1024);
export const archerPos = (s, k) => ({ x: s * SECTOR_W + ((k >> 1) + 0.5) * SECTOR_W / (ARCHER_SLOTS / 2), z: ARCHER_Z + (k & 1) * 2.4 - 1.2 });
export const TRAIN_BUILDINGS = ['barracks', 'stable', 'range'];

// ——— formations : décalages des membres autour du centre (z négatif = devant, vers le nord) ———
const cache = new Map();
export function formationLayout(form, n, size = 1) {
  const key = form + '|' + n + '|' + size; let L = cache.get(key); if (L) return L;
  const xs = new Float32Array(n), zs = new Float32Array(n), sp = 1.7 * size;
  const grid = (cols, spx, spz, rows) => { for (let k = 0; k < n; k++) { xs[k] = ((k % cols) - (cols - 1) / 2) * spx; zs[k] = (((k / cols) | 0) - (rows - 1) / 2) * spz; } };
  if (form === 'line') { const c = Math.ceil(n / 2); grid(c, sp, sp, 2); }
  else if (form === 'phalanx') { const c = Math.ceil(n / 3); grid(c, sp * 0.75, sp * 0.75, 3); }
  else if (form === 'column') { grid(2, sp, sp, Math.ceil(n / 2)); }
  else if (form === 'square') { const c = Math.ceil(Math.sqrt(n)); grid(c, sp, sp, c); }
  else { // coin : 1, 2, 3… membres par rangée, pointe vers le nord
    let rows = 0, t = 0; while (t < n) { rows++; t += rows; }
    for (let k = 0; k < n; k++) { let rr = 0, l = k; while (l > rr) { l -= rr + 1; rr++; } xs[k] = (l - rr / 2) * sp; zs[k] = (rr - (rows - 1) / 2) * sp; }
  }
  let rad = 0; for (let k = 0; k < n; k++) rad = Math.max(rad, Math.hypot(xs[k], zs[k]));
  L = { xs, zs, radius: rad + 1.2 }; cache.set(key, L); return L;
}

export class Army {
  constructor() {
    this.reserve = { archer: 0, soldier: 0, heavy: 0, cavalry: 0 };
    this.archers = Array.from({ length: SECTORS }, () => ({ n: 0, cd: new Float32Array(ARCHER_SLOTS) }));
    this.squads = []; this.nextId = 1; this.outside = [];
    this.queues = { barracks: [], stable: [], range: [] };
  }
  // ——— population ———
  popUsed() {
    let p = 0; for (const t in this.reserve) p += this.reserve[t] * UNITS[t].pop;
    for (const a of this.archers) p += a.n; for (const q of this.squads) p += q.n * UNITS[q.type].pop;
    for (const b in this.queues) for (const it of this.queues[b]) p += UNITS[it.type].pop;
    return p;
  }
  headcount() { let p = 0; for (const t in this.reserve) p += this.reserve[t]; for (const a of this.archers) p += a.n; for (const q of this.squads) p += q.n; return p; }
  meleeIn(s) { let n = 0; for (const q of this.squads) if (q.mode === 'garrison' && q.sector === s) n += q.n; return n; }
  // ——— archers de garnison ———
  assignArchers(s, delta) {
    let moved = 0;
    for (let k = 0; k < Math.abs(delta); k++) {
      const a = this.archers[s];
      if (delta > 0) { if (this.reserve.archer <= 0 || a.n >= ARCHER_SLOTS) break; this.reserve.archer--; a.cd[a.n] = Math.random() * 0.8; a.n++; moved++; }
      else { if (a.n <= 0) break; a.n--; this.reserve.archer++; moved++; }
    }
    return moved;
  }
  // ——— entraînement ———
  queueMax(sim, b) { return TRAIN.baseQueue + TRAIN.queuePerLevel * (sim.eco.level[b] - 1); }
  trainTime(sim, b, type) { return UNITS[type].train / (1 + TRAIN.speedPerLevel * (sim.eco.level[b] - 1)); }
  canTrain(sim, type) {
    const U = UNITS[type], b = U.from, lv = sim.eco.level[b];
    return lv >= 1 && lv >= (U.minLevel || 1);
  }
  enqueue(sim, type, count = 1) {
    const U = UNITS[type], b = U.from; let ok = 0;
    for (let k = 0; k < count; k++) {
      if (!this.canTrain(sim, type) || this.queues[b].length >= this.queueMax(sim, b) || sim.eco.popRoom() < U.pop || !sim.eco.pay(U.cost)) break;
      this.queues[b].push({ type, t: this.trainTime(sim, b, type), full: this.trainTime(sim, b, type) }); ok++;
    }
    return ok;
  }
  cancel(sim, b) {
    const it = this.queues[b].pop(); if (!it) return false;
    for (const r in UNITS[it.type].cost) sim.eco.add(r, UNITS[it.type].cost[r]); return true;
  }
  trainTick(dt) {
    for (const b of TRAIN_BUILDINGS) { const q = this.queues[b]; if (!q.length) continue; q[0].t -= dt; if (q[0].t <= 0) { this.reserve[q[0].type]++; q.shift(); } }
  }
  // ——— escouades ———
  unitHp(type) { return UNITS[type].hp; }
  maxN(type) { return UNITS[type].squad; }
  formSquad(type, size, sector = 2) {
    const U = UNITS[type]; if (!U.squad || this.squads.length >= SQUAD.maxSquads) return null;
    const n = Math.min(size, U.squad, this.reserve[type]); if (n <= 0) return null;
    this.reserve[type] -= n;
    const q = { id: this.nextId++, type, n, hp: n * U.hp, form: U.form, mode: 'garrison', sector, x: 0, z: 0, px: 0, pz: 0, postX: 0, postZ: 0, tx: 0, tz: 0, way: [], stance: 'hold', atkAcc: 0, rot: 0, mom: 0, attackers: 0, cap: 0, hit: 0, fresh: true, rad: 3 };
    this.squads.push(q); this.layoutPosts(); return q;
  }
  reinforce(q) { const k = Math.min(this.maxN(q.type) - q.n, this.reserve[q.type]); if (k <= 0) return 0; this.reserve[q.type] -= k; q.n += k; q.hp += k * this.unitHp(q.type); return k; }
  disband(q) { this.reserve[q.type] += q.n; this.squads.splice(this.squads.indexOf(q), 1); this.layoutPosts(); }
  setForm(q, f) { if (FORMATIONS[f]) q.form = f; }
  setStance(q, st) { q.stance = st; }
  garrison(q, s) { q.mode = 'garrison'; q.sector = s; this.layoutPosts(); this.route(q, q.postX, q.postZ); }
  sortie(q, x, z) {
    q.mode = 'field'; q.tx = Math.min(196, Math.max(4, x)); q.tz = Math.min(SQUAD.sortieZ[1], Math.max(SQUAD.sortieZ[0], z));
    this.layoutPosts(); this.route(q, q.tx, q.tz);
  }
  // les escouades franchissent la muraille par la PORTE (centre) : trajet intérieur ↔ extérieur
  route(q, tx, tz) {
    q.way = []; const inside = q.z > WALL_Z1, toOut = tz < WALL_Z0;
    if (inside && toOut) q.way.push({ x: GATE_X, z: GARRISON_Z }, { x: GATE_X, z: WALL_Z0 - 4 });
    else if (!inside && !toOut) q.way.push({ x: GATE_X, z: WALL_Z0 - 4 }, { x: GATE_X, z: GARRISON_Z });
    q.way.push({ x: tx, z: tz });
  }
  layoutPosts() {
    const idx = new Array(SECTORS).fill(0);
    for (const q of this.squads) {
      if (q.mode !== 'garrison') continue;
      const k = idx[q.sector]++, col = k % 4, row = (k / 4) | 0;
      q.postX = q.sector * SECTOR_W + 5 + col * 10; q.postZ = GARRISON_Z + row * 7 + (UNITS[q.type].size > 1.2 && q.type === 'cavalry' ? 3 : 0);
      if (q.fresh) { q.x = q.px = q.postX; q.z = q.pz = q.postZ; q.fresh = false; }
    }
    for (const q of this.squads) if (q.fresh) { q.x = q.px = 100; q.z = q.pz = GARRISON_Z; q.fresh = false; }
  }
  // dégâts reçus par une escouade (formation + armures)
  hurtSquad(sim, q, dmg) {
    if (q.hp <= 0) return;
    q.hp -= dmg * FORMATIONS[q.form].def * (1 - 0.08 * sim.eco.up.armor); q.hit = 0.3;
    q.n = Math.max(0, Math.ceil(q.hp / this.unitHp(q.type)));
  }
  // ——— tick ———
  update(dt, sim) {
    const Z = sim.zombies, hash = sim.hash, eco = sim.eco, w = eco.up.weapons, ar = eco.up.archery;
    this.trainTick(dt);
    // archers
    const AU = UNITS.archer, range = AU.range + 3 * ar, adm = AU.dmg * (1 + 0.1 * w) * (1 + 0.1 * ar);
    for (let s = 0; s < SECTORS; s++) {
      const a = this.archers[s];
      for (let k = 0; k < a.n; k++) {
        a.cd[k] -= dt; if (a.cd[k] > 0) continue;
        const p = archerPos(s, k), m = hash.query(p.x, p.z, range, Z.x, Z.z, tmp);
        let best = -1, bd = Infinity;
        for (let q = 0; q < m; q++) { const i = tmp[q]; if (Z.hp[i] <= 0) continue; const d = (Z.x[i] - p.x) ** 2 + (Z.z[i] - p.z) ** 2; if (d < bd) { bd = d; best = i; } }
        if (best < 0) { a.cd[k] = 0.25; continue; }
        Z.hit(best, adm); if (sim.arrows.length < 220) sim.arrows.push({ x0: p.x, z0: p.z, x1: Z.x[best], z1: Z.z[best], t: 0 });
        a.cd[k] = AU.rate * (0.9 + sim.rng() * 0.2);
      }
    }
    // escouades
    for (const q of this.squads) this.updateSquad(q, dt, sim, w);
    const before = this.squads.length;
    this.squads = this.squads.filter(q => q.hp > 0);
    if (this.squads.length !== before) this.layoutPosts();
    // préparation du tick suivant pour les zombies : escouades à l'extérieur, compteurs de contact remis à zéro
    this.outside.length = 0;
    for (const q of this.squads) { q.attackers = 0; q.cap = Math.ceil(FORMATIONS[q.form].contact * q.n); if (q.z < WALL_Z0) this.outside.push(q); }
  }
  updateSquad(q, dt, sim, weaponsLvl) {
    const Z = sim.zombies, hash = sim.hash, U = UNITS[q.type], F = FORMATIONS[q.form];
    q.px = q.x; q.pz = q.z; if (q.hit > 0) q.hit -= dt;
    const L = formationLayout(q.form, Math.max(1, q.n), U.size), rad = L.radius; q.rad = rad;
    const speed = U.speed * F.speed;
    let moving = false;
    const step = (tx, tz) => { const dx = tx - q.x, dz = tz - q.z, d = Math.hypot(dx, dz); if (d < 0.05) return true; const st = Math.min(d, speed * dt); q.x += dx / d * st; q.z += dz / d * st; moving = true; return d <= st + 0.01; };
    // ordre explicite : suivre le trajet (porte comprise)
    if (q.way.length) { if (step(q.way[0].x, q.way[0].z)) q.way.shift(); }
    // cibles à portée de coups
    const reach = rad + (U.reach || 2) + 0.6, m = hash.query(q.x, q.z, reach, Z.x, Z.z, tmp);
    let live = 0; for (let k = 0; k < m; k++) if (Z.hp[tmp[k]] > 0) tmp[live++] = tmp[k];
    if (!q.way.length) {
      if (q.mode === 'garrison') {
        // défend l'intérieur du secteur : poursuit les zombies entrés (à portée de laisse), puis retourne à son poste
        let best = -1, bd = Infinity; const mm = hash.query(q.postX, q.postZ, SQUAD.garrisonLeash, Z.x, Z.z, tmp2);
        for (let k = 0; k < mm; k++) { const i = tmp2[k]; if (Z.hp[i] <= 0 || Z.z[i] < WALL_Z1 + 0.8) continue; const d = (Z.x[i] - q.x) ** 2 + (Z.z[i] - q.z) ** 2; if (d < bd) { bd = d; best = i; } }
        if (best < 0) { // personne près du poste : intercepte les intrus plus loin à l'intérieur
          const m3 = hash.query(q.x, q.z, SQUAD.intercept, Z.x, Z.z, tmp2);
          for (let k = 0; k < m3; k++) { const i = tmp2[k]; if (Z.hp[i] <= 0 || Z.z[i] < WALL_Z1 + 0.8) continue; const d = (Z.x[i] - q.x) ** 2 + (Z.z[i] - q.z) ** 2; if (d < bd) { bd = d; best = i; } }
        }
        if (best >= 0 && live === 0) step(Z.x[best], Z.z[best]); else if (best < 0) step(q.postX, q.postZ);
      } else if (q.stance === 'charge' && live === 0) {
        let best = -1, bd = Infinity; const mm = hash.query(q.x, q.z, SQUAD.chargeRange, Z.x, Z.z, tmp2);
        for (let k = 0; k < mm; k++) { const i = tmp2[k]; if (Z.hp[i] <= 0 || Z.z[i] > WALL_Z0 - 2) continue; const d = (Z.x[i] - q.x) ** 2 + (Z.z[i] - q.z) ** 2; if (d < bd) { bd = d; best = i; } }
        if (best >= 0) step(Z.x[best], Z.z[best]);
      }
    }
    // élan (charge) : actif tant que l'escouade vient de se déplacer
    q.mom = moving ? 1 : Math.max(0, q.mom - dt * 0.6);
    if (live > 0) {
      const mult = F.atk * (1 + (F.charge + (U.charge || 0)) * q.mom) * (1 + 0.1 * weaponsLvl) * (moving ? 0.5 : 1);
      q.atkAcc += q.n * F.engage * dt / U.rate;
      let hits = q.atkAcc | 0; q.atkAcc -= hits;
      while (hits-- > 0) { let i = tmp[q.rot++ % live]; Z.hit(i, U.dmg * mult); }
    }
  }
  // ——— sauvegarde ———
  serialize() {
    return {
      reserve: { ...this.reserve }, archers: this.archers.map(a => a.n), nextId: this.nextId,
      squads: this.squads.map(q => ({ id: q.id, type: q.type, n: q.n, hp: Math.round(q.hp), form: q.form, mode: q.mode, sector: q.sector, x: +q.x.toFixed(2), z: +q.z.toFixed(2), tx: q.tx, tz: q.tz, stance: q.stance })),
      queues: Object.fromEntries(TRAIN_BUILDINGS.map(b => [b, this.queues[b].map(i => ({ type: i.type, t: +i.t.toFixed(2), full: i.full }))])),
    };
  }
  restore(st) {
    Object.assign(this.reserve, st.reserve); this.nextId = st.nextId || 1;
    for (let s = 0; s < SECTORS; s++) { this.archers[s].n = st.archers[s]; this.archers[s].cd.fill(0.3); }
    this.squads = [];
    for (const o of st.squads) { const q = this.formSquadRaw(o); this.squads.push(q); }
    this.layoutPosts();
    for (const q of this.squads) { const o = st.squads.find(s => s.id === q.id); q.x = q.px = o.x; q.z = q.pz = o.z; q.fresh = false; if (o.mode === 'field') this.route(q, o.tx, o.tz); else this.route(q, q.postX, q.postZ); }
    for (const b of TRAIN_BUILDINGS) this.queues[b] = (st.queues?.[b] || []).map(i => ({ ...i }));
  }
  formSquadRaw(o) { return { id: o.id, type: o.type, n: o.n, hp: o.hp, form: o.form, mode: o.mode, sector: o.sector, x: o.x, z: o.z, px: o.x, pz: o.z, postX: 0, postZ: 0, tx: o.tx, tz: o.tz, way: [], stance: o.stance || 'hold', atkAcc: 0, rot: 0, mom: 0, attackers: 0, cap: 0, hit: 0, fresh: false, rad: 3 }; }
}
