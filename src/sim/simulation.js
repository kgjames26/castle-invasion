// Simulation : 100 % indépendante du rendu (aucune dépendance à Three.js ni au DOM). Pas fixe de 20 Hz.
import { TICK, SECTORS, SECTOR_W, W, CASTLE, SEGS, SEG_W, WALL_Z0, ARCHER_Z, sectorOfX, wallOff } from './constants.js';
import { makeRng } from './rng.js';
import { SpatialHash } from './spatial.js';
import { generateTerrain } from './terrain.js';
import { FlowFields } from './flowfield.js';
import { Wall } from './wall.js';
import { ZombieSwarm } from './zombies.js';
import { Army, archerPos } from './army.js';
import { Siege } from './siege.js';
import { START, UNITS, TIMING, waveSpec, giantsFor, golemsFor, GOLEM, PACK, FIRE, DIFFICULTY } from '../content/medieval.js';
import { Mages } from './mage.js';
import { Priest } from './priest.js';
import { Frontier } from './frontier.js';
import { Roads } from './roads.js';
import { Night } from './night.js';
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
    this.army = new Army(); this.siege = new Siege(); this.mages = new Mages(); this.priest = new Priest(); this.blasts = []; this.blastId = 0; this.fires = []; this.fallers = [];
    this.frontier = new Frontier(); this.roads = new Roads(); this.night = new Night();
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
  clearPatch(id) { return this.frontier.order(id); }
  cancelClear(id) { return this.frontier.cancel(id); }
  planRoad(x0, z0, x1, z1) { return this.roads.plan(this, x0, z0, x1, z1); }
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
  // garnison du château : ses archers tirent sur les zombies arrivés à ses portes (les vagues ne restent jamais bloquées)
  castleGuard(dt) {
    this.guardCd = (this.guardCd || 0) - dt; if (this.guardCd > 0) return; this.guardCd = 0.8;
    const Z = this.zombies, k = this.hash.query(CASTLE.x, CASTLE.z, 34, Z.x, Z.z, this.scratch); let best = -1, bd = Infinity;
    for (let q = 0; q < k; q++) { const i = this.scratch[q]; if (Z.hp[i] <= 0) continue; const d = (Z.x[i] - CASTLE.x) ** 2 + (Z.z[i] - CASTLE.z) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best < 0) return; Z.hit(best, 26); if (this.arrows.length < 220) this.arrows.push({ x0: CASTLE.x + (this.rng() - 0.5) * 24, z0: CASTLE.z - 8, x1: Z.x[best], z1: Z.z[best], t: 0, h: 16 });
  }
  // coups sismiques des golems : la muraille voisine tremble, des archers tombent du chemin de ronde
  golemSlams(dt) {
    const Z = this.zombies;
    for (const sl of Z.slams) {
      for (let d = -GOLEM.reach; d <= GOLEM.reach; d++) { const k = sl.seg + d; if (k < 0 || k >= SEGS || this.wall.hp[k] <= 0) continue; if (this.wall.damage(k, GOLEM.quake * (d ? 0.45 : 1))) this.onBreach(k); }
      const s = sectorOfX(sl.x), a = this.army.archers[s]; let fell = 0, dead = 0;
      const n = Math.min(a.n, 1 + ((this.rng() * GOLEM.fall) | 0));
      for (let q = 0; q < n; q++) {
        let best = -1, bd = GOLEM.fallReach; for (let k = 0; k < a.n; k++) { const p = archerPos(s, k), dd = Math.abs(p.x - sl.x); if (dd < bd && a.prog[k] > 1e8) { bd = dd; best = k; } }
        if (best < 0) break; const p = archerPos(s, best);
        a.n--; a.cd[best] = a.cd[a.n]; fell++;
        const lives = this.rng() < GOLEM.survive; if (lives) this.army.reserve.archer++; else dead++;
        this.fallers.push({ x: p.x, z: p.z, t: 0, dead: !lives, rot: this.rng() * 6.28 });
      }
      this.blast('quake', sl.x, WALL_Z0 + wallOff(sl.x), SEG_W * (GOLEM.reach + 0.5));
      if (fell) this.events.push({ type: 'golem', fell, dead });
    }
    Z.slams.length = 0;
    for (let i = this.fallers.length - 1; i >= 0; i--) if ((this.fallers[i].t += dt) > 3.5) this.fallers.splice(i, 1);
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
    const giants = giantsFor(this.wave, this.rng()), golems = golemsFor(this.wave); counts[5] = giants; counts[6] = golems;
    this.spawn = { counts, left: spec.n + giants + golems, total: spec.n + giants + golems, rate: spec.n / spec.duration, acc: 0, next: this.packSize(spec.n) };
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
      const big = primary >= 5;      // colosse ou golem : il mène une horde de zombies ordinaires
      let t = i === 0 && big ? primary : (big ? 0 : (rng() < 0.2 ? this.pickType(sp) : primary));
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
    this.mages.update(dt, this); this.priest.update(dt, this);
    this.night.update(dt, this); this.roads.update(dt, this);
    this.golemSlams(dt);
    this.castleGuard(dt);
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
