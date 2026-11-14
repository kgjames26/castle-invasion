import { angleLerp } from '../utils/MathUtils.js';
import { MAP } from '../data/Config.js';

let NEXT_ID = 1;
const UNIT_VIS = 1.3; // agrandissement visuel pour la lisibilité vue de haut
const _near = [];

// Classe de base de toutes les unités mobiles (joueur et zombies)
export class Unit {
  constructor(game) {
    this.game = game;
    this.isUnit = true;
  }

  init(type, def, team, x, z) {
    this.id = NEXT_ID++;
    this.type = type;
    this.def = def;
    this.team = team;
    this.x = x; this.z = z; this.y = 0;
    this.px = x; this.pz = z; this.py = 0;
    this.rot = team === 'enemy' ? 0 : Math.PI;
    this.prot = this.rot;
    this.maxHp = def.hp; this.hp = def.hp;
    this.speed = def.speed;
    this.radius = def.radius;
    this.alive = true;
    this.dying = 0;
    this.removed = false;
    this.path = null; this.pathI = 0;
    this.target = null;
    this.order = null;
    this.cd = Math.random() * 0.6;
    this.vx = 0; this.vz = 0;
    this.anim = Math.random() * 10;
    this.attackAnim = 0;
    this.flash = 0;
    this.retarget = Math.random() * 0.3;
    this.repath = 0;
    this.formation = null;
    this.slot = null;
    this.selected = false;
    this.lastHit = -99;
    this.ignoreGrid = false;
    const r = this.pickRender(type);
    this.render = r;
    this.inst = r ? r.alloc() : -1;
    this.inst2 = -1; this.inst3 = -1;
    return this;
  }

  pickRender(type) { return this.game.unitRender[type]; }

  get moving() { return this.vx * this.vx + this.vz * this.vz > 0.04; }

  savePrev() { this.px = this.x; this.pz = this.z; this.py = this.y; this.prot = this.rot; }

  // --- déplacement ---
  setPath(pts) { this.path = pts && pts.length ? pts : null; this.pathI = 0; }

  pathTo(x, z) {
    const p = this.game.pathfinding.findPath(this.x, this.z, x, z, this.team);
    this.setPath(p);
    return !!p;
  }

  followPath(dt, speedMul = 1) {
    if (!this.path) { this.vx = this.vz = 0; return true; }
    const wp = this.path[this.pathI];
    const last = this.pathI === this.path.length - 1;
    const d = Math.hypot(wp.x - this.x, wp.z - this.z);
    if (d < (last ? 0.35 : 0.9)) {
      this.pathI++;
      if (this.pathI >= this.path.length) { this.path = null; this.vx = this.vz = 0; return true; }
    }
    const w = this.path[this.pathI];
    this.steer(w.x, w.z, this.speed * speedMul);
    return false;
  }

  steer(tx, tz, speed) {
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { this.vx = this.vz = 0; return true; }
    const s = Math.min(speed, d * 8);
    this.vx = dx / d * s; this.vz = dz / d * s;
    return false;
  }

  stop() { this.vx = this.vz = 0; }

  face(tx, tz, dt, k = 10) {
    const a = Math.atan2(tx - this.x, tz - this.z);
    this.rot = angleLerp(this.rot, a, Math.min(1, dt * k));
  }

