// Test de simulation sans rendu : joueur automatique, vérifie progression, économie, sauvegarde et performance.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
import { UNITS } from '../src/content/medieval.js';

const sim = new Simulation();
for (let s = 0; s < 5; s++) if (!sim.flow.reachableFromNorth(s)) { console.error('Carte non traversable pour le secteur', s); process.exit(1); }
const maxWaves = +process.argv[2] || 8, mode = process.argv[3] || 'smart';
const E = sim.eco;
let t0 = performance.now(), maxZ = 0, ticks = 0, lastWave = 1, log = [];
// Joueur automatique : construit dans un ordre raisonnable avec la construction libre (ouvriers = villageois libres).
const PLAN = [['sawmill', 40, 262], ['farm', 100, 244], ['house'], ['quarry', 150, 274], ['range', 100, 224], ['house'], ['barracks', 36, 224], ['mine', 182, 236], ['granary', 66, 270], ['house'], ['warehouse', 134, 272], ['tower', 60, 168], ['tower', 140, 168], ['mill', 128, 258], ['forge', 66, 236], ['house'], ['stable', 164, 224], ['workshop', 136, 236], ['tower', 100, 168], ['tower', 22, 168], ['tower', 178, 168]];
const SPOTS = []; for (let z = 224; z <= 236; z += 12) for (let x = 14; x <= 190; x += 9) SPOTS.push([x, z]);
function house() { for (const [x, z] of SPOTS) if (sim.place('house', x, z, 0, 2)) return true; return false; }
let step = 0;
function bot() {
  if (mode === 'dumb') return;
  const B = sim.build, pending = B.items.filter(s => s.state !== 'built' && !s.fixed).length;
  while (E.villagers.length < 24 + 2 * sim.wave && E.popRoom() > 0 && E.recruitVillager()) {}
  if (E.popRoom() < 6) house();
  if (pending < 3 && step < PLAN.length) { const [t, x, z] = PLAN[step]; const ok = t === 'house' ? house() : sim.place(t, x, z, 0, 2); if (ok) step++; }
  for (const s of B.items) if (s.state === 'built' && s.level < 3 && !(s.type === 'house')) { if (B.items.filter(q => q.state === 'upgrading').length < 2 && (s.type !== 'tower' || sim.wave >= 3)) sim.upgradeStruct(s.id, 2); }
  // villageois : on garde toujours quelques ouvriers libres tant que des chantiers sont en cours
  const keep = pending > 0 || step < PLAN.length ? 3 : 0;
  const crew = Math.max(2, Math.min(4, E.villagers.length >> 4)); if (E.assign.repair < crew && E.idleCount() > keep) E.setAssign('repair', 1);
  const free = E.villagers.length - E.assign.repair - keep, W = { food: E.famine ? 0.5 : 0.34, gold: 0.24, wood: 0.14, stone: 0.14, iron: 0.14 };
  for (const t of Object.keys(W)) { const want = Math.round(W[t] * free); if (E.assign[t] > want + 1) E.setAssign(t, -1); }
  for (const t of Object.keys(W)) { const want = Math.round(W[t] * free); if (E.assign[t] < want && E.idleCount() > keep) E.setAssign(t, 1); }
  for (const t of ['food', 'wood', 'stone', 'gold', 'iron']) if (E.idleCount() > keep) E.setAssign(t, 1);
  if (!B.of('university') && sim.wave >= 2) sim.place('university', 60, 286, 0, 2);
  for (const u of ['tools', 'carts', 'boots', 'plow', 'masonry']) E.buyUpgrade(u);
  if (!E.famine && E.res.food > 80) for (const [t, n] of [['archer', 3], ['soldier', 3], ['heavy', 1]]) sim.train(t, n);
  const A = sim.army;
  if (sim.wave >= 3) { const wl = ['trebuchet', 'catapult', 'ballista']; for (const t of wl) if (sim.siege.canBuild(sim, t, 2)) { sim.buildSiege(t, [2, 1, 3, 0, 4][sim.siege.weapons.length % 5]); break; } }
  for (const t of ['archer', 'soldier', 'siege']) { E.buySmith('atk', t); E.buySmith('def', t); }
  for (const t of ['soldier', 'heavy']) { const sec = Math.floor(sim.rng() * 5); if (A.reserve[t] >= 6 && A.squads.length < 12) sim.formSquad(t, Math.min(A.reserve[t], 10), sec); }
  for (const q of A.squads) if (q.n < 10) sim.squadReinforce(q.id);
  const order = sim.phase === 'assault' || sim.phase === 'alert' ? sim.targets : [0, 1, 2, 3, 4];
  for (const s of order) sim.assignArchers(s, 4);
  for (let s = 0; s < 5; s++) sim.upgrade(s);
}
while (!sim.over && sim.wave <= maxWaves) {
  if (ticks % 40 === 0) bot();
  sim.tick(); ticks++; maxZ = Math.max(maxZ, sim.zombies.n);
  if (sim.wave !== lastWave) {
    const r = E.res, f = n => Math.round(n);
    log.push(`vague ${lastWave} ok | t=${sim.time.toFixed(0)}s château=${f(sim.castleHp)} murs=${[0,1,2,3,4].map(s=>f(100*sim.wall.sectorHp(s)/sim.wall.sectorMax(s))).join('/')}% brèches=${sim.stats.breaches} | 🪵${f(r.wood)} 🪨${f(r.stone)} ⛓${f(r.iron)} 🌾${f(r.food)} 🪙${f(r.gold)} | villageois=${E.villagers.length} débit/s=${['wood','stone','iron','gold','food'].map(t=>E.rate[t].toFixed(2)).join('/')} perdu=${f(E.lost)}${E.famine?' FAMINE':''}`);
    lastWave = sim.wave;
  }
  if (ticks > 20 * 3600 * 3) { console.log('TIMEOUT', sim.phase, sim.zombies.n); break; }
}
const ms = performance.now() - t0;
console.log(log.join('\n'));
console.log(`fin: vague ${sim.wave}, ${sim.over ? 'DÉFAITE' : 'survie'}, ${ticks} ticks en ${ms.toFixed(0)} ms (${(ms / ticks).toFixed(3)} ms/tick), max zombies ${maxZ}`);
console.log(`structures: ${sim.build.items.filter(s => s.state === 'built').length}/${sim.build.items.length} · maisons ${E.houses} · tours ${sim.build.items.filter(s => s.type === 'tower').length} (niv. ${sim.build.items.filter(s => s.type === 'tower').map(s => s.level).join('')}) · pas du plan ${step}/${PLAN.length}`);
console.log(`armée: escouades=${sim.army.squads.length} (${sim.army.squads.reduce((t,q)=>t+q.n,0)} soldats) sièges=${sim.siege.weapons.length} archers=${sim.army.archers.reduce((t,a)=>t+a.n,0)} pop=${E.population()}/${E.popCap()}`);
const snap = JSON.parse(JSON.stringify(serialize(sim))), sim2 = new Simulation(); restore(sim2, snap);
const ok = sim2.wave === sim.wave && sim2.zombies.n === sim.zombies.n && Math.abs(sim2.castleHp - sim.castleHp) < 1
  && sim2.army.squads.length === sim.army.squads.length && sim2.eco.population() === E.population() && sim2.eco.villagers.length === E.villagers.length && Math.abs(sim2.eco.res.wood - E.res.wood) < 1 && sim2.eco.level.mine === E.level.mine && sim2.build.items.length === sim.build.items.length && sim2.eco.houses === E.houses;
console.log('sauvegarde/restauration:', ok ? 'OK' : 'ÉCHEC');
process.exit(ok ? 0 : 1);
