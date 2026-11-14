// v2.8 : escouade 15 · peloton 50 · escadron 150 ; fusion dès qu'il y a assez d'hommes ; séparation ; < 15 en réserve
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'ÉCHEC : ') + m); if (!c) fails++; };
const sim = new Simulation(), A = sim.army;
A.reserve.soldier = 12; ok(!sim.formSquad('soldier', 15, 2), 'moins de 15 hommes : pas d\'escouade, ils restent en réserve');
A.reserve.soldier = 45; const a = sim.formSquad('soldier', 15, 2), b = sim.formSquad('soldier', 15, 1); ok(a && b && a.grade === 'escouade' && a.n === 15, 'escouades de 15');
ok(!A.canRegroup(a, 'peloton'), `45 hommes : pas encore de peloton (${A.poolFor(a)})`);
A.reserve.soldier = 5; ok(!A.canRegroup(a, 'peloton'), 'pas assez d\'hommes (35) : fusion impossible');
A.reserve.soldier = 25; const n = sim.squadRegroup(a.id, 'peloton'); ok(n === 50 && a.grade === 'peloton' && !A.squads.includes(b), `peloton de 50 formé (${n}), l'autre escouade absorbée`);
A.reserve.soldier = 100; ok(sim.squadRegroup(a.id, 'escadron') === 150 && a.grade === 'escadron', 'escadron de 150');
const made = sim.squadSplit(a.id); ok(made === 2 && a.grade === 'peloton' && a.n === 50, `escadron séparé en 3 pelotons (${made + 1})`);
A.reserve.soldier = 0; a.n = 44; a.hp = 44 * 140; const m2 = sim.squadSplit(a.id); ok(m2 === 1 && a.n === 15 && A.reserve.soldier === 14, `peloton de 44 → 2 escouades + 14 en réserve (${m2 + 1} escouades, réserve ${A.reserve.soldier})`);
const st = JSON.parse(JSON.stringify(serialize(sim))), s2 = new Simulation(); restore(s2, st); ok(s2.army.squads.some(q => q.grade === 'peloton' && q.n === 50), 'sauvegarde : grades');
console.log(fails ? `${fails} ÉCHEC(S)` : 'tout est bon'); process.exit(fails ? 1 : 0);
