// v1.8 : magicien autonome (invocation, sorts, soins, réparation), chevaliers (frappe multiple), hordes en groupe, feu au sol, difficulté, sauvegarde.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'ÉCHEC : ') + m); if (!c) fails++; };
const run = (sim, s) => { for (let i = 0; i < s * 20; i++) sim.tick(); };
const rich = sim => { for (const r in sim.eco.res) sim.eco.res[r] = 9999; sim.eco.cap = () => 1e9; sim.eco.houses = 30; };
const built = (sim, t, x, z, lv) => { const o = sim.place(t, x, z, 0, 1); o.state = 'built'; o.level = lv; o.progress = 1; sim.build.syncLevels(); return o; };
// 1) invocation : impossible sans Maison du sorcier, puis le magicien arrive, agit seul pendant un assaut
{
  const sim = new Simulation(); rich(sim);
  ok(!sim.summonMage(), 'pas de magicien sans Maison du sorcier');
  built(sim, 'wizard', 176, 258, 4);
  ok(sim.summonMage(), 'invocation lancée'); run(sim, 20); ok(sim.mages.list.length === 1, 'le magicien est arrivé');
  sim.wave = 7; sim.skipPrep(); const seen = new Set(); let last = 0;
  for (let i = 0; i < 20 * 90; i++) { sim.tick(); for (const b of sim.blasts) if (b.id > last) { seen.add(b.kind); last = b.id; } }
  ok(seen.has('fireballLaunch') && seen.has('fire'), `boules de feu lancées (${[...seen].join(', ')})`);
  ok(seen.has('lightning') || seen.has('meteorCall'), 'sorts avancés au niveau 4');
  const m = sim.mages.list[0]; ok(!m || m.mana >= 0, 'mana jamais négative');
}
// 2) soin et rempart magique
{
  const sim = new Simulation(); rich(sim); built(sim, 'wizard', 176, 258, 3); sim.summonMage(); run(sim, 20);
  sim.army.reserve.soldier = 15; const q = sim.formSquad('soldier', 15, 2); q.hp = q.n * 140 * 0.3; const h0 = q.hp;
  sim.wall.hp[12] = 0; sim.onBreach(12); run(sim, 70);
  ok(q.hp > h0, `escouade soignée (${Math.round(h0)} → ${Math.round(q.hp)})`);
  ok(sim.wall.hp[12] > 0, 'brèche refermée par magie');
}
// 3) chevaliers : rang requis (caserne niv. 3), frappe plusieurs zombies à la fois
{
  const sim = new Simulation(); rich(sim); const b = built(sim, 'barracks', 36, 224, 2);
  ok(sim.train('knight', 1) === 0, 'chevalier refusé au niveau 2'); b.level = 3; sim.build.syncLevels();
  ok(sim.train('knight', 1) === 1, 'chevalier entraîné au niveau 3');
  sim.army.reserve.knight = 15; const q = sim.formSquad('knight', 15, 2);
  for (let i = 0; i < 12; i++) sim.zombies.spawn(2, q.x + (i % 4) - 1.5, q.z - 2 + (i >> 2) * 0.6, 2, sim.rng);
  let hurt = 0; run(sim, 1.5); for (let i = 0; i < sim.zombies.n; i++) if (sim.zombies.hp[i] < 120) hurt++;
  ok(hurt + (12 - sim.zombies.n) >= 3, `frappe multiple : ${hurt} blessés, ${12 - sim.zombies.n} tués`);
}
// 4) hordes : les zombies d'un même groupe restent groupés (étalement limité) en approchant
{
  const sim = new Simulation(); sim.wave = 5; sim.skipPrep(); run(sim, 25);
  const Z = sim.zombies, g = new Map(); for (let i = 0; i < Z.n; i++) { if (!Z.grp[i] || Z.z[i] > 120) continue; (g.get(Z.grp[i]) || g.set(Z.grp[i], []).get(Z.grp[i])).push([Z.x[i], Z.z[i]]); }
  let worst = 0, n = 0; for (const pts of g.values()) { if (pts.length < 5) continue; n++; const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length; const dz = Math.max(...pts.map(p => Math.abs(p[1] - cz))); worst = Math.max(worst, dz); }
  ok(n > 0 && worst < 16, `hordes compactes : ${n} groupes, profondeur max ${worst.toFixed(1)} m (pas de file indienne)`);
}
// 5) feu : une boule de feu laisse un feu qui brûle les zombies
{
  const sim = new Simulation(); for (let i = 0; i < 6; i++) sim.zombies.spawn(0, 100 + i * 0.5, 60, 2, sim.rng);
  sim.explode(101, 60, 3, 0, 'fire'); ok(sim.fires.length === 1, 'feu au sol créé');
  run(sim, 3); let lost = 0; for (let i = 0; i < sim.zombies.n; i++) lost += 40 - sim.zombies.hp[i]; lost += (6 - sim.zombies.n) * 40;
  ok(lost > 60, `le feu brûle (${Math.round(lost)} PV perdus)`);
}
// 6) difficulté et sauvegarde
{
  const a = new Simulation(), b = new Simulation(); b.setDifficulty('hard'); a.skipPrep(); b.skipPrep(); run(a, 11); run(b, 11);
  ok(b.spawn.total > a.spawn.total, `difficile : plus de zombies (${a.spawn.total} → ${b.spawn.total})`);
  const sim = new Simulation(); rich(sim); built(sim, 'wizard', 176, 258, 2); sim.summonMage(); run(sim, 20); sim.setDifficulty('easy');
  const st = JSON.parse(JSON.stringify(serialize(sim))), s2 = new Simulation(); restore(s2, st);
  ok(s2.mages.list.length === 1 && s2.difficulty === 'easy', 'sauvegarde : magicien et difficulté restaurés');
}
// 7) ordre direct : poster une escouade à un point précis de la cour, puis sortie
{
  const sim = new Simulation(); sim.army.reserve.soldier = 15; const q = sim.formSquad('soldier', 15, 2);
  sim.squadMove(q.id, 60, 180); run(sim, 25); ok(q.mode === 'garrison' && Math.hypot(q.x - 60, q.z - 180) < 1, `poste libre atteint (${q.x.toFixed(0)}, ${q.z.toFixed(0)})`);
  sim.squadMove(q.id, 70, 110); ok(q.mode === 'field', 'toucher devant la muraille = sortie');
}
process.exit(fails ? 1 : 0);
