// v1.9 : golems (secousse de muraille, archers qui tombent), infirmerie, forge par type, université, population, ferme/moulin.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
import { golemsFor, ECON } from '../src/content/medieval.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'ÉCHEC : ') + m); if (!c) fails++; };
const run = (sim, s) => { for (let i = 0; i < s * 20; i++) sim.tick(); };
const rich = sim => { for (const r in sim.eco.res) sim.eco.res[r] = 9999; sim.eco.cap = () => 1e9; sim.eco.houses = 30; };
const built = (sim, t, x, z, lv) => { const o = sim.place(t, x, z, 0, 1); o.state = 'built'; o.level = lv; o.progress = 1; sim.build.syncLevels(); return o; };
ok(golemsFor(4) === 0 && golemsFor(5) === 1 && golemsFor(11) === 3, 'golems à partir de la vague 5, de plus en plus nombreux');
{ // un golem au pied de la muraille : il secoue les tronçons voisins et fait tomber des archers
  const sim = new Simulation(); sim.army.reserve.archer = 20; sim.assignArchers(2, 16); run(sim, 30);
  const a0 = sim.army.archers[2].n, hp0 = sim.wall.hp.slice(); let events = 0;
  sim.zombies.spawn(6, 100, 138, 2, sim.rng); sim.zombies.hp[sim.zombies.n - 1] = 1e6;   // increvable pour le test
  for (let i = 0; i < 20 * 20; i++) { sim.tick(); for (const e of sim.events) if (e.type === 'golem') events++; sim.events.length = 0; }
  const near = [18, 19, 21, 22].filter(k => sim.wall.hp[k] < hp0[k]).length;
  ok(sim.army.archers[2].n < a0, `archers tombés : ${a0} → ${sim.army.archers[2].n}`);
  ok(near >= 2, `la secousse touche les tronçons voisins (${near})`);
  ok(events > 0, 'alerte « golem » envoyée');
}
{ // infirmerie : soigne au repos et sauve une partie des tombés
  const sim = new Simulation(); rich(sim); built(sim, 'infirmary', 140, 290, 3);
  sim.army.reserve.soldier = 15; const q = sim.formSquad('soldier', 15, 2); run(sim, 30);
  q.hp = q.n * 140 * 0.5; const h0 = q.hp; run(sim, 5); ok(q.hp > h0 * 1.15, `soins au repos : ${Math.round(h0)} → ${Math.round(q.hp)}`);
  let saved = 0; for (let k = 0; k < 40; k++) { const r0 = sim.army.reserve.soldier; sim.army.reserve.soldier = 0; sim.army.reserve.soldier = r0; const before = sim.army.reserve.soldier; sim.army.hurtSquad(sim, q, 140); saved += sim.army.reserve.soldier - before; if (q.n <= 0) break; }
  ok(saved > 0, `blessés sauvés : ${saved}`);
}
{ // forge : attaque et défense par type, plafonnées par le niveau de la forge
  const sim = new Simulation(); rich(sim); const f = built(sim, 'forge', 66, 236, 1); const E = sim.eco;
  ok(E.buySmith('atk', 'soldier') && E.buySmith('atk', 'soldier') && !E.buySmith('atk', 'soldier'), 'forge niv. 1 : attaque plafonnée à 2');
  ok(E.atkMult('soldier') > 1.2 && E.atkMult('archer') === 1, 'l\'attaque ne concerne que le type amélioré');
  f.level = 3; sim.build.syncLevels(); ok(E.smithMax() === 6, 'forge niv. 3 : plafond 6');
  E.buySmith('def', 'heavy'); ok(E.defMult('heavy') < 1 && E.defMult('soldier') === 1, 'défense propre au type');
}
{ // université : améliorations des villageois verrouillées sans elle, plafonnées par son niveau
  const sim = new Simulation(); rich(sim); const E = sim.eco;
  ok(!sim.buyUpgrade('tools'), 'outils impossibles sans université');
  built(sim, 'university', 60, 286, 1); ok(sim.buyUpgrade('tools') && sim.buyUpgrade('tools') && !sim.buyUpgrade('tools'), 'université niv. 1 : outils plafonnés au niveau 2');
}
{ // population : château 40, maisons +15 ; ferme 6 niveaux, moulin 5
  const sim = new Simulation(); ok(sim.eco.popCap() === 40, `population du château : ${sim.eco.popCap()}`); sim.eco.houses = 10; ok(sim.eco.popCap() === 190, 'chaque maison +15');
  rich(sim); const f = built(sim, 'farm', 100, 244, 1), m = built(sim, 'mill', 128, 258, 1);
  ok(sim.build.maxLevel(f) === 6 && sim.build.maxLevel(m) === 5, 'ferme 6 niveaux, moulin 5');
}
{ // sauvegarde : forge par type et format conservés ; anciennes forges converties
  const sim = new Simulation(); rich(sim); built(sim, 'forge', 66, 236, 2); sim.eco.buySmith('atk', 'knight'); sim.format = 'phone';
  const st = JSON.parse(JSON.stringify(serialize(sim))), s2 = new Simulation(); restore(s2, st);
  ok(s2.eco.smith.atk.knight === 1 && s2.format === 'phone', 'sauvegarde : forge et format');
  delete st.eco.smith; st.eco.up.weapons = 2; const s3 = new Simulation(); restore(s3, st); ok(s3.eco.smith.atk.archer === 2 && s3.eco.up.weapons === 0, 'ancienne forge convertie en niveaux par type');
}
process.exit(fails ? 1 : 0);
