// Test de simulation sans rendu : joueur automatique simple, vérifie progression et performance.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
import { TICK } from '../src/sim/constants.js';
import { waveSpec } from '../src/content/medieval.js';

const sim = new Simulation();
for (let s = 0; s < 5; s++) if (!sim.flow.reachableFromNorth(s)) { console.error('Carte non traversable pour le secteur', s); process.exit(1); }
const maxWaves = +process.argv[2] || 8, smart = process.argv[3] !== 'dumb';
let t0 = performance.now(), maxZ = 0, ticks = 0, lastWave = 1, log = [];
while (!sim.over && sim.wave <= maxWaves) {
  if (sim.phase === 'prep' || sim.phase === 'calm' || sim.phase === 'alert' || ticks % 100 === 0) {
    if (smart) {
      for (let s = 0; s < 5; s++) { sim.repair(s); }
      while (sim.res.gold >= 30 && sim.army.reserve.archer + sim.army.reserve.soldier < 6) { sim.recruit(sim.rng() < 0.7 ? 'archer' : 'soldier'); }
      const order = sim.phase === 'prep' ? [0, 1, 2, 3, 4] : sim.targets;
      for (const s of order) { sim.assign(s, 'archer', 12); sim.assign(s, 'soldier', 10); }
      if (sim.res.stone > 300) for (let s = 0; s < 5; s++) sim.upgrade(s);
    }
  }
  sim.tick(); ticks++; maxZ = Math.max(maxZ, sim.zombies.n);
  if (sim.wave !== lastWave) {
    log.push(`vague ${lastWave} ok | t=${sim.time.toFixed(0)}s castle=${sim.castleHp.toFixed(0)} murs=${[0,1,2,3,4].map(s=>Math.round(100*sim.wall.sectorHp(s)/sim.wall.sectorMax(s))).join('/')}% brèches=${sim.stats.breaches} kills=${sim.zombies.kills} or=${sim.res.gold|0} pierre=${sim.res.stone|0}`);
    lastWave = sim.wave;
  }
  if (ticks > 20 * 3600 * 3) { console.log('TIMEOUT (zombies bloqués ?)', sim.phase, sim.zombies.n); break; }
}
const ms = performance.now() - t0;
console.log(log.join('\n'));
console.log(`fin: vague ${sim.wave}, ${sim.over ? 'DÉFAITE' : 'survie'}, ${ticks} ticks en ${ms.toFixed(0)} ms (${(ms / ticks).toFixed(3)} ms/tick), max zombies simultanés ${maxZ}`);
// sauvegarde / restauration
const snap = JSON.parse(JSON.stringify(serialize(sim))), sim2 = new Simulation(); restore(sim2, snap);
const ok = sim2.wave === sim.wave && sim2.zombies.n === sim.zombies.n && Math.abs(sim2.castleHp - sim.castleHp) < 1;
console.log('sauvegarde/restauration:', ok ? 'OK' : 'ÉCHEC');
process.exit(ok ? 0 : 1);
