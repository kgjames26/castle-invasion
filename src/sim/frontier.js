// Forêts vierges de part et d'autre du village (la carte s'étend vers le bas, à gauche et à droite ; le front ne change pas).
// La forêt est découpée en parcelles de 20 m. On ne défriche qu'une parcelle voisine d'une terre déjà ouverte ; des défricheurs
// (tâche « clear ») abattent le bois (rapporté au stock) ; une parcelle rasée devient constructible et peut révéler un gisement.
import { FRONTIER } from '../content/medieval.js';

export class Frontier {
  constructor() { this.reset(1234); }
  reset(seed) {
    let s = seed >>> 0 || 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const F = FRONTIER; this.patches = []; this.version = 0;
    for (const side of ['left', 'right']) {
      const [x0, x1] = F[side];
      for (let gx = x0; gx < x1; gx += F.cell) for (let gz = F.z0; gz < F.z1; gz += F.cell) {
        const p = { id: this.patches.length, side, x0: gx, z0: gz, x: gx + F.cell / 2, z: gz + F.cell / 2, state: 'forest', wood: F.wood, t: F.timber, ore: null };
        if (rnd() < F.oreChance) {
          const r = rnd(), res = r < 0.42 ? 'stone' : r < 0.77 ? 'iron' : 'gold';
          p.ore = { res, x: p.x + (rnd() - 0.5) * 8, z: p.z + (rnd() - 0.5) * 8, amount: F.oreAmount[res] * (0.7 + rnd() * 0.6) | 0 };
        }
        p.seed = rnd(); this.patches.push(p);
      }
    }
  }
  at(x, z) { const F = FRONTIER; if (z < F.z0 || z >= F.z1) return null; return this.patches.find(p => x >= p.x0 && x < p.x0 + F.cell && z >= p.z0 && z < p.z0 + F.cell) || null; }
  // terre ouverte : le village d'origine, ou une parcelle défrichée
  isOpen(x, z) { if (x >= 0 && x <= 200) return true; const p = this.at(x, z); return !!p && p.state === 'open'; }
  isOpenRect(x0, z0, x1, z1) { for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) if (!this.isOpen(x, z)) return false; return true; }
  neighbors(p) { const F = FRONTIER; return this.patches.filter(q => q !== p && Math.abs(q.x - p.x) + Math.abs(q.z - p.z) <= F.cell + 0.1); }
  // une parcelle n'est accessible que si elle touche le village ou une parcelle déjà ouverte
  reachable(p) {
    const F = FRONTIER;
    if ((p.side === 'left' && p.x0 + F.cell >= F.left[1]) || (p.side === 'right' && p.x0 <= F.right[0])) return true;
    return this.neighbors(p).some(q => q.state === 'open');
  }
  canClear(p) { return p && p.state === 'forest' && this.reachable(p); }
  // (v11.3) abattre le bois sans défricher : la parcelle reste une forêt (qui repousse) et rapporte bien plus de bois
  canLog(p) { return p && p.state === 'forest' && p.t >= FRONTIER.minLog && this.reachable(p); }
  logOrder(id) { const p = this.patches[id]; if (!this.canLog(p)) return false; p.state = 'logging'; this.version++; return true; }
  grow(dt) { for (const p of this.patches) if (p.state === 'forest' && p.t < FRONTIER.timber) p.t = Math.min(FRONTIER.timber, p.t + FRONTIER.regrow * dt); }
  order(id) { const p = this.patches[id]; if (!this.canClear(p)) return false; p.state = 'clearing'; this.version++; return true; }
  cancel(id) { const p = this.patches[id]; if (!p || (p.state !== 'clearing' && p.state !== 'logging')) return false; p.state = 'forest'; this.version++; return true; }
  active() { return this.patches.filter(p => (p.state === 'clearing' && p.wood > 0) || (p.state === 'logging' && p.t > 0)); }
  left(p) { return p.state === 'logging' ? p.t : p.state === 'clearing' ? p.wood : 0; }
  // bois abattu : quand la parcelle est rasée, elle s'ouvre et révèle son gisement éventuel
  chop(id, amount, sim) {
    const p = this.patches[id]; if (!p) return 0;
    if (p.state === 'logging') { const g = Math.min(p.t, amount); p.t -= g; if (p.t <= 0.001) { p.t = 0; p.state = 'forest'; this.version++; sim.events.push({ type: 'logged', x: p.x, z: p.z }); } return g; }
    if (p.state !== 'clearing') return 0;
    const got = Math.min(p.wood, amount); p.wood -= got;
    if (p.wood <= 0.001) {
      p.wood = 0; p.state = 'open'; this.version++;
      if (p.ore) { sim.eco.extra[p.ore.res].push({ x: p.ore.x, z: p.ore.z, amount: p.ore.amount, max: p.ore.amount, found: true }); sim.events.push({ type: 'oreFound', res: p.ore.res, x: p.ore.x, z: p.ore.z }); }
      else sim.events.push({ type: 'cleared', x: p.x, z: p.z });
      sim.build.version++;
    }
    return got;
  }
  openCount() { return this.patches.filter(p => p.state === 'open').length; }
  serialize() { return this.patches.map(p => [p.state === 'open' ? 2 : p.state === 'clearing' ? 1 : p.state === 'logging' ? 3 : 0, Math.round(p.wood), Math.round(p.t)]); }
  restore(st) { if (!st) return; st.forEach(([s, w, t], i) => { const p = this.patches[i]; if (!p) return; p.state = s === 2 ? 'open' : s === 1 ? 'clearing' : s === 3 ? 'logging' : 'forest'; p.wood = w; p.t = t ?? FRONTIER.timber; }); this.version++; }
}
