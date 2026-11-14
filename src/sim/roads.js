// Routes. Deux sortes :
//  - réseau AUTOMATIQUE : les grands chemins d'origine, puis un embranchement vers chaque bâtiment terminé (gratuit, immédiat) ;
//  - routes TRACÉES par le joueur (Travaux publics) : payées au mètre, posées progressivement par l'équipe des travaux publics.
// La qualité de TOUTES les routes suit le niveau des Travaux publics : terre → terre battue → gravier → pavés.
// Un villageois sur une route marche plus vite (bonus selon la qualité).
import { ROADS_BASE, ROADWORKS } from '../content/medieval.js';

function distSeg(px, pz, r) { const dx = r.x1 - r.x0, dz = r.z1 - r.z0, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - r.x0) * dx + (pz - r.z0) * dz) / L)); return Math.hypot(px - (r.x0 + dx * t), pz - (r.z0 + dz * t)); }

export class Roads {
  constructor() { this.reset(); }
  reset() {
    this.list = []; this.nextId = 1; this.version = 0; this.linked = new Set();
    for (const [pts, w] of ROADS_BASE) for (let i = 1; i < pts.length; i++) this.add(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w, 'base', 1);
  }
  add(x0, z0, x1, z1, w, kind, built = 1) { const r = { id: this.nextId++, x0, z0, x1, z1, w, kind, built }; this.list.push(r); this.version++; return r; }
  quality(sim) { return Math.min(3, sim.eco.level.publicworks || 0); }
  speedMult(sim, x, z) {
    const q = this.quality(sim); const b = ROADWORKS.speed[q]; if (!b) return 1;
    for (const r of this.list) if (r.built >= 1 && distSeg(x, z, r) <= r.w / 2 + 0.6) return 1 + b;
    return 1;
  }
  nearestPoint(x, z, skip) {
    let best = null, bd = Infinity;
    for (const r of this.list) {
      if (r.built < 1 || r === skip) continue;
      const dx = r.x1 - r.x0, dz = r.z1 - r.z0, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - r.x0) * dx + (z - r.z0) * dz) / L)), px = r.x0 + dx * t, pz = r.z0 + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; best = { x: px, z: pz, d }; }
    }
    return best;
  }
  // embranchements automatiques : chaque bâtiment terminé est relié au réseau le plus proche
  linkBuildings(sim) {
    for (const s of sim.build.items) {
      if (s.fixed || s.type === 'tower' || this.linked.has(s.id) || s.state !== 'built') continue;
      this.linked.add(s.id); const [hw, hd] = sim.build.half(s.type, s.rot);
      const door = { x: s.x, z: s.z + hd + 0.8 }, p = this.nearestPoint(door.x, door.z);
      if (p && p.d > 1.5 && p.d < 140) this.add(door.x, door.z, p.x, p.z, 3.2, 'auto', 1);
    }
  }
  // route tracée : coût au mètre, construite peu à peu (vitesse selon le niveau des Travaux publics)
  cost(x0, z0, x1, z1) { const L = Math.hypot(x1 - x0, z1 - z0); return { wood: Math.ceil(L * ROADWORKS.costPerM.wood), stone: Math.ceil(L * ROADWORKS.costPerM.stone) }; }
  plan(sim, x0, z0, x1, z1) {
    if ((sim.eco.level.publicworks || 0) < 1) return { ok: false, why: 'Construis les Travaux publics' };
    const L = Math.hypot(x1 - x0, z1 - z0); if (L < 4) return { ok: false, why: 'Route trop courte' }; if (L > ROADWORKS.maxLen) return { ok: false, why: `Route trop longue (max ${ROADWORKS.maxLen} m)` };
    if (Math.max(z0, z1) > 312 || Math.min(z0, z1) < 152) return { ok: false, why: 'Hors du village' };
    const c = this.cost(x0, z0, x1, z1); if (!sim.eco.pay(c)) return { ok: false, why: 'Pas assez de bois ou de pierre' };
    return { ok: true, road: this.add(x0, z0, x1, z1, 4.2, 'drawn', 0) };
  }
  update(dt, sim) {
    if (this.lastBuild !== sim.build.version) { this.lastBuild = sim.build.version; this.linkBuildings(sim); }
    const lv = sim.eco.level.publicworks || 0; if (!lv) return;
    const r = this.list.find(q => q.built < 1); if (!r) return;      // une route à la fois
    const L = Math.max(1, Math.hypot(r.x1 - r.x0, r.z1 - r.z0)); r.built = Math.min(1, r.built + ROADWORKS.buildSpeed * lv * dt / L);
    if (r.built >= 1) { this.version++; sim.events.push({ type: 'roadDone' }); }
  }
  remove(id) { const i = this.list.findIndex(r => r.id === id && r.kind === 'drawn'); if (i < 0) return false; this.list.splice(i, 1); this.version++; return true; }
  serialize() { return { next: this.nextId, linked: [...this.linked], list: this.list.filter(r => r.kind !== 'base').map(r => ({ ...r })) }; }
  restore(st) { this.reset(); if (!st) return; for (const r of st.list || []) this.list.push({ ...r }); this.nextId = st.next || this.nextId; this.linked = new Set(st.linked || []); this.version++; }
}
export { distSeg };
