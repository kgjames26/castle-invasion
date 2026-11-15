// Systèmes v4.0 (simulation pure) : météo, saisons, moral, événements entre les vagues, caravane, spécialistes,
// pièges, huile bouillante, douves, palissade, héros, recherches, médailles d'escouade, bilan de vague, boss, modes de jeu.
import { SECTORS, SECTOR_W, W, WALL_STAND_Z, WALL_Z0, wallOff, sectorOfX } from './constants.js';
import { EXTRA } from '../content/medieval.js';

const SEASONS = EXTRA.seasons;
export const palZ = x => WALL_STAND_Z + wallOff(x) - EXTRA.palisade.dist;          // ligne de la palissade (suit l'arc)
export const moatBand = x => { const w = WALL_STAND_Z + wallOff(x); return [w - EXTRA.moat.far, w - EXTRA.moat.near]; };
const NAMES = ['Aldric', 'Baudouin', 'Gauvain', 'Isolde', 'Mathilde', 'Thibault', 'Enguerrand', 'Ysabeau', 'Godefroy', 'Aliénor', 'Perceval', 'Bertrade'];
const MEDALS = ['les Loups', 'les Inébranlables', 'les Lames grises', 'la Garde de fer', 'les Corbeaux', 'les Fils du Rempart', 'les Veilleurs', 'les Briseurs'];

