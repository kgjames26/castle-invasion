import { UNITS, SIEGE, BUILDINGS, TECHS, RECIPES, RESOURCES, HARVEST, JOBS, JOB_SLOTS, FOOD_UPKEEP, buildingCost, buildingTime, MAP } from '../data/Config.js';
import { Worker } from '../entities/Worker.js';

// Ville souterraine : bâtiments, files de production, recherche, forge, marché
export class ProductionSystem {
  constructor(game) {
    this.game = game;
    this.buildings = {};
    for (const [id, b] of Object.entries(BUILDINGS)) this.buildings[id] = { level: b.start, upgrade: null };
    this.queues = { quarters: [], barracks: [], range: [], stable: [], workshop: [], forge: [] };
    this.techs = new Set();
    this.research = null;
    this.reserve = [];
    this.workers = 0;                       // villageois
    this.jobs = Object.fromEntries(Object.keys(JOBS).map(k => [k, 0]));   // villageois affectés par bâtiment
    this.starving = false;
  }

  // ---------- villageois et métiers ----------
  slots(id) { return JOB_SLOTS * this.level(id); }
  assigned() { return Object.values(this.jobs).reduce((a, b) => a + b, 0); }
  idle() { return Math.max(0, this.workers - this.assigned()); }
  jobCount(id) { return Math.min(this.jobs[id] || 0, this.slots(id)); }
  jobRate(id) {
    const d = JOBS[id], lv = this.level(id);
    let r = d.rate * (1 + 0.12 * (lv - 1));
    if (id === 'farm') r *= 1 + 0.25 * this.level('mill');
    return r;
  }
  assign(id, delta) {
    if (!JOBS[id] || !this.level(id)) return;
    const n = Math.max(0, Math.min(this.slots(id), (this.jobs[id] || 0) + delta));
    if (delta > 0 && (n === this.jobs[id] || this.idle() <= 0)) { if (this.idle() <= 0) this.game.ui.toast('Aucun villageois disponible : forme-en aux Maisons', 'warn'); return; }
    this.jobs[id] = n;
  }
  // production par seconde d'un bâtiment, ou de nourriture consommée
  foodUse() { return FOOD_UPKEEP.civil * this.civPop() + FOOD_UPKEEP.army * this.armyPop(); }

  level(id) { return this.buildings[id]?.level || 0; }
  hasTech(id) { return this.techs.has(id); }
  speedMul() { return Worker.speedBonus(this.workers); }

  // population civile (cultivateurs, ouvriers) : limitée par les Quartiers
  popCap() { return 12 + 6 * this.level('quarters'); }
  // logement militaire : Casernes, Champ de tir, Écuries et Dépôt
  armyCap() { return 6 + 8 * this.level('barracks') + 6 * this.level('range') + 5 * this.level('stable') + 10 * this.level('depot'); }
  isCivil(id) { return UNITS[id].building === 'quarters'; }
  civPop() {
    let p = this.workers;
    for (const u of this.game.units) if (u.alive && this.isCivil(u.type)) p += u.def.pop || 1;
    for (const q of Object.values(this.queues)) for (const it of q) if (it.kind === 'unit' && this.isCivil(it.id)) p += UNITS[it.id].pop;
    return p;
  }
  armyPop() {
    let p = 0;
    for (const u of this.game.units) if (u.alive && !this.isCivil(u.type)) p += u.def.pop || 1;
    for (const q of Object.values(this.queues)) for (const it of q) if (it.kind === 'unit' && !this.isCivil(it.id)) p += UNITS[it.id].pop;
    return p;
  }
  pop() { return this.civPop(); }

  // ---------- unités ----------
  unitLock(id) {
    const d = UNITS[id];
    if (this.level(d.building) < 1) return `Nécessite : ${BUILDINGS[d.building].name}`;
    return null;
  }
  canTrain(id) {
    const d = UNITS[id];
    if (this.unitLock(id)) return this.unitLock(id);
    if (this.isCivil(id)) { if (this.civPop() + d.pop > this.popCap()) return 'Population maximale (améliore les Maisons)'; }
    else if (this.armyPop() + d.pop > this.armyCap()) return 'Logement militaire plein (Caserne, Champ de tir, Écurie, Dépôt)';
    if (this.starving && !this.isCivil(id)) return 'Famine : plus de nourriture';
    if (this.queues[d.building].length >= 6) return 'File pleine';
    if (!this.game.resources.canAfford(d.cost)) return 'Manque ' + this.game.resources.missing(d.cost);
    return null;
  }
  train(id) {
    const err = this.canTrain(id);
    if (err) { this.game.ui.toast(err, 'warn'); return false; }
    const d = UNITS[id];
    this.game.resources.spend(d.cost);
    this.queues[d.building].push({ kind: 'unit', id, t: 0, total: d.time, cost: d.cost });
    return true;
  }

