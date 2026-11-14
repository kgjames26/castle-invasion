// v2.6 : IA de l'armée — archers placés d'eux-mêmes, escouades sans ordre qui se débrouillent
import { Simulation } from '../src/sim/simulation.js';
import { WALL_Z0, wallOff } from '../src/sim/constants.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'ÉCHEC : ') + m); if (!c) fails++; };
const run = (sim, s) => { for (let i = 0; i < s * 20; i++) sim.tick(); };
{ // archers : la réserve monte seule sur les remparts, puis se concentre où ça presse
  const sim = new Simulation(), A = sim.army, tot = () => A.archers.reduce((a, x) => a + x.n, 0); const t0 = tot(); A.reserve.archer += 15; run(sim, 3);
  ok(A.reserve.archer === 0 && tot() === t0 + 15, `les archers en réserve montent seuls sur les remparts (${t0} → ${tot()})`);
  sim.skipPrep(); for (let i = 0; i < 40; i++) sim.zombies.spawn(2, 6 + (i % 10) * 3, 100 + (i / 10 | 0) * 3, 0, sim.rng); for (let i = 0; i < sim.zombies.n; i++) sim.zombies.hp[i] = 1e5;
  run(sim, 25); const a = A.archers.map(x => x.n); ok(a[0] > a[4] + 2, `assaut sur l'aile gauche : les archers s'y concentrent (${a.join(' / ')})`);
  sim.assignArchers(4, 1); ok(!A.autoArchers, 'placement manuel : l\'IA laisse la main au joueur');
}
{ // escouade sans ordre : court vers la brèche ; un ordre du joueur la rend manuelle
  const sim = new Simulation(), A = sim.army; A.reserve.soldier = 10; const q = sim.formSquad('soldier', 10, 2); run(sim, 5);
  for (let k = 32; k < 40; k++) sim.wall.hp[k] = 0; sim.skipPrep(); for (let i = 0; i < 6; i++) sim.zombies.spawn(0, 170 + i, 158, 4, sim.rng);
  run(sim, 4); ok(q.sector === 4, `l'escouade sans ordre va colmater la brèche (secteur ${q.sector})`);
  sim.squadGarrison(q.id, 1); ok(!q.auto && q.sector === 1, 'un ordre du joueur : escouade manuelle'); run(sim, 4); ok(q.sector === 1, 'elle garde l\'ordre du joueur');
  sim.squadAuto(q.id); run(sim, 3); ok(q.auto && q.sector === 4, 'rendue à l\'IA : elle repart vers la brèche');
}
{ // cavaliers : sortie courte contre un petit groupe au pied du mur, puis retour
  const sim = new Simulation(), A = sim.army; for (let s = 0; s < 5; s++) A.archers[s].n = 0; A.autoArchers = false; A.reserve.cavalry = 8; const q = sim.formSquad('cavalry', 8, 2); run(sim, 5); sim.skipPrep();
  for (let i = 0; i < 3; i++) sim.zombies.spawn(0, 96 + i * 3, WALL_Z0 + wallOff(100) - 3, 2, sim.rng);
  let out = false; for (let i = 0; i < 20 * 8 && !out; i++) { sim.tick(); out = q.mode === 'field'; } ok(out, 'les cavaliers sortent d\'eux-mêmes contre un petit groupe');
  let back = false; for (let i = 0; i < 20 * 60 && !back; i++) { sim.tick(); back = q.mode === 'garrison'; } ok(back, `puis rentrent quand le danger est passé (${sim.zombies.n} zombies restants)`);
}
console.log(fails ? `${fails} ÉCHEC(S)` : 'tout est bon'); process.exit(fails ? 1 : 0);
