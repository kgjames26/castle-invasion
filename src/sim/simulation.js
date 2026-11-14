// Simulation : 100 % indépendante du rendu (aucune dépendance à Three.js ni au DOM). Pas fixe de 20 Hz.
import { TICK, SECTORS, SECTOR_W, W, CASTLE } from './constants.js';
import { makeRng } from './rng.js';
import { SpatialHash } from './spatial.js';
import { generateTerrain } from './terrain.js';
import { FlowFields } from './flowfield.js';
import { Wall } from './wall.js';
import { ZombieSwarm } from './zombies.js';
import { Army } from './army.js';
import { Siege } from './siege.js';
import { START, UNITS, TIMING, waveSpec } from '../content/medieval.js';
import { Economy } from './economy.js';

export class Simulation {
  constructor(seed = 20261114) {
    this.seed = seed;
    this.terrain = generateTerrain(1337);
    this.wall = new Wall();
    this.flow = new FlowFields(this.terrain, this.wall);
    this.hash = new SpatialHash(4, 4096);
    this.zombies = new ZombieSwarm();
    this.army = new Army(); this.siege = new Siege();
    this.eco = new Economy(this);
    this.scratch = new Int32Array(256);
    this.arrows = [];             // événements visuels (consommés par le rendu)
    this.events = [];             // 'breach', 'repair', 'waveStart', 'waveEnd', 'gameOver'
    this.speed = 1;
    this.newGame();
  }
  newGame() {
    this.rng = makeRng(this.seed);
    this.wall.reset(); this.zombies.clear(); this.zombies.kills = 0;
    this.army = new Army(); this.siege = new Siege();
    this.eco.reset();
    this.army.reserve = { ...START.reserve };
    for (let s = 0; s < SECTORS; s++) { this.army.reserve.archer += START.perSector.archer; this.army.assignArchers(s, START.perSector.archer); }
    for (const o of START.squads) { this.army.reserve[o.type] += o.n; this.army.formSquad(o.type, o.n, o.sector); }
    this.castleHp = CASTLE.hp; this.over = false; this.time = 0;
    this.wave = 1; this.phase = 'prep'; this.timer = TIMING.firstPrep; this.targets = [];
    this.spawn = null; this.assaultTime = 0; this.stats = { breaches: 0 };
    this.flow.rebuildAll();
  }

  // ——— commandes (appelées par l'interface) ———
  get res() { return this.eco.res; }
  // ——— armée ———
  train(type, n = 1) { return this.army.enqueue(this, type, n); }
  cancelTrain(b) { return this.army.cancel(this, b); }
  assignArchers(s, delta) { return this.army.assignArchers(s, delta); }
  squad(id) { return this.army.squads.find(q => q.id === id) || null; }
  formSquad(type, size, sector) { return this.army.formSquad(type, size, sector); }
  squadForm(id, f) { const q = this.squad(id); if (q) this.army.setForm(q, f); }
  squadStance(id, st) { const q = this.squad(id); if (q) this.army.setStance(q, st); }
  squadGarrison(id, s) { const q = this.squad(id); if (q) this.army.garrison(q, s); }
  squadSortie(id, x, z) { const q = this.squad(id); if (q) this.army.sortie(q, x, z); }
  squadReinforce(id) { const q = this.squad(id); return q ? this.army.reinforce(q) : 0; }
  squadDisband(id) { const q = this.squad(id); if (q) this.army.disband(q); }
  buildSiege(type, s) { return this.siege.build(this, type, s); }
  cancelSiege() { return this.siege.cancel(this); }
  dismantleSiege(id) { return this.siege.dismantle(this, id); }
  buildHouse() { return this.eco.buildHouse(); }
  upgrade(s) { const c = this.wall.upgradeCost(s); if (!c || !this.eco.pay(c)) return false; return this.wall.upgrade(s); }
  assignVillagers(task, delta) { return this.eco.setAssign(task, delta); }
  recruitVillager() { return this.eco.recruitVillager(); }
  upgradeBuilding(b) { return this.eco.upgradeBuilding(b); }
  buyUpgrade(u) { return this.eco.buyUpgrade(u); }
  setRepairPriority(s) { this.eco.setRepairPriority(s); }
  skipPrep() { if (this.phase === 'prep') this.timer = 0; }

