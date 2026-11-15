// Monde étendu (v2.0) : forêts vierges latérales (parcelles à défricher), routes du réseau et tracées, braseros, nuit.
// Pure vue : lit sim.frontier, sim.roads, sim.night.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FRONTIER, ROADWORKS } from '../content/medieval.js';
import { FIRE_KEEP } from '../content/medieval.js';
import { applyNorthFog } from './fog.js';
import { groundMaterial } from './Ground.js';

const lamV = () => applyNorthFog(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
function colored(geo, hex) { const g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('uv'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('normal'); return g; }

// ——— forêts latérales : sapins et feuillus par parcelle ; ils tombent au fur et à mesure du défrichage ; souches ensuite ———
export class FrontierView {
  constructor(scene, frontier) {
    this.F = frontier; this.per = 16; const N = frontier.patches.length * this.per; this.N = N;
    const fir = mergeGeometries([colored(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 5).translate(0, 0.6, 0), 0x5a3d26), colored(new THREE.ConeGeometry(1.25, 2.4, 7).translate(0, 2.0, 0), 0x2f5d3c), colored(new THREE.ConeGeometry(0.9, 1.9, 7).translate(0, 3.2, 0), 0x3a6b45)]);
    const oak = mergeGeometries([colored(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6).translate(0, 0.8, 0), 0x6b4a2c), colored(new THREE.IcosahedronGeometry(1.5, 0).translate(0, 2.6, 0), 0x4f7f3a), colored(new THREE.IcosahedronGeometry(1.0, 0).translate(0.7, 3.2, 0.3), 0x5f8f44)]);
    const stump = colored(new THREE.CylinderGeometry(0.3, 0.38, 0.45, 6).translate(0, 0.22, 0), 0x7a5a3a);
    const mk = (g, n) => { const m = new THREE.InstancedMesh(g, lamV(), n); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    this.fir = mk(fir, N); this.oak = mk(oak, N); this.stump = mk(stump, N); this.stump.castShadow = false;
    this.trees = []; let sd = 99; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    // essences cohérentes par forêt : à l'ouest, sapinière au nord qui cède peu à peu la place aux feuillus vers le sud ;
    // à l'est, sapinière avec un bois de feuillus autour de (330, 285). Lisière de transition progressive (mélange sur ~40 m).
    const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const oakP = (x, z) => x < 100 ? sm(240, 290, z + 18 * Math.sin(x * 0.045)) : 1 - sm(38, 72, Math.hypot(x - 330, (z - 285) * 1.2) + 10 * Math.sin(x * 0.07 + z * 0.05));
    for (const p of frontier.patches) for (let k = 0; k < this.per; k++) this.trees.push({ p: p.id, x: p.x0 + 1.5 + r() * (FRONTIER.cell - 3), z: p.z0 + 1.5 + r() * (FRONTIER.cell - 3), s: 1.1 + r() * 0.9, oak: 0, ry: r() * 6.28, k, tint: 0.82 + r() * 0.3 });
    for (const t of this.trees) t.oak = r() < oakP(t.x, t.z);
    // sol des forêts : sous-bois sombre (parcelles) ; un anneau signale les parcelles en cours de défrichage
    const pg = new THREE.PlaneGeometry(FRONTIER.cell, FRONTIER.cell); pg.rotateX(-Math.PI / 2);
    const pxs = (r, g, b) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };   // prairie : même teinte que la carte
    const px = (r, g, b) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1); t.needsUpdate = true; return t; };   // sol des parcelles : mêmes textures de détail (herbe mêlée de terre)
    this.floor = new THREE.InstancedMesh(pg, groundMaterial(pxs(110, 138, 69), px(0, 0, 0)), frontier.patches.length); this.floor.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(frontier.patches.length * 3), 3); this.floor.receiveShadow = true; this.floor.frustumCulled = false; scene.add(this.floor);
    const rg = new THREE.RingGeometry(FRONTIER.cell * 0.46, FRONTIER.cell * 0.5, 4, 1); rg.rotateX(-Math.PI / 2); rg.rotateY(Math.PI / 4);
    this.marks = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.85, depthWrite: false }), frontier.patches.length); this.marks.frustumCulled = false; this.marks.count = 0; scene.add(this.marks);
    this.ver = -1; this.d = new THREE.Object3D(); this.c = new THREE.Color(); this.sel = -1;
  }
  update(clock) {
    const F = this.F, d = this.d, c = this.c; let nf = 0, no = 0, ns = 0, nm = 0;
    // arbres : une parcelle en cours perd ses arbres au rythme du bois abattu
    for (const t of this.trees) {
      const p = F.patches[t.p], left = p.state === 'open' ? 0 : p.wood / FRONTIER.wood, alive = t.k / this.per < left;
      d.position.set(t.x, 0, t.z); d.rotation.set(0, t.ry, 0);
      if (alive) { d.scale.setScalar(t.s); d.updateMatrix(); const im = t.oak ? this.oak : this.fir, n = t.oak ? no++ : nf++; im.setMatrixAt(n, d.matrix); im.setColorAt(n, c.setScalar(t.tint)); }
      else if (p.state !== 'forest') { d.scale.setScalar(0.8 + t.s * 0.3); d.updateMatrix(); this.stump.setMatrixAt(ns, d.matrix); this.stump.setColorAt(ns, c.setScalar(t.tint)); ns++; }
    }
    this.fir.count = nf; this.oak.count = no; this.stump.count = ns;
    for (const m of [this.fir, this.oak, this.stump]) { m.instanceMatrix.needsUpdate = true; if (m.count) m.instanceColor.needsUpdate = true; }
    if (this.ver !== F.version) {
      this.ver = F.version;
      // sol propre seulement sous les parcelles défrichées (prairie) ; sous la forêt, c'est le sol de sous-bois de la bordure
      let nfl = 0; F.patches.forEach(p => { if (p.state !== 'open') return; d.position.set(p.x, 0.03, p.z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); this.floor.setMatrixAt(nfl, d.matrix); this.floor.setColorAt(nfl, c.setScalar(1)); nfl++; });
      this.floor.count = nfl;
      this.floor.instanceMatrix.needsUpdate = true; this.floor.instanceColor.needsUpdate = true;
    }
    for (const p of F.patches) {
      const show = p.state === 'clearing' || p.id === this.sel; if (!show) continue;
      const pu = 1 + 0.02 * Math.sin(clock * 4 + p.id); d.position.set(p.x, 0.15, p.z); d.rotation.set(0, 0, 0); d.scale.set(pu, 1, pu); d.updateMatrix(); this.marks.setMatrixAt(nm++, d.matrix);
    }
    this.marks.count = nm; this.marks.instanceMatrix.needsUpdate = true;
  }
}

