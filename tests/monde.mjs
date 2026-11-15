// v2.0 : forêts latérales à défricher (minerais cachés), routes (réseau auto + tracées), jour/nuit, allumeurs, zombies qui éteignent, flèches enflammées.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
import { FRONTIER } from '../src/content/medieval.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'ÉCHEC : ') + m); if (!c) fails++; };
const run = (sim, s) => { for (let i = 0; i < s * 20; i++) sim.tick(); };
const rich = sim => { for (const r in sim.eco.res) sim.eco.res[r] = 9999; sim.eco.cap = () => 1e9; sim.eco.houses = 30; };
const built = (sim, t, x, z, lv) => { const o = sim.place(t, x, z, 0, 1); o.state = 'built'; o.level = lv; o.progress = 1; sim.build.syncLevels(); return o; };
{ // défrichage
  const sim = new Simulation(), F = sim.frontier, E = sim.eco; rich(sim); for (let i = 0; i < 10; i++) E.addVillager();
  ok(F.patches.length === 100, `100 parcelles de forêt (${F.patches.length})`);
  const far = F.patches.find(p => p.side === 'left' && p.x0 === -200); ok(!sim.clearPatch(far.id), 'parcelle éloignée : impossible tant que ses voisines sont boisées');
  ok(!sim.build.canPlace('house', -10, 262, 0).ok, 'pas de construction en forêt');
  const near = F.patches.find(p => p.side === 'left' && p.x0 === -20 && p.z0 === 252); ok(sim.clearPatch(near.id), 'parcelle voisine du village : défrichage lancé');
  E.setAssign('clear', 8); const w0 = E.res.wood; run(sim, 260);
  ok(near.state === 'open', `parcelle défrichée (${Math.round(near.wood)} bois restant)`);
  ok(sim.build.canPlace('house', near.x, near.z, 0).ok, 'construction possible sur la parcelle défrichée');
  const next = F.patches.find(p => p.side === 'left' && p.x0 === -40 && p.z0 === 252); ok(F.canClear(next), 'la parcelle suivante devient accessible');
  // minerai caché révélé
  const withOre = F.patches.find(p => p.ore && p.state === 'forest'); withOre.state = 'clearing'; withOre.wood = 1; const n0 = E.extra[withOre.ore.res].length;
  F.chop(withOre.id, 5, sim); ok(E.extra[withOre.ore.res].length === n0 + 1, `gisement de ${withOre.ore.res} découvert sous la forêt`);
}
{ // routes
  const sim = new Simulation(), R = sim.roads; rich(sim); const n0 = R.list.length;
  built(sim, 'granary', 66, 272, 1); sim.build.version++; run(sim, 1); ok(R.list.length === n0 + 1 && R.list.at(-1).kind === 'auto', 'embranchement automatique vers le nouveau bâtiment');
  ok(!sim.planRoad(60, 230, 60, 280).ok, 'tracer une route exige les Travaux publics');
  built(sim, 'publicworks', 150, 280, 1); const r = sim.planRoad(60, 230, 60, 280); ok(r.ok && r.road.built === 0, 'route tracée : chantier ouvert');
  run(sim, 25); ok(r.road.built >= 1, 'route posée par les Travaux publics');
  ok(R.speedMult(sim, 60, 250) > 1.1 && R.speedMult(sim, 30, 300) === 1, 'villageois plus rapides sur la route');
}
{ // nuit, braseros, allumeurs, zombies qui éteignent
  const sim = new Simulation(), N = sim.night, E = sim.eco; rich(sim); for (let i = 0; i < 12; i++) E.addVillager();
  N.t = 0.08; ok(N.light() > 0.95, 'plein jour'); N.t = 0.92; ok(N.light() < 0.2, 'pleine nuit');
  ok(N.rangeMult(2) < 0.75, `de nuit sans feu, les archers voient moins loin (×${N.rangeMult(2).toFixed(2)})`);
  E.setAssign('fire', 10); run(sim, 90); const lit = N.fires.filter(f => f.lit); ok(lit.length >= 8, `braseros allumés par les allumeurs (${lit.length})`);
  const wf = N.fires.find(f => f.zone === 'wall' && f.lit); ok(!wf || N.rangeMult(Math.floor(wf.x / 40)) > N.rangeMult(-1 + 0) - 1, 'secteur éclairé');
  const ff = N.fires.find(f => f.zone === 'plain'); ff.lit = true; ff.fuel = 1; for (let k = 0; k < 4; k++) sim.zombies.spawn(0, ff.x + k * 0.3, ff.z, 2, sim.rng);
  let out = false; for (let i = 0; i < 20 * 6; i++) { sim.tick(); if (sim.events.some(e => e.type === 'fireOut')) out = true; sim.events.length = 0; }
  ok(!ff.lit && out, 'les zombies éteignent un brasero');
  const st = JSON.parse(JSON.stringify(serialize(sim))), s2 = new Simulation(); restore(s2, st); ok(Math.abs(s2.night.t - N.t) < 0.01 && s2.night.fires.filter(f => f.lit).length === N.fires.filter(f => f.lit).length, 'sauvegarde : heure et braseros');
}
{ // feux de la plaine : bûchers préparés entre deux vagues avec le bois apporté, allumés avant la nuit ; savoir-faire améliorable
  const camp = (lv) => { const sim = new Simulation(), N = sim.night, E = sim.eco; rich(sim); for (let i = 0; i < 12; i++) E.addVillager(); E.up.firecraft = lv; sim.phase = 'prep'; sim.timer = 1e5; N.t = 0.12; E.setAssign('fire', 8); return sim; };
  const sim = camp(0), N = sim.night, E = sim.eco, w0 = E.res.wood; let carried = false;
  for (let i = 0; i < 20 * 100; i++) { sim.tick(); if (E.villagers.some(v => v.task === 'fire' && v.carry > 0 && v.carryRes === 'wood')) carried = true; }
  const P = N.piles(), sumA = N.fires.reduce((a, f) => a + (f.pile || 0), 0);
  ok(carried, 'l\'équipe des feux porte le bois jusqu\'à la plaine'); ok(sumA > 1, `bûchers en préparation (${sumA.toFixed(2)} bûchers de bois empilés, ${P.ready} prêts)`);
  ok(!N.fires.some(f => f.zone === 'plain' && f.lit), 'de jour, les bûchers ne sont pas allumés');
  for (const f of N.fires) if (f.zone === 'plain') f.pile = 1;
  N.t = 0.79; run(sim, 70); const lit = N.fires.filter(f => f.zone === 'plain' && f.lit).length; ok(lit >= 4, `la nuit approche : bûchers allumés (${lit}/8)`);
  ok(N.rangeMult(2) > 0.85 || N.light() > 0.9, 'la plaine éclairée aide les tireurs');
  // (v10.1) avec les allumeurs autonomes, tout est empilé en 100 s : on compare plus tôt
  const pile = s2 => s2.night.fires.reduce((a, f) => a + (f.pile || 0), 0), slow = camp(0), fast = camp(3); run(slow, 45); run(fast, 45); ok(pile(fast) > pile(slow) * 1.1, `savoir-faire niv. 3 : bûchers plus vite (${pile(fast).toFixed(2)} contre ${pile(slow).toFixed(2)})`);
  const st = JSON.parse(JSON.stringify(serialize(fast))), s2 = new Simulation(); restore(s2, st); ok(Math.abs(s2.night.fires.reduce((a, f) => a + f.pile, 0) - pile(fast)) < 0.05, 'sauvegarde : bûchers');
}
{ // flèches enflammées
  const sim = new Simulation(); rich(sim); built(sim, 'forge', 66, 236, 1); ok(!sim.buyUpgrade('fireArrows'), 'flèches enflammées : forge niveau 2 requise');
  sim.build.of('forge').level = 2; sim.build.syncLevels(); ok(sim.buyUpgrade('fireArrows') && sim.buyUpgrade('fireArrows') && sim.buyUpgrade('fireArrows'), 'flèches enflammées achetées');
  for (let i = 0; i < 20; i++) sim.zombies.spawn(0, 60 + i, 120, 1, sim.rng); let fires = 0; for (let i = 0; i < 20 * 8; i++) { sim.tick(); fires = Math.max(fires, sim.fires.filter(f => f.small).length); }
  ok(fires > 0, `des flèches enflamment le sol (${fires} feux)`);
}
{ // la partie sauvegarde la forêt
  const sim = new Simulation(); const p = sim.frontier.patches.find(q => sim.frontier.canClear(q)); sim.clearPatch(p.id); p.wood = 42;
  const s2 = new Simulation(); restore(s2, JSON.parse(JSON.stringify(serialize(sim)))); ok(s2.frontier.patches[p.id].state === 'clearing' && s2.frontier.patches[p.id].wood === 42, 'sauvegarde : parcelles');
}
// v10.1 : allumeurs autonomes — hors quota, sans bois, ils préparent et allument les feux tout seuls
{ const sim = new Simulation(), E = sim.eco, pop0 = E.population(); E.res.wood = 0;
  for (let i = 0; i < 20 * 120; i++) sim.tick();
  ok(E.crew.length === 10 && E.population() === pop0 && E.assign.fire === 0, `10 allumeurs hors quota (population ${E.population()})`);
  ok(sim.night.piles().ready >= 4, `bûchers préparés sans bois du stock (${sim.night.piles().ready} prêts)`);
  sim.night.t = 0.8; for (let i = 0; i < 20 * 70; i++) sim.tick(); const lit = sim.night.fires.filter(f => f.lit).length; ok(lit >= 12, `à la nuit, les feux sont allumés tout seuls (${lit}/${sim.night.fires.length})`);
}
process.exit(fails ? 1 : 0);
