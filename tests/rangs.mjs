// Rangs militaires : le niveau du bâtiment fixe le rang ; coûts, force, résistance, vitesse suivent la table RANKS.
import { Simulation } from '../src/sim/simulation.js';
import { RANKS, UNITS } from '../src/content/medieval.js';
const ok = (c, m) => { if (!c) { console.log('ÉCHEC :', m); process.exitCode = 1; } else console.log('ok  :', m); };
const sim = new Simulation(), E = sim.eco, A = sim.army, B = sim.build;
E.res.wood = E.res.stone = E.res.iron = E.res.gold = E.res.food = 9999; E.villagers.length < 30 && 0;
const b = sim.place('barracks', 36, 224, 0, 2); for (let i = 0; i < 20 * 120; i++) sim.tick();
ok(b.state === 'built' && A.rank(sim, 'soldier').name === 'Recrue', 'caserne niv. 1 = Recrue');
ok(A.unitCost(sim, 'soldier').gold === UNITS.soldier.cost.gold, 'coût Recrue ×1');
let lvls = 1; while (B.upCost(b)) { const c = B.upCost(b); E.res.wood = E.res.stone = E.res.iron = E.res.gold = 9999; if (!sim.upgradeStruct(b.id, 2)) break; for (let i = 0; i < 20 * 400 && b.state !== 'built'; i++) sim.tick(); lvls++; }
ok(b.level === 5 && A.rank(sim, 'soldier').name === 'Légende', 'caserne montée jusqu\'au rang Légende (niv. ' + b.level + ')');
ok(A.unitCost(sim, 'soldier').gold === Math.round(UNITS.soldier.cost.gold * 3.5), 'coût Légende ×3,5');
const c4 = RANKS[4]; ok(c4.force === 2.6 && c4.res === 2.8 && c4.speed === 1.7, 'stats Légende');