// ——— routes (v3.5) : bandes texturées qui s'embellissent avec les Travaux publics ———
//  0 sentier (trace foulée, herbe) · 1 terre battue (ornières, cailloux) · 2 gravier (bordure de galets) · 3 pavés (bordures de pierre)
//  Chaque route = un centre (texture tuilée à l'échelle du mètre : même taille de pavés quelle que soit la largeur) + deux bordures
//  (texture dédiée, bord extérieur irrégulier et fondu). TILE = mètres par tuile du centre.
const TILE = 2.4, BW = [1.1, 0.8, 0.6, 0.55];
const roadTex = {};
function rtex(key, Wp, Hp, draw, wrapU) {
  if (roadTex[key]) return roadTex[key];
  const cv = document.createElement('canvas'); cv.width = Wp; cv.height = Hp; const g = cv.getContext('2d');
  let sd = 0; for (const ch of key) sd = (sd * 31 + ch.charCodeAt(0)) % 2147483647; sd = sd || 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  draw(g, r, Wp, Hp);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = wrapU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return (roadTex[key] = t);
}
// dessine fn en x,y et à ses copies de l'autre côté des bords (tuilable)
const tiled = (Wp, Hp, x, y, m, fn) => { for (const dx of [0, -Wp, Wp]) for (const dy of [0, -Hp, Hp]) { const px = x + dx, py = y + dy; if (px < -m || px > Wp + m || py < -m || py > Hp + m) continue; fn(px, py); } };
const soft = (g, x, y, rad, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
function centerTex(q) {
  return rtex('c' + q, 512, 512, (g, r, W, H) => {
    if (q === 0) { g.fillStyle = 'rgba(122,98,66,.78)'; g.fillRect(0, 0, W, H); for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, rad = 14 + r() * 40; tiled(W, H, x, y, rad, (px, py) => soft(g, px, py, rad, 'rgba(86,118,52,.5)')); } }
    else if (q === 1) { g.fillStyle = 'rgb(138,110,76)'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 140; i++) { const x = r() * W, y = r() * H, rad = 8 + r() * 26; tiled(W, H, x, y, rad, (px, py) => soft(g, px, py, rad, r() < 0.5 ? 'rgba(160,130,92,.4)' : 'rgba(98,76,52,.35)')); }
      for (const ux of [0.28, 0.72]) for (let y = 0; y < H; y++) { g.fillStyle = 'rgba(92,70,48,.4)'; g.fillRect(ux * W - 22 + Math.sin(y / H * Math.PI * 4) * 5, y, 44, 1); }   // ornières
      for (let i = 0; i < 380; i++) { const x = r() * W, y = r() * H, sz = 2 + r() * 4, v = 120 + r() * 70 | 0; tiled(W, H, x, y, 8, (px, py) => { g.fillStyle = 'rgba(40,30,20,.35)'; g.beginPath(); g.ellipse(px + 1, py + 1.5, sz, sz * 0.7, 0, 0, 7); g.fill(); g.fillStyle = `rgb(${v + 10},${v},${v - 14})`; g.beginPath(); g.ellipse(px, py, sz, sz * 0.7, 0, 0, 7); g.fill(); }); } }
    else if (q === 2) { g.fillStyle = 'rgb(150,142,128)'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 9000; i++) { const x = r() * W, y = r() * H, sz = 1.2 + r() * 3, v = 110 + r() * 120 | 0; g.fillStyle = `rgb(${v},${v - 5},${v - 14})`; g.beginPath(); g.ellipse(x, y, sz, sz * 0.8, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, rad = 20 + r() * 50; tiled(W, H, x, y, rad, (px, py) => soft(g, px, py, rad, r() < 0.5 ? 'rgba(90,82,70,.18)' : 'rgba(220,214,200,.14)')); } }
    else { g.fillStyle = 'rgb(66,62,56)'; g.fillRect(0, 0, W, H);                                   // pavés : ~10 rangs par tuile (≈ 24 cm)
      const rows = 10, rh = H / rows;
      for (let k = 0; k < rows; k++) { let x = (k % 2) * 26 - 26; while (x < W) { const w = 40 + r() * 22, v = 136 + r() * 48 | 0, warm = r() * 14; for (const dx of [0, W]) { const px = x - dx; if (px + w < 0 || px > W) continue;
        g.fillStyle = `rgb(${v + warm | 0},${v + warm * 0.5 | 0},${v - 8 | 0})`; g.beginPath(); g.roundRect(px + 3, k * rh + 3, w - 6, rh - 6, 9); g.fill();
        const gr = g.createLinearGradient(0, k * rh, 0, k * rh + rh); gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.24)'); g.fillStyle = gr; g.beginPath(); g.roundRect(px + 3, k * rh + 3, w - 6, rh - 6, 9); g.fill(); } x += w; } }
      for (let i = 0; i < 120; i++) { const x = r() * W, y = r() * H; g.fillStyle = `rgba(80,${100 + r() * 30 | 0},52,${0.2 + r() * 0.3})`; g.beginPath(); g.arc(x, y, 1.5 + r() * 3, 0, 7); g.fill(); } }   // mousse dans les joints
    const img = g.getImageData(0, 0, W, H), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
  }, true);
}
// bordure : u = 0 côté route → 1 côté herbe ; bord extérieur irrégulier et fondu
function borderTex(q) {
  return rtex('b' + q, 128, 512, (g, r, W, H) => {
    const edge = y => 0.62 + 0.16 * (Math.sin(y / H * Math.PI * 2 * 3 + q) * 0.6 + Math.sin(y / H * Math.PI * 2 * 8 + 1.3) * 0.4);
    const base = ['rgba(122,98,66,A)', 'rgba(138,110,76,A)', 'rgba(150,142,128,A)', 'rgba(66,62,56,A)'][q];
    for (let y = 0; y < H; y++) { const e = edge(y) * W; const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, base.replace('A', q === 0 ? 0.78 : 1)); gr.addColorStop(Math.max(0.05, e / W - 0.18), base.replace('A', q === 0 ? 0.6 : 0.9)); gr.addColorStop(e / W, base.replace('A', 0)); g.fillStyle = gr; g.fillRect(0, y, W, 1); }
    if (q === 2) for (let y = 0; y < H; y += 14 + r() * 8) { const x = edge(y) * W - 18, v = 110 + r() * 50 | 0; tiled(W, H, x, y, 16, (px, py) => { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(px + 2, py + 3, 12, 10, 0, 0, 7); g.fill(); g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.beginPath(); g.ellipse(px, py, 12 + r() * 4, 9 + r() * 3, r(), 0, 7); g.fill(); }); }   // galets de bordure
    if (q === 3) { g.clearRect(0, 0, W, H); g.fillStyle = 'rgb(66,62,56)'; g.fillRect(0, 0, W * 0.72, H);
      for (let y = 0; y < H; y += 64) { const v = 150 + r() * 30 | 0; g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(6, y + 3, W * 0.62, 58); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(6, y + 3, W * 0.62, 5); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(6, y + 56, W * 0.62, 5); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(W * 0.62, y + 3, 4, 58); }   // bordures de pierre taillée
      for (let i = 0; i < 60; i++) soft(g, W * (0.66 + r() * 0.25), r() * H, 4 + r() * 8, 'rgba(84,112,52,.55)'); }
    if (q <= 1) for (let i = 0; i < 40; i++) soft(g, W * (0.45 + r() * 0.4), r() * H, 5 + r() * 12, 'rgba(86,118,52,.45)');   // herbe qui mord sur le bord
  }, false);
}
export class RoadView {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); this.key = '';
    const m = t => applyNorthFog(new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false }));
    this.cm = [0, 1, 2, 3].map(q => m(centerTex(q))); this.bm = [0, 1, 2, 3].map(q => m(borderTex(q)));
    this.plan = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.55, depthWrite: false });
  }
  update(sim) {
    const R = sim.roads, q = R.quality(sim), key = R.version + ':' + q + ':' + R.list.map(r => (r.built * 10) | 0).join(','); if (key === this.key) return; this.key = key;
    for (const c of [...this.group.children]) { this.group.remove(c); c.geometry.dispose(); }
    const centers = [], borders = [], plans = [], bw = BW[q];
    // bande plate le long d'un axe : décalage latéral off, largeur w, uv (u0→u1 en travers, v en mètres / TILE)
    const strip = (r, a, b, off, w, uu, list, y, flip) => {
      const L = b - a; if (L <= 0.05) return; const g = new THREE.PlaneGeometry(w, L), uv = g.attributes.uv, R2 = Math.hypot(r.x1 - r.x0, r.z1 - r.z0), ux = (r.x1 - r.x0) / R2, uz = (r.z1 - r.z0) / R2;
      for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, uu(flip ? 1 - u : u), (a + v * L) / TILE); }
      g.rotateX(-Math.PI / 2); g.rotateY(Math.atan2(ux, uz)); const m = (a + b) / 2; g.translate(r.x0 + ux * m + uz * off, y, r.z0 + uz * m - ux * off); list.push(g);
    };
    for (const r of R.list) {
      const L = Math.hypot(r.x1 - r.x0, r.z1 - r.z0); if (L < 0.5) continue; const uz = (r.z1 - r.z0) / L, built = L * r.built;
      if (built > 0.3 && (q >= 1 || r.kind !== 'base')) {
        let a = 0, b = built;
        if (r.kind === 'base') { const zc = 211; const za = r.z0, zb = r.z0 + uz * built; if (Math.max(za, zb) <= zc) a = b; else if (Math.min(za, zb) < zc && Math.abs(uz) > 1e-3) { const t = (zc - r.z0) / uz; if (za < zc) a = Math.max(a, t); else b = Math.min(b, t); } }   // pas sur la cour ni sur la placette
        if (b - a > 0.3) {
          const w = r.w * (q === 0 ? 0.8 : 1.05), cw = Math.max(0.6, w - 2 * bw * 0.5), y = 0.045 + (r.id % 7) * 0.002, ext = Math.min(1.2, cw * 0.3);
          strip(r, a - ext, b + ext, 0, cw, u => u * cw / TILE, centers, y);
          for (const s of [-1, 1]) strip(r, a, b, s * (cw / 2 + bw / 2 - 0.05), bw, u => u, borders, y + 0.001, s < 0);
        }
      }
      if (r.built < 1) { const ux = (r.x1 - r.x0) / L, g = new THREE.PlaneGeometry(r.w, L - built); g.rotateX(-Math.PI / 2); g.rotateY(Math.atan2(ux, uz)); g.translate(r.x0 + ux * (built + (L - built) / 2), 0.06, r.z0 + uz * (built + (L - built) / 2)); plans.push(g); }
    }
    const add = (list, m, ro, keepUv) => { if (!list.length) return; const g = mergeGeometries(list.map(x => { if (!keepUv) x.deleteAttribute('uv'); return x; }), false); const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = ro; this.group.add(mesh); };
    add(centers, this.cm[q], 1, true); add(borders, this.bm[q], 2, true); add(plans, this.plan, 4);
  }
}

