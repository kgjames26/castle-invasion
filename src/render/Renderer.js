// Rendu Three.js : lit l'état de la simulation, ne le modifie jamais. Géométrie provisoire (low-poly basique).
import * as THREE from 'three';
import { W, D, SECTORS, SECTOR_W, SEGS, SEG_W, WALL_Z0, WALL_Z1, CASTLE, GW, GD, CELL, MAX_Z, ARCHER_SLOTS, ARCHER_Z, SECTOR_SHORT } from '../sim/constants.js';
import { T } from '../sim/terrain.js';
import { ZOMBIES, BUILDINGS, TASKS, RES_INFO } from '../content/medieval.js';
import { archerPos } from '../sim/army.js';
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
    this.buildGround(); this.buildTerrainProps(); this.buildWall(); this.buildCastle(); this.buildEconomy(); this.buildUnits(); this.buildHighlight();
    this.selected = -1; this.clock = 0;
  }
  resize(w, h) { this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  buildGround() {
    const k = 3, cv = document.createElement('canvas'); cv.width = W * k; cv.height = D * k; const g = cv.getContext('2d');
    const band = (z0, z1, c) => { g.fillStyle = c; g.fillRect(0, z0 * k, W * k, (z1 - z0) * k); };
    band(0, 30, '#3b4a34'); band(30, 100, '#5b7a45'); band(100, WALL_Z0, '#8d9a58');      // spawn, approche, glacis
    band(WALL_Z0, WALL_Z1, '#6a645c');
    band(WALL_Z1, 200, '#6e7a60'); band(200, 270, '#6f9a4e'); band(270, D, '#7e8a6a');  // militaire, village, château
    const type = this.sim.terrain.type, pal = { [T.FOREST]: '#2f5a33', [T.HILL]: '#a2a763', [T.ROCK]: '#6b6e72', [T.ROAD]: '#b49a6c' };
    for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) { const t = type[gz * GW + gx]; if (t && pal[t]) { g.fillStyle = pal[t]; g.fillRect(gx * CELL * k, gz * CELL * k, CELL * k + 1, CELL * k + 1); } }
    // repères de secteurs sur le glacis et la zone militaire
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.5; g.setLineDash([8, 8]);
    for (let s = 1; s < SECTORS; s++) { g.beginPath(); g.moveTo(s * SECTOR_W * k, 96 * k); g.lineTo(s * SECTOR_W * k, 200 * k); g.stroke(); }
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
    this.scene.add(tw);
  }
  updateWall() {
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
    this.scene.add(g);
    // repères du royaume (provisoires) : zones militaire / village
    const zone = (x, z, w, d, col) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), lam(col)); b.position.set(x, 1.5, z); this.scene.add(b); };
    zone(30, 175, 18, 12, 0x7a4040); zone(170, 175, 18, 12, 0x7a4040); zone(100, 180, 14, 10, 0x4a5f7a);        // casernes, champ de tir
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
      m.visible = lv > 0; ghost.visible = lv === 0; m.scale.y = 1 + 0.12 * (lv - 1);
    }
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
    this.sMesh = inst(box, 0xffffff, 64); this.aMesh = inst(box, 0xffffff, SECTORS * ARCHER_SLOTS + 4);
    const ar = new THREE.BoxGeometry(0.16, 0.16, 1.6); this.arMesh = inst(ar, 0xffffff, 256);
    this.zCol = ZOMBIES.map(z => new THREE.Color(z.color));
  }
  buildHighlight() {
    this.hl = new THREE.Mesh(new THREE.PlaneGeometry(SECTOR_W, 60), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, depthWrite: false }));
    this.hl.rotation.x = -Math.PI / 2; this.hl.position.y = 0.2; this.hl.visible = false; this.scene.add(this.hl);
    this.threat = [];
    for (let s = 0; s < SECTORS; s++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SECTOR_W - 1, 10), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(s * SECTOR_W + SECTOR_W / 2, 0.3, 136); this.scene.add(m); this.threat.push(m);
    }
  }
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
    // soldats
    const so = sim.army.soldiers; this.sMesh.count = so.length;
    so.forEach((u, i) => { d.position.set(u.px + (u.x - u.px) * alpha, 0, u.pz + (u.z - u.pz) * alpha); d.scale.set(USCALE * .8, USCALE, USCALE * .8); d.rotation.set(0, 0, 0); d.updateMatrix(); this.sMesh.setMatrixAt(i, d.matrix); this.tmpColor.setRGB(u.hit > 0 ? 1 : 0.24, u.hit > 0 ? 0.4 : 0.48, u.hit > 0 ? 0.3 : 0.84); this.sMesh.setColorAt(i, this.tmpColor); });
    this.sMesh.instanceMatrix.needsUpdate = true; if (this.sMesh.instanceColor) this.sMesh.instanceColor.needsUpdate = true;
    // archers (sur le chemin de ronde)
    let ai = 0;
    for (let s = 0; s < SECTORS; s++) for (let k = 0; k < sim.army.archers[s].n; k++) {
      const p = archerPos(s, k); d.position.set(p.x, 4, p.z); d.scale.set(USCALE * .7, USCALE * .9, USCALE * .7); d.rotation.set(0, 0, 0); d.updateMatrix(); this.aMesh.setMatrixAt(ai, d.matrix); this.tmpColor.setRGB(0.18, 0.68, 0.42); this.aMesh.setColorAt(ai, this.tmpColor); ai++;
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
    this.updateWall(); this.updateEconomy(alpha);
    this.renderer.render(this.scene, this.camera);
  }
}
