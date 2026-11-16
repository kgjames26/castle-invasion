// Sauvegarde versionnée. Format : { version, savedAt, state }. Les migrations s'ajoutent dans MIGRATIONS.
import { waveSpec } from '../content/medieval.js';

import { BUILDINGS } from '../content/medieval.js';

export const SAVE_VERSION = 6;
const KEY = 'castle-invasion.v3.save';   // même clé : les parties v3 sont migrées vers la construction libre
// MIGRATIONS[n] : état de la version n → version n+1
const MIGRATIONS = {
  5: st => st,     // v5 → v6 : forêts, routes, nuit et feux (champs facultatifs, valeurs par défaut au chargement)
  // v4 → v5 : magicien, chevaliers, feu, difficulté (champs facultatifs) ; les structures mal placées sont replacées au chargement (Build.relocateInvalid)
  4: st => ({ ...st, army: { ...st.army, reserve: { knight: 0, ...(st.army?.reserve || {}) } } }),
  // v3 (bâtiments à emplacement fixe, maisons en nombre) → v4 (construction libre : chaque bâtiment devient une structure placée)
  3: st => {
    const out = { ...st }, items = []; let id = 100;
    for (const b in (st.eco?.level || {})) { const lv = st.eco.level[b]; if (lv > 0 && BUILDINGS[b]) items.push({ id: id++, type: b, x: BUILDINGS[b].pos.x, z: BUILDINGS[b].pos.z, rot: 0, level: lv, state: 'built', progress: 1, work: 0, workers: 1, paid: null, fixed: false, wt: -1 }); }
    const slots = []; for (const z of [214, 224, 233]) for (let x = 14; x <= 186; x += 9.2) if (Math.abs(x - 100) > 9) slots.push({ x, z });
    slots.sort((p, q) => (Math.abs(p.x - 100) + Math.abs(p.z - 224) * 1.4) - (Math.abs(q.x - 100) + Math.abs(q.z - 224) * 1.4));
    for (let i = 0; i < Math.min(st.eco?.houses || 0, slots.length); i++) items.push({ id: id++, type: 'house', x: +slots[i].x.toFixed(1), z: slots[i].z, rot: 0, level: 1, state: 'built', progress: 1, work: 0, workers: 1, paid: null, fixed: false, wt: -1 });
    out.build = { next: id, items }; return out;
  },
  // v2 (soldats individuels, un seul bâtiment « maisons ») → v3 (escouades, population partagée, files d'entraînement)
  2: st => {
    const out = { ...st }, a = st.army, per = {};
    for (const u of a.soldiers || []) (per[u.s] ||= []).push(u);
    const squads = []; let id = 1;
    for (const s in per) for (let i = 0; i < per[s].length; i += 10) {
      const grp = per[s].slice(i, i + 10); squads.push({ id: id++, type: 'soldier', n: grp.length, hp: grp.reduce((t, u) => t + u.hp, 0), form: 'line', mode: 'garrison', sector: +s, x: 100, z: 156, tx: 0, tz: 0, stance: 'hold' });
    }
    out.army = { reserve: { archer: a.reserve.archer, soldier: a.reserve.soldier, heavy: 0, cavalry: 0 }, archers: a.archers, nextId: id, squads, queues: {} };
    return out;
  },
  // v1 (Phase 2 : or + pierre seulement) → v2 (économie à 5 ressources, villageois)
  1: st => {
    const out = { ...st }; delete out.res;
    out.eco = null;      // économie neuve ; on conserve l'or et la pierre de l'ancienne partie
    out.legacyRes = st.res;
    return out;
  },
};

export function serialize(sim) {
  const Z = sim.zombies, zs = [];
  for (let i = 0; i < Z.n; i++) zs.push([+Z.x[i].toFixed(2), +Z.z[i].toFixed(2), Math.round(Z.hp[i]), Z.type[i], Z.sector[i]]);
  return {
    seed: sim.seed, rng: sim.rng.state(), time: sim.time, wave: sim.wave, phase: sim.phase, timer: sim.timer, targets: sim.targets, lanes: sim.lanes || null,
    extras: sim.extras ? sim.extras.serialize() : null, eco: sim.eco.serialize(), build: sim.build.serialize(), castleHp: sim.castleHp, kills: Z.kills, stats: { ...sim.stats },
    spawn: sim.spawn ? { ...sim.spawn, counts: [...sim.spawn.counts] } : null, assaultTime: sim.assaultTime,
    wall: { hp: Array.from(sim.wall.hp), level: Array.from(sim.wall.level) },
    army: sim.army.serialize(),
    siege: sim.siege.serialize(), mages: sim.mages.serialize(), priest: sim.priest.serialize(), infection: sim.infection.serialize(), frontier: sim.frontier.serialize(), roads: sim.roads.serialize(), night: sim.night.serialize(), difficulty: sim.difficulty, marketTold: !!sim.marketTold, format: sim.format, gfx: sim.gfx || null, autoRepair: sim.autoRepair,
    fires: sim.fires.map(f => ({ ...f })),
    zombies: zs,
  };
}
export function restore(sim, st) {
  sim.rng.setState(st.rng); sim.time = st.time; sim.wave = st.wave; sim.phase = st.phase; sim.timer = st.timer; sim.targets = st.targets || []; sim.lanes = st.lanes || null;
  sim.castleHp = st.castleHp; sim.stats = { ...st.stats }; sim.over = false;
  sim.spawn = st.spawn; sim.assaultTime = st.assaultTime || 0;
  if (sim.extras) sim.extras.restore(st.extras); if (sim.extras) sim.wall.hpMult = sim.extras.wallHpMult();
  { const sp = waveSpec(sim.wave); sim.zombies.aggr = sp.aggr || 1; }
  sim.marketTold = !!st.marketTold;   // (v11.2) agressivité de la vague en cours
  if (st.eco) sim.eco.restore(st.eco); else { sim.eco.reset(); if (st.legacyRes) { sim.eco.res.gold = st.legacyRes.gold; sim.eco.res.stone = st.legacyRes.stone; } }
  sim.build.restore(st.build);
  sim.wall.hp.set(st.wall.hp); sim.wall.level.set(st.wall.level);
  const Z = sim.zombies; Z.clear(); Z.kills = st.kills;
  for (const [x, z, hp, t, s] of st.zombies) { if (Z.spawn(t, x, z, s, sim.rng)) Z.hp[Z.n - 1] = hp; }
  sim.army.restore(st.army); sim.siege.restore(st.siege); sim.mages.restore(st.mages, sim); sim.priest.restore(st.priest); sim.infection.restore(st.infection); sim.frontier.restore(st.frontier); sim.roads.restore(st.roads); sim.night.restore(st.night);
  sim.format = st.format || null; sim.gfx = st.gfx || null; sim.difficulty = st.difficulty || 'normal'; sim.autoRepair = st.autoRepair !== false; sim.fires = (st.fires || []).map(f => ({ ...f })); sim.blasts = [];
  sim.flow.rebuildAll();
}
export function save(sim, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state: serialize(sim) })); return true; } catch { return false; }
}
export function load(sim, storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY); if (!raw) return false;
    const d = JSON.parse(raw); if (!d || typeof d.version !== 'number' || d.version > SAVE_VERSION) return false;
    let st = d.state; for (let v = d.version; v < SAVE_VERSION; v++) st = MIGRATIONS[v](st);
    restore(sim, st); return true;
  } catch { return false; }
}
export function clearSave(storage = globalThis.localStorage) { try { storage.removeItem(KEY); } catch { /* ignore */ } }
