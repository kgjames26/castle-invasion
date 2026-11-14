// Cycle jour-nuit et feux. La nuit tombe progressivement ; sans feu, les archers et les tours voient moins loin.
// L'équipe des feux (tâche « fire ») allume et ravitaille les braseros (bois du stock) ; dans la plaine, au-delà de la muraille,
// elle prépare ENTRE DEUX VAGUES de grands bûchers avec le bois qu'elle apporte, puis les allume à l'approche de la nuit
// (passage par les portes ; retour si un zombie approche). Les zombies piétinent les bûchers et éteignent les feux.
import { DAY, BRAZIERS, FIRE_KEEP, GATE_XS_LIST, UPGRADES } from '../content/medieval.js';
import { SECTORS, SECTOR_W, WALL_Z0, WALL_Z1, sectorOfX, wallOff } from './constants.js';

const tmp = new Int32Array(64);
export class Night {
  constructor() { this.reset(); }
  reset() {
    this.t = DAY.start;      // 0 = aube … 0,5 = crépuscule … 1 = aube suivante
    this.fires = BRAZIERS.map((b, i) => ({ id: i, x: b.x, z: b.zone === 'wall' ? b.z + wallOff(b.x) : b.z, zone: b.zone, fuel: 0, lit: false, claim: 0, pile: 0 }));
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
    let n = 0; for (const f of this.fires) if (f.lit && (f.zone === 'wall' || f.zone === 'plain') && sectorOfX(f.x) === s) n += f.zone === 'plain' ? 1.1 : 0.8;
    return Math.min(1, n / 1.6);
  }
  // portée effective des tireurs la nuit : 55 % dans le noir complet, 100 % de jour ou bien éclairé
  rangeMult(s) { const L = this.light(); if (L >= 0.95) return 1; const lit = this.sectorLight(s); return Math.min(1, L + (1 - L) * (0.5 + 0.5 * lit) * 0.9 + 0.1); }
  update(dt, sim) {
    this.t = (this.t + dt / DAY.length) % 1;
    const plainBurn = FIRE_KEEP.plainBurn * (1 + UPGRADES.firecraft.per * (sim.eco.up.firecraft || 0));
    for (const f of this.fires) if (f.lit) { f.fuel -= dt / (f.zone === 'plain' ? plainBurn : FIRE_KEEP.burn); if (f.fuel <= 0) { f.fuel = 0; f.lit = false; } }
    // les zombies piétinent les braseros allumés à leur portée (et dispersent les bûchers pas encore allumés)
    const Z = sim.zombies;
    for (const f of this.fires) {
      if (!f.lit && !(f.pile > 0)) continue;
      const k = sim.hash.query(f.x, f.z, f.zone === 'plain' ? FIRE_KEEP.plainStomp : FIRE_KEEP.stomp, Z.x, Z.z, tmp); let n = 0; for (let q = 0; q < k; q++) if (Z.hp[tmp[q]] > 0) n++;
      if (n && !f.lit) { f.pile = Math.max(0, f.pile - n * FIRE_KEEP.trample * dt); continue; }
      if (n) { f.fuel -= n * FIRE_KEEP.stompRate * dt; if (f.fuel <= 0) { f.fuel = 0; f.lit = false; this.out++; sim.events.push({ type: 'fireOut', zone: f.zone, x: f.x, z: f.z }); sim.blast('fireOut', f.x, f.z, 2); } }
    }
  }
  // entre deux vagues (de jour) : les bûchers de la plaine à préparer
  building(sim) { return sim.phase !== 'assault' && !this.nightSoon(); }
  depot(f) { return FIRE_KEEP.depots.reduce((a, d) => Math.abs(d[0] - f.x) < Math.abs(a[0] - f.x) ? d : a); }
  // choix d'une mission pour un membre de l'équipe des feux : { id, mode } — mode 'light' (allumer un bûcher prêt), 'stoke' (ravitailler
  // un brasero) ou 'stack' (apporter du bois au bûcher) ; la nuit (ou à son approche), allumer et ravitailler ; entre deux vagues, empiler
  pick(sim, v) {
    let best = -1, bs = -Infinity, mode = null;
    const soon = this.nightSoon(), build = this.building(sim);
    for (const f of this.fires) {
      const dist = Math.hypot(f.x - v.x, f.z - v.z) * 0.05;
      if (f.zone === 'plain') {
        if (this.danger(sim, f.x, f.z)) continue;
        if (soon && !f.lit && f.pile >= 0.999 && f.claim < 1) { const s = 130 - dist; if (s > bs) { bs = s; best = f.id; mode = 'light'; } }
        else if (build && !f.lit && f.pile < 0.999 && f.claim < 2) { const s = 40 + f.pile * 20 - dist; if (s > bs) { bs = s; best = f.id; mode = 'stack'; } }
        continue;
      }
      if (!soon || f.claim >= 1 || f.fuel > 0.55) continue;
      const s = (f.lit ? 0 : 50) + (1 - f.fuel) * 30 + (f.zone === 'wall' ? 18 : 0) - dist;
      if (s > bs) { bs = s; best = f.id; mode = 'stoke'; }
    }
    return best < 0 ? null : { id: best, mode };
  }
  piles() { let ready = 0, n = 0, lit = 0; for (const f of this.fires) if (f.zone === 'plain') { n++; if (f.lit) lit++; else if (f.pile >= 0.999) ready++; } return { n, ready, lit }; }
  danger(sim, x, z) { const Z = sim.zombies, k = sim.hash.query(x, z, FIRE_KEEP.flee, Z.x, Z.z, tmp); for (let q = 0; q < k; q++) if (Z.hp[tmp[q]] > 0) return true; return false; }
  // chemin d'un point à un autre : passer par la porte la plus proche si l'on traverse la muraille
  route(x0, z0, x1, z1) {
    const inside0 = z0 > WALL_Z1 + wallOff(x0) - 0.5, inside1 = z1 > WALL_Z1 + wallOff(x1) - 0.5; if (inside0 === inside1) return [[x1, z1]];
    const gx = GATE_XS_LIST.reduce((a, g) => Math.abs(g - (x0 + x1) / 2) < Math.abs(a - (x0 + x1) / 2) ? g : a, GATE_XS_LIST[0]);
    const go = wallOff(gx); return inside0 ? [[gx, WALL_Z1 + go + 2], [gx, WALL_Z0 + go - 3], [x1, z1]] : [[gx, WALL_Z0 + go - 3], [gx, WALL_Z1 + go + 2], [x1, z1]];
  }
  serialize() { return { t: +this.t.toFixed(4), fires: this.fires.map(f => [+f.fuel.toFixed(3), f.lit ? 1 : 0, +(f.pile || 0).toFixed(3)]) }; }
  restore(st) { this.reset(); if (!st) return; this.t = st.t ?? DAY.start; (st.fires || []).forEach(([fu, l, pl], i) => { const f = this.fires[i]; if (f) { f.fuel = fu; f.lit = !!l; f.pile = f.zone === 'plain' ? pl || 0 : 0; } }); }
}
