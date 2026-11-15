// Rendu Three.js : lit l'état de la simulation, ne le modifie jamais. Géométrie provisoire (low-poly basique).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCastleFort } from './Castle.js';
import { buildBorder, westEdge, eastEdge, outsidePlay } from './Border.js';
import { W, D, SECTORS, SECTOR_W, SEGS, SEG_W, WALL_Z0, WALL_Z1, GATE_SEGS, CASTLE, GW, GD, CELL, MAX_Z, ARCHER_SLOTS, ARCHER_Z, SECTOR_SHORT, PLAZA, WALK_H, wallOff, wallSlope } from '../sim/constants.js';
import { T } from '../sim/terrain.js';
import { ZOMBIES, UNITS, SIEGE, BUILDINGS, TASKS, RES_INFO, INFECTION, FRONTIER } from '../content/medieval.js';
import { archerPos, formationLayout, archerPose, rallySlot } from '../sim/army.js';
import { applyNorthFog } from './fog.js';
import { StructureView } from './Structures.js';
import { WallView } from './WallView.js';
import { stoneMaterial, kitMaterial } from './Stone.js';
import { Effects, EFFECTS } from './Effects.js';
import { ATMOS, CAMERA, quality, setQualityName } from './config.js';
import { fogUniforms, patchNorthFog, applyWindFog } from './fog.js';
import { Post } from './Post.js';
import { buildTroopRigs, buildVillagerRigs, throwAngle, toolGeometry, hatGeometry, troopRig, siegeRig, bx, BLOBS } from './Troops.js';
import { buildKnightRigs, makeMage, makePriest, poseMage, knightRig, golemRig } from './Heroes.js';
import { carrierGeometry, TOOL_TINT } from './Village.js';
import { OreView } from './Ores.js';
import { groundMaterial, groundDetails } from './Ground.js';
import { LOADS, buildLoadMeshes, backToolMatrix } from './Loads.js';
import { FrontierView, RoadView, BrazierView } from './World.js';
import { RANKS } from '../content/medieval.js';
const ZVAR = [[0, 3, 5], [2, 4], [1, 5], [1], [0, 4], [1], [1]];      // le golem (6) a son propre modèle articulé ; [1] ne sert que de repli
const _v1 = [];      // variantes de modèle par type de zombie
const VTINT = { wood: 0xd9b27a, stone: 0xc3c8cd, iron: 0xa6b4d6, gold: 0xf2d65e, food: 0xb9e08c, repair: 0xff9a4a };

