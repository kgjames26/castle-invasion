import * as THREE from 'three';
import { MAP, WALL_HP, GATE_HP, WALL_REGEN_PER_WORKER } from '../data/Config.js';

// Muraille segmentée : 15 segments de 8 m, porte au centre, tours décoratives
export class Wall {
  constructor(game) {
    this.game = game;
    this.segments = [];
    this.towers = [];
  }

  build() {
    const { sm, grid } = this.game;
    const R = -Math.PI / 2; // escaliers côté sud (intérieur)
    for (let s = 0; s < MAP.SEG_COUNT; s++) {
      const x = -MAP.HALF + MAP.SEG_LEN * (s + 0.5);
      const gate = s === MAP.GATE_SEG;
      const name = gate ? 'wall_gate' : (s % 4 === 1 ? 'wall_stairs' : 'wall');
      const mesh = sm.model(name, { x, z: MAP.WALL_Z, rotY: R, shadow: true, receive: true });
      const rubble = new THREE.Mesh(sm.resGeo.rubble, sm.mat.units);
      rubble.position.set(x, 0, MAP.WALL_Z);
      rubble.castShadow = true;
      rubble.visible = false;
      sm.scene.add(rubble);
      const seg = { index: s, x, gate, maxHp: gate ? GATE_HP : WALL_HP, hp: 0, broken: false, mesh, rubble, flash: 0, archers: new Set() };
      seg.hp = seg.maxHp;
      this.segments.push(seg);
    }
    // tours
    const towerX = [-60, -52, -36, -20, -4, 4, 20, 36, 52, 60];
    for (const x of towerX) {
      const big = Math.abs(x) === 4;
      const name = big ? 'tower2' : Math.abs(x) === 60 ? 'tower3' : 'tower1';
      const t = sm.model(name, { x: x === 60 ? 58.6 : x === -60 ? -58.6 : x, z: MAP.WALL_Z, scale: big ? 1.05 : 0.95, shadow: true, receive: true });
      this.towers.push(t);
      grid.markCircle(x, MAP.WALL_Z, 2.3, k => { grid.blocked[k] = 1; });
    }
    // neige au pied de la muraille (décor)
    for (let i = 0; i < 9; i++) {
      const x = -54 + i * 13.5 + (i % 2) * 3;
      if (Math.abs(x) < 7) continue;
      sm.model(['snow1', 'snow2', 'snow3'][i % 3], { x, z: -3.2, rotY: -Math.PI / 2, scale: 1.2, lod: true });
    }
    // cellules de muraille
    grid.wallState = s => this.segments[s];
    for (let j = 0; j < grid.n; j++) {
      const z = grid.cz(j);
      if (Math.abs(z - MAP.WALL_Z) > MAP.WALL_HALF_THICK + 0.3) continue;
      for (let i = 0; i < grid.n; i++) {
        const k = grid.idx(i, j);
        if (grid.blocked[k]) continue;
        const s = Math.floor((grid.cx(i) + MAP.HALF) / MAP.SEG_LEN);
        grid.wallSeg[k] = Math.max(0, Math.min(MAP.SEG_COUNT - 1, s));
      }
    }
    // torches à la porte et sur le chemin de ronde
    sm.addTorch(-5.5, 7.5, -2.8, 16, 20);
    sm.addTorch(5.5, 7.5, -2.8, 16, 20);
    for (const x of [-44, -28, 28, 44]) sm.addTorch(x, 5.0, -2.4, 0, 0, false);
    this.applyTechs();
  }

  applyTechs() {
    const mul = this.game.production?.hasTech('masonry') ? 1.35 : 1;
    for (const s of this.segments) {
      const base = s.gate ? GATE_HP : WALL_HP;
      const nm = Math.round(base * mul);
      if (nm !== s.maxHp) { const f = s.hp / s.maxHp; s.maxHp = nm; s.hp = Math.round(nm * f); }
    }
  }

  segAt(x) { return Math.max(0, Math.min(MAP.SEG_COUNT - 1, Math.floor((x + MAP.HALF) / MAP.SEG_LEN))); }

