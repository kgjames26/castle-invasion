// Construction libre : chantier, ouvriers, amélioration, déplacement, tours, sauvegarde ; défense seule des premières vagues.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
const ok = (c, m) => { if (!c) { console.log('ÉCHEC :', m); process.exitCode = 1; } else console.log('ok  :', m); };
const sim = new Simulation(), E = sim.eco, B = sim.build;
const run = s => { for (let i = 0; i < s * 20; i++) sim.tick(); };
ok(B.items.length === 6 && B.items.every(s => s.type === 'tower' && s.fixed), '6 tours de muraille au départ');
ok(Object.values(E.level).every(l => l === 0) && E.houses === 0, 'aucun bâtiment au départ (château seul)');
ok(E.idleCount() === 2, 'deux villageois libres au départ : ' + E.idleCount());
const h = sim.place('house', 100, 262, 0, 2); ok(!!h && h.state === 'site', 'maison posée en chantier');
ok(!sim.place('house', 102, 262, 0), 'chevauchement refusé');
ok(!sim.place('barracks', 100, 150, 0), 'trop près de la muraille refusé');
run(10); ok(E.builderCount() === 2, 'deux ouvriers affectés');
run(40); ok(h.state === 'built' && E.houses === 1, `maison terminée (progression ${h.progress.toFixed(2)}, pop max ${E.popCap()})`);
ok(E.builderCount() === 0, 'ouvriers libérés après chantier');
const sm = sim.place('sawmill', 40, 262, 0, 1); run(70); ok(sm.state === 'built' && E.level.sawmill === 1, 'scierie construite, niveau actif');
ok(E.slots('sawmill') === 8, 'emplacements bûcherons = base 3 + 5');
ok(sim.upgradeStruct(sm.id) && sm.state === 'upgrading', 'amélioration lancée'); run(90); ok(sm.level === 2 && sm.state === 'built', 'amélioration terminée (niv. ' + sm.level + ')');
ok(sim.moveStruct(sm.id, 60, 270, 1) && E.level.sawmill === 0, 'déplacement : bâtiment bloqué'); run(60); ok(sm.state === 'built' && E.level.sawmill === 2, 'après passage d\'un ouvrier : de nouveau actif, niveau conservé');
const t = sim.place('tower', 60, 170, 0, 1); ok(!!t, 'tour posée'); run(100); ok(t.state === 'built', 'tour construite');
const wt = B.items[2]; const c = sim.upgradeStruct(wt.id); ok(c, 'tour de muraille en amélioration'); 
const snap = JSON.parse(JSON.stringify(serialize(sim))); const s2 = new Simulation(); restore(s2, snap);
ok(s2.build.items.length === sim.build.items.length && s2.eco.houses === E.houses, 'sauvegarde/restauration des structures');
// défense seule : aucune construction, 5 vagues
const d = new Simulation(); let lost = 0;
for (let i = 0; i < 20 * 60 * 14 && !d.over; i++) { d.tick(); }
console.log('sans rien construire : vague', d.wave, 'château', Math.round(d.castleHp), 'brèches', d.stats.breaches, 'tués', d.zombies.kills, d.over ? 'PERDU' : '');
ok(d.wave >= 4 && !d.over, 'les tours de base tiennent les premières vagues');
