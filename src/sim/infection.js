// Mordus (v2.4) : combattants mordus par un zombie. Cycle : à terre (vulnérable, les zombies se ruent dessus) → se relève → marche
// vers la zone de quarantaine (ou erre près de la placette si elle est pleine) → le prêtre vient le guérir (retour en réserve) ; sinon, au bout du
// délai, il se TRANSFORME : en cellule, les gardes l'abattent ; ailleurs, il devient un zombie qui tente de mordre ses voisins.
import { INFECTION, UNITS } from '../content/medieval.js';
import { WALL_Z1, PLAZA, wallOff } from './constants.js';

const tmp = new Int32Array(64);
export class Infection {
  constructor() { this.reset(); }
  reset() { this.list = []; this.nextId = 1; this.turned = 0; this.cured = 0; this.devoured = 0; }
  prison(sim) { const s = sim.build.of('prison'); return s && (s.state === 'built' || s.state === 'upgrading') ? s : null; }
  cells(sim) { const p = this.prison(sim); return p ? INFECTION.cells * Math.max(1, sim.eco.level.prison || 1) : 0; }
  jailed() { let n = 0; for (const b of this.list) if (b.state === 'jailed') n++; return n; }
  // morsure d'un combattant de l'escouade q (le zombie zi l'a mordu en plongeant ou debout)
  bite(sim, q, zi, tackle) {
    const r = q.rad || 2, x = q.x + (sim.rng() - 0.5) * r * 1.4, z = q.z + r * 0.8 + 0.6;   // il tombe à l'arrière de son escouade (les zombies viennent du nord)
    const b = { id: this.nextId++, type: q.type, x, z, px: x, pz: z, face: sim.rng() * 6.28, state: 'down', down: tackle ? INFECTION.down : 0.6, q: q.id, t: INFECTION.turn, path: null, biters: 0, eat: 0, heal: 0, slot: -1 };
    this.list.push(b); sim.events.push({ type: 'bitten', unit: q.type, x, z, tackle }); sim.blast('bite', x, z, 1);
    return b;
  }
  outside(b) { return b.z < WALL_Z1 + wallOff(b.x) - 0.5; }
  // cible d'attraction pour les zombies : un mordu à terre (le plus proche dans le rayon)
  prey(x, z) {
    let best = null, bd = INFECTION.frenzy * INFECTION.frenzy;
    for (const b of this.list) { if (b.state !== 'down') continue; const d = (b.x - x) ** 2 + (b.z - z) ** 2; if (d < bd) { bd = d; best = b; } }
    return best;
  }
  update(dt, sim) {
    const Z = sim.zombies, slowK = 1 / (1 + INFECTION.prisonSlow * (sim.eco.level.prison || 0));   // la quarantaine retarde la transformation
    for (let k = this.list.length - 1; k >= 0; k--) {
      const b = this.list[k]; b.px = b.x; b.pz = b.z;
      b.t -= dt * (b.state === 'jailed' ? slowK : 1);
      if (b.state === 'down') {
        // à terre : les zombies au contact le dévorent
        const m = sim.hash.query(b.x, b.z, 1.4, Z.x, Z.z, tmp); let n = 0; for (let q = 0; q < m; q++) if (Z.hp[tmp[q]] > 0) n++;
        const sq = sim.army.squads.find(o => o.id === b.q && o.n > 0 && Math.hypot(o.x - b.x, o.z - b.z) < (o.rad || 2) + 4);   // ses camarades le protègent
        b.biters = n; if (n >= INFECTION.devour) { b.eat += dt * (sq ? INFECTION.guard : 1); if (b.eat >= INFECTION.devourTime) { this.list.splice(k, 1); this.devoured++; sim.events.push({ type: 'devoured', unit: b.type, x: b.x, z: b.z }); sim.blast('devour', b.x, b.z, 1.6); continue; } }
        if ((b.down -= dt) <= 0 && n < INFECTION.devour) { b.state = 'walk'; b.path = null; }
      }
      if (b.t <= 0) { this.list.splice(k, 1); this.turn(sim, b); continue; }
      if (b.state === 'walk') {
        const P = this.prison(sim);
        if (!b.path) {
          let tx, tz; if (P && this.jailed() + this.list.filter(o => o.state === 'walk' && o.slot >= 0).length < this.cells(sim)) { b.slot = 1; tx = P.x + ((b.id % 4) - 1.5) * 2.6; tz = P.z + ((b.id >> 2) % 3 - 1) * 2.4; } else { b.slot = -1; tx = PLAZA.x + ((b.id % 7) - 3) * 2.5; tz = PLAZA.z + 6; }
          b.path = sim.night.route(b.x, b.z, tx, tz);
        }
        const p = b.path[0];
        if (!p) { if (b.slot >= 0 && P) { b.state = 'jailed'; sim.events.push({ type: 'jailed', unit: b.type }); } else b.state = 'wait'; continue; }
        const dx = p[0] - b.x, dz = p[1] - b.z, d = Math.hypot(dx, dz), st = 2.6 * dt;   // il boite
        if (d <= st) { b.x = p[0]; b.z = p[1]; b.path.shift(); } else { b.x += dx / d * st; b.z += dz / d * st; b.face = Math.atan2(dx, dz); }
      } else if (b.state === 'wait' && this.prison(sim) && this.jailed() < this.cells(sim)) { b.state = 'walk'; b.path = null; }    // une place s'est libérée
    }
  }
  // soin par le prêtre
  cure(sim, b) { const i = this.list.indexOf(b); if (i < 0) return; this.list.splice(i, 1); sim.army.reserve[b.type] = (sim.army.reserve[b.type] || 0) + 1; this.cured++; sim.events.push({ type: 'cured', unit: b.type, x: b.x, z: b.z }); sim.blast('heal', b.x, b.z, 2); }
  // transformation : en cellule, les gardes l'abattent ; sinon il devient un zombie, et peut surprendre un voisin
  turn(sim, b) {
    this.turned++;
    if (b.state === 'jailed') { sim.events.push({ type: 'turnedJail', unit: b.type, x: b.x, z: b.z }); sim.blast('devour', b.x, b.z, 0.8); return; }
    const Z = sim.zombies; if (!Z.spawn(0, b.x, b.z, 2, sim.rng)) return; const zi = Z.n - 1; Z.turned[zi] = 1;
    sim.events.push({ type: 'turned', unit: b.type, x: b.x, z: b.z }); sim.blast('turn', b.x, b.z, 1.5);
    let near = null, bd = 64; for (const q of sim.army.squads) { if (q.hp <= 0) continue; const d = (q.x - b.x) ** 2 + (q.z - b.z) ** 2; if (d < bd) { bd = d; near = q; } }
    if (near) {
      if (sim.rng() < INFECTION.surprise) {   // surpris : un voisin est mordu avant de réagir
        const lost = sim.army.unitHp(near.type); near.hp = Math.max(0, near.hp - lost); near.n = Math.max(0, Math.ceil(near.hp / sim.army.unitHp(near.type))); this.bite(sim, near, zi, true); Z.bite[zi] = 1; Z.biteK[zi] = 2;
      } else { Z.hit(zi, ZOMBIE_HP_HIT); sim.events.push({ type: 'repelled', x: b.x, z: b.z }); }   // l'escouade réagit à temps
    }
  }
  serialize() { return this.list.map(b => ({ type: b.type, x: +b.x.toFixed(1), z: +b.z.toFixed(1), state: b.state === 'down' ? 'walk' : b.state, t: +b.t.toFixed(1), slot: b.slot })); }
  restore(st) { this.reset(); for (const o of st || []) this.list.push({ id: this.nextId++, type: o.type, x: o.x, z: o.z, px: o.x, pz: o.z, face: 0, state: o.state === 'jailed' ? 'jailed' : 'walk', down: 0, t: o.t, path: null, biters: 0, eat: 0, heal: 0, slot: o.slot }); }
}
const ZOMBIE_HP_HIT = 25;
export { UNITS };
