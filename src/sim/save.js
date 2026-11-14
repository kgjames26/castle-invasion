// Sauvegarde versionnée. Format : { version, savedAt, state }. Les migrations s'ajoutent dans MIGRATIONS.
import { SECTORS } from './constants.js';
export const SAVE_VERSION = 2;
const KEY = 'castle-invasion.v3.save';
// MIGRATIONS[n] : état de la version n → version n+1
const MIGRATIONS = {
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
    seed: sim.seed, rng: sim.rng.state(), time: sim.time, wave: sim.wave, phase: sim.phase, timer: sim.timer, targets: sim.targets,
    eco: sim.eco.serialize(), castleHp: sim.castleHp, kills: Z.kills, stats: { ...sim.stats },
    spawn: sim.spawn ? { ...sim.spawn, counts: [...sim.spawn.counts] } : null, assaultTime: sim.assaultTime,
    wall: { hp: Array.from(sim.wall.hp), level: Array.from(sim.wall.level) },
    army: {
      reserve: { ...sim.army.reserve },
      archers: sim.army.archers.map(a => a.n),
      soldiers: sim.army.soldiers.map(u => ({ s: u.s, hp: Math.round(u.hp) })),
    },
    zombies: zs,
  };
}
export function restore(sim, st) {
  sim.rng.setState(st.rng); sim.time = st.time; sim.wave = st.wave; sim.phase = st.phase; sim.timer = st.timer; sim.targets = st.targets || [];
  sim.castleHp = st.castleHp; sim.stats = { ...st.stats }; sim.over = false;
  sim.spawn = st.spawn; sim.assaultTime = st.assaultTime || 0;
  if (st.eco) sim.eco.restore(st.eco); else { sim.eco.reset(); if (st.legacyRes) { sim.eco.res.gold = st.legacyRes.gold; sim.eco.res.stone = st.legacyRes.stone; } }
  sim.wall.hp.set(st.wall.hp); sim.wall.level.set(st.wall.level);
  const Z = sim.zombies; Z.clear(); Z.kills = st.kills;
  for (const [x, z, hp, t, s] of st.zombies) { if (Z.spawn(t, x, z, s, sim.rng)) Z.hp[Z.n - 1] = hp; }
  sim.army.reserve = { ...st.army.reserve };
  for (let s = 0; s < SECTORS; s++) { sim.army.archers[s].n = st.army.archers[s]; sim.army.archers[s].cd.fill(0.3); }
  sim.army.soldiers = st.army.soldiers.map(u => ({ s: u.s, hp: u.hp, x: 0, z: 0, px: 0, pz: 0, postX: 0, postZ: 0, cd: 0, fresh: true }));
  sim.army.layoutPosts();
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
