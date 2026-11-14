import { Unit } from './Unit.js';
import { ENEMIES, MAP, sizeStats } from '../data/Config.js';
import { angleLerp } from '../utils/MathUtils.js';

const JUMP_TIME = 1.5;
const UNIT_VIS = 1.3;

// Zombies : suivent le flow field vers le château, attaquent muraille, troupes, armes et bâtiments.
// Types : classique, rapide, chien, golem, sauteur + variantes de siège (golem bélier, lanceur).
export class Enemy extends Unit {
  // modèle animé : variante choisie au hasard parmi celles du type
  pickRender(type) {
    const def = ENEMIES[type];
    this.variant = def.variants[(Math.random() * def.variants.length) | 0];
    return this.game.unitRender['z' + this.variant];
  }

  reset(type, x, z, scaling) {
    const def = ENEMIES[type];
    this.sizeJ = 0.86 + Math.random() * 0.28;   // chaque zombie a sa propre taille
    this.init(type, def, 'enemy', x, z);
    const st = sizeStats(def, this.sizeJ);
    this.size = def.size * this.sizeJ;
    this.maxHp = Math.round(def.hp * st.hp * scaling.hp);
    this.hp = this.maxHp;
    this.dmg = def.dmg * st.dmg * scaling.dmg;
    this.speed = def.speed * st.speed * (0.96 + Math.random() * 0.08);
    this.radius = def.radius * st.radius;
    this.cdBase = def.cd * st.cd;
    this.goldMul = st.gold;
    this.phase = Math.random();
    this.lastDrawT = 0;
    this.deathFrame = 0;
    this.wallTarget = -1;
    this.jump = null;
    this.think = Math.random() * 0.4;
    this.stuck = 0;
    this.lastX = x; this.lastZ = z;
    this.ignoreGrid = false;
    return this;
  }

  update(dt) {
    this.tickCommon(dt);
    const g = this.game;
    if (this.jump) return this.updateJump(dt);
    this.think -= dt;

    // cible vivante proche (troupes, armes, centres)
    if (this.think <= 0) {
      this.think = 0.35 + Math.random() * 0.15;
      this.target = this.def.aggro > 0 ? g.combat.findAllyFor(this, this.def.aggro) : null;
      // anti-blocage : si immobile trop longtemps, petit écart latéral
      const moved = Math.hypot(this.x - this.lastX, this.z - this.lastZ);
      this.stuck = moved < 0.1 && this.wallTarget < 0 && !this.target ? this.stuck + 1 : 0;
      this.lastX = this.x; this.lastZ = this.z;
    }
    const t = this.target;
    if (t && t.alive) {
      const d = this.edgeDist(t);
      if (d <= this.def.range) {
        this.stop();
        this.face(t.x, t.z, dt);
        if (this.cd <= 0) this.strike(t);
        return;
      }
      if (!this.def.ranged || d > this.def.range) {
        this.steer(t.x, t.z, this.speed);
        if (!g.grid.passableXZ(this.x + this.vx * 0.3, this.z + this.vz * 0.3, 'enemy')) { this.target = null; }
        else return;
      }
    }

    // lanceur : vise la muraille à distance
    if (this.def.ranged && this.z < -MAP.WALL_HALF_THICK - 1) {
      const dz = -MAP.WALL_HALF_THICK - this.z;
      if (dz < this.def.range * 0.9) {
        const seg = g.wall.segments[g.wall.segAt(this.x)];
        if (!seg.broken) {
          this.stop(); this.face(this.x, 0, dt);
          if (this.cd <= 0) { this.cd = this.cdBase; this.attackAnim = 1; g.combat.throwRock(this, seg.x + (Math.random() - 0.5) * 6, 3, MAP.WALL_Z - 1, { seg: seg.index }); }
          return;
        }
      }
    }

    // château à portée ?
    if (g.castle.distTo(this.x, this.z) < this.radius + this.def.range + 0.6) {
      this.stop();
      const p = g.castle.nearestPoint(this.x, this.z);
      this.face(p.x, p.z, dt);
      if (this.cd <= 0) { this.cd = this.cdBase; this.attackAnim = 1; g.combat.hitStructure(this, g.castle, this.dmg * (this.def.wallMul > 2 ? 2.5 : 1)); }
      return;
    }

    // suivre le flow field
    const step = g.pathfinding.flowStep(this.x, this.z);
    if (!step) { this.stop(); return; }
    let dx = step.x - this.x, dz = step.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    if (this.stuck > 3) { const s = (this.id % 2 ? 1 : -1); dx += -dz * s * 0.8; dz += dx * s * 0.8; }
    // muraille devant ?
    const probe = this.radius + 0.55;
    const seg = g.grid.isWallCellXZ(this.x + dx * probe, this.z + dz * probe);
    if (seg >= 0 && !g.wall.segments[seg].broken) {
      this.wallTarget = seg;
      if (this.def.jumps) return this.startJump(seg);
      this.stop();
      this.face(this.x + dx, this.z + dz, dt);
      if (this.cd <= 0) {
        this.cd = this.cdBase;
        this.attackAnim = 1;
        g.wall.damage(seg, this.dmg * this.def.wallMul);
        if (this.type === 'golem_ram') { g.camShake = Math.max(g.camShake, 0.25); g.fx.burst(this.x + dx * 2, 1.5, this.z + dz * 2, 8, 0xb8b0a4, 5, 0.8, 1); }
      }
      return;
    }
    this.wallTarget = -1;
    this.vx = dx * this.speed; this.vz = dz * this.speed;
  }

