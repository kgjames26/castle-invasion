import * as THREE from 'three';
import { SIEGE } from '../data/Config.js';
import { buildSiege } from '../world/Models.js';
import { angleLerp } from '../utils/MathUtils.js';

let SIEGE_ID = 1;

// Arme de siège déployée : baliste, catapulte, trébuchet (fixes) ou bélier (mobile)
export class SiegeWeapon {
  constructor(game, type, x, z, hp) {
    this.game = game;
    this.id = 's' + SIEGE_ID++;
    this.type = type;
    this.def = SIEGE[type];
    this.team = 'player';
    this.isSiege = true;
    this.x = x; this.z = z; this.y = 0;
    this.px = x; this.pz = z;
    this.radius = type === 'trebuchet' ? 2.4 : type === 'ballista' ? 1.3 : 1.8;
    this.maxHp = this.def.hp;
    this.hp = hp ?? this.def.hp;
    this.alive = true;
    this.rot = Math.PI; // vers le nord
    this.prot = this.rot;
    this.reload = 1;
    this.ammoMode = 'stone';
    this.target = null;
    this.think = 0;
    this.armT = 1;
    this.flash = 0;
    this.noAmmo = false;
    this.order = null;
    this.path = null; this.pathI = 0;
    this.selected = false;
    this.group = buildSiege(type, game.sm.mat.units);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = this.rot;
    this.arm = this.group.getObjectByName('arm');
    game.sm.scene.add(this.group);
  }

  get speed() { return this.def.speed; }

  orderMove(x, z) {
    if (!this.def.mobile) return;
    this.order = { type: 'move', x, z };
    this.path = this.game.pathfinding.findPath(this.x, this.z, x, z, 'player');
    this.pathI = 0;
  }
  orderAttack(t) {
    if (!this.def.mobile) { this.target = t; return; }
    this.order = { type: 'attack', target: t };
    this.path = this.game.pathfinding.findPath(this.x, this.z, t.x, t.z, 'player');
    this.pathI = 0;
  }
  orderStop() { this.order = null; this.path = null; }

  reloadTime() { return this.def.reload * (this.game.production.hasTech('mechanics') ? 0.75 : 1); }
  ammoCost() {
    if (!this.def.ammo) return null;
    if (this.ammoMode === 'metal' && this.def.ammoAlt && this.game.production.hasTech('metalAmmo')) return this.def.ammoAlt;
    return this.def.ammo;
  }

