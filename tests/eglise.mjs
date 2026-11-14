// v2.3 : église à construire, prêtre et pouvoirs selon le niveau
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'ÉCHEC : ') + m); if (!c) fails++; };
const run = (sim, s) => { for (let i = 0; i < s * 20; i++) sim.tick(); };
const sim = new Simulation(), E = sim.eco; for (const r in E.res) E.res[r] = 9999; E.cap = () => 1e9;
ok(!sim.build.of('church'), 'pas d\'église au départ'); ok(!sim.priest.here, 'pas de prêtre au départ');
const pop0 = E.popCap();
const c = sim.place('church', 30, 298, 0, 1); ok(!!c, 'église placée'); c.state = 'built'; c.level = 1; c.progress = 1; sim.build.syncLevels();
run(sim, 1); ok(sim.priest.here, 'le prêtre arrive quand l\'église est bâtie'); ok(E.popCap() === pop0 + 8, `familles : +8 places (${E.popCap() - pop0})`);
sim.skipPrep(); let blessOk = false; for (let i = 0; i < 20 * 90 && !blessOk; i++) { sim.tick(); const P0 = sim.priest; if (P0.post) blessOk = P0.blessMult(sim, P0.sector) > 1.1 && P0.blessMult(sim, (P0.sector + 2) % 5) === 1; }
ok(sim.priest.post && sim.priest.sector >= 0, `pendant l'assaut, il prie derrière le secteur ${sim.priest.sector}`); ok(blessOk, 'bénédiction du secteur menacé');
c.level = 2; sim.build.syncLevels(); let exo = 0; const P = sim.priest;
for (let i = 0; i < 6; i++) sim.zombies.spawn(0, P.x + (i - 3), P.z - 14, 1, sim.rng);
for (let i = 0; i < 20 * 12; i++) { sim.tick(); exo += sim.events.filter(e => e.type === 'exorcism').length; sim.events.length = 0; }
ok(exo > 0, `exorcisme lancé (${exo})`);
c.level = 3; sim.build.syncLevels(); let slowed = false; for (let i = 0; i < 20 * 40 && !slowed; i++) { if (i % 40 === 0 && P.post) sim.zombies.spawn(0, P.x, P.z - 14, 1, sim.rng); sim.tick(); if (P.post) for (let j = 0; j < sim.zombies.n; j++) if (sim.zombies.slow[j] > 0 && Math.hypot(sim.zombies.x[j] - P.x, sim.zombies.z[j] - P.z) < 20) slowed = true; } ok(slowed, 'sanctuaire : zombies ralentis près de lui');
const st = JSON.parse(JSON.stringify(serialize(sim))), s2 = new Simulation(); restore(s2, st); ok(s2.priest.here, 'sauvegarde : prêtre');
console.log(fails ? `${fails} ÉCHEC(S)` : 'tout est bon'); process.exit(fails ? 1 : 0);
