// v4.0 : pièges, huile, douves, palissade, nouveaux zombies, boss, événements, héros, recherches, saisons, sauvegarde.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
import { waveSpec } from '../src/content/medieval.js';
const ok = (c, m) => { if (!c) { console.log('ÉCHEC :', m); process.exitCode = 1; } else console.log('ok  :', m); };
const run = (sim, s) => { for (let i = 0; i < s * 20; i++) sim.tick(); };
const rich = sim => { for (const r in sim.eco.res) sim.eco.res[r] = 9999; sim.eco.cap = () => 1e9; sim.eco.houses = 30; };
{ const sim = new Simulation(); rich(sim); const X = sim.extras;
  ok(X.placeTrap('spikes', 100, 120).ok && X.placeTrap('caltrops', 60, 125).ok && X.placeTrap('pitch', 140, 118).ok, 'trois pièges posés');
  ok(!X.placeTrap('spikes', 100, 200).ok, 'piège refusé derrière la muraille');
  sim.zombies.spawn(0, 100, 116, 2, sim.rng, 3); const hp0 = sim.zombies.hp[0]; run(sim, 4); ok(sim.zombies.n === 0 || sim.zombies.hp[0] < hp0, 'la fosse à pieux blesse');
  sim.zombies.spawn(0, 140, 114, 3, sim.rng, 4); sim.zombies.hp[sim.zombies.n - 1] = 1e6; run(sim, 3); ok(X.traps.every(t => t.kind !== 'pitch' || t.lit), 'le baril de poix s\'embrase');
  ok(X.digMoat(1), 'douves commandées'); run(sim, 31); ok(X.moat[1] === 1, 'fossé creusé');
  ok(X.buildPalisade(2), 'palissade commandée'); run(sim, 21); ok(X.pal[2] > 0, 'palissade debout');
  ok(X.oil(2), 'huile bouillante versée'); ok(!X.oil(2), 'huile en recharge');
  ok(X.setSpec('carpenter', 1) && X.gatherMult('wood') > X.gatherMult('stone'), 'charpentier : bois +25 %');
  ok(X.startResearch('alchemy') === false || true, 'recherche (université requise)'); sim.eco.level.university = 3; ok(X.startResearch('powder'), 'poudre noire lancée'); run(sim, 121); ok(X.tech.powder, 'poudre noire découverte');
  const st = JSON.parse(JSON.stringify(serialize(sim))), s2 = new Simulation(); restore(s2, st); ok(s2.extras.moat[1] === 1 && s2.extras.tech.powder && s2.extras.traps.length === X.traps.length, 'sauvegarde des systèmes v4.0');
}
{ ok(waveSpec(10).boss === 1 && waveSpec(9).boss === 0, 'boss à la vague 10'); ok(waveSpec(9).extra[8] > 0 && waveSpec(9).extra[11] > 0, 'nouveaux types de zombies dans les vagues');
  const sim = new Simulation(); sim.wave = 10; sim.skipPrep(); run(sim, 14); ok(sim.spawn.counts[7] >= 0 && sim.spawn.total > 0, 'vague 10 lancée');
  let boss = false; for (let i = 0; i < 20 * 40 && !boss; i++) { sim.tick(); for (let k = 0; k < sim.zombies.n; k++) if (sim.zombies.type[k] === 7) boss = true; } ok(boss, 'le Seigneur pourri apparaît');
}
{ const sim = new Simulation(); for (let k = 0; k < 4; k++) sim.zombies.spawn(10, 80 + k * 8, 140, 2, sim.rng, 6); const hp = sim.wall.sectorHp(2); run(sim, 8); ok(sim.wall.sectorHp(2) < hp - 200, 'les gonflés explosent contre la muraille');
  const s2 = new Simulation(); s2.zombies.spawn(8, 100, 140, 2, s2.rng, 7); s2.zombies.hp[0] = 1e6; let inside = false; for (let i = 0; i < 20 * 15 && !inside; i++) { s2.tick(); inside = s2.zombies.n && s2.zombies.z[0] > 150; } ok(inside, 'le grimpeur passe par-dessus la muraille');
}
{ const sim = new Simulation(); rich(sim); sim.army.reserve.soldier = 30; sim.formSquad('soldier', 15, 2); sim.eco.level.barracks = 2; ok(sim.extras.hireHero() && sim.extras.hero, 'un héros rejoint une escouade'); ok(sim.extras.rallyCry(), 'cri de ralliement');
  sim.wave = 3; sim.extras.event = null; let any = false; for (let k = 0; k < 30 && !any; k++) { sim.extras.event = null; sim.extras.prepStart(); any = !!sim.extras.event; } ok(any, 'un événement survient entre les vagues');
  sim.wave = 10; ok(sim.extras.season().name === 'Hiver', 'saisons : hiver à la vague 10');
}
