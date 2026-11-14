import * as THREE from 'three';
import { MAP } from '../data/Config.js';
import { rng } from '../utils/MathUtils.js';
import { ResourceNode } from './ResourceNode.js';
import { Nest } from './Building.js';

// Gisements : [type, u, z] — x = u × (demi-largeur utile), pour s'adapter au portrait comme au paysage.
// Base (z>0, à l'abri) · zone de déploiement (−14…0) · plaine (−28…−14) · brouillard (−56…−28, le plus riche).
export const NODE_LAYOUT = [
  // base
  ['wood', -0.95, 10], ['wood', -0.88, 16], ['wood', -0.97, 22], ['wood', -0.82, 28], ['wood', -0.92, 34], ['wood', -0.7, 6.5],
  ['wood', 0.95, 12], ['wood', 0.85, 18], ['wood', 0.97, 24], ['wood', 0.78, 30], ['wood', 0.9, 36],
  ['stone', -0.62, 10], ['stone', -0.55, 19], ['stone', 0.62, 11], ['stone', 0.5, 22],
  ['gold', -0.42, 31], ['gold', 0.45, 33],
  // zone de déploiement
  ['wood', -0.85, -8], ['wood', 0.85, -9], ['stone', -0.4, -9], ['stone', 0.38, -7.5], ['gold', -0.15, -11],
  // plaine
  ['wood', -0.92, -19], ['wood', 0.92, -21], ['stone', -0.1, -21], ['gold', -0.6, -18], ['gold', 0.58, -20],
  ['metal', -0.32, -17], ['metal', 0.3, -24],
  // brouillard
  ['metal', -0.75, -32], ['metal', 0.72, -34], ['diamond', -0.45, -31], ['diamond', 0.45, -33], ['diamond', 0.0, -30], ['gold', 0.0, -38],
];

