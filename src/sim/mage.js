// Magicien (Maison du sorcier) : une unité AUTONOME. Le joueur l'invoque et l'améliore ; il décide seul, selon l'urgence,
// de soigner une escouade, de refermer une brèche ou de frapper la plus grosse menace. Il se tient toujours à distance des zombies,
// derrière la muraille. Les effets visuels sont publiés dans `sim.blasts` (lus par le rendu, jamais l'inverse).
import { WALL_Z1, SEGS, SEG_W, SECTORS, SECTOR_W, CASTLE, wallOff } from './constants.js';
import { MAGE, FIRE, UPGRADES } from '../content/medieval.js';

const tmp = new Int32Array(2048), cand = new Int32Array(64);
const MIN_Z = WALL_Z1 + 5, MAX_Z = 300;

export class Mages {
  constructor() { this.list = []; this.summon = null; this.respawn = 0; this.shots = []; this.meteors = []; this.nextId = 1; }
  level(sim) { return sim.eco.level.wizard || 0; }
  popUsed() { return this.list.length + (this.summon ? 1 : 0); }
  stats(sim) {
    const lv = Math.max(1, this.level(sim)), ar = 1 + UPGRADES.arcana.per * (sim.eco.up.arcana || 0);
    return { lv, hp: MAGE.hp + MAGE.hpPerLevel * (lv - 1), mana: (MAGE.mana + MAGE.manaPerLevel * (lv - 1)) * ar, regen: (MAGE.regen + MAGE.regenPerLevel * (lv - 1)) * ar, range: MAGE.range + MAGE.rangePerLevel * (lv - 1) };
  }
  spellsFor(lv) { return Object.keys(MAGE.spells).filter(k => MAGE.spells[k].level <= lv); }
  canSummon(sim) { return this.level(sim) >= 1 && !this.list.length && !this.summon && this.respawn <= 0 && sim.eco.popRoom() >= 1 && sim.eco.afford(MAGE.summon); }
  startSummon(sim) { if (!this.canSummon(sim) || !sim.eco.pay(MAGE.summon)) return false; this.summon = { t: MAGE.summonTime, full: MAGE.summonTime }; return true; }
  home(sim) { const h = sim.build.of('wizard'); return h ? { x: h.x, z: h.z + 7 } : { x: CASTLE.x, z: CASTLE.z - 22 }; }
  spawn(sim) {
    const st = this.stats(sim), h = this.home(sim);
    const m = { id: this.nextId++, x: h.x, z: h.z, px: h.x, pz: h.z, hp: st.hp, mana: st.mana * 0.6, cd: {}, cast: null, action: 'Arrive', think: 0, face: Math.PI, hurt: 0, tx: h.x, tz: h.z };
    this.list.push(m); sim.events.push({ type: 'mage', what: 'summoned' }); sim.blast('summon', m.x, m.z, 3); return m;
  }
  update(dt, sim) {
    const lv = this.level(sim);
    if (this.summon) { if (lv < 1) this.summon = null; else if ((this.summon.t -= dt) <= 0) { this.summon = null; this.spawn(sim); } }
    if (this.respawn > 0) { this.respawn -= dt; if (this.respawn <= 0 && lv >= 1 && !this.list.length) this.spawn(sim); }
    for (const m of this.list) this.think(m, dt, sim, lv);
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].hp <= 0) { const m = this.list[i]; sim.blast('mageDown', m.x, m.z, 3); sim.events.push({ type: 'mage', what: 'down' }); this.list.splice(i, 1); this.respawn = MAGE.respawn; }
    this.flyShots(dt, sim); this.fallMeteors(dt, sim);
  }
  think(m, dt, sim, lv) {
    const st = this.stats(sim), Z = sim.zombies, hash = sim.hash;
    m.px = m.x; m.pz = m.z; if (m.hurt > 0) m.hurt -= dt;
    m.mana = Math.min(st.mana, m.mana + st.regen * dt); m.hp = Math.min(st.hp, m.hp + 2 * dt);
    for (const k in m.cd) m.cd[k] -= dt;
    // coups reçus : zombies au contact
    const nm = hash.query(m.x, m.z, 1.6, Z.x, Z.z, tmp); for (let k = 0; k < nm; k++) { const i = tmp[k]; if (Z.hp[i] > 0) { m.hp -= 8 * dt * sim.eco.defMult('mage'); m.hurt = 0.3; } }
    // ——— incantation en cours ———
    if (m.cast) { m.cast.t -= dt; if (m.cast.t <= 0) { this.release(m, m.cast, sim, st); m.cast = null; } return; }
    // ——— sécurité : garder ses distances avec le zombie le plus proche ———
    const near = this.nearestZombie(sim, m.x, m.z, MAGE.keepAway + 4);
    let flee = null;
    if (near >= 0) { const dx = m.x - Z.x[near], dz = m.z - Z.z[near], d = Math.hypot(dx, dz) || 1; if (d < MAGE.keepAway) flee = { x: m.x + dx / d * 8, z: m.z + Math.max(0.3, dz / d) * 8 }; }
    m.think -= dt;
    if (m.think <= 0) { m.think = 0.3; m.plan = this.choose(m, sim, st, lv, near); }
    const p = m.plan;
    if (p && p.ready && !flee) { this.begin(m, p, sim); return; }
    let goal = flee || (p && p.goal) || this.idleSpot(m, sim);
    goal = { x: Math.min(196, Math.max(4, goal.x)), z: Math.min(MAX_Z, Math.max(MIN_Z, goal.z)) };
    const Wt = sim.water; if (Wt) { Wt.eject(m); const a = Wt.aim(m, goal.x, goal.z); goal = { x: a.x, z: a.z }; }   // (v11.3) contourne l'eau
    const dx = goal.x - m.x, dz = goal.z - m.z, d = Math.hypot(dx, dz);
    if (d > 0.3) { const s = Math.min(d, MAGE.speed * (flee ? 1.3 : 1) * dt); m.x += dx / d * s; m.z += dz / d * s; m.face = Math.atan2(dx, dz); if (Wt) [m.x, m.z] = Wt.guard(m.x - dx / d * s, m.z - dz / d * s, m.x, m.z); }
    else if (p && p.tx !== undefined) m.face = Math.atan2(p.tx - m.x, p.tz - m.z);
    m.action = flee ? 'Recule' : p ? p.label : (sim.phase === 'assault' ? 'Surveille' : 'Médite');
    m.tx = goal.x; m.tz = goal.z;
  }
  // l'urgence décide : chaque sort disponible reçoit un score ; le meilleur (mana et recharge OK) est lancé
  choose(m, sim, st, lv, near) {
    const S = MAGE.spells, Z = sim.zombies, opts = [], ok = k => S[k].level <= lv && (m.cd[k] || 0) <= 0;
    const inRange = (x, z) => Math.hypot(x - m.x, z - m.z) <= st.range;
    // soin : escouade la plus blessée (ou lui-même)
    if (ok('heal')) {
      let best = null, br = 0.62;
      for (const q of sim.army.squads) { const r = sim.army.hpRatio(q); if (r < br) { br = r; best = q; } }
      if (best) opts.push({ k: 'heal', score: 70 + (1 - br) * 80 + (best.fight > 0 ? 20 : 0), tx: best.x, tz: best.z, sq: best.id, label: 'Soigne' });
      else if (m.hp < st.hp * 0.45) opts.push({ k: 'heal', score: 85, tx: m.x, tz: m.z, self: true, label: 'Se soigne' });
    }
    // rempart magique : brèche ou tronçon très abîmé
    if (ok('mend')) {
      let seg = -1, sc = 0; const W = sim.wall;
      for (let i = 0; i < SEGS; i++) { const r = W.hp[i] / W.segMax(i), v = r <= 0 ? 100 : r < 0.35 ? 55 * (1 - r) : 0; if (v > sc) { sc = v; seg = i; } }
      if (seg >= 0) opts.push({ k: 'mend', score: sc, tx: seg * SEG_W + SEG_W / 2, tz: 146 + wallOff(seg * SEG_W + SEG_W / 2), seg, label: 'Répare' });
    }
    // attaques : on échantillonne les zombies à portée
    const nc = this.sample(sim, m.x, m.z, st.range);
    if (nc) {
      let bi = cand[0], bs = -1, bn = 0;
      for (let a = 0; a < nc; a++) {
        const i = cand[a]; let n = 0, hp = 0;
        for (let b = 0; b < nc; b++) { const j = cand[b]; if ((Z.x[i] - Z.x[j]) ** 2 + (Z.z[i] - Z.z[j]) ** 2 < 36) { n++; hp += Z.hp[j]; } }
        const danger = Z.z[i] > WALL_Z1 + wallOff(Z.x[i]) ? 2 : Z.state[i] === 1 ? 1.4 : 1, s = (n * 10 + hp / 40) * danger;
        if (s > bs) { bs = s; bi = i; bn = n; }
      }
      const tx = Z.x[bi], tz = Z.z[bi], inside = tz > WALL_Z1 + wallOff(tx);
      if (ok('nova') && near >= 0 && Math.hypot(Z.x[near] - m.x, Z.z[near] - m.z) < S.nova.aoe) opts.push({ k: 'nova', score: 96, tx: m.x, tz: m.z, label: 'Givre' });
      if (ok('meteor') && bn >= 7) opts.push({ k: 'meteor', score: 75 + bn * 2, tx, tz, label: 'Météores' });
      if (ok('lightning') && nc >= 3) opts.push({ k: 'lightning', score: 45 + Math.min(nc, 12) * 2 + (inside ? 20 : 0), tx, tz, zi: bi, label: 'Foudroie' });
      if (ok('fireball')) opts.push({ k: 'fireball', score: 38 + bn * 3 + (inside ? 25 : 0), tx, tz, label: 'Boule de feu' });
    } else if (sim.zombies.n) {     // des zombies existent mais hors de portée : on se rapproche du plus menaçant
      const t = this.mostThreatening(sim); if (t) return { goal: { x: t.x, z: WALL_Z1 + wallOff(t.x) + 7 }, label: 'Se place', tx: t.x, tz: t.z, ready: false };
    }
    opts.sort((a, b) => b.score - a.score);
    for (const o of opts) {
      if (m.mana < S[o.k].mana) continue;
      if (o.self || o.k === 'nova' || inRange(o.tx, o.tz)) return { ...o, ready: true };
      return { ...o, ready: false, goal: { x: o.tx, z: Math.max(MIN_Z, Math.min(o.tz + st.range * 0.6, o.tz < WALL_Z1 + wallOff(o.tx) ? WALL_Z1 + wallOff(o.tx) + 8 : o.tz + 10)) } };
    }
    return null;
  }
  begin(m, p, sim) { const S = MAGE.spells[p.k]; m.plan = null; if (m.mana < S.mana || (m.cd[p.k] || 0) > 0) return; m.mana -= S.mana; m.cd[p.k] = S.cd; m.cast = { ...p, t: p.k === 'meteor' ? 1.2 : 0.55, full: p.k === 'meteor' ? 1.2 : 0.55 }; m.face = Math.atan2(p.tx - m.x, p.tz - m.z) || m.face; m.action = p.label; sim.blast('cast', m.x, m.z, 1, { spell: p.k }); }
  release(m, c, sim, st) {
    const S = MAGE.spells[c.k], lv = st.lv, Z = sim.zombies, mult = (1 + (S.dmgPerLevel || 0) * (lv - 1)) * sim.eco.atkMult('mage');
    if (c.k === 'fireball') { const d = Math.hypot(c.tx - m.x, c.tz - m.z); this.shots.push({ x0: m.x, z0: m.z, x1: c.tx, z1: c.tz, t: 0, dur: Math.max(0.25, d / S.speed), dmg: S.dmg * mult, aoe: S.aoe }); sim.blast('fireballLaunch', m.x, m.z, 1, { x2: c.tx, z2: c.tz, dur: Math.max(0.25, d / S.speed) }); }
    else if (c.k === 'lightning') {
      let x = m.x, z = m.z, i = c.zi; const hit = new Set(), pts = [[m.x, m.z]];
      for (let n = 0; n < S.chain && i >= 0; n++) {
        if (Z.hp[i] <= 0) break; hit.add(i); Z.hit(i, S.dmg * mult * (1 - n * 0.08)); x = Z.x[i]; z = Z.z[i]; pts.push([x, z]);
        let nx = -1, bd = S.jump * S.jump; const k = sim.hash.query(x, z, S.jump, Z.x, Z.z, tmp);
        for (let q = 0; q < k; q++) { const j = tmp[q]; if (Z.hp[j] <= 0 || hit.has(j)) continue; const dd = (Z.x[j] - x) ** 2 + (Z.z[j] - z) ** 2; if (dd < bd) { bd = dd; nx = j; } }
        i = nx;
      }
      sim.blast('lightning', m.x, m.z, 1, { pts });
    }
    else if (c.k === 'heal') {
      const frac = S.heal + S.healPerLevel * (lv - 1);
      if (c.self) { m.hp = Math.min(st.hp, m.hp + frac * st.hp); sim.blast('heal', m.x, m.z, 3); }
      else { const q = sim.squad(c.sq); if (q) { sim.army.healSquad(q, frac); sim.blast('heal', q.x, q.z, q.rad + 1, { from: [m.x, m.z] }); } }
    }
    else if (c.k === 'mend') { const hp = S.hp * (1 + S.hpPerLevel * (lv - 1)); if (sim.wall.heal(c.seg, hp)) sim.onRepaired(c.seg); sim.blast('mend', c.seg * SEG_W + SEG_W / 2, 146 + wallOff(c.seg * SEG_W + SEG_W / 2), 4, { from: [m.x, m.z] }); }
    else if (c.k === 'meteor') { for (let k = 0; k < S.count; k++) { const a = sim.rng() * 6.283, r = Math.sqrt(sim.rng()) * S.spread; this.meteors.push({ x: c.tx + Math.cos(a) * r, z: c.tz + Math.sin(a) * r * 0.8, t: -k * 0.22, dur: 0.9, dmg: S.dmg * mult, aoe: S.aoe }); } sim.blast('meteorCall', c.tx, c.tz, S.spread); }
    else if (c.k === 'nova') {
      const k = sim.hash.query(m.x, m.z, S.aoe, Z.x, Z.z, tmp);
      for (let q = 0; q < k; q++) { const j = tmp[q]; if (Z.hp[j] <= 0) continue; if ((Z.x[j] - m.x) ** 2 + (Z.z[j] - m.z) ** 2 > S.aoe * S.aoe) continue; Z.hit(j, S.dmg); Z.slow[j] = S.slowTime; }
      sim.blast('nova', m.x, m.z, S.aoe);
    }
  }
  flyShots(dt, sim) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const p = this.shots[i]; p.t += dt; if (p.t < p.dur) continue;
      sim.explode(p.x1, p.z1, p.aoe, p.dmg, 'fire'); this.shots.splice(i, 1);
    }
  }
  fallMeteors(dt, sim) {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const p = this.meteors[i]; p.t += dt; if (p.t < p.dur) continue;
      sim.explode(p.x, p.z, p.aoe, p.dmg, 'meteor'); this.meteors.splice(i, 1);
    }
  }
  nearestZombie(sim, x, z, r) {
    const Z = sim.zombies, k = sim.hash.query(x, z, r, Z.x, Z.z, tmp); let best = -1, bd = Infinity;
    for (let q = 0; q < k; q++) { const i = tmp[q]; if (Z.hp[i] <= 0) continue; const d = (Z.x[i] - x) ** 2 + (Z.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  sample(sim, x, z, r) {
    const Z = sim.zombies, k = sim.hash.query(x, z, r, Z.x, Z.z, tmp), step = Math.max(1, (k / 48) | 0); let nc = 0;
    for (let q = 0; q < k && nc < 48; q += step) { const i = tmp[q]; if (Z.hp[i] > 0 && (Z.x[i] - x) ** 2 + (Z.z[i] - z) ** 2 <= r * r) cand[nc++] = i; }
    return nc;
  }
  mostThreatening(sim) {
    const Z = sim.zombies; let best = null, bz = -1;
    for (let i = 0; i < Z.n; i += Math.max(1, (Z.n / 200) | 0)) if (Z.hp[i] > 0 && Z.z[i] > bz) { bz = Z.z[i]; best = { x: Z.x[i], z: Z.z[i] }; }
    return best;
  }
  idleSpot(m, sim) {
    if (sim.phase === 'assault' || sim.phase === 'alert') {
      let s = 2, bd = -1; for (let k = 0; k < SECTORS; k++) { const d = sim.zombies.attacking[k] * 3 + sim.zombies.near[k] + (sim.targets.includes(k) ? 1 : 0); if (d > bd) { bd = d; s = k; } }
      return { x: s * SECTOR_W + SECTOR_W / 2 + Math.sin(sim.time * 0.3 + m.id) * 6, z: WALL_Z1 + wallOff(s * SECTOR_W + SECTOR_W / 2) + 9 };
    }
    const h = this.home(sim); return { x: h.x + Math.sin(sim.time * 0.2) * 4, z: h.z + Math.cos(sim.time * 0.17) * 2 };
  }
  serialize() { return { list: this.list.map(m => ({ x: +m.x.toFixed(2), z: +m.z.toFixed(2), hp: Math.round(m.hp), mana: Math.round(m.mana) })), summon: this.summon, respawn: this.respawn, nextId: this.nextId }; }
  restore(st, sim) {
    this.list = []; this.shots = []; this.meteors = []; this.summon = st?.summon || null; this.respawn = st?.respawn || 0; this.nextId = st?.nextId || 1;
    for (const o of st?.list || []) { const m = this.spawnSilent(sim); Object.assign(m, { x: o.x, z: o.z, px: o.x, pz: o.z, hp: o.hp, mana: o.mana }); }
  }
  spawnSilent(sim) { const st = this.stats(sim), h = this.home(sim), m = { id: this.nextId++, x: h.x, z: h.z, px: h.x, pz: h.z, hp: st.hp, mana: st.mana, cd: {}, cast: null, action: '', think: 0, face: Math.PI, hurt: 0, tx: h.x, tz: h.z }; this.list.push(m); return m; }
}
export { FIRE };
