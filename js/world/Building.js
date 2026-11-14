import * as THREE from 'three';
import { MAP, CASTLE_HP, CENTER, NEST } from '../data/Config.js';

// Le château : base majestueuse à défendre. S'il tombe, la partie est perdue.
export class Castle {
  constructor(game) {
    this.game = game;
    this.team = 'player';
    this.isStructure = true;
    this.isCastle = true;
    this.type = 'castle';
    this.x = MAP.CASTLE_POS.x; this.z = MAP.CASTLE_POS.z;
    this.rect = { x0: -13.5, x1: 13.5, z0: 27.6, z1: 53 };
    this.radius = 13;
    this.alive = true;
    this.baseHp = CASTLE_HP;
    this.maxHp = CASTLE_HP;
    this.hp = CASTLE_HP;
    this.flash = 0;
  }
  build() {
    const { sm, grid } = this.game;
    this.mesh = sm.model('castle', { x: this.x, z: this.z, rotY: Math.PI, scale: MAP.CASTLE_SCALE, shadow: true, receive: true });
    const r = this.rect;
    grid.markRect(r.x0, r.z0, r.x1, r.z1, k => { grid.blocked[k] = 1; });
    sm.addTorch(-3.2, 4.5, 25.6, 14, 18);
    sm.addTorch(3.2, 4.5, 25.6, 14, 18);
  }
  applyDefenses(level) {
    const f = this.hp / this.maxHp;
    this.maxHp = Math.round(this.baseHp * (1 + 0.2 * level));
    this.hp = Math.round(this.maxHp * f);
  }
  // distance d'un point à l'emprise du château
  distTo(x, z) {
    const r = this.rect;
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
    return Math.hypot(dx, dz);
  }
  nearestPoint(x, z) {
    const r = this.rect;
    return { x: Math.max(r.x0, Math.min(r.x1, x)), z: Math.max(r.z0, Math.min(r.z1, z)) };
  }
  takeDamage(n) {
    if (!this.alive) return;
    this.hp -= n;
    this.flash = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.game.gameOver(); }
  }
}

// Centre de récolte : point de dépôt et bonus de vitesse pour les cultivateurs proches
export class CollectionCenter {
  constructor(game, x, z, hp) {
    this.game = game;
    this.team = 'player';
    this.isStructure = true;
    this.type = 'center';
    this.x = x; this.z = z;
    this.radius = 2.6;
    this.maxHp = CENTER.hp;
    this.hp = hp ?? CENTER.hp;
    this.alive = true;
    this.flash = 0;
    this.id = 'c' + Math.random().toString(36).slice(2, 8);
    this.mesh = game.sm.model('house5', { x, z, rotY: Math.random() * Math.PI * 2, scale: 0.75, shadow: true });
    this.crate = game.sm.model('crate', { x: x + 2.6, z: z + 1.2, scale: 2.2 });
    this.barrel = game.sm.model('barrel', { x: x - 2.5, z: z + 1.5, scale: 2.2 });
    this.cells = [];
    game.grid.markCircle(x, z, 2.4, k => { if (game.grid.building[k] < 0) { game.grid.building[k] = 1; this.cells.push(k); } });
    game.pathfinding.invalidate();
  }
  takeDamage(n) {
    if (!this.alive) return;
    this.hp -= n;
    this.flash = 0.15;
    if (this.hp <= 0) this.destroy();
  }
  destroy() {
    this.alive = false;
    const g = this.game;
    for (const m of [this.mesh, this.crate, this.barrel]) g.sm.scene.remove(m);
    for (const k of this.cells) g.grid.building[k] = -1;
    g.fx.burst(this.x, 2, this.z, 24, 0x8a6a40, 6, 1.2, 1.2);
    g.fx.smoke(this.x, 2, this.z, 8);
    g.pathfinding.invalidate();
    g.resources.centers = g.resources.centers.filter(c => c !== this);
    g.ui.toast('Un centre de récolte a été détruit', 'danger');
    if (g.selection.structure === this) g.selection.clear();
  }
}

// Nid de zombies (au nord) : le bélier peut le détruire pour affaiblir les vagues
export class Nest {
  constructor(game, index, x, z) {
    this.game = game;
    this.index = index;
    this.team = 'enemy';
    this.isStructure = true;
    this.isNest = true;
    this.type = 'nest';
    this.x = x; this.z = z;
    this.radius = 3.6;
    this.maxHp = NEST.hp;
    this.hp = NEST.hp;
    this.alive = true;
    this.regrow = 0;
    this.flash = 0;
    this.mesh = new THREE.Mesh(game.sm.resGeo.nest, game.sm.mat.units);
    this.mesh.position.set(x, 0, z);
    this.mesh.castShadow = true;
    game.sm.scene.add(this.mesh);
    this.light = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 9), new THREE.MeshBasicMaterial({ color: 0x9a40e0 }));
    this.light.position.set(x, 2.62, z);
    game.sm.scene.add(this.light);
  }
  takeDamage(n) {
    if (!this.alive) return;
    this.hp -= n;
    this.flash = 0.15;
    this.game.fx.burst(this.x, 2, this.z, 4, 0x3a2a3a, 4, 0.7, 0.8);
    if (this.hp <= 0) this.destroy();
  }
  destroy(silent = false) {
    const g = this.game;
    this.alive = false;
    this.hp = 0;
    this.regrow = NEST.regrowWaves;
    if (silent) { this.mesh.visible = false; this.light.visible = false; return; }
    this.mesh.visible = false;
    this.light.visible = false;
    g.fx.burst(this.x, 2, this.z, 40, 0x6a2a7a, 9, 1.5, 1.4);
    g.fx.smoke(this.x, 2, this.z, 10);
    g.resources.addAll(NEST.reward);
    g.ui.toast(`Nid détruit ! +${NEST.reward.diamond} 💎 +${NEST.reward.gold} 🪙 — vagues affaiblies`, 'ok');
  }
  onWaveEnd() {
    if (this.alive) return;
    this.regrow--;
    if (this.regrow <= 0) {
      this.alive = true; this.hp = this.maxHp; this.mesh.visible = true; this.light.visible = true;
      this.game.ui.toast('Un nid de zombies a repoussé au nord…', 'warn');
    }
  }
}
