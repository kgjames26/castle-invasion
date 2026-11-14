// IA de l'armée (v2.6) : tant que le joueur ne donne pas d'ordre, les troupes se débrouillent seules.
//  · Archers : les archers en réserve montent d'eux-mêmes sur les remparts et se répartissent selon la menace de chaque secteur ;
//    pendant l'assaut, l'IA en déplace vers le secteur le plus pressé (un à la fois, sans vider les autres).
//  · Escouades « auto » (q.auto) : gardent le secteur le plus menacé, courent colmater une brèche, interceptent les intrus ;
//    les unités mobiles et en forme (cavaliers, chevaliers, lourds) font des sorties courtes contre les petits groupes au pied du mur,
//    et rentrent dès qu'elles sont blessées ou que le danger est passé ; formation et posture choisies selon la situation.
//  Un ordre du joueur rend l'escouade manuelle (q.auto = false) ; « Rendre la main à l'IA » la remet en automatique.
import { SECTORS, SECTOR_W, WALL_Z0, WALL_Z1, ARCHER_SLOTS, sectorOfX, wallOff } from './constants.js';
import { SQUAD } from '../content/medieval.js';

const SORTIE_TYPES = ['cavalry', 'knight', 'heavy'];
export function threatMap(sim) {
  const Z = sim.zombies, W = sim.wall, T = new Float32Array(SECTORS), at = new Float32Array(SECTORS), inside = new Float32Array(SECTORS), hpAt = new Float32Array(SECTORS), giant = new Uint8Array(SECTORS);
  for (let i = 0; i < Z.n; i++) {
    if (Z.hp[i] <= 0) continue; const s = sectorOfX(Z.x[i]), wz = WALL_Z0 + wallOff(Z.x[i]), d = wz - Z.z[i];
    if (Z.z[i] > WALL_Z1 + wallOff(Z.x[i])) { inside[s]++; T[s] += 6; continue; }
    if (d > 70) continue; T[s] += 1 + Math.max(0, 25 - d) / 8;
    if (d < 9) { at[s]++; hpAt[s] += Z.hp[i]; if (Z.type[i] === 5 || Z.type[i] === 6) giant[s] = 1; }
  }
  for (let s = 0; s < SECTORS; s++) { let lo = 1; for (let k = 0; k < 8; k++) { const seg = s * 8 + k; if (seg < W.hp.length) lo = Math.min(lo, W.hp[seg] / W.segMax(seg)); } T[s] += (1 - lo) * 12 + (lo <= 0 ? 15 : 0); }
  return { T, at, inside, hpAt, giant };
}
export class ArmyAI {
  constructor() { this.t = 0; this.moveT = 0; }
  update(dt, sim) {
    if ((this.t -= dt) > 0) return; this.t = 1;
    const A = sim.army, M = threatMap(sim), fight = sim.phase === 'assault' || sim.phase === 'alert';
    if (A.autoArchers) this.archers(sim, A, M, fight);
    this.squads(sim, A, M, fight);
  }
  archers(sim, A, M, fight) {
    let total = A.reserve.archer; for (const a of A.archers) total += a.n;
    const w = new Float32Array(SECTORS); let sw = 0; for (let s = 0; s < SECTORS; s++) { w[s] = 1 + (fight ? M.T[s] * 0.25 : 0); sw += w[s]; }
    const want = s => Math.min(ARCHER_SLOTS, total * w[s] / sw);
    // les archers en réserve montent sur les remparts, là où il en manque le plus
    while (A.reserve.archer > 0) { let b = -1, bg = -Infinity; for (let s = 0; s < SECTORS; s++) { const g = want(s) - A.archers[s].n; if (A.archers[s].n < ARCHER_SLOTS && g > bg) { bg = g; b = s; } } if (b < 0 || !A.assignArchers(b, 1)) break; }
    // pendant l'assaut : déplacer un archer vers le secteur le plus pressé (pas plus d'un toutes les 3 s)
    if (fight && (this.moveT -= 1) <= 0) {
      let src = -1, dst = -1, gs = 0, gd = 0; for (let s = 0; s < SECTORS; s++) { const g = want(s) - A.archers[s].n; if (g > gd) { gd = g; dst = s; } if (-g > gs && A.archers[s].n > 2) { gs = -g; src = s; } }
      if (src >= 0 && dst >= 0 && src !== dst && gd > 2 && gs > 2 && A.archers[dst].n < ARCHER_SLOTS) { A.assignArchers(src, -1); A.assignArchers(dst, 1); this.moveT = 3; }
    }
  }
  squads(sim, A, M, fight) {
    const autos = A.squads.filter(q => q.auto); if (!autos.length) return;
    const need = Array.from({ length: SECTORS }, (_, s) => M.T[s] + M.inside[s] * 10), taken = new Float32Array(SECTORS);
    for (const q of A.squads) if (!q.auto && q.mode === 'garrison') taken[q.sector] += q.n;
    for (const q of autos) {
      const r = A.hpRatio(q), mobile = SORTIE_TYPES.includes(q.type);
      // dehors : rentrer si blessé, si la vague est finie ou s'il n'y a plus personne à combattre près de la cible
      if (q.mode === 'field') {
        let near = 0; const Z = sim.zombies; for (let i = 0; i < Z.n; i++) if (Z.hp[i] > 0 && Math.hypot(Z.x[i] - q.tx, Z.z[i] - q.tz) < 26) near++;
        if (r < 0.5 || !fight || !near) { A.garrison(q, q.sector); this.tactics(q, false); q.auto = true; }
        else { taken[q.sector] += q.n; }
        continue;
      }
      // sortie courte : unités mobiles et en forme, petit groupe au pied du mur, pas de géant
      if (fight && mobile && r > 0.75 && !q.way.length) {
        let best = -1, bs = 0; for (let s = 0; s < SECTORS; s++) { if (M.giant[s] || !M.at[s] || M.inside[s]) continue; if (M.hpAt[s] < q.hp * 0.6 && M.at[s] > bs) { bs = M.at[s]; best = s; } }
        if (best >= 0 && Math.abs(best - q.sector) <= 1) { const x = best * SECTOR_W + SECTOR_W / 2, z = WALL_Z0 + wallOff(x) - 9; A.sortie(q, x, z); this.tactics(q, true); q.auto = true; continue; }
      }
      // garnison : le secteur qui a le plus besoin de renfort (brèche, intrus, menace), avec un peu d'inertie pour ne pas courir partout
      let best = q.sector, bn = need[q.sector] - taken[q.sector] * 0.4;
      for (let s = 0; s < SECTORS; s++) { const v = need[s] - taken[s] * 0.4 - Math.abs(s - q.sector) * 0.8; if (v > bn * 1.4 + 2) { bn = v; best = s; } }
      if (r < 0.35) best = q.sector;                                       // trop blessée : reste à son poste (l'infirmerie la soigne)
      if (best !== q.sector || q.custom) { A.garrison(q, best); q.auto = true; }
      taken[best] += q.n; this.tactics(q, false);
    }
  }
  // formation et posture selon la situation
  tactics(q, out) {
    if (out) { q.stance = 'charge'; q.form = q.type === 'cavalry' || q.type === 'knight' ? 'wedge' : 'line'; }
    else { q.stance = 'hold'; q.form = q.type === 'heavy' ? 'phalanx' : 'line'; }
  }
}
export { SQUAD };