  // ---------- siège ----------
  siegeLock(id) {
    const d = SIEGE[id];
    if (this.level('workshop') < d.level) return `Atelier niveau ${d.level} requis`;
    return null;
  }
  canBuildSiege(id) {
    const d = SIEGE[id];
    if (this.siegeLock(id)) return this.siegeLock(id);
    if (this.queues.workshop.length >= 4) return 'File pleine';
    if (!this.game.resources.canAfford(d.cost)) return 'Manque ' + this.game.resources.missing(d.cost);
    return null;
  }
  buildSiege(id) {
    const err = this.canBuildSiege(id);
    if (err) { this.game.ui.toast(err, 'warn'); return false; }
    const d = SIEGE[id];
    this.game.resources.spend(d.cost);
    this.queues.workshop.push({ kind: 'siege', id, t: 0, total: d.time, cost: d.cost });
    return true;
  }

  // ---------- bâtiments ----------
  upgradeInfo(id) {
    const b = this.buildings[id], def = BUILDINGS[id];
    if (b.level >= def.max) return { max: true };
    const next = b.level + 1;
    return { next, cost: buildingCost(id, next), time: buildingTime(id, next) };
  }
  canUpgrade(id) {
    const b = this.buildings[id], info = this.upgradeInfo(id);
    if (info.max) return 'Niveau maximum';
    if (b.upgrade) return 'Amélioration en cours';
    if (id !== 'quarters' && info.next > this.level('quarters') + 1) return `Maisons niveau ${info.next - 1} requises`;
    if (!this.game.resources.canAfford(info.cost)) return 'Manque ' + this.game.resources.missing(info.cost);
    return null;
  }
  upgrade(id) {
    const err = this.canUpgrade(id);
    if (err) { this.game.ui.toast(err, 'warn'); return false; }
    const info = this.upgradeInfo(id);
    this.game.resources.spend(info.cost);
    this.buildings[id].upgrade = { t: 0, total: info.time, cost: info.cost };
    return true;
  }

  // ---------- recherche ----------
  techLock(id) {
    const d = TECHS[id];
    if (this.level('lab') < d.lab) return `Laboratoire niveau ${d.lab} requis`;
    return null;
  }
  canResearch(id) {
    if (this.techs.has(id)) return 'Déjà recherché';
    if (this.techLock(id)) return this.techLock(id);
    if (this.research) return 'Une recherche est déjà en cours';
    if (!this.game.resources.canAfford(TECHS[id].cost)) return 'Manque ' + this.game.resources.missing(TECHS[id].cost);
    return null;
  }
  startResearch(id) {
    const err = this.canResearch(id);
    if (err) { this.game.ui.toast(err, 'warn'); return false; }
    this.game.resources.spend(TECHS[id].cost);
    this.research = { id, t: 0, total: TECHS[id].time };
    return true;
  }

  // ---------- forge ----------
  canCraft(r) {
    if (this.level('forge') < r.level) return `Forge niveau ${r.level} requise`;
    if (this.queues.forge.length >= 5) return 'File pleine';
    if (!this.game.resources.canAfford(r.in)) return 'Manque ' + this.game.resources.missing(r.in);
    return null;
  }
  craft(rid) {
    const r = RECIPES.find(x => x.id === rid);
    const err = this.canCraft(r);
    if (err) { this.game.ui.toast(err, 'warn'); return false; }
    this.game.resources.spend(r.in);
    this.queues.forge.push({ kind: 'recipe', id: rid, t: 0, total: r.time, cost: r.in });
    return true;
  }

  // ---------- marché ----------
  rate() { return 0.45 + 0.13 * this.level('market'); }
  trade(res, dir, qty = 20) {
    const g = this.game, R = g.resources;
    if (this.level('market') < 1) { g.ui.toast('Construis le marché', 'warn'); return; }
    const v = HARVEST[res].value / HARVEST.gold.value;
    if (dir === 'sell') {
      if (R.stock[res] < qty) { g.ui.toast('Pas assez de ' + res, 'warn'); return; }
      const gold = Math.max(1, Math.floor(qty * v * this.rate()));
      R.stock[res] -= qty; R.add('gold', gold);
    } else {
      const price = Math.ceil(qty * v / this.rate());
      if (R.stock.gold < price) { g.ui.toast('Pas assez d\'or', 'warn'); return; }
      R.stock.gold -= price; R.add(res, qty);
    }
  }
  tradePrice(res, dir, qty = 20) {
    const v = HARVEST[res].value / HARVEST.gold.value;
    return dir === 'sell' ? Math.max(1, Math.floor(qty * v * this.rate())) : Math.ceil(qty * v / this.rate());
  }

