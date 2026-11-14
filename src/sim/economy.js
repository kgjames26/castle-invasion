// Économie : villageois autonomes (aucun ordre individuel). Le joueur fixe seulement les EFFECTIFS par tâche.
// Chaque villageois sait quoi faire : aller au site → récolter → TOUT rapporter au château → recommencer.
import { TASKS, BUILDINGS, UPGRADES, ECON, START, RES, RES_INFO } from '../content/medieval.js';
import { SEGS, SEG_W, SECTORS, SEGS_PER_SECTOR } from './constants.js';
import { WALL } from '../content/medieval.js';

const TASK_IDS = Object.keys(TASKS);
const GATHER = TASK_IDS.filter(t => TASKS[t].res);

export class Economy {
  constructor(sim) { this.sim = sim; this.reset(); }
  reset() {
    this.res = { ...START.res };
    this.level = {}; for (const b in BUILDINGS) this.level[b] = BUILDINGS[b].start;
    this.up = {}; for (const u in UPGRADES) this.up[u] = 0;
    this.assign = {}; for (const t of TASK_IDS) this.assign[t] = START.assign[t] || 0;
    this.repairPriority = -1;
    this.deposit = {}; for (const t of GATHER) if (TASKS[t].deposit) this.deposit[t] = TASKS[t].deposit;
    this.villagers = []; this.nextId = 1;
    for (let i = 0; i < START.villagers; i++) this.addVillager();
    this.rate = {}; this.acc = {}; for (const t of GATHER) { this.rate[t] = 0; this.acc[t] = 0; }
    this.rateTimer = 0; this.famine = false; this.lost = 0; this.claims = new Int8Array(SEGS);
    this.counts = {}; this.syncTasks();
  }
  // ——— grandeurs dérivées ———
  cap(r) { return ECON.baseStore + ECON.storePerLevel * this.level[r === 'food' ? 'granary' : 'warehouse']; }
  popCap() { return ECON.popBase + ECON.popPerHouseLevel * this.level.houses; }
  speed() { return ECON.villagerSpeed * (1 + UPGRADES.boots.per * this.up.boots); }
  carryCap() { return ECON.carry * (1 + UPGRADES.carts.per * this.up.carts); }
  slots(b) { return ECON.slotsPerLevel * this.level[b]; }
  taskCap(t) {
    if (t === 'repair') return TASKS.repair.slots;
    const b = TASKS[t].building; let used = 0;
    for (const o of GATHER) if (o !== t && TASKS[o].building === b) used += this.assign[o];
    return Math.max(0, this.slots(b) - used);
  }
  gatherRate(t) {
    const T = TASKS[t]; let r = T.rate * (1 + UPGRADES.tools.per * this.up.tools) * (1 + ECON.levelGather * (this.level[T.building] - 1));
    if (t === 'food') r *= (1 + UPGRADES.plow.per * this.up.plow) * (1 + ECON.millBonus * this.level.mill);
    return r * (this.famine ? ECON.famineMult : 1);
  }
  idleCount() { let n = 0; for (const t of TASK_IDS) n += this.assign[t]; return this.villagers.length - n; }
  military() { const a = this.sim.army; let n = a.reserve.archer + a.reserve.soldier + a.soldiers.length; for (const x of a.archers) n += x.n; return n; }
  // ——— ressources ———
  afford(c) { for (const r in c) if (this.res[r] < c[r]) return false; return true; }
  pay(c) { if (!this.afford(c)) return false; for (const r in c) this.res[r] -= c[r]; return true; }
  add(r, n) { const room = this.cap(r) - this.res[r], a = Math.max(0, Math.min(n, room)); this.res[r] += a; this.lost += n - a; return a; }
  scaled(base, mult) { const o = {}; for (const r in base) o[r] = Math.round(base[r] * mult); return o; }
  buildingCost(b) { return this.level[b] >= ECON.maxLevel ? null : this.scaled(BUILDINGS[b].cost, this.level[b] + 1); }
  upgradeCost(u) { return this.up[u] >= UPGRADES[u].max ? null : this.scaled(UPGRADES[u].cost, this.up[u] + 1); }
  // ——— commandes ———
  setAssign(t, delta) {
    let moved = 0;
    for (let k = 0; k < Math.abs(delta); k++) {
      if (delta > 0) { if (this.idleCount() <= 0 || this.assign[t] >= this.taskCap(t)) break; this.assign[t]++; moved++; }
      else { if (this.assign[t] <= 0) break; this.assign[t]--; moved++; }
    }
    this.syncTasks(); return moved;
  }
  recruitVillager() {
    if (this.villagers.length >= this.popCap() || !this.pay(ECON.villagerCost)) return false;
    this.addVillager(); this.syncTasks(); return true;
  }
  upgradeBuilding(b) { const c = this.buildingCost(b); if (!c || !this.pay(c)) return false; this.level[b]++; return true; }
  buyUpgrade(u) { const c = this.upgradeCost(u); if (!c || !this.pay(c)) return false; this.up[u]++; return true; }
  setRepairPriority(s) { this.repairPriority = s; }
  // ——— villageois ———
  addVillager(x, z) {
    const i = this.villagers.length;
    const v = { id: this.nextId++, task: null, state: 'idle', x: 0, z: 0, px: 0, pz: 0, carry: 0, carryRes: null, timer: 0, seg: -1, leaving: false, jx: 0, jz: 0 };
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
        const v = this.villagers.find(c => !c.task); if (!v) break;
        v.task = t; v.state = t === 'repair' ? 'repairIdle' : 'toSite'; v.timer = 0; v.seg = -1; counts[t]++;
      }
    }
  }
  release(v) { v.task = null; v.state = 'idle'; v.leaving = false; v.seg = -1; v.timer = 0; }
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
    this.claims.fill(0); for (const v of this.villagers) if (v.task === 'repair' && v.seg >= 0) this.claims[v.seg]++;
    for (let i = 0; i < this.villagers.length; i++) this.updateVillager(this.villagers[i], i, dt);
    this.rateTimer += dt;
    if (this.rateTimer >= 1) { for (const t of GATHER) { this.rate[t] = this.rate[t] * 0.92 + 0.08 * this.acc[t] / this.rateTimer; this.acc[t] = 0; } this.rateTimer = 0; }
  }
  updateVillager(v, i, dt) {
    v.px = v.x; v.pz = v.z;
    const T = v.task ? TASKS[v.task] : null;
    switch (v.state) {
      case 'idle': this.moveTo(v, v.jx, v.jz, dt); break;
      case 'toSite':
        if (this.moveTo(v, T.site.x, T.site.z, dt)) { v.state = (T.deposit && this.deposit[v.task] <= 0) ? 'blocked' : 'gather'; v.timer = 0; }
        break;
      case 'blocked': if (!T.deposit || this.deposit[v.task] > 0) v.state = 'gather'; break;
      case 'gather': {
        v.timer += this.gatherRate(v.task) * dt;
        const want = Math.min(this.carryCap(), T.deposit ? this.deposit[v.task] : Infinity);
        if (v.timer >= want) {
          if (T.deposit) this.deposit[v.task] -= want;
          v.carry = want; v.carryRes = T.res; v.state = 'toCastle';
        }
        break;
      }
      case 'toCastle':
        if (this.moveTo(v, v.jx, ECON.drop.z, dt)) {
          const got = this.add(v.carryRes, v.carry); if (v.task) this.acc[v.task] += got;
          v.carry = 0; v.carryRes = null;
          if (v.leaving) this.release(v); else v.state = 'toSite';
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
      res: { ...this.res }, level: { ...this.level }, up: { ...this.up }, assign: { ...this.assign }, repairPriority: this.repairPriority,
      deposit: { ...this.deposit }, lost: this.lost, famine: this.famine,
      villagers: this.villagers.map(v => ({ task: v.task, state: v.state, x: +v.x.toFixed(2), z: +v.z.toFixed(2), carry: v.carry, carryRes: v.carryRes, timer: v.timer, seg: v.seg, leaving: v.leaving })),
    };
  }
  restore(st) {
    this.reset();
    Object.assign(this.res, st.res); Object.assign(this.level, st.level); Object.assign(this.up, st.up); Object.assign(this.assign, st.assign);
    Object.assign(this.deposit, st.deposit); this.repairPriority = st.repairPriority ?? -1; this.lost = st.lost || 0; this.famine = !!st.famine;
    this.villagers = []; this.nextId = 1;
    for (const o of st.villagers) { const v = this.addVillager(o.x, o.z); Object.assign(v, { task: o.task, state: o.state, carry: o.carry, carryRes: o.carryRes, timer: o.timer, seg: o.seg, leaving: o.leaving }); }
    this.syncTasks();
  }
}