  strike(t) {
    const g = this.game;
    this.cd = this.cdBase * (0.9 + Math.random() * 0.2);
    this.attackAnim = 1;
    if (this.def.ranged) g.combat.throwRock(this, t.x, t.y || 0.5, t.z, { target: t });
    else if (t.isStructure || t.isSiege) g.combat.hitStructure(this, t, this.dmg * (this.def.wallMul > 2 ? 2 : 1));
    else g.combat.applyDamage(t, this.dmg, { source: this, melee: true });
  }

  startJump(seg) {
    const g = this.game;
    this.jump = { t: 0, x0: this.x, z0: this.z, x1: this.x + (Math.random() - 0.5) * 2, z1: MAP.WALL_HALF_THICK + 1.4 };
    if (this.z > 0) this.jump.z1 = -MAP.WALL_HALF_THICK - 1.4;
    this.ignoreGrid = true;
    g.wall.damage(seg, 25 * this.def.wallMul);
    g.fx.burst(this.x, 0.3, this.z, 6, 0x6a6058, 3, 0.6, 0.7);
  }

  updateJump(dt) {
    const j = this.jump;
    j.t += dt / JUMP_TIME;
    const t = Math.min(1, j.t);
    this.x = j.x0 + (j.x1 - j.x0) * t;
    this.z = j.z0 + (j.z1 - j.z0) * t;
    this.y = Math.sin(t * Math.PI) * 6.5;
    this.vx = (j.x1 - j.x0) / JUMP_TIME; this.vz = (j.z1 - j.z0) / JUMP_TIME;
    this.rot = Math.atan2(this.vx, this.vz);
    if (t >= 1) {
      this.jump = null; this.y = 0; this.ignoreGrid = false; this.vx = this.vz = 0;
      this.game.fx.burst(this.x, 0.2, this.z, 6, 0xd0d8e0, 3, 0.6, 0.7);
    }
  }

  // --- rendu : zombie animé par texture de sommets ---
  draw(alpha, time) {
    if (this.inst < 0) return;
    const x = this.px + (this.x - this.px) * alpha;
    const z = this.pz + (this.z - this.pz) * alpha;
    let y = this.py + (this.y - this.py) * alpha;
    const rot = angleLerp(this.prot, this.rot, alpha);
    const v = this.game.sm.zombies.variants[this.variant];
    const dt = this.lastDrawT ? Math.min(0.1, time - this.lastDrawT) : 0;
    this.lastDrawT = time;
    let tilt = 0;
    const sc = this.size * UNIT_VIS;
    if (this.dying > 0) {
      const f = 1 - this.dying / 1.1;
      tilt = Math.min(1, f * 2.5) * 1.45;
      y -= Math.max(0, f - 0.5) * 1.6 * this.size;
    } else if (!this.game.paused && dt > 0) {
      const stride = 2.6 * sc;
      let cps = this.moving ? Math.max(0.3, Math.min(1.7, Math.hypot(this.vx, this.vz) / stride)) : 0.2;
      if (this.attackAnim > 0) { cps = 1.3; tilt = Math.sin(this.attackAnim * Math.PI) * 0.3; }
      this.phase = (this.phase + dt * cps) % 1;
    }
    if (this.dying > 0) this.render.setAnim(this.inst, this.deathFrame);
    else { this.deathFrame = this.phase * v.F; this.render.setAnim(this.inst, this.deathFrame); }
    this.render.set(this.inst, x, y, z, rot, sc, tilt, 0);
    if (this.flash > 0) this.render.color(this.inst, 2.2, 0.6, 0.5);
    else this.render.color(this.inst, 1, 1, 1);
    if (this.def.ram) this.drawLog(x, y, z, rot, sc, tilt);
  }

  drawLog(x, y, z, rot, sc, tilt) {
    const R = this.game.unitRender.ramlog;
    if (this.inst2 < 0) this.inst2 = R.alloc();
    if (this.inst2 < 0) return;
    // le tronc avance et recule pendant l'assaut
    const swing = this.attackAnim > 0 ? Math.sin(this.attackAnim * Math.PI) * 0.35 * sc : 0;
    const sy = Math.sin(rot), cy = Math.cos(rot);
    R.set(this.inst2, x + sy * swing, y, z + cy * swing, rot, sc, tilt, 0);
  }

  releaseExtras() {
    if (this.inst2 >= 0) { this.game.unitRender.ramlog.release(this.inst2); this.inst2 = -1; }
  }
}