  // ——— événements internes ———
  onBreach(seg) {
    const s = this.wall.sectorOf(seg); this.stats.breaches++;
    this.flow.rebuild(s); this.events.push({ type: 'breach', s, seg });
  }
  onRepaired(seg) { const s = this.wall.sectorOf(seg); this.flow.rebuild(s); this.events.push({ type: 'repair', s, seg }); }
  hurtCastle(d) { this.castleHp -= d; if (this.castleHp <= 0 && !this.over) { this.castleHp = 0; this.over = true; this.events.push({ type: 'gameOver' }); } }

  // ——— cycle des vagues ———
  pickTargets() {
    const spec = waveSpec(this.wave), pool = [0, 1, 2, 3, 4], out = [];
    for (let k = 0; k < Math.min(spec.sectors, 5); k++) out.push(pool.splice((this.rng() * pool.length) | 0, 1)[0]);
    this.targets = out.sort();
  }
  startAssault() {
    const spec = waveSpec(this.wave), counts = spec.frac.map(f => Math.round(f * spec.n));
    counts[0] += spec.n - counts.reduce((a, b) => a + b, 0);
    this.spawn = { counts, left: spec.n, total: spec.n, rate: spec.n / spec.duration, acc: 0 };
    this.assaultTime = 0; this.events.push({ type: 'waveStart', wave: this.wave });
  }
  updateWaves(dt) {
    this.timer -= dt;
    if (this.phase === 'prep' && this.timer <= 0) { this.phase = 'alert'; this.timer = TIMING.alert; this.pickTargets(); }
    else if (this.phase === 'alert' && this.timer <= 0) { this.phase = 'assault'; this.startAssault(); }
    else if (this.phase === 'assault') {
      this.assaultTime += dt;
      const sp = this.spawn;
      if (sp && sp.left > 0) {
        sp.acc += sp.rate * dt;
        while (sp.acc >= 1 && sp.left > 0) {
          sp.acc -= 1;
          const type = this.pickType(sp); if (type < 0) break;
          const s = this.targets[(this.rng() * this.targets.length) | 0], cx = s * SECTOR_W + SECTOR_W / 2;
          const x = Math.min(W - 2, Math.max(2, cx + (this.rng() - 0.5) * 90)), z = 1.5 + this.rng() * 28;
          if (!this.zombies.spawn(type, x, z, s, this.rng)) { sp.acc += 1; break; }
          sp.counts[type]--; sp.left--;
        }
      } else if (this.zombies.n === 0) {
        const spec = waveSpec(this.wave);
        for (const r in spec.reward) this.eco.add(r, spec.reward[r]);
        this.events.push({ type: 'waveEnd', wave: this.wave, reward: spec.reward });
        this.phase = 'calm'; this.timer = TIMING.calm; this.spawn = null;
      }
    } else if (this.phase === 'calm' && this.timer <= 0) { this.wave++; this.phase = 'prep'; this.timer = TIMING.prep; this.targets = []; }
  }
  pickType(sp) {
    let tot = 0; for (const c of sp.counts) tot += c; if (tot <= 0) return -1;
    let r = this.rng() * tot; for (let t = 0; t < sp.counts.length; t++) { r -= sp.counts[t]; if (r < 0) return t; }
    return 0;
  }

  // ——— un pas de simulation ———
  tick() {
    const dt = TICK;
    if (this.over) return;
    this.time += dt;
    this.updateWaves(dt);
    this.zombies.update(dt, this);
    this.army.update(dt, this);
    this.siege.update(dt, this);
    this.eco.update(dt);
    this.zombies.compact();
    for (let i = this.arrows.length - 1; i >= 0; i--) { this.arrows[i].t += dt; if (this.arrows[i].t > 0.4) this.arrows.splice(i, 1); }
  }
  // Danger d'un secteur : 0 calme, 1 menace proche, 2 attaque en cours
  danger(s) { return this.zombies.attacking[s] > 0 ? 2 : this.zombies.near[s] > 0 ? 1 : 0; }
}
