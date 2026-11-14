// Vue des structures : chantiers standard (tous les bâtiments), bâtiments finis, échafaudage d'amélioration / de déplacement,
// barres de progression, fantôme de placement, anneau de sélection. Ne modifie jamais la simulation.
import * as THREE from 'three';
import { makeModel, pipsFor, signSprite } from './Buildings.js';
import { levelProps } from './Village.js';
import { mat, GOLD, WOOD, DARK } from './Military.js';
import { STRUCT, BUILD } from '../content/medieval.js';
import { W } from '../sim/constants.js';

const ease = t => 1 - Math.pow(1 - t, 3);
const box = (w, h, d, c, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y + h / 2, z); parent.add(m); return m; };

export class StructureView {
  constructor(scene, sim, camera) {
    this.scene = scene; this.sim = sim; this.camera = camera; this.kit = null; this.map = new Map(); this.sel = 0; this.ghost = null;
    this.barBg = new THREE.MeshBasicMaterial({ color: 0x1b140c, transparent: true, opacity: 0.8, depthTest: false });
    this.barFill = new THREE.MeshBasicMaterial({ color: 0xe8c14a, depthTest: false });
    this.ghostMat = { ok: new THREE.MeshBasicMaterial({ color: 0x6fe08a, transparent: true, opacity: 0.5, depthWrite: false }), no: new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.5, depthWrite: false }) };
    const ring = new THREE.RingGeometry(0.9, 1, 40); ring.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthWrite: false })); this.ring.visible = false; scene.add(this.ring);
    // zone constructible (visible pendant le placement)
    this.zone = new THREE.Mesh(new THREE.PlaneGeometry(BUILD.maxX - BUILD.minX, BUILD.maxZ - BUILD.minZ), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.1, depthWrite: false }));
    this.zone.rotation.x = -Math.PI / 2; this.zone.position.set((BUILD.minX + BUILD.maxX) / 2, 0.12, (BUILD.minZ + BUILD.maxZ) / 2); this.zone.visible = false; scene.add(this.zone);
    this.zoneT = new THREE.Mesh(new THREE.PlaneGeometry(BUILD.maxX - BUILD.minX, BUILD.minZ - BUILD.towerMinZ), new THREE.MeshBasicMaterial({ color: 0x9ad0ff, transparent: true, opacity: 0.1, depthWrite: false }));
    this.zoneT.rotation.x = -Math.PI / 2; this.zoneT.position.set((BUILD.minX + BUILD.maxX) / 2, 0.12, (BUILD.minZ + BUILD.towerMinZ) / 2); this.zoneT.visible = false; scene.add(this.zoneT);
  }
  setKit(kit) { this.kit = kit; for (const v of this.map.values()) this.dispose(v); this.map.clear(); }
  dispose(v) { this.scene.remove(v.g); }
  // ——— construction des vues ———
  create(s) {
    const def = STRUCT[s.type], [w, h, d] = def.size, v = { id: s.id, g: new THREE.Group(), state: '', pop: 1, popT: 0 };
    v.g.position.set(s.x, 0, s.z); v.hw = w / 2; v.hd = d / 2; v.H = Math.min(h, 14);
    v.inner = new THREE.Group(); v.g.add(v.inner);                                // tourne avec la structure
    if (!s.fixed) { const m = makeModel(s.type, this.kit, s.id * 7 + (s.x | 0)); v.model = m.g; v.top = m.top; v.inner.add(m.g); }
    else { v.top = 15.5; }
    // pastilles de niveau (dorées) au-dessus de l'entrée
    const np = pipsFor(s.type); v.pips = [];
    if (np) { const pg = new THREE.BoxGeometry(0.8, 0.8, 0.8), pm = mat(GOLD); for (let i = 0; i < np; i++) { const p = new THREE.Mesh(pg, pm); p.position.set((i - (np - 1) / 2) * 1.2, v.top + 1.4, 0); p.rotation.y = Math.PI / 4; v.g.add(p); v.pips.push(p); } }
    if (def.ico && s.type !== 'house' && s.type !== 'tower') { v.sign = signSprite(def.ico); v.sign.position.set(0, v.top + 3.8, 0); v.g.add(v.sign); }     // enseigne : l'icône du métier
    v.site = this.siteModel(def, s); v.inner.add(v.site);
    v.scaf = this.scaffold(v); v.inner.add(v.scaf);
    v.bar = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.3), this.barBg), fl = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.9), this.barFill);
    bg.renderOrder = 10; fl.renderOrder = 11; fl.geometry.translate(4.3, 0, 0); fl.position.set(-4.3, 0, 0.01); v.fill = fl; v.bar.add(bg, fl); v.bar.position.y = v.top + (v.sign ? 7.4 : 4.6); v.g.add(v.bar);
    this.scene.add(v.g); this.map.set(s.id, v); return v;
  }
  // chantier STANDARD : même évolution pour tous les bâtiments (piquets → fondations → murs qui montent → échafaudage → charpente)
  siteModel(def, s) {
    const [w, h, d] = def.size, g = new THREE.Group(), hw = w / 2, hd = d / 2, H = Math.min(h, 14), body = def.color || 0xb9a98a;
    box(w + 1.4, 0.14, d + 1.4, 0x7d6648, 0, 0, 0, g);                                                        // terre battue
    g.pit = box(w - 0.4, 0.25, d - 0.4, 0x5c4a35, 0, 0.14, 0, g);                                            // fondations
    g.body = box(w - 1, 1, d - 1, body, 0, 0.3, 0, g);                                                        // masse du bâtiment qui monte
    g.posts = [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([x, z]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 6), mat(WOOD)); m.position.set(x, 0.5, z); g.add(m); return m; });
    g.rails = [0.33, 0.66, 0.97].map(k => { const r = new THREE.Group(); box(w, 0.2, 0.2, WOOD, 0, 0, -hd, r); box(w, 0.2, 0.2, WOOD, 0, 0, hd, r); box(0.2, 0.2, d, WOOD, -hw, 0, 0, r); box(0.2, 0.2, d, WOOD, hw, 0, 0, r); r.k = k; g.add(r); return r; });
    g.roof = box(w + 0.6, 0.35, d + 0.6, 0x6b4a2c, 0, 0, 0, g);                                               // charpente en fin de chantier
    g.piles = new THREE.Group(); box(2.4, 0.6, 1, 0xd9b27a, -hw + 1.4, 0.15, hd + 1.6, g.piles); box(2.4, 0.6, 1, 0xe5c28c, -hw + 1.4, 0.75, hd + 1.6, g.piles); box(1.5, 0.9, 1.2, 0xa4a8ad, hw - 1.2, 0.15, hd + 1.7, g.piles); box(1, 0.7, 1, 0xb9bdc2, hw - 2.5, 0.15, hd + 2.2, g.piles); g.add(g.piles);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 5), mat(DARK)); pole.position.set(hw + 0.8, 2.1, hd + 0.8); g.add(pole); box(1.6, 0.9, 0.08, 0xe8c14a, hw + 1.6, 3.2, hd + 0.8, g);   // fanion jaune
    g.H = H; g.hw = hw; g.hd = hd; return g;
  }
  scaffold(v) {
    const g = new THREE.Group(), hw = v.hw + 0.6, hd = v.hd + 0.6, H = v.top * 0.82;
    for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, H, 6), mat(WOOD)); m.position.set(x, H / 2, z); g.add(m); }
    for (const k of [0.4, 0.8]) { const y = H * k; box(hw * 2, 0.18, 0.18, WOOD, 0, y, -hd, g); box(hw * 2, 0.18, 0.18, WOOD, 0, y, hd, g); box(0.18, 0.18, hd * 2, WOOD, -hw, y, 0, g); box(0.18, 0.18, hd * 2, WOOD, hw, y, 0, g); }
    box(hw * 2, 0.15, 1.2, 0xd9b27a, 0, H * 0.4, hd + 0.3, g);
    g.visible = false; return g;
  }
  // ——— mise à jour à chaque image ———
  update(dt, clock) {
    const B = this.sim.build, seen = new Set();
    for (const s of B.items) {
      seen.add(s.id); const v = this.map.get(s.id) || this.create(s);
      v.g.position.set(s.x, 0, s.z); v.inner.rotation.y = -s.rot * Math.PI / 2;
      if (v.state !== s.state) {
        if (v.state && s.state === 'built' && !s.fixed) { v.popT = 0.0001; }
        v.state = s.state;
      }
      const site = s.state === 'site', work = site || s.state === 'upgrading' || s.state === 'moving', p = s.progress;
      if (v.model) v.model.visible = !site; if (v.sign) v.sign.visible = !site;
      v.site.visible = site; v.scaf.visible = s.state === 'upgrading' || s.state === 'moving';
      if (site) this.pose(v.site, p);
      // pastilles : niveau atteint (la prochaine clignote pendant l'amélioration)
      v.pips.forEach((pp, i) => { pp.visible = i < s.level || (s.state === 'upgrading' && i === s.level && Math.sin(clock * 8) > 0); });
      v.bar.visible = work; if (work) { v.fill.scale.x = Math.max(0.001, p); v.bar.quaternion.copy(this.camera.quaternion); v.fill.material.color.setHex(s.state === 'moving' ? 0x8fd0ff : 0xe8c14a); }
      // apparition du bâtiment terminé : petit rebond
      if (v.popT > 0) { v.popT += dt; const t = Math.min(1, v.popT / 0.7), sc = t < 1 ? 0.55 + 0.45 * ease(t) + 0.12 * Math.sin(t * Math.PI) : 1; v.inner.scale.set(sc, sc, sc); if (t >= 1) { v.popT = 0; v.inner.scale.set(1, 1, 1); } }
      // installations de niveau (scierie, carrière, mine, ferme… et bannières) : reconstruites quand le niveau change
      if (v.model && v.lvl !== s.level && !s.fixed && s.type !== "house" && s.type !== "tower") { v.lvl = s.level; v.g.userData.sh = 0; if (v.extras) v.inner.remove(v.extras); v.extras = levelProps(s.type, s.level, v.hw, v.hd); v.inner.add(v.extras); if (s.type === 'mill') v.model.scale.setScalar(1 + 0.07 * (s.level - 1)); if (v.lvl > 1) v.popT = 0.0001; }   // le moulin grandit avec ses niveaux
      if (v.extras) v.extras.visible = !site;
      if (s.state === 'moving' && v.model) v.model.position.y = 0.15 * Math.sin(clock * 6);
      else if (v.model) v.model.position.y = 0;
    }
    for (const [id, v] of this.map) if (!seen.has(id)) { this.dispose(v); this.map.delete(id); }
    // anneau de sélection
    const sel = this.sel ? this.map.get(this.sel) : null, st = this.sel ? B.get(this.sel) : null;
    this.ring.visible = !!sel;
    if (sel && st) { const r = Math.max(sel.hw, sel.hd) * 1.25 + 1.4, pu = 1 + 0.04 * Math.sin(clock * 5); this.ring.position.set(st.x, 0.3, st.z); this.ring.scale.set(r * pu, 1, r * pu); }
    // fantôme
    if (this.ghost) this.updateGhost(clock);
  }
  // pose le chantier selon l'avancement p ∈ [0,1] : tout change avec p, sans état caché
  pose(g, p) {
    const H = g.H, bodyH = Math.max(0.05, H * 0.8 * Math.max(0, (p - 0.12) / 0.88)), postH = H * (0.45 + 0.55 * Math.min(1, p * 1.2));
    g.pit.visible = p < 0.35; g.body.scale.y = bodyH; g.body.position.y = 0.3 + bodyH / 2; g.body.visible = p > 0.12;
    for (const m of g.posts) { m.visible = p > 0.05; m.scale.y = postH; m.position.y = postH / 2; }
    g.rails.forEach(r => { r.visible = p > 0.05 && r.k * H < postH + 0.2; r.position.y = r.k * H; });
    g.roof.visible = p > 0.88; g.roof.position.y = H * 0.8 + 0.15;
    const left = Math.max(0.05, 1 - p * 0.85); g.piles.scale.set(1, left, 1);
  }
  // ——— fantôme de placement ———
  setGhost(info) {   // { type, x, z, rot, ok } ou null
    if (!info) { if (this.ghost) { this.scene.remove(this.ghost.g); this.ghost = null; } this.zone.visible = this.zoneT.visible = false; return; }
    if (!this.ghost || this.ghost.type !== info.type) {
      if (this.ghost) this.scene.remove(this.ghost.g);
      const m = makeModel(info.type, this.kit, 3), g = new THREE.Group(), inner = new THREE.Group(); inner.add(m.g); g.add(inner);
      m.g.traverse(o => { if (o.isMesh) o.material = this.ghostMat.ok; });
      const [w, , d] = STRUCT[info.type].size, fp = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), this.ghostMat.ok); fp.position.y = 0.1; inner.add(fp);
      this.scene.add(g); this.ghost = { type: info.type, g, inner, fp, meshes: [] }; g.traverse(o => { if (o.isMesh) this.ghost.meshes.push(o); });
    }
    Object.assign(this.ghost, { x: info.x, z: info.z, rot: info.rot, ok: info.ok });
    this.zone.visible = true; this.zoneT.visible = info.type === 'tower' || true;
  }
  updateGhost(clock) {
    const gh = this.ghost, mt = gh.ok ? this.ghostMat.ok : this.ghostMat.no;
    for (const m of gh.meshes) m.material = mt;
    gh.g.position.set(gh.x, 0.05 + 0.15 * Math.abs(Math.sin(clock * 3)), gh.z); gh.inner.rotation.y = -gh.rot * Math.PI / 2;
    const t = 0.38 + 0.14 * Math.sin(clock * 5); this.ghostMat.ok.opacity = this.ghostMat.no.opacity = t;
  }
  setSelected(id) { this.sel = id || 0; }
}
