// Économie : villageois autonomes (aucun ordre individuel). Le joueur fixe seulement les EFFECTIFS par tâche.
// Chaque villageois sait quoi faire : aller au site → récolter → TOUT rapporter au château → recommencer.
import { TASKS, BUILDINGS, UPGRADES, ECON, START, RES, RES_INFO, PROSPECT, START_DEPOSITS, AUTO_REPAIR, SMITH } from '../content/medieval.js';
import { SEGS, SEG_W, SECTORS, SEGS_PER_SECTOR } from './constants.js';
import { WALL } from '../content/medieval.js';

const TASK_IDS = Object.keys(TASKS);
const GATHER = TASK_IDS.filter(t => TASKS[t].res);

export class Economy {
  constructor(sim) { this.sim = sim; this.reset(); }
  reset() {
    this.res = { ...START.res };
    this.level = {}; for (const b in BUILDINGS) this.level[b] = BUILDINGS[b].start;
    this.houses = 0;
    this.up = {}; for (const u in UPGRADES) this.up[u] = 0;
    this.smith = { atk: {}, def: {} }; for (const t in SMITH.types) { this.smith.atk[t] = 0; this.smith.def[t] = 0; }
    this.assign = {}; for (const t of TASK_IDS) this.assign[t] = START.assign[t] || 0;
    this.repairPriority = -1;
    this.deposit = {}; for (const t of GATHER) if (TASKS[t].deposit) this.deposit[t] = TASKS[t].deposit;
    this.extra = {}; for (const r in START_DEPOSITS) this.extra[r] = START_DEPOSITS[r].map(d => ({ ...d, max: d.amount }));
    for (const r of ['stone', 'iron', 'gold']) this.extra[r] ||= []; this.prospect = null;
    this.villagers = []; this.nextId = 1;
    for (let i = 0; i < START.villagers; i++) this.addVillager();
    this.rate = {}; this.acc = {}; for (const t of GATHER) { this.rate[t] = 0; this.acc[t] = 0; }
    this.rateTimer = 0; this.famine = false; this.lost = 0; this.claims = new Int8Array(SEGS);
    this.counts = {}; this.loans = []; this.loanTimer = 0; this.syncTasks();
  }
  // ——— grandeurs dérivées ———
  cap(r) { return ECON.baseStore + ECON.storePerLevel * this.level[r === 'food' ? 'granary' : 'warehouse']; }
  // Population PARTAGÉE : villageois + toutes les unités militaires (réserve, escouades, garnisons, file d'entraînement)
  popCap() { return ECON.popBase + ECON.popPerHouse * this.houses; }
  population() { return this.villagers.length + this.sim.army.popUsed() + this.sim.siege.popUsed() + (this.sim.mages ? this.sim.mages.popUsed() : 0); }
  popRoom() { return this.popCap() - this.population(); }
  speed() { return ECON.villagerSpeed * (1 + UPGRADES.boots.per * this.up.boots); }
  carryCap() { return ECON.carry * (1 + UPGRADES.carts.per * this.up.carts); }
  slots(b) { return BUILDINGS[b].base + ECON.slotsPerLevel * this.level[b]; }   // base = ce que le château permet avant toute construction
  taskCap(t) {
    if (t === 'repair') return TASKS.repair.slots;
    const b = TASKS[t].building; let used = 0;
    for (const o of GATHER) if (o !== t && TASKS[o].building === b) used += this.assign[o];
    return Math.max(0, this.slots(b) - used);
  }
  gatherRate(t) {
    const T = TASKS[t]; let r = T.rate * (1 + UPGRADES.tools.per * this.up.tools) * (1 + ECON.levelGather * Math.max(0, this.level[T.building] - 1));
    if (t === 'food') r *= (1 + UPGRADES.plow.per * this.up.plow) * (1 + ECON.millBonus * this.level.mill);
    return r * (this.famine ? ECON.famineMult : 1);
  }
  // ——— gisements : site principal + gisements découverts par prospection ———
  siteList(t) {
    const T = TASKS[t], out = []; if (!T.deposit) { const f = t === 'food' ? this.sim.build.of('farm') : null; return f && (f.state === 'built' || f.state === 'upgrading') ? [{ x: f.x, z: f.z, si: -1 }] : [{ x: T.site.x, z: T.site.z, si: -1 }]; }
    if (this.deposit[t] > 0) out.push({ x: T.site.x, z: T.site.z, si: -1 });
    const ex = this.extra[t]; if (ex) ex.forEach((e, i) => { if (e.amount > 0) out.push({ x: e.x, z: e.z, si: i }); });
    return out;
  }
  amountAt(t, si) { return si < 0 ? this.deposit[t] : (this.extra[t][si]?.amount || 0); }
  totalDeposit(t) { let n = this.deposit[t] || 0; for (const e of this.extra[t] || []) n += e.amount; return n; }
  // ——— prospection ———
  canProspect(r) { return PROSPECT.res.includes(r) && !this.prospect && this.extra[r].length < PROSPECT.maxPerRes && this.idleCount() > 0 && this.afford(PROSPECT.cost); }
  startProspect(r) {
    if (!this.canProspect(r)) return false; this.pay(PROSPECT.cost);
    const rng = this.sim.rng, Z = PROSPECT.zone; let x = 0, z = 0;
    for (let tries = 0; tries < 60; tries++) {
      x = Z.x0 + rng() * (Z.x1 - Z.x0); z = Z.z0 + rng() * (Z.z1 - Z.z0); if (this.siteFree(x, z)) break;
    }
    this.prospect = { res: r, t: 0, dur: PROSPECT.time, x, z }; return true;
  }
  siteFree(x, z) {
    const c = PROSPECT.clear; if (Math.hypot(x - 100, z - 298) < 30) return false;
    for (const t in TASKS) { const T = TASKS[t]; if (T.site && Math.hypot(x - T.site.x, z - T.site.z) < c) return false; }
    for (const r in this.extra) for (const e of this.extra[r]) if (Math.hypot(x - e.x, z - e.z) < c) return false;
    for (const s of this.sim.build.items || []) if (Math.hypot(x - s.x, z - s.z) < c * 0.7) return false;
    return true;
  }
  updateProspect(dt) {
    const p = this.prospect; if (!p) return; p.t += dt; if (p.t < p.dur) return;
    const A = PROSPECT.amount, amount = Math.round(A[0] + this.sim.rng() * (A[1] - A[0]));
    this.extra[p.res].push({ x: p.x, z: p.z, amount, max: amount }); this.sim.events.push({ type: 'discovered', res: p.res, x: p.x, z: p.z, amount });
    this.prospect = null; for (const v of this.villagers) if (v.task === p.res || (TASKS[v.task]?.building === 'mine' && p.res !== 'stone')) v.sx = null;
  }
  builderCount() { let n = 0; for (const v of this.villagers) if (v.job) n++; return n; }
  // urgence d'une tâche : 0 = rien ne manque ; une ressource rare (stock faible) ou une muraille blessée rend la tâche urgente
  urgency(t) {
    if (t === 'repair') { const W = this.sim.wall; for (let i = 0; i < W.hp.length; i++) if (W.hp[i] < W.segMax(i)) return 0.9; return 0.1; }
    const r = TASKS[t].res; return 1 - Math.min(1, this.res[r] / this.cap(r));
  }
  // emprunte un villageois à la tâche la moins urgente qui en a (sans fil, sans charge) pour renforcer le chantier `site`
  borrow(site) {
    let donor = null, du = Infinity;
    for (const t of TASK_IDS) { if (this.assign[t] <= 0) continue; const u = this.urgency(t); if (u < du && this.villagers.some(v => v.task === t && !v.leaving && v.carry === 0)) { du = u; donor = t; } }
    if (!donor) return null;
    let best = null, bd = Infinity;
    for (const v of this.villagers) if (v.task === donor && !v.leaving && v.carry === 0) { const d = (v.x - site.x) ** 2 + (v.z - site.z) ** 2; if (d < bd) { bd = d; best = v; } }
    if (!best) return null;
    best.home = donor; best.task = null; best.sx = null; best.seg = -1; best.timer = 0; return best;
  }
  // fin de chantier : l'emprunteur reprend sa tâche d'origine si elle attend encore des effectifs
  returnHome(v) {
    const t = v.home; v.home = null; if (!t || !(this.assign[t] > 0)) return;
    let n = 0; for (const c of this.villagers) if (c.task === t && !c.leaving) n++;
    if (n < this.assign[t]) { v.task = t; v.state = t === 'repair' ? 'repairIdle' : 'toSite'; v.sx = null; v.timer = 0; v.seg = -1; }
  }
  idleCount() { let n = 0; for (const t of TASK_IDS) n += this.assign[t]; return this.villagers.length - n - this.builderCount() - (this.prospect ? 1 : 0); }
  military() { return this.sim.army.headcount(); }
  // ——— ressources ———
  afford(c) { for (const r in c) if (this.res[r] < c[r]) return false; return true; }
  pay(c) { if (!this.afford(c)) return false; for (const r in c) this.res[r] -= c[r]; return true; }
  add(r, n) { const room = this.cap(r) - this.res[r], a = Math.max(0, Math.min(n, room)); this.res[r] += a; this.lost += n - a; return a; }
  scaled(base, mult) { const o = {}; for (const r in base) o[r] = Math.round(base[r] * mult); return o; }
  // plafond d'une amélioration : l'université limite celles des villageois (niveau + 1)
  upgradeCap(u) { const U = UPGRADES[u]; return U.req === 'university' ? Math.min(U.max, this.level.university ? this.level.university + 1 : 0) : U.max; }
  upgradeCost(u) { return this.up[u] >= UPGRADES[u].max || this.up[u] >= this.upgradeCap(u) ? null : this.scaled(UPGRADES[u].cost, this.up[u] + 1); }
  // ——— forge : attaque / défense par type d'unité, indépendantes du rang ———
  smithMax() { return Math.min(SMITH.max, SMITH.perForge * (this.level.forge || 0)); }
  smithCost(kind, t) { const lv = this.smith[kind][t]; return lv >= this.smithMax() ? null : (kind === 'atk' ? SMITH.atkCost : SMITH.defCost)(lv); }
  buySmith(kind, t) { const c = this.smithCost(kind, t); if (!c || !this.pay(c)) return false; this.smith[kind][t]++; return true; }
  atkMult(t) { return 1 + SMITH.atk * (this.smith.atk[t] || 0); }
  defMult(t) { return Math.max(0.4, 1 - SMITH.def * (this.smith.def[t] || 0)); }
  // ——— commandes ———
  // Effectifs d'une tâche. Sans villageois libre, on en EMPRUNTE un à la tâche la moins urgente (comme pour les chantiers) ;
  // l'emprunt est noté : quand on retire ce villageois (ou quand la réparation est finie), il retourne à sa tâche d'origine.
  setAssign(t, delta, auto = false) {
    let moved = 0;
    for (let k = 0; k < Math.abs(delta); k++) {
      if (delta > 0) {
        if (this.assign[t] >= this.taskCap(t)) break;
        if (this.idleCount() > 0) { this.assign[t]++; moved++; if (auto) this.loans.push({ from: null, to: t }); continue; }
        const donor = this.donorFor(t); if (!donor) break;
        this.assign[donor]--; this.assign[t]++; this.loans.push({ from: donor, to: t }); moved++;
      } else {
        if (this.assign[t] <= 0) break;
        this.assign[t]--; moved++; this.giveBack(t);
      }
    }
    this.syncTasks(); return moved;
  }
  donorFor(t) {
    let donor = null, du = Infinity;          // la tâche la moins urgente qui a du monde
    for (const u of TASK_IDS) { if (u === t || this.assign[u] <= 0) continue; const v = this.urgency(u); if (v < du) { du = v; donor = u; } }
    return donor;
  }
  // un villageois emprunté pour `t` quitte la tâche : il retourne là d'où il vient (si la place existe encore)
  giveBack(t) {
    const i = this.loans.findIndex(l => l.to === t); if (i < 0) return; const l = this.loans.splice(i, 1)[0];
    if (l.from) this.assign[l.from]++;                    // sa place d'origine lui revient
  }
  // réparation automatique : personne ne répare et un tronçon souffre → on emprunte une petite équipe ; elle repart une fois le mur réparé
  updateLoans(dt) {
    this.loanTimer -= dt; if (this.loanTimer > 0) return; this.loanTimer = 1;
    const W = this.sim.wall; let worst = 1, damaged = false;
    for (let i = 0; i < W.hp.length; i++) { const r = W.hp[i] / W.segMax(i); if (r < 0.999) damaged = true; if (r < worst) worst = r; }
    if (!damaged) { let n = 0; for (const l of this.loans) if (l.to === 'repair') n++; if (n) { for (let k = 0; k < n; k++) { if (this.assign.repair > 0) { this.assign.repair--; this.giveBack('repair'); } } this.syncTasks(); this.sim.events.push({ type: 'autoRepairDone', n }); } return; }
    if (this.sim.autoRepair && this.assign.repair === 0 && worst < AUTO_REPAIR.threshold && this.res.stone >= 5) {
      const n = this.setAssign('repair', AUTO_REPAIR.crew, true); if (n) this.sim.events.push({ type: 'autoRepair', n });
    }
  }
  recruitVillager() {
    if (this.popRoom() <= 0 || !this.pay(ECON.villagerCost)) return false;
    this.addVillager(); this.syncTasks(); return true;
  }
  buyUpgrade(u) { const U = UPGRADES[u]; if (U.req && this.level[U.req] < 1) return false; const c = this.upgradeCost(u); if (!c || !this.pay(c)) return false; this.up[u]++; return true; }
  setRepairPriority(s) { this.repairPriority = s; }
  // ——— villageois ———
  addVillager(x, z) {
    const i = this.villagers.length;
    const v = { id: this.nextId++, task: null, state: 'idle', x: 0, z: 0, px: 0, pz: 0, carry: 0, carryRes: null, timer: 0, seg: -1, leaving: false, jx: 0, jz: 0, job: 0, bx: 0, bz: 0, sx: null, sz: 0, si: -1 };
    this.resetJitter(v, i); v.x = v.px = x !== undefined ? x : v.jx; v.z = v.pz = z !== undefined ? z : v.jz;
    this.villagers.push(v); return v;
  }
  resetJitter(v, i) { v.jx = ECON.drop.x + ((i * 37) % 17 - 8); v.jz = ECON.drop.z + 5 + ((i * 53) % 7); }
  syncTasks() {
    const counts = this.counts; for (const t of TASK_IDS) counts[t] = 0;
    for (const v of this.villagers) if (v.task && !v.leaving) counts[v.task]++;
    for (const t of TASK_IDS) {
      while (counts[t] > this.assign[t]) {
        let v = null; for (let i = this.villagers.length - 1; i >= 0; i--) { const c = this.villagers[i]; if (c.task === t && !c.leaving) { v = c; break; } }
        if (!v) break;
        if (v.carry > 0) v.leaving = true; else { this.release(v); }
        counts[t]--;
      }
    }
    for (const t of TASK_IDS) {
      while (counts[t] < this.assign[t]) {
        const v = this.villagers.find(c => !c.task && !c.job); if (!v) break;
        v.task = t; v.sx = null; v.state = t === 'repair' ? 'repairIdle' : 'toSite'; v.timer = 0; v.seg = -1; counts[t]++;
      }
    }
  }
  release(v) { v.sx = null; v.task = null; v.state = 'idle'; v.leaving = false; v.seg = -1; v.timer = 0; }
  moveTo(v, tx, tz, dt) {
    const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz), st = this.speed() * dt;
    if (d <= st + 0.05) { v.x = tx; v.z = tz; return true; }
    v.x += dx / d * st; v.z += dz / d * st; return false;
  }
  update(dt) {
    const sim = this.sim;
    // nourriture : consommée par toute la population ; famine = rendement réduit
    const eat = (this.villagers.length * ECON.upkeep.villager + this.military() * ECON.upkeep.unit) * dt;
    this.res.food -= eat; if (this.res.food <= 0) { this.res.food = 0; this.famine = true; } else if (this.res.food > 5) this.famine = false;
    for (const t of GATHER) { const T = TASKS[t]; if (T.regen && this.deposit[t] < T.deposit) this.deposit[t] = Math.min(T.deposit, this.deposit[t] + T.regen * dt); }   // la forêt repousse
    this.updateProspect(dt); this.updateLoans(dt);
    this.claims.fill(0); for (const v of this.villagers) if (v.task === 'repair' && v.seg >= 0) this.claims[v.seg]++;
    for (let i = 0; i < this.villagers.length; i++) this.updateVillager(this.villagers[i], i, dt);
    this.rateTimer += dt;
    if (this.rateTimer >= 1) { for (const t of GATHER) { this.rate[t] = this.rate[t] * 0.92 + 0.08 * this.acc[t] / this.rateTimer; this.acc[t] = 0; } this.rateTimer = 0; }
  }
  updateVillager(v, i, dt) {
    v.px = v.x; v.pz = v.z;
    if (v.job) {   // ouvrier de chantier : va sur place, puis travaille (la progression est comptée par Build)
      if (v.state === 'toBuild') { if (this.moveTo(v, v.bx, v.bz, dt)) v.state = 'building'; }
      return;
    }
    const T = v.task ? TASKS[v.task] : null;
    switch (v.state) {
      case 'idle': this.moveTo(v, v.jx, v.jz, dt); break;
      case 'toSite': {
        if (v.sx === null) {                       // choisit un gisement (réparti entre les gisements encore riches)
          const l = this.siteList(v.task), s = l.length ? l[v.id % l.length] : { x: T.site.x, z: T.site.z, si: -1 }; v.sx = s.x; v.sz = s.z; v.si = s.si;
        }
        if (this.moveTo(v, v.sx, v.sz, dt)) { v.state = (T.deposit && this.amountAt(v.task, v.si) <= 0) ? 'blocked' : 'gather'; v.timer = 0; }
        break;
      }
      case 'blocked': if (!T.deposit || this.siteList(v.task).length) { v.sx = null; v.state = 'toSite'; } break;
      case 'gather': {
        v.timer += this.gatherRate(v.task) * dt;
        const want = Math.min(this.carryCap(), T.deposit ? this.amountAt(v.task, v.si) : Infinity);
        if (want <= 0) { v.sx = null; v.state = 'toSite'; break; }
        if (v.timer >= want) {
          if (T.deposit) { if (v.si < 0) this.deposit[v.task] -= want; else this.extra[v.task][v.si].amount -= want; }
          v.carry = want; v.carryRes = T.res; v.state = 'toCastle';
        }
        break;
      }
      case 'toCastle':
        if (this.moveTo(v, v.jx, ECON.drop.z, dt)) {
          const got = this.add(v.carryRes, v.carry); if (v.task) this.acc[v.task] += got;
          v.carry = 0; v.carryRes = null;
          if (v.leaving) this.release(v); else { v.sx = null; v.state = 'toSite'; }
        }
        break;
      // ——— réparation de la muraille ———
      case 'repairIdle': {
        const seg = this.pickRepairTarget();
        if (seg >= 0) { v.seg = seg; v.state = 'toRepair'; this.claims[seg]++; }
        else this.moveTo(v, 100 + ((i * 29) % 31 - 15), 157, dt);
        break;
      }
      case 'toRepair':
        if (this.moveTo(v, v.seg * SEG_W + SEG_W / 2 + ((i % 3) - 1) * 1.2, 153.8, dt)) v.state = 'repairing';
        break;
      case 'repairing': this.repairWork(v, dt); break;
    }
  }
  pickRepairTarget() {
    const w = this.sim.wall, p = this.repairPriority, lo = p >= 0 ? p * SEGS_PER_SECTOR : 0, hi = p >= 0 ? lo + SEGS_PER_SECTOR : SEGS;
    let best = -1, br = 2;
    for (let s = lo; s < hi; s++) {
      const r = w.hp[s] / w.segMax(s); if (r >= 0.999 || this.claims[s] >= 2) continue;
      if (r < br) { br = r; best = s; }
    }
    return best;
  }
  repairWork(v, dt) {
    const sim = this.sim, w = sim.wall, seg = v.seg, miss = w.segMax(seg) - w.hp[seg];
    if (miss <= 0.01) { v.seg = -1; v.state = 'repairIdle'; return; }
    // on attend que les zombies s'écartent de la brèche
    const x = seg * SEG_W + SEG_W / 2, m = sim.hash.query(x, 152, 7, sim.zombies.x, sim.zombies.z, sim.scratch);
    for (let k = 0; k < m; k++) if (sim.zombies.hp[sim.scratch[k]] > 0) return;
    const hp = Math.min(miss, ECON.repairHpPerSec * (1 + UPGRADES.masonry.per * this.up.masonry) * dt);
    const stone = hp / WALL.repairHpPerStone * (1 - 0.1 * this.up.masonry);
    if (this.res.stone < stone) return;               // plus de pierre : on attend
    this.res.stone -= stone;
    if (w.heal(seg, hp)) sim.onRepaired(seg);
  }
  // ——— sauvegarde ———
  serialize() {
    return {
      res: { ...this.res }, houses: this.houses, level: { ...this.level }, up: { ...this.up }, assign: { ...this.assign }, repairPriority: this.repairPriority,
      deposit: { ...this.deposit }, extra: JSON.parse(JSON.stringify(this.extra)), smith: JSON.parse(JSON.stringify(this.smith)), loans: this.loans.map(l => ({ ...l })), prospect: this.prospect ? { ...this.prospect } : null, lost: this.lost, famine: this.famine,
      villagers: this.villagers.map(v => ({ task: v.task, state: v.state, x: +v.x.toFixed(2), z: +v.z.toFixed(2), carry: v.carry, carryRes: v.carryRes, timer: v.timer, seg: v.seg, leaving: v.leaving, job: v.job, bx: v.bx, bz: v.bz, home: v.home || null })),
    };
  }
  restore(st) {
    this.reset();
    Object.assign(this.res, st.res); Object.assign(this.level, st.level); Object.assign(this.up, st.up); Object.assign(this.assign, st.assign);
    if (st.smith) { Object.assign(this.smith.atk, st.smith.atk); Object.assign(this.smith.def, st.smith.def); }
    else {   // anciennes sauvegardes : les améliorations globales de la forge deviennent des niveaux par type
      for (const t in SMITH.types) { this.smith.atk[t] = this.up.weapons || 0; this.smith.def[t] = this.up.armor || 0; }
      this.smith.atk.archer += this.up.archery || 0; this.smith.atk.knight += this.up.blades || 0; this.up.weapons = this.up.armor = this.up.archery = this.up.blades = 0;
    }
    Object.assign(this.deposit, st.deposit); if (st.extra) this.extra = { stone: [], iron: [], gold: [], ...st.extra }; this.loans = (st.loans || []).map(l => ({ ...l })); this.prospect = st.prospect || null; this.repairPriority = st.repairPriority ?? -1; this.lost = st.lost || 0; this.famine = !!st.famine;
    this.villagers = []; this.nextId = 1;
    for (const o of st.villagers) { const v = this.addVillager(o.x, o.z); Object.assign(v, { task: o.task, state: o.state, carry: o.carry, carryRes: o.carryRes, timer: o.timer, seg: o.seg, leaving: o.leaving, job: o.job || 0, bx: o.bx || 0, bz: o.bz || 0, home: o.home || null }); }
    this.syncTasks();
  }
}
