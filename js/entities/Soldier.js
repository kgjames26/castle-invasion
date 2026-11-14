import { Unit } from './Unit.js';
import { UNITS, MAP } from '../data/Config.js';

// Soldat (épée) et Archer (arc). Gère ordres, engagement automatique, formations et muraille.
export class Soldier extends Unit {
  constructor(game, type, x, z) {
    super(game);
    this.init(type, UNITS[type], 'player', x, z);
    this.anchor = { x, z };
    this.onWall = null;
    this.applyTechs();
  }

  applyTechs() {
    const p = this.game.production;
    const mul = p?.hasTech('armor') ? 1.2 : 1;
    const f = this.hp / this.maxHp;
    this.maxHp = Math.round(this.def.hp * mul);
    this.hp = Math.max(1, Math.round(this.maxHp * f));
  }

  get range() {
    let r = this.def.range;
    if (this.def.ranged) {
      if (this.game.production.hasTech('longbow')) r *= 1.2;
      if (this.onWall) r *= 1.3;
    }
    return r;
  }

  orderMove(x, z, attackMove = false) {
    this.leaveWall();
    this.target = null;
    // archer envoyé sur la muraille : il grimpe sur le chemin de ronde
    const seg = this.game.grid.isWallCellXZ(x, z);
    if (this.def.ranged && seg >= 0 && !this.game.wall.segments[seg].broken && !this.game.wall.segments[seg].gate) {
      this.order = { type: 'climb', seg, x, z: MAP.WALL_Z };
      this.pathTo(x, MAP.WALL_HALF_THICK + 1.2);
      return;
    }
    this.order = { type: attackMove ? 'attackMove' : 'move', x, z };
    this.pathTo(x, z);
  }

  orderAttack(t) {
    this.leaveWall();
    this.order = { type: 'attack', target: t };
    this.target = t;
    this.repath = 0;
  }

  orderStop() { this.order = null; this.target = null; this.path = null; this.anchor = { x: this.x, z: this.z }; }

  leaveWall() {
    if (!this.onWall) return;
    this.game.wall.segments[this.onWall.seg]?.archers.delete(this);
    this.onWall = null;
    this.ignoreGrid = false;
    this.y = 0;
    this.z = MAP.WALL_HALF_THICK + 0.9;
  }

  fallFromWall() {
    if (!this.onWall) return;
    this.onWall = null;
    this.ignoreGrid = false;
    this.y = 0;
    this.z = MAP.WALL_HALF_THICK + 1.0;
    this.takeDamage(this.maxHp * 0.4);
    this.anchor = { x: this.x, z: this.z };
  }

  update(dt) {
    this.tickCommon(dt);
    const g = this.game;
    this.retarget -= dt;
    this.repath -= dt;
    const o = this.order;

    if (this.onWall) {
      this.stop();
      this.y = MAP.WALL_HEIGHT;
      this.acquireAndShoot(dt, this.range + 1);
      return;
    }
    if (o && o.type === 'climb') {
      if (this.followPath(dt)) {
        const s = g.wall.segments[o.seg];
        if (s.broken) { this.order = null; return; }
        this.onWall = { seg: o.seg };
        s.archers.add(this);
        this.ignoreGrid = true;
        this.x = Math.max(s.x - 3.6, Math.min(s.x + 3.6, o.x));
        this.z = MAP.WALL_Z + 0.4;
        this.y = MAP.WALL_HEIGHT;
        this.rot = Math.PI;
        this.order = null;
        this.anchor = { x: this.x, z: this.z };
      }
      return;
    }
    if (o && o.type === 'attack') {
      if (!o.target.alive) { this.order = null; this.target = null; this.anchor = { x: this.x, z: this.z }; return; }
      this.engage(o.target, dt);
      return;
    }
    if (o && o.type === 'move') {
      // en marche : riposte seulement si un ennemi est collé
      if (this.followPath(dt, this.formationSpeed())) { this.order = null; this.anchor = { x: this.x, z: this.z }; if (this.formation && this.formation.leader === this) this.formation.arrived(); }
      return;
    }
    // formation : suivre son slot
    const f = this.formation;
    if (f && f.leader !== this) {
      const s = this.slot;
      if (s) {
        const dslot = Math.hypot(s.x - this.x, s.z - this.z);
        const t = this.findTarget(f.moving ? 3 : this.def.aggro);
        if (t && Math.hypot(t.x - s.x, t.z - s.z) < (f.moving ? 5 : this.def.aggro + 4)) { this.engage(t, dt); return; }
        if (dslot > 0.4) {
          if (dslot > 7 && this.repath <= 0) { this.repath = 1; this.pathTo(s.x, s.z); }
          if (this.path && dslot > 4) this.followPath(dt, this.formationSpeed() * 1.15);
          else this.steer(s.x, s.z, this.speed * this.formationSpeed() * (dslot > 2 ? 1.2 : 0.8));
        } else { this.stop(); this.face(this.x + Math.sin(f.rot), this.z + Math.cos(f.rot), dt, 4); }
        return;
      }
    }
    // inactif / attaque-déplacement : engagement automatique
    const t = this.findTarget(this.def.aggro);
    const leash = o && o.type === 'attackMove' ? 999 : 14;
    if (t && Math.hypot(t.x - this.anchor.x, t.z - this.anchor.z) < leash + this.def.aggro) { this.engage(t, dt); return; }
    this.target = null;
    if (o && o.type === 'attackMove') {
      if (!this.path && this.repath <= 0) { this.repath = 1; this.pathTo(o.x, o.z); }
      if (this.followPath(dt)) { this.order = null; this.anchor = { x: this.x, z: this.z }; }
      return;
    }
    // retour au point d'ancrage
    const da = Math.hypot(this.anchor.x - this.x, this.anchor.z - this.z);
    if (da > 1.2) {
      if (!this.path && this.repath <= 0) { this.repath = 1.5; this.pathTo(this.anchor.x, this.anchor.z); }
      if (this.followPath(dt)) this.stop();
    } else this.stop();
  }

