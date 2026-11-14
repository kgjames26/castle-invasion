import * as THREE from 'three';
import { MAP } from '../data/Config.js';
import { rng } from '../utils/MathUtils.js';
import { ResourceNode } from './ResourceNode.js';
import { Nest } from './Building.js';

// Terrain, décor de la ville, forêts, gisements et nids
export const NODE_LAYOUT = [
  // sud (à l'abri de la muraille)
  ['wood', -56, 7], ['wood', -53, 11.5], ['wood', -57, 16], ['wood', -51, 20], ['wood', -55.5, 22.5], ['wood', -47, 6], ['wood', -52, 4.8],
  ['wood', 54, 5.5], ['wood', 57, 10], ['wood', 50.5, 8],
  ['stone', -42, 6], ['stone', -39, 11], ['stone', 42, 5.5],
  ['gold', -35, 21],
  // nord (risqué, plus riche)
  ['wood', -50, -14], ['wood', -46, -20], ['wood', -54, -26], ['wood', 48, -12], ['wood', 53, -18], ['wood', 44, -26], ['wood', -20, -34], ['wood', 22, -36],
  ['stone', -28, -10], ['stone', 30, -11], ['stone', -10, -22],
  ['gold', -36, -24], ['gold', 14, -17], ['gold', 38, -32],
  ['metal', -18, -13], ['metal', 26, -23], ['metal', -44, -38], ['metal', 8, -40],
  ['diamond', -24, -47], ['diamond', 25, -49], ['diamond', 0, -34],
];
export const NEST_POS = [[-40, -54], [0, -55], [40, -54]];

function noise2(x, z) {
  const s = Math.sin(x * 0.17 + z * 0.05) * Math.cos(z * 0.13 - x * 0.07) + 0.5 * Math.sin(x * 0.41 + 1.3) * Math.sin(z * 0.37 + 2.1);
  return s * 0.5;
}

export class GameMap {
  constructor(game) { this.game = game; }

  build() {
    this.buildGround();
    this.buildTown();
    this.buildForest();
    this.buildNorth();
    this.buildBounds();
  }

  buildGround() {
    const sm = this.game.sm;
    const size = 240, seg = 96;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grass = new THREE.Color(0x34402e), dirt = new THREE.Color(0x40362a), snow = new THREE.Color(0x8e9aa6), waste = new THREE.Color(0x2c2622), road = new THREE.Color(0x5a4c3c), blight = new THREE.Color(0x2a2030);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = noise2(x, z), n2 = noise2(x * 2.3 + 17, z * 2.1 - 9);
      // relief hors carte
      const ex = Math.max(0, Math.abs(x) - 63), ez = Math.max(0, Math.abs(z) - 63);
      const out = Math.hypot(ex, ez);
      pos.setY(i, out > 0 ? Math.min(14, out * 0.35 + (n + 0.5) * out * 0.12) : 0);
      if (z < -2) c.copy(waste).lerp(grass, Math.max(0, (z + 30) / 40) * 0.6); else c.copy(grass);
      if (n2 > 0.12) c.lerp(dirt, 0.55);
      if (n > 0.2 || out > 2) c.lerp(snow, Math.min(0.75, (n - 0.15) * 2.2 + out * 0.08));
      if (z < -44 && Math.abs(z + 55) < 8) for (const [nx] of NEST_POS) if (Math.abs(x - nx) < 9) c.lerp(blight, 0.6);
      // routes
      const roadN = Math.abs(x) < 2.6 + n * 1.2 && z > -48 && z < 27;
      const roadW = Math.abs(z - 14) < 2 + n && Math.abs(x) < 46 && Math.abs(x) > 2;
      if (roadN || roadW) c.lerp(road, 0.75);
      const j = 0.93 + Math.random() * 0.14;
      col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    m.receiveShadow = true;
    sm.scene.add(m);
    this.ground = m;
  }

  block(x, z, r) { const gr = this.game.grid; gr.markCircle(x, z, r, k => { gr.blocked[k] = 1; }); }