  cancel(bid, index) {
    const q = this.queues[bid];
    const it = q[index];
    if (!it) return;
    q.splice(index, 1);
    this.game.resources.refund(it.cost, 1);
  }

  // ---------- mise à jour ----------
  update(dt) {
    const sp = this.speedMul();
    // production des bâtiments du village (les villageois ne travaillent que si le bâtiment existe)
    const R = this.game.resources;
    for (const id of Object.keys(JOBS)) {
      const n = this.jobCount(id);
      if (n > 0) R.add(JOBS[id].res, this.jobRate(id) * n * dt);
    }
    // nourriture : tout le monde mange ; la famine affaiblit l'armée et bloque l'entraînement
    R.stock.food = Math.max(0, R.stock.food - this.foodUse() * dt);
    if (R.stock.food < 70 && !this.lowWarned) { this.lowWarned = true; this.game.ui.toast('🌾 Nourriture basse : construis une Ferme (onglet Village) et affecte des villageois', 'warn', 'lowfood'); }
    else if (R.stock.food > 140) this.lowWarned = false;
    const hungry = R.stock.food <= 0;
    if (hungry !== this.starving) {
      this.starving = hungry;
      this.game.ui.toast(hungry ? '🌾 Famine ! Les troupes sont affaiblies : construis des fermes' : '🌾 Les greniers se remplissent à nouveau', hungry ? 'warn' : 'ok', 'famine');
    }
    for (const [bid, q] of Object.entries(this.queues)) {
      if (!q.length) continue;
      const it = q[0];
      const lv = Math.max(1, this.level(bid));
      it.t += dt * sp * (1 + 0.1 * (lv - 1));
      if (it.t >= it.total) { q.shift(); this.complete(it); }
    }
    for (const [id, b] of Object.entries(this.buildings)) {
      if (!b.upgrade) continue;
      b.upgrade.t += dt * sp;
      if (b.upgrade.t >= b.upgrade.total) {
        b.upgrade = null;
        b.level++;
        this.onLevel(id);
        this.game.ui.toast(`${BUILDINGS[id].name} : niveau ${b.level}`, 'ok');
      }
    }
    if (this.research) {
      this.research.t += dt * sp;
      if (this.research.t >= this.research.total) {
        const id = this.research.id;
        this.research = null;
        this.techs.add(id);
        this.onTech(id);
        this.game.ui.toast(`Recherche terminée : ${TECHS[id].name}`, 'ok');
      }
    }
  }

  complete(it) {
    const g = this.game;
    if (it.kind === 'unit') {
      if (it.id === 'worker') { this.workers++; g.ui.toast('Nouvel ouvrier au travail', 'info', 'worker'); return; }
      const d = MAP.CASTLE_DOOR;
      const u = g.spawnUnit(it.id, d.x + (Math.random() - 0.5) * 6, d.z - 1.5 - Math.random() * 2);
      if (u && u.type !== 'cultivator') u.orderMove(d.x + (Math.random() - 0.5) * 14, d.z - 7 - Math.random() * 5);
      g.ui.toast(`${UNITS[it.id].name} prêt`, 'info', 'ready-' + it.id);
    } else if (it.kind === 'siege') {
      this.reserve.push(it.id);
      g.ui.toast(`${SIEGE[it.id].name} en réserve — à déployer depuis le HUD`, 'ok');
    } else if (it.kind === 'recipe') {
      const r = RECIPES.find(x => x.id === it.id);
      g.resources.addAll(r.out);
    }
  }

  onLevel(id) {
    const g = this.game;
    if (id === 'defenses') g.castle.applyDefenses(this.level('defenses'));
  }

  onTech(id) {
    const g = this.game;
    if (id === 'masonry') { g.wall.applyTechs(); }
    if (id === 'armor') for (const u of g.units) { if (u.applyTechs) u.applyTechs(); else if (u.type === 'cultivator') { u.maxHp = Math.round(u.def.hp * 1.2); } }
  }

  serialize() {
    return {
      buildings: this.buildings, jobs: this.jobs, queues: this.queues, techs: [...this.techs], research: this.research, reserve: this.reserve, workers: this.workers,
    };
  }
  load(d) {
    for (const [k, v] of Object.entries(d.buildings || {})) if (this.buildings[k]) this.buildings[k] = v;
    for (const [k, v] of Object.entries(d.queues || {})) if (this.queues[k]) this.queues[k] = v;
    Object.assign(this.jobs, d.jobs || {});
    this.techs = new Set(d.techs || []);
    this.research = d.research || null;
    this.reserve = d.reserve || [];
    this.workers = d.workers || 0;
  }
}
export { RESOURCES };