export class Extras {
  constructor(sim) { this.sim = sim; this.reset(); }
  reset() {
    this.weather = 'clear'; this.morale = 70; this.event = null; this.eventCd = 0; this.fireB = null;
    this.spec = { carpenter: 0, baker: 0, smith: 0 };
    this.traps = []; this.trapId = 1; this.oilCd = new Float32Array(SECTORS); this.moat = new Uint8Array(SECTORS); this.moatWork = new Float32Array(SECTORS);
    this.pal = new Float32Array(SECTORS); this.palWork = new Float32Array(SECTORS);
    this.hero = null; this.rally = 0; this.rallyCd = 0;
    this.tech = {}; this.research = null;
    this.stats = null; this.recap = null; this.festCd = 0; this.quest = 0;   // (v6.0) objectifs suivis après le tutoriel
    this.mode = this.mode || { kind: 'classic' }; this.spits = [];
  }
  season() { return SEASONS[Math.floor((this.sim.wave - 1) / EXTRA.seasonWaves) % 4]; }
  // ——— multiplicateurs lus par les autres systèmes ———
  gatherMult(t) {
    const S = this.season(); let m = 0.8 + 0.4 * this.morale / 100;
    if (t === 'food') { m *= S.food; if (this.sim.eco.level.mill && !this.spec.baker) m *= 0.85; else if (this.spec.baker) m *= 1.2; }
    if (t === 'wood') m *= this.spec.carpenter ? 1.25 : 1;
    if (this.mode.mods?.includes('poor')) m *= 0.8;
    return m;
  }
  buildMult() { return (this.spec.carpenter ? 1.2 : 1) * (0.85 + 0.3 * this.morale / 100); }
  atkMult(t) { let m = 1; if (this.spec.smith) m *= 1.08; if (t === 'archer' && this.tech.alchemy) m *= 1.2; return m; }
  squadMult(q) { let m = 1; if (this.rally > 0) m *= 1.3; if (q.medal) m *= 1.1; if (this.hero && this.hero.sq === q.id) m *= 1 + 0.06 * this.hero.lv; return m; }
  rangeMult() { return this.weather === 'rain' ? 0.85 : this.weather === 'fog' ? 0.9 : 1; }
  zSpeed() { return (this.weather === 'snow' ? 0.85 : 1) * (this.mode.mods?.includes('fast') ? 1.25 : 1); }
  wallHpMult() { return this.tech.engineering ? 1.25 : 1; }
  specCount() { return this.spec.carpenter + this.spec.baker + this.spec.smith; }
  // ——— zombies : pièges, douves, palissade ———
  zombieStep(Z, i, x, z, dt) {
    let k = this.zSpeed();
    const s = sectorOfX(Math.max(0, Math.min(W - 1, x))), mv = this.moat[s];
    if (mv) { const [a, b] = moatBand(x); if (z > a && z < b) { k *= EXTRA.moat.slow[mv]; if (mv >= 3) Z.hit(i, EXTRA.moat.dps * dt); } }
    for (const t of this.traps) {
      const dx = x - t.x, dz = z - t.z, r = EXTRA.traps[t.kind].r; if (dx * dx + dz * dz > r * r) continue;
      if (t.kind === 'caltrops') k *= EXTRA.traps.caltrops.slow;
      else if (t.kind === 'spikes') { if (!Z.trapped || Z.trapped[i] !== t.id) { (Z.trapped ||= new Int32Array(Z.x.length))[i] = t.id; Z.hit(i, EXTRA.traps.spikes.dmg); t.uses--; } k *= 0.6; }
      else if (t.kind === 'pitch' && !t.lit) { t.lit = true; t.uses = 0; this.sim.explode(t.x, t.z, EXTRA.traps.pitch.aoe, EXTRA.traps.pitch.dmg, 'fire'); this.sim.blast('boom', t.x, t.z, 4); }
    }
    return k;
  }
  // la palissade arrête les zombies qui l'atteignent : renvoie vrai s'ils frappent la palissade
  palisade(x, nz, wallDps, dt) {
    const s = sectorOfX(Math.max(0, Math.min(W - 1, x))); if (this.pal[s] <= 0) return false;
    const pz = palZ(x); if (nz < pz - 0.6 || nz > pz + 0.8) return false;
    this.pal[s] -= wallDps * dt; if (this.pal[s] <= 0) { this.pal[s] = 0; this.sim.events.push({ type: 'palisadeDown', s }); }
    return true;
  }
  // ——— actions du joueur ———
  canPay(c) { return this.sim.eco.afford(c); }
  placeTrap(kind, x, z) {
    const D = EXTRA.traps[kind], E = this.sim.eco; if (!D) return { ok: false, why: '?' };
    if (z < EXTRA.trapZ[0] || z > WALL_STAND_Z + wallOff(x) - 3 || x < 3 || x > W - 3) return { ok: false, why: 'entre la plaine et la muraille seulement' };
    if (this.traps.length >= EXTRA.maxTraps) return { ok: false, why: 'trop de pièges' };
    if (!E.pay(D.cost)) return { ok: false, why: 'ressources insuffisantes' };
    this.traps.push({ id: this.trapId++, kind, x, z, uses: D.uses, lit: false }); return { ok: true };
  }
  oil(s) {
    if (this.oilCd[s] > 0 || !this.sim.eco.pay(EXTRA.oil.cost)) return false;
    this.oilCd[s] = EXTRA.oil.cd; const sim = this.sim, Z = sim.zombies;
    for (let x = s * SECTOR_W + 4; x < (s + 1) * SECTOR_W; x += 8) sim.explode(x, WALL_STAND_Z + wallOff(x) - 1.5, 4.5, EXTRA.oil.dmg, 'fire');
    for (let i = 0; i < Z.n; i++) if (Z.hp[i] > 0 && Z.state[i] === 1 && sectorOfX(Z.x[i]) === s) Z.hit(i, EXTRA.oil.dmg);
    sim.events.push({ type: 'oil', s }); return true;
  }
  digMoat(s) { const lv = this.moat[s]; if (lv >= 3 || this.moatWork[s] > 0) return false; if (!this.sim.eco.pay(EXTRA.moat.cost[lv + 1])) return false; this.moatWork[s] = EXTRA.moat.time[lv + 1]; return true; }
  buildPalisade(s) { if (this.palWork[s] > 0 || this.pal[s] >= EXTRA.palisade.hp) return false; const c = this.pal[s] > 0 ? EXTRA.palisade.repair : EXTRA.palisade.cost; if (!this.sim.eco.pay(c)) return false; this.palWork[s] = EXTRA.palisade.time; return true; }
  setSpec(k, d) { const E = this.sim.eco; if (d > 0 && (this.spec[k] >= 1 || E.idleCount() <= 0)) return false; if (d < 0 && this.spec[k] <= 0) return false; this.spec[k] += d; return true; }
  festival() { if (this.festCd > 0 || !this.sim.eco.pay(EXTRA.festival.cost)) return false; this.morale = Math.min(100, this.morale + EXTRA.festival.gain); this.festCd = 1; this.sim.events.push({ type: 'festival' }); return true; }
  hireHero() {
    const sim = this.sim; if (this.hero || (sim.eco.level.barracks || 0) < 2 || !sim.eco.pay(EXTRA.hero.cost)) return false;
    const q = [...sim.army.squads].sort((a, b) => b.n - a.n)[0]; if (!q) { for (const r in EXTRA.hero.cost) sim.eco.add(r, EXTRA.hero.cost[r]); return false; }
    this.hero = { name: NAMES[(sim.rng() * NAMES.length) | 0], lv: 1, xp: 0, sq: q.id, kills0: sim.zombies.kills }; sim.events.push({ type: 'heroJoin', name: this.hero.name }); return true;
  }
  rallyCry() { if (!this.hero || this.rallyCd > 0) return false; this.rally = EXTRA.hero.rallyTime; this.rallyCd = EXTRA.hero.rallyCd; this.morale = Math.min(100, this.morale + 3); this.sim.events.push({ type: 'rally', name: this.hero.name }); return true; }
  startResearch(k) { const T = EXTRA.tech[k]; if (!T || this.tech[k] || this.research || (this.sim.eco.level.university || 0) < T.uni || !this.sim.eco.pay(T.cost)) return false; this.research = { k, t: T.time }; return true; }
  resolveEvent(choice) {
    const ev = this.event, sim = this.sim, E = sim.eco; if (!ev) return false;
    if (choice >= 0) {
      const o = ev.offers?.[choice];
      if (o) { if (!E.pay(o.give)) return false; if (o.get) for (const r in o.get) E.add(r, o.get[r]); if (o.units) for (const u in o.units) sim.army.reserve[u] = (sim.army.reserve[u] || 0) + o.units[u]; if (o.refugees) this.takeRefugees(o.refugees); if (o.fire) this.fightFire(); }
    }
    if (ev.kind !== 'fire' || choice < 0) this.event = null;
    return true;
  }
  takeRefugees(n) {
    const sim = this.sim, E = sim.eco; let k = 0; for (; k < n && E.popRoom() > 0; k++) E.addVillager(100, 214);
    if (sim.rng() < EXTRA.refugeeBite) { sim.zombies.spawn(0, 100, 214, 2, sim.rng); const j = sim.zombies.n - 1; if (j >= 0) sim.zombies.turned[j] = 1; sim.events.push({ type: 'refugeeTurned' }); }
    sim.events.push({ type: 'refugees', n: k });
  }
  fightFire() { const f = this.fireB; if (!f) return; if (this.sim.eco.idleCount() < 3) return; f.crew = 12; this.event = null; }
  // ——— bilan de vague ———
  waveStart() {
    const sim = this.sim, A = sim.army;
    this.stats = { wave: sim.wave, kills: sim.zombies.kills, bySector: new Float32Array(SECTORS), lost: 0, breaches: sim.stats.breaches, res: { ...sim.eco.res }, t: sim.time };
    if (sim.zombies.killsBySector) sim.zombies.killsBySector.fill(0);
    this.rollWeather();
  }
  onSoldierDown() { if (this.stats) this.stats.lost++; this.morale = Math.max(0, this.morale - EXTRA.moraleLoss); }
  waveEnd(reward) {
    const sim = this.sim, st = this.stats; this.morale = Math.min(100, this.morale + EXTRA.moraleWin); this.festCd = 0;
    for (const q of sim.army.squads) { q.waves = (q.waves || 0) + 1; if (q.waves >= EXTRA.medalWaves && !q.medal) { q.medal = MEDALS[(q.id * 7) % MEDALS.length]; sim.events.push({ type: 'medal', name: q.medal }); } }
    if (this.hero) { const k = sim.zombies.kills - this.hero.kills0; this.hero.kills0 = sim.zombies.kills; this.hero.xp += Math.round(k * 0.4) + 20; while (this.hero.lv < 5 && this.hero.xp >= EXTRA.hero.xp[this.hero.lv]) { this.hero.lv++; sim.events.push({ type: 'heroLevel', name: this.hero.name, lv: this.hero.lv }); } }
    if (!st) return;
    const ks = sim.zombies.killsBySector, best = ks ? ks.indexOf(Math.max(...ks)) : -1, gain = {};
    for (const r in sim.eco.res) gain[r] = Math.round(sim.eco.res[r] - st.res[r]);
    this.recap = { wave: st.wave, kills: sim.zombies.kills - st.kills, lost: st.lost, breaches: sim.stats.breaches - st.breaches, best, gain, reward, time: Math.round(sim.time - st.t), weather: this.weather };
    sim.events.push({ type: 'recap', recap: this.recap });
    if (this.mode.goal && sim.wave >= this.mode.goal) sim.events.push({ type: 'victory', mode: this.mode });
  }
  rollWeather() {
    const sim = this.sim, S = this.season(), r = sim.rng();
    this.weather = S.name === 'Hiver' ? (r < 0.5 ? 'snow' : r < 0.65 ? 'fog' : 'clear') : r < 0.55 ? 'clear' : r < 0.77 ? 'rain' : r < 0.92 ? 'fog' : (S.name === 'Automne' ? 'fog' : 'clear');
    if (this.mode.mods?.includes('dark')) this.weather = 'fog';
  }
  // ——— événements entre les vagues (au début du temps calme) ———
  prepStart() {
    const sim = this.sim; if (sim.wave < 2 || this.event) return;
    if (sim.wave % EXTRA.caravanEvery === 0) { this.event = { kind: 'caravan', offers: EXTRA.caravan }; return; }
    if (sim.rng() > EXTRA.eventChance) return;
    const r = sim.rng();
    if (r < 0.4) this.event = { kind: 'merchant', offers: EXTRA.merchant[(sim.rng() * EXTRA.merchant.length) | 0] };
    else if (r < 0.7) { const n = 3 + ((sim.rng() * 4) | 0); this.event = { kind: 'refugees', n, offers: [{ give: { food: 15 * n }, refugees: n }] }; }
    else { const list = sim.build.items.filter(s => !s.fixed && s.state === 'built' && s.type !== 'house' && s.type !== 'tower'); if (!list.length) return; const b = list[(sim.rng() * list.length) | 0]; this.fireB = { id: b.id, t: EXTRA.fire.time, crew: 0 }; this.event = { kind: 'fire', id: b.id, offers: [{ give: {}, fire: true }] }; }
  }
  // ——— pas de simulation ———
  update(dt) {
    const sim = this.sim, E = sim.eco;
    if (sim.zombies.bossDown) { sim.zombies.bossDown = false; for (const r in EXTRA.bossReward) E.add(r, EXTRA.bossReward[r]); this.morale = Math.min(100, this.morale + 20); sim.events.push({ type: 'kill7' }); }
    // moral : lentement vers la base (église, famine)
    const base = 55 + 8 * (E.level.church || 0) - (E.famine ? 25 : 0); this.morale += (base - this.morale) * dt * 0.004;
    if (this.season().name === 'Hiver') { const need = E.population() * EXTRA.winterWood * dt; if (E.res.wood >= need) E.res.wood -= need; else this.morale = Math.max(0, this.morale - dt * 0.05); }
    for (let s = 0; s < SECTORS; s++) {
      if (this.oilCd[s] > 0) this.oilCd[s] -= dt;
      if (this.moatWork[s] > 0 && (this.moatWork[s] -= dt) <= 0) { this.moat[s]++; sim.events.push({ type: 'moat', s, lv: this.moat[s] }); }
      if (this.palWork[s] > 0 && (this.palWork[s] -= dt) <= 0) { this.pal[s] = EXTRA.palisade.hp; sim.events.push({ type: 'palisade', s }); }
    }
    if (this.rally > 0) this.rally -= dt; if (this.rallyCd > 0) this.rallyCd -= dt;
    if (this.hero && !sim.army.squads.some(q => q.id === this.hero.sq)) {      // son escouade est anéantie : le héros tombe (définitif)
      const q = [...sim.army.squads].sort((a, b) => b.n - a.n)[0];
      if (sim.phase === 'assault' || !q) { sim.events.push({ type: 'heroDead', name: this.hero.name }); this.hero = null; this.morale = Math.max(0, this.morale - 15); }
      else this.hero.sq = q.id;
    }
    if (this.research && (this.research.t -= dt) <= 0) { this.tech[this.research.k] = true; sim.events.push({ type: 'researched', k: this.research.k }); this.research = null; sim.wall.hpMult = this.wallHpMult(); }
    // incendie : sans pompiers, le bâtiment perd un niveau
    const f = this.fireB; if (f) { const b = sim.build.get(f.id); if (!b) this.fireB = null; else if (f.crew > 0) { if ((f.crew -= dt) <= 0) { this.fireB = null; sim.events.push({ type: 'fireOut2' }); } } else if ((f.t -= dt) <= 0) { if (b.level > 1) { b.level--; sim.build.syncLevels(); } this.fireB = null; this.event = null; sim.events.push({ type: 'fireLoss', id: b.id }); } }
    for (let i = this.traps.length - 1; i >= 0; i--) if (this.traps[i].uses <= 0 && (this.traps[i].kind !== 'pitch' || this.traps[i].lit)) { if ((this.traps[i].gone = (this.traps[i].gone || 0) + dt) > 2) this.traps.splice(i, 1); }
    for (let i = this.spits.length - 1; i >= 0; i--) { this.spits[i].t += dt; if (this.spits[i].t > 0.9) this.spits.splice(i, 1); }
  }
  serialize() { return { quest: this.quest, weather: this.weather, morale: this.morale, spec: { ...this.spec }, traps: this.traps.map(t => ({ ...t })), moat: [...this.moat], pal: [...this.pal], hero: this.hero && { ...this.hero }, tech: { ...this.tech }, research: this.research && { ...this.research }, mode: this.mode, festCd: this.festCd }; }
  restore(st) { if (!st) return; this.quest = st.quest || 0; this.weather = st.weather || 'clear'; this.morale = st.morale ?? 70; Object.assign(this.spec, st.spec || {}); this.traps = (st.traps || []).map(t => ({ ...t })); this.trapId = 1 + Math.max(0, ...this.traps.map(t => t.id)); (st.moat || []).forEach((v, i) => this.moat[i] = v); (st.pal || []).forEach((v, i) => this.pal[i] = v); this.hero = st.hero || null; this.tech = st.tech || {}; this.research = st.research || null; this.mode = st.mode || { kind: 'classic' }; this.festCd = st.festCd || 0; }
}