  damage(index, amount) {
    const s = this.segments[index];
    if (!s || s.broken) return;
    s.hp -= amount;
    s.flash = 0.15;
    this.game.stats.wallDamage += amount;
    if (Math.random() < 0.3) this.game.fx.burst(s.x + (Math.random() - 0.5) * 7, 2 + Math.random() * 2, MAP.WALL_Z - 2.2, 3, 0xb8b0a4, 3, 0.7, 0.8);
    if (s.hp <= 0) this.breakSeg(s);
    else this.updateVisual(s);
  }

  breakSeg(s) {
    s.hp = 0;
    s.broken = true;
    s.mesh.visible = false;
    s.rubble.visible = true;
    const fx = this.game.fx;
    for (let i = 0; i < 6; i++) fx.burst(s.x + (Math.random() - 0.5) * 8, 1 + Math.random() * 3, MAP.WALL_Z + (Math.random() - 0.5) * 3, 8, 0xc8c0b4, 7, 1.4, 1.4);
    fx.smoke(s.x, 2, MAP.WALL_Z, 12);
    this.game.audio?.boom();
    for (const a of s.archers) a.fallFromWall();
    s.archers.clear();
    this.game.pathfinding.invalidate();
    this.game.ui.toast(s.gate ? '⚠️ La porte est enfoncée !' : '⚠️ Muraille percée !', 'danger');
    this.game.camShake = 0.6;
  }

  updateVisual(s) {
    const f = s.hp / s.maxHp;
    s.mesh.material = f < 0.45 ? this.game.sm.mat.medievalDamaged : this.game.sm.mat.medieval;
    const sy = f < 0.25 ? 0.82 : 1;
    if (s.mesh.scale.y !== sy) { s.mesh.scale.y = sy; s.mesh.updateMatrix(); }
  }

  repairCost(s) {
    if (s.broken) return { stone: Math.round(s.maxHp * 0.16), wood: 60 };
    return { stone: Math.ceil((s.maxHp - s.hp) / 7) };
  }

  repair(s) {
    const g = this.game;
    if (!s.broken && s.hp >= s.maxHp) return false;
    if (s.broken) {
      // impossible de reconstruire avec des créatures dans la brèche
      const near = g.enemies.some(e => e.alive && Math.abs(e.x - s.x) < 5 && Math.abs(e.z - MAP.WALL_Z) < 4);
      const own = g.units.some(u => u.alive && Math.abs(u.x - s.x) < 4.5 && Math.abs(u.z - MAP.WALL_Z) < 2.6);
      if (near || own) { g.ui.toast('La brèche doit être dégagée pour reconstruire', 'warn'); return false; }
    }
    const cost = this.repairCost(s);
    if (!g.resources.canAfford(cost)) { g.ui.toast('Ressources insuffisantes', 'warn'); return false; }
    g.resources.spend(cost);
    if (s.broken) {
      s.broken = false; s.hp = Math.round(s.maxHp * 0.5);
      s.mesh.visible = true; s.rubble.visible = false;
      g.pathfinding.invalidate();
    } else s.hp = s.maxHp;
    this.updateVisual(s);
    g.fx.burst(s.x, 4.5, MAP.WALL_Z, 14, 0xe0d8c8, 4, 0.8, 0.9);
    g.ui.toast(s.gate ? 'Porte réparée' : 'Segment réparé', 'ok');
    return true;
  }

  totalFraction() {
    let a = 0, b = 0;
    for (const s of this.segments) { a += s.hp; b += s.maxHp; }
    return a / b;
  }

  update(dt) {
    for (const s of this.segments) if (s.flash > 0) s.flash -= dt;
    // entre les vagues, les ouvriers réparent le segment intact le plus abîmé
    const g = this.game;
    if (g.waves.state === 'prep' && g.production.workers > 0) {
      let worst = null;
      for (const s of this.segments) if (!s.broken && s.hp < s.maxHp && (!worst || s.hp / s.maxHp < worst.hp / worst.maxHp)) worst = s;
      if (worst) {
        worst.hp = Math.min(worst.maxHp, worst.hp + WALL_REGEN_PER_WORKER * g.production.workers * dt);
        this.regenT = (this.regenT || 0) - dt;
        if (this.regenT <= 0) { this.regenT = 1; this.updateVisual(worst); if (Math.random() < 0.5) g.fx.burst(worst.x + (Math.random() - 0.5) * 6, 4.4, MAP.WALL_Z, 2, 0xe0d8c8, 1.5, 0.5, 0.6); }
      }
    }
  }
}