  buildTown() {
    const sm = this.game.sm;
    const H = Math.PI / 2;
    const deco = [
      ['house1', -30, 31, H, 1.1, 4], ['house2', -40, 42, H, 1.1, 4], ['house3', -28, 50, 0, 1.1, 4], ['house4', -48, 29, H, 1.0, 3.5],
      ['church', -48, 50, H, 1.0, 4.5], ['house5', -36, 56, 0, 1.0, 3.5],
      ['house5', 30, 33, -H, 1.1, 3.5], ['house2', 40, 44, -H, 1.1, 4], ['house1', 30, 52, Math.PI, 1.1, 4], ['house3', 46, 54, 0, 1.0, 3.5],
      ['windmill', 50, 34, -H, 1.25, 3.5], ['stall', 22, 26, Math.PI, 1.6, 1.8], ['stall', -22, 26, Math.PI, 1.6, 1.8],
      ['tent1', 48, 17, 0, 1.2, 2], ['tent2', 54, 21, -0.4, 1.1, 2.6], ['tent3', 46, 23, 0.6, 1.2, 2], ['tent4', 54, 14.5, 0.3, 1.0, 2.6],
      ['tent5', 41, 18, 0, 1.2, 1.8],
    ];
    for (const [name, x, z, r, s, br] of deco) {
      sm.model(name, { x, z, rotY: r, scale: s, shadow: true, receive: true });
      this.block(x, z, br);
    }
    const props = [
      ['campfire', 49, 20, 0, 3.2], ['cauldron', 44, 14, 0, 2.6], ['barrel', -24, 30, 0, 2.4], ['barrel2', -25.5, 31, 1, 2.4], ['crate', -24, 33, 0.3, 2.4],
      ['crate2', 25, 31, 0, 2.4], ['barrel', 26, 29, 0, 2.4], ['logs', -44, 19, 0.5, 3], ['logs', 40, 10, 1.2, 3], ['cart', 20, 36, 0.6, 2.6],
      ['well', -18, 36, 0, 2.6], ['sack', 23, 33, 0, 2.4], ['sack', -23, 35, 2, 2.4], ['barrel', 6, 24, 0, 2.2], ['crate', -6.5, 24, 0.4, 2.2],
    ];
    for (const [name, x, z, r, s] of props) sm.model(name, { x, z, rotY: r, scale: s, shadow: false, lod: true });
    this.block(-18, 36, 1.2);
    for (let i = 0; i < 9; i++) sm.model('fence', { x: -60 + i * 1.6, z: 26, rotY: Math.PI / 2, scale: 2.2, lod: true });
    sm.addTorch(49, 1.6, 20, 18, 16);
  }

  buildForest() {
    const sm = this.game.sm, R = rng(77);
    const pts = [];
    for (let i = 0; i < 260; i++) {
      const a = R() * Math.PI * 2, d = 66 + R() * 30;
      const x = Math.cos(a) * d * (1 + R() * 0.2), z = Math.sin(a) * d;
      if (Math.abs(x) < 64 && Math.abs(z) < 64) continue;
      pts.push([x, z]);
    }
    for (let i = 0; i < 40; i++) pts.push([-62 - R() * 6, 4 + R() * 56], [62 + R() * 6, 4 + R() * 56]);
    const inst = new THREE.InstancedMesh(sm.resGeo.wood, sm.mat.units, pts.length);
    const o = new THREE.Object3D();
    pts.forEach(([x, z], i) => {
      const gx = Math.max(0, Math.abs(x) - 63), gz = Math.max(0, Math.abs(z) - 63);
      o.position.set(x, Math.min(14, Math.hypot(gx, gz) * 0.4), z);
      o.rotation.y = R() * 6.28; o.scale.setScalar(1.2 + R() * 1.1); o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
    });
    inst.castShadow = false;
    sm.scene.add(inst);
  }

  buildNorth() {
    const g = this.game, sm = g.sm, R = rng(1337);
    // gisements
    g.resources.nodes = NODE_LAYOUT.map(([t, x, z], i) => new ResourceNode(g, t, x + (R() - 0.5) * 1.2, z + (R() - 0.5) * 1.2, i));
    // nids
    g.waves.nests = NEST_POS.map(([x, z], i) => new Nest(g, i, x, z));
    // décor : rochers et arbres morts
    for (let i = 0; i < 26; i++) {
      const x = (R() - 0.5) * 108, z = -8 - R() * 46;
      if (Math.abs(x) < 4) continue;
      if (g.resources.nodes.some(n => Math.hypot(n.x - x, n.z - z) < 5)) continue;
      const rock = R() < 0.5;
      const m = new THREE.Mesh(rock ? sm.resGeo.rock : sm.resGeo.deadtree, sm.mat.units);
      m.position.set(x, 0, z); m.rotation.y = R() * 6; m.scale.setScalar(0.8 + R() * 0.6); m.castShadow = true;
      sm.scene.add(m);
      if (rock) this.block(x, z, 1.4);
    }
  }

  buildBounds() {
    const sm = this.game.sm, R = rng(5);
    for (let i = 0; i < 14; i++) {
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(sm.resGeo.cliff, sm.mat.units);
        m.position.set(side * (63 + R() * 4), 0, -58 + i * 8.5);
        m.rotation.y = R() * 6; m.scale.setScalar(1 + R() * 0.8);
        sm.scene.add(m);
      }
    }
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(sm.resGeo.cliff, sm.mat.units);
      m.position.set(-66 + i * 12, 0, -64 - R() * 3); m.rotation.y = R() * 6; m.scale.setScalar(1.3 + R() * 0.8);
      sm.scene.add(m);
    }
  }

  // Zones de déploiement des armes de siège
  inZone(zone, x, z) {
    if (Math.abs(x) > MAP.HALF - 3) return false;
    if (zone === 'back') return z > MAP.WALL_HALF_THICK + 1.5 && z < 25;
    if (zone === 'front') return z < -MAP.WALL_HALF_THICK - 1.5 && z > -50;
    return false;
  }
}
