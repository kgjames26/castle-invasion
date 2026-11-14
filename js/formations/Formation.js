import { FORMATIONS } from './FormationTypes.js';

let FID = 1;

// Formation : un leader suit le pathfinding, les autres suivent leur slot relatif
export class Formation {
  constructor(manager, type, units) {
    this.manager = manager;
    this.game = manager.game;
    this.id = FID++;
    this.type = type;
    this.def = FORMATIONS[type];
    this.units = units.slice();
    this.initial = units.length;
    this.moving = false;
    this.lastMove = -99;
    // orientation : vers le nord par défaut, sinon vers l'ennemi le plus proche
    const c = this.centroid();
    this.rot = Math.PI;
    const e = this.game.combat.nearestEnemy(c.x, c.z, 40);
    if (e) this.rot = Math.atan2(e.x - c.x, e.z - c.z);
    this.origin = c;
    this.computeSlots();
    this.assign();
    for (const u of this.units) { u.formation = this; u.order = null; u.path = null; u.target = null; }
  }

  get speed() { return Math.min(...this.units.map(u => u.def.speed)); }

  centroid() {
    let x = 0, z = 0;
    for (const u of this.units) { x += u.x; z += u.z; }
    return { x: x / this.units.length, z: z / this.units.length };
  }

  computeSlots() {
    const cav = this.units.every(u => u.type === 'cavalry');
    this.offsets = this.def.slots(this.units.length, cav ? 2.6 : 1.7);
  }

  // affectation des unités aux slots (glouton par distance) ; le leader prend le slot 0
  assign() {
    const free = this.units.slice();
    const pos = this.offsets.map(o => this.world(o));
    // les cavaliers et soldats en premier rang, archers derrière
    free.sort((a, b) => (a.def.ranged ? 1 : 0) - (b.def.ranged ? 1 : 0));
    this.slotOf = new Map();
    const order = this.offsets.map((o, i) => i).sort((a, b) => this.offsets[b].lz - this.offsets[a].lz);
    for (const si of order) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < free.length; k++) {
        const u = free[k];
        const d = Math.hypot(u.x - pos[si].x, u.z - pos[si].z) + (u.def.ranged ? 6 : 0) * (this.offsets[si].lz >= -0.1 ? 1 : 0);
        if (d < bd) { bd = d; best = k; }
      }
      const u = free.splice(best, 1)[0];
      if (u) this.slotOf.set(u, si);
    }
    this.leader = [...this.slotOf.entries()].find(([, si]) => si === 0)?.[0] || this.units[0];
  }

  world(o, origin = this.origin, rot = this.rot) {
    const fx = Math.sin(rot), fz = Math.cos(rot);
    const rx = -fz, rz = fx; // droite
    return { x: origin.x + rx * o.lx + fx * o.lz, z: origin.z + rz * o.lx + fz * o.lz };
  }

  moveTo(x, z, attackMove = false) {
    const c = this.moving ? this.leaderOrigin() : this.origin;
    if (Math.hypot(x - c.x, z - c.z) > 1) this.rot = Math.atan2(x - c.x, z - c.z);
    this.dest = { x, z };
    this.attackMove = attackMove;
    this.assign();
    const lo = this.offsets[this.slotOf.get(this.leader)];
    const lp = this.world(lo, { x, z }, this.rot);
    this.leader.order = { type: 'move', x: lp.x, z: lp.z };
    this.leader.pathTo(lp.x, lp.z);
    this.moving = true;
    this.lastMove = this.game.time;
  }

  leaderOrigin() {
    const lo = this.offsets[this.slotOf.get(this.leader)] || { lx: 0, lz: 0 };
    const fx = Math.sin(this.rot), fz = Math.cos(this.rot), rx = -fz, rz = fx;
    return { x: this.leader.x - rx * lo.lx - fx * lo.lz, z: this.leader.z - rz * lo.lx - fz * lo.lz };
  }

  arrived() {
    this.moving = false;
    this.lastMove = this.game.time;
    this.origin = this.dest || this.leaderOrigin();
  }

  onMemberDeath(u) {
    this.units = this.units.filter(x => x !== u);
    this.slotOf?.delete(u);
    u.formation = null;
    if (this.units.length < 2 || this.units.length < this.initial * 0.4) {
      this.game.ui.toast(`La formation ${this.def.name} est brisée !`, 'warn');
      this.manager.dissolve(this);
      return;
    }
    if (u === this.leader) {
      const wasMoving = this.moving;
      this.origin = this.leaderOrigin();
      this.computeSlots();
      this.assign();
      if (wasMoving && this.dest) this.moveTo(this.dest.x, this.dest.z, this.attackMove);
    }
  }

  update() {
    if (this.moving) {
      this.origin = this.leaderOrigin();
      if (!this.leader.order) this.arrived();
    }
    for (const u of this.units) {
      const si = this.slotOf.get(u);
      u.slot = si === undefined ? null : this.world(this.offsets[si]);
    }
  }

  // bonus de vitesse de la colonne appliqué au leader également
  leaderSpeedMul() { return this.def.bonus.speed ? 1 + this.def.bonus.speed : 1; }
}
