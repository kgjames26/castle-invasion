import * as THREE from 'three';
import { BUILDINGS, MAP } from '../data/Config.js';
import { rng } from '../utils/MathUtils.js';

// Carte secondaire « Ville », au sud de la base : bâtiments de développement et de création.
// Chaque bâtiment est visible dans le décor ; toucher un bâtiment (ou son étiquette) ouvre son menu.
const SLOTS = {
  landscape: {
    lab: [-30, -26], barracks: [0, -26], stable: [30, -26],
    workshop: [-30, 2], forge: [0, 2], defenses: [30, 2],
    quarters: [-22, 36], market: [22, 36],
  },
  portrait: {
    lab: [-17, -38], barracks: [17, -38], stable: [-17, -13],
    workshop: [17, -13], forge: [-17, 12], defenses: [17, 12],
    quarters: [-17, 46], market: [17, 46],
  },
};
// zones de la ville : l'Armée (au nord) et le Village (au sud)
export const ZONE_OF = { lab: 'army', barracks: 'army', stable: 'army', workshop: 'army', forge: 'army', defenses: 'army', quarters: 'village', market: 'village' };
const ZONE_VIEW = {
  landscape: { army: { z: -20, dist: 92 }, village: { z: 36, dist: 62 } },
  portrait: { army: { z: -22, dist: 160 }, village: { z: 46, dist: 110 } },
};
// modèles du pack médiéval composant chaque bâtiment [nom, dx, dz, rotY, échelle]
const PARTS = {
  quarters: [['house1', 0, 0, 0, 1.55], ['house2', 8, 7, 0.4, 1.2], ['house4', -8, 7, -0.3, 1.2]],
  barracks: [['tower2', 0, 0, 0, 1.5], ['tent2', 9, 6, 0.3, 1.3], ['tent1', -9, 6, -0.3, 1.3], ['fence', 0, 9, Math.PI / 2, 2.2]],
  stable: [['house3', 0, 0, Math.PI, 1.55], ['fence', 0, 9, Math.PI / 2, 2.2], ['sack', 6, 8, 0, 2.4], ['logs', -6, 8, 0.4, 3]],
  workshop: [['house5', 0, 0, 0, 1.5], ['cart', 9, 5, 0.7, 2.6], ['logs', -8, 6, 0.3, 3], ['crate', -4, 9, 0.2, 2.4]],
  lab: [['church', 0, 0, 0, 1.45]],
  forge: [['house4', 0, 0, 0, 1.45], ['cauldron', 8, 5, 0, 2.6], ['campfire', -7, 6, 0, 3.2], ['barrel', 5, 9, 0, 2.4], ['crate2', -3, 9, 0.3, 2.4]],
  market: [['stall', 0, 0, Math.PI, 2.0], ['stall', 9, 2, Math.PI, 2.0], ['stall', -9, 2, Math.PI, 2.0], ['barrel', 5, 7, 0, 2.4], ['crate', -5, 7, 0.5, 2.4], ['sack', 0, 8, 0, 2.4]],
  defenses: [['tower3', 0, 0, 0, 1.5], ['wall', 8, 2, Math.PI / 2, 0.9], ['wall', -8, 2, Math.PI / 2, 0.9]],
};

export class City {
  constructor(game) {
    this.game = game;
    this.sm = game.sm;
    this.scene = game.sm.cityScene;
    this.slots = SLOTS[MAP.orient] || SLOTS.landscape;
    this.b = {};          // id → { x, z, group, site, label }
    this.selected = null;
    const P = MAP.orient === 'portrait';
    this.bounds = P ? { minX: -26, maxX: 26, minZ: -50, maxZ: 62 } : { minX: -52, maxX: 52, minZ: -36, maxZ: 52 };
    this.zone = 'army';
  }

  build() {
    const sm = this.sm, sc = this.scene, R = rng(21);
    // sol : prairie, place pavée au centre, routes vers chaque bâtiment
    const size = 360, seg = 144;
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
        const m = new THREE.Mesh(sm.models[name], sm.matCity.medieval);
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
    back.innerHTML = '<span class="ci">⬆</span><span class="cn">Carte</span>';
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
  update(time) {
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
