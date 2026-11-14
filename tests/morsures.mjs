// v2.4 : morsures, geôle, prêtre guérisseur, transformation
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
import { INFECTION } from '../src/content/medieval.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'ÉCHEC : ') + m); if (!c) fails++; };
const run = (sim, s) => { for (let i = 0; i < s * 20; i++) sim.tick(); };
const rich = sim => { for (const r in sim.eco.res) sim.eco.res[r] = 9999; sim.eco.cap = () => 1e9; };
const built = (sim, t, x, z, lv) => { const o = sim.place(t, x, z, 0, 1); o.state = 'built'; o.level = lv; o.progress = 1; sim.build.syncLevels(); return o; };
{ // une sortie face à des mordeurs : des combattants sont mordus
  const sim = new Simulation(); rich(sim); sim.army.reserve.soldier = 30; const q = sim.formSquad('soldier', 15, 2); sim.squadMove(q.id, 100, 120);
  run(sim, 15); for (let i = 0; i < 40; i++) sim.zombies.spawn(i % 3 ? 2 : 0, 94 + (i % 10) * 1.3, 114 + (i / 10 | 0) * 1.2, 2, sim.rng);
  let bites = 0, tackles = 0, anim = 0; for (let i = 0; i < 20 * 40; i++) { sim.tick(); for (const e of sim.events) if (e.type === 'bitten') { bites++; if (e.tackle) tackles++; } sim.events.length = 0; for (let j = 0; j < sim.zombies.n; j++) if (sim.zombies.bite[j] > 0) anim++; }
  ok(bites > 0, `des combattants sont mordus (${bites}, dont ${tackles} plaqués au sol)`); ok(anim > 0, 'animations de morsure');
}
{ // mordu sans geôle ni prêtre : il se transforme ; avec geôle : abattu en cellule
  const sim = new Simulation(); rich(sim); sim.army.reserve.soldier = 20; const q = sim.formSquad('soldier', 15, 2); run(sim, 5);
  const I = sim.infection, b = I.bite(sim, q, -1, false); b.t = 3; const z0 = sim.zombies.n; let turned = false;
  for (let i = 0; i < 20 * 5; i++) { sim.tick(); if (sim.events.some(e => e.type === 'turned')) turned = true; sim.events.length = 0; }
  ok(turned, 'sans prêtre à temps, le mordu devient un zombie');
  const sim2 = new Simulation(); rich(sim2); built(sim2, 'prison', 120, 220, 1); sim2.army.reserve.soldier = 20; const q2 = sim2.formSquad('soldier', 15, 2); run(sim2, 5);
  const b2 = sim2.infection.bite(sim2, q2, -1, false); let jailed = false; for (let i = 0; i < 20 * 40 && !jailed; i++) { sim2.tick(); jailed = b2.state === 'jailed'; }
  ok(jailed, 'le mordu rejoint la geôle'); b2.t = 0.5; let jt = false; for (let i = 0; i < 20 * 3; i++) { sim2.tick(); if (sim2.events.some(e => e.type === 'turnedJail')) jt = true; sim2.events.length = 0; }
  ok(jt && !sim2.zombies.turned.slice(0, sim2.zombies.n).some(v => v), 'transformé en cellule : abattu par les gardes, aucun zombie libre');
}
{ // le prêtre guérit le mordu
  const sim = new Simulation(); rich(sim); built(sim, 'church', 30, 298, 1); built(sim, 'prison', 120, 220, 1); sim.army.reserve.soldier = 20; const q = sim.formSquad('soldier', 15, 2); run(sim, 5);
  const r0 = sim.army.reserve.soldier, b = sim.infection.bite(sim, q, -1, false); let cured = false; for (let i = 0; i < 20 * 80 && !cured; i++) { sim.tick(); cured = sim.events.some(e => e.type === 'cured'); sim.events.length = 0; }
  ok(cured && sim.army.reserve.soldier === r0 + 1, 'le prêtre guérit le mordu : il retourne en réserve');
}
{ // un mordu à terre attire les zombies qui le dévorent
  const sim = new Simulation(); rich(sim); sim.army.reserve.soldier = 20; const q = sim.formSquad('soldier', 15, 2); run(sim, 5);
  const b = sim.infection.bite(sim, q, -1, true); b.x = 100; b.z = 110; b.down = 99; for (let i = 0; i < 4; i++) sim.zombies.spawn(2, 96 + i * 2, 104, 2, sim.rng);
  let dev = false; for (let i = 0; i < 20 * 15 && !dev; i++) { sim.tick(); dev = sim.events.some(e => e.type === 'devoured'); sim.events.length = 0; }
  ok(dev, 'les zombies se ruent sur le mordu à terre et le dévorent');
}
{ // géant : déchire sans mordre
  const sim = new Simulation(); rich(sim); sim.army.reserve.soldier = 30; const q = sim.formSquad('soldier', 15, 2); sim.squadMove(q.id, 100, 120); run(sim, 15);
  sim.zombies.spawn(5, 100, 114, 2, sim.rng); let torn = 0, bit = 0; for (let i = 0; i < 20 * 30; i++) { sim.tick(); for (const e of sim.events) { if (e.type === 'torn') torn++; if (e.type === 'bitten') bit++; } sim.events.length = 0; }
  ok(torn > 0 && bit === 0, `le colosse déchire ses proies sans les mordre (${torn})`);
  const st = JSON.parse(JSON.stringify(serialize(sim))), s2 = new Simulation(); restore(s2, st); ok(true, 'sauvegarde');
}
console.log(fails ? `${fails} ÉCHEC(S)` : 'tout est bon'); process.exit(fails ? 1 : 0);