  formationSpeed() {
    const f = this.formation;
    if (!f) return 1;
    return (f.speed / this.speed) * (f.def.bonus.speed ? 1 + f.def.bonus.speed : 1);
  }

  findTarget(radius) {
    if (this.retarget <= 0 || (this.target && !this.target.alive)) {
      this.retarget = 0.35;
      this.target = this.game.combat.findEnemyFor(this, radius);
    }
    return this.target && this.target.alive ? this.target : null;
  }

  acquireAndShoot(dt, radius) {
    const t = this.findTarget(radius);
    if (!t) return;
    this.face(t.x, t.z, dt);
    if (this.cd <= 0 && this.edgeDist(t) <= this.range) this.attack(t);
  }

  engage(t, dt) {
    this.target = t;
    const d = this.edgeDist(t);
    const r = this.range;
    if (d <= r) {
      this.stop();
      this.path = null;
      this.face(t.x, t.z, dt);
      if (this.cd <= 0) this.attack(t);
    } else {
      // poursuite : ligne droite si possible, sinon chemin
      const g = this.game;
      if (this.repath <= 0) {
        this.repath = 0.6;
        if (g.pathfinding.lineOfSight(this.x, this.z, t.x, t.z, 'player')) this.path = null;
        else this.pathTo(t.x, t.z);
      }
      if (this.path) this.followPath(dt, this.formation ? this.formationSpeed() : 1);
      else this.steer(t.x, t.z, this.speed);
    }
  }

  // --- rendu de l'archer : modèle animé (corps + arc + flèche encochée) ---
  releaseExtras() {
    const r = this.game.unitRender;
    if (this.inst2 >= 0) { r.archerBow.release(this.inst2); this.inst2 = -1; }
    if (this.inst3 >= 0) { r.archerArrow.release(this.inst3); this.inst3 = -1; }
  }

  draw(alpha, time) {
    if (this.def.ranged && this.alive) {
      // phase de tension : l'archer encoche et bande l'arc pendant les 0,45 s avant le tir
      const aiming = this.target && this.target.alive && !this.moving && this.cd > 0 && this.cd < 0.45;
      this.aim = aiming ? 1 - this.cd / 0.45 : Math.max(0, (this.aim || 0) - 0.12);
      this.bowTilt = -0.15 * this.aim + 0.11 * this.attackAnim;
    }
    super.draw(alpha, time);
  }

  drawExtras() {
    if (!this.def.ranged) return;
    const g = this.game, R = g.unitRender;
    if (this.inst2 < 0) this.inst2 = R.archerBow.alloc();
    if (this.inst3 < 0) this.inst3 = R.archerArrow.alloc();
    if (this.inst2 < 0 || this.inst3 < 0) return;
    const rec = this.dying > 0 ? 0 : this.attackAnim * 0.14 * this.dsc;
    const sy = Math.sin(this.drot), cy = Math.cos(this.drot);
    // l'arc recule légèrement au lâcher (axe de tir = local +z)
    R.archerBow.set(this.inst2, this.dx - sy * rec, this.dy, this.dz - cy * rec, this.drot, this.dsc, this.dtilt, 0);
    if (this.dying > 0 || (this.aim || 0) < 0.05) { R.archerArrow.hide(this.inst3); return; }
    // flèche encochée, tirée en arrière avec la corde
    const pull = (1 - this.aim) * 0.35;
    const h = 1.39 * this.dsc, zf = (0.27 - pull * 0.5) * this.dsc;
    const ct = Math.cos(this.dtilt), st = Math.sin(this.dtilt);
    const vy = h * ct - zf * st, vz = h * st + zf * ct;
    R.archerArrow.set(this.inst3, this.dx + vz * sy, this.dy + vy, this.dz + vz * cy, this.drot, this.dsc * 1.25, this.dtilt, 0);
  }

  attack(t) {
    const g = this.game;
    this.cd = this.def.cd * (0.9 + Math.random() * 0.2);
    this.attackAnim = 1;
    if (this.def.ranged) g.combat.fireArrow(this, t);
    else g.combat.melee(this, t, this.chargeMul());
  }

  chargeMul() {
    const f = this.formation;
    if (f && f.def.bonus.charge && (f.moving || this.game.time - f.lastMove < 2.5)) return 1 + f.def.bonus.charge;
    return 1;
  }
}
