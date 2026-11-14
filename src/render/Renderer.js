// Rendu Three.js : lit l'état de la simulation, ne le modifie jamais. Géométrie provisoire (low-poly basique).
import * as THREE from 'three';
import { W, D, SECTORS, SECTOR_W, SEGS, SEG_W, WALL_Z0, WALL_Z1, CASTLE, GW, GD, CELL, MAX_Z, ARCHER_SLOTS, ARCHER_Z, SECTOR_SHORT } from '../sim/constants.js';
import { T } from '../sim/terrain.js';
import { ZOMBIES, UNITS, SIEGE, BUILDINGS, TASKS, RES_INFO } from '../content/medieval.js';
import { archerPos, formationLayout } from '../sim/army.js';
import { applyNorthFog } from './fog.js';
import { StructureView } from './Structures.js';
import { buildTroopRigs, buildVillagerRigs, throwAngle, toolGeometry, hatGeometry } from './Troops.js';
const ZVAR = [[0, 3, 5], [2, 4], [1, 5], [1], [0, 4], [1]];      // variantes de modèle par type de zombie
const VTINT = { wood: 0xd9b27a, stone: 0xc3c8cd, iron: 0xa6b4d6, gold: 0xf2d65e, food: 0xb9e08c, repair: 0xff9a4a };

