// Rendu Three.js : lit l'état de la simulation, ne le modifie jamais. Géométrie provisoire (low-poly basique).
import * as THREE from 'three';
import { W, D, SECTORS, SECTOR_W, SEGS, SEG_W, WALL_Z0, WALL_Z1, CASTLE, GW, GD, CELL, MAX_Z, ARCHER_SLOTS, ARCHER_Z, SECTOR_SHORT } from '../sim/constants.js';
import { T } from '../sim/terrain.js';
import { ZOMBIES, UNITS, SIEGE, BUILDINGS, TASKS, RES_INFO } from '../content/medieval.js';
import { archerPos, formationLayout } from '../sim/army.js';
import { applyNorthFog } from './fog.js';

const lam = (color, opts = {}) => applyNorthFog(new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
const ZSCALE = 2.2, USCALE = 2.6;   // exagération volontaire pour la lisibilité sur petit écran

export class Renderer {
  constructor(canvasParent, sim) {
    this.sim = sim;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x0a0f16);
    canvasParent.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 2, 900);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4030, 1.55));
    const sun = new THREE.DirectionalLight(0xfff1d0, 1.5); sun.position.set(-60, 120, 80); this.scene.add(sun);
    this.dummy = new THREE.Object3D(); this.tmpColor = new THREE.Color();
    this.buildGround(); this.buildTerrainProps(); this.buildWall(); this.buildCastle(); this.buildEconomy(); this.buildUnits(); this.buildSiege(); this.buildHighlight();
    this.selected = -1; this.clock = 0; this.selSquad = 0; this.targetMode = false; this.tmpC2 = new THREE.Color(); this.white = new THREE.Color(1, 1, 1);
  }
  resize(w, h) { this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  buildGround() {
    const k = 3, cv = document.createElement('canvas'); cv.width = W * k; cv.height = D * k; const g = cv.getContext('2d');
    const band = (z0, z1, c) => { g.fillStyle = c; g.fillRect(0, z0 * k, W * k, (z1 - z0) * k); };
    band(0, 30, '#3b4a34'); band(30, 90, '#5b7a45'); band(90, WALL_Z0, '#86975a');      // spawn, approche, champ de bataille
    band(WALL_Z0, WALL_Z1, '#6a645c');
    band(WALL_Z1, 200, '#6e7a60'); band(200, 270, '#6f9a4e'); band(270, D, '#7e8a6a');  // militaire, village, château
    const type = this.sim.terrain.type, pal = { [T.FOREST]: '#2f5a33', [T.HILL]: '#a2a763', [T.ROCK]: '#6b6e72', [T.ROAD]: '#b49a6c' };
    for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) { const t = type[gz * GW + gx]; if (t && pal[t]) { g.fillStyle = pal[t]; g.fillRect(gx * CELL * k, gz * CELL * k, CELL * k + 1, CELL * k + 1); } }
    // repères de secteurs sur le glacis et la zone militaire
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.5; g.setLineDash([8, 8]);
    for (let s = 1; s < SECTORS; s++) { g.beginPath(); g.moveTo(s * SECTOR_W * k, 90 * k); g.lineTo(s * SECTOR_W * k, 200 * k); g.stroke(); }
    g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.35)'; g.font = `bold ${7 * k}px sans-serif`; g.textAlign = 'center';
    for (let s = 0; s < SECTORS; s++) g.fillText(SECTOR_SHORT[s], (s + .5) * SECTOR_W * k, 126 * k);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, D), applyNorthFog(new THREE.MeshLambertMaterial({ map: tex })));
    m.rotation.x = -Math.PI / 2; m.position.set(W / 2, 0, D / 2); this.scene.add(m);
  }
  buildTerrainProps() {
    const type = this.sim.terrain.type, rock = [], tree = [];
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) {
      const t = type[gz * GW + gx], x = (gx + .5) * CELL, z = (gz + .5) * CELL;
      if (t === T.ROCK) rock.push([x, z, 1.6 + r() * 1.4]);
      else if (t === T.FOREST && r() < 0.55) tree.push([x + (r() - .5) * 1.6, z + (r() - .5) * 1.6, 2.2 + r() * 1.6]);
    }
    const mk = (geo, mat, list, yOff) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); im.count = list.length;
      list.forEach(([x, z, s], i) => { this.dummy.position.set(x, s * yOff, z); this.dummy.scale.set(s, s, s); this.dummy.rotation.y = i; this.dummy.updateMatrix(); im.setMatrixAt(i, this.dummy.matrix); });
      im.instanceMatrix.needsUpdate = true; this.scene.add(im); return im;
    };
    mk(new THREE.DodecahedronGeometry(1, 0), lam(0x808488), rock, 0.55);
    mk(new THREE.ConeGeometry(0.9, 2.4, 5), lam(0x2c6a34), tree, 0.5);
  }
  buildWall() {
    this.wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(SEG_W - 0.25, 4, 8), lam(0xffffff), SEGS);
    this.wallMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SEGS * 3), 3);
    this.scene.add(this.wallMesh);
    const tw = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 8, 10), lam(0x8c8f96), SECTORS + 1);
    for (let i = 0; i <= SECTORS; i++) { this.dummy.position.set(Math.min(W - 3, Math.max(3, i * SECTOR_W)), 4, 146); this.dummy.scale.set(1, 1, 1); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix(); tw.setMatrixAt(i, this.dummy.matrix); }
    this.scene.add(tw); this.towers = tw;
  }
  updateWall() {
    if (this.kitWalls) return this.updateKitWall();
    const wall = this.sim.wall, c = this.tmpColor;
    for (let i = 0; i < SEGS; i++) {
      const hpR = wall.hp[i] / wall.segMax(i), breached = wall.hp[i] <= 0;
      const lvl = wall.level[wall.sectorOf(i)];
      this.dummy.position.set(i * SEG_W + SEG_W / 2, breached ? 0.45 : 2, 146); this.dummy.scale.set(1, breached ? 0.22 : 1, 1); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix();
      this.wallMesh.setMatrixAt(i, this.dummy.matrix);
      if (breached) c.setRGB(0.25, 0.16, 0.14);
      else { c.setRGB(0.55 + 0.1 * lvl, 0.55 + 0.1 * lvl, 0.58 + 0.08 * lvl); if (wall.isGate(i)) c.setRGB(0.55, 0.36, 0.2); const dmg = 1 - hpR; c.lerp(this.tmpColor2 || (this.tmpColor2 = new THREE.Color(0.85, 0.18, 0.1)), dmg * 0.9); }
      this.wallMesh.setColorAt(i, c);
    }
    this.wallMesh.instanceMatrix.needsUpdate = true; this.wallMesh.instanceColor.needsUpdate = true;
  }
  buildCastle() {
    const g = new THREE.Group(), m = lam(0xa49d8e);
    const keep = new THREE.Mesh(new THREE.BoxGeometry(34, 16, 18), m); keep.position.set(CASTLE.x, 8, CASTLE.z); g.add(keep);
    for (const [dx, dz] of [[-19, -10], [19, -10], [-19, 10], [19, 10]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 22, 8), lam(0x8d877b)); t.position.set(CASTLE.x + dx, 11, CASTLE.z + dz); g.add(t); }
    this.scene.add(g); this.keepBoxes = g;
  }
  buildEconomy() {
    this.bMesh = {};
    for (const id in BUILDINGS) {
      const B = BUILDINGS[id], g = new THREE.BoxGeometry(...B.size); g.translate(0, B.size[1] / 2, 0);
      const m = new THREE.Mesh(g, lam(B.color)); m.position.set(B.pos.x, 0, B.pos.z); this.scene.add(m);
      const ghost = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false })); ghost.position.copy(m.position); this.scene.add(ghost);
      this.bMesh[id] = { m, ghost };
    }
    // points de récolte (gisements) : pastilles colorées au sol
    for (const t in TASKS) {
      const T = TASKS[t]; if (!T.res) continue;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.3, 14), new THREE.MeshBasicMaterial({ color: RES_INFO[T.res].color, transparent: true, opacity: 0.55 }));
      d.position.set(T.site.x, 0.2, T.site.z); this.scene.add(d);
    }
    const vg = new THREE.BoxGeometry(0.7, 1.5, 0.7); vg.translate(0, 0.75, 0);
    this.vMesh = new THREE.InstancedMesh(vg, lam(0xffffff), 160); this.vMesh.frustumCulled = false; this.vMesh.count = 0;
    this.vMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3), 3); this.scene.add(this.vMesh);
    const cg = new THREE.BoxGeometry(0.7, 0.7, 0.7); this.cMesh = new THREE.InstancedMesh(cg, lam(0xffffff), 160); this.cMesh.frustumCulled = false; this.cMesh.count = 0;
    this.cMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3), 3); this.scene.add(this.cMesh);
    this.vCol = { idle: new THREE.Color(0xd8b48a), repair: new THREE.Color(0xe67e22) };
  }
  updateEconomy(alpha) {
    const E = this.sim.eco, d = this.dummy;
    for (const id in this.bMesh) {
      const lv = E.level[id], { m, ghost } = this.bMesh[id];
      m.visible = lv > 0 && !this.bMesh[id].kit; ghost.visible = lv === 0; m.scale.y = 1 + 0.12 * (lv - 1);
    }
    if (this.kit) this.updateKitEconomy();
    const vs = E.villagers, VS = 2.8; this.vMesh.count = vs.length; let nc = 0;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], x = v.px + (v.x - v.px) * alpha, z = v.pz + (v.z - v.pz) * alpha;
      d.position.set(x, 0, z); d.scale.set(VS * 0.8, VS, VS * 0.8); d.rotation.set(0, 0, 0); d.updateMatrix(); this.vMesh.setMatrixAt(i, d.matrix);
      this.vMesh.setColorAt(i, v.task === 'repair' ? this.vCol.repair : this.vCol.idle);
      if (v.carry > 0) {                                  // charge portée : cube coloré selon la ressource
        d.position.set(x, 4.6, z); d.scale.set(1.8, 1.8, 1.8); d.updateMatrix(); this.cMesh.setMatrixAt(nc, d.matrix);
        this.tmpColor.setHex(RES_INFO[v.carryRes].color); this.cMesh.setColorAt(nc, this.tmpColor); nc++;
      }
    }
    this.cMesh.count = nc;
    this.vMesh.instanceMatrix.needsUpdate = true; this.vMesh.instanceColor.needsUpdate = true;
    this.cMesh.instanceMatrix.needsUpdate = true; this.cMesh.instanceColor.needsUpdate = true;
  }
  buildUnits() {
    const box = new THREE.BoxGeometry(0.8, 1.7, 0.8); box.translate(0, 0.85, 0);
    const inst = (geo, color, cap) => { const im = new THREE.InstancedMesh(geo, lam(color), cap); im.frustumCulled = false; im.count = 0; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.scene.add(im); return im; };
    this.zMesh = inst(box, 0xffffff, MAX_Z);
    this.sMesh = inst(box, 0xffffff, 900); this.aMesh = inst(box, 0xffffff, SECTORS * ARCHER_SLOTS + 4);
    const ar = new THREE.BoxGeometry(0.16, 0.16, 1.6); this.arMesh = inst(ar, 0xffffff, 256);
    this.zCol = ZOMBIES.map(z => new THREE.Color(z.color));
  }
  buildSiege() {
    const inst = (geo, cap) => { const im = new THREE.InstancedMesh(geo, lam(0xffffff), cap); im.frustumCulled = false; im.count = 0; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.scene.add(im); return im; };
    const base = new THREE.BoxGeometry(3, 1.6, 4); base.translate(0, 0.8, 0); const arm = new THREE.BoxGeometry(0.5, 0.5, 4.5); arm.translate(0, 0, -2);
    this.wBase = inst(base, 24); this.wArm = inst(arm, 24);
    const ball = new THREE.SphereGeometry(0.6, 6, 5); this.pMesh = inst(ball, 64);
    const disc = new THREE.CylinderGeometry(1, 1, 0.2, 14); this.iMesh = inst(disc, 40);
  }
  updateSiege(alpha) {
    const S = this.sim.siege, d = this.dummy, c = this.tmpColor; let n = 0;
    for (const w of S.weapons) {
      const D = SIEGE[w.type], sc = D.size * 1.8, recoil = Math.max(0, w.rec) / 0.35;
      d.position.set(w.x, 0, w.z); d.scale.set(sc, sc, sc); d.rotation.set(0, 0, 0); d.updateMatrix(); this.wBase.setMatrixAt(n, d.matrix);
      c.setHex(D.color); if (w.noAmmo) c.lerp(this.tmpC2.setRGB(0.9, 0.15, 0.1), 0.6); this.wBase.setColorAt(n, c);
      d.position.set(w.x, 1.8 * sc, w.z - 1 * sc); d.scale.set(sc, sc, sc); d.rotation.set(-0.7 + recoil * 0.9, 0, 0); d.updateMatrix(); this.wArm.setMatrixAt(n, d.matrix);
      this.wArm.setColorAt(n, c.setHex(0x3a2a18)); n++;
    }
    this.wBase.count = this.wArm.count = n; for (const m of [this.wBase, this.wArm]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    n = 0;
    for (const p of S.shots) {
      if (n >= 64) break; const f = Math.min(1, p.t / p.dur), x = p.x0 + (p.x1 - p.x0) * f, z = p.z0 + (p.z1 - p.z0) * f, arc = p.type === 'ballista' ? 3 : 14;
      d.position.set(x, 3 + arc * Math.sin(Math.PI * f), z); const k = p.type === 'trebuchet' ? 1.8 : p.type === 'catapult' ? 1.3 : 0.7; d.scale.set(k, k, k); d.rotation.set(0, 0, 0); d.updateMatrix(); this.pMesh.setMatrixAt(n, d.matrix);
      this.pMesh.setColorAt(n, c.setHex(p.type === 'ballista' ? 0xf5e6b0 : 0x6d6d70)); n++;
    }
    this.pMesh.count = n; this.pMesh.instanceMatrix.needsUpdate = true; this.pMesh.instanceColor.needsUpdate = true;
    n = 0;
    for (const im of S.impacts) {
      if (n >= 40) break; const f = im.t / 0.5, r = im.r * (0.5 + 0.7 * f);
      d.position.set(im.x, 0.3, im.z); d.scale.set(r, 1, r * (1 - 0.3 * f)); d.rotation.set(0, 0, 0); d.updateMatrix(); this.iMesh.setMatrixAt(n, d.matrix);
      this.iMesh.setColorAt(n, c.setRGB(1, 0.55 - 0.3 * f, 0.15)); n++;
    }
    this.iMesh.count = n; this.iMesh.instanceMatrix.needsUpdate = true; this.iMesh.instanceColor.needsUpdate = true;
  }
  buildHighlight() {
    this.hl = new THREE.Mesh(new THREE.PlaneGeometry(SECTOR_W, 60), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, depthWrite: false }));
    this.hl.rotation.x = -Math.PI / 2; this.hl.position.y = 0.2; this.hl.visible = false; this.scene.add(this.hl);
    const ringGeo = new THREE.RingGeometry(0.88, 1, 32); ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false })); this.ring.visible = false; this.scene.add(this.ring);
    const mg = new THREE.RingGeometry(2.2, 3.2, 24); mg.rotateX(-Math.PI / 2);
    this.mark = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.9, depthWrite: false })); this.mark.visible = false; this.scene.add(this.mark);
    this.targeting = new THREE.Mesh(new THREE.PlaneGeometry(W - 8, 52), new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.13, depthWrite: false }));
    this.targeting.rotation.x = -Math.PI / 2; this.targeting.position.set(W / 2, 0.15, 114); this.targeting.visible = false; this.scene.add(this.targeting);
    this.threat = [];
    for (let s = 0; s < SECTORS; s++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SECTOR_W - 1, 10), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(s * SECTOR_W + SECTOR_W / 2, 0.3, 136); this.scene.add(m); this.threat.push(m);
    }
  }
  // ——— décor issu du kit (assets/world) : remplace les boîtes provisoires quand il est chargé ———
  useKit(kit) {
    this.kit = kit; const d = this.dummy, geo = kit.geo;
    const mk = (name, cap) => { const im = new THREE.InstancedMesh(geo[name], kit.material, cap); im.frustumCulled = false; im.count = 0; this.scene.add(im); return im; };
    const put = (im, i, x, z, ry, sx, sy, sz, y = 0) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); im.setMatrixAt(i, d.matrix); };
    // muraille : variantes de tronçons (la porte utilise le tronçon à escalier), 5 m de long, épaisseur 6 m
    this.wallMesh.visible = false; this.towers.visible = false; this.keepBoxes.visible = false;
    this.kw = { Wall1: mk('Wall1', SEGS), Wall2: mk('Wall2', SEGS), Wall3: mk('Wall3', SEGS), Wall4: mk('Wall4', 4) };
    this.kitWalls = true; this.put = put;
    const tw = [mk('Tower1', 2), mk('Tower2', 6)]; let a = 0, b = 0;
    for (let i = 0; i <= SECTORS; i++) { const x = Math.min(W - 3, Math.max(3, i * SECTOR_W)); if (i === 0 || i === SECTORS) put(tw[0], a++, x, 146, 0, 1.15, 1.15, 1.15); else put(tw[1], b++, x, 146, 0, 1.1, 1.1, 1.1); }
    tw[0].count = a; tw[1].count = b; for (const t of tw) t.instanceMatrix.needsUpdate = true;
    // château (orientation : façade vers le sud, côté village)
    const castle = new THREE.Mesh(geo.Castle, kit.material); castle.position.set(CASTLE.x, 0, CASTLE.z); castle.scale.setScalar(0.8); this.scene.add(castle); this.castleKit = castle;
    // maisons de population : une instance par maison construite
    this.houseTypes = ['House1', 'House2', 'House3', 'House4', 'House5']; this.hm = this.houseTypes.map(n => mk(n, 64));
    const slots = []; for (const z of [214, 224, 233]) for (let x = 14; x <= 186; x += 9.2) if (Math.abs(x - 100) > 9) slots.push({ x, z });
    slots.sort((p, q) => (Math.abs(p.x - 100) + Math.abs(p.z - 224) * 1.4) - (Math.abs(q.x - 100) + Math.abs(q.z - 224) * 1.4));
    this.houseSlots = slots.slice(0, 60).map((p, i) => ({ ...p, t: (i * 7 + ((i / 5) | 0)) % 5, ry: (((i * 37) % 11) - 5) * 0.03 })); this.houseShown = -1;
    // monuments et décor du village
    const one = (name, x, z, ry, sc) => { const m = new THREE.Mesh(geo[name], kit.material); m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(sc); this.scene.add(m); return m; };
    one('Church', 162, 292, -0.3, 1.0); one('Waterhole2', 80, 240, 0, 2.4); one('Waterhole1', 122, 238, 0, 2.4);
    one('MarketStall1', 82, 280, 0.4, 1.8); one('MarketStall3', 88, 286, -0.3, 1.8); one('MarketStall2', 150, 276, 0.2, 1.5);
    // chariots : un de plus par niveau de l'amélioration « Chariots » (transport)
    this.wagons = [['Wagon3', 111, 277, 0.5], ['Wagon1', 119, 280, -0.4], ['Wagon2', 90, 276, 2.6]].map(([n, x, z, r], k) => { const m = one(n, x, z, r, 1.5); m.visible = false; return m; });
    // petits objets autour des entrepôts (tonneaux, caisses, sacs, bancs)
    const props = [['Item18', 128, 279], ['Item19', 130, 280.5], ['Item16', 140, 279], ['Item20', 142, 277.5], ['Item21', 138, 281], ['Item11', 60, 276], ['Item19', 70, 277], ['Item18', 72, 278.5], ['Item10', 44, 268], ['Item12', 36, 270], ['Item17', 34, 262], ['Item6', 56, 279], ['Item8', 64, 280]];
    const pm = {}; for (const [n, x, z] of props) (pm[n] ||= []).push([x, z]);
    for (const n in pm) { const im = mk(n, pm[n].length); pm[n].forEach(([x, z], i) => put(im, i, x, z, i * 1.7, 2.4, 2.4, 2.4)); im.count = pm[n].length; im.instanceMatrix.needsUpdate = true; }
    // bâtiments d'économie à modèle : moulin, entrepôt, grenier
    this.kitB = {};
    for (const [id, name, sc] of [['mill', 'Windmill', 1.5], ['warehouse', 'House4', 1.15], ['granary', 'House5', 1.2]]) {
      const B = BUILDINGS[id], m = new THREE.Mesh(geo[name], kit.material); m.position.set(B.pos.x, 0, B.pos.z); m.scale.setScalar(sc); m.visible = false; this.scene.add(m); this.kitB[id] = m; this.bMesh[id].m.visible = false; this.bMesh[id].kit = true;
    }
  }
  updateKitWall() {
    const wall = this.sim.wall, d = this.dummy, c = this.tmpColor, cnt = { Wall1: 0, Wall2: 0, Wall3: 0, Wall4: 0 };
    for (let i = 0; i < SEGS; i++) {
      const hpR = wall.hp[i] / wall.segMax(i), breached = wall.hp[i] <= 0, lvl = wall.level[wall.sectorOf(i)], gate = wall.isGate(i);
      const type = gate ? 'Wall4' : ['Wall1', 'Wall2', 'Wall3'][i % 3], im = this.kw[type], k = cnt[type]++;
      this.put(im, k, i * SEG_W + SEG_W / 2, 146, Math.PI / 2, 1.45, breached ? 0.28 : 1.12 + 0.03 * lvl, 0.64);
      if (breached) c.setRGB(0.35, 0.25, 0.22); else { c.setRGB(1, 1, 1); c.lerp(this.tmpC2.setRGB(1, 0.35, 0.25), (1 - hpR) * 0.85); }
      im.setColorAt(k, c);
    }
    for (const t in this.kw) { const im = this.kw[t]; im.count = cnt[t]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  updateKitEconomy() {
    const E = this.sim.eco;
    if (E.houses !== this.houseShown) {
      this.houseShown = E.houses; const n = Math.min(E.houses, this.houseSlots.length), cn = [0, 0, 0, 0, 0];
      for (let i = 0; i < n; i++) { const h = this.houseSlots[i]; this.put(this.hm[h.t], cn[h.t]++, h.x, h.z, h.ry, 1, 1, 1); }
      this.hm.forEach((im, t) => { im.count = cn[t]; im.instanceMatrix.needsUpdate = true; });
    }
    for (const id in this.kitB) { const lv = E.level[id]; this.kitB[id].visible = lv > 0; this.kitB[id].scale.y = this.kitB[id].scale.x * (1 + 0.06 * (lv - 1)); }
    this.wagons.forEach((w, k) => { w.visible = E.up.carts > k; });
  }
  setSquad(id) { this.selSquad = id || 0; }
  setTargeting(on) { this.targetMode = on; }
  setSelected(s) { this.selected = s; this.hl.visible = s >= 0; if (s >= 0) this.hl.position.set(s * SECTOR_W + SECTOR_W / 2, 0.2, 112); }

  render(alpha, dtReal) {
    const sim = this.sim, Z = sim.zombies, d = this.dummy; this.clock += dtReal;
    // zombies (interpolés)
    const zm = this.zMesh, ma = zm.instanceMatrix.array, ca = zm.instanceColor.array, n = Z.n;
    for (let i = 0; i < n; i++) {
      const t = Z.type[i], sc = ZOMBIES[t].size * ZSCALE, x = Z.px[i] + (Z.x[i] - Z.px[i]) * alpha, z = Z.pz[i] + (Z.z[i] - Z.pz[i]) * alpha;
      const bob = 1 + 0.08 * Math.sin(this.clock * 9 + Z.phase[i]), o = i * 16;
      ma[o] = sc * 0.8; ma[o + 5] = sc * bob; ma[o + 10] = sc * 0.8; ma[o + 15] = 1; ma[o + 12] = x; ma[o + 13] = Z.state[i] === 1 ? 0.05 : 0; ma[o + 14] = z;
      ma[o + 1] = ma[o + 2] = ma[o + 3] = ma[o + 4] = ma[o + 6] = ma[o + 7] = ma[o + 8] = ma[o + 9] = ma[o + 11] = 0;
      const c = this.zCol[t], hurt = Z.hp[i] / ZOMBIES[t].hp < 0.5 ? 0.75 : 1; ca[i * 3] = c.r * hurt; ca[i * 3 + 1] = c.g * hurt; ca[i * 3 + 2] = c.b * hurt;
    }
    zm.count = n; zm.instanceMatrix.needsUpdate = true; zm.instanceColor.needsUpdate = true;
    // escouades : chaque membre est dessiné selon la formation (la simulation ne connaît que l'escouade)
    let si = 0; const sm = this.sMesh, sel = this.selSquad;
    for (const q of sim.army.squads) {
      const U = UNITS[q.type], L = formationLayout(q.form, Math.max(1, q.n), U.size), cx = q.px + (q.x - q.px) * alpha, cz = q.pz + (q.z - q.pz) * alpha;
      const sc = USCALE * U.size, flash = q.hit > 0 ? 0.55 : 0, isSel = q.id === sel;
      this.tmpColor.setHex(U.color);
      for (let k = 0; k < q.n && si < 900; k++, si++) {
        const bob = 1 + 0.06 * Math.sin(this.clock * 10 + k * 1.7) * (q.mom > 0.5 ? 1 : 0.3);
        d.position.set(cx + L.xs[k], 0, cz + L.zs[k]); d.scale.set(sc * .8, sc * bob, sc * .8); d.rotation.set(0, 0, 0); d.updateMatrix(); sm.setMatrixAt(si, d.matrix);
        sm.setColorAt(si, this.tmpC2.copy(this.tmpColor).lerp(this.white, flash + (isSel ? 0.25 : 0)));
      }
    }
    sm.count = si; sm.instanceMatrix.needsUpdate = true; if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    // anneau de l'escouade choisie + marqueur de sortie
    const sq = sel ? sim.army.squads.find(q => q.id === sel) : null;
    this.ring.visible = !!sq;
    if (sq) {
      const cx = sq.px + (sq.x - sq.px) * alpha, cz = sq.pz + (sq.z - sq.pz) * alpha, r = sq.rad + 1.5;
      this.ring.position.set(cx, 0.35, cz); this.ring.scale.set(r, r, r);
      this.mark.visible = sq.mode === 'field'; this.mark.position.set(sq.tx, 0.35, sq.tz); const pu = 1 + 0.12 * Math.sin(this.clock * 6); this.mark.scale.set(pu, pu, pu);
    } else this.mark.visible = false;
    this.targeting.visible = this.targetMode;
    // archers (sur le chemin de ronde)
    let ai = 0;
    for (let s = 0; s < SECTORS; s++) for (let k = 0; k < sim.army.archers[s].n; k++) {
      const p = archerPos(s, k); d.position.set(p.x, this.kitWalls ? 4.9 : 4, p.z); d.scale.set(USCALE * .7, USCALE * .9, USCALE * .7); d.rotation.set(0, 0, 0); d.updateMatrix(); this.aMesh.setMatrixAt(ai, d.matrix); this.tmpColor.setRGB(0.18, 0.68, 0.42); this.aMesh.setColorAt(ai, this.tmpColor); ai++;
    }
    this.aMesh.count = ai; this.aMesh.instanceMatrix.needsUpdate = true; if (this.aMesh.instanceColor) this.aMesh.instanceColor.needsUpdate = true;
    // flèches
    const ar = sim.arrows; this.arMesh.count = Math.min(ar.length, 256);
    for (let i = 0; i < this.arMesh.count; i++) {
      const a = ar[i], f = Math.min(1, a.t / 0.3), x = a.x0 + (a.x1 - a.x0) * f, z = a.z0 + (a.z1 - a.z0) * f, y = 4.5 * (1 - f) + 1 + 3 * Math.sin(Math.PI * f);
      d.position.set(x, y, z); d.scale.set(1, 1, 1); d.rotation.set(0, Math.atan2(a.x1 - a.x0, a.z1 - a.z0), 0); d.updateMatrix(); this.arMesh.setMatrixAt(i, d.matrix); this.tmpColor.setRGB(1, 0.95, 0.7); this.arMesh.setColorAt(i, this.tmpColor);
    }
    this.arMesh.instanceMatrix.needsUpdate = true; if (this.arMesh.instanceColor) this.arMesh.instanceColor.needsUpdate = true;
    // alertes de secteur (menace proche / attaque)
    for (let s = 0; s < SECTORS; s++) {
      const dg = sim.danger(s), tgt = sim.phase === 'alert' && sim.targets.includes(s);
      const o = dg === 2 ? 0.28 + 0.12 * Math.sin(this.clock * 8) : dg === 1 ? 0.12 : tgt ? 0.1 + 0.08 * Math.sin(this.clock * 5) : 0;
      this.threat[s].material.opacity = o;
    }
    this.updateWall(); this.updateEconomy(alpha); this.updateSiege(alpha);
    this.renderer.render(this.scene, this.camera);
  }
}
