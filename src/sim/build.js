// Construction libre : toutes les structures (bâtiments uniques, maisons, tours) vivent ici.
// Cycle de vie : 'site' (chantier initial) → 'built' ; 'upgrading' (amélioration, le bâtiment reste visible) ; 'moving' (déplacé : bloqué
// jusqu'au passage d'un ouvrier). Les ouvriers sont des villageois LIBRES (sans tâche) : le joueur règle leur nombre par chantier.
// La simulation ignore tout du rendu ; `eco.level` et `eco.houses` sont recalculés à partir des structures (source de vérité = ici).
import { STRUCT, BUILDINGS, BUILD, TOWER, ECON, TASKS, RANK_BUILDINGS, RANK_UP , UPGRADES } from '../content/medieval.js';
import { sectorOfX } from './constants.js';

const tmp = new Int32Array(512);
const WORKING = s => s.state === 'site' || s.state === 'upgrading' || s.state === 'moving';
const ACTIVE = s => s.state === 'built' || s.state === 'upgrading';

export class Build {
  constructor(sim) { this.sim = sim; this.items = []; this.nextId = 1; this.version = 0; this.reset(); }
  reset() {
    this.items = []; this.nextId = 1; this.version++;
    TOWER.wallXs.forEach((x, k) => this.items.push(this.make('tower', x, TOWER.wallZ, 0, { fixed: true, wt: k, level: 1, state: 'built', progress: 1 })));
    this.syncLevels();
  }
  make(type, x, z, rot, o = {}) {
    return { id: this.nextId++, type, x, z, rot, level: 0, state: 'site', progress: 0, work: 0, workers: 1, paid: null, fixed: false, wt: -1, cd: 0, born: 0, ...o };
  }
  get(id) { return this.items.find(s => s.id === id) || null; }
  of(type) { return this.items.find(s => s.type === type) || null; }
  all(type) { return this.items.filter(s => s.type === type); }
  // ——— géométrie ———
  half(type, rot) { const [w, , d] = STRUCT[type].size; return (rot & 1) ? [d / 2, w / 2] : [w / 2, d / 2]; }
  // ——— coûts / règles ———
  count(type) { let n = 0; for (const s of this.items) if (s.type === type) n++; return n; }
  maxLevel(s) { return STRUCT[s.type].max || ECON.maxLevel; }
  newCost(type) {
    if (type === 'house') return BUILD.houseCost(this.count('house'));
    return { ...STRUCT[type].cost };
  }
  upCost(s) {
    if (s.level >= this.maxLevel(s) || s.type === 'house') return null;
    if (s.type === 'tower') return BUILD.towerUpCost(s.level);
    if (RANK_BUILDINGS.includes(s.type)) { const c = { ...STRUCT[s.type].cost }; for (const r in RANK_UP.extra) c[r] = (c[r] || 0) + RANK_UP.extra[r]; return this.sim.eco.scaled(c, RANK_UP.mult[s.level + 1]); }   // rang suivant
    return this.sim.eco.scaled(STRUCT[s.type].cost, s.level + 1);
  }
  buildTime(type) { return STRUCT[type].time; }
  upTime(s) { return STRUCT[s.type].time * BUILD.upgradeTime * (s.level + 1); }
  // ——— placement ———
  // gisements connus (principaux + découverts)
  ores() {
    const E = this.sim.eco, out = [];
    for (const r of ['stone', 'iron', 'gold']) { const T = TASKS[r]; out.push({ res: r, x: T.site.x, z: T.site.z }); for (const e of E.extra[r]) out.push({ res: r, x: e.x, z: e.z }); }
    return out;
  }
  // aimante une mine sur le gisement de fer/or le plus proche (sinon null)
  snapOre(x, z) {
    let best = null, bd = BUILD.oreSnap;
    for (const o of this.ores()) if (o.res !== 'stone') { const d = Math.hypot(x - o.x, z - o.z); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  canPlace(type, x, z, rot, ignoreId = 0) {
    const [hw, hd] = this.half(type, rot);
    if (x - hw < BUILD.minX || x + hw > BUILD.maxX) {     // forêts latérales : seulement sur des parcelles défrichées
      if (type === 'tower' || x - hw < -195 || x + hw > 395 || z - hd < 212) return { ok: false, why: 'hors de la zone' };
      if (!this.sim.frontier.isOpenRect(x - hw, z - hd, x + hw, z + hd)) return { ok: false, why: 'forêt : défriche d\'abord la parcelle' };
    }
    const minZ = type === 'tower' ? BUILD.towerMinZ : BUILD.minZ;
    if (z - hd < minZ) return { ok: false, why: type === 'tower' ? 'trop près de la muraille' : 'trop près de la muraille (zone de garnison)' };
    if (z + hd > BUILD.maxZ) return { ok: false, why: 'hors de la zone' };
    if (type === 'mine') { if (!this.ores().some(o => o.res !== 'stone' && Math.hypot(x - o.x, z - o.z) < 3.5)) return { ok: false, why: 'à poser sur un gisement de fer ou d\'or' }; }
    else for (const o of this.ores()) {
      const cx = Math.max(x - hw, Math.min(o.x, x + hw)), cz = Math.max(z - hd, Math.min(o.z, z + hd));
      if ((o.x - cx) ** 2 + (o.z - cz) ** 2 < BUILD.oreR * BUILD.oreR) return { ok: false, why: 'sur un gisement (réservé aux mines)' };
    }
    for (const b of BUILD.blockers) {
      const cx = Math.max(x - hw, Math.min(b.x, x + hw)), cz = Math.max(z - hd, Math.min(b.z, z + hd));
      if ((b.x - cx) ** 2 + (b.z - cz) ** 2 < b.r * b.r) return { ok: false, why: 'obstacle' };
    }
    for (const s of this.items) {
      if (s.id === ignoreId) continue;
      const [ow, od] = this.half(s.type, s.rot);
      if (Math.abs(x - s.x) < hw + ow + BUILD.gap && Math.abs(z - s.z) < hd + od + BUILD.gap) return { ok: false, why: 'occupé' };
    }
    return { ok: true, why: '' };
  }
  // vérifie les règles propres au type (unicité, plafonds) — sans la position
  canBuildType(type, ignoreId = 0) {
    const def = STRUCT[type]; if (!def) return { ok: false, why: 'inconnu' };
    if (type === 'house') { if (this.count('house') >= ECON.housesMax) return { ok: false, why: 'maximum atteint' }; }
    else if (type === 'tower') { if (this.items.filter(s => s.type === 'tower' && !s.fixed).length >= BUILD.maxTowers) return { ok: false, why: 'maximum atteint' }; }
    else if (this.items.some(s => s.type === type && s.id !== ignoreId)) return { ok: false, why: 'déjà construit' };
    return { ok: true, why: '' };
  }
  // ——— commandes ———
  place(type, x, z, rot = 0, workers = 1) {
    const t = this.canBuildType(type); if (!t.ok) return null;
    const p = this.canPlace(type, x, z, rot); if (!p.ok) return null;
    const cost = this.newCost(type); if (!this.sim.eco.pay(cost)) return null;
    const s = this.make(type, x, z, rot, { work: this.buildTime(type), workers: Math.max(1, Math.min(BUILD.maxWorkers, workers)), paid: cost, born: this.sim.time });
    this.items.push(s); this.version++; this.syncLevels(); return s;
  }
  setWorkers(id, n) { const s = this.get(id); if (!s || !WORKING(s)) return false; s.workers = Math.max(0, Math.min(BUILD.maxWorkers, n)); return true; }
  // annule un chantier ou une amélioration ; rembourse une partie
  cancel(id) {
    const s = this.get(id); if (!s || !s.paid) return false;
    if (s.state === 'site') { this.refund(s.paid); this.releaseJob(id); this.items.splice(this.items.indexOf(s), 1); this.version++; }
    else if (s.state === 'upgrading') { this.refund(s.paid); this.releaseJob(id); s.state = 'built'; s.progress = 1; s.paid = null; }
    else return false;
    this.syncLevels(); return true;
  }
  refund(c) { for (const r in c) this.sim.eco.add(r, Math.round(c[r] * BUILD.refund)); }
  upgrade(id, workers = 1) {
    const s = this.get(id); if (!s || s.state !== 'built') return false;
    const c = this.upCost(s); if (!c || !this.sim.eco.pay(c)) return false;
    s.state = 'upgrading'; s.progress = 0; s.work = this.upTime(s); s.workers = Math.max(1, Math.min(BUILD.maxWorkers, workers)); s.paid = c; this.syncLevels(); return true;
  }
  // déplacer : gratuit, mais le bâtiment est bloqué jusqu'à ce qu'un ouvrier passe (travail court)
  move(id, x, z, rot) {
    const s = this.get(id); if (!s || s.fixed || s.state !== 'built') return false;
    if (!this.canPlace(s.type, x, z, rot, id).ok) return false;
    s.x = x; s.z = z; s.rot = rot; s.state = 'moving'; s.progress = 0; s.work = BUILD.moveWork; s.workers = 1; s.paid = null; this.version++; this.syncLevels(); return true;
  }
  // ——— niveaux dérivés ———
  syncLevels() {
    const E = this.sim.eco; for (const b in BUILDINGS) E.level[b] = 0;
    let houses = 0;
    for (const s of this.items) {
      if (s.type === 'house') { if (s.state === 'built') houses++; }
      else if (s.type !== 'tower' && ACTIVE(s)) E.level[s.type] = s.level;
    }
    E.houses = houses;
  }
  towerLevel(s) { return ACTIVE(s) ? s.level : 0; }
  towerStats(s, sim) {
    const lv = s.level;
    return { range: (TOWER.range + TOWER.rangePerLevel * (lv - 1)) * sim.night.rangeMult(sectorOfX(Math.max(0, Math.min(199, s.x)))), dmg: TOWER.dmg * (1 + TOWER.dmgPerLevel * (lv - 1)) * sim.eco.atkMult('siege'), rate: TOWER.rate / (1 + TOWER.ratePerLevel * (lv - 1)) };
  }
  // ——— ouvriers ———
  // un ouvrier quitte son chantier : il retourne à sa tâche d'origine s'il en manque une (emprunt), sinon il devient libre
  unbind(v) { v.job = 0; v.state = 'idle'; v.task = null; this.sim.eco.returnHome(v); }
  releaseJob(id) { for (const v of this.sim.eco.villagers) if (v.job === id) this.unbind(v); }
  builderSpot(s, k) {
    const [hw, hd] = this.half(s.type, s.rot), a = Math.PI * (0.2 + 0.6 * (k / 3));
    return [s.x + (hw + 1.5) * Math.cos(a), s.z + (hd + 1.5) * Math.sin(a)];
  }
  update(dt) {
    const sim = this.sim, E = sim.eco, items = this.items;
    // ouvriers : réaffectation des villageois libres vers les chantiers
    let free = null;
    // plusieurs chantiers du même type : une seule équipe à la fois (la première) ; les suivants attendent, un ouvrier à la suite de l'autre
    const head = new Map(); for (const s of items) if (WORKING(s) && !head.has(s.type)) head.set(s.type, s);
    for (const s of items) {
      if (!WORKING(s)) continue;
      const want = head.get(s.type) === s ? s.workers : 0;
      const crew = []; for (const v of E.villagers) if (v.job === s.id) crew.push(v);
      while (crew.length > want) this.unbind(crew.pop());
      if (crew.length < want) {
        free ||= E.villagers.filter(v => !v.task && !v.job && !v.leaving && v.carry === 0);
        while (crew.length < want) {
          let v = null;
          if (free.length) {
            let bi = 0, bd = Infinity; for (let i = 0; i < free.length; i++) { const d = (free[i].x - s.x) ** 2 + (free[i].z - s.z) ** 2; if (d < bd) { bd = d; bi = i; } }
            v = free.splice(bi, 1)[0];
          } else v = E.borrow(s);                  // aucun libre : emprunt sur la tâche la moins urgente
          if (!v) break;
          v.job = s.id; v.state = 'toBuild'; crew.push(v);
        }
      }
      crew.forEach((v, k) => { const [bx, bz] = this.builderSpot(s, k); v.bx = bx; v.bz = bz; });
      let n = 0; for (const v of crew) if (v.state === 'building') n++;
      s.crew = n;
      if (n > 0) {
        s.progress += dt * Math.pow(n, BUILD.workerExp) * (1 + UPGRADES.apprentice.per * (this.sim.eco.up.apprentice || 0)) / s.work;
        if (s.progress >= 1) this.finish(s);
      }
    }
    // tours : tir automatique
    const Z = sim.zombies;
    for (const s of items) {
      if (s.type !== 'tower' || !ACTIVE(s)) continue;
      s.cd -= dt; if (s.cd > 0) continue;
      const st = this.towerStats(s, sim), m = sim.hash.query(s.x, s.z, st.range, Z.x, Z.z, tmp);
      let best = -1, bd = Infinity;
      for (let q = 0; q < m; q++) { const i = tmp[q]; if (Z.hp[i] <= 0) continue; const d = (Z.x[i] - s.x) ** 2 + (Z.z[i] - s.z) ** 2; if (d < bd) { bd = d; best = i; } }
      if (best < 0) { s.cd = 0.3; continue; }
      const E = sim.eco, fire = E.up.fireArrows && sim.rng() < UPGRADES.fireArrows.per * E.up.fireArrows;      // les archers des tours tirent aussi des flèches enflammées
      Z.hit(best, st.dmg * (fire ? 1.25 : 1)); if (sim.arrows.length < 220) sim.arrows.push({ x0: s.x, z0: s.z, x1: Z.x[best], z1: Z.z[best], t: 0, h: 12, fire });
      if (fire && sim.fires.length < 60) sim.fires.push({ x: Z.x[best], z: Z.z[best], r: 1.8, t: 2.6, small: true });
      s.cd = st.rate * (0.9 + sim.rng() * 0.2);
    }
  }
  // anciennes sauvegardes : une structure posée là où les règles actuelles l'interdisent est déplacée vers l'emplacement libre le plus proche
  relocateInvalid() {
    let moved = 0;
    for (const s of this.items) {
      if (s.fixed || this.canPlace(s.type, s.x, s.z, s.rot, s.id).ok) continue;
      if (s.type === 'mine') { const o = this.ores().find(q => q.res !== 'stone' && !this.items.some(t => t !== s && t.type === 'mine' && Math.hypot(t.x - q.x, t.z - q.z) < 3)); if (o) { s.x = o.x; s.z = o.z; moved++; } continue; }
      search: for (let r = 2; r <= 120; r += 2) for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2, x = Math.round((s.x + Math.cos(a) * r) * 2) / 2, z = Math.round((s.z + Math.sin(a) * r) * 2) / 2;
        if (this.canPlace(s.type, x, z, s.rot, s.id).ok) { s.x = x; s.z = z; moved++; break search; }
      }
    }
    this.relocated = moved; return moved;
  }
  finish(s) {
    const was = s.state; this.releaseJob(s.id); s.progress = 1; s.paid = null; s.born = this.sim.time;
    if (was === 'site') s.level = 1; else if (was === 'upgrading') s.level++;
    s.state = 'built'; this.syncLevels(); this.version++;
    this.sim.events.push({ type: 'built', id: s.id, kind: was, what: s.type });
  }
  // ——— sauvegarde ———
  serialize() {
    return { next: this.nextId, items: this.items.map(s => ({ id: s.id, type: s.type, x: s.x, z: s.z, rot: s.rot, level: s.level, state: s.state, progress: +s.progress.toFixed(4), work: s.work, workers: s.workers, paid: s.paid, fixed: s.fixed, wt: s.wt })) };
  }
  restore(st) {
    this.reset();
    if (!st) return;
    for (const o of st.items) {
      if (o.fixed) { const f = this.items.find(s => s.fixed && s.wt === o.wt); if (f) Object.assign(f, { level: o.level, state: o.state, progress: o.progress, work: o.work, workers: o.workers, paid: o.paid }); }
      else this.items.push({ ...this.make(o.type, o.x, o.z, o.rot, { level: o.level, state: o.state, progress: o.progress, work: o.work, workers: o.workers, paid: o.paid }), id: o.id });   // mêmes ids : les ouvriers retrouvent leur chantier
    }
    let mx = 0; for (const s of this.items) mx = Math.max(mx, s.id); this.nextId = Math.max(mx + 1, st.next || 1);
    this.relocateInvalid();
    this.version++; this.syncLevels();
  }
}
