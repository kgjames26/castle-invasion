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

// ——— routes : bande de terre pour chaque tronçon ; gravier puis pavés selon le niveau des Travaux publics ; chantier en pointillés ———
export class RoadView {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); this.key = '';
    this.dirt = applyNorthFog(new THREE.MeshLambertMaterial({ color: 0x8a7458, transparent: true, opacity: 0.85, depthWrite: false }));
    this.gravel = applyNorthFog(new THREE.MeshLambertMaterial({ color: 0xa8a294 })); this.stoneM = applyNorthFog(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    this.plan = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.55, depthWrite: false });
  }
  update(sim) {
    const R = sim.roads, q = R.quality(sim), key = R.version + ':' + q + ':' + R.list.map(r => (r.built * 10) | 0).join(','); if (key === this.key) return; this.key = key;
    for (const c of [...this.group.children]) { this.group.remove(c); c.geometry.dispose(); }
    const strips = [], gravel = [], stones = [], plans = []; let sd = 5; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (const r of R.list) {
      const L = Math.hypot(r.x1 - r.x0, r.z1 - r.z0); if (L < 0.5) continue; const ux = (r.x1 - r.x0) / L, uz = (r.z1 - r.z0) / L, ang = Math.atan2(ux, uz), built = L * r.built;
      const strip = (len, w, y, list) => { const g = new THREE.PlaneGeometry(w, len); g.rotateX(-Math.PI / 2); g.rotateY(ang); g.translate(r.x0 + ux * len / 2, y, r.z0 + uz * len / 2); list.push(g); };
      if (r.kind !== 'base' && built > 0.3) strip(built, r.w, 0.045, strips);            // les chemins d'origine sont déjà peints dans le sol
      if (r.built < 1) { const g = new THREE.PlaneGeometry(r.w, L - built); g.rotateX(-Math.PI / 2); g.rotateY(ang); g.translate(r.x0 + ux * (built + (L - built) / 2), 0.06, r.z0 + uz * (built + (L - built) / 2)); plans.push(g); }
      if (q >= 2 && built > 1) strip(built, r.w * 0.82, 0.06, gravel);
      if (q >= 3 || (q >= 1 && r.kind !== 'auto')) for (let dd = 0.6; dd < built; dd += q >= 3 ? 0.95 : 2.4) for (let o = -r.w * 0.38; o <= r.w * 0.38; o += q >= 3 ? 0.95 : 1.9) {
        if (stones.length > 9000) break; const b = new THREE.BoxGeometry(0.82, 0.1, 0.78); b.rotateY(ang + (rn() - 0.5) * 0.3); b.translate(r.x0 + ux * dd - uz * o, 0.08, r.z0 + uz * dd + ux * o); stones.push(b);
      }
    }
    const add = (list, m, ro = 0) => { if (!list.length) return; const g = mergeGeometries(list.map(x => { x.deleteAttribute('uv'); return x; }), false); const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = ro; this.group.add(mesh); };
    add(strips, this.dirt, 1); add(gravel, this.gravel, 2); add(stones, this.stoneM, 3); add(plans, this.plan, 4);
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
