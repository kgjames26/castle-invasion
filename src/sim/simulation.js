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
import { START, UNITS, TIMING, waveSpec, giantsFor, PACK, FIRE, DIFFICULTY } from '../content/medieval.js';
import { Mages } from './mage.js';
import { Economy } from './economy.js';
import { Build } from './build.js';

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
    this.build = new Build(this);
    this.scratch = new Int32Array(4096);
    this.arrows = [];             // événements visuels (consommés par le rendu)
    this.events = [];             // 'breach', 'repair', 'waveStart', 'waveEnd', 'gameOver'
    this.speed = 1; this.difficulty = 'normal'; this.autoRepair = true;
    this.newGame();
  }
  newGame() {
    this.rng = makeRng(this.seed);
    this.wall.reset(); this.zombies.clear(); this.zombies.kills = 0;
    this.army = new Army(); this.siege = new Siege(); this.mages = new Mages(); this.blasts = []; this.blastId = 0; this.fires = [];
    this.eco.reset(); this.build.reset();
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
  squadMove(id, x, z) { const q = this.squad(id); if (q) this.army.moveTo(q, x, z); }
  squadReinforce(id) { const q = this.squad(id); return q ? this.army.reinforce(q) : 0; }
  squadDisband(id) { const q = this.squad(id); if (q) this.army.disband(q); }
  buildSiege(type, s) { return this.siege.build(this, type, s); }
  cancelSiege() { return this.siege.cancel(this); }
  dismantleSiege(id) { return this.siege.dismantle(this, id); }
  // ——— construction libre ———
  place(type, x, z, rot, workers) { return this.build.place(type, x, z, rot, workers); }
  setWorkers(id, n) { return this.build.setWorkers(id, n); }
  cancelBuild(id) { return this.build.cancel(id); }
  upgradeStruct(id, workers) { return this.build.upgrade(id, workers); }
  moveStruct(id, x, z, rot) { return this.build.move(id, x, z, rot); }
  upgrade(s) { const c = this.wall.upgradeCost(s); if (!c || !this.eco.pay(c)) return false; return this.wall.upgrade(s); }
  assignVillagers(task, delta) { return this.eco.setAssign(task, delta); }
  prospect(r) { return this.eco.startProspect(r); }
  recruitVillager() { return this.eco.recruitVillager(); }
  buyUpgrade(u) { return this.eco.buyUpgrade(u); }
  setRepairPriority(s) { this.eco.setRepairPriority(s); }
  summonMage() { return this.mages.startSummon(this); }
  setDifficulty(d) { if (DIFFICULTY[d]) this.difficulty = d; }
  // ——— effets de zone (explosions, feu) : dégâts dans la simulation, trace visuelle dans `blasts` (lue par le rendu) ———
  blast(kind, x, z, r, extra) { this.blasts.push({ id: ++this.blastId, kind, x, z, r, t: 0, ...extra }); if (this.blasts.length > 160) this.blasts.shift(); }
  explode(x, z, r, dmg, kind = 'rock') {
    const Z = this.zombies, k = this.hash.query(x, z, r, Z.x, Z.z, this.scratch);
    for (let q = 0; q < k; q++) { const i = this.scratch[q]; if (Z.hp[i] <= 0) continue; const d = Math.hypot(Z.x[i] - x, Z.z[i] - z); if (d <= r) Z.hit(i, dmg * (1 - 0.5 * d / r)); }
    if (kind === 'fire' || kind === 'meteor') this.fires.push({ x, z, r: r * 0.75, t: FIRE.time * (kind === 'meteor' ? 1.4 : 1) });
    this.blast(kind, x, z, r);
  }
  burn(dt) {
    const Z = this.zombies;
    for (let f = this.fires.length - 1; f >= 0; f--) {
      const F = this.fires[f]; F.t -= dt; if (F.t <= 0) { this.fires.splice(f, 1); continue; }
      const k = this.hash.query(F.x, F.z, F.r, Z.x, Z.z, this.scratch);
      for (let q = 0; q < k; q++) { const i = this.scratch[q]; if (Z.hp[i] > 0 && (Z.x[i] - F.x) ** 2 + (Z.z[i] - F.z) ** 2 <= F.r * F.r) Z.hit(i, FIRE.dps * dt); }
    }
  }
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
    const spec = waveSpec(this.wave), D = DIFFICULTY[this.difficulty] || DIFFICULTY.normal; spec.n = Math.round(spec.n * D.n); this.zombies.hpMult = D.hp;
    const counts = spec.frac.map(f => Math.round(f * spec.n));
    counts[0] += spec.n - counts.reduce((a, b) => a + b, 0);
    const giants = giantsFor(this.wave, this.rng()); counts[5] = giants;
    this.spawn = { counts, left: spec.n + giants, total: spec.n + giants, rate: spec.n / spec.duration, acc: 0, next: this.packSize(spec.n) };
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
        if (sp.acc >= Math.min(sp.next, sp.left) && sp.left > 0) {      // ils arrivent par GROUPES (hordes compactes), pas à la file
          const k = this.spawnPack(sp, Math.min(sp.next, sp.left)); sp.acc = Math.max(0, sp.acc - k); sp.next = this.packSize(sp.total);
          if (!k) sp.acc = Math.min(sp.acc, sp.next);
        }
      } else if (this.zombies.n === 0) {
        const spec = waveSpec(this.wave);
        for (const r in spec.reward) this.eco.add(r, spec.reward[r]);
        this.events.push({ type: 'waveEnd', wave: this.wave, reward: spec.reward });
        this.phase = 'calm'; this.timer = TIMING.calm; this.spawn = null;
      }
    } else if (this.phase === 'calm' && this.timer <= 0) { this.wave++; this.phase = 'prep'; this.timer = TIMING.prep; this.targets = []; }
  }
  packSize(n) { return Math.max(4, Math.round(PACK.base + this.wave * PACK.perWave + this.rng() * PACK.jitter)); }
  // Un groupe : même secteur cible, même type dominant (ils avancent à la même allure), placés en masse serrée
  spawnPack(sp, size) {
    const rng = this.rng, s = this.targets[(rng() * this.targets.length) | 0], cx = s * SECTOR_W + SECTOR_W / 2;
    const gx = Math.min(W - 6, Math.max(6, cx + (rng() - 0.5) * 70)), gz = 3 + rng() * 22, rad = 2 + Math.sqrt(size) * PACK.spread;
    let primary = this.pickType(sp), done = 0; if (primary < 0) return 0;
    const grp = this.nextGroup = (this.nextGroup || 0) % 1000000 + 1;
    for (let i = 0; i < size && sp.left > 0; i++) {
      let t = i === 0 && primary === 5 ? 5 : (primary === 5 ? 0 : (rng() < 0.2 ? this.pickType(sp) : primary));
      if (t < 0 || sp.counts[t] <= 0) t = this.pickType(sp); if (t < 0) break;
      // horde en front large (plus large que profonde) : elle arrive sur plusieurs tronçons à la fois
      const r = rad * Math.sqrt(rng()), a = rng() * Math.PI * 2, ox = Math.cos(a) * r * 1.5, oz = Math.sin(a) * r * 0.6, x = Math.min(W - 1, Math.max(1, gx + ox)), z = Math.max(1, gz + oz);
      if (!this.zombies.spawn(t, x, z, s, rng, grp, ox, oz)) break;
      sp.counts[t]--; sp.left--; done++;
    }
    return done;
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
    this.mages.update(dt, this);
    this.burn(dt);
    this.build.update(dt);
    this.eco.update(dt);
    this.zombies.compact();
    for (let i = this.blasts.length - 1; i >= 0; i--) { this.blasts[i].t += dt; if (this.blasts[i].t > 2.5) this.blasts.splice(i, 1); }
    for (let i = this.arrows.length - 1; i >= 0; i--) { this.arrows[i].t += dt; if (this.arrows[i].t > 0.4) this.arrows.splice(i, 1); }
  }
  // Danger d'un secteur : 0 calme, 1 menace proche, 2 attaque en cours
  danger(s) { return this.zombies.attacking[s] > 0 ? 2 : this.zombies.near[s] > 0 ? 1 : 0; }
}
