import { Unit } from './Unit.js';
import { UNITS, HARVEST } from '../data/Config.js';

// Cultivateur : va au meilleur gisement, récolte, revient déposer. Fuit les zombies.
export class Cultivator extends Unit {
  constructor(game, x, z) {
    super(game);
    this.init('cultivator', UNITS.cultivator, 'player', x, z);
    this.state = 'idle';
    this.node = null;
    this.gatherType = null; // null = automatique
    this.carry = 0;
    this.carryType = null;
    this.think = 0;
    this.hpMul();
  }
  hpMul() { if (this.game.production?.hasTech('armor')) { this.maxHp = Math.round(this.def.hp * 1.2); this.hp = this.maxHp; } }

  assign(node) {
    if (this.node) this.node.harvesters--;
    this.node = node;
    if (node) {
      node.harvesters++;
      this.gatherType = node.type;
      if (this.carry > 0 && this.carryType !== node.type) this.goDrop();
      else { this.state = 'toNode'; this.pathTo(node.x, node.z); }
    }
  }

  setGatherType(t) { this.gatherType = t; this.assign(this.game.resources.bestNode(this, t)); }

  goDrop() {
    const d = this.game.resources.dropOff(this.x, this.z);
    this.drop = d;
    this.state = 'toDrop';
    this.pathTo(d.x, d.z);
  }

  orderMove(x, z) {
    // un déplacement manuel suspend la récolte
    if (this.node) { this.node.harvesters--; this.node = null; }
    this.state = 'manual';
    this.pathTo(x, z);
  }

  update(dt) {
    this.tickCommon(dt);
    const g = this.game;
    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.4;
      // fuite si un zombie approche
      const danger = g.combat.nearestEnemy(this.x, this.z, 9, false);
      if (danger && this.state !== 'flee') {
        this.prevState = this.state === 'manual' ? 'idle' : this.state;
        this.state = 'flee';
        const d = g.resources.safeDrop(this.x, this.z);
        this.pathTo(d.x, d.z);
        if (Math.random() < 0.3) g.ui.toast('Un cultivateur fuit les zombies !', 'warn', 'flee');
      } else if (this.state === 'flee' && !g.combat.nearestEnemy(this.x, this.z, 15, false)) {
        this.state = this.carry > 0 ? 'toDrop' : 'idle';
        if (this.state === 'toDrop') this.goDrop();
      }
    }
    switch (this.state) {
      case 'idle': {
        if (this.think > 0.35) {
          const n = g.resources.bestNode(this, this.gatherType);
          if (n) this.assign(n); else this.stop();
        } else this.stop();
        break;
      }
      case 'manual':
      case 'flee':
        if (this.followPath(dt, this.state === 'flee' ? 1.25 : 1)) { this.stop(); if (this.state === 'manual') this.state = 'idle'; }
        break;
      case 'toNode': {
        const n = this.node;
        if (!n || !n.alive) { this.assign(null); this.state = this.carry > 0 ? 'toDrop' : 'idle'; if (this.carry > 0) this.goDrop(); break; }
        if (Math.hypot(n.x - this.x, n.z - this.z) < n.radius + this.radius + 0.7) { this.state = 'harvest'; this.stop(); break; }
        if (this.followPath(dt)) { if (!this.pathTo(n.x, n.z)) { this.assign(null); this.state = 'idle'; } }
        break;
      }
      case 'harvest': {
        const n = this.node;
        if (!n || !n.alive) { if (this.carry > 0) this.goDrop(); else this.state = 'idle'; break; }
        this.face(n.x, n.z, dt);
        this.stop();
        const cap = g.resources.capacity();
        const rate = HARVEST[n.type].rate * g.resources.harvestMul(this.x, this.z);
        if (this.carryType !== n.type) { this.carry = 0; this.carryType = n.type; }
        const got = n.take(Math.min(rate * dt, cap - this.carry));
        this.carry += got;
        this.anim += dt * 6;
        if (Math.sin(this.anim * 1.6) > 0.95 && this.attackAnim <= 0) {
          this.attackAnim = 0.9;
          if (Math.random() < 0.5) g.fx.burst(n.x, 0.8, n.z, 2, n.type === 'wood' ? 0x7a5a30 : 0x9a9a9a, 2, 0.4, 0.6);
        }
        if (this.carry >= cap - 0.01 || !n.alive) this.goDrop();
        break;
      }
      case 'toDrop': {
        const d = this.drop || g.resources.dropOff(this.x, this.z);
        if (Math.hypot(d.x - this.x, d.z - this.z) < 2.4 || this.followPath(dt)) {
          if (Math.hypot(d.x - this.x, d.z - this.z) < 3.5) {
            if (this.carry > 0) g.resources.add(this.carryType, Math.round(this.carry * 10) / 10, this);
            this.carry = 0;
            if (this.node && this.node.alive) { this.state = 'toNode'; this.pathTo(this.node.x, this.node.z); }
            else { this.assign(null); this.state = 'idle'; }
          } else this.goDrop();
        }
        break;
      }
    }
  }
}
