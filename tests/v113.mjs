// (v11.3) Marchés après la vague 15, scieries / fermes / moulins multiples, coupe de bois en forêt vierge.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
const ok = (c, m) => { if (!c) { console.log('ÉCHEC :', m); process.exitCode = 1; } else console.log('ok  :', m); };
const sim = new Simulation(), B = sim.build, E = sim.eco; Object.assign(E.res, { wood: 9000, stone: 9000, iron: 5000, gold: 5000, food: 5000 }); E.baseCapBoost = 0;
ok(!B.canBuildType('market_gold').ok, 'marché verrouillé avant la vague 15');
sim.wave = 16; ok(B.canBuildType('market_wood').ok, 'marché constructible après la vague 15');
const m = B.place('market_wood', 90, 240, 0, 2); ok(!!m, 'marché au bois posé'); for (let i = 0; i < 20 * 60; i++) sim.tick();
E.res.wood = 100; const w0 = E.res.wood; for (let i = 0; i < 20 * 30; i++) sim.tick(); ok(E.res.wood >= w0 + 20 && !B.canBuildType('market_wood').ok, 'le marché produit seul ; un seul marché par ressource');
Object.assign(E.res, { wood: 600, stone: 600, gold: 300 }); const s2 = B.place('sawmill', 60, 240, 0, 2), f2 = B.place('farm', 130, 235, 0, 2), l2 = B.place('mill', 70, 225, 0, 2);
ok(s2 && f2 && l2 && B.newCost('sawmill').wood > 60, 'scierie, ferme et moulin supplémentaires (coût croissant)');
for (let i = 0; i < 20 * 60; i++) sim.tick(); const sl = E.slots('sawmill'); ok(sl > 3 + 2 * 1, `places des bûcherons additionnées (${sl})`);
// coupe de bois
const F = sim.frontier, p = F.patches.find(q => F.canLog(q)); ok(p && p.t === 1500, 'parcelle de forêt abattable (1500 bois)');
E.res.wood = 100; const w1 = E.res.wood; sim.logPatch(p.id); ok(p.state === 'logging', 'coupe ordonnée'); sim.assignVillagers('clear', 6);
for (let i = 0; i < 20 * 120; i++) sim.tick(); ok(p.t < 1500 && E.res.wood > w1 + 200 && p.state !== 'open', `forêt coupée sans défrichage : ${Math.round(1500 - p.t)} bois en 2 min, la parcelle reste une forêt`);
const st = serialize(sim); const sim2 = new Simulation(); restore(sim2, st); ok(Math.abs(sim2.frontier.patches[p.id].t - p.t) < 2 && sim2.build.all('market_wood').length === 1, 'sauvegarde / rechargement : parcelle et marché conservés');
