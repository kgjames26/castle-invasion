import * as THREE from 'three';
import { HARVEST } from '../data/Config.js';

// vestiges laissés par un gisement épuisé : souche, éboulis ou trou de mine
const LEFT = {};
function leftover(type) {
  if (LEFT[type]) return LEFT[type];
  const spec = type === 'wood' ? [0.6, 0.35, 0.6, 0x6b4a2c] : type === 'stone' ? [1.4, 0.25, 1.2, 0x8a8a84] : [1.5, 0.12, 1.5, 0x3a3028];
  const g = new THREE.BoxGeometry(spec[0], spec[1], spec[2]).toNonIndexed();
  g.deleteAttribute('uv'); g.translate(0, spec[1] / 2, 0);
  const c = new THREE.Color(spec[3]), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const f = 0.9 + Math.random() * 0.2; col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return (LEFT[type] = g);
}

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
    const rest = new THREE.Mesh(leftover(this.type), this.game.sm.mat.units);
    rest.position.set(this.x, 0, this.z); rest.rotation.y = this.mesh.rotation.y; rest.receiveShadow = true;
    this.game.sm.scene.add(rest);
    this.game.fx.burst(this.x, 0.8, this.z, 10, this.type === 'wood' ? 0x5a4020 : 0x8a8a8a, 4, 0.9, 1);
    this.game.resources.onDepleted(this);
  }
}