function noise2(x, z) {
  const s = Math.sin(x * 0.17 + z * 0.05) * Math.cos(z * 0.13 - x * 0.07) + 0.5 * Math.sin(x * 0.41 + 1.3) * Math.sin(z * 0.37 + 2.1);
  return s * 0.5;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class GameMap {
  constructor(game) { this.game = game; this.nestPos = []; }

  build() {
    const hw = MAP.HALF - 8;
    this.nestPos = [-1, 0, 1].map((k, i) => [MAP.SPAWNS[i].x, MAP.minZ + 9]);
    this.nodeLayout = NODE_LAYOUT.map(([t, u, z]) => [t, u * hw, z]);
    this.buildGround();
    this.buildTown();
    this.buildForest();
    this.buildNorth();
    this.buildTerrain();
    this.buildBounds();
    this.buildCityGate();
  }

  buildGround() {
    const sm = this.game.sm;
    const size = 560, seg = 224;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 14);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grass = new THREE.Color(0x6fa545), grass2 = new THREE.Color(0x5d9440), dirt = new THREE.Color(0x9a8458), stage = new THREE.Color(0x9c9060),
      plain = new THREE.Color(0x9aa356), waste = new THREE.Color(0x62664a), rock = new THREE.Color(0x8d9088), road = new THREE.Color(0xb59a6e),
      blight = new THREE.Color(0x3c3340), snow = new THREE.Color(0xe6ecf0);
    const nests = this.nestPos;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = noise2(x, z), n2 = noise2(x * 2.3 + 17, z * 2.1 - 9);
      // relief hors carte
      const ex = Math.max(0, Math.abs(x) - MAP.HALF - 2), ez = Math.max(0, z - MAP.maxZ - 2, MAP.minZ - 2 - z);
      const out = Math.hypot(ex, ez);
      pos.setY(i, out > 0 ? Math.min(22, out * 0.34 + (n + 0.5) * out * 0.14) : 0);
      // du sud au nord : prairie → terrain piétiné → plaine sèche → friche (brouillard)
      c.copy(n2 > 0 ? grass : grass2);
      c.lerp(stage, smooth(2, -3, z) * 0.9);
      c.lerp(plain, smooth(MAP.STAGE_Z + 2, MAP.STAGE_Z - 3, z) * 0.9);
      c.lerp(waste, smooth(MAP.PLAIN_Z + 2, MAP.PLAIN_Z - 6, z) * 0.95);
      if (n2 > 0.14 && z > MAP.PLAIN_Z) c.lerp(dirt, 0.4);
      if (out > 0) c.lerp(rock, Math.min(0.85, out * 0.06)); 
      if (out > 12) c.lerp(snow, Math.min(0.8, (out - 12) * 0.07));
      for (const [nx, nz] of nests) if (Math.hypot(x - nx, z - nz) < 11) c.lerp(blight, 0.65 * (1 - Math.hypot(x - nx, z - nz) / 11));
      // routes : axe central du château jusqu'à la plaine, chemin transversal
      const roadN = Math.abs(x) < 2.6 + n * 1.0 && z > MAP.minZ + 14 && z < MAP.CASTLE_DOOR.z + 3;
      const roadW = Math.abs(z - (MAP.CASTLE_DOOR.z - 12)) < 1.8 + n * 0.8 && Math.abs(x) < MAP.HALF - 6 && Math.abs(x) > 2;
      if (roadN || roadW) c.lerp(road, 0.8);
      // place devant le château
      if (Math.hypot(x, (z - MAP.CASTLE_DOOR.z) * 0.8) < 9) c.lerp(road, 0.6);
      const j = 0.94 + Math.random() * 0.12;
      col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, sm.mat.ground);
    m.receiveShadow = true;
    sm.scene.add(m);
    this.ground = m;
  }

  block(x, z, r) { const gr = this.game.grid; gr.markCircle(x, z, r, k => { gr.blocked[k] = 1; }); }

  buildTown() {
    const sm = this.game.sm, hw = MAP.HALF - 6, P = MAP.orient === 'portrait';
    const H = Math.PI / 2, cz = MAP.CASTLE_POS.z, k = this.game.castle.k;
    const X = u => u * hw;
    // maisons autour du château (de moins en moins nombreuses en portrait)
    const deco = [
      ['house1', X(-0.62), cz - 8, H, 1.2, 4.2], ['house2', X(-0.86), cz - 22, H, 1.2, 4.2], ['house3', X(-0.7), cz + 4, 0, 1.2, 4.2],
      ['house5', X(0.62), cz - 6, -H, 1.2, 3.8], ['house2', X(0.84), cz - 20, -H, 1.2, 4.2], ['house1', X(0.74), cz + 6, Math.PI, 1.2, 4.2],
      ['church', X(-0.9), cz + 2, H, 1.15, 4.8], ['windmill', X(0.9), cz - 2, -H, 1.35, 3.8],
      ['stall', -10 * k, MAP.CASTLE_DOOR.z - 4, Math.PI, 1.6, 1.8], ['stall', 10 * k, MAP.CASTLE_DOOR.z - 4, Math.PI, 1.6, 1.8],
    ];
    if (!P) deco.push(['house3', X(-0.45), cz - 26, 0, 1.1, 3.6], ['house4', X(0.45), cz - 28, 0, 1.1, 3.6], ['house4', X(-0.95), cz - 36, H, 1.1, 3.6]);
    const tents = [['tent1', X(0.62), 44, 0, 1.3, 2.2], ['tent2', X(0.8), 49, -0.4, 1.2, 2.6], ['tent3', X(0.58), 52, 0.6, 1.3, 2.2], ['tent4', X(0.82), 41, 0.3, 1.1, 2.6]];
    for (const [name, x, z, r, s, br] of [...deco, ...tents]) {
      if (Math.abs(x) < MAP.HALF - 3) {
        sm.model(name, { x, z, rotY: r, scale: s, shadow: true, receive: true });
        this.block(x, z, br);
      }
    }
    const camp = { x: X(0.72), z: 46 };
    const props = [
      ['campfire', camp.x, camp.z, 0, 3.2], ['cauldron', camp.x - 4, camp.z - 4, 0, 2.6], ['logs', X(0.6), 38, 1.2, 3], ['logs', X(-0.5), 26, 0.5, 3],
      ['barrel', -12 * k, MAP.CASTLE_DOOR.z - 2, 0, 2.4], ['barrel2', -13.5 * k, MAP.CASTLE_DOOR.z - 1, 1, 2.4], ['crate', 12 * k, MAP.CASTLE_DOOR.z - 2, 0.3, 2.4],
      ['crate2', 13.5 * k, MAP.CASTLE_DOOR.z - 1, 0, 2.4], ['cart', X(-0.5), 44, 0.6, 2.6], ['well', X(-0.3), cz - 22, 0, 2.6],
      ['sack', 11 * k, MAP.CASTLE_DOOR.z - 1.6, 0, 2.4], ['sack', -11 * k, MAP.CASTLE_DOOR.z - 1.4, 2, 2.4],
    ];
    for (const [name, x, z, r, s] of props) sm.model(name, { x, z, rotY: r, scale: s, shadow: false, lod: true });
    this.block(X(-0.3), cz - 22, 1.2);
    sm.addTorch(camp.x, 1.6, camp.z, 0, 0, false);
    // bornes de la zone de déploiement : piquets de part et d'autre
    for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = sgn * (MAP.HALF - 4 - i * 0.2);
      sm.model('fence', { x, z: MAP.STAGE_Z + 2 + i * 4, rotY: H, scale: 2.2, lod: true });
    }
  }

  buildForest() {
    const sm = this.game.sm, R = rng(77);
    const pts = [];
    const E = MAP.HALF + 4;
    for (let i = 0; i < 420; i++) {
      const x = (R() - 0.5) * 2 * (MAP.HALF + 120), z = MAP.minZ - 50 + R() * (MAP.H + 100);
      const outX = Math.abs(x) > E, outZ = z > MAP.maxZ + 3;
      if (!outX && !outZ) continue;
      pts.push([x, z]);
    }
    // lisière dans la carte (côtés de la base)
    for (let i = 0; i < 46; i++) pts.push([(R() < 0.5 ? -1 : 1) * (E + R() * 5), 2 + R() * (MAP.maxZ - 6)]);
    const inst = new THREE.InstancedMesh(sm.resGeo.wood, sm.mat.units, pts.length);
    const o = new THREE.Object3D();
    pts.forEach(([x, z], i) => {
      const gx = Math.max(0, Math.abs(x) - MAP.HALF - 2), gz = Math.max(0, z - MAP.maxZ - 2, MAP.minZ - 2 - z);
      o.position.set(x, Math.min(22, Math.hypot(gx, gz) * 0.34 + 0.3), z);
      o.rotation.y = R() * 6.28; o.scale.setScalar(1.2 + R() * 1.2); o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
    });
    inst.castShadow = false; inst.frustumCulled = false;
    sm.scene.add(inst);
  }

  buildNorth() {
    const g = this.game, sm = g.sm, R = rng(1337);
    g.resources.nodes = this.nodeLayout.map(([t, x, z], i) => new ResourceNode(g, t, x + (R() - 0.5) * 1.2, z + (R() - 0.5) * 1.2, i));
    g.waves.nests = this.nestPos.map(([x, z], i) => new Nest(g, i, x, z));
    // décor : rochers et arbres morts (plaine et friche)
    for (let i = 0; i < 34; i++) {
      const x = (R() - 0.5) * (MAP.W - 8), z = MAP.STAGE_Z - 2 - R() * (MAP.FOG_END_Z * -1 - 18);
      if (Math.abs(x) < 4) continue;
      if (g.resources.nodes.some(n => Math.hypot(n.x - x, n.z - z) < 5)) continue;
      const rock = R() < 0.5;
      const m = new THREE.Mesh(rock ? sm.resGeo.rock : sm.resGeo.deadtree, sm.mat.units);
      m.position.set(x, 0, z); m.rotation.y = R() * 6; m.scale.setScalar(0.8 + R() * 0.7); m.castShadow = true;
      sm.scene.add(m);
      if (rock) this.block(x, z, 1.4);
    }
  }

  // Terrain tactique : une barrière rocheuse percée de trois passes qui canalisent les zombies,
  // des bosquets sur les flancs (obstacles, abris) et une plaine dégagée au centre pour les charges de cavalerie.
  buildTerrain() {
    const g = this.game, sm = g.sm, R = rng(404), P = MAP.orient === 'portrait';
    const hw = MAP.HALF - 6;
    const barZ = MAP.PLAIN_Z - 6;
    const passW = P ? 9 : 12;
    const passes = [-0.6 * hw, 0.05 * hw, 0.6 * hw];
    this.passes = passes.map(x => ({ x, z: barZ, w: passW }));
    const inPass = x => passes.some(c => Math.abs(x - c) < passW / 2 + 1.5);
    for (let x = MAP.minX + 2; x <= MAP.maxX - 2; x += 4.2) {
      if (inPass(x)) continue;
      const m = new THREE.Mesh(sm.resGeo.cliff, sm.mat.units);
      const sc = 1.15 + R() * 0.8;
      m.position.set(x + (R() - 0.5) * 1.5, 0, barZ + (R() - 0.5) * 2.2);
      m.rotation.y = R() * 6.28; m.scale.setScalar(sc); m.castShadow = true;
      sm.scene.add(m);
      this.block(m.position.x, m.position.z, 2.5 * sc);
    }
    // bosquets sur les flancs de la plaine
    const pts = [];
    for (const sgn of [-1, 1]) {
      const cx = sgn * hw * (P ? 0.72 : 0.7), cz = MAP.STAGE_Z - 9;
      for (let i = 0; i < (P ? 10 : 18); i++) {
        const x = cx + (R() - 0.5) * hw * (P ? 0.55 : 0.5), z = cz + (R() - 0.5) * 12;
        if (g.resources.nodes.some(n => Math.hypot(n.x - x, n.z - z) < 5)) continue;
        pts.push([x, z]);
        this.block(x, z, 1.9);
      }
    }
    const inst = new THREE.InstancedMesh(sm.resGeo.wood, sm.mat.units, pts.length);
    const o = new THREE.Object3D();
    pts.forEach(([x, z], i) => { o.position.set(x, 0, z); o.rotation.y = R() * 6.28; o.scale.setScalar(1.5 + R() * 0.9); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); });
    inst.frustumCulled = false;
    sm.scene.add(inst);
  }

  buildBounds() {
    const sm = this.game.sm, R = rng(5);
    const n = Math.ceil(MAP.H / 8.5);
    for (let i = 0; i < n; i++) {
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(sm.resGeo.cliff, sm.mat.units);
        m.position.set(side * (MAP.HALF + 1 + R() * 4), 0, MAP.minZ + i * 8.5);
        m.rotation.y = R() * 6; m.scale.setScalar(1 + R() * 0.8);
        sm.scene.add(m);
      }
    }
    const nx = Math.ceil(MAP.W / 12) + 2;
    for (let i = 0; i < nx; i++) {
      for (const [z, s] of [[MAP.minZ - 3, 1.5], [MAP.maxZ + 3, 1.2]]) {
        const m = new THREE.Mesh(sm.resGeo.cliff, sm.mat.units);
        m.position.set(-MAP.HALF - 6 + i * 12, 0, z - R() * 3); m.rotation.y = R() * 6; m.scale.setScalar(s + R() * 0.8);
        sm.scene.add(m);
      }
    }
  }

  // Porte de la Ville : arche + panneau, au sud-est du château (touche : ouvre la carte « Ville »)
  buildCityGate() {
    const sm = this.game.sm, k = this.game.castle.k;
    const x = this.game.castle.rect.x1 + 11, z = MAP.maxZ - 5;
    this.cityGate = { x, z };
    sm.model('wall_arch', { x, z, rotY: 0, scale: 0.9, shadow: true, receive: true });
    // route vers le sud
    const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 14), new THREE.MeshLambertMaterial({ color: 0xb59a6e }));
    road.rotation.x = -Math.PI / 2; road.position.set(x, 0.05, z + 7); road.receiveShadow = true; sm.scene.add(road);
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const cx = c.getContext('2d');
    cx.fillStyle = '#5a3a1a'; cx.fillRect(0, 0, 256, 96); cx.strokeStyle = '#e3b866'; cx.lineWidth = 6; cx.strokeRect(4, 4, 248, 88);
    cx.fillStyle = '#ffe3a8'; cx.font = 'bold 44px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🏘 VILLE', 128, 52);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true }));
    sp.scale.set(8, 3, 1); sp.position.set(x, 11, z);
    sm.scene.add(sp);
    this.block(x - 3.2, z, 1.5); this.block(x + 3.2, z, 1.5);
  }

  // Zones de déploiement des armes de siège
  inZone(zone, x, z) {
    if (Math.abs(x) > MAP.HALF - 3) return false;
    if (zone === 'back') return z > MAP.WALL_HALF_THICK + 1.5 && z < this.game.castle.rect.z0 - 3;
    if (zone === 'front') return z < -MAP.WALL_HALF_THICK - 1.5 && z > MAP.STAGE_Z;
    return false;
  }
}
