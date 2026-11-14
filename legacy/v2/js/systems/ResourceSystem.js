import * as THREE from 'three';
import { RESOURCES, ALL_RES, RES_INFO, HARVEST, storageCap, CARRY_BASE, CENTER, MAP } from '../data/Config.js';
import { CollectionCenter } from '../world/Building.js';

// 5 ressources, gisements, centres de récolte, affectation automatique des cultivateurs
export class ResourceSystem {
  constructor(game) {
    this.game = game;
    this.stock = Object.fromEntries(ALL_RES.map(r => [r, 0]));
    this.nodes = [];
    this.sites = [];   // gisements épuisés → zones constructibles
    this.centers = [];
    this.income = Object.fromEntries(ALL_RES.map(r => [r, 0]));
    this.flashRes = {};
  }

  canAfford(cost) { return Object.entries(cost || {}).every(([k, v]) => this.stock[k] >= v); }
  spend(cost) { for (const [k, v] of Object.entries(cost || {})) this.stock[k] -= v; }
  refund(cost, f = 1) { for (const [k, v] of Object.entries(cost || {})) this.stock[k] += Math.floor(v * f); }
  cap(type) { const P = this.game.production; return storageCap(type, { granary: P.level('granary'), warehouse: P.level('warehouse') }); }
  add(type, n) {
    const room = Math.max(0, this.cap(type) - this.stock[type]);
    n = Math.min(n, room);                 // stockage plein : le surplus est perdu
    if (n <= 0) return;
    this.stock[type] += n;
    this.income[type] += n;
    this.flashRes[type] = 0.5;
    this.game.stats.gathered += n;
  }
  addAll(o) { for (const [k, v] of Object.entries(o)) this.add(k, v); }
  missing(cost) {
    return Object.entries(cost || {}).filter(([k, v]) => this.stock[k] < v).map(([k, v]) => `${RES_INFO[k].icon}${Math.ceil(v - this.stock[k])}`).join(' ');
  }

  capacity() { return CARRY_BASE * (this.game.production.hasTech('baskets') ? 1.6 : 1); }

  harvestMul(x, z) {
    let m = this.game.production.hasTech('tools') ? 1.25 : 1;
    if (this.centers.some(c => c.alive && Math.hypot(c.x - x, c.z - z) < CENTER.radius)) m += CENTER.bonus;
    return m;
  }

  dropOff(x, z) {
    const door = MAP.CASTLE_DOOR;
    let best = { x: door.x + (Math.random() - 0.5) * 6, z: door.z - 0.5 }, bd = Math.hypot(door.x - x, door.z - z);
    for (const c of this.centers) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      // un centre au nord n'est utilisé que s'il est du même côté de la muraille
      if ((c.z < 0) !== (z < 0) && Math.abs(z) > 3) continue;
      if (d < bd) { bd = d; best = { x: c.x + 2.6, z: c.z + 2.6 }; }
    }
    return best;
  }
  safeDrop() { return { x: MAP.CASTLE_DOOR.x + (Math.random() - 0.5) * 8, z: MAP.CASTLE_DOOR.z - 1 }; }

  // Besoin relatif : favorise la ressource la plus rare, répartit les cultivateurs,
  // et pendant une vague n'envoie personne au nord
  autoType() {
    const NEED = { stone: 1, wood: 1.1, gold: 1.15, metal: 0.95, diamond: 0.3 };
    const g = this.game, wave = g.waves.state === 'active';
    const cults = g.units.filter(u => u.alive && u.type === 'cultivator');
    let best = 'wood', bs = -Infinity;
    for (const t of RESOURCES) {
      const avail = this.nodes.filter(n => n.alive && n.type === t && (!wave || n.z > 0));
      if (!avail.length) continue;
      const assigned = cults.filter(u => u.node && u.node.type === t).length;
      const s = NEED[t] * 120 / (120 + this.stock[t]) - assigned / Math.max(4, cults.length) * 0.9 + (avail.some(n => n.z > 0) ? 0.08 : 0);
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }

  bestNode(cult, type) {
    const g = this.game;
    const t = type || this.autoType();
    const waveDanger = g.waves.state === 'active';
    let best = null, bs = Infinity;
    for (const n of this.nodes) {
      if (!n.alive || n.type !== t) continue;
      let s = Math.hypot(n.x - cult.x, n.z - cult.z) + n.harvesters * 7;
      if (n.z < 0) s += waveDanger ? 200 : 12; // le nord est dangereux pendant une vague
      if (s < bs) { bs = s; best = n; }
    }
    if (!best && type) return this.bestNode(cult, null);
    return best;
  }

  onDepleted(node) {
    const g = this.game;
    const m = new THREE.Mesh(g.sm.resGeo.site, g.sm.mat.units);
    m.position.set(node.x, 0, node.z);
    g.sm.scene.add(m);
    this.sites.push({ x: node.x, z: node.z, mesh: m, from: node.type });
    g.ui.toast(`Gisement de ${RES_INFO[node.type].name.toLowerCase()} épuisé — zone constructible libérée`, 'info', 'deplete');
  }

  buildCenter(x, z, hp) {
    const c = new CollectionCenter(this.game, x, z, hp);
    this.centers.push(c);
    const s = this.sites.findIndex(s => Math.hypot(s.x - x, s.z - z) < 2.5);
    if (s >= 0) { this.game.sm.scene.remove(this.sites[s].mesh); this.sites.splice(s, 1); }
    return c;
  }

  update(dt) {
    for (const k in this.flashRes) if (this.flashRes[k] > 0) this.flashRes[k] -= dt;
  }
}
