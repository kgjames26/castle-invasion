// Test : une escouade sort par la porte, affronte des zombies sur le champ de bataille ; comparaison des formations.
import { Simulation } from '../src/sim/simulation.js';
import { FORMATIONS } from '../src/content/medieval.js';
function run(form, type) {
  const sim = new Simulation(); sim.eco.res.gold = 1e5;
  sim.army.reserve[type] += 20; const q = sim.formSquad(type, 15, 2) || sim.army.squads.at(-1);
  sim.squadForm(q.id, form); sim.squadStance(q.id, 'charge');
  for (let i = 0; i < 60; i++) sim.zombies.spawn(0, 90 + (i % 10) * 2, 90 + (i / 10 | 0) * 2, 2, sim.rng);
  sim.squadSortie(q.id, 100, 120);
  let t = 0, z0 = sim.zombies.n; while (t < 20 * 90 && sim.zombies.n > 0 && sim.army.squads.includes(q)) { sim.tick(); t++; }
  return { form, type, mode: q.mode, kills: z0 - sim.zombies.n, left: sim.zombies.n, hp: Math.round(q.hp), n: q.n, sec: (t / 20) | 0 };
}
for (const f of Object.keys(FORMATIONS)) console.log(JSON.stringify(run(f, 'soldier')));
