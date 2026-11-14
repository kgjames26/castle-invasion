// Chantiers en file (une équipe par type identique), emprunt d'ouvriers sur la tâche la moins urgente (retour au fin de chantier), portes latérales.
import { Simulation } from '../src/sim/simulation.js';
import { GATE_XS } from '../src/sim/constants.js';
const ok = (c, m) => { if (!c) { console.log('ÉCHEC :', m); process.exitCode = 1; } else console.log('ok  :', m); };
const run = (sim, s) => { for (let i = 0; i < s * 20; i++) sim.tick(); };

// 1) deux maisons posées : une seule équipe à la fois
{
  const sim = new Simulation(), E = sim.eco, B = sim.build;
  E.res.wood = 9999; E.res.stone = 9999; E.res.food = 9999;
  for (let i = 0; i < 6; i++) E.villagers.length < 12 && E.recruitVillager();
  const h1 = sim.place('house', 60, 262, 0, 2), h2 = sim.place('house', 80, 262, 0, 2);
  run(sim, 1);
  const crew = s => E.villagers.filter(v => v.job === s.id).length;
  ok(h1 && h2 && crew(h1) === 2 && crew(h2) === 0, `file : 1re maison ${crew(h1)} ouvriers, 2e ${crew(h2)} (attend)`);
  run(sim, 200);
  ok(h2.state === 'built' && crew(h2) === 0, 'la 2e maison se construit après la 1re');
}

// 2) emprunt : on demande des ouvriers sans personne de libre → pris sur la tâche la moins urgente, rendus à la fin
{
  const sim = new Simulation(), E = sim.eco, B = sim.build;
  E.res.wood = 9999; E.res.stone = 9999; E.res.food = 9999; E.res.gold = 9999;
  const hz = sim.place('house', 60, 262, 0, 1);
  // tout le monde est affecté (aucun libre) : bois 2, pierre 2, nourriture le reste
  E.assign.food = E.villagers.length - 4; E.assign.wood = 2; E.assign.stone = 2; E.syncTasks();
  const before = { wood: E.assign.wood, stone: E.assign.stone, food: E.assign.food };
  const free = E.villagers.filter(v => !v.task && !v.job).length;
  ok(free === 0, 'aucun villageois libre avant la demande');
  B.setWorkers(hz.id, 3);
  run(sim, 0.1);
  const crew = E.villagers.filter(v => v.job === hz.id);
  ok(crew.length >= 1 && E.villagers.some(v => v.home), `emprunt : ${crew.length} ouvriers sur le chantier (libres avant : ${free})`);
  run(sim, 300);
  ok(hz.state === 'built', 'chantier terminé');
  const back = E.villagers.filter(v => v.task === 'wood').length;
  ok(back === before.wood && E.villagers.filter(v => v.task === 'food').length === before.food, `retour : bûcherons ${back}/${before.wood}, fermiers ${E.villagers.filter(v => v.task === 'food').length}/${before.food}`);
}

// 3) portes : une par passage ; la plus proche de la sortie
{
  const sim = new Simulation(), A = sim.army;
  ok(GATE_XS.length === 3 && GATE_XS[0] < 40 && Math.abs(GATE_XS[1] - 100) < 1 && GATE_XS[2] > 160, `trois portes : ${GATE_XS.map(x => x.toFixed(0)).join(' / ')}`);
  A.route({ x: 25, z: 164, way: [] }, 25, 120); const q = { x: 25, z: 164, way: [] }; A.route(q, 25, 120);
  ok(q.way[0].gi === 0, 'sortie de l\'aile gauche : porte gauche');
  const r = { x: 175, z: 164, way: [] }; A.route(r, 175, 120);
  ok(r.way[0].gi === 2, 'sortie de l\'aile droite : porte droite');
}