const lam = (color, opts = {}) => applyNorthFog(new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
const ZSCALE = 1.45, USCALE = 1.75;   // personnages à l'échelle des bâtiments (v3.1 : réduits d'environ 35 % pour éviter l'effet « maquette »)

export class Renderer {
  constructor(canvasParent, sim) {
    this.sim = sim;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x0a0f16);
    canvasParent.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 2, 900);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4030, 1.55));
    const sun = new THREE.DirectionalLight(0xfff1d0, 1.5); sun.position.set(-60, 120, 80); this.scene.add(sun);
    this.dummy = new THREE.Object3D(); this.tmpColor = new THREE.Color();
    this.buildGround(); this.buildTerrainProps(); this.buildWall(); this.buildCastle(); this.buildEconomy(); this.buildUnits(); this.buildSiege(); this.rigs = buildTroopRigs(this.scene); this.vrigs = buildVillagerRigs(this.scene); this.vMesh.visible = false; this.buildHighlight();
    this.selected = -1; this.clock = 0; this.selSquad = 0; this.targetMode = false; this.tmpC2 = new THREE.Color(); this.white = new THREE.Color(1, 1, 1);
  }
  resize(w, h) { this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  // Sol : une seule texture 6 px/m, peinte par zones (neige gelée au nord, terre piétinée au front, dalles de la cour, terre battue du village,
  // pavés autour du château), avec chemins à bords doux, gisements, mares gelées, bruit de grain et vignettage. Déterministe (graine fixe).
  buildGround() {
    const k = 6, cv = document.createElement('canvas'); cv.width = W * k; cv.height = D * k; const g = cv.getContext('2d');
    let seed = 99; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + (b - a) * r();
    const X = v => v * k;
    const lerpHex = (a, b, t) => { const p = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255], A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
    // fond : dégradé nord → sud (terres gelées sombres → plaine claire → cour → village → pied du château)
    const grad = g.createLinearGradient(0, 0, 0, D * k);
    for (const [z, c] of [[0, '#6c7b8c'], [24, '#7e8da0'], [60, '#c3cfda'], [105, '#dce5ec'], [138, '#cdd5dc'], [150, '#8f8c86'], [176, '#a39a8b'], [205, '#cdbd9c'], [250, '#d6d0c0'], [285, '#bdae96'], [320, '#a89f90']]) grad.addColorStop(z / D, c);
    g.fillStyle = grad; g.fillRect(0, 0, W * k, D * k);
    const blob = (x, z, rad, col, a) => { const gr = g.createRadialGradient(X(x), X(z), 0, X(x), X(z), X(rad)); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(X(x - rad), X(z - rad), X(rad * 2), X(rad * 2)); };
    // marbrure de la neige : grandes taches douces claires et bleutées
    for (let i = 0; i < 900; i++) { const z = r() * D; if (z > 150 && z < 300 && r() < 0.5) continue; blob(r() * W, z, rr(4, 13), r() < 0.6 ? 'rgba(255,255,255,A)' : 'rgba(110,140,170,A)', rr(0.06, 0.16)); }
    // types de terrain issus de la simulation (forêt, colline, rocher, route)
    const type = this.sim.terrain.type, pal = { [T.FOREST]: 'rgba(60,92,76,.40)', [T.HILL]: 'rgba(255,255,255,.55)', [T.ROCK]: 'rgba(96,100,106,.55)', [T.ROAD]: 'rgba(124,104,78,.45)' };
    for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) { const t = type[gz * GW + gx]; if (t && pal[t]) blob((gx + .5) * CELL, (gz + .5) * CELL, CELL * 1.5, pal[t].replace(/[\d.]+\)$/, 'A)'), 0.55); }
    // sous-bois : aiguilles sombres et brindilles
    for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) if (type[gz * GW + gx] === T.FOREST) for (let n = 0; n < 5; n++) { g.fillStyle = r() < 0.7 ? 'rgba(35,55,45,.35)' : 'rgba(255,255,255,.4)'; g.fillRect(X(gx * CELL + r() * CELL), X(gz * CELL + r() * CELL), rr(2, 6), rr(1, 3)); }
    // front de bataille : boue gelée piétinée, de plus en plus marquée vers la muraille (z 100 → 141)
    for (let i = 0; i < 220; i++) { const z = rr(96, 141), x = r() * W, len = rr(3, 11), a = 0.05 + 0.2 * (z - 96) / 45; g.strokeStyle = `rgba(104,86,66,${a})`; g.lineWidth = rr(0.5, 1.8) * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(x), X(z)); g.lineTo(X(x + rr(-2, 2)), X(z + len)); g.stroke(); }
    for (let i = 0; i < 160; i++) blob(r() * W, rr(120, 141), rr(2, 6), 'rgba(92,76,58,A)', rr(0.08, 0.22));
    // ——— dalles de la cour militaire (z 152 → 200) et pavés autour du château ———
    const flags = (x0, z0, x1, z1, base, rows, clip) => {
      g.save(); if (clip) clip(); else { g.beginPath(); g.rect(X(x0), X(z0), X(x1 - x0), X(z1 - z0)); g.clip(); }
      for (let z = z0; z < z1; z += rows) { let x = x0 - r() * 2; while (x < x1) { const w = rr(0.7, 1.5), v = rr(-14, 14); g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(X(x) + 1, X(z) + 1, X(w) - 2, X(rows) - 2); if (r() < 0.18) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(X(x) + 2, X(z) + 2, X(w) - 4, rr(2, 6)); } x += w; } }
      g.restore();
    };
    g.fillStyle = '#6e6a63'; g.fillRect(0, X(WALL_Z0), W * k, X(WALL_Z1 - WALL_Z0));
    flags(0, WALL_Z1, W, 203, [150, 144, 133], 0.8);
    for (let i = 0; i < 420; i++) blob(r() * W, rr(WALL_Z1, 203), rr(2, 7), 'rgba(250,252,255,A)', rr(0.1, 0.32));       // neige poudrée sur les dalles
    flags(0, 0, 0, 0, [170, 162, 148], 0.8, () => { g.beginPath(); g.ellipse(X(CASTLE.x), X(CASTLE.z), X(36), X(26), 0, 0, 7); g.clip(); });
    // ——— village : terre battue, herbe morte, neige par plaques ———
    for (let i = 0; i < 520; i++) blob(r() * W, rr(203, 292), rr(2, 8), r() < 0.62 ? 'rgba(158,124,82,A)' : 'rgba(255,255,255,A)', rr(0.12, 0.3));
    for (let i = 0; i < 700; i++) { const x = r() * W, z = rr(203, 296); g.strokeStyle = r() < 0.7 ? 'rgba(120,128,80,.55)' : 'rgba(150,140,90,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(X(x), X(z)); g.lineTo(X(x + rr(-.4, .4)), X(z - rr(.5, 1.4))); g.stroke(); }
    // ——— décalques de gisements et de sites ———
    blob(40, 255, 11, 'rgba(46,58,46,A)', 0.5); blob(160, 255, 11, 'rgba(120,122,126,A)', 0.6); blob(182, 236, 8, 'rgba(60,62,72,A)', 0.55); blob(18, 236, 8, 'rgba(70,64,56,A)', 0.5);
    for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,94,100,.7)' : 'rgba(160,160,164,.7)'; g.fillRect(X(160 + rr(-9, 9)), X(255 + rr(-9, 9)), rr(2, 6), rr(2, 5)); }
    // ——— chemins : bords doux (trois traits superposés), ornières ———
    const path = (pts, w) => {
      const draw = (lw, col) => { g.strokeStyle = col; g.lineWidth = lw * k; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z))); g.stroke(); };
      draw(w * 1.5, 'rgba(116,94,68,.14)'); draw(w * 1.15, 'rgba(116,94,68,.3)'); draw(w * 0.8, 'rgba(133,110,80,.5)'); draw(w * 0.22, 'rgba(98,78,56,.4)');
    };
    path([[100, 150], [100, 200], [100, 284]], 9); path([[100, 238], [40, 255]], 5); path([[100, 238], [160, 255]], 5); path([[100, 262], [182, 243]], 4.5); path([[100, 262], [18, 238]], 4.5); path([[8, 205], [192, 205]], 4);
    // repères de secteurs sur le champ de bataille
    g.strokeStyle = 'rgba(40,60,90,.28)'; g.lineWidth = 3; g.setLineDash([k * 2.2, k * 2.2]);
    for (let s = 1; s < SECTORS; s++) { g.beginPath(); g.moveTo(X(s * SECTOR_W), X(70)); g.lineTo(X(s * SECTOR_W), X(WALL_Z0 - 2)); g.stroke(); }
    g.setLineDash([]); g.fillStyle = 'rgba(40,60,90,.32)'; g.font = `bold ${6 * k}px sans-serif`; g.textAlign = 'center';
    for (let s = 0; s < SECTORS; s++) g.fillText(SECTOR_SHORT[s], X((s + .5) * SECTOR_W), X(118));
    // vignettage des bords du monde
    for (const [x0, z0, x1, z1] of [[0, 0, 12, 0], [W, 0, W - 12, 0]]) { const gr = g.createLinearGradient(X(x0), 0, X(x1), 0); gr.addColorStop(0, 'rgba(20,30,40,.35)'); gr.addColorStop(1, 'rgba(20,30,40,0)'); g.fillStyle = gr; g.fillRect(Math.min(X(x0), X(x1)), 0, X(12), D * k); }
    // grain fin (déterministe) : casse les aplats et donne du relief de loin comme de près
    const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data; let gs = 12345;
    for (let i = 0; i < d.length; i += 4) { gs = (gs * 1103515245 + 12345) & 0x7fffffff; const n = ((gs >> 16) & 15) - 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
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
    mk(new THREE.DodecahedronGeometry(1, 0), lam(0x8a8f94), rock, 0.55);
    mk(new THREE.ConeGeometry(0.9, 2.4, 5), lam(0x2f5d3c), tree, 0.5);
    mk(new THREE.ConeGeometry(0.62, 1.1, 5), lam(0xf2f6fa), tree, 1.2);      // neige sur la cime
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
    this.struct = new StructureView(this.scene, this.sim, this.camera);   // toutes les structures (chantiers, bâtiments, fantôme)
    // points de récolte (gisements) : pastilles colorées au sol
    for (const t in TASKS) {
      const T = TASKS[t]; if (!T.res || t === 'food') continue;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.3, 14), new THREE.MeshBasicMaterial({ color: RES_INFO[T.res].color, transparent: true, opacity: 0.55 }));
      d.position.set(T.site.x, 0.2, T.site.z); this.scene.add(d);
    }
    // forêt des bûcherons : les arbres s'éclaircissent quand on coupe et REPOUSSENT tout seuls (échelle = bois restant)
    { const N = 18, ws = TASKS.wood.site; this.treePos = []; let sd = 31; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < N; i++) { const a = rn() * 6.283, r = 2 + 8 * Math.sqrt(rn()); this.treePos.push([ws.x + Math.cos(a) * r, ws.z + Math.sin(a) * r * 0.8, 0.8 + rn() * 0.5, rn()]); }
      this.treePos.sort((a, b) => a[3] - b[3]);
      const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.count = N; this.scene.add(im); return im; };
      const trunk = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6); trunk.translate(0, 0.8, 0); const fol = new THREE.ConeGeometry(1.5, 3.8, 6); fol.translate(0, 3.2, 0); const snow = new THREE.ConeGeometry(1.0, 1.4, 6); snow.translate(0, 4.7, 0);
      this.treeT = mk(trunk, lam(0x6b4a2c)); this.treeF = mk(fol, lam(0x2f5d3c)); this.treeS = mk(snow, lam(0xf2f6fa)); }
    // gisements découverts par prospection : disque coloré + blocs de minerai ; anneau pulsant pendant l'exploration
    { const cap = 9; this.exDisc = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.3, 16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }), cap); this.exDisc.frustumCulled = false; this.exDisc.count = 0; this.exDisc.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.scene.add(this.exDisc);
      this.exRock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lam(0xffffff), cap * 6); this.exRock.frustumCulled = false; this.exRock.count = 0; this.exRock.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 6 * 3), 3); this.scene.add(this.exRock);
      const rg = new THREE.RingGeometry(4, 5.4, 28); rg.rotateX(-Math.PI / 2); this.pRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x4fd1c5, transparent: true, opacity: 0.85, depthWrite: false })); this.pRing.visible = false; this.scene.add(this.pRing); }
    const vg = new THREE.BoxGeometry(0.7, 1.5, 0.7); vg.translate(0, 0.75, 0);
    this.vMesh = new THREE.InstancedMesh(vg, lam(0xffffff), 160); this.vMesh.frustumCulled = false; this.vMesh.count = 0;
    this.vMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3), 3); this.scene.add(this.vMesh);
    const cg = new THREE.BoxGeometry(0.7, 0.7, 0.7); this.cMesh = new THREE.InstancedMesh(cg, lam(0xffffff), 160); this.cMesh.frustumCulled = false; this.cMesh.count = 0;
    this.cMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3), 3); this.scene.add(this.cMesh);
    this.vCol = { idle: new THREE.Color(0xd8b48a), repair: new THREE.Color(0xe67e22) };
  }
  updateEconomy(alpha) {
    const E = this.sim.eco, d = this.dummy;
    { // arbres : taille = bois restant (repousse visible) ; chaque arbre a son seuil
      const ratio = Math.min(1, E.deposit.wood / TASKS.wood.deposit), N = this.treePos.length;
      for (let i = 0; i < N; i++) {
        const [x, z, k] = this.treePos[i], g = Math.min(1, Math.max(0, (ratio * 1.15 - i / N) * 5)), sc = k * (0.18 + 0.82 * g);
        d.position.set(x, 0, z); d.rotation.set(0, i, 0); d.scale.set(k, k, k); d.updateMatrix(); this.treeT.setMatrixAt(i, d.matrix);
        d.scale.set(sc, sc * (g > 0.05 ? 1 : 0.02), sc); d.updateMatrix(); this.treeF.setMatrixAt(i, d.matrix); this.treeS.setMatrixAt(i, d.matrix);
      }
      this.treeT.instanceMatrix.needsUpdate = this.treeF.instanceMatrix.needsUpdate = this.treeS.instanceMatrix.needsUpdate = true;
      let nd = 0, nr = 0;
      for (const r of ['stone', 'iron', 'gold']) for (const e of E.extra[r]) {
        if (nd >= 9) break; const f = Math.max(0, e.amount / e.max), rad = 3 + 3 * f;
        d.position.set(e.x, 0.2, e.z); d.rotation.set(0, 0, 0); d.scale.set(rad, 1, rad); d.updateMatrix(); this.exDisc.setMatrixAt(nd, d.matrix); this.exDisc.setColorAt(nd, this.tmpColor.setHex(RES_INFO[r].color)); nd++;
        if (e.amount <= 0) continue;
        for (let j = 0; j < 6; j++) { const a = j * 1.05 + e.x, rr = rad * 0.55 * (j % 2 ? 0.6 : 1), s2 = 0.7 + 0.5 * ((j * 7) % 3) / 2; d.position.set(e.x + Math.cos(a) * rr, s2 * 0.5, e.z + Math.sin(a) * rr); d.rotation.set(j, j * 2, 0); d.scale.set(s2, s2 * 0.8, s2); d.updateMatrix(); this.exRock.setMatrixAt(nr, d.matrix); this.exRock.setColorAt(nr, this.tmpColor.setHex(RES_INFO[r].color).lerp(this.white, 0.15)); nr++; }
      }
      this.exDisc.count = nd; this.exRock.count = nr; this.exDisc.instanceMatrix.needsUpdate = this.exRock.instanceMatrix.needsUpdate = true; if (nd) { this.exDisc.instanceColor.needsUpdate = true; this.exRock.instanceColor.needsUpdate = true; }
      const P = E.prospect; this.pRing.visible = !!P; if (P) { const pu = 1 + 0.12 * Math.sin(this.clock * 5) + 0.25 * (1 - P.t / P.dur); this.pRing.position.set(P.x, 0.4, P.z); this.pRing.scale.set(pu, pu, pu); }
    }
    if (this.vv) return this.updateVillagersVAT(alpha);
    // ——— villageois (repli) : un modèle par métier, animé selon l'état (marche, outil qui frappe, charge portée) ———
    const R = this.vrigs, vs = E.villagers, t = this.clock, SC = 1.4, FREQ = { wood: 7, stone: 6, iron: 6, gold: 6, food: 3.6, build: 8, repair: 8 }; let nc = 0;
    for (const k in R) R[k].begin();
    const lerpAng = (a, b, k) => { const dd = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + dd * k; };
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], x = v.px + (v.x - v.px) * alpha, z = v.pz + (v.z - v.pz) * alpha, dx = v.x - v.px, dz = v.z - v.pz, mv = dx * dx + dz * dz > 2e-6;
      v.rmv = (v.rmv || 0) + ((mv ? 1 : 0) - (v.rmv || 0)) * 0.25;
      const key = v.job ? 'build' : v.task === 'repair' ? 'repair' : (v.task || 'idle'), working = v.state === 'gather' || v.state === 'building' || v.state === 'repairing';
      let want = v.rrot ?? Math.PI;
      if (mv) want = Math.atan2(dx, dz);
      else if (v.state === 'building') { const s = this.sim.build.get(v.job); if (s) want = Math.atan2(s.x - v.x, s.z - v.z); }
      else if (v.state === 'repairing') want = Math.PI;
      else if (v.state === 'gather' && v.sx !== null && v.sx !== undefined) want = Math.atan2(v.sx - v.x, v.sz - v.z);
      v.rrot = lerpAng(v.rrot ?? Math.PI, want, mv ? 0.3 : 0.15);
      const ph = t * 10 + i * 1.7, sw = Math.sin(ph) * 0.7 * v.rmv, ph2 = t * (FREQ[key] || 6) + i * 1.3, sn = Math.sin(ph2), carrying = v.carry > 0;
      let arm = -0.2 + 0.05 * Math.sin(t * 2 + i);
      if (working) arm = key === 'food' ? -0.9 + 0.7 * sn : -1.15 + (sn > 0 ? sn : sn * 0.35);
      else if (carrying) arm = -1.25; else if (mv) arm = -0.5 + 0.35 * Math.sin(ph + Math.PI);
      const bob = (mv ? Math.abs(Math.sin(ph)) * 0.07 : working ? Math.abs(sn) * 0.05 : 0) * SC;
      d.position.set(x, bob, z); d.scale.set(SC, SC, SC); d.rotation.set(0, v.rrot, 0); d.updateMatrix();
      this.tmpColor.setRGB(1, 1, 1); R[key].push(d.matrix, this.tmpColor, [0, sw, -sw, arm]);
      if (carrying) {                                    // charge portée devant la poitrine : caisse colorée selon la ressource
        d.position.set(x + Math.sin(v.rrot) * 0.7, 1.4 + bob, z + Math.cos(v.rrot) * 0.7); d.scale.set(1.05, 0.85, 1.05); d.rotation.set(0, v.rrot, 0); d.updateMatrix(); this.cMesh.setMatrixAt(nc, d.matrix);
        this.tmpColor.setHex(RES_INFO[v.carryRes].color); this.cMesh.setColorAt(nc, this.tmpColor); nc++;
      }
    }
    for (const k in R) R[k].end();
    this.cMesh.count = nc; this.cMesh.instanceMatrix.needsUpdate = true; if (nc) this.cMesh.instanceColor.needsUpdate = true;
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
    this.renderMachines(S);
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
  // ——— troupes : fantassins, lourds, cavaliers (pièces animées : jambes, bras, bras d'épée) ———
  renderSquads(alpha) {
    const R = this.rigs, d = this.dummy, t = this.clock, sel = this.selSquad, tint = this.tmpColor, SCALE = { soldier: 1.6, heavy: 1.8, cavalry: 1.35 };
    R.soldier.begin(); R.heavy.begin(); R.cavalry.begin();
    const hh = this.hh; if (hh) for (const k of hh.hg.skins) hh.cnt[k] = 0;
    const lerpAng = (a, b, k) => { let dd = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + dd * k; };
    for (const q of this.sim.army.squads) {
      const U = UNITS[q.type], rig = R[q.type] || R.soldier, horse = q.type === 'cavalry', L = formationLayout(q.form, Math.max(1, q.n), U.size);
      const cx = q.px + (q.x - q.px) * alpha, cz = q.pz + (q.z - q.pz) * alpha, dx = q.x - q.px, dz = q.z - q.pz, mv = dx * dx + dz * dz > 1e-4, fight = q.fight > 0;
      q.rmv = (q.rmv || 0) + ((mv ? 1 : 0) - (q.rmv || 0)) * 0.2;
      q.rrot = mv ? lerpAng(q.rrot ?? Math.PI, Math.atan2(dx, dz), 0.25) : lerpAng(q.rrot ?? Math.PI, Math.PI, 0.05);   // à l'arrêt : face au nord (zombies)
      const sc = SCALE[q.type] || 2.4, mvs = q.rmv, flash = q.hit > 0, isSel = q.id === sel;
      if (flash) tint.setRGB(1.9, 1.2, 1.2); else if (isSel) tint.setRGB(1.3, 1.3, 1.0); else tint.setRGB(1, 1, 1);
      for (let k = 0; k < q.n; k++) {
        const ph = t * (horse ? 11 : 9) + k * 1.7, ph2 = t * 8 + k * 2.3, sw = Math.sin(ph) * (horse ? 0.8 : 0.75) * mvs;
        d.position.set(cx + L.xs[k], Math.abs(Math.sin(ph)) * (horse ? 0.1 : 0.06) * mvs * sc, cz + L.zs[k]); d.scale.set(sc, sc, sc); d.rotation.set(0, q.rrot, 0); d.updateMatrix();
        if (horse && hh) {
          const hg = hh.hg, spd = Math.hypot(dx, dz), clip = mv ? (spd > 0.22 ? 'gallop' : 'walk') : 'idle', [c0, cn] = hg.clips[clip], cps = clip === 'gallop' ? 1.8 : clip === 'walk' ? 1.0 : 0.4;
          const fr = ((t * cps + q.id * 0.31 + k * 0.173) % 1 + 1) % 1, an = c0 + fr * cn, skin = hg.skins[(q.id * 5 + 3) % hg.skins.length], im = hh.meshes[skin], n = hh.cnt[skin]++;
          if (n < 120) { im.setMatrixAt(n, d.matrix); im.anim.array[n] = an; im.setColorAt(n, tint); }
          const arm = fight ? 0.5 + (Math.sin(ph2) * 0.5 + 0.5) * 1.8 : 0.35 + 0.12 * Math.sin(ph); this._hm.multiplyMatrices(d.matrix, hg.seat[Math.floor(an)]).multiply(this._rs); rig.push(this._hm, tint, [0, arm]);
        }
        else if (horse) { const arm = fight ? 0.5 + (Math.sin(ph2) * 0.5 + 0.5) * 1.8 : 0.35 + 0.12 * Math.sin(ph); rig.push(d.matrix, tint, [0, arm]); }
        else { const arm = fight ? -1.1 + Math.sin(ph2) * 0.8 : -0.35 - 0.3 * mvs + 0.3 * Math.sin(ph + Math.PI) * mvs; rig.push(d.matrix, tint, [0, sw, -sw, arm]); }
      }
    }
    R.soldier.end(); R.heavy.end(); R.cavalry.end();
    if (hh) for (const k of hh.hg.skins) { const im = hh.meshes[k]; im.count = Math.min(120, hh.cnt[k]); im.instanceMatrix.needsUpdate = true; im.anim.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }
  // ——— machines de siège : le bras de lancer suit le cycle de tir (armé → détente → remontée) ———
  renderMachines(S) {
    const R = this.rigs, d = this.dummy, tint = this.tmpColor, SC = { ballista: 1.0, catapult: 1.1, trebuchet: 1.0 };
    for (const k of ['ballista', 'catapult', 'trebuchet']) R[k].begin();
    for (const w of S.weapons) {
      const D = SIEGE[w.type], sc = SC[w.type], e = D.reload - w.cd; d.position.set(w.x, 0, w.z); d.scale.set(sc, sc, sc); d.rotation.set(0, 0, 0); d.updateMatrix();
      if (w.noAmmo) tint.setRGB(1.6, 0.6, 0.55); else tint.setRGB(1, 1, 1);
      if (w.type === 'ballista') R.ballista.push(d.matrix, tint, [0, w.rec > 0 ? -1.2 * (1 - w.rec / 0.35) : 0.7 * Math.min(1, Math.max(0, e - 0.3))]);
      else R[w.type].push(d.matrix, tint, [0, throwAngle(w.type, e, D.reload, w.noAmmo)]);
    }
    for (const k of ['ballista', 'catapult', 'trebuchet']) R[k].end();
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
    const castle = new THREE.Mesh(geo.Castle, kit.material); castle.position.set(CASTLE.x, 0, CASTLE.z); castle.scale.setScalar(0.8); castle.rotation.y = Math.PI / 2; this.scene.add(castle); this.castleKit = castle;
    this.struct.setKit(kit);   // maisons, tours, moulin, entrepôt, grenier : modèles du kit
    // monuments et décor du village
    const one = (name, x, z, ry, sc) => { const m = new THREE.Mesh(geo[name], kit.material); m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(sc); this.scene.add(m); return m; };
    one('Church', 162, 292, -0.3, 1.0);
  }
  updateKitWall() {
    const wall = this.sim.wall, d = this.dummy, c = this.tmpColor, cnt = { Wall1: 0, Wall2: 0, Wall3: 0, Wall4: 0 };
    for (let i = 0; i < SEGS; i++) {
      const hpR = wall.hp[i] / wall.segMax(i), breached = wall.hp[i] <= 0, lvl = wall.level[wall.sectorOf(i)], gate = wall.isGate(i);
      const type = gate ? 'Wall4' : ['Wall1', 'Wall2', 'Wall3'][i % 3], im = this.kw[type], k = cnt[type]++;
      this.put(im, k, i * SEG_W + SEG_W / 2, 146, -Math.PI / 2, 1.45, breached ? 0.28 : 1.12 + 0.03 * lvl, 0.64);
      if (breached) c.setRGB(0.35, 0.25, 0.22); else { c.setRGB(1, 1, 1); c.lerp(this.tmpC2.setRGB(1, 0.35, 0.25), (1 - hpR) * 0.85); }
      im.setColorAt(k, c);
    }
    for (const t in this.kw) { const im = this.kw[t]; im.count = cnt[t]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  // ——— personnages de l'ancien jeu : zombies animés (VAT), archers, villageois humanoïdes ———
  useCharacters(ch) {
    this.chars = ch; this.vRot = new WeakMap(); const cap = MAX_Z;
    this.zv = ch.zombies.variants.map((v, i) => {
      const im = new THREE.InstancedMesh(v.geo, ch.zombies.mats[i], cap); im.frustumCulled = false; im.count = 0;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      im.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); im.anim.setUsage(THREE.DynamicDrawUsage); v.geo.setAttribute('aAnim', im.anim); this.scene.add(im); return im;
    });
    this.zvCount = new Int32Array(this.zv.length); this.zMesh.visible = false;
    this.zTint = ZOMBIES.map(z => new THREE.Color(0xffffff).lerp(new THREE.Color(z.color), 0.4));
    const mk = geo => { const im = new THREE.InstancedMesh(geo, ch.archerMat, SECTORS * ARCHER_SLOTS + 4); im.frustumCulled = false; im.count = 0; this.scene.add(im); return im; };
    this.ab = mk(ch.archer.body); this.abow = mk(ch.archer.bow); this.aMesh.visible = false;
    this.vMesh.geometry = ch.villagerGeo; this.vMesh.material = ch.villagerMat;
    if (ch.villager) this.useVillagerGLB(ch.villager);
    if (ch.horse) this.useHorseGLB(ch.horse);
  }
  // ——— chevaux (modèle GLB cuit en VAT) : une maille instanciée par robe, le cavalier (Rig) suit la selle image par image ———
  useHorseGLB(hg) {
    const cap = 120, hh = { hg, meshes: {}, cnt: {} };
    for (const k of hg.skins) {
      const im = new THREE.InstancedMesh(hg.geos[k], hg.mat, cap); im.frustumCulled = false; im.count = 0;
      im.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); im.anim.setUsage(THREE.DynamicDrawUsage); hg.geos[k].setAttribute('aAnim', im.anim);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.scene.add(im); hh.meshes[k] = im;
    }
    this.hh = hh; this._hm = new THREE.Matrix4(); this._rs = new THREE.Matrix4().makeTranslation(0, hg.backY, 0).multiply(new THREE.Matrix4().makeScale(1.2, 1.2, 1.2)).multiply(new THREE.Matrix4().makeTranslation(0, -hg.backY, 0));   // cavalier un peu plus grand, mis à l'échelle autour de la selle
  }
  // ——— villageois (modèle GLB cuit en VAT) : une variante de couleur par métier + outil et chapeau attachés à la main / la tête ———
  useVillagerGLB(vg) {
    const GEAR = { idle: [null, 'cap'], wood: ['axe', 'cap'], stone: ['pick', 'hardGrey'], iron: ['pick', 'hard'], gold: ['pick', 'hard'], food: ['hoe', 'straw'], repair: ['hammer', 'hardOrange'], build: ['hammer', 'hard'] };
    const cap = 160, gm = applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })), vv = { vg, meshes: {}, tools: {}, hats: {}, cnt: {}, gcnt: {} };
    for (const k of vg.tints) {
      const im = new THREE.InstancedMesh(vg.geos[k], vg.mat, cap); im.frustumCulled = false; im.count = 0;
      im.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); im.anim.setUsage(THREE.DynamicDrawUsage); vg.geos[k].setAttribute('aAnim', im.anim); this.scene.add(im); vv.meshes[k] = im;
      const [tool, hat] = GEAR[k] || GEAR.idle, mkG = geo => { if (!geo) return null; const g = new THREE.InstancedMesh(geo, gm, cap); g.frustumCulled = false; g.count = 0; this.scene.add(g); return g; };
      vv.tools[k] = mkG(tool && toolGeometry(tool, vg.handPos)); vv.hats[k] = mkG(hatGeometry(hat, vg.headPos));
    }
    this.vv = vv; this.vMesh.visible = false; for (const r in this.vrigs) for (const m of this.vrigs[r].meshes) m.visible = false;
    this._ty = new THREE.Matrix4().makeTranslation(0, -vg.miny, 0); this._gm = new THREE.Matrix4();
  }
  updateVillagersVAT(alpha) {
    const E = this.sim.eco, d = this.dummy, vv = this.vv, vg = vv.vg, t = this.clock, vs = E.villagers, SC = 0.0105;
    const SPEED = { walk: 1.3, carry: 1.2, idle: 0.35 }, WORK = { wood: 0.9, stone: 0.8, iron: 0.8, gold: 0.8, food: 0.55, build: 1.0, repair: 1.0 };
    for (const k in vv.meshes) { vv.cnt[k] = 0; }
    const lerpAng = (a, b, k) => { const dd = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + dd * k; };
    let nc = 0;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], x = v.px + (v.x - v.px) * alpha, z = v.pz + (v.z - v.pz) * alpha, dx = v.x - v.px, dz = v.z - v.pz, mv = dx * dx + dz * dz > 2e-6;
      const key = v.job ? 'build' : v.task === 'repair' ? 'repair' : (v.task || 'idle'), working = v.state === 'gather' || v.state === 'building' || v.state === 'repairing', carrying = v.carry > 0;
      let want = v.rrot ?? Math.PI;
      if (mv) want = Math.atan2(dx, dz);
      else if (v.state === 'building') { const s = this.sim.build.get(v.job); if (s) want = Math.atan2(s.x - v.x, s.z - v.z); }
      else if (v.state === 'repairing') want = Math.PI;
      else if (v.state === 'gather' && v.sx !== null && v.sx !== undefined) want = Math.atan2(v.sx - v.x, v.sz - v.z);
      v.rrot = lerpAng(v.rrot ?? Math.PI, want, mv ? 0.3 : 0.15);
      const clip = working && !mv ? 'work' : mv ? (carrying ? 'carry' : 'walk') : carrying ? 'carry' : 'idle', [c0, cn] = vg.clips[clip];
      const spd = clip === 'work' ? (WORK[key] || 0.9) : SPEED[clip] || 1, ph = (t * spd + i * 0.37) % 1, an = c0 + ph * cn, k = vv.cnt[key]++, im = vv.meshes[key];
      d.position.set(x, 0, z); d.scale.set(SC, SC, SC); d.rotation.set(0, v.rrot, 0); d.updateMatrix();
      im.setMatrixAt(k, d.matrix); im.anim.array[k] = an;
      const f0 = Math.floor(an), tl = vv.tools[key], ht = vv.hats[key];
      if (tl) { this._gm.copy(d.matrix).multiply(this._ty).multiply(vg.hand[f0]); tl.setMatrixAt(k, this._gm); }
      if (ht) { this._gm.copy(d.matrix).multiply(this._ty).multiply(vg.head[f0]); ht.setMatrixAt(k, this._gm); }
      if (carrying) {
        d.position.set(x + Math.sin(v.rrot) * 0.8, 1.5, z + Math.cos(v.rrot) * 0.8); d.scale.set(1.05, 0.85, 1.05); d.rotation.set(0, v.rrot, 0); d.updateMatrix(); this.cMesh.setMatrixAt(nc, d.matrix);
        this.tmpColor.setHex(RES_INFO[v.carryRes].color); this.cMesh.setColorAt(nc, this.tmpColor); nc++;
      }
    }
    for (const k in vv.meshes) { const n = vv.cnt[k], im = vv.meshes[k]; im.count = n; im.instanceMatrix.needsUpdate = true; im.anim.needsUpdate = true; for (const g of [vv.tools[k], vv.hats[k]]) if (g) { g.count = n; g.instanceMatrix.needsUpdate = true; } }
    this.cMesh.count = nc; this.cMesh.instanceMatrix.needsUpdate = true; if (nc) this.cMesh.instanceColor.needsUpdate = true;
  }
  renderZombies(alpha) {
    const Z = this.sim.zombies, n = Z.n, cnt = this.zvCount.fill(0), clock = this.clock, tc = this.tmpColor;
    for (let i = 0; i < n; i++) {
      const t = Z.type[i], Zt = ZOMBIES[t], pool = ZVAR[t], vi = pool[((Z.phase[i] * 1000) | 0) % pool.length], im = this.zv[vi], k = cnt[vi]++;
      const x = Z.px[i] + (Z.x[i] - Z.px[i]) * alpha, z = Z.pz[i] + (Z.z[i] - Z.pz[i]) * alpha, dx = Z.x[i] - Z.px[i], dz = Z.z[i] - Z.pz[i];
      const rot = dx * dx + dz * dz > 4e-6 ? Math.atan2(dx, dz) : 0, c = Math.cos(rot), s2 = Math.sin(rot), sc = Zt.size * 1.9, o = k * 16, m = im.instanceMatrix.array;
      m[o] = c * sc; m[o + 1] = 0; m[o + 2] = -s2 * sc; m[o + 3] = 0; m[o + 4] = 0; m[o + 5] = sc; m[o + 6] = 0; m[o + 7] = 0; m[o + 8] = s2 * sc; m[o + 9] = 0; m[o + 10] = c * sc; m[o + 11] = 0; m[o + 12] = x; m[o + 13] = 0; m[o + 14] = z; m[o + 15] = 1;
      const cps = Z.state[i] === 1 ? 1.3 : Math.max(0.25, Zt.speed / (2.2 * sc));
      im.anim.array[k] = ((clock * cps + Z.phase[i] / 6.2832) % 1) * 16;
      const hurt = Z.hp[i] / Zt.hp < 0.5 ? 0.7 : 1, tt = this.zTint[t], ca = im.instanceColor.array; ca[k * 3] = tt.r * hurt; ca[k * 3 + 1] = tt.g * hurt; ca[k * 3 + 2] = tt.b * hurt;
    }
    this.zv.forEach((im, v) => { im.count = cnt[v]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.anim.needsUpdate = true; });
  }
  renderArchers() {
    const sim = this.sim, d = this.dummy; let ai = 0;
    for (let s = 0; s < SECTORS; s++) for (let k = 0; k < sim.army.archers[s].n; k++) {
      const p = archerPos(s, k), a = sim.siege ? 0 : 0; d.position.set(p.x, this.kitWalls ? 4.9 : 4, p.z); d.scale.set(1.55, 1.55, 1.55); d.rotation.set(0, Math.PI, 0); d.updateMatrix();
      this.ab.setMatrixAt(ai, d.matrix); this.abow.setMatrixAt(ai, d.matrix); ai++;
    }
    this.ab.count = this.abow.count = ai; this.ab.instanceMatrix.needsUpdate = this.abow.instanceMatrix.needsUpdate = true;
  }
  // point du monde → pixels écran (pour les bulles d'interface ancrées sur la carte)
  project(x, y, z) { const v = this._pv || (this._pv = new THREE.Vector3()); v.set(x, y, z).project(this.camera); const r = this.renderer.domElement.getBoundingClientRect(); return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top, vis: v.z > -1 && v.z < 1 }; }
  setSquad(id) { this.selSquad = id || 0; }
  setTargeting(on) { this.targetMode = on; }
  setSelected(s) { this.selected = s; this.hl.visible = s >= 0; if (s >= 0) this.hl.position.set(s * SECTOR_W + SECTOR_W / 2, 0.2, 112); }

  render(alpha, dtReal) {
    const sim = this.sim, Z = sim.zombies, d = this.dummy; this.clock += dtReal;
    // zombies (interpolés)
    if (this.zv) this.renderZombies(alpha); else {
    const zm = this.zMesh, ma = zm.instanceMatrix.array, ca = zm.instanceColor.array, n = Z.n;
    for (let i = 0; i < n; i++) {
      const t = Z.type[i], sc = ZOMBIES[t].size * ZSCALE, x = Z.px[i] + (Z.x[i] - Z.px[i]) * alpha, z = Z.pz[i] + (Z.z[i] - Z.pz[i]) * alpha;
      const bob = 1 + 0.08 * Math.sin(this.clock * 9 + Z.phase[i]), o = i * 16;
      ma[o] = sc * 0.8; ma[o + 5] = sc * bob; ma[o + 10] = sc * 0.8; ma[o + 15] = 1; ma[o + 12] = x; ma[o + 13] = Z.state[i] === 1 ? 0.05 : 0; ma[o + 14] = z;
      ma[o + 1] = ma[o + 2] = ma[o + 3] = ma[o + 4] = ma[o + 6] = ma[o + 7] = ma[o + 8] = ma[o + 9] = ma[o + 11] = 0;
      const c = this.zCol[t], hurt = Z.hp[i] / ZOMBIES[t].hp < 0.5 ? 0.75 : 1; ca[i * 3] = c.r * hurt; ca[i * 3 + 1] = c.g * hurt; ca[i * 3 + 2] = c.b * hurt;
    }
    zm.count = n; zm.instanceMatrix.needsUpdate = true; zm.instanceColor.needsUpdate = true;
    }
    this.renderSquads(alpha); const sel = this.selSquad;
    // anneau de l'escouade choisie + marqueur de sortie
    const sq = sel ? sim.army.squads.find(q => q.id === sel) : null;
    this.ring.visible = !!sq;
    if (sq) {
      const cx = sq.px + (sq.x - sq.px) * alpha, cz = sq.pz + (sq.z - sq.pz) * alpha, r = sq.rad + 1.5;
      this.ring.position.set(cx, 0.35, cz); this.ring.scale.set(r, r, r);
      this.mark.visible = sq.mode === 'field'; this.mark.position.set(sq.tx, 0.35, sq.tz); const pu = 1 + 0.12 * Math.sin(this.clock * 6); this.mark.scale.set(pu, pu, pu);
    } else this.mark.visible = false;
    this.targeting.visible = this.targetMode;
    if (this.ab) this.renderArchers(); else {
    // archers (sur le chemin de ronde)
    let ai = 0;
    for (let s = 0; s < SECTORS; s++) for (let k = 0; k < sim.army.archers[s].n; k++) {
      const p = archerPos(s, k); d.position.set(p.x, this.kitWalls ? 4.9 : 4, p.z); d.scale.set(USCALE * .7, USCALE * .9, USCALE * .7); d.rotation.set(0, 0, 0); d.updateMatrix(); this.aMesh.setMatrixAt(ai, d.matrix); this.tmpColor.setRGB(0.18, 0.68, 0.42); this.aMesh.setColorAt(ai, this.tmpColor); ai++;
    }
    this.aMesh.count = ai; this.aMesh.instanceMatrix.needsUpdate = true; if (this.aMesh.instanceColor) this.aMesh.instanceColor.needsUpdate = true;
    }
    // flèches
    const ar = sim.arrows; this.arMesh.count = Math.min(ar.length, 256);
    for (let i = 0; i < this.arMesh.count; i++) {
      const a = ar[i], f = Math.min(1, a.t / 0.3), x = a.x0 + (a.x1 - a.x0) * f, z = a.z0 + (a.z1 - a.z0) * f, y = (a.h || 4.5) * (1 - f) + 1 + 3 * Math.sin(Math.PI * f);
      d.position.set(x, y, z); d.scale.set(1, 1, 1); d.rotation.set(0, Math.atan2(a.x1 - a.x0, a.z1 - a.z0), 0); d.updateMatrix(); this.arMesh.setMatrixAt(i, d.matrix); this.tmpColor.setRGB(1, 0.95, 0.7); this.arMesh.setColorAt(i, this.tmpColor);
    }
    this.arMesh.instanceMatrix.needsUpdate = true; if (this.arMesh.instanceColor) this.arMesh.instanceColor.needsUpdate = true;
    // alertes de secteur (menace proche / attaque)
    for (let s = 0; s < SECTORS; s++) {
      const dg = sim.danger(s), tgt = sim.phase === 'alert' && sim.targets.includes(s);
      const o = dg === 2 ? 0.28 + 0.12 * Math.sin(this.clock * 8) : dg === 1 ? 0.12 : tgt ? 0.1 + 0.08 * Math.sin(this.clock * 5) : 0;
      this.threat[s].material.opacity = o;
    }
    this.updateWall(); this.updateEconomy(alpha); this.updateSiege(alpha); this.struct.update(dtReal, this.clock);
    this.renderer.render(this.scene, this.camera);
  }
}
