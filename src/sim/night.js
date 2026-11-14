// Cycle jour-nuit et feux. La nuit tombe progressivement ; sans feu, les archers et les tours voient moins loin.
// Des villageois « allumeurs » (tâche « fire ») allument et ravitaillent les braseros (bois du stock), y compris ceux
// du champ de bataille, au-delà de la muraille (ils passent par les portes et rentrent si un zombie approche).
// Les zombies qui passent sur un brasero allumé l'ÉTEIGNENT.
import { DAY, BRAZIERS, FIRE_KEEP, GATE_XS_LIST } from '../content/medieval.js';
import { SECTORS, SECTOR_W, WALL_Z0, WALL_Z1, sectorOfX } from './constants.js';

const tmp = new Int32Array(64);
export class Night {
  constructor() { this.reset(); }
  reset() {
    this.t = DAY.start;      // 0 = aube … 0,5 = crépuscule … 1 = aube suivante
    this.fires = BRAZIERS.map((b, i) => ({ id: i, x: b.x, z: b.z, zone: b.zone, fuel: 0, lit: false, claim: 0 }));
    this.out = 0;
  }
  // luminosité du jour : 1 en plein jour, ~0,12 au cœur de la nuit, transitions douces
  light() {
    const t = this.t, s = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const dusk = s(DAY.dusk[0], DAY.dusk[1], t), dawn = s(DAY.dawn[0], DAY.dawn[1], t);
    return 1 - 0.88 * (dusk - dawn);
  }
  isNight() { return this.light() < 0.55; }
  nightSoon() { return this.light() < 0.8 || (this.t > DAY.dusk[0] - 0.06 && this.t < DAY.dawn[1]); }
  // éclairage d'un secteur de la muraille (0..1) : braseros allumés sur la muraille et devant elle
  sectorLight(s) {
    let n = 0; for (const f of this.fires) if (f.lit && (f.zone === 'wall' || f.zone === 'field') && sectorOfX(f.x) === s) n += f.zone === 'field' ? 1 : 0.8;
    return Math.min(1, n / 1.6);
  }
  // portée effective des tireurs la nuit : 55 % dans le noir complet, 100 % de jour ou bien éclairé
  rangeMult(s) { const L = this.light(); if (L >= 0.95) return 1; const lit = this.sectorLight(s); return Math.min(1, L + (1 - L) * (0.5 + 0.5 * lit) * 0.9 + 0.1); }
  update(dt, sim) {
    this.t = (this.t + dt / DAY.length) % 1;
    for (const f of this.fires) if (f.lit) { f.fuel -= dt / FIRE_KEEP.burn; if (f.fuel <= 0) { f.fuel = 0; f.lit = false; } }
    // les zombies piétinent les braseros allumés à leur portée
    const Z = sim.zombies;
    for (const f of this.fires) {
      if (!f.lit) continue;
      const k = sim.hash.query(f.x, f.z, FIRE_KEEP.stomp, Z.x, Z.z, tmp); let n = 0; for (let q = 0; q < k; q++) if (Z.hp[tmp[q]] > 0) n++;
      if (n) { f.fuel -= n * FIRE_KEEP.stompRate * dt; if (f.fuel <= 0) { f.fuel = 0; f.lit = false; this.out++; sim.events.push({ type: 'fireOut', zone: f.zone, x: f.x, z: f.z }); sim.blast('fireOut', f.x, f.z, 2); } }
    }
  }
  // choix d'un brasero pour un allumeur : la nuit (ou à son approche), le plus urgent ; les braseros du front d'abord la nuit
  pick(sim, v) {
    if (!this.nightSoon()) return -1;
    let best = -1, bs = -Infinity;
    for (const f of this.fires) {
      if (f.claim >= 1 || f.fuel > 0.55) continue;
      if (f.zone === 'field' && this.danger(sim, f.x, f.z)) continue;
      const s = (f.lit ? 0 : 50) + (1 - f.fuel) * 30 + (f.zone === 'wall' ? 18 : f.zone === 'field' ? 12 : 0) - Math.hypot(f.x - v.x, f.z - v.z) * 0.05;
      if (s > bs) { bs = s; best = f.id; }
    }
    return best;
  }
  danger(sim, x, z) { const Z = sim.zombies, k = sim.hash.query(x, z, FIRE_KEEP.flee, Z.x, Z.z, tmp); for (let q = 0; q < k; q++) if (Z.hp[tmp[q]] > 0) return true; return false; }
  // chemin d'un point à un autre : passer par la porte la plus proche si l'on traverse la muraille
  route(x0, z0, x1, z1) {
    const inside0 = z0 > WALL_Z1 - 0.5, inside1 = z1 > WALL_Z1 - 0.5; if (inside0 === inside1) return [[x1, z1]];
    const gx = GATE_XS_LIST.reduce((a, g) => Math.abs(g - (x0 + x1) / 2) < Math.abs(a - (x0 + x1) / 2) ? g : a, GATE_XS_LIST[0]);
    return inside0 ? [[gx, WALL_Z1 + 2], [gx, WALL_Z0 - 3], [x1, z1]] : [[gx, WALL_Z0 - 3], [gx, WALL_Z1 + 2], [x1, z1]];
  }
  serialize() { return { t: +this.t.toFixed(4), fires: this.fires.map(f => [+f.fuel.toFixed(3), f.lit ? 1 : 0]) }; }
  restore(st) { this.reset(); if (!st) return; this.t = st.t ?? DAY.start; (st.fires || []).forEach(([fu, l], i) => { const f = this.fires[i]; if (f) { f.fuel = fu; f.lit = !!l; } }); }
}