  update(dt) {
    this.px = this.x; this.pz = this.z; this.prot = this.rot;
    if (this.flash > 0) this.flash -= dt;
    const g = this.game;
    if (this.def.mobile) return this.updateRam(dt);
    this.reload -= dt;
    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.4;
      if (!this.target || !this.target.alive || !this.inRange(this.target)) this.target = g.siege.chooseTarget(this);
    }
    const t = this.target;
    if (this.arm) this.animateArm(dt);
    if (!t) return;
    const a = Math.atan2(t.x - this.x, t.z - this.z);
    this.rot = angleLerp(this.rot, a, Math.min(1, dt * 2.5));
    let da = Math.abs(((a - this.rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (this.reload <= 0 && da < 0.12) {
      const cost = this.ammoCost();
      if (cost && !g.resources.canAfford(cost)) { this.noAmmo = true; this.reload = 1; return; }
      this.noAmmo = false;
      if (cost) g.resources.spend(cost);
      g.siege.fire(this, t, this.ammoMode === 'metal' && cost === this.def.ammoAlt);
      this.reload = this.reloadTime();
      this.armT = 0;
    }
  }

  inRange(t) {
    const d = Math.hypot(t.x - this.x, t.z - this.z);
    return d <= this.def.range && d >= this.def.minRange;
  }

  animateArm(dt) {
    this.armT = Math.min(1, this.armT + dt / (this.reloadTime() * 0.8));
    const fire = Math.min(1, this.armT * 6);
    if (this.type === 'catapult') this.arm.rotation.x = this.armT < 0.17 ? -0.15 - 1.5 * Math.sin(fire * Math.PI / 2) : -1.65 + 1.5 * Math.min(1, (this.armT - 0.17) / 0.83);
    if (this.type === 'trebuchet') this.arm.rotation.x = this.armT < 0.17 ? 0.7 - 2.6 * Math.sin(fire * Math.PI / 2) : -1.9 + 2.6 * Math.min(1, (this.armT - 0.17) / 0.83);
  }

  updateRam(dt) {
    const g = this.game;
    this.reload -= dt;
    this.think -= dt;
    let t = this.order?.type === 'attack' ? this.order.target : null;
    if (t && !t.alive) { this.order = null; t = null; }
    if (!t && this.think <= 0) {
      this.think = 0.5;
      // frappe automatiquement un nid ou un ennemi collé
      const nest = g.waves.nests.find(n => n.alive && Math.hypot(n.x - this.x, n.z - this.z) < n.radius + 4);
      t = nest || g.combat.nearestEnemy(this.x, this.z, this.radius + 1.6, true);
      this.autoTarget = t;
    } else if (!t) t = this.autoTarget && this.autoTarget.alive ? this.autoTarget : null;
    let moveTo = null;
    if (t) {
      const d = Math.hypot(t.x - this.x, t.z - this.z) - this.radius - (t.radius || 0.5);
      if (d <= this.def.range) {
        const a = Math.atan2(t.x - this.x, t.z - this.z);
        this.rot = angleLerp(this.rot, a, Math.min(1, dt * 2));
        if (this.reload <= 0) {
          this.reload = this.reloadTime();
          this.armT = 0;
          const dmg = t.isNest ? this.def.dmg : this.def.dmg * 0.3;
          if (t.isStructure) t.takeDamage(dmg); else g.combat.applyDamage(t, dmg, { source: this, siege: true });
          g.fx.burst(t.x, 1.2, t.z, 10, t.isNest ? 0x4a2a4a : 0x8a7a6a, 6, 0.8, 1);
          g.camShake = Math.max(g.camShake, 0.15);
        }
      } else if (this.order?.type === 'attack') moveTo = this.path ? null : t;
    }
    // animation du bélier
    if (this.arm) { this.armT = Math.min(1, this.armT + dt * 2); this.arm.position.z = Math.sin(Math.min(1, this.armT * 2) * Math.PI) * 1.2; }
    if (this.path) {
      const wp = this.path[this.pathI];
      const dx = wp.x - this.x, dz = wp.z - this.z, d = Math.hypot(dx, dz);
      if (d < 0.8) { this.pathI++; if (this.pathI >= this.path.length) { this.path = null; if (this.order?.type === 'move') this.order = null; } }
      else {
        const s = this.def.speed;
        this.x += dx / d * s * dt; this.z += dz / d * s * dt;
        this.rot = angleLerp(this.rot, Math.atan2(dx, dz), Math.min(1, dt * 3));
      }
    } else if (moveTo) {
      this.path = g.pathfinding.findPath(this.x, this.z, moveTo.x, moveTo.z, 'player'); this.pathI = 0;
    }
  }

  draw(alpha) {
    const x = this.px + (this.x - this.px) * alpha, z = this.pz + (this.z - this.pz) * alpha;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = angleLerp(this.prot, this.rot, alpha);
  }

  takeDamage(n) {
    if (!this.alive) return;
    this.hp -= n;
    this.flash = 0.15;
    if (this.hp <= 0) this.destroy();
  }

  destroy() {
    const g = this.game;
    this.alive = false;
    this.hp = 0;
    g.sm.scene.remove(this.group);
    g.fx.burst(this.x, 1.5, this.z, 26, 0x7a5530, 7, 1.3, 1.2);
    g.fx.smoke(this.x, 1.5, this.z, 6);
    g.ui.toast(`${this.def.name} détruit${this.type === 'catapult' || this.type === 'ballista' ? 'e' : ''} !`, 'danger');
    if (this.selected) g.selection.remove(this);
  }
}

export const SIEGE_TYPES = Object.keys(SIEGE);
export { THREE };
