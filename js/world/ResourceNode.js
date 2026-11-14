import * as THREE from 'three';
import { HARVEST } from '../data/Config.js';

// Gisement : rétrécit à mesure qu'il est récolté puis disparaît → zone constructible
export class ResourceNode {
  constructor(game, type, x, z, index, amount) {
    this.game = game;
    this.type = type;
    this.x = x; this.z = z;
    this.index = index;
    this.max = amount ?? HARVEST[type].amount;
    this.amount = this.max;
    this.radius = type === 'wood' ? 0.9 : 1.3;
    this.harvesters = 0;
    this.alive = true;
    this.mesh = new THREE.Mesh(game.sm.resGeo[type], game.sm.mat.units);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = Math.random() * Math.PI * 2;
    this.baseScale = type === 'wood' ? 0.9 + Math.random() * 0.35 : 1 + Math.random() * 0.2;
    this.mesh.castShadow = true;
    game.sm.scene.add(this.mesh);
    const g = game.grid, c = g.toCell(x, z);
    this.cell = g.inBounds(c.i, c.j) ? g.idx(c.i, c.j) : -1;
    if (this.cell >= 0) g.extra[this.cell] += 3;
    this.updateScale();
  }

  updateScale() {
    const f = this.amount / this.max;
    const s = this.baseScale * (0.45 + 0.55 * Math.sqrt(f));
    this.mesh.scale.set(s, this.type === 'wood' ? s : s * (0.6 + 0.4 * f), s);
  }

  take(n) {
    if (!this.alive) return 0;
    const t = Math.min(n, this.amount);
    this.amount -= t;
    this.updateScale();
    if (this.amount <= 0.001) this.deplete();
    return t;
  }

  deplete() {
    this.alive = false;
    this.amount = 0;
    this.game.sm.scene.remove(this.mesh);
    if (this.cell >= 0) this.game.grid.extra[this.cell] = Math.max(0, this.game.grid.extra[this.cell] - 3);
    this.game.fx.burst(this.x, 0.8, this.z, 10, this.type === 'wood' ? 0x5a4020 : 0x8a8a8a, 4, 0.9, 1);
    this.game.resources.onDepleted(this);
  }
}