  integrate(dt) {
    if (!this.alive) return;
    let sx = 0, sz = 0;
    // séparation (évite que les unités se superposent)
    if (!this.ignoreGrid) {
      const g = this.game;
      const hash = this.team === 'enemy' ? g.enemyHash : g.allyHash;
      hash.query(this.x, this.z, this.radius + 1.4, _near);
      for (let i = 0; i < _near.length; i++) {
        const n = _near[i];
        if (n === this || !n.isUnit || n.ignoreGrid || n.y > 1) continue;
        const dx = this.x - n.x, dz = this.z - n.z;
        const d = Math.hypot(dx, dz) || 0.01, min = this.radius + n.radius;
        if (d < min) { const f = (min - d) / d; sx += dx * f; sz += dz * f; }
      }
      // contact avec l'autre camp (ne pas se traverser)
      const other = this.team === 'enemy' ? g.allyHash : g.enemyHash;
      other.query(this.x, this.z, this.radius + 1.4, _near);
      for (let i = 0; i < _near.length; i++) {
        const n = _near[i];
        if (!n.isUnit || n.ignoreGrid || n.y > 1) continue;
        const dx = this.x - n.x, dz = this.z - n.z;
        const d = Math.hypot(dx, dz) || 0.01, min = (this.radius + n.radius) * 0.9;
        if (d < min) { const f = (min - d) / d * 0.6; sx += dx * f; sz += dz * f; }
      }
    }
    const k = 6;
    const nx = this.x + (this.vx + sx * k) * dt;
    const nz = this.z + (this.vz + sz * k) * dt;
    if (this.ignoreGrid) { this.x = nx; this.z = nz; }
    else {
      const gr = this.game.grid;
      const here = gr.passableXZ(this.x, this.z, this.team);
      if (!here || gr.passableXZ(nx, this.z, this.team)) this.x = nx;
      if (!here || gr.passableXZ(this.x, nz, this.team)) this.z = nz;
      // ne jamais sortir de la carte
      this.x = Math.max(MAP.minX + 0.5, Math.min(MAP.maxX - 0.5, this.x));
      this.z = Math.max(MAP.minZ - 1, Math.min(MAP.maxZ - 0.5, this.z));
    }
    if (this.vx * this.vx + this.vz * this.vz > 0.05) {
      this.rot = angleLerp(this.rot, Math.atan2(this.vx, this.vz), Math.min(1, dt * 10));
    }
  }

  dist(o) { return Math.hypot(o.x - this.x, o.z - this.z); }
  edgeDist(o) {
    if (o.isCastle) return o.distTo(this.x, this.z) - this.radius;
    return Math.hypot(o.x - this.x, o.z - this.z) - this.radius - (o.radius || 0);
  }

  takeDamage(n, source) {
    if (!this.alive) return;
    this.hp -= n;
    this.flash = 0.12;
    this.lastHit = this.game.time;
    if (source && source.alive && !this.target && this.team === 'player' && !this.order) this.target = source;
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.hp = 0;
    this.dying = 1.1;
    this.vx = this.vz = 0;
    if (this.formation) this.formation.onMemberDeath(this);
    if (this.selected) this.game.selection.remove(this);
    this.game.onUnitDeath(this);
  }

  release() {
    this.removed = true;
    if (this.render && this.inst >= 0) this.render.release(this.inst);
    this.inst = -1;
    this.releaseExtras();
  }
  releaseExtras() {}
  drawExtras() {}

  // --- rendu (instancié, interpolé) ---
  draw(alpha, time) {
    if (this.inst < 0) return;
    const x = this.px + (this.x - this.px) * alpha;
    const z = this.pz + (this.z - this.pz) * alpha;
    let y = this.py + (this.y - this.py) * alpha;
    const rot = angleLerp(this.prot, this.rot, alpha);
    let tilt = 0, roll = 0, sc = (this.def.scale || 1) * UNIT_VIS;
    if (this.dying > 0) {
      const f = 1 - this.dying / 1.1;
      tilt = Math.min(1, f * 2.5) * 1.45;
      y -= Math.max(0, f - 0.5) * 1.6;
    } else {
      const mv = this.moving;
      if (mv) {
        this.anim += 0.016 * this.speed * 3.2;
        y += Math.abs(Math.sin(this.anim)) * 0.12;
        roll = Math.sin(this.anim) * 0.07;
      }
      if (this.attackAnim > 0 && !this.def.ranged) tilt = Math.sin(this.attackAnim * Math.PI) * 0.35;
      if (this.def.hunchAnim) tilt += 0.1 * Math.sin(time * 3 + this.id);
      if (this.bowTilt !== undefined) tilt = this.bowTilt;
    }
    this.dx = x; this.dy = y; this.dz = z; this.drot = rot; this.dsc = sc; this.dtilt = tilt;
    this.render.set(this.inst, x, y, z, rot, sc, tilt, roll);
    this.drawExtras();
    if (this.flash > 0) this.render.color(this.inst, 2.2, 0.6, 0.5);
    else if (this.selected) this.render.color(this.inst, 1.15, 1.15, 1.05);
    else this.render.color(this.inst, 1, 1, 1);
  }

  tickCommon(dt) {
    if (this.flash > 0) this.flash -= dt;
    if (this.attackAnim > 0) this.attackAnim = Math.max(0, this.attackAnim - dt * 3);
    if (this.cd > 0) this.cd -= dt;
  }
}
