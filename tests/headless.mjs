// Test de simulation sans rendu : joueur automatique, vérifie progression, économie, sauvegarde et performance.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
import { UNITS } from '../src/content/medieval.js';

const sim = new Simulation();
for (let s = 0; s < 5; s++) if (!sim.flow.reachableFromNorth(s)) { console.error('Carte non traversable pour le secteur', s); process.exit(1); }
const maxWaves = +process.argv[2] || 8, mode = process.argv[3] || 'smart';
const E = sim.eco;
let t0 = performance.now(), maxZ = 0, ticks = 0, lastWave = 1, log = [];
function bot() {
  if (mode === 'dumb') return;
  // économie : recrute des villageois, améliore dès que possible, garde la nourriture positive
  while (E.recruitVillager()) {}
  const idle = () => E.idleCount();
  if (E.res.food < 120 || E.famine) E.setAssign('food', 1);
  if (idle() > 0) { for (const t of ['food', 'wood', 'stone', 'iron', 'gold']) if (idle() > 0) E.setAssign(t, 1); }
  for (const b of ['mine', 'mill', 'warehouse', 'granary', 'sawmill', 'quarry', 'farm']) E.upgradeBuilding(b);
  for (const u of ['tools', 'carts', 'boots', 'plow', 'masonry']) E.buyUpgrade(u);
  if (E.assign.repair < 2 && idle() > 0) E.setAssign('repair', 1);
  // maisons (population partagée), puis armée : entraînement, escouades, archers
  for (let k = 0; k < 3; k++) sim.buildHouse();
  for (const [t, n] of [['archer', 3], ['soldier', 3], ['heavy', 1]]) sim.train(t, n);
  const A = sim.army;
  for (const b of ['barracks', 'range', 'forge']) E.upgradeBuilding(b);
  for (const u of ['weapons', 'armor', 'archery']) E.buyUpgrade(u);
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
console.log(`armée: escouades=${sim.army.squads.length} (${sim.army.squads.reduce((t,q)=>t+q.n,0)} soldats) archers=${sim.army.archers.reduce((t,a)=>t+a.n,0)} pop=${E.population()}/${E.popCap()}`);
const snap = JSON.parse(JSON.stringify(serialize(sim))), sim2 = new Simulation(); restore(sim2, snap);
const ok = sim2.wave === sim.wave && sim2.zombies.n === sim.zombies.n && Math.abs(sim2.castleHp - sim.castleHp) < 1
  && sim2.army.squads.length === sim.army.squads.length && sim2.eco.population() === E.population() && sim2.eco.villagers.length === E.villagers.length && Math.abs(sim2.eco.res.wood - E.res.wood) < 1 && sim2.eco.level.mine === E.level.mine;
console.log('sauvegarde/restauration:', ok ? 'OK' : 'ÉCHEC');
process.exit(ok ? 0 : 1);
