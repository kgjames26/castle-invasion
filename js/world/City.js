import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS, MAP, JOBS } from '../data/Config.js';
import { rng } from '../utils/MathUtils.js';

// Carte secondaire « Ville », au sud de la base : bâtiments de développement et de création.
// Chaque bâtiment est visible dans le décor ; toucher un bâtiment (ou son étiquette) ouvre son menu.
const SLOTS = {
  landscape: {
    lab: [-45, -26], barracks: [-15, -26], range: [15, -26], stable: [45, -26],
    workshop: [-45, 2], forge: [-15, 2], depot: [15, 2], defenses: [45, 2],
    quarters: [-45, 36], market: [-15, 36], granary: [15, 36], warehouse: [45, 36],
    farm: [-45, 66], mill: [-15, 66], sawmill: [15, 66], quarry: [45, 66],
    mine: [-15, 96], goldmine: [15, 96],
  },
  portrait: {
    lab: [-17, -58], barracks: [17, -58], range: [-17, -36], stable: [17, -36],
    workshop: [-17, -14], forge: [17, -14], depot: [-17, 8], defenses: [17, 8],
    quarters: [-17, 46], market: [17, 46], granary: [-17, 72], warehouse: [17, 72],
    farm: [-17, 98], mill: [17, 98], sawmill: [-17, 124], quarry: [17, 124],
    mine: [-17, 150], goldmine: [17, 150],
  },
};
// zones de la ville : l'Armée (au nord) et le Village (au sud)
export const ZONE_OF = { lab: 'army', barracks: 'army', range: 'army', depot: 'army', stable: 'army', workshop: 'army', forge: 'army', defenses: 'army', quarters: 'village', market: 'village', granary: 'village', warehouse: 'village', farm: 'village', mill: 'village', sawmill: 'village', quarry: 'village', mine: 'village', goldmine: 'village' };
const ZONE_VIEW = {
  landscape: { army: { z: -22, dist: 124 }, village: { z: 54, dist: 124 } },
  portrait: { army: { z: -40, dist: 165 }, village: { z: 88, dist: 200 } },
};
// modèles du pack médiéval composant chaque bâtiment [nom, dx, dz, rotY, échelle]
const PARTS = {
  quarters: [['house1', 0, 0, 0, 1.55], ['house2', 8, 7, 0.4, 1.2], ['house4', -8, 7, -0.3, 1.2]],
  barracks: [['tower2', 0, 0, 0, 1.5], ['tent2', 9, 6, 0.3, 1.3], ['tent1', -9, 6, -0.3, 1.3], ['fence', 0, 9, Math.PI / 2, 2.2]],
  stable: [['house3', 0, 0, Math.PI, 1.55], ['fence', 0, 9, Math.PI / 2, 2.2], ['sack', 6, 8, 0, 2.4], ['logs', -6, 8, 0.4, 3]],
  workshop: [['house5', 0, 0, 0, 1.5], ['cart', 9, 5, 0.7, 2.6], ['logs', -8, 6, 0.3, 3], ['crate', -4, 9, 0.2, 2.4]],
  lab: [['church', 0, 0, 0, 1.45]],
  range: [['tower3', 0, 0, 0, 1.2], ['fence', -8, 8, 0, 2.2], ['fence', 8, 8, 0, 2.2], ['barrel', 5, 11, 0, 2.4], ['crate', -5, 11, 0.4, 2.4]],
  depot: [['house5', 0, 0, Math.PI, 1.5], ['crate', 8, 5, 0.3, 2.6], ['crate2', 11, 8, 0, 2.6], ['sack', -8, 6, 0, 2.6], ['cart', -9, 9, 0.5, 2.6]],
  forge: [['house4', 0, 0, 0, 1.45], ['cauldron', 8, 5, 0, 2.6], ['campfire', -7, 6, 0, 3.2], ['barrel', 5, 9, 0, 2.4], ['crate2', -3, 9, 0.3, 2.4]],
  market: [['stall', 0, 0, Math.PI, 2.0], ['stall', 9, 2, Math.PI, 2.0], ['stall', -9, 2, Math.PI, 2.0], ['barrel', 5, 7, 0, 2.4], ['crate', -5, 7, 0.5, 2.4], ['sack', 0, 8, 0, 2.4]],
  defenses: [['tower3', 0, 0, 0, 1.5], ['wall', 8, 2, Math.PI / 2, 0.9], ['wall', -8, 2, Math.PI / 2, 0.9]],
};