const lam = (color, opts = {}) => applyNorthFog(new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
// Échelles (v1.8) : tous les humains mesurent ≈ 2,3 m (un peu plus grands que nature pour rester lisibles de haut) ;
// zombie classique = humain ; colosse ≈ 10 m. Muraille 6,4 m, porte 4,4 m : un cavalier passe sous la herse.
export const HUMAN_H = 2.3;
const VCAP = 720;
const TASK_LOOK = { clear: 'wood', fire: 'repair' };      // défricheurs = tenue de bûcheron ; allumeurs = tenue orange (+ torche la nuit)     // villageois affichables (grosse population, v1.9)
const ASC = HUMAN_H / 1.69;
const ZSCALE = 1.45, USCALE = 1.75;   // personnages à l'échelle des bâtiments (v3.1 : réduits d'environ 35 % pour éviter l'effet « maquette »)

export class Renderer {
  constructor(canvasParent, sim) {
    this.sim = sim;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(ATMOS.fogColor);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;      // ombres douces
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = ATMOS.exposure;   // (v3.6) tonalité filmique : couleurs riches, hautes lumières douces
    canvasParent.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 2, 900);
    this.hemi = new THREE.HemisphereLight(ATMOS.hemiSky, ATMOS.hemiGround, ATMOS.hemiIntensity); this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(ATMOS.sunColor, ATMOS.sunIntensity), A = ATMOS.shadowArea; this.sun = sun;
    sun.target.position.set(A.x, 0, A.z); sun.position.set(A.x + ATMOS.sunPos[0], ATMOS.sunPos[1], A.z + ATMOS.sunPos[2]); this.scene.add(sun, sun.target);
    Object.assign(sun.shadow.camera, { left: -A.hw, right: A.hw, top: A.hd, bottom: -A.hd, near: 10, far: 420 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.35; sun.shadow.radius = 3;
    this.dummy = new THREE.Object3D(); this.tmpColor = new THREE.Color();
    this.buildSky();
    this.buildGround(); this.buildTerrainProps(); this.buildWall(); this.buildCastle(); this.buildEconomy(); this.buildUnits(); this.buildSiege(); this.rigs = buildTroopRigs(this.scene); Object.assign(this.rigs, buildKnightRigs(this.scene)); this.rigs.knightGold = this.rigs.knight; this.mageViews = new Map(); this.rigTier = {}; this.vrigs = buildVillagerRigs(this.scene); this.vMesh.visible = false; this.buildHighlight();
    this.buildGrass(); this.buildBlobs(); this.cartLevel = -1;
    this.frontierV = new FrontierView(this.scene, sim.frontier); this.roadV = new RoadView(this.scene); this.braziers = new BrazierView(this.scene, sim.night, quality.glow ? 6 : 0);
    this.applyQuality();
    this.buildTorches(); this.buildRangeIndicator();
    this.fx = new Effects(this.scene, { enabled: EFFECTS.enabled });   // particules (flèches, zombies, muraille, siège) : vue seule
    this.selected = -1; this.clock = 0; this.selSquad = 0; this.targetMode = false; this.tmpC2 = new THREE.Color(); this.white = new THREE.Color(1, 1, 1);
  }
  // ——— qualité (voir render/config.js) : ombres, lueurs, résolution ———
  qualityName() { return quality.name; }
  // préréglage (format) + réglages fins modifiables en cours de partie : ombres, lueurs, herbe, résolution
  setQuality(name, over = null) { if (!setQualityName(name)) return; if (over) { Object.assign(quality, over); if (quality.shadows && !quality.shadowMap) quality.shadowMap = 1024; } this.applyQuality(); }
  applyQuality() {
    const q = quality; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows; this.sun.castShadow = q.shadows;
    if (q.shadows) { const sm = this.sun.shadow; if (sm.mapSize.x !== q.shadowMap) { sm.mapSize.set(q.shadowMap, q.shadowMap); if (sm.map) { sm.map.dispose(); sm.map = null; } } }
    this.scene.traverse(o => { if (o.material) { for (const m of [].concat(o.material)) m.needsUpdate = true; } });
    if (this.fx) this.fx.setQuality(q);
    if (this.grass) this.grass.count = Math.round(this.grass.userData.max * q.grass);
    if (this.lastSize) this.resize(this.lastSize[0], this.lastSize[1]);
  }
  // les objets qui projettent et reçoivent une ombre (personnages animés exclus : leur ombre serait figée)
  shadowize(obj) { obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
  // ——— touffes d'herbe : une seule maille instanciée (3 lames croisées par touffe), balancée par le vent dans le shader ———
  buildGrass() {
    const MAXN = 4200, blades = [], pos = [], nor = [];
    for (let b = 0; b < 3; b++) {   // mini-herbe immobile (v1.9) : 3 petites lames, aucune animation
      const a = b * 2.09 + 0.3, h = 0.32 + 0.12 * (b % 2), lean = 0.06, w = 0.06, ox = Math.cos(a) * 0.12, oz = Math.sin(a) * 0.12, cx = Math.cos(a + 1.57), cz = Math.sin(a + 1.57);
      pos.push(ox - cx * w, 0, oz - cz * w, ox + cx * w, 0, oz + cz * w, ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean); for (let i = 0; i < 3; i++) nor.push(0, 1, 0);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const mat = applyNorthFog(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    const im = new THREE.InstancedMesh(geo, mat, MAXN); im.frustumCulled = false; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXN * 3), 3);
    const type = this.sim.terrain.type; let seed = 4242; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, d = this.dummy, c = this.tmpColor; let n = 0, tries = 0;
    const cols = { south: [[0.32, 0.5, 0.22], [0.42, 0.55, 0.26], [0.55, 0.55, 0.28]], north: [[0.66, 0.66, 0.6], [0.58, 0.6, 0.55], [0.74, 0.74, 0.7]] };   // herbe givrée, claire sur la neige
    while (n < MAXN && tries++ < MAXN * 8) {
      const south = r() < 0.86, z = south ? 206 + r() * 106 : 30 + r() * 108, x = 2 + r() * 196;
      if (Math.hypot((x - CASTLE.x) / 38, (z - CASTLE.z) / 28) < 1) continue;                                        // pas sur les pavés du château
      if (Math.abs(x - PLAZA.x) < PLAZA.hw + 2 && Math.abs(z - PLAZA.z) < PLAZA.hd + 2) continue;                       // ni sur la placette
      const t = type[((z / CELL) | 0) * GW + ((x / CELL) | 0)]; if (t === T.ROAD || t === T.ROCK) continue;
      const k = 0.7 + r() * 0.6, pal = south ? cols.south : cols.north, col = pal[(r() * pal.length) | 0], v = 1.45 + r() * 0.5;
      d.position.set(x, 0, z); d.rotation.set(0, r() * 6.28, 0); d.scale.set(k, k * (0.8 + r() * 0.5), k); d.updateMatrix(); im.setMatrixAt(n, d.matrix); im.setColorAt(n, c.setRGB(col[0] * v, col[1] * v, col[2] * v)); n++;
    }
    im.userData.max = n; im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; this.scene.add(im); this.grass = im;
    this.grassBase = im.instanceMatrix.array.slice(0, n * 16); this.grassVer = -1;
  }
  // pas d'herbe à travers les bâtiments : les touffes sous une emprise (et sur les chemins pavés) sont masquées quand la construction change
  maskGrass() {
    const B = this.sim.build, key = B.version * 10 + (this.sim.eco.up.boots >= 2 ? 1 : 0); if (!this.grass || key === this.grassVer) return; this.grassVer = key;
    const base = this.grassBase, arr = this.grass.instanceMatrix.array, n = base.length / 16, boxes = B.items.map(s => { const [hw, hd] = B.half(s.type, s.rot); return [s.x, s.z, hw + 0.9, hd + 0.9]; });
    for (let i = 0; i < n; i++) {
      const o = i * 16, x = base[o + 12], z = base[o + 14]; let hide = false;
      for (const b of boxes) if (Math.abs(x - b[0]) < b[2] && Math.abs(z - b[1]) < b[3]) { hide = true; break; }
      for (let k = 0; k < 16; k++) arr[o + k] = hide && k !== 15 && k < 12 ? 0 : base[o + k];
    }
    this.grass.instanceMatrix.needsUpdate = true;
  }
  // ——— ombres de contact sous les personnages (ils ne projettent pas d'ombre) : disques sombres instanciés, très bon marché ———
  buildBlobs() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.72)'); gr.addColorStop(0.35, 'rgba(0,0,0,.5)'); gr.addColorStop(0.7, 'rgba(0,0,0,.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const cap = MAX_Z + 600; this.blobs = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }), cap);
    this.blobs.frustumCulled = false; this.blobs.renderOrder = 2; this.blobs.count = 0; this.scene.add(this.blobs);
  }
  updateBlobs(alpha) {
    const im = this.blobs, m = im.instanceMatrix.array, cap = im.instanceMatrix.count; let n = 0;
    const put = (x, z, s, sz = s) => { if (n >= cap) return; const o = n * 16; m[o] = s; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0; m[o + 4] = 0; m[o + 5] = 1; m[o + 6] = 0; m[o + 7] = 0; m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = sz; m[o + 11] = 0; m[o + 12] = x; m[o + 13] = 0.07; m[o + 14] = z; m[o + 15] = 1; n++; };
    const putY = (x, y, z, s) => { if (n >= cap) return; put(x, z, s); m[(n - 1) * 16 + 13] = y; };
    const Z = this.sim.zombies; for (let i = 0; i < Z.n; i++) put(Z.px[i] + (Z.x[i] - Z.px[i]) * alpha, Z.pz[i] + (Z.z[i] - Z.pz[i]) * alpha, 1.5 * ZOMBIES[Z.type[i]].size);
    for (const v of this.sim.eco.villagers) put(v.px + (v.x - v.px) * alpha, v.pz + (v.z - v.pz) * alpha, 1.3);
    for (const w of this.sim.army.walkers) put(w.px + (w.x - w.px) * alpha, w.pz + (w.z - w.pz) * alpha, 1.4);
    // (v3.6) une ombre de contact par combattant (positions laissées par les Rigs), par archer et par cadavre
    for (let i = 0; i < BLOBS.length; i += 4) { const sc = Math.min(5, Math.max(0.9, BLOBS[i + 3] * 0.75)); putY(BLOBS[i], BLOBS[i + 1] + 0.06, BLOBS[i + 2], sc); } BLOBS.length = 0;
    for (const p of this.archerSpots || []) putY(p[0], p[1] + 0.06, p[2], 1.2);
    for (const c of this.corpses || []) { const a = this.clock - c.t0, f = a < 4.55 ? 1 : Math.max(0, 1 - (a - 4.55) / 1.2); if (f > 0.05) put(c.x, c.z, 1.6 * f, 2.2 * f); }
    im.count = n; im.instanceMatrix.needsUpdate = true;
  }
  // ——— torches des portes : flamme + lueur (désactivable avec la qualité) ———
  buildTorches() {
    this.torches = new THREE.Group(); this.torchPos = [];
    for (const [a, b] of GATE_SEGS) for (const x of [a * SEG_W - 0.6, (b + 1) * SEG_W + 0.6]) {
      const tz = WALL_Z0 - 1.2 + wallOff(x), pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.3), lam(0x4a3426)); pole.position.set(x, 1.3, tz);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.55), new THREE.MeshBasicMaterial({ color: 0xffc14a })); fl.position.set(x, 2.9, tz);
      this.torches.add(pole, fl); this.torchPos.push([x, 3.1, tz]);
    }
    this.scene.add(this.torches);
  }
  // ——— indicateur de portée (tour ou secteur d'archers sélectionné) ———
  buildRangeIndicator() {
    const ring = new THREE.RingGeometry(0.97, 1, 64); ring.rotateX(-Math.PI / 2);
    const disc = new THREE.CircleGeometry(1, 48); disc.rotateX(-Math.PI / 2);
    const mat = o => new THREE.MeshBasicMaterial({ color: 0x9ad0ff, transparent: true, opacity: o, depthWrite: false });
    this.rangeRing = new THREE.Mesh(ring, mat(0.9)); this.rangeFill = new THREE.Mesh(disc, mat(0.12)); this.rangeBand = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(0.14));
    this.rangeBand.rotation.x = -Math.PI / 2;
    for (const m of [this.rangeRing, this.rangeFill, this.rangeBand]) { m.visible = false; m.renderOrder = 5; this.scene.add(m); }
  }
  // spec : null | { kind: 'circle', x, z, r } | { kind: 'band', x0, x1, z, r }
  setRangeIndicator(spec) {
    const R = this.rangeRing, F = this.rangeFill, B = this.rangeBand; R.visible = F.visible = B.visible = false; if (!spec) return;
    if (spec.kind === 'circle') { R.visible = F.visible = true; R.position.set(spec.x, 0.35, spec.z); F.position.set(spec.x, 0.3, spec.z); R.scale.set(spec.r, 1, spec.r); F.scale.set(spec.r, 1, spec.r); }
    else { B.visible = true; B.position.set((spec.x0 + spec.x1) / 2, 0.3, spec.z - spec.r / 2); B.scale.set(spec.x1 - spec.x0, spec.r, 1); }
  }
  resize(w, h) { this.lastSize = [w, h]; this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  // Sol : une seule texture 6 px/m, peinte par zones (neige gelée au nord, terre piétinée au front, dalles de la cour, terre battue du village,
  // pavés autour du château), avec chemins à bords doux, gisements, mares gelées, bruit de grain et vignettage. Déterministe (graine fixe).
  // ——— sol (v2.8) : carte d'ensemble (teintes) + carte de répartition herbe / terre / pavés ; la matière fine vient des textures de détail (Ground.js) ———
  buildGround() {
    const k = 6, cv = document.createElement('canvas'); cv.width = W * k; cv.height = D * k; const g = cv.getContext('2d');
    const ks = 2, sv = document.createElement('canvas'); sv.width = W * ks; sv.height = D * ks; const sp = sv.getContext('2d');   // R = terre, G = pavés
    let seed = 99; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + (b - a) * r();
    const X = v => v * k, S = v => v * ks;
    // fond : prairie, plus fraîche au sud, plus sèche et foulée vers le front
    const grad = g.createLinearGradient(0, 0, 0, D * k);
    for (const [z, c] of [[0, '#4f6a3a'], [40, '#5f7d42'], [100, '#6a8445'], [138, '#76824a'], [150, '#6f6c62'], [205, '#6e8a45'], [260, '#6a8a43'], [320, '#5f7e3e']]) grad.addColorStop(z / D, c);
    g.fillStyle = grad; g.fillRect(0, 0, W * k, D * k); sp.fillStyle = '#000'; sp.fillRect(0, 0, sv.width, sv.height);
    const blob = (x, z, rad, col, a) => { const gr = g.createRadialGradient(X(x), X(z), 0, X(x), X(z), X(rad)); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(X(x - rad), X(z - rad), X(rad * 2), X(rad * 2)); };
    // terre : teinte brune sur la carte de couleurs + rouge sur la carte de répartition (même forme)
    const dirt = (x, z, rad, a, col = 'rgba(124,98,66,A)') => { blob(x, z, rad, col, a); const gr = sp.createRadialGradient(S(x), S(z), 0, S(x), S(z), S(rad)); gr.addColorStop(0, `rgba(255,0,0,${Math.min(1, a * 1.6)})`); gr.addColorStop(1, 'rgba(255,0,0,0)'); sp.globalCompositeOperation = 'lighter'; sp.fillStyle = gr; sp.fillRect(S(x - rad), S(z - rad), S(rad * 2), S(rad * 2)); sp.globalCompositeOperation = 'source-over'; };
    // variations de la prairie : herbe grasse, herbe sèche, fleurs des champs
    // variations de la prairie (v3.3) : grandes nappes très douces (herbe grasse / herbe sèche), jamais de taches nettes
    for (let i = 0; i < 260; i++) { const z = r() * D; if (z > WALL_Z0 - 1 && z < 200) continue; const t = r(); blob(r() * W, z, rr(18, 42), t < 0.5 ? 'rgba(84,112,52,A)' : 'rgba(128,132,72,A)', rr(0.05, 0.11)); }
    // types de terrain issus de la simulation (forêt, colline, rocher, route)
    const type = this.sim.terrain.type, pal = { [T.FOREST]: 'rgba(40,66,34,A)', [T.HILL]: 'rgba(140,150,90,A)', [T.ROCK]: 'rgba(110,108,100,A)' };
    for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) { const t = type[gz * GW + gx], x = (gx + .5) * CELL, z = (gz + .5) * CELL; if (t === T.ROAD) dirt(x, z, CELL * 1.2, 0.5); else if (t === T.ROCK) dirt(x, z, CELL * 1.2, 0.35, 'rgba(110,108,100,A)'); else if (t && pal[t] && (gx + gz) % 2 === 0) blob(x, z, CELL * 4, pal[t], 0.1); }   // sous-bois et collines : teinte fondue, pas de tache nette
    // front de bataille : terre foulée de plus en plus marquée vers la muraille (z 100 → 141), ornières
    for (let i = 0; i < 260; i++) { const z = rr(100, 141); dirt(r() * W, z, rr(2.5, 8), 0.12 + 0.4 * (z - 100) / 41); }
    for (let i = 0; i < 200; i++) { const z = rr(96, 141), x = r() * W, len = rr(3, 11), a = 0.08 + 0.25 * (z - 96) / 45; g.strokeStyle = `rgba(92,72,48,${a})`; g.lineWidth = rr(0.5, 1.6) * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(x), X(z)); g.lineTo(X(x + rr(-2, 2)), X(z + len)); g.stroke(); }
    // ——— pavés : la cour (derrière la muraille), autour du château, la placette ———
    const pave = (fill, clip, col) => { g.save(); clip(g, X); g.clip(); g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height); for (let i = 0; i < 260; i++) blob(r() * W, rr(140, 320), rr(2, 7), 'rgba(60,56,50,A)', rr(0.05, 0.14)); g.restore(); sp.save(); clip(sp, S); sp.clip(); sp.fillStyle = '#00ff00'; sp.fillRect(0, 0, sv.width, sv.height); sp.restore(); };
    const wallPoly = (c, f) => { c.beginPath(); for (let x = 0; x <= W; x += 5) c.lineTo(f(x), f(WALL_Z0 + wallOff(x))); for (let x = W; x >= 0; x -= 5) c.lineTo(f(x), f(WALL_Z1 + wallOff(x))); c.closePath(); };
    pave(true, (c, f) => { c.beginPath(); for (let x = 0; x <= W; x += 5) c.lineTo(f(x), f(WALL_Z0 + wallOff(x))); c.lineTo(f(W), f(190)); c.lineTo(f(0), f(190)); c.closePath(); }, '#8f8a80');      // cour militaire + emprise de la muraille
    g.fillStyle = 'rgba(70,66,60,.55)'; wallPoly(g, X); g.fill();
    pave(true, (c, f) => { c.beginPath(); c.ellipse(f(CASTLE.x), f(CASTLE.z), f(36), f(26), 0, 0, 7); }, '#a29a8c');
    pave(true, (c, f) => { c.beginPath(); c.rect(f(PLAZA.x - PLAZA.hw - 1), f(PLAZA.z - PLAZA.hd - 1), f(PLAZA.hw * 2 + 2), f(PLAZA.hd * 2 + 2)); }, '#b8af9c');
    g.strokeStyle = 'rgba(96,86,70,.8)'; g.lineWidth = 0.5 * k; g.beginPath(); g.arc(X(PLAZA.x), X(PLAZA.z), X(7), 0, 7); g.stroke(); g.beginPath(); g.arc(X(PLAZA.x), X(PLAZA.z), X(4), 0, 7); g.stroke();
    g.fillStyle = 'rgba(170,40,30,.35)'; g.beginPath(); g.arc(X(PLAZA.x), X(PLAZA.z), X(2.2), 0, 7); g.fill();
    // bord de la cour : une bande de terre entre les pavés et la prairie du village
    for (let x = 0; x <= W; x += 3) dirt(x + rr(-1, 1), 191 + rr(-1, 1.5), rr(2, 4), 0.4);
    // ——— village : chemins de terre battue, cours de ferme, sol foulé devant les bâtiments ———
    for (let i = 0; i < 160; i++) dirt(r() * W, rr(205, 300), rr(2, 6), rr(0.15, 0.35));
    dirt(40, 255, 11, 0.55); dirt(160, 255, 11, 0.6, 'rgba(120,122,126,A)'); dirt(182, 236, 8, 0.55, 'rgba(84,80,74,A)'); dirt(18, 236, 8, 0.5, 'rgba(110,96,70,A)');
    // ——— chemins : bords doux, ornières ———
    const path = (pts, w) => {
      const draw = (lw, col) => { g.strokeStyle = col; g.lineWidth = lw * k; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z))); g.stroke(); };
      draw(w * 1.5, 'rgba(116,94,68,.18)'); draw(w * 1.1, 'rgba(120,96,66,.4)'); draw(w * 0.8, 'rgba(134,108,76,.6)'); draw(w * 0.2, 'rgba(98,78,56,.45)');
      sp.strokeStyle = 'rgba(255,0,0,.85)'; sp.lineWidth = w * 1.1 * ks; sp.lineCap = sp.lineJoin = 'round'; sp.globalCompositeOperation = 'lighter'; sp.beginPath(); pts.forEach(([x, z], i) => i ? sp.lineTo(S(x), S(z)) : sp.moveTo(S(x), S(z))); sp.stroke(); sp.globalCompositeOperation = 'source-over';
    };
    path([[100, PLAZA.z + PLAZA.hd + 1.5], [100, 284]], 9); path([[100, 238], [40, 255]], 5); path([[100, 238], [160, 255]], 5); path([[100, 262], [182, 243]], 4.5); path([[100, 262], [18, 238]], 4.5); path([[8, 205], [192, 205]], 4); path([[100, 60], [100, 141]], 7);
    // ——— lisières : l'herbe déborde sur la terre et les pavés, en touffes irrégulières (pas de bord net entre deux textures) ———
    {
      const sd = sp.getImageData(0, 0, sv.width, sv.height).data, SW = sv.width, SH = sv.height, nonG = (px, py) => { if (px < 0 || py < 0 || px >= SW || py >= SH) return 0; const o = (py * SW + px) * 4; return Math.min(255, sd[o] + sd[o + 1]) / 255; };
      const tufts = [], cd = g.getImageData(0, 0, cv.width, cv.height).data, grassAt = (x, z) => { const px = Math.max(0, Math.min(cv.width - 1, X(x) | 0)), py = Math.max(0, Math.min(cv.height - 1, X(z) | 0)), o = (py * cv.width + px) * 4; return `rgba(${cd[o]},${cd[o + 1]},${cd[o + 2]},A)`; };
      for (let py = 4; py < SH - 4; py += 2) for (let px = 4; px < SW - 4; px += 2) {
        const zm = py / ks; if (zm > WALL_Z0 + wallOff(px / ks) - 1 && zm < WALL_Z1 + wallOff(px / ks) + 3) continue;   // pas sur l'emprise de la muraille
        const c = nonG(px, py); if (c < 0.5) continue;
        let lo = 0, gx = 0, gz = 0; for (const [dx, dy] of [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, -4], [4, -4], [-4, 4]]) if (nonG(px + dx, py + dy) < Math.min(0.5, c - 0.4)) { lo++; gx += dx; gz += dy; }
        if (!lo) continue; const gl = Math.hypot(gx, gz) || 1;
        tufts.push([px / ks + rr(-0.5, 0.5), py / ks + rr(-0.5, 0.5), gx / gl, gz / gl]);
      }
            sp.save();   // noir opaque par-dessus : R et G (terre, pavés) baissent sans toucher à l'alpha (le shader lit le RVB non prémultiplié)
      const eat = (x, z, rad, a) => { const gr = sp.createRadialGradient(S(x), S(z), 0, S(x), S(z), S(rad)); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); sp.fillStyle = gr; sp.fillRect(S(x - rad), S(z - rad), S(rad * 2), S(rad * 2)); };
      const tuft = (x, z, rad, col, a) => { const gr = g.createRadialGradient(X(x), X(z), 0, X(x), X(z), X(rad)); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(0.55, col.replace('A', a * 0.9)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(X(x - rad), X(z - rad), X(rad * 2), X(rad * 2)); };   // cœur plein, bord doux
      for (const [x, z, ux, uz] of tufts) {
        const col = grassAt(x + ux * 3.2, z + uz * 3.2);   // la teinte de l'herbe voisine : la touffe prolonge le pré
        const n = 2 + (r() * 4 | 0), reach = rr(0.3, 2.6);       // jusqu'où l'herbe mord sur l'autre sol, varie le long du bord
        for (let j = 0; j < n; j++) {
          const t = rr(-0.25, 1) * reach - 1.4, bx = x - ux * t + uz * rr(-1.2, 1.2), bz = z - uz * t - ux * rr(-1.2, 1.2),   // mesuré depuis la lisière (≈ 1,4 m côté herbe)
            rad = rr(0.4, 1.4), a = rr(0.6, 0.95);
          tuft(bx, bz, rad, col, a); eat(bx, bz, rad, a);
        }
        if (r() < 0.25) { const sx = x - ux * rr(1, 4) + rr(-1.5, 1.5), sz = z - uz * rr(1, 4) + rr(-1.5, 1.5), rad = rr(0.18, 0.45); tuft(sx, sz, rad, col, 0.85); eat(sx, sz, rad, 0.85); }   // brin isolé entre deux pavés
      }
      sp.restore();
    }
    // (v3.3) plus de vignettage aux bords : le sol au-delà prolonge exactement la même prairie
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const stex = new THREE.CanvasTexture(sv); stex.colorSpace = THREE.NoColorSpace; stex.magFilter = THREE.LinearFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, D), groundMaterial(tex, stex));
    m.rotation.x = -Math.PI / 2; m.position.set(W / 2, 0, D / 2); m.receiveShadow = true; this.scene.add(m); this.groundMesh = m; this.groundSplat = sv;
  }
  buildTerrainProps() {
    const type = this.sim.terrain.type, rock = [], tree = [];
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let gz = 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) {
      const t = type[gz * GW + gx], x = (gx + .5) * CELL, z = (gz + .5) * CELL;
      if (t === T.ROCK) rock.push([x, z, 1.6 + r() * 1.4]);
      else if (t === T.FOREST && r() < 0.95) { tree.push([x + (r() - .5) * 1.8, z + (r() - .5) * 1.8, 3.4 + r() * 2.4]); if (r() < 0.6) tree.push([x + (r() - .5) * 3.6, z + (r() - .5) * 3.6, 2.6 + r() * 1.8]); }
    }
    const mk = (geo, mat, list, yOff) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); im.count = list.length;
      list.forEach(([x, z, s], i) => { this.dummy.position.set(x, s * yOff, z); this.dummy.scale.set(s, s, s); this.dummy.rotation.y = i; this.dummy.updateMatrix(); im.setMatrixAt(i, this.dummy.matrix); });
      im.instanceMatrix.needsUpdate = true; this.scene.add(im); return im;
    };
    mk(new THREE.DodecahedronGeometry(1, 0), lam(0x8a8f94), rock, 0.55);
    // forêt (dans la carte et tout autour, hors des limites, pour cacher le vide) : sapins à deux étages, teintes variées, neige légère
    // bordure : à côté du champ de bataille seulement ; plus bas, ce sont les forêts vierges à défricher (World.js)
    // forêt de bordure : uniquement au-delà de la crête (couloir nord évasé compris) ; sapins, de plus en plus enneigés vers le nord
    for (let i = 0; i < 2600 && tree.length < 2400; i++) {
      const side = i % 3, z = side === 2 ? D + 10 + r() * 60 : -60 + r() * 270, x = side === 0 ? westEdge(z) - 6 - r() * 190 : side === 1 ? eastEdge(z) + 6 + r() * 190 : -230 + r() * (W + 460);
      if (outsidePlay(x, z) && !(z > FRONTIER.z0 - 6 && z < D + 6 && (x < 0 || x > W))) tree.push([x, z, 2.6 + r() * 2.6]);
    }
    this.buildForest(tree, r);
  }
  buildForest(list, r) {
    const n = list.length, d = this.dummy, c = this.tmpColor, c2 = new THREE.Color();
    const parts = [
      [new THREE.CylinderGeometry(0.16, 0.24, 0.9, 5).translate(0, 0.45, 0), 0x5a3d26, 0],
      [new THREE.ConeGeometry(0.95, 1.7, 7).translate(0, 1.55, 0), 0x2f5d3c, 1],
      [new THREE.ConeGeometry(0.7, 1.4, 7).translate(0, 2.45, 0), 0x3a6b45, 1],
      [new THREE.ConeGeometry(0.34, 0.5, 7).translate(0, 3.05, 0), 0xf2f6fa, 2],
    ];
    const ims = parts.map(([g, col], pk) => { const im = new THREE.InstancedMesh(g, pk ? applyWindFog(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), 0.012) : lam(0xffffff), n); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); this.scene.add(im); return [im, col]; });
    list.forEach(([x, z, s], i) => {
      d.position.set(x, 0, z); d.rotation.set(0, i * 1.7, 0); const sy = s * (0.85 + r() * 0.35); d.scale.set(s, sy, s); d.updateMatrix();
      const hue = r(), v = 0.8 + r() * 0.35, snow = Math.min(1, Math.max(0, (175 - z) / 110 + (r() - 0.5) * 0.5));   // neige : progressive, du nord (plein) au village (aucune)
      ims.forEach(([im, col], k) => {
        im.setMatrixAt(i, d.matrix); c.setHex(col);
        if (parts[k][2] === 1) c.multiplyScalar(v).lerp(c2.setHex(hue < 0.3 ? 0x4a6a3a : hue < 0.55 ? 0x26503f : 0x2f5d3c), 0.5);
        if (parts[k][2] === 2) c.setHex(0x3a6b45).multiplyScalar(v).lerp(c2.setHex(0xf2f6fa), snow);   // pointe : verte → enneigée selon la latitude
        im.setColorAt(i, c);
      });
    });
    for (const [im] of ims) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = true; }
    this.border = buildBorder(this.scene, m => this.shadowize(m));   // crête de collines et rochers + sol de sous-bois au-delà
  }
  buildWall() {
    this.wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(SEG_W - 0.25, 4, 8), lam(0xffffff), SEGS);
    this.wallMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SEGS * 3), 3);
    this.scene.add(this.wallMesh);
    const tw = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 8, 10), lam(0x8c8f96), SECTORS + 1);
    for (let i = 0; i <= SECTORS; i++) { this.dummy.position.set(Math.min(W - 3, Math.max(3, i * SECTOR_W)), 4, 146 + wallOff(i * SECTOR_W)); this.dummy.scale.set(1, 1, 1); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix(); tw.setMatrixAt(i, this.dummy.matrix); }
    this.scene.add(tw); this.towers = tw;
  }
  updateWall() {
    if (this.wv) return this.wv.update();
    if (this.kitWalls) return this.updateKitWall();
    const wall = this.sim.wall, c = this.tmpColor;
    for (let i = 0; i < SEGS; i++) {
      const hpR = wall.hp[i] / wall.segMax(i), breached = wall.hp[i] <= 0;
      const lvl = wall.level[wall.sectorOf(i)];
      this.dummy.position.set(i * SEG_W + SEG_W / 2, breached ? 0.45 : 2, 146 + wallOff(i * SEG_W + SEG_W / 2)); this.dummy.scale.set(1, breached ? 0.22 : 1, 1); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix();
      this.wallMesh.setMatrixAt(i, this.dummy.matrix);
      if (breached) c.setRGB(0.25, 0.16, 0.14);
      else { c.setRGB(0.55 + 0.1 * lvl, 0.55 + 0.1 * lvl, 0.58 + 0.08 * lvl); if (wall.isGate(i)) c.setRGB(0.55, 0.36, 0.2); const dmg = 1 - hpR; c.lerp(this.tmpColor2 || (this.tmpColor2 = new THREE.Color(0.85, 0.18, 0.1)), dmg * 0.9); }
      this.wallMesh.setColorAt(i, c);
    }
    this.wallMesh.instanceMatrix.needsUpdate = true; this.wallMesh.instanceColor.needsUpdate = true;
  }
  // brume du nord : respire lentement et avance pendant un assaut ; pulsation de l'indicateur de portée ; ombres des nouvelles structures
  // ——— ciel (v3.6) : dôme en dégradé (zénith → horizon), suit la caméra, jour / nuit ———
  buildSky() {
    const U = { uZen: { value: new THREE.Color(ATMOS.skyZenith) }, uHor: { value: new THREE.Color(ATMOS.skyHorizon) } };
    const m = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false,
      vertexShader: 'varying vec3 vD; void main() { vD = normalize( position ); vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); gl_Position = p.xyww; }',
      fragmentShader: 'varying vec3 vD; uniform vec3 uZen; uniform vec3 uHor; void main() { float t = pow( clamp( vD.y, 0.0, 1.0 ), 0.55 ); gl_FragColor = vec4( mix( uHor, uZen, t ), 1.0 ); \n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), m); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.skyU = U; this.scene.add(this.sky);
    this.post = null;
  }
  updateAtmosphere(dt) {
    fogUniforms.uWindTime.value = this.clock;
    if (this.sky) { this.sky.position.copy(this.camera.position); const L0 = this.sim.night.light(); this.skyU.uZen.value.setHex(ATMOS.nightZenith).lerp(this._z || (this._z = new THREE.Color(ATMOS.skyZenith)), L0); this.skyU.uHor.value.setHex(ATMOS.nightHorizon).lerp(this._h || (this._h = new THREE.Color(ATMOS.skyHorizon)), L0);
      fogUniforms.uHazeColor.value.copy(this.skyU.uHor.value); fogUniforms.uNFogColor.value.setHex(0x080c14).lerp(this._fc || (this._fc = new THREE.Color(ATMOS.fogColor)), L0); }   // brume du nord et lointain : teinte du ciel, sombres la nuit
    if (this.grassTime) this.grassTime.value = this.clock;
    // jour / nuit : soleil et ciel baissent progressivement ; la nuit est bleutée ; braseros, torches et feux prennent le relais
    const L = this.sim.night.light(), dusk = Math.max(0, 1 - Math.abs(L - 0.55) / 0.3);
    this.sun.intensity = ATMOS.sunIntensity * (0.06 + 0.94 * L); this.sun.color.setHex(ATMOS.sunColor).lerp(this._dusk || (this._dusk = new THREE.Color(0xff8a4a)), dusk * 0.7);
    this.hemi.intensity = ATMOS.hemiIntensity * (0.28 + 0.72 * L); this.hemi.color.setHex(ATMOS.hemiSky).lerp(this._nightSky || (this._nightSky = new THREE.Color(0x3a4f8a)), 1 - L);
    this.dark = 1 - L;
    const sim = this.sim, a = sim.phase === 'assault' || sim.phase === 'alert' ? 1 : 0; this.fogA = (this.fogA || 0) + (a - (this.fogA || 0)) * Math.min(1, dt * 0.5);
    const near = ATMOS.fogNear - ATMOS.fogAssault * this.fogA + ATMOS.fogBreath * Math.sin(this.clock * ATMOS.fogBreathSpeed);
    fogUniforms.uNFogRange.value.set(near, ATMOS.fogFar);
    if (this.rangeRing.visible) { const p = 0.75 + 0.25 * Math.sin(this.clock * 4); this.rangeRing.material.opacity = p; }
    if (quality.shadows) for (const v of this.struct.map.values()) if (!v.g.userData.sh) { v.g.userData.sh = 1; this.shadowize(v.g); }
  }
  buildCastle() {
    // château fort procédural (v3.0), dans le style de la muraille ; le château du kit n'est plus utilisé
    const g = buildCastleFort(CASTLE.x, CASTLE.z); this.scene.add(g); this.keepBoxes = g; this.castleFort = g;
  }
  buildEconomy() {
    this.struct = new StructureView(this.scene, this.sim, this.camera);   // toutes les structures (chantiers, bâtiments, fantôme)
    // points de récolte (gisements) : pastilles colorées au sol
    for (const t in TASKS) {
      const T = TASKS[t]; if (!T.res || t === 'food') continue;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.12, 20), new THREE.MeshBasicMaterial({ color: RES_INFO[T.res].color, transparent: true, opacity: 0.25 }));
      d.position.set(T.site.x, 0.2, T.site.z); this.scene.add(d);
    }
    // forêt des bûcherons : les arbres s'éclaircissent quand on coupe et REPOUSSENT tout seuls (échelle = bois restant)
    { const N = 46, ws = TASKS.wood.site; this.treePos = []; let sd = 31; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < N; i++) { const a = rn() * 6.283, r = 2 + 12 * Math.sqrt(rn()); this.treePos.push([ws.x + Math.cos(a) * r, ws.z + Math.sin(a) * r * 0.8, 1.35 + rn() * 0.7, rn()]); }
      this.treePos.sort((a, b) => a[3] - b[3]);
      const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.count = N; this.scene.add(im); return im; };
      const trunk = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6); trunk.translate(0, 0.8, 0); const fol = new THREE.ConeGeometry(1.5, 3.8, 6); fol.translate(0, 3.2, 0); const snow = new THREE.ConeGeometry(1.05, 2.2, 6); snow.translate(0, 4.7, 0);   // second étage de feuillage (forêt du sud : pas de neige)
      this.treeT = mk(trunk, lam(0x6b4a2c)); this.treeF = mk(fol, applyWindFog(new THREE.MeshLambertMaterial({ color: 0x2f5d3c, flatShading: true }), 0.01)); this.treeS = mk(snow, applyWindFog(new THREE.MeshLambertMaterial({ color: 0x3d7048, flatShading: true }), 0.01)); }
    // gisements découverts par prospection : disque coloré + blocs de minerai ; anneau pulsant pendant l'exploration
    { const cap = 14; this.exDisc = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.3, 16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }), cap); this.exDisc.frustumCulled = false; this.exDisc.count = 0; this.exDisc.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.scene.add(this.exDisc);
      this.exRock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lam(0xffffff), cap * 6); this.exRock.frustumCulled = false; this.exRock.count = 0; this.exRock.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 6 * 3), 3); this.scene.add(this.exRock);
      const rg = new THREE.RingGeometry(4, 5.4, 28); rg.rotateX(-Math.PI / 2); this.pRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x4fd1c5, transparent: true, opacity: 0.85, depthWrite: false })); this.pRing.visible = false; this.scene.add(this.pRing); }
    this.ores = new OreView(this.scene);   // affleurements de minerai en 3D
    const vg = new THREE.BoxGeometry(0.7, 1.5, 0.7); vg.translate(0, 0.75, 0);
    this.vMesh = new THREE.InstancedMesh(vg, lam(0xffffff), VCAP); this.vMesh.frustumCulled = false; this.vMesh.count = 0;
    this.vMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(VCAP * 3), 3); this.scene.add(this.vMesh);
    const cg = new THREE.BoxGeometry(0.7, 0.7, 0.7); this.cMesh = new THREE.InstancedMesh(cg, lam(0xffffff), VCAP); this.cMesh.frustumCulled = false; this.cMesh.count = 0;
    this.cMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(VCAP * 3), 3); this.scene.add(this.cMesh);
    this.loads = buildLoadMeshes(this.scene, applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })), VCAP); this.lcnt = {};   // charges portées modélisées (rondins, sac, pierres, paniers)
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
        if (nd >= 14) break; const f = Math.max(0, e.amount / e.max), rad = 3 + 3 * f;
        d.position.set(e.x, 0.1, e.z); d.rotation.set(0, 0, 0); d.scale.set(rad, 0.4, rad); d.updateMatrix(); this.exDisc.setMatrixAt(nd, d.matrix); this.exDisc.setColorAt(nd, this.tmpColor.setHex(RES_INFO[r].color)); nd++;
        if (e.amount <= 0) continue;
        for (let j = 0; j < 6; j++) { const a = j * 1.05 + e.x, rr = rad * 0.55 * (j % 2 ? 0.6 : 1), s2 = 0.7 + 0.5 * ((j * 7) % 3) / 2; d.position.set(e.x + Math.cos(a) * rr, s2 * 0.5, e.z + Math.sin(a) * rr); d.rotation.set(j, j * 2, 0); d.scale.set(s2, s2 * 0.8, s2); d.updateMatrix(); this.exRock.setMatrixAt(nr, d.matrix); this.exRock.setColorAt(nr, this.tmpColor.setHex(RES_INFO[r].color).lerp(this.white, 0.15)); nr++; }
      }
      this.exDisc.count = nd; this.exRock.count = 0; this.ores.update(this.sim, this.clock); this.exDisc.instanceMatrix.needsUpdate = this.exRock.instanceMatrix.needsUpdate = true; if (nd) { this.exDisc.instanceColor.needsUpdate = true; this.exRock.instanceColor.needsUpdate = true; }
      const P = E.prospect; this.pRing.visible = !!P; if (P) { const pu = 1 + 0.12 * Math.sin(this.clock * 5) + 0.25 * (1 - P.t / P.dur); this.pRing.position.set(P.x, 0.4, P.z); this.pRing.scale.set(pu, pu, pu); }
    }
    if (this.vv) return this.updateVillagersVAT(alpha);
    // ——— villageois (repli) : un modèle par métier, animé selon l'état (marche, outil qui frappe, charge portée) ———
    const R = this.vrigs, vs = E.villagers, t = this.clock, SC = 1.4, FREQ = { wood: 7, stone: 6, iron: 6, gold: 6, food: 3.6, build: 8, repair: 8 }; let nc = 0; for (const r in this.loads) this.lcnt[r] = 0;
    for (const k in R) R[k].begin();
    const lerpAng = (a, b, k) => { const dd = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + dd * k; };
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], x = v.px + (v.x - v.px) * alpha, z = v.pz + (v.z - v.pz) * alpha, dx = v.x - v.px, dz = v.z - v.pz, mv = dx * dx + dz * dz > 2e-6;
      v.rmv = (v.rmv || 0) + ((mv ? 1 : 0) - (v.rmv || 0)) * 0.25;
      const key = v.job ? 'build' : v.task === 'repair' ? 'repair' : (TASK_LOOK[v.task] || v.task || 'idle'), working = v.state === 'gather' || v.state === 'building' || v.state === 'repairing';
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
      if (carrying && this.loads[v.carryRes]) {          // charge portée (modèle) devant la poitrine
        const LM = this.loads[v.carryRes], k = this.lcnt[v.carryRes]++; d.position.set(x + Math.sin(v.rrot) * 0.6, 1.3 + bob, z + Math.cos(v.rrot) * 0.6); d.scale.setScalar(0.0105); d.rotation.set(0, v.rrot, 0); d.updateMatrix(); LM.setMatrixAt(k, d.matrix); nc++;
      }
    }
    for (const k in R) R[k].end();
    this.endLoads();
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
    const R = this.rigs, d = this.dummy, t = this.clock, sel = this.selSquad, tint = this.tmpColor, SCALE = { soldier: HUMAN_H / 1.85, heavy: HUMAN_H * 1.08 / 1.85, cavalry: 1.3, knight: HUMAN_H * 1.1 / 2.0 };
    this.syncTierRigs();
    R.soldier.begin(); R.heavy.begin(); R.cavalry.begin(); R.knight.begin();
    const gold = RANKS.indexOf(this.sim.army.rank(this.sim, 'knight')) >= 3;
    const hh = this.hh; if (hh) for (const k of hh.hg.skins) hh.cnt[k] = 0;
    const lerpAng = (a, b, k) => { let dd = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + dd * k; };
    for (const q of this.sim.army.squads) {
      const U = UNITS[q.type], rig = q.type === 'knight' ? (gold ? R.knightGold : R.knight) : (R[q.type] || R.soldier), horse = q.type === 'cavalry', knight = q.type === 'knight', L = formationLayout(q.form, Math.max(1, q.n), U.size);
      const cx = q.px + (q.x - q.px) * alpha, cz = q.pz + (q.z - q.pz) * alpha, dx = q.x - q.px, dz = q.z - q.pz, mv = dx * dx + dz * dz > 1e-4, fight = q.fight > 0;
      q.rmv = (q.rmv || 0) + ((mv ? 1 : 0) - (q.rmv || 0)) * 0.2;
      q.rrot = mv ? lerpAng(q.rrot ?? Math.PI, Math.atan2(dx, dz), 0.25) : lerpAng(q.rrot ?? Math.PI, Math.PI, 0.05);   // à l'arrêt : face au nord (zombies)
      const sc = SCALE[q.type] || 2.4, mvs = q.rmv, flash = q.hit > 0, isSel = q.id === sel;
      if (flash) tint.setRGB(1.9, 1.2, 1.2); else if (q.healed > 0) tint.setRGB(1.1, 1.7, 1.15); else if (isSel) tint.setRGB(1.3, 1.3, 1.0); else tint.setRGB(1, 1, 1);
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
        else if (knight) {   // grande épée : moulinets amples au-dessus de la tête ; cape qui flotte
          const ph3 = t * 5.5 + k * 1.9, arm = fight ? -1.5 + Math.sin(ph3) * 1.35 : -0.3 - 0.25 * mvs + 0.25 * Math.sin(ph + Math.PI) * mvs, cape = 0.12 + 0.35 * mvs + 0.06 * Math.sin(t * 3 + k);
          rig.push(d.matrix, tint, [0, sw * 0.8, -sw * 0.8, arm, cape]);
        }
        else { const arm = fight ? -1.1 + Math.sin(ph2) * 0.8 : -0.35 - 0.3 * mvs + 0.3 * Math.sin(ph + Math.PI) * mvs; rig.push(d.matrix, tint, [0, sw, -sw, arm]); }
      }
      if (fight) this.meleeFx(q, cx, cz, knight);
    }
    for (const type of ['soldier', 'heavy', 'knight', 'cavalry']) this.renderWalkers(alpha, type, (x, z, rot, mv, i) => {      // recrues en marche vers la placette / à l'attente
      const rig = type === 'knight' ? (gold ? R.knightGold : R.knight) : R[type], sc = SCALE[type], ph = t * 9 + i * 1.7, sw = Math.sin(ph) * 0.75 * (mv ? 1 : 0); tint.setRGB(1, 1, 1);
      d.position.set(x, mv ? Math.abs(Math.sin(ph)) * 0.06 : 0, z); d.scale.set(sc, sc, sc); d.rotation.set(0, rot, 0); d.updateMatrix();
      if (type === 'cavalry') {
        if (hh) { const hg = hh.hg, clip = mv ? 'walk' : 'idle', [c0, cn] = hg.clips[clip], fr = ((t * (mv ? 1 : 0.4) + i * 0.173) % 1 + 1) % 1, an = c0 + fr * cn, skin = hg.skins[(i * 3 + 1) % hg.skins.length], im = hh.meshes[skin], n = hh.cnt[skin]++;
          if (n < 120) { im.setMatrixAt(n, d.matrix); im.anim.array[n] = an; im.setColorAt(n, tint); } this._hm.multiplyMatrices(d.matrix, hg.seat[Math.floor(an)]).multiply(this._rs); rig.push(this._hm, tint, [0, 0.35]); }
        else rig.push(d.matrix, tint, [0, 0.35]);
      } else rig.push(d.matrix, tint, [0, sw, -sw, -0.35 - 0.3 * (mv ? 1 : 0) + 0.3 * Math.sin(ph + Math.PI) * (mv ? 1 : 0), 0.2 + 0.3 * (mv ? 1 : 0)]);
    });
    this.renderBitten(alpha, gold); this.renderDrill(gold);
    R.soldier.end(); R.heavy.end(); R.cavalry.end(); R.knight.end();
    if (hh) for (const k of hh.hg.skins) { const im = hh.meshes[k]; im.count = Math.min(120, hh.cnt[k]); im.instanceMatrix.needsUpdate = true; im.anim.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }
  // ——— production d'unités (v2.8) : bâtiment choisi = recrues à l'exercice devant la porte (épée contre mannequins, tir sur cibles, dressage) ———
  renderDrill(gold) {
    const id = this.struct.sel, s = id ? this.sim.build.get(id) : null, ok = s && ['barracks', 'range', 'stable'].includes(s.type) && s.level > 0 && s.state !== 'site';
    if (!this.drill) {
      const g = new THREE.Group(), wood = lam(0x8a6a3a), straw = lam(0xd8bf6a), red = lam(0xc0392b), white = lam(0xf2ead8);
      const dummy = () => { const d = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.9, 6), wood); p.position.y = 0.95; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.9, 7), straw); b.position.y = 1.5; const a = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.12), wood); a.position.y = 1.65; const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 5), straw); h.position.y = 2.15; d.add(p, b, a, h); return d; };
      const target = () => { const d = new THREE.Group(); for (const [r, m, z] of [[0.9, white, 0], [0.62, red, 0.03], [0.34, white, 0.06], [0.14, red, 0.09]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 16), m); c.rotation.x = Math.PI / 2; c.position.set(0, 1.4, z); d.add(c); } for (const x of [-0.5, 0.5]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), wood); l.position.set(x, 0.8, -0.2); l.rotation.x = -0.15; d.add(l); } return d; };
      const dummies = [0, 1, 2, 3].map(dummy), targets = [0, 1, 2].map(target); for (const o of [...dummies, ...targets]) g.add(o); this.scene.add(g); this.drill = { g, dummies, targets }; this.shadowize(g);
    }
    const D = this.drill; D.g.visible = !!ok; if (!ok) return;
    const R = this.rigs, d = this.dummy, t = this.clock, tint = this.tmpColor.setRGB(1, 1, 1), q = this.sim.army.queues[s.type] || [], busy = q.length > 0, [, hd] = this.sim.build.half(s.type, s.rot || 0), fz = s.z + hd + 4.5, sc = HUMAN_H / 1.85, n = busy ? Math.min(4, 1 + q.length) : 2;
    D.dummies.forEach(o => o.visible = s.type === 'barracks'); D.targets.forEach(o => o.visible = s.type === 'range');
    if (s.type === 'barracks') {        // recrues face aux mannequins, coups d'épée
      for (let k = 0; k < 4; k++) { const x = s.x + (k - 1.5) * 3; D.dummies[k].position.set(x, 0, fz - 2.4); D.dummies[k].rotation.z = k < n ? 0.08 * Math.sin(t * 7 + k) : 0; }
      for (let k = 0; k < n; k++) { const x = s.x + (k - 1.5) * 3, ph = t * (busy ? 7 : 3) + k * 1.3, step = 0.25 * Math.max(0, Math.sin(ph)); d.position.set(x, 0, fz - step); d.rotation.set(0, Math.PI, 0); d.scale.setScalar(sc); d.updateMatrix(); R.soldier.push(d.matrix, tint, [0, 0.3 * Math.sin(ph), -0.3 * Math.sin(ph), -1.1 + Math.sin(ph) * 0.9, 0.2]); }
    } else if (s.type === 'range') {    // archers en ligne, cibles à l'est, flèches
      for (let k = 0; k < 3; k++) { D.targets[k].position.set(s.x + 9, 0, fz - 1 + k * 2.2); D.targets[k].rotation.y = -Math.PI / 2; }
      for (let k = 0; k < n; k++) { const x = s.x - 5, z = fz - 1.5 + k * 1.6, ph = (t * 0.6 + k * 0.37) % 1; d.position.set(x, 0, z); d.rotation.set(0, Math.PI / 2, 0); d.scale.setScalar(sc); d.updateMatrix(); R.soldier.push(d.matrix, tint, [0, 0, 0, -1.45 + (ph > 0.85 ? 0.3 : 0), 0.1]);
        if (busy && ph > 0.85 && ph < 0.88 && this.fx.enabled) { const tz = fz - 1 + (k % 3) * 2.2; for (let e = 0; e < 3; e++) this.fx.P.emit(x + 1, 1.7, z, 32, 0.6, (tz - z) * 2.3, 0.42, 0.1, 0, [0.35, 0.25, 0.15], 0); } }
    } else {                            // dressage : un cavalier tourne sur la carrière, un palefrenier au centre
      const hh = this.hh, cx = s.x, cz = fz + 1, rr = 4.5, sp = busy ? 0.9 : 0.4;
      for (let k = 0; k < Math.min(2, n); k++) {
        const a = t * sp + k * Math.PI, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr, rot = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI;
        d.position.set(x, 0, z); d.rotation.set(0, rot, 0); d.scale.setScalar(1.3); d.updateMatrix();
        if (hh) { const hg = hh.hg, [c0, cn] = hg.clips.walk, fr = (t * sp * 1.6 + k * 0.5) % 1, an = c0 + fr * cn, skin = hg.skins[(k * 3 + 2) % hg.skins.length], im = hh.meshes[skin], i = hh.cnt[skin]++;
          if (i < 120) { im.setMatrixAt(i, d.matrix); im.anim.array[i] = an; im.setColorAt(i, tint); } this._hm.multiplyMatrices(d.matrix, hg.seat[Math.floor(an)]).multiply(this._rs); R.cavalry.push(this._hm, tint, [0, 0.35]); }
        else R.cavalry.push(d.matrix, tint, [0, 0.35]);
      }
      d.position.set(cx, 0, cz); d.rotation.set(0, t * sp + Math.PI / 2, 0); d.scale.setScalar(sc); d.updateMatrix(); R.soldier.push(d.matrix, tint, [0, 0, 0, -0.9, 0.1]);
    }
  }
  // ——— mordus (v2.4) : à terre (couchés, les zombies se ruent dessus), puis relevés, voûtés et verdâtres, qui boitent vers la geôle ; enfermés derrière les barreaux ———
  renderBitten(alpha, gold) {
    const I = this.sim.infection; if (!I || !I.list.length) return; const R = this.rigs, d = this.dummy, t = this.clock, tint = this.tmpColor;
    const SCALE = { soldier: HUMAN_H / 1.85, heavy: HUMAN_H * 1.08 / 1.85, cavalry: HUMAN_H / 1.85, knight: HUMAN_H * 1.1 / 2.0 }, P = I.prison(this.sim);
    I.list.forEach((b, i) => {
      const rig = b.type === 'knight' ? (gold ? R.knightGold : R.knight) : b.type === 'cavalry' ? R.soldier : (R[b.type] || R.soldier), sc = SCALE[b.type] || SCALE.soldier;
      const x = b.px + (b.x - b.px) * alpha, z = b.pz + (b.z - b.pz) * alpha, sick = 1 - Math.max(0, b.t) / INFECTION.turn;   // 0 → 1 à l'approche de la transformation
      tint.setRGB(1 - 0.35 * sick, 1 - 0.1 * sick, 1 - 0.45 * sick);
      if (b.state === 'down') {          // couché sur le dos, se débat
        d.position.set(x, 0.25, z); d.rotation.set(0, b.face, 0); d.rotateX(-Math.PI / 2 + 0.1 * Math.sin(t * 9 + i)); d.scale.setScalar(sc); d.updateMatrix(); rig.push(d.matrix, tint, [0, 0.4 * Math.sin(t * 11 + i), -0.4 * Math.sin(t * 11 + i), -1.6 + 0.6 * Math.sin(t * 13 + i), 0.2]);
        if (Math.random() < 0.15 * this.fx.q.particles) this.fx.P.emit(x, 0.4, z, (Math.random() - 0.5) * 1.5, 1.2, (Math.random() - 0.5) * 1.5, 0.5, 0.18, 6, [0.55, 0.05, 0.05], 0.4);
        return;
      }
      let px = x, pz = z, face = b.face; const mv = Math.hypot(b.x - b.px, b.z - b.pz) > 0.002;
      if (b.state === 'jailed' && P) { const k = I.list.filter(o => o.state === 'jailed').indexOf(b); px = P.x + ((k % 4) - 1.5) * 3.2 + ((k / 4 | 0) % 2 ? 1.2 : 0); pz = P.z + 2.6 - ((k / 4) | 0) * 2.2; face = Math.sin(t * 0.5 + k * 1.7) * 1.2; }   // dans la cage, face aux barreaux
      const ph = t * 6 + i, sw = mv ? Math.sin(ph) * 0.5 : 0, shake = sick > 0.6 ? Math.sin(t * 40 + i) * 0.04 * (sick - 0.6) * 2.5 : 0;
      d.position.set(px + shake, mv ? Math.abs(Math.sin(ph)) * 0.04 : 0, pz); d.rotation.set(0, face, 0); d.rotateX(0.35 + 0.25 * sick); d.scale.setScalar(sc); d.updateMatrix();   // voûté, de plus en plus
      rig.push(d.matrix, tint, [0, sw, -sw, -0.9 + 0.1 * Math.sin(t * 3 + i), 0.1]);
      if (Math.random() < 0.03 * this.fx.q.particles) this.fx.P.emit(px, 1.0, pz, 0, -0.5, 0, 0.6, 0.1, 6, [0.5, 0.04, 0.04], 0.3);   // goutte de sang
    });
  }
  // ——— objets du pack (épée du chevalier, cristaux, grimoire…) : reconstruit les modèles qui les utilisent ———
  // coups de mêlée selon le rang : étincelles (Vétéran), arcs de taille dorés (Élite), onde de choc au sol (Légende) — jamais de magie
  meleeFx(q, cx, cz, knight) {
    const fx = this.fx; if (!fx.enabled) return;
    const tier = RANKS.indexOf(this.sim.army.rank(this.sim, q.type)); if (tier < 1) return;
    const rot = q.rrot ?? Math.PI, fx0 = cx + Math.sin(rot) * (q.rad * 0.8), fz0 = cz + Math.cos(rot) * (q.rad * 0.8), rate = 0.02 * q.n * (knight ? 1.6 : 1) * fx.q.particles;
    if (Math.random() < rate) { const x = fx0 + (Math.random() - 0.5) * q.rad * 1.6, z = fz0 + (Math.random() - 0.5) * 1.5; fx.burst(x, 1.4, z, tier >= 3 ? 6 : 4, 2.5, 2, 0.3, 0.15, 10, tier >= 3 ? [1, 0.85, 0.4] : [0.95, 0.95, 0.85], true); }
    if (tier >= 3 && Math.random() < rate * 0.6) {      // arc de taille : particules additives le long d'un demi-cercle devant le combattant
      const x = fx0 + (Math.random() - 0.5) * q.rad * 1.4, z = fz0 + (Math.random() - 0.5), r = knight ? 1.8 : 1.2, a0 = rot - 1.3, c = tier >= 4 ? [1, 0.82, 0.3] : [0.85, 0.9, 1];
      for (let k = 0; k < 9; k++) { const a = a0 + k / 8 * 2.6; fx.A.emit(x + Math.sin(a) * r, 1.0 + 0.8 * Math.sin(k / 8 * Math.PI), z + Math.cos(a) * r, 0, 0.2, 0, 0.25, 0.32 - k * 0.015, 0, c); }
    }
    if (tier >= 4) { q.slamT = (q.slamT ?? Math.random() * 2) - 1 / 60; if (q.slamT <= 0) { q.slamT = knight ? 1.4 : 2.2; fx.ring(fx0, fz0, q.rad * 2.2 + 3, 0.5, [1, 0.8, 0.35]); fx.burst(fx0, 0.4, fz0, 14, 4, 2, 0.8, 0.5, 8, [0.8, 0.74, 0.62]); fx.flash(fx0, 1.2, fz0, 3, 0.25, [1, 0.8, 0.4]); fx.addShake(0.05); } }
  }
  // rangs : chaque type d'unité a UN rang à la fois (niveau de son bâtiment) → on reconstruit son rig quand le rang change
  swapRig(key, tier, make) {
    if (this.rigTier[key] === tier) return; this.rigTier[key] = tier;
    const old = this.rigs[key]; if (old) for (const m of old.meshes) { this.scene.remove(m); m.dispose(); }
    this.rigs[key] = make();
  }
  syncTierRigs() {
    const sim = this.sim, tierOf = t => RANKS.indexOf(sim.army.rank(sim, t));
    for (const t of ['soldier', 'heavy', 'cavalry']) { const k = tierOf(t); this.swapRig(t, k, () => troopRig(this.scene, t, k)); }
    const kk = tierOf('knight') + (this.knightGlb ? 10 : 0); this.swapRig('knight', kk, () => knightRig(this.scene, kk % 10)); this.rigs.knightGold = this.rigs.knight;
    const w = Math.max(1, sim.eco.level.workshop || 1); for (const t of ['ballista', 'catapult', 'trebuchet']) this.swapRig(t, w, () => siegeRig(this.scene, t, w));
  }
  useKnight() { this.knightGlb = true; this.rigTier.knight = -1; }
  useItems() {
    this.rigTier = {};
    for (const v of this.mageViews.values()) this.scene.remove(v.root); this.mageViews.clear();
    this.struct.setKit(this.struct.kit);
  }
  // ——— magicien : un groupe articulé par magicien ; pose selon l'action (marche, incantation, soin) ; lueur du cristal ———
  // ——— prêtre : prie (bras levés, cercle doré) derrière le secteur menacé ; exorcisme = bâton brandi + lueur dorée ———
  renderPriest(alpha) {
    const P = this.sim.priest; if (!P) return; const L = P.level(this.sim);
    if (!P.here || !L) { if (this.priestV) this.priestV.root.visible = false; return; }
    let v = this.priestV; if (v && v.level !== L) { this.scene.remove(v.root); v = null; }
    if (!v) { v = this.priestV = makePriest(L); v.walk = 0; v.cast = 0; v.heal = 0; v.rot = P.face; this.scene.add(v.root); this.shadowize(v.root); }
    v.root.visible = true; const t = this.clock, x = P.px + (P.x - P.px) * alpha, z = P.pz + (P.z - P.pz) * alpha, mv = Math.hypot(P.x - P.px, P.z - P.pz) > 0.004;
    v.walk += ((mv ? 1 : 0) - v.walk) * 0.15; v.cast += ((P.cast > 0 ? 1 : 0) - v.cast) * 0.25; v.heal += ((P.post && P.cast <= 0 ? 1 : 0) - v.heal) * 0.1;
    let dr = ((P.face - v.rot + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; v.rot += dr * 0.2;
    v.root.position.set(x, 0, z); v.root.scale.setScalar(HUMAN_H / 2.05); v.body.rotation.y = v.rot;
    poseMage(v, { t, walk: v.walk, cast: v.cast, heal: v.heal * 0.8 });
    if (P.post) { v.root.updateMatrixWorld(true); const p = this._tipV || (this._tipV = new THREE.Vector3()); v.tip.getWorldPosition(p); this.fx.glowNow(p.x, p.y, p.z, (P.cast > 0 ? 1.6 : 0.4) * (0.85 + 0.15 * Math.sin(t * 5)), 1, 0.85, 0.4);
      if (Math.random() < 0.25 * this.fx.q.particles) this.fx.A.emit(x + (Math.random() - 0.5) * 2, 0.3, z + (Math.random() - 0.5) * 2, 0, 1.0, 0, 1.4, 0.16, -0.2, [1, 0.88, 0.45]); }
  }
  renderMages(alpha) {
    const M = this.sim.mages; if (!M) return; const seen = new Set(), t = this.clock;
    for (const m of M.list) {
      let v = this.mageViews.get(m.id);
      const lvl = Math.max(1, M.level(this.sim));
      if (v && v.level !== lvl) { this.scene.remove(v.root); this.mageViews.delete(m.id); v = null; }      // nouveau niveau : nouvelle tenue
      if (!v) { v = makeMage(lvl); v.walk = 0; v.cast = 0; v.heal = 0; v.rot = m.face; this.scene.add(v.root); this.mageViews.set(m.id, v); }
      seen.add(m.id);
      const x = m.px + (m.x - m.px) * alpha, z = m.pz + (m.z - m.pz) * alpha, mv = Math.hypot(m.x - m.px, m.z - m.pz) > 0.004, healing = m.cast && (m.cast.k === 'heal' || m.cast.k === 'mend');
      const k = 0.15; v.walk += ((mv ? 1 : 0) - v.walk) * k; v.cast += ((m.cast && !healing ? 1 : 0) - v.cast) * 0.25; v.heal += ((healing ? 1 : 0) - v.heal) * 0.25;
      let dr = ((m.face - v.rot + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; v.rot += dr * 0.2;
      const sc = HUMAN_H / 2.05; v.root.position.set(x, 0, z); v.root.scale.setScalar(sc); v.body.rotation.y = v.rot;
      poseMage(v, { t: t + m.id, walk: v.walk, cast: v.cast, heal: v.heal }); if (v.halo) v.halo.rotation.y = t * 2;
      if (lvl >= 5 && Math.random() < 0.3 * this.fx.q.particles) this.fx.A.emit(x + (Math.random() - 0.5) * 1.6, 0.3, z + (Math.random() - 0.5) * 1.6, 0, 1.2, 0, 1.2, 0.18, -0.2, [1, 0.85, 0.4]);   // archimage : poussière d'or
      v.root.updateMatrixWorld(true); const p = this._tipV || (this._tipV = new THREE.Vector3()); v.tip.getWorldPosition(p);
      const c = m.cast ? m.cast.k : '', pulse = 0.8 + 0.2 * Math.sin(t * 6);
      const col = c === 'heal' ? [0.3, 1, 0.4] : c === 'mend' ? [0.5, 0.7, 1] : c === 'nova' ? [0.5, 0.9, 1] : c === 'fireball' || c === 'meteor' ? [1, 0.5, 0.15] : c === 'lightning' ? [0.7, 0.8, 1] : [0.6, 0.35, 1];
      this.fx.glowNow(p.x, p.y, p.z, (m.cast ? 1.5 : 0.7) * pulse, col[0] * 0.7, col[1] * 0.7, col[2] * 0.7);
      if (m.cast && Math.random() < 0.5) this.fx.A.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 1.5, 0.8, (Math.random() - 0.5) * 1.5, 0.5, 0.25, -0.5, col);
      v.circle.material.color.setRGB(col[0], col[1], col[2]);
      const st = M.stats(this.sim); v.hp.scale.x = Math.max(0.01, m.hp / st.hp); v.mp.scale.x = Math.max(0.01, m.mana / st.mana); v.bars.quaternion.copy(this.camera.quaternion);
    }
    for (const [id, v] of this.mageViews) if (!seen.has(id)) { this.scene.remove(v.root); this.mageViews.delete(id); }
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
  // ——— muraille GLB (assets/wall) : remplace la muraille provisoire / du kit, ajoute escaliers et porte à deux battants ———
  useWall(asset) {
    this.wv = new WallView(this.scene, asset, this.sim, applyNorthFog); for (const m of [this.wv.outer, this.wv.inner, this.wv.core, this.wv.leaves, this.wv.steps, this.wv.merlons, this.wv.butt, this.wv.portcullis]) this.shadowize(m); this.wallMesh.visible = false; if (this.kw) for (const k in this.kw) this.kw[k].visible = false;
    if (this.towerKit) for (const t of this.towerKit) t.scale.setScalar(1);
  }
  // ——— décor issu du kit (assets/world) : remplace les boîtes provisoires quand il est chargé ———
  useKit(kit) {
    this.kit = kit; const d = this.dummy, geo = kit.geo;
    const mk = (name, cap) => { const im = new THREE.InstancedMesh(geo[name], kit.material, cap); im.frustumCulled = false; im.count = 0; this.scene.add(im); return im; };
    const put = (im, i, x, z, ry, sx, sy, sz, y = 0) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); im.setMatrixAt(i, d.matrix); };
    // muraille : variantes de tronçons (la porte utilise le tronçon à escalier), 5 m de long, épaisseur 6 m
    this.wallMesh.visible = false; this.towers.visible = false;
    this.kw = { Wall1: mk('Wall1', SEGS), Wall2: mk('Wall2', SEGS), Wall3: mk('Wall3', SEGS), Wall4: mk('Wall4', 4) };
    this.kitWalls = true; this.put = put; if (this.wv) for (const k in this.kw) this.kw[k].visible = false;
    const tw = [mk('Tower1', 2), mk('Tower2', 6)]; for (const t of tw) t.material = kitMaterial(kit.material.map, 0x4a5f80, 0xb8b2a6);
    let a = 0, b = 0;   // tours : ardoise et pierre grise
    for (let i = 0; i <= SECTORS; i++) { const x = Math.min(W - 3, Math.max(3, i * SECTOR_W)); if (i === 0 || i === SECTORS) put(tw[0], a++, x, 146 + wallOff(x), -Math.atan(wallSlope(x)), 1.15, 1.15, 1.15); else put(tw[1], b++, x, 146 + wallOff(x), -Math.atan(wallSlope(x)), 1.1, 1.1, 1.1); }
    tw[0].count = a; tw[1].count = b; for (const t of tw) { t.instanceMatrix.needsUpdate = true; this.shadowize(t); }
    for (const k in this.kw) this.shadowize(this.kw[k]);
    this.struct.setKit(kit);   // maisons, tours, moulin, entrepôt, grenier : modèles du kit
    // monuments et décor du village
    const one = (name, x, z, ry, sc) => { const m = new THREE.Mesh(geo[name], kitMaterial(kit.material.map, 0x7a3f2a, 0xe2d6bc)); m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(sc); this.scene.add(m); return m; };
    // (v2.3) l'église n'est plus un décor : c'est un bâtiment à construire, avec son prêtre
  }
  updateKitWall() {
    const wall = this.sim.wall, d = this.dummy, c = this.tmpColor, cnt = { Wall1: 0, Wall2: 0, Wall3: 0, Wall4: 0 };
    for (let i = 0; i < SEGS; i++) {
      const hpR = wall.hp[i] / wall.segMax(i), breached = wall.hp[i] <= 0, lvl = wall.level[wall.sectorOf(i)], gate = wall.isGate(i);
      const type = gate ? 'Wall4' : ['Wall1', 'Wall2', 'Wall3'][i % 3], im = this.kw[type], k = cnt[type]++;
      this.put(im, k, i * SEG_W + SEG_W / 2, 146 + wallOff(i * SEG_W + SEG_W / 2), -Math.PI / 2 - Math.atan(wallSlope(i * SEG_W + SEG_W / 2)), 1.45, breached ? 0.28 : 1.12 + 0.03 * lvl, 0.64);
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
    // cadavres : une copie de chaque variante (géométrie clonée : ses propres attributs aAnim / aFade)
    const CC = 140; this.corpses = []; this.zc = ch.zombies.variants.map((v, i) => {
      const g = v.geo.clone(); const im = new THREE.InstancedMesh(g, ch.zombies.fadeMats[i], CC); im.frustumCulled = false; im.count = 0; im.renderOrder = 2;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CC * 3), 3);
      im.anim = new THREE.InstancedBufferAttribute(new Float32Array(CC), 1); im.fade = new THREE.InstancedBufferAttribute(new Float32Array(CC), 1); g.setAttribute('aAnim', im.anim); g.setAttribute('aFade', im.fade); this.scene.add(im); return im;
    }); this.zcCount = new Int32Array(this.zc.length);
    this.zTint = ZOMBIES.map(z => new THREE.Color(0xffffff).lerp(new THREE.Color(z.color), 0.62));   // types plus reconnaissables
    const mk = geo => { const im = new THREE.InstancedMesh(geo, ch.archerMat, SECTORS * ARCHER_SLOTS + 150); im.frustumCulled = false; im.count = 0; this.scene.add(im); return im; };
    this.ab = mk(ch.archer.body); this.abow = mk(ch.archer.bow); this.aMesh.visible = false;
    ch.archer.body.computeBoundingBox(); this.archerBB = ch.archer.body.boundingBox.clone(); this.aGear = null; this.aGearTier = -1;
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
    const cap = VCAP, gm = applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })), vv = { vg, meshes: {}, tools: {}, hats: {}, cnt: {}, gcnt: {} };
    for (const k of vg.tints) {
      const im = new THREE.InstancedMesh(vg.geos[k], vg.mat, cap); im.frustumCulled = false; im.count = 0;
      im.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); im.anim.setUsage(THREE.DynamicDrawUsage); vg.geos[k].setAttribute('aAnim', im.anim); this.scene.add(im); vv.meshes[k] = im;
      const [tool, hat] = GEAR[k] || GEAR.idle, mkG = geo => { if (!geo) return null; const g = new THREE.InstancedMesh(geo, gm, cap); g.frustumCulled = false; g.count = 0; this.scene.add(g); return g; };
      vv.tools[k] = mkG(tool && toolGeometry(tool, vg.handPos)); vv.hats[k] = mkG(hatGeometry(hat, vg.headPos));
    }
    this.vv = vv; this.vMesh.visible = false; for (const r in this.vrigs) for (const m of this.vrigs[r].meshes) m.visible = false;
    this._ty = new THREE.Matrix4().makeTranslation(0, -vg.miny, 0); this._gm = new THREE.Matrix4();
    this._back = backToolMatrix(vg.handPos); this._at = {}; for (const r in LOADS) this._at[r] = new THREE.Matrix4().makeTranslation(...LOADS[r].at);   // outil dans le dos ; place de chaque charge sur le buste
  }
  endLoads() { for (const r in this.loads) { const m = this.loads[r]; m.count = this.lcnt[r]; m.instanceMatrix.needsUpdate = true; } }
  // améliorations du village rendues visibles : chariots (brouettes/charrettes), chemins pavés, outils (teinte des fers)
  syncVillageUpgrades() {
    const up = this.sim.eco.up;
    if (this.cartLevel !== up.carts) {
      this.cartLevel = up.carts; if (this.cart) { this.scene.remove(this.cart.mesh); this.cart = null; }
      if (up.carts > 0) { const c = carrierGeometry(up.carts), m = new THREE.InstancedMesh(c.geo, this.chars ? this.chars.archerMat : lam(0xffffff), VCAP); m.frustumCulled = false; m.count = 0; this.scene.add(m); this.cart = { mesh: m, load: c.load }; }
    }
    if (this.vv && this.toolLevel !== up.tools) { this.toolLevel = up.tools; const c = new THREE.Color(TOOL_TINT[Math.min(4, up.tools)]); for (const k in this.vv.tools) { const g = this.vv.tools[k]; if (!g) continue; if (!g.userData.base) g.userData.base = g.geometry.attributes.color.array.slice(); const a = g.geometry.attributes.color.array, b0 = g.userData.base; for (let i = 0; i < a.length; i += 3) { const grey = Math.abs(b0[i] - b0[i + 2]) < 0.08 && b0[i] > 0.35; if (grey) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } } g.geometry.attributes.color.needsUpdate = true; } }
  }
  updateVillagersVAT(alpha) {
    this.syncVillageUpgrades();
    const E = this.sim.eco, d = this.dummy, vv = this.vv, vg = vv.vg, t = this.clock, vs = E.villagers, SC = 0.0105 * HUMAN_H / 1.99;
    const SPEED = { walk: 1.3, carry: 1.2, shoulder: 1.2, idle: 0.35 }, WORK = { wood: 0.9, stone: 0.8, iron: 0.8, gold: 0.8, food: 0.55, build: 1.0, repair: 1.0 };
    for (const k in vv.meshes) { vv.cnt[k] = 0; } for (const r in this.loads) this.lcnt[r] = 0;
    const lerpAng = (a, b, k) => { const dd = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + dd * k; };
    let nc = 0;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], x = v.px + (v.x - v.px) * alpha, z = v.pz + (v.z - v.pz) * alpha, dx = v.x - v.px, dz = v.z - v.pz, mv = dx * dx + dz * dz > 2e-6;
      const key = v.job ? 'build' : v.task === 'repair' ? 'repair' : (TASK_LOOK[v.task] || v.task || 'idle'), working = v.state === 'gather' || v.state === 'building' || v.state === 'repairing', carrying = v.carry > 0;
      let want = v.rrot ?? Math.PI;
      if (mv) want = Math.atan2(dx, dz);
      else if (v.state === 'building') { const s = this.sim.build.get(v.job); if (s) want = Math.atan2(s.x - v.x, s.z - v.z); }
      else if (v.state === 'repairing') want = Math.PI;
      else if (v.state === 'gather' && v.sx !== null && v.sx !== undefined) want = Math.atan2(v.sx - v.x, v.sz - v.z);
      v.rrot = lerpAng(v.rrot ?? Math.PI, want, mv ? 0.3 : 0.15);
      const LD = carrying ? LOADS[v.carryRes] : null, cclip = this.cart || !LD ? 'carry' : (vg.clips[LD.clip] ? LD.clip : 'carry');   // portage : devant (pierre, paniers, brouette) ou sur l'épaule (rondins, sac)
      const clip = working && !mv ? 'work' : carrying ? cclip : mv ? 'walk' : 'idle', [c0, cn] = vg.clips[clip];
      const spd = clip === 'work' ? (WORK[key] || 0.9) : SPEED[clip] || 1, ph = (t * spd + i * 0.37) % 1, an = c0 + ph * cn, k = vv.cnt[key]++, im = vv.meshes[key];
      d.position.set(x, 0, z); d.scale.set(SC, SC, SC); d.rotation.set(0, v.rrot, 0); d.updateMatrix();
      im.setMatrixAt(k, d.matrix); im.anim.array[k] = an;
      const f0 = Math.floor(an), tl = vv.tools[key], ht = vv.hats[key];
      if (tl) { this._gm.copy(d.matrix).multiply(this._ty); if (carrying) this._gm.multiply(vg.spine[f0]).multiply(this._back); else this._gm.multiply(vg.hand[f0]); tl.setMatrixAt(k, this._gm); }   // en portant : outil rangé dans le dos
      if (v.task === 'fire' && this.sim.night.light() < 0.75) { this.fx.glowNow(x + Math.sin(v.rrot) * 0.4, 2.2, z + Math.cos(v.rrot) * 0.4, 0.55 + 0.08 * Math.sin(t * 9 + i), 1, 0.55, 0.15); }   // torche de l'allumeur
      if (ht) { this._gm.copy(d.matrix).multiply(this._ty).multiply(vg.head[f0]); ht.setMatrixAt(k, this._gm); }
      if (carrying) {
        const cart = this.cart, cs = cart ? cart.load : null, LM = this.loads[v.carryRes];
        if (cart) {   // brouette / charrette poussée devant le porteur, chargement modélisé posé dedans
          const fx = x + Math.sin(v.rrot) * 1.1, fz = z + Math.cos(v.rrot) * 1.1; d.position.set(fx, 1.15, fz); d.scale.set(1, 1, 1); d.rotation.set(0, v.rrot, 0); d.updateMatrix(); cart.mesh.setMatrixAt(nc, d.matrix);
          if (LM) { const lx = cs[0], ly = cs[1], lz = cs[2], s1 = Math.sin(v.rrot), c1 = Math.cos(v.rrot), kk = (LD.axis === 2 ? cs[5] : cs[3]) / (LD.span * SC) * 0.95 * SC;
            d.position.set(fx + lx * c1 + lz * s1, 1.15 + ly + cs[4] * 0.25, fz - lx * s1 + lz * c1); d.scale.setScalar(kk); d.updateMatrix(); LM.setMatrixAt(this.lcnt[v.carryRes]++, d.matrix); }
        } else if (LM) { this._gm.copy(d.matrix).multiply(this._ty).multiply(vg.spine[f0]).multiply(this._at[v.carryRes]); LM.setMatrixAt(this.lcnt[v.carryRes]++, this._gm); }
        nc++;
      }
    }
    for (const k in vv.meshes) { const n = vv.cnt[k], im = vv.meshes[k]; im.count = n; im.instanceMatrix.needsUpdate = true; im.anim.needsUpdate = true; for (const g of [vv.tools[k], vv.hats[k]]) if (g) { g.count = n; g.instanceMatrix.needsUpdate = true; } }
    this.cMesh.count = 0; this.endLoads();
    if (this.cart) { this.cart.mesh.count = nc; this.cart.mesh.instanceMatrix.needsUpdate = true; }
  }
  renderZombies(alpha) {
    const Z = this.sim.zombies, n = Z.n, cnt = this.zvCount.fill(0), clock = this.clock, tc = this.tmpColor;
    const G = this.golems || (this.golems = golemRig(this.scene)), d = this.dummy; G.begin();
    for (let i = 0; i < n; i++) {
      if (Z.type[i] === 6) {     // golem : géant zombie à la masse — lève la masse au-dessus de la tête puis l'abat (muraille ou troupes)
        const x = Z.px[i] + (Z.x[i] - Z.px[i]) * alpha, z = Z.pz[i] + (Z.z[i] - Z.pz[i]) * alpha, dx = Z.x[i] - Z.px[i], dz = Z.z[i] - Z.pz[i], mv = dx * dx + dz * dz > 4e-6;
        const zr = this.zRot || (this.zRot = new Float32Array(MAX_Z)); if (mv) zr[i] = Math.atan2(dx, dz);
        const rot = mv || Z.bite[i] > 0 ? zr[i] : 0, sc = ZOMBIES[6].size * HUMAN_H / 2.95, ph = clock * 2.0 + Z.phase[i], sw = mv ? Math.sin(ph) * 0.4 : 0;
        const crush = Z.biteK[i] === 5 && Z.bite[i] > 0, wallHit = Z.state[i] === 1 && !crush, f = crush ? 1 - Z.bite[i] / 1.4 : wallHit ? 1 - Math.max(0, Z.slam[i]) / 3.5 : 0;
        const swing = crush || wallHit, up = f < 0.7 ? -3.0 * (f / 0.7) : -3.0 + 3.6 * Math.min(1, (f - 0.7) / 0.15);   // élan lent, frappe brutale
        const armR = swing ? up : -0.25 + sw * 0.5 + 0.06 * Math.sin(clock * 1.3 + i), armL = swing ? -0.5 - 0.4 * Math.sin(f * 3.14) : -0.15 - sw * 0.6;
        const lean = swing ? (f < 0.7 ? -0.12 * f : 0.25) : 0.05 * Math.sin(ph * 2);
        d.position.set(x, Math.abs(Math.sin(ph)) * 0.1 * (mv ? 1 : 0), z); d.rotation.set(lean, rot, mv ? 0.05 * Math.sin(ph) : 0); d.scale.setScalar(sc); d.updateMatrix();
        const hurt = Z.hp[i] / ZOMBIES[6].hp < 0.5 ? 0.75 : 1; tc.setRGB(hurt, hurt * 0.95, hurt * 0.92); if (Z.slow[i] > 0) tc.setRGB(0.7, 0.9, 1.3);
        G.push(d.matrix, tc, [0, sw, -sw, armL, armR, swing ? (f < 0.7 ? -0.25 : 0.35) : 0.12 + 0.12 * Math.sin(clock * 0.9 + i)]); continue;   // tête : hoche, se rejette en arrière à l'élan
      }
      const t = Z.type[i], Zt = ZOMBIES[t], pool = ZVAR[t], vi = pool[((Z.phase[i] * 1000) | 0) % pool.length], im = this.zv[vi], k = cnt[vi]++;
      const x = Z.px[i] + (Z.x[i] - Z.px[i]) * alpha, z = Z.pz[i] + (Z.z[i] - Z.pz[i]) * alpha, dx = Z.x[i] - Z.px[i], dz = Z.z[i] - Z.pz[i];
      const zr = this.zRot || (this.zRot = new Float32Array(MAX_Z)), moving = dx * dx + dz * dz > 4e-6; if (moving) zr[i] = Math.atan2(dx, dz);
      const rot = moving || Z.bite[i] > 0 ? zr[i] : 0, c = Math.cos(rot), s2 = Math.sin(rot), sc = Zt.size * HUMAN_H / 1.6, o = k * 16, m = im.instanceMatrix.array;
      // morsures (v2.4) : 1 morsure debout (se penche et happe), 2 plongeon (se jette à l'horizontale), 3 déchirement (géant : se cabre, puis boit), 4 coup (lourd)
      let pitch = Z.state[i] !== 1 && Z.pace(i, x, z) > 1 ? 0.12 + 0.12 * Z.rushK[i] : 0, fwd = 0, y = 0; const bk = Z.biteK[i], bt = Z.bite[i];   // en course : penché en avant
      if (bt > 0) {
        if (bk === 1) { const f = 1 - bt / 0.75, e = Math.sin(Math.PI * Math.min(1, f * 1.3)); pitch = 0.55 * e; fwd = 0.45 * e; }
        else if (bk === 2) { const f = 1 - bt / 1.1; pitch = f < 0.35 ? 1.4 * (f / 0.35) : 1.4; fwd = Math.min(1, f / 0.35) * 1.3; y = f < 0.35 ? 0.35 * Math.sin(Math.PI * f / 0.35) : 0.05; }
        else if (bk === 3) { const f = 1 - bt / 2.2; pitch = f < 0.35 ? -0.35 * (f / 0.35) : f < 0.5 ? 0.25 : -0.45; }
        else if (bk === 4) { const f = 1 - bt / 0.9; pitch = f < 0.5 ? -0.3 * (f / 0.5) : -0.3 + 0.9 * ((f - 0.5) / 0.5); }
      }
      const cp = Math.cos(pitch), sp = Math.sin(pitch), px0 = x + s2 * fwd, pz0 = z + c * fwd;
      m[o] = c * sc; m[o + 1] = 0; m[o + 2] = -s2 * sc; m[o + 3] = 0; m[o + 4] = s2 * sp * sc; m[o + 5] = cp * sc; m[o + 6] = c * sp * sc; m[o + 7] = 0; m[o + 8] = s2 * cp * sc; m[o + 9] = -sp * sc; m[o + 10] = c * cp * sc; m[o + 11] = 0; m[o + 12] = px0; m[o + 13] = y; m[o + 14] = pz0; m[o + 15] = 1;
      const pace = Z.pace(i, x, z);   // pas traînant au loin, course près du mur
      const cps = Z.state[i] === 1 ? 1.3 : Math.max(0.25, Zt.speed * pace * (Z.slow[i] > 0 ? 0.4 : 1) / (1.6 * sc));
      im.anim.array[k] = ((clock * cps + Z.phase[i] / 6.2832) % 1) * 16;
      const hurt = Z.hp[i] / Zt.hp < 0.5 ? 0.72 : 1, tt = Z.turned[i] ? this.turnTint || (this.turnTint = new THREE.Color(0x8fa0b8)) : this.zTint[t], ca = im.instanceColor.array;   // ancien soldat : teinte de sa tunique
      if (Z.slow[i] > 0) { ca[k * 3] = 0.6; ca[k * 3 + 1] = 0.85; ca[k * 3 + 2] = 1.3; } else { ca[k * 3] = tt.r * hurt + (1 - hurt) * 0.5; ca[k * 3 + 1] = tt.g * hurt; ca[k * 3 + 2] = tt.b * hurt; }   // gelé : bleuté   // blessé : plus sombre, rougeâtre
    }
    this.zv.forEach((im, v) => { im.count = cnt[v]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.anim.needsUpdate = true; });
    G.end(); this.renderCorpses();
  }
  // ——— morts (v3.4) : le zombie tombe (0,55 s), gît au sol ~4 s puis s'efface en transparence (1,2 s) ———
  renderCorpses() {
    if (!this.zc) return; const Z = this.sim.zombies, now = this.clock, L = this.corpses;
    for (const f of Z.fallen.splice(0)) { if (f.t === 6) continue; const pool = ZVAR[f.t]; L.push({ x: f.x, z: f.z, vi: pool[((f.ph * 1000) | 0) % pool.length], t: f.t, rot: Math.atan2(f.dx, f.dz) || f.ph, back: f.ph % 2 < 1, t0: now, fr: (f.ph * 2.5) % 16 }); }
    while (L.length > 140) L.shift();
    const cnt = this.zcCount.fill(0), FALL = 0.55, LIE = 4.0, FADE = 1.2;
    for (let j = L.length - 1; j >= 0; j--) {
      const c = L[j], a = now - c.t0; if (a > FALL + LIE + FADE) { L.splice(j, 1); continue; }
      const im = this.zc[c.vi], k = cnt[c.vi]++;
      const f = Math.min(1, a / FALL), e = f * f, pitch = (c.back ? -1 : 1) * 1.45 * e, sc = ZOMBIES[c.t].size * HUMAN_H / 1.6;
      const cr = Math.cos(c.rot), sr = Math.sin(c.rot), cp = Math.cos(pitch), sp = Math.sin(pitch), m = im.instanceMatrix.array, o = k * 16, y = 0.12 * Math.sin(Math.PI * f) * (1 - f);
      m[o] = cr * sc; m[o + 1] = 0; m[o + 2] = -sr * sc; m[o + 3] = 0; m[o + 4] = sr * sp * sc; m[o + 5] = cp * sc; m[o + 6] = cr * sp * sc; m[o + 7] = 0; m[o + 8] = sr * cp * sc; m[o + 9] = -sp * sc; m[o + 10] = cr * cp * sc; m[o + 11] = 0; m[o + 12] = c.x; m[o + 13] = y; m[o + 14] = c.z; m[o + 15] = 1;
      im.anim.array[k] = c.fr; im.fade.array[k] = a < FALL + LIE ? 1 : Math.max(0, 1 - (a - FALL - LIE) / FADE);
      const tt = this.zTint[c.t], ca = im.instanceColor.array, d = 0.7 - 0.15 * f; ca[k * 3] = tt.r * d; ca[k * 3 + 1] = tt.g * d; ca[k * 3 + 2] = tt.b * d;   // un peu plus sombre au sol
    }
    this.zc.forEach((im, v) => { im.count = cnt[v]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.anim.needsUpdate = true; im.fade.needsUpdate = true; });
  }
  // équipement des archers selon leur rang : capuche → calotte d'acier → cape → heaume doré à cimier et cape pourpre
  archerGear(tier) {
    if (this.aGearTier === tier) return this.aGear; this.aGearTier = tier;
    if (this.aGear) { this.scene.remove(this.aGear); this.aGear.geometry.dispose(); this.aGear = null; }
    const bb = this.archerBB, top = bb.max.y, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, h = top - bb.min.y, k = h / 1.78, G = 0xf2c94a, list = [];
    const B = (w, hh, dd, c, x, y, z) => list.push(bx(w * k, hh * k, dd * k, c, cx + x * k, top + y * k, cz + z * k));
    if (tier === 0) B(0.34, 0.14, 0.34, 0x6b5236, 0, -0.1, 0);
    if (tier === 1) { B(0.36, 0.16, 0.36, 0x3d6b3a, 0, -0.08, 0); B(0.2, 0.18, 0.08, 0x3d6b3a, 0, -0.26, -0.16); }
    if (tier >= 2) { B(0.36, 0.14, 0.38, tier >= 4 ? G : 0xb8c0c8, 0, -0.06, 0); B(0.42, 0.04, 0.44, tier >= 4 ? G : 0x8e98a4, 0, -0.13, 0); }
    if (tier >= 3) { B(0.5, 0.95, 0.05, tier >= 4 ? 0x7a1f6a : 0x2f5f3a, 0, -1.05, -0.2); B(0.52, 0.06, 0.06, G, 0, -1.5, -0.2); }
    if (tier >= 4) B(0.06, 0.3, 0.3, G, 0, 0.12, -0.02);
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(mergeGeometries(list, false), this.chars.archerMat, SECTORS * ARCHER_SLOTS + 150); m.frustumCulled = false; m.count = 0; this.scene.add(m); this.aGear = m; return m;
  }
  renderArchers(alpha) {
    const sim = this.sim, d = this.dummy, W = sim.army.walkers; let ai = 0, k = 0; const slot = { x: 0, z: 0 };
    const gear = this.archerGear(RANKS.indexOf(sim.army.rank(sim, 'archer'))), spots = this.archerSpots = [];
    for (let s = 0; s < SECTORS; s++) { const A = sim.army.archers[s]; for (k = 0; k < A.n; k++) {
      const p = archerPose(s, k, A.prog[k]), moving = A.prog[k] < 1e8, bob = moving ? Math.abs(Math.sin(this.clock * 9 + k)) * 0.08 : 0;
      d.position.set(p.x, p.y + bob, p.z); d.scale.set(ASC, ASC, ASC); d.rotation.set(0, p.rot, 0); d.updateMatrix(); spots.push([p.x, p.y, p.z]);
      this.ab.setMatrixAt(ai, d.matrix); this.abow.setMatrixAt(ai, d.matrix); if (gear) gear.setMatrixAt(ai, d.matrix); ai++;
    } }
    this.renderWalkers(alpha, 'archer', (x, z, rot, mv) => { d.position.set(x, mv ? Math.abs(Math.sin(this.clock * 9 + ai)) * 0.08 : 0, z); d.scale.set(ASC, ASC, ASC); d.rotation.set(0, rot, 0); d.updateMatrix(); this.ab.setMatrixAt(ai, d.matrix); this.abow.setMatrixAt(ai, d.matrix); if (gear) gear.setMatrixAt(ai, d.matrix); ai++; });
    // archers projetés du chemin de ronde par un golem : chute en vrille vers la cour, puis restent au sol (morts) ou se relèvent
    for (const f of sim.fallers || []) {
      if (ai >= this.ab.instanceMatrix.count) break;
      const k = Math.min(1, f.t / 0.9), y = WALK_H * (1 - k * k), zz = f.z + 7 * k, roll = Math.min(1.5, f.t * 3);
      if (!f.dead && f.t > 2) { d.position.set(f.x, 0, zz); d.rotation.set(0, f.rot, 0); }
      else { d.position.set(f.x, y + (k >= 1 ? 0.25 : 0), zz); d.rotation.set(-roll, f.rot + f.t * (k < 1 ? 6 : 0), 0); }
      d.scale.setScalar(ASC); d.updateMatrix(); this.ab.setMatrixAt(ai, d.matrix); this.abow.setMatrixAt(ai, d.matrix); if (gear) gear.setMatrixAt(ai, d.matrix); ai++;
    }
    this.ab.count = this.abow.count = ai; this.ab.instanceMatrix.needsUpdate = this.abow.instanceMatrix.needsUpdate = true; if (gear) { gear.count = ai; gear.instanceMatrix.needsUpdate = true; }
  }
  // recrues : chaque unité créée marche de son bâtiment au point de ralliement ; draw(x, z, rotY, enMarche, indexDansLaListe)
  renderWalkers(alpha, only, draw) {
    const W = this.sim.army.walkers; let shown = 0;
    for (let i = 0; i < W.length && shown < 140; i++) {
      const w = W[i]; if (w.type !== only) continue;
      const x = w.px + (w.x - w.px) * alpha, z = w.pz + (w.z - w.pz) * alpha, dx = w.x - w.px, dz = w.z - w.pz, mv = dx * dx + dz * dz > 1e-5;
      w.rot = mv ? Math.atan2(dx, dz) : (w.rot ?? Math.PI); draw(x, z, w.rot, mv, i); shown++;
    }
  }
  // point du monde → pixels écran (pour les bulles d'interface ancrées sur la carte)
  project(x, y, z) { const v = this._pv || (this._pv = new THREE.Vector3()); v.set(x, y, z).project(this.camera); const r = this.renderer.domElement.getBoundingClientRect(); return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top, vis: v.z > -1 && v.z < 1 }; }
  setSquad(id) { this.selSquad = id || 0; }
  orderPing(x, z, field) { this.fx.ring(x, z, 6, 0.6, field ? [1, 0.45, 0.2] : [0.4, 0.8, 1]); this.fx.flash(x, 1, z, 2, 0.3, field ? [1, 0.5, 0.2] : [0.4, 0.8, 1]); }
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
    this.renderSquads(alpha); this.renderMages(alpha); this.renderPriest(alpha); const sel = this.selSquad;
    // anneau de l'escouade choisie + marqueur de sortie
    const sq = sel ? sim.army.squads.find(q => q.id === sel) : null;
    this.ring.visible = !!sq;
    if (sq) {
      const cx = sq.px + (sq.x - sq.px) * alpha, cz = sq.pz + (sq.z - sq.pz) * alpha, r = sq.rad + 1.5;
      this.ring.position.set(cx, 0.35, cz); this.ring.scale.set(r, r, r);
      const dest = sq.way.length ? sq.way[sq.way.length - 1] : sq.mode === 'field' ? { x: sq.tx, z: sq.tz } : null;
      this.mark.visible = !!dest; if (dest) this.mark.position.set(dest.x, 0.35, dest.z); this.mark.material.color.setHex(sq.mode === 'field' ? 0xff6a3d : 0x6fd0ff); const pu = 1 + 0.12 * Math.sin(this.clock * 6); this.mark.scale.set(pu, pu, pu);
    } else this.mark.visible = false;
    this.targeting.visible = this.targetMode;
    if (!this.rallyG) {                                                         // fanion du point de ralliement
      const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), lam(0x4a3320)); pole.position.y = 2.5; g.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.08), lam(0xd23a2a)); flag.position.set(1.1, 4.3, 0); g.add(flag); const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 28), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; g.add(ring);
      this.rallyG = g; this.rallyFlag = flag; this.scene.add(g);
    }
    this.rallyG.position.set(sim.army.rally.x, 0, sim.army.rally.z - 4.5); this.rallyFlag.rotation.y = 0.25 * Math.sin(this.clock * 3);
    if (this.ab) this.renderArchers(alpha); else {
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
      const a = ar[i], f = Math.min(1, a.t / 0.3), x = a.x0 + (a.x1 - a.x0) * f, z = a.z0 + (a.z1 - a.z0) * f, y = (a.h || 6.4) * (1 - f) + 1 + 3 * Math.sin(Math.PI * f);
      d.position.set(x, y, z); d.scale.set(1, 1, 1); d.rotation.set(0, Math.atan2(a.x1 - a.x0, a.z1 - a.z0), 0); d.updateMatrix(); this.arMesh.setMatrixAt(i, d.matrix); if (a.fire) { this.tmpColor.setRGB(1, 0.5, 0.1); this.fx.glowNow(x, y, z, 0.5, 1, 0.5, 0.12); if (Math.random() < 0.5) this.fx.A.emit(x, y, z, 0, 0.4, 0, 0.3, 0.22, 0, [1, 0.55, 0.1]); } else this.tmpColor.setRGB(1, 0.95, 0.7); this.arMesh.setColorAt(i, this.tmpColor);
    }
    this.arMesh.instanceMatrix.needsUpdate = true; if (this.arMesh.instanceColor) this.arMesh.instanceColor.needsUpdate = true;
    // alertes de secteur (menace proche / attaque)
    for (let s = 0; s < SECTORS; s++) {
      const dg = sim.danger(s), tgt = sim.phase === 'alert' && sim.targets.includes(s);
      const o = dg === 2 ? 0.28 + 0.12 * Math.sin(this.clock * 8) : dg === 1 ? 0.12 : tgt ? 0.1 + 0.08 * Math.sin(this.clock * 5) : 0;
      this.threat[s].material.opacity = o;
    }
    this.updateWall(); this.updateEconomy(alpha); this.updateSiege(alpha); this.struct.update(dtReal, this.clock);
    this.updateAtmosphere(dtReal); this.updateBlobs(sim.speed ? alpha : 1); this.maskGrass();
    this.fx.setTorches(this.torchPos, sim.army.gate, this.clock);
    // monde étendu : forêts à défricher, routes, braseros (les objets de la simulation sont recréés à chaque nouvelle partie)
    if (this.frontierV.F !== sim.frontier) { this.frontierV.F = sim.frontier; this.frontierV.ver = -1; }
    this.braziers.N = sim.night; this.frontierV.update(this.clock); this.roadV.update(sim);
    this.braziers.update(this.fx, this.clock, this.camera, this.dark || 0);
    this.fx.frame(sim, dtReal);   // effets : lit l'état, ne le modifie pas
    for (const v of this.struct.map.values()) { const o = v.model && v.model.userData.spin; if (o) { o.rotation.y = this.clock * 0.6; o.children.forEach((c, i) => { c.position.y = Math.sin(this.clock * 1.4 + i * 1.7) * 0.7; c.rotation.y = this.clock * 1.5; }); } }
    // secousse de caméra (explosions, brèches) : décalage le temps du rendu seulement
    const sh = this.fx.shake * (this.shakeOn === false ? 0 : 1), cp = this.camera.position;
    if (sh > 0.01) { const ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh * 0.6, oz = (Math.random() - 0.5) * sh; cp.x += ox; cp.y += oy; cp.z += oz; this.camera.updateMatrixWorld(); this.draw(); cp.x -= ox; cp.y -= oy; cp.z -= oz; this.camera.updateMatrixWorld(); }
    else this.draw();
  }
  // rendu final : direct, ou avec occlusion ambiante + halo en qualité « Haute »
  draw() {
    if (quality.post) {
      if (!this.post) this.post = new Post(this.renderer);
      const dk = this.dark || 0; this.post.render(this.scene, this.camera, { ao: 0.85, bloom: 0.25 + 0.95 * dk, threshold: 0.95 - 0.45 * dk, exposure: ATMOS.exposure });
    } else this.renderer.render(this.scene, this.camera);
  }
}
