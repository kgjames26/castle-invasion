import { Soldier } from './Soldier.js';

// Cavalier : premier impact après une course = charge (dégâts ×2 + recul)
export class Cavalry extends Soldier {
  constructor(game, x, z) {
    super(game, 'cavalry', x, z);
    this.run = 0;
  }
  update(dt) {
    super.update(dt);
    if (this.moving) this.run = Math.min(3, this.run + dt); else this.run = Math.max(0, this.run - dt * 0.5);
  }
  chargeMul() {
    let m = super.chargeMul();
    if (this.run > 1.2) {
      m *= 2;
      this.run = 0;
      this.charging = true;
    }
    return m;
  }
  attack(t) {
    this.charging = false;
    super.attack(t);
    if (this.charging && t.isUnit && t.alive && t.type !== 'golem' && t.type !== 'golem_ram') {
      const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz) || 1;
      t.x += dx / d * 1.6; t.z += dz / d * 1.6;
      this.game.fx.burst(t.x, 0.6, t.z, 6, 0xc8c0b0, 4, 0.6, 0.7);
    }
  }
}