// petites géométries colorées (sommets colorés) pour champs, fosses, galeries et animaux
function cbox(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.deleteAttribute('uv'); g.translate(x, y, z);
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const merge = parts => { const g = mergeGeometries(parts, false); g.computeBoundingSphere(); return g; };
function makeField(crop) { // champ cultivé : terre labourée et rangs de cultures
  const parts = [cbox(13, 0.18, 9, 0, 0.09, 0, 0x6b4a2c)];
  for (let i = 0; i < 7; i++) parts.push(cbox(11.6, crop.h, 0.7, 0, 0.18 + crop.h / 2, -3.6 + i * 1.2, i % 2 ? crop.a : crop.b));
  return merge(parts);
}
const makePit = () => merge([cbox(12, 0.12, 12, 0, 0.06, 0, 0x7d7566), cbox(8.5, 0.2, 8.5, 0, 0.1, 0, 0x4a453d), cbox(5, 0.28, 5, 0, 0.14, 0, 0x2c2924)]);
const makeAdit = () => merge([cbox(5, 3.4, 1.2, 0, 1.7, 0, 0x5a4a38), cbox(3, 2.6, 1.4, 0, 1.3, 0.05, 0x14110e), cbox(5.6, 0.5, 1.6, 0, 3.5, 0, 0x7a5c3c), cbox(0.5, 3.2, 1.7, -2, 1.6, 0.1, 0x7a5c3c), cbox(0.5, 3.2, 1.7, 2, 1.6, 0.1, 0x7a5c3c)]);
const makeSheep = () => merge([cbox(0.95, 0.6, 0.55, 0, 0.55, 0, 0xf1eee6), cbox(0.34, 0.34, 0.34, 0.6, 0.72, 0, 0x2b2623), ...[[-0.3, -0.18], [-0.3, 0.18], [0.3, -0.18], [0.3, 0.18]].map(([x, z]) => cbox(0.1, 0.32, 0.1, x, 0.16, z, 0x2b2623))]);
const makeCow = () => merge([cbox(1.5, 0.8, 0.7, 0, 0.9, 0, 0xe8e0d0), cbox(0.5, 0.5, 0.5, 0.95, 1.05, 0, 0xd9cdb8), cbox(0.5, 0.35, 0.72, -0.3, 1.0, 0, 0x3a2f28), ...[[-0.5, -0.25], [-0.5, 0.25], [0.5, -0.25], [0.5, 0.25]].map(([x, z]) => cbox(0.14, 0.55, 0.14, x, 0.27, z, 0x3a2f28))]);

PARTS.farm = [['house2', 0, -2, 0, 1.3], ['field:wheat', -12, 10, 0, 1], ['field:green', 12, 10, 0, 1], ['sack', 6, 3, 0, 2.4], ['fence', 0, 16, Math.PI / 2, 3]];
PARTS.mill = [['windmill', 0, 0, 0, 1.7], ['sack', 8, 4, 0, 2.4], ['sack', 10, 6, 0.6, 2.4], ['cart', -9, 6, 0.4, 2.6]];
PARTS.granary = [['house3', 0, 0, 0, 1.75], ['barrel', 8, 5, 0, 2.5], ['barrel', 10, 7, 0.5, 2.5], ['sack', -8, 6, 0, 2.5], ['sack', -10, 4, 1, 2.5]];
PARTS.warehouse = [['house5', 0, 0, Math.PI, 1.7], ['crate', 9, 4, 0.3, 2.8], ['crate2', 9, 4, 0.3, 2.8], ['crate', -9, 5, 0, 2.8], ['cart', 0, 11, 0.2, 2.8]];
PARTS.sawmill = [['house5', 0, -2, 0, 1.35], ['logs', 8, 5, 0.3, 3.2], ['logs', 10, 8, 1.2, 3.2], ['res:wood', -9, 5, 0, 1.2], ['res:wood', -12, 8, 1, 1.0], ['cart', -2, 10, 0.5, 2.6]];
PARTS.quarry = [['pit:', 0, 4, 0, 1], ['res:stone', -6, 6, 0.3, 1.5], ['res:stone', 7, 3, 1, 1.3], ['res:rock', 3, 11, 0, 1.2], ['cart', -9, 11, 0.5, 2.6], ['crate', 9, 10, 0, 2.4]];
PARTS.mine = [['res:cliff', 0, -2, 0, 1.7], ['adit:', 0, 5, 0, 1.2], ['res:metal', 8, 6, 0.4, 1.4], ['cart', -7, 10, 0.5, 2.6], ['crate', 8, 11, 0, 2.4]];
PARTS.goldmine = [['res:cliff', 0, -2, 0, 1.7], ['adit:', 0, 5, 0, 1.2], ['res:gold', 8, 6, 0.4, 1.4], ['cart', -7, 10, 0.5, 2.6], ['sack', 8, 11, 0, 2.4]];

export class City {
  constructor(game) {
    this.game = game;
    this.sm = game.sm;
    this.scene = game.sm.cityScene;
    this.slots = SLOTS[MAP.orient] || SLOTS.landscape;
    this.b = {};          // id → { x, z, group, site, label }
    this.selected = null;
    const P = MAP.orient === 'portrait';
    this.bounds = P ? { minX: -26, maxX: 26, minZ: -72, maxZ: 168 } : { minX: -64, maxX: 64, minZ: -36, maxZ: 112 };
    this.zone = 'army';
    this.fields = {};
  }

  build() {
    const sm = this.sm, sc = this.scene, R = rng(21);
    // sol : prairie, place pavée au centre, routes vers chaque bâtiment
    const size = 480, seg = 192;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), grass = new THREE.Color(0x70a846), grass2 = new THREE.Color(0x5f9642), stone = new THREE.Color(0xbab3a4), road = new THREE.Color(0xb59a6e), rock = new THREE.Color(0x8d9088);
    const slots = Object.values(this.slots);
    const bx = this.bounds;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = Math.sin(x * 0.19 + z * 0.07) * Math.cos(z * 0.15 - x * 0.09);
      const out = Math.max(0, Math.abs(x) - (bx.maxX + 14), z - (bx.maxZ + 12), (bx.minZ - 14) - z);
      pos.setY(i, out > 0 ? Math.min(18, out * 0.3) : 0);
      c.copy(n > 0 ? grass : grass2);
      if (out > 0) c.lerp(rock, Math.min(0.8, out * 0.05));
      // routes : axe central + liaisons
      let onRoad = Math.abs(x) < 2.4 && z > bx.minZ - 6 && z < bx.maxZ - 4;
      for (const [sx, sz] of slots) if (Math.abs(z - (sz + 9)) < 1.5 && Math.abs(x) < Math.abs(sx) + 1 && ((sx > 0 && x > 0) || (sx < 0 && x < 0))) onRoad = true;
      if (onRoad) c.lerp(road, 0.85);
      if (Math.hypot(x, z) < 11) c.copy(stone).lerp(road, 0.2 + 0.1 * n);
      const j = 0.95 + R() * 0.1;
      col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, sm.matCity.ground);
    ground.receiveShadow = true;
    sc.add(ground);
    // place centrale : puits et bannières
    sm.model('well', { x: 0, z: 0, scale: 3, shadow: true, scene: sc });
    sm.model('campfire', { x: 5, z: 3, scale: 2.2, scene: sc });
    // forêt autour
    const pts = [];
    for (let i = 0; i < 260; i++) {
      const x = (R() - 0.5) * 2 * (bx.maxX + 70), z = bx.minZ - 60 + R() * (bx.maxZ - bx.minZ + 120);
      if (Math.abs(x) < bx.maxX + 8 && z > bx.minZ - 8 && z < bx.maxZ + 6) continue;
      pts.push([x, z]);
    }
    const trees = new THREE.InstancedMesh(sm.resGeo.wood, sm.matCity.units, pts.length);
    const o = new THREE.Object3D();
    pts.forEach(([x, z], i) => {
      const out = Math.max(0, Math.abs(x) - (bx.maxX + 14), z - (bx.maxZ + 12), (bx.minZ - 14) - z);
      o.position.set(x, Math.min(18, out * 0.3) + 0.2, z); o.rotation.y = R() * 6; o.scale.setScalar(1.2 + R() * 1.1); o.updateMatrix();
      trees.setMatrixAt(i, o.matrix);
    });
    trees.frustumCulled = false;
    sc.add(trees);
    // porte nord : retour vers la carte
    const gx = 0, gz = bx.minZ - 3;
    sm.model('wall_arch', { x: gx, z: gz, rotY: Math.PI, scale: 0.95, shadow: true, scene: sc });
    this.gate = { x: gx, z: gz };
    // bâtiments
    const siteGeo = sm.resGeo.site;
    for (const [id, [x, z]] of Object.entries(this.slots)) {
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);
      for (const [name, dx, dz, ry, s] of PARTS[id]) {
        const [kind, key] = name.includes(':') || name.includes('res:') ? name.split(':') : ['', name];
        let geo = sm.models[name], mat = sm.matCity.medieval;
        if (kind === 'res') { geo = sm.resGeo[key]; mat = sm.matCity.units; }
        else if (kind === 'field') { geo = this.fields[key] || (this.fields[key] = makeField(key === 'wheat' ? { h: 0.55, a: 0xd8b24a, b: 0xc79a36 } : { h: 0.45, a: 0x4f9a3a, b: 0x63ad45 })); mat = sm.matCity.units; }
        else if (kind === 'pit') { geo = this.pitGeo || (this.pitGeo = makePit()); mat = sm.matCity.units; }
        else if (kind === 'adit') { geo = this.aditGeo || (this.aditGeo = makeAdit()); mat = sm.matCity.units; }
        const m = new THREE.Mesh(geo, mat);
        m.position.set(dx, 0, dz); m.rotation.y = ry; m.scale.setScalar(s);
        m.castShadow = true; m.receiveShadow = true;
        grp.add(m);
      }
      sc.add(grp);
      // chantier : terrain nu + panneau tant que le bâtiment n'est pas construit
      const site = new THREE.Group();
      site.position.set(x, 0, z);
      const plot = new THREE.Mesh(siteGeo, sm.matCity.units); plot.scale.set(5, 1, 5); plot.position.y = 0.05; site.add(plot);
      const crate = new THREE.Mesh(sm.models.crate2, sm.matCity.medieval); crate.scale.setScalar(2.6); crate.position.set(-4, 0, 3); crate.castShadow = true; site.add(crate);
      const logs = new THREE.Mesh(sm.models.logs, sm.matCity.medieval); logs.scale.setScalar(3); logs.position.set(4, 0, 4); logs.rotation.y = 0.6; logs.castShadow = true; site.add(logs);
      sc.add(site);
      this.b[id] = { id, x, z, group: grp, site, level: -1 };
    }
    // anneau de sélection
    const ring = new THREE.Mesh(new THREE.RingGeometry(9.5, 11, 40), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; ring.visible = false;
    sc.add(ring);
    this.ring = ring;
    this.buildLabels();
    this.buildLife();
  }

  // villageois, animaux et fumées : instanciés, animés seulement quand la ville est affichée
  buildLife() {
    const sm = this.sm, sc = this.scene;
    const mk = (geo, mat, n, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = shadow; m.count = 0; sc.add(m); return m; };
    this.vill = mk(sm.unitGeo.cultivator, sm.matCity.units, 60);
    this.sheep = mk(makeSheep(), sm.matCity.units, 24);
    this.cows = mk(makeCow(), sm.matCity.units, 10);
    this.smoke = mk(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: 0xcfd2d4, transparent: true, opacity: 0.55, depthWrite: false }), 48, false);
    this.fire = new THREE.PointLight(0xff8a3a, 0, 22);
    this.fire.position.set(0, 3, 0);
    sc.add(this.fire);
    this.animals = []; this.vstate = []; this.puffs = [];
    this._o = new THREE.Object3D();
  }

  // point de dépôt d'une ressource : grenier (nourriture), entrepôt (le reste) ou Maisons
  dropPoint(res) {
    const P = this.game.production, id = res === 'food' ? 'granary' : 'warehouse';
    const b = this.b[P.level(id) > 0 ? id : 'quarters'];
    return { x: b.x + 8, z: b.z + 9 };
  }

  updateLife(time, dt) {
    const P = this.game.production, o = this._o;
    // --- animaux : leur nombre dépend du niveau de la ferme
    const fl = P.level('farm'), fb = this.b.farm;
    const wantS = fl ? 2 + fl * 2 : 0, wantC = fl ? Math.min(6, fl + 1) : 0;
    while (this.animals.filter(a => a.k === 's').length < wantS) this.animals.push({ k: 's', x: fb.x + (Math.random() - 0.5) * 20, z: fb.z + 16 + Math.random() * 6, tx: 0, tz: 0, w: 0 });
    while (this.animals.filter(a => a.k === 'c').length < wantC) this.animals.push({ k: 'c', x: fb.x + (Math.random() - 0.5) * 20, z: fb.z + 20 + Math.random() * 6, tx: 0, tz: 0, w: 0 });
    let si = 0, ci = 0;
    for (const a of this.animals) {
      a.w -= dt;
      if (a.w <= 0) { a.tx = fb.x + (Math.random() - 0.5) * 26; a.tz = fb.z + 15 + Math.random() * 10; a.w = 2 + Math.random() * 5; a.rot = a.rot || 0; }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { a.x += dx / d * dt * 0.9; a.z += dz / d * dt * 0.9; a.rot = Math.atan2(-dz, dx); }
      o.position.set(a.x, 0.05 + Math.abs(Math.sin(time * 5 + a.x)) * (d > 0.3 ? 0.05 : 0), a.z); o.rotation.set(0, a.rot || 0, 0); o.scale.setScalar(a.k === 's' ? 1.3 : 1.2); o.updateMatrix();
      if (a.k === 's') this.sheep.setMatrixAt(si++, o.matrix); else this.cows.setMatrixAt(ci++, o.matrix);
    }
    this.sheep.count = si; this.cows.count = ci;
    this.sheep.instanceMatrix.needsUpdate = this.cows.instanceMatrix.needsUpdate = true;

    // --- villageois : un par travailleur affecté + les villageois libres qui flânent
    const list = [];
    for (const id of Object.keys(JOBS)) for (let k = 0; k < P.jobCount(id); k++) list.push({ id, k });
    for (let k = 0; k < P.idle(); k++) list.push({ id: 'idle', k });
    const n = Math.min(60, list.length);
    for (let i = 0; i < n; i++) {
      const v = list[i], st = this.vstate[i] || (this.vstate[i] = { ph: Math.random(), wx: 0, wz: 0, wt: 0, x: 0, z: 0, rot: 0 });
      let x, z, rot = st.rot, work = 0, carry = 0;
      if (v.id === 'idle') {
        const q = this.b.quarters;
        if (!st.x) { st.x = q.x + 4; st.z = q.z + 10; }
        st.wt -= dt;
        if (st.wt <= 0) { st.wx = q.x + (Math.random() - 0.5) * 22; st.wz = q.z + 8 + Math.random() * 10; st.wt = 3 + Math.random() * 5; }
        const dx = st.wx - st.x, dz = st.wz - st.z, d = Math.hypot(dx, dz);
        if (d > 0.4) { st.x += dx / d * dt * 2; st.z += dz / d * dt * 2; rot = Math.atan2(dx, dz); }
        x = st.x; z = st.z;
      } else {
        const b = this.b[v.id], J = JOBS[v.id], dp = this.dropPoint(J.res);
        // poste de travail : champ, tas de bois, fosse, galerie
        const sx = b.x + (v.id === 'farm' ? (v.k % 2 ? 12 : -12) + (v.k % 3 - 1) * 2 : (v.k % 3 - 1) * 3.2), sz = b.z + (v.id === 'farm' ? 10 + (v.k % 3 - 1) * 2.4 : 8 + Math.floor(v.k / 3) * 2.2);
        st.ph = (st.ph + dt / 11) % 1;
        const p = st.ph;
        if (p < 0.55) { x = sx; z = sz; work = 1; rot = Math.PI * (v.id === 'farm' ? 0.5 : 0); }
        else {
          let t, from, to;
          if (p < 0.75) { t = (p - 0.55) / 0.2; from = { x: sx, z: sz }; to = dp; carry = 1; }
          else if (p < 0.8) { t = 1; from = to = dp; }
          else { t = (p - 0.8) / 0.2; from = dp; to = { x: sx, z: sz }; }
          x = from.x + (to.x - from.x) * t; z = from.z + (to.z - from.z) * t;
          if (from !== to) rot = Math.atan2(to.x - from.x, to.z - from.z);
        }
      }
      st.rot = rot;
      const bob = work ? Math.abs(Math.sin(time * 6 + i)) * 0.14 : (Math.hypot(x - (st.px ?? x), z - (st.pz ?? z)) > 0.001 ? Math.abs(Math.sin(time * 9 + i)) * 0.1 : 0);
      st.px = x; st.pz = z;
      o.position.set(x, bob, z); o.rotation.set(work ? 0.35 * Math.sin(time * 6 + i) : (carry ? 0.15 : 0), rot, 0); o.scale.setScalar(1.45); o.updateMatrix();
      this.vill.setMatrixAt(i, o.matrix);
    }
    this.vill.count = n; this.vill.instanceMatrix.needsUpdate = true;

    // --- fumées : forge, maisons, ferme, scierie, mine
    const emit = ['forge', 'quarters', 'farm', 'sawmill', 'mine', 'workshop', 'goldmine'].filter(id => this.b[id] && this.b[id].level > 0);
    if (emit.length && this.puffs.length < 46 && Math.random() < dt * 14) {
      const e = this.b[emit[(Math.random() * emit.length) | 0]];
      this.puffs.push({ x: e.x + 1.2 + Math.random() * 1.2, y: 8 + Math.random(), z: e.z - 1 + Math.random(), age: 0, life: 3 + Math.random() * 2 });
    }
    let pi = 0;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i]; f.age += dt;
      if (f.age >= f.life) { this.puffs.splice(i, 1); continue; }
    }
    for (const f of this.puffs) {
      const k = f.age / f.life;
      o.position.set(f.x + k * 2.5, f.y + k * 5, f.z); o.rotation.set(0, 0, 0); o.scale.setScalar(0.5 + k * 1.6 * (1 - k * 0.5)); o.updateMatrix();
      this.smoke.setMatrixAt(pi++, o.matrix);
    }
    this.smoke.count = pi; this.smoke.instanceMatrix.needsUpdate = true;
    // lueur de la forge
    const fb2 = this.b.forge;
    if (fb2 && fb2.level > 0) { this.fire.position.set(fb2.x + 6, 3, fb2.z + 6); this.fire.intensity = 55 + Math.sin(time * 17) * 12 + Math.sin(time * 9.3) * 8; } else this.fire.intensity = 0;
  }

  buildLabels() {
    const box = document.getElementById('ug-labels');
    box.innerHTML = '';
    for (const id of Object.keys(this.b)) {
      const d = BUILDINGS[id];
      const el = document.createElement('button');
      el.className = 'clabel';
      el.dataset.b = id;
      el.innerHTML = `<span class="ci">${d.icon}</span><span class="cn">${d.name}</span><span class="cl"></span><i class="cbar"><u></u></i>`;
      el.onclick = e => { e.stopPropagation(); this.game.ui.underground.select(id); };
      box.appendChild(el);
      this.b[id].label = el;
      this.b[id].lvEl = el.querySelector('.cl');
      this.b[id].barEl = el.querySelector('.cbar');
      this.b[id].barFill = el.querySelector('.cbar u');
    }
    const back = document.createElement('button');
    back.className = 'clabel back';
    back.innerHTML = '<span class="ci">⬆</span><span class="cn">Combat</span>';
    back.onclick = e => { e.stopPropagation(); this.game.ui.underground.close(); };
    box.appendChild(back);
    this.backLabel = back;
  }

  // cadre la caméra sur l'Armée ou le Village
  setZone(z) {
    this.zone = z;
    const v = (ZONE_VIEW[MAP.orient] || ZONE_VIEW.landscape)[z], g = this.game.cityCam.goal;
    g.x = 0; g.z = v.z; g.dist = v.dist;
    this.game.cityCam.clampGoal();
    this.select(null);
  }

  select(id) {
    this.selected = id;
    const b = this.b[id];
    this.ring.visible = !!b;
    if (b) this.ring.position.set(b.x, 0.15, b.z);
  }

  // met à jour l'aspect (niveau) et projette les étiquettes
  update(time, dt = 0.016) {
    this.updateLife(time, Math.min(dt, 0.1));
    const P = this.game.production, cam = this.game.cam, tmp = this._t || (this._t = {});
    for (const id in this.b) {
      const b = this.b[id], st = P.buildings[id];
      const lvl = st.level;
      if (b.level !== lvl) {
        b.level = lvl;
        b.group.visible = lvl > 0;
        b.site.visible = lvl === 0;
        b.group.scale.setScalar(1 + 0.045 * Math.max(0, lvl - 1));
      }
      const up = st.upgrade;
      const sig = lvl + ':' + (up ? 1 : 0) + ':' + (P.queues[id]?.length || 0);
      if (b.sig !== sig) {
        b.sig = sig;
        b.lvEl.textContent = lvl ? `Niv. ${lvl}` : 'À construire';
        b.label.classList.toggle('locked', !lvl);
        b.label.classList.toggle('busy', !!up || !!(P.queues[id]?.length) || (id === 'lab' && !!P.research));
      }
      b.barEl.style.display = up ? 'block' : 'none';
      if (up) b.barFill.style.width = `${Math.min(100, up.t / up.total * 100)}%`;
      // chantier : petit rebond pendant la construction
      if (up) b.site.position.y = Math.abs(Math.sin(time * 6)) * 0.08;
      cam.worldToScreen(b.x, 11 + (b.level > 0 ? 3 : -2), b.z, tmp);
      b.label.style.transform = `translate(${tmp.x}px, ${tmp.y}px) translate(-50%, -100%)`;
      b.label.style.display = tmp.visible && ZONE_OF[id] === this.zone ? '' : 'none';
      b.label.classList.toggle('sel', this.selected === id);
    }
    cam.worldToScreen(this.gate.x, 10, this.gate.z, tmp);
    this.backLabel.style.transform = `translate(${tmp.x}px, ${tmp.y}px) translate(-50%, -100%)`;
    this.backLabel.style.display = tmp.visible && this.zone === 'army' ? '' : 'none';
  }

  // toucher dans le décor : bâtiment le plus proche du point visé
  pick(sx, sy) {
    const cam = this.game.cam, tmp = {};
    let best = null, bd = 90;
    for (const id in this.b) {
      if (ZONE_OF[id] !== this.zone) continue;
      const b = this.b[id];
      cam.worldToScreen(b.x, 4, b.z, tmp);
      const d = Math.hypot(tmp.x - sx, tmp.y - sy);
      if (tmp.visible && d < bd) { bd = d; best = id; }
    }
    return best;
  }
}