// ——— braseros : pied de fer, vasque, flammes (particules + lueur) quand allumé, braises rougeoyantes quand il faiblit ———
export class BrazierView {
  constructor(scene, night, nLights = 6) {
    this.N = night; const n = night.fires.length;
    const stand = mergeGeometries([colored(new THREE.CylinderGeometry(0.12, 0.22, 1.5, 6).translate(0, 0.75, 0), 0x3a3c42), colored(new THREE.CylinderGeometry(0.62, 0.4, 0.42, 8).translate(0, 1.65, 0), 0x4a4c52), colored(new THREE.TorusGeometry(0.62, 0.06, 4, 10).rotateX(Math.PI / 2).translate(0, 1.86, 0), 0x2a2c30), colored(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 8).translate(0, 0.03, 0), 0x3a3c42)]);
    this.stand = new THREE.InstancedMesh(stand, lamV(), n); this.stand.castShadow = true; this.stand.frustumCulled = false; scene.add(this.stand);
    this.coal = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), n); this.coal.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); this.coal.frustumCulled = false; scene.add(this.coal);
    const d = new THREE.Object3D(); night.fires.forEach((f, i) => { d.position.set(f.x, f.zone === 'wall' ? 6.4 : 0, f.z); d.scale.setScalar(f.zone === 'plain' ? 0.0001 : 1); d.updateMatrix(); this.stand.setMatrixAt(i, d.matrix); });
    // bûchers de la plaine : cercle de pierres (fixe) + rondins dressés en tipi, ajoutés au fil des voyages de bois ; consumés en brûlant
    const plains = night.fires.filter(f => f.zone === 'plain'), NP = plains.length; this.LOGS = 9;
    const ringG = colored(new THREE.DodecahedronGeometry(0.42, 0), 0x8a8c90), logG = colored(new THREE.CylinderGeometry(0.16, 0.2, 2.5, 6).translate(0, 1.25, 0), 0x7a4a24);
    this.ring = new THREE.InstancedMesh(ringG, lamV(), NP * 10); this.ring.frustumCulled = false; scene.add(this.ring);
    this.logs = new THREE.InstancedMesh(logG, lamV(), NP * this.LOGS); this.logs.frustumCulled = false; this.logs.castShadow = true; this.logs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NP * this.LOGS * 3).fill(1), 3); scene.add(this.logs);
    let nr = 0; for (const f of plains) for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; d.position.set(f.x + Math.cos(a) * 1.55, 0.12, f.z + Math.sin(a) * 1.55); d.rotation.set(k, k * 2, 0); d.scale.set(1, 0.7 + 0.25 * (k % 3), 1); d.updateMatrix(); this.ring.setMatrixAt(nr++, d.matrix); }
    d.rotation.set(0, 0, 0); d.scale.setScalar(1); this.plains = plains;
    // tas de bois réservés aux feux, dans la cour près des portes (l'équipe y charge ses fagots)
    const pileG = mergeGeometries([colored(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 6).rotateX(Math.PI / 2), 0x7f4e26), colored(new THREE.CylinderGeometry(0.17, 0.17, 2.62, 6).rotateX(Math.PI / 2).scale(1, 1, 1.001), 0xe2bc84).scale(0.85, 0.85, 1.0)]);
    const rows = [5, 4, 3, 2], depots = FIRE_KEEP.depots, per = rows.reduce((a, b) => a + b, 0) + 4; this.woodpile = new THREE.InstancedMesh(pileG, lamV(), depots.length * per); this.woodpile.castShadow = true; this.woodpile.frustumCulled = false; scene.add(this.woodpile);
    let nw = 0; for (const [px, pz] of depots) { rows.forEach((n, r) => { for (let k = 0; k < n; k++) { d.position.set(px + (k - (n - 1) / 2) * 0.42, 0.2 + r * 0.36, pz); d.rotation.set(0, (k * 0.07) % 0.12, 0); d.updateMatrix(); this.woodpile.setMatrixAt(nw++, d.matrix); } }); for (const sx of [-1.3, 1.3]) for (const sz of [-1, 1]) { d.position.set(px + sx, 0.6, pz + sz * 0.9); d.rotation.set(Math.PI / 2, 0, 0); d.scale.set(0.5, 0.45, 0.5); d.updateMatrix(); this.woodpile.setMatrixAt(nw++, d.matrix); d.scale.setScalar(1); } }
    d.rotation.set(0, 0, 0);
    // vraies lumières : quelques-unes seulement (les plus proches de la caméra), le reste en lueurs
    this.lights = []; for (let k = 0; k < nLights; k++) { const L = new THREE.PointLight(0xff9a40, 0, 26, 1.6); scene.add(L); this.lights.push(L); }
    this.d = d; this.c = new THREE.Color();
  }
  y(f) { return f.zone === 'wall' ? 6.4 : 0; }
  update(fx, clock, camera, dark) {
    const F = this.N.fires, d = this.d, c = this.c;
    let nl = 0;
    for (const f of this.plains) {   // rondins : nombre selon le bûcher en préparation ou le bois restant ; noircis en brûlant
      const n = f.lit ? Math.ceil(this.LOGS * Math.min(1, f.fuel * 1.2)) : Math.floor(this.LOGS * f.pile + 1e-6);
      for (let k = 0; k < n; k++) { const a = k / this.LOGS * 6.283 + (k % 2) * 0.3, lean = 0.42 + 0.05 * (k % 3); d.position.set(f.x + Math.cos(a) * 0.95, 0, f.z + Math.sin(a) * 0.95); d.rotation.set(0, 0, 0); d.rotateY(-a); d.rotateZ(lean); d.updateMatrix(); this.logs.setMatrixAt(nl, d.matrix);
        const ch = f.lit ? 0.35 + 0.65 * f.fuel : 1; this.logs.setColorAt(nl, c.setRGB(ch, ch * 0.92, ch * 0.88)); nl++; }
    }
    this.logs.count = nl; this.logs.instanceMatrix.needsUpdate = true; if (nl) this.logs.instanceColor.needsUpdate = true; d.rotation.set(0, 0, 0);
    F.forEach((f, i) => {
      if (f.zone === 'plain') {   // grand feu de bois : flammes hautes, beaucoup d'étincelles, lueur large
        d.position.set(f.x, f.lit ? 1.1 : -5, f.z); d.scale.setScalar(f.lit ? 1.5 + 0.4 * f.fuel : 0.001); d.updateMatrix(); this.coal.setMatrixAt(i, d.matrix); this.coal.setColorAt(i, c.setRGB(1, 0.5 + 0.2 * Math.sin(clock * 7 + i), 0.14));
        if (f.lit) {
          const fl = 0.85 + 0.15 * Math.sin(clock * 11 + i * 2.3) * Math.sin(clock * 6.1 + i), k = 0.5 + 0.5 * Math.min(1, f.fuel * 2);
          fx.glowNow(f.x, 2.2, f.z, (1.4 + 1.6 * dark) * fl * k, 1, 0.55, 0.18);
          for (let e = 0; e < 2; e++) if (Math.random() < 0.8 * fx.q.particles) fx.A.emit(f.x + (Math.random() - 0.5) * 1.4, 0.8, f.z + (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.6, 2.6 + Math.random() * 2.2, (Math.random() - 0.5) * 0.6, 0.6, 0.45 + 0.3 * k, -1, Math.random() < 0.6 ? [1, 0.45, 0.08] : [1, 0.78, 0.2], 0.55);
          if (Math.random() < 0.12 * fx.q.particles) fx.P.emit(f.x, 3.2, f.z, 0.3, 1.4, 0.1, 3, 0.8, -0.12, [0.3, 0.28, 0.28], 1.6);
        }
        return;
      }
      const y = this.y(f) + 1.9, k = f.lit ? 0.6 + 0.4 * Math.min(1, f.fuel * 2) : 0; d.position.set(f.x, y, f.z); d.scale.setScalar(f.lit ? 1 : 0.7); d.updateMatrix(); this.coal.setMatrixAt(i, d.matrix);
      this.coal.setColorAt(i, f.lit ? c.setRGB(1, 0.45 + 0.2 * Math.sin(clock * 7 + i), 0.12) : c.setRGB(0.18, 0.16, 0.15));
      if (f.lit) {
        const fl = 0.85 + 0.15 * Math.sin(clock * 11 + i * 2.3) * Math.sin(clock * 6.1 + i);
        fx.glowNow(f.x, y + 0.6, f.z, (0.8 + 0.9 * dark) * fl * k, 1, 0.55, 0.18);
        if (Math.random() < 0.55 * fx.q.particles) fx.A.emit(f.x + (Math.random() - 0.5) * 0.6, y + 0.2, f.z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 1.8 + Math.random() * 1.4, (Math.random() - 0.5) * 0.4, 0.5, 0.32 + 0.2 * k, -1, Math.random() < 0.6 ? [1, 0.45, 0.08] : [1, 0.78, 0.2], 0.5);
        if (Math.random() < 0.06 * fx.q.particles) fx.P.emit(f.x, y + 1.4, f.z, 0.2, 1.2, 0.1, 2.2, 0.6, -0.15, [0.3, 0.28, 0.28], 1.2);
      }
    });
    this.coal.instanceMatrix.needsUpdate = true; this.coal.instanceColor.needsUpdate = true;
    // lumières réelles : les 6 braseros allumés les plus proches du centre de la vue, intensité selon l'obscurité
    const cx = camera.userData.tx ?? camera.position.x, cz = camera.userData.tz ?? camera.position.z;
    const lit = F.filter(f => f.lit).sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
    this.lights.forEach((L, k) => { const f = lit[k]; if (!f || dark < 0.05) { L.intensity = 0; return; } L.position.set(f.x, this.y(f) + 2.4, f.z); L.intensity = dark * (f.zone === 'plain' ? 110 : 60) * (0.85 + 0.15 * Math.sin(clock * 9 + k)) * Math.min(1, f.fuel * 3); L.distance = f.zone === 'plain' ? 38 : 26; });
  }
}
export { ROADWORKS };
