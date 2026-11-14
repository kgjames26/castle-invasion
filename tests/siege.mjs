// Test : atelier de siège, construction, tirs, dégâts de zone, munitions, sauvegarde.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
function run(type) {
  const sim = new Simulation(); const E = sim.eco; for (const r in E.res) E.res[r] = 5000; E.level.workshop = 3; E.houses = 30;
  const ok = sim.buildSiege(type, 2); if (!ok) throw new Error('build refusé ' + type);
  for (let i = 0; i < 20 * 60 && sim.siege.weapons.length === 0; i++) sim.tick();
  for (let i = 0; i < 60; i++) sim.zombies.spawn(0, 92 + (i % 10) * 3, 100 + (i / 10 | 0) * 3, 2, sim.rng);
  const z0 = sim.zombies.n, stone0 = E.res.stone, iron0 = E.res.iron; let shots = 0;
  for (let i = 0; i < 20 * 60 && sim.zombies.n > 0; i++) { const n = sim.siege.shots.length; sim.tick(); shots += Math.max(0, sim.siege.shots.length - n); }
  return { type, built: sim.siege.weapons.length, tués: z0 - sim.zombies.n, tirs: shots, pierre: Math.round(stone0 - E.res.stone), fer: Math.round(iron0 - E.res.iron), pop: E.population() };
}
for (const t of ['ballista', 'catapult', 'trebuchet']) console.log(JSON.stringify(run(t)));
const sim = new Simulation(), E = sim.eco; for (const r in E.res) E.res[r] = 5000; E.level.workshop = 1;
console.log('cap niv1 = 2 :', sim.buildSiege('ballista', 0), sim.buildSiege('ballista', 0), sim.buildSiege('ballista', 0) === false, '| catapulte refusée niv1:', sim.buildSiege('catapult', 1) === false);
for (let i = 0; i < 20 * 40; i++) sim.tick();
const s2 = new Simulation(); restore(s2, JSON.parse(JSON.stringify(serialize(sim))));
console.log('sauvegarde armes:', s2.siege.weapons.length === sim.siege.weapons.length ? 'OK' : 'ÉCHEC', s2.siege.weapons.length);
