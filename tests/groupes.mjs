// (v11.1) Fusions libres, groupes mêlés disposés en tacticien, orientation, séparations, archers en troupe, cibles dangereuses, sauvegarde.
import { Simulation } from '../src/sim/simulation.js';
import { serialize, restore } from '../src/sim/save.js';
import { tacticalLayout, rotLocal } from '../src/sim/army.js';
const ok = (c, m) => { if (!c) { console.log('ÉCHEC :', m); process.exitCode = 1; } else console.log('ok  :', m); };
const sim = new Simulation(), A = sim.army, run = s => { for (let i = 0; i < s * 20; i++) { if (sim.phase === 'prep') sim.timer = Math.max(sim.timer, 5); sim.tick(); } };
Object.assign(A.reserve, { soldier: 40, heavy: 9, archer: 22, cavalry: 7 });
const s1 = A.take('soldier', 7); ok(s1 && s1.n === 7, 'troupe de 7 fantassins prise dans la réserve (plus de minimum)');
const r = A.merge([s1], { soldier: 20, heavy: 9, archer: 22, cavalry: 7 });
ok(r.group && r.squads.length === 4, `fusion mêlée : un groupe de ${r.squads.length} troupes (une par type)`);
const sol = r.squads.find(q => q.type === 'soldier'); ok(sol.n === 27, 'les fantassins sont réunis en une seule troupe (27)');
const L = tacticalLayout(A.members(r.group)), at = t => L.find(o => o.q.type === t);
ok(at('archer').z > at('heavy').z && at('archer').z > at('soldier').z, 'archers à l\'arrière');
ok(at('heavy').z === 0 && at('soldier').z === 0, 'lourds et fantassins en première ligne');
ok(Math.abs(at('cavalry').x) > Math.abs(at('soldier').x), 'cavaliers sur une aile');
A.orderGroup(r.group, 100, 110, true); run(60);
const arch = A.members(r.group).find(q => q.type === 'archer'), hv = A.members(r.group).find(q => q.type === 'heavy');
ok(arch.mode === 'field' && arch.z > hv.z, `sur le terrain, les archers restent derrière l'infanterie (${arch.z.toFixed(1)} > ${hv.z.toFixed(1)})`);
A.rotate(hv, Math.PI / 2); run(40);   // face à l'est : les archers passent à l'ouest du front
ok(arch.x < hv.x - 3 && r.group.face === Math.PI / 2, `pivot vers l'est : archers à l'ouest (${arch.x.toFixed(1)} < ${hv.x.toFixed(1)})`);
const [ex, ez] = rotLocal(0, -1, Math.PI / 2); ok(ex > 0.99 && Math.abs(ez) < 1e-6, 'rotLocal : « devant » face à l\'est = +x');
const big = A.take('soldier', 13), half = A.splitFree(sol, 'half'); ok(half.length === 1 && half[0].gid === r.group.id && sol.n + half[0].n === 27, 'séparation en deux moitiés, le morceau reste dans le groupe');
const m2 = A.mergeWith(big, sol); ok(m2.group && A.members(m2.group).length >= 4, 'fusion d\'une troupe isolée avec un groupe (bouton Fusionner avec…)');
A.dissolve(m2.group); ok(A.squads.every(q => !q.gid), 'séparer par type : chaque troupe redevient indépendante');
const snapG = A.merge(A.squads.filter(q => q.type !== 'soldier')); const snap = JSON.parse(JSON.stringify(serialize(sim))); const s2 = new Simulation(); restore(s2, snap);
ok(s2.army.groups.length === 1 && s2.army.members(s2.army.groups[0]).length === A.members(snapG.group).length, 'sauvegarde/restauration des groupes');
// (v11.2) escadrons de 150 : compléter, tout regrouper, recrues versées directement ; fureur après la vague 15
{ const sim = new Simulation(), A = sim.army; Object.assign(A.reserve, { soldier: 175 }); const a = A.take('soldier', 20), b = A.take('soldier', 30), c = A.take('soldier', 25);
  const k = A.fillTo(a); ok(a.n === 150 && k === 130 && A.reserve.soldier === 0, `compléter à 150 : réserve puis petites troupes (+${k})`);
  ok(A.squads.filter(q => q.type === 'soldier').reduce((s, q) => s + q.n, 0) === 175, 'personne ne disparaît : 175 au total');
  A.reserve.soldier = 140; const L = A.packAll('soldier'); ok(L.length === 3 && L.filter(q => q.n === 150).length === 2 && !A.groups.length, `tout regrouper par 150 : ${L.map(q => q.n).join(' + ')}, sans groupe`);
  const small = L.find(q => q.n < 150); small.feed = true; const n0 = small.n; A.queues.barracks.push({ type: 'soldier', t: 0, full: 8 }); sim.eco.level.barracks = 1; A.trainTick(0.1, sim);
  ok(small.n === n0 + 1 && A.reserve.soldier === 0, 'recrue versée directement dans la troupe choisie'); }
{ const { waveSpec, aggrOf } = await import('../src/content/medieval.js');
  ok(waveSpec(14).aggr === 1 && aggrOf(25) > 1.3 && waveSpec(25).n > waveSpec(15).n * 3, `fureur : vague 25 = ${waveSpec(25).n} zombies (×${(waveSpec(25).n / waveSpec(15).n).toFixed(1)}), agressivité ${aggrOf(25).toFixed(2)}`); }
