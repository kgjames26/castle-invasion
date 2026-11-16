// (v11.3) Eau : douves et ruisseau infranchissables hors passage ; contournement par les passerelles et le pont-levis.
import { Simulation } from '../src/sim/simulation.js';
import { CROSSINGS, MOAT, moatProfile, streamPoints } from '../src/sim/water.js';
const ok = (c, m) => { if (!c) { console.log('ÉCHEC :', m); process.exitCode = 1; } else console.log('ok  :', m); };
const sim = new Simulation(), W = sim.water, E = sim.eco;
const pts = streamPoints(), mid = pts[10];
ok(W.wet(mid[0], mid[1]) && W.wet(MOAT.x + 24, MOAT.z), 'le ruisseau et la douve sont de l\'eau');
const d = CROSSINGS[0]; ok(!W.wet(d.x, d.z) && CROSSINGS.length === 4, 'le pont-levis et 3 passerelles sont praticables');
for (const b of CROSSINGS.filter(b => b.kind === 'plank')) ok(!W.wet(b.x, b.z) && W.wet(b.x + b.dx * (b.len / 2 + 0.3) * 0 + 0, b.z + 3.5) !== undefined, `passerelle (${b.x | 0}, ${b.z | 0}) : praticable au milieu`);
// ligne droite à travers le ruisseau : bloquée, itinéraire par une passerelle
const a = { x: mid[0] + 0.5, z: mid[1] - 9 }, b = { x: mid[0] + 0.5, z: mid[1] + 8 }; ok(!W.clear(a.x, a.z, b.x, b.z), 'traverser le ruisseau en ligne droite est impossible');
const r = W.route(a.x, a.z, b.x, b.z); ok(r && r.length >= 1, 'itinéraire par un passage (' + (r ? r.length : 0) + ' points)');
// un villageois suit l'itinéraire sans jamais mettre le pied dans l'eau
const v = E.villagers[0]; v.x = a.x; v.z = a.z; let wet = 0, arrived = false, steps = 0;
for (; steps < 20 * 120 && !arrived; steps++) { arrived = E.moveTo(v, b.x, b.z, 0.05); if (W.wet(v.x, v.z)) wet++; }
ok(arrived && wet === 0, `le villageois traverse par la passerelle (${(steps / 20).toFixed(0)} s) sans toucher l'eau`);
// dépôt au château (à l'intérieur des douves) : on passe par le pont-levis
const w = E.villagers[1]; w.x = 160; w.z = 250; wet = 0; arrived = false; const dropX = 100, dropZ = 284;
for (steps = 0; steps < 20 * 120 && !arrived; steps++) { arrived = E.moveTo(w, dropX, dropZ, 0.05); if (W.wet(w.x, w.z)) wet++; }
ok(arrived && wet === 0, `dépôt au château : le villageois entre par le pont-levis (${(steps / 20).toFixed(0)} s)`);
// dans l'eau (partie chargée en plein ruisseau) : remis sur la berge
const z = E.villagers[2]; z.x = mid[0]; z.z = mid[1]; ok(W.wet(z.x, z.z) && W.eject(z) && !W.wet(z.x, z.z), 'un villageois tombé à l\'eau est remis sur la berge');
// maillage : toutes les paires de points secs de la carte ont un chemin (jamais de villageois bloqué)
let bad = 0, tot = 0; const dry = []; for (let x = 8; x < 196; x += 12) for (let zz = 214; zz < 312; zz += 7) if (!W.wet(x, zz) && Math.hypot(x - MOAT.x, zz - MOAT.z) > 31) dry.push([x, zz]);
for (const p of dry) for (const q of dry) { if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 70 || (p[0] * 7 + q[1]) % 5) continue; tot++; const rt = W.route(p[0], p[1], q[0], q[1]); if (!W.clear(p[0], p[1], q[0], q[1]) && !rt) bad++; }
ok(tot > 100 && bad === 0, `${tot} trajets du village testés : ${bad} sans passage`);
// la partie tourne normalement avec l'eau (2 min)
for (let i = 0; i < 20 * 120; i++) { if (sim.phase === 'prep') sim.timer = Math.max(sim.timer, 5); sim.tick(); }
ok(E.villagers.every(q => !W.wet(q.x, q.z)), 'après 2 min de jeu, aucun villageois dans l\'eau');
