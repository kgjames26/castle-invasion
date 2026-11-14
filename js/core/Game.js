import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { CameraController } from './CameraController.js';
import { InputManager } from './InputManager.js';
import { SaveManager } from './SaveManager.js';
import { InstancedList } from './Instances.js';
import { AudioFX } from './Audio.js';
import { NavGrid, SpatialHash } from '../utils/Grid.js';
import { GameMap } from '../world/Map.js';
import { Wall } from '../world/Wall.js';
import { Castle } from '../world/Building.js';
import { City } from '../world/City.js';
import { PathfindingSystem } from '../systems/PathfindingSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { EffectsSystem } from '../systems/EffectsSystem.js';
import { SiegeSystem } from '../systems/SiegeSystem.js';
import { ResourceSystem } from '../systems/ResourceSystem.js';
import { ProductionSystem } from '../systems/ProductionSystem.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { FormationManager } from '../formations/FormationManager.js';
import { Cultivator } from '../entities/Cultivator.js';
import { Soldier } from '../entities/Soldier.js';
import { Cavalry } from '../entities/Cavalry.js';
import { START, MAP, UNITS } from '../data/Config.js';

const STEP = 1 / 60;
const _p = {};

// Sélection courante (unités/armes) ou structure (château, segment, centre)
class Selection {
  constructor(game) { this.game = game; this.units = []; this.structure = null; this.changed = 0; }
  set(list) { for (const u of this.units) u.selected = false; this.units = list.filter(u => u.alive); for (const u of this.units) u.selected = true; this.structure = null; this.changed++; }
  toggle(u) { if (this.units.includes(u)) this.remove(u); else { this.units.push(u); u.selected = true; this.structure = null; this.changed++; } }
  remove(u) { u.selected = false; this.units = this.units.filter(x => x !== u); this.changed++; }
  selectStructure(s) { this.set([]); this.structure = s; this.changed++; }
  clear() { this.set([]); this.structure = null; }
  get military() { return this.units.filter(u => u.isUnit && u.type !== 'cultivator'); }
  get cultivators() { return this.units.filter(u => u.type === 'cultivator'); }
  get siege() { return this.units.filter(u => u.isSiege); }
  get movable() { return this.units.filter(u => u.isUnit || (u.isSiege && u.def.mobile)); }
}

export class Game {
  constructor(container, ui) {
    this.ui = ui;
    ui.game = this;
    this.sm = new SceneManager(container);
    this.mapCam = new CameraController(this.sm.camera, this.sm.renderer.domElement);
    this.cityCam = new CameraController(this.sm.camera, this.sm.renderer.domElement, { mode: 'city' });
    this.cityCam.keys = this.mapCam.keys;
    this.cam = this.mapCam;
    this.view = 'map';
    this.sm.onResize = () => { this.mapCam.fitDefault(); this.cityCam.fitDefault(); this.ui.onResize?.(); };
    this.grid = new NavGrid();
    this.allyHash = new SpatialHash(5);
    this.enemyHash = new SpatialHash(5);
    this.units = [];
    this.enemies = [];
    this.time = 0;
    this.speed = 1;
    this.paused = true;
    this.running = false;
    this.over = false;
    this.camShake = 0;
    this.pending = null; // action en attente : 'move' | 'attack'
    this.stats = { kills: 0, damage: 0, gathered: 0, wallDamage: 0, wavesCleared: 0 };
    this.selection = new Selection(this);
    this.save = new SaveManager(this);
    this.audio = new AudioFX();
  }

  async init(onProgress) {
    await this.sm.load(onProgress);
    const sm = this.sm;
    // rendus instanciés des unités
    this.unitRender = {};
    const caps = { cultivator: 80, soldier: 90, cavalry: 50, ramlog: 40 };
    for (const [k, cap] of Object.entries(caps)) this.unitRender[k] = sm.instanced(sm.unitGeo[k], cap, { shadow: true });
    // archers : modèle « Bard the Bowman » (corps + arc) et flèche encochée
    const R = this.unitRender;
    R.archer = sm.instanced(sm.archerGeo.body, 90, { shadow: true, material: sm.mat.archer });
    R.archerBow = sm.instanced(sm.archerGeo.weapons || sm.archerGeo.bow, 90, { shadow: true, material: sm.mat.archer });
    R.archerArrow = sm.instanced(sm.projGeo.arrow, 90, { shadow: false });
    // zombies animés : une instance par variante de modèle
    sm.zombies.variants.forEach((v, i) => {
      const t = sm.instanced(v.geo, 260, { shadow: true, material: sm.zombies.mats[i].mat });
      t.enableAnim(sm.zombies.mats[i].depth);
      R['z' + i] = t;
    });
    // systèmes
    this.fx = new EffectsSystem(this);
    this.pathfinding = new PathfindingSystem(this);
    this.resources = new ResourceSystem(this);
    this.production = new ProductionSystem(this);
    this.waves = new WaveSystem(this);
    this.combat = new CombatSystem(this);
    this.formations = new FormationManager(this);
    this.map = new GameMap(this);
    this.wall = new Wall(this);
    this.castle = new Castle(this);
    this.castle.build();
    this.wall.build();
    this.map.build();
    this.siege = new SiegeSystem(this);
    this.city = new City(this);
    this.city.build();
    this.cityCam.bounds = this.city.bounds;
    this.pathfinding.setTargets(this.castle);
    this.pathfinding.computeFlow();
    // superpositions : barres de vie et anneaux de sélection
    const barMat = c => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true });
    this.barsBg = new InstancedList(sm.scene, sm.fxGeo.bar, barMat(0x111111), 600, 30);
    this.barsFg = new InstancedList(sm.scene, sm.fxGeo.bar, barMat(0xffffff), 600, 31);
    this.rings = new InstancedList(sm.scene, sm.fxGeo.ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 200, 5);
    this.wallSel = new THREE.Mesh(new THREE.BoxGeometry(8.2, 4.8, 4.6), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.18, depthWrite: false }));
    this.wallSel.visible = false;
    sm.scene.add(this.wallSel);

    this.input = new InputManager(sm.renderer.domElement, this.cam, {
      tap: (x, y, o) => this.onTap(x, y, o),
      secondary: (x, y) => this.onSecondary(x, y),
      boxDrag: r => this.ui.boxRect(r),
      boxSelect: (r, add) => this.onBoxSelect(r, add),
      boxModeUsed: () => this.ui.setBoxMode(false),
      hover: (x, y) => this.onHover(x, y),
      key: e => this.onKey(e),
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.running && !this.over) this.setPaused(true, true); });
  }

  // ---------- démarrage ----------
  newGame() {
    const R = this.resources;
    Object.assign(R.stock, START.res);
    this.production.workers = START.workers;
    const d = MAP.CASTLE_DOOR;
    let i = 0;
    for (const [type, n] of START.units) for (let k = 0; k < n; k++, i++) {
      const u = this.spawnUnit(type, d.x - 9 + (i % 6) * 3.4, d.z - 4 - Math.floor(i / 6) * 3);
      if (type !== 'cultivator') u.anchor = { x: u.x, z: u.z };
    }
    // archers de départ sur la muraille, de part et d'autre de la porte
    const archers = this.units.filter(u => u.type === 'archer');
    archers.forEach((a, k) => a.orderMove([-12, 12, -26, 26][k % 4], 0));
    this.waves.startPrep(1);
    this.start();
    this.ui.toast('Prépare tes défenses : les zombies arrivent du nord !', 'info');
  }

  loadGame(data) {
    this.save.apply(data);
    this.start();
    this.ui.toast(`Partie reprise — vague ${this.waves.wave}`, 'info');
  }

  start() {
    this.running = true;
    this.paused = false;
    this.last = performance.now();
    this.acc = 0;
    this.autosave = 30;
    this.ui.onStart();
    if (!this.loopStarted) { this.loopStarted = true; requestAnimationFrame(t => this.frame(t)); }
  }

  spawnUnit(type, x, z) {
    let u;
    if (type === 'cultivator') u = new Cultivator(this, x, z);
    else if (type === 'cavalry') u = new Cavalry(this, x, z);
    else if (type === 'soldier' || type === 'archer') u = new Soldier(this, type, x, z);
    else return null;
    this.units.push(u);
    return u;
  }

  // ---------- boucle ----------
  frame(t) {
    requestAnimationFrame(tt => this.frame(tt));
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    if (this.running && !this.paused && !this.over) {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= STEP && steps < 10) { this.update(STEP); this.acc -= STEP; steps++; }
      if (steps >= 10) this.acc = 0;
    }
    this.renderFrame(this.paused ? 1 : this.acc / STEP, dt);
  }

  update(dt) {
    this.time += dt;
    for (const u of this.units) u.savePrev();
    for (const e of this.enemies) e.savePrev();
    // hachages spatiaux
    this.allyHash.clear(); this.enemyHash.clear();
    for (const u of this.units) if (u.alive) this.allyHash.insert(u);
    for (const w of this.siege.weapons) if (w.alive) this.allyHash.insert(w);
    for (const c of this.resources.centers) if (c.alive) this.allyHash.insert(c);
    for (const e of this.enemies) if (e.alive) this.enemyHash.insert(e);

    this.pathfinding.update();
    this.production.update(dt);
    this.waves.update(dt);
    this.formations.update(dt);
    for (const u of this.units) if (u.alive) { u.update(dt); u.integrate(dt); }
    for (const e of this.enemies) if (e.alive) { e.update(dt); e.integrate(dt); }
    this.siege.update(dt);
    this.combat.update(dt);
    this.fx.update(dt);
    this.wall.update(dt);
    this.resources.update(dt);
    if (this.castle.flash > 0) this.castle.flash -= dt;

    // nettoyage des morts après l'animation
    this.cleanup(this.units, dt, false);
    this.cleanup(this.enemies, dt, true);

    this.autosave -= dt;
    if (this.autosave <= 0) { this.autosave = 30; this.save.save('auto'); }
    if (this.camShake > 0) this.camShake = Math.max(0, this.camShake - dt * 1.5);
  }

  cleanup(list, dt, isEnemy) {
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (!u.alive) {
        u.dying -= dt;
        if (u.dying <= 0) { u.release(); if (isEnemy) this.waves.release(u); continue; }
      }
      list[w++] = u;
    }
    list.length = w;
  }

  onUnitDeath(u) {
    if (u.team === 'enemy') {
      this.stats.kills++;
      this.resources.add('gold', Math.max(1, Math.round(u.def.gold * (u.goldMul || 1))));
      this.fx.burst(u.x, 1, u.z, 7, 0x3a4a22, 3, 0.7, 0.8);
    } else {
      this.fx.burst(u.x, 1, u.z, 7, 0x6a1010, 3, 0.7, 0.8);
      if (u.type === 'cultivator' && u.node) u.node.harvesters--;
      if (u.onWall) this.wall.segments[u.onWall.seg]?.archers.delete(u);
      this.ui.toast(`${UNITS[u.type].name} tombé au combat`, 'danger', 'death-' + u.type);
    }
  }

  // ---------- rendu ----------
  renderFrame(alpha, dt) {
    if (!this.unitRender) return;
    const t = performance.now() / 1000;
    if (this.view === 'city') {
      this.cam.update(dt);
      this.city.update(t, this.paused ? 0 : dt);
      this.sm.tick(t, this.paused ? 0 : dt);
      this.sm.render();
      this.ui.update(dt);
      return;
    }
    for (const u of this.units) u.draw(alpha, t);
    for (const e of this.enemies) e.draw(alpha, t);
    for (const k in this.unitRender) this.unitRender[k].commit();
    this.siege.draw(alpha);
    this.combat.draw(alpha);
    this.fx.draw();
    this.drawOverlays(alpha);
    this.cam.update(dt);
    this.sm.updateLod(this.cam.cur.dist);
    if (this.camShake > 0) {
      const s = this.camShake * 0.6;
      this.sm.camera.position.x += (Math.random() - 0.5) * s;
      this.sm.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.sm.tick(t, this.paused ? 0 : dt);
    this.sm.render();
    this.ui.update(dt);
  }

  drawOverlays(alpha) {
    const q = this.sm.camera.quaternion;
    const bg = this.barsBg, fg = this.barsFg, rings = this.rings;
    bg.begin(); fg.begin(); rings.begin();
    const bar = (x, y, z, f, w, r, g, b) => {
      bg.push(x, y, z, q, w + 0.12, 1.5, 1, 0, 0, 0);
      const fw = Math.max(0.01, w * f);
      // décalage vers la gauche dans le repère caméra
      const ox = -(w - fw) / 2;
      _v1.set(ox, 0, 0).applyQuaternion(q);
      fg.push(x + _v1.x, y + _v1.y, z + _v1.z, q, fw, 1, 1, r, g, b);
    };
    for (const u of this.units) {
      if (!u.alive) continue;
      const x = u.px + (u.x - u.px) * alpha, z = u.pz + (u.z - u.pz) * alpha, y = u.y;
      if (u.selected) rings.push(x, y + 0.06, z, null, u.radius * 1.9, 1, u.radius * 1.9, 0.45, 1, 0.55);
      if (u.hp < u.maxHp || u.selected) { const f = u.hp / u.maxHp; bar(x, y + (u.type === 'cavalry' ? 3.8 : 2.9), z, f, 1.1, 1 - f, 0.85, 0.25); }
    }
    for (const e of this.enemies) {
      if (!e.alive || e.hp >= e.maxHp) continue;
      const x = e.px + (e.x - e.px) * alpha, z = e.pz + (e.z - e.pz) * alpha;
      const h = 2.5 * e.size * 1.3 + 0.5;
      bar(x, e.y + h, z, e.hp / e.maxHp, Math.max(0.9, Math.min(2.6, 0.95 * e.size)), 0.95, 0.2, 0.15);
    }
    for (const w of this.siege.weapons) {
      if (!w.alive) continue;
      if (w.selected) rings.push(w.x, 0.06, w.z, null, w.radius * 1.7, 1, w.radius * 1.7, 1, 0.85, 0.4);
      if (w.hp < w.maxHp || w.selected) bar(w.x, w.type === 'trebuchet' ? 7 : 3.4, w.z, w.hp / w.maxHp, 2, 0.4, 0.8, 1);
    }
    for (const c of this.resources.centers) if (c.alive && c.hp < c.maxHp) bar(c.x, 7, c.z, c.hp / c.maxHp, 3, 0.4, 0.8, 1);
    for (const n of this.waves.nests) if (n.alive && n.hp < n.maxHp) bar(n.x, 5, n.z, n.hp / n.maxHp, 4, 0.75, 0.3, 0.95);
    const s = this.selection.structure;
    if (s && s.isNest && s.alive) rings.push(s.x, 0.1, s.z, null, s.radius * 1.4, 1, s.radius * 1.4, 1, 0.3, 0.3);
    if (s && s.type === 'center' && s.alive) rings.push(s.x, 0.1, s.z, null, 4, 1, 4, 0.45, 1, 0.55);
    // sélection d'un segment de muraille
    if (s && s.isWallSeg) {
      const seg = this.wall.segments[s.index];
      this.wallSel.visible = true;
      this.wallSel.position.set(seg.x, 2.3, MAP.WALL_Z);
      this.wallSel.material.color.set(seg.broken ? 0xff5040 : 0xffd27a);
    } else this.wallSel.visible = false;
    bg.end(); fg.end(); rings.end();
  }

  // ---------- picking ----------
  pickRadius(touch) { return touch ? 34 : 24; }

  pickAlly(sx, sy, touch) {
    let best = null, bd = this.pickRadius(touch);
    const test = (o, h) => {
      this.cam.worldToScreen(o.x, (o.y || 0) + h, o.z, _p);
      const d = Math.hypot(_p.x - sx, _p.y - sy);
      if (_p.visible && d < bd) { bd = d; best = o; }
    };
    for (const u of this.units) if (u.alive) test(u, 1);
    for (const w of this.siege.weapons) if (w.alive) test(w, 1.4);
    return best;
  }

  pickEnemy(sx, sy, touch) {
    let best = null, bd = this.pickRadius(touch);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.cam.worldToScreen(e.x, e.y + 1, e.z, _p);
      const d = Math.hypot(_p.x - sx, _p.y - sy) - (e.type.startsWith('golem') ? 14 : 0);
      if (_p.visible && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  pickWorld(p, sx, sy) {
    if (!p) return null;
    // la muraille et le château sont hauts : on teste aussi à leur hauteur
    if (sx !== undefined) {
      for (const h of [MAP.WALL_HEIGHT, 2.2]) {
        const q = this.cam.screenToGround(sx, sy, h);
        if (q && Math.abs(q.z - MAP.WALL_Z) < MAP.WALL_HALF_THICK + 0.5 && Math.abs(q.x) < MAP.HALF) return { isWallSeg: true, index: this.wall.segAt(q.x), point: q };
      }
      for (const h of [14 * this.castle.k, 7 * this.castle.k]) {
        const q = this.cam.screenToGround(sx, sy, h);
        if (q && this.castle.distTo(q.x, q.z) < 0.5) return this.castle;
      }
    }
    for (const n of this.waves.nests) if (n.alive && Math.hypot(n.x - p.x, n.z - p.z) < n.radius + 1) return n;
    for (const c of this.resources.centers) if (c.alive && Math.hypot(c.x - p.x, c.z - p.z) < 3.5) return c;
    for (const n of this.resources.nodes) if (n.alive && Math.hypot(n.x - p.x, n.z - p.z) < n.radius + 1.3) return n;
    if (this.castle.distTo(p.x, p.z) < 0.5) return this.castle;
    const seg = this.grid.isWallCellXZ(p.x, p.z);
    if (seg >= 0 || (Math.abs(p.z) < MAP.WALL_HALF_THICK + 0.6 && Math.abs(p.x) < MAP.HALF)) return { isWallSeg: true, index: seg >= 0 ? seg : this.wall.segAt(p.x), point: p };
    return null;
  }

  // ---------- entrées ----------
  onHover(sx, sy) {
    if (this.view === 'city') return;
    if (!this.siege.placing) return;
    const p = this.cam.screenToGround(sx, sy);
    if (p) this.siege.updateGhost(p.x, p.z);
  }

  onTap(sx, sy, o) {
    if (!this.running || this.over) return;
    this.audio.unlock();
    if (this.view === 'city') {
      const id = this.city.pick(sx, sy);
      if (id) this.ui.underground.select(id);
      return;
    }
    const sel = this.selection;
    const ground = this.cam.screenToGround(sx, sy);
    // placement d'une arme / d'un centre
    if (this.siege.placing) {
      if (!ground) return;
      const pl = this.siege.placing;
      if (o.touch && (!pl.ghost.visible || Math.hypot(pl.x - ground.x, pl.z - ground.z) > 4)) { this.siege.updateGhost(ground.x, ground.z); return; }
      if (!o.touch) this.siege.updateGhost(ground.x, ground.z);
      this.siege.confirmPlacement();
      return;
    }
    // action en attente (bouton Déplacer / Attaquer)
    if (this.pending && ground) {
      const enemy = this.pickEnemy(sx, sy, o.touch);
      const w = this.pickWorld(ground, sx, sy);
      this.command(w && w.isWallSeg ? { x: w.point.x, z: MAP.WALL_Z } : ground, enemy, this.pending === 'attack', w);
      this.pending = null;
      this.ui.setPending(null);
      return;
    }
    const ally = this.pickAlly(sx, sy, o.touch);
    if (!ally && this.nearCityGate(sx, sy, o.touch)) { this.ui.underground.open(); return; }
    if (ally) {
      if (o.double && ally.isUnit) {
        const same = this.units.filter(u => u.alive && u.type === ally.type && this.onScreen(u));
        sel.set(same);
      } else if (o.shift) sel.toggle(ally);
      else sel.set([ally]);
      this.audio.click();
      return;
    }
    const enemy = this.pickEnemy(sx, sy, o.touch);
    const hasMov = sel.movable.length > 0 || sel.siege.length > 0;
    if (enemy && hasMov) { this.command(ground, enemy, true); return; }
    const w = this.pickWorld(ground, sx, sy);
    if (o.touch && hasMov) {
      if (w && w.isNest && sel.units.some(u => u.isSiege && u.def.mobile)) { this.command(ground, w, true); return; }
      this.command(w && w.isWallSeg ? { x: w.point.x, z: MAP.WALL_Z } : ground, null, false, w);
      return;
    }
    if (w && (w.isWallSeg || w.isCastle || w.type === 'center' || w.isNest)) { sel.selectStructure(w); this.audio.click(); return; }
    sel.clear();
  }

  onSecondary(sx, sy) {
    if (this.view === 'city') return;
    if (this.siege.placing) { this.siege.cancelPlacement(); return; }
    if (this.pending) { this.pending = null; this.ui.setPending(null); return; }
    const ground = this.cam.screenToGround(sx, sy);
    if (!ground) return;
    const enemy = this.pickEnemy(sx, sy, false);
    const w = this.pickWorld(ground, sx, sy);
    if (w && w.isNest) { this.command(ground, w, true); return; }
    this.command(w && w.isWallSeg ? { x: w.point.x, z: MAP.WALL_Z } : ground, enemy, !!enemy, w);
  }

  nearCityGate(sx, sy, touch) {
    const gt = this.map.cityGate;
    if (!gt) return false;
    this.cam.worldToScreen(gt.x, 5, gt.z, _p);
    return _p.visible && Math.hypot(_p.x - sx, _p.y - sy) < (touch ? 62 : 46);
  }

  onScreen(u) {
    this.cam.worldToScreen(u.x, 1, u.z, _p);
    return _p.visible && _p.x >= 0 && _p.y >= 0 && _p.x <= innerWidth && _p.y <= innerHeight;
  }

  onBoxSelect(r, additive) {
    if (this.view === 'city') return;
    const inBox = [];
    for (const u of this.units) {
      if (!u.alive) continue;
      this.cam.worldToScreen(u.x, u.y + 1, u.z, _p);
      if (_p.visible && _p.x >= r.x0 && _p.x <= r.x1 && _p.y >= r.y0 && _p.y <= r.y1) inBox.push(u);
    }
    for (const w of this.siege.weapons) {
      if (!w.alive || !w.def.mobile) continue;
      this.cam.worldToScreen(w.x, 1, w.z, _p);
      if (_p.visible && _p.x >= r.x0 && _p.x <= r.x1 && _p.y >= r.y0 && _p.y <= r.y1) inBox.push(w);
    }
    // priorité aux troupes : on ignore les cultivateurs si des soldats sont dans le cadre
    const mil = inBox.filter(u => u.type !== 'cultivator');
    const list = mil.length ? mil : inBox;
    if (additive) this.selection.set([...new Set([...this.selection.units, ...list])]);
    else this.selection.set(list);
  }

  // Ordre générique : déplacement, attaque, récolte
  command(ground, target, attack, world) {
    const sel = this.selection;
    if (!sel.units.length) return;
    const units = sel.units.filter(u => u.alive);
    // cultivateurs : gisement ou déplacement
    const cults = units.filter(u => u.type === 'cultivator');
    if (cults.length) {
      if (world && world.type && world.amount !== undefined) { for (const c of cults) c.assign(world); this.ui.toast(`${cults.length} cultivateur(s) → ${world.type === 'wood' ? 'bois' : world.type}`, 'info'); }
      else if (ground) this.spread(cults, ground.x, ground.z, (u, x, z) => u.orderMove(x, z));
    }
    const mil = units.filter(u => u.isUnit && u.type !== 'cultivator');
    const rams = units.filter(u => u.isSiege && u.def.mobile);
    const fixed = units.filter(u => u.isSiege && !u.def.mobile);
    if (target && target.alive) {
      for (const u of mil) u.orderAttack(target);
      for (const r of rams) r.orderAttack(target);
      for (const f of fixed) f.target = target;
      this.fx.ring(target.x, target.z, 1.6);
      this.audio.click();
      return;
    }
    if (!ground) return;
    // formations : déplacement groupé
    const forms = new Set(mil.map(u => u.formation).filter(Boolean));
    for (const f of forms) f.moveTo(ground.x, ground.z, attack);
    const loose = mil.filter(u => !u.formation);
    this.spread(loose, ground.x, ground.z, (u, x, z) => u.orderMove(x, z, attack));
    this.spread(rams, ground.x, ground.z, (u, x, z) => u.orderMove(x, z));
    if (fixed.length && !mil.length && !rams.length) this.ui.toast('Arme fixe : utilise « Démonter » puis redéploie-la', 'info');
    if (mil.length || rams.length || cults.length) { this.fx.ring(ground.x, ground.z, 1.2); this.audio.click(); }
  }

  spread(list, x, z, fn) {
    if (!list.length) return;
    if (list.length === 1) { fn(list[0], x, z); return; }
    // archers vers la muraille : alignés le long du chemin de ronde
    const onWall = this.grid.isWallCellXZ(x, z) >= 0;
    let i = 0;
    for (const u of list) {
      let ox, oz;
      if (onWall) { ox = (i - (list.length - 1) / 2) * 1.6; oz = 0; }
      else {
        const ring = Math.floor(Math.sqrt(i)), a = i * 2.4;
        ox = Math.cos(a) * ring * 1.6; oz = Math.sin(a) * ring * 1.6;
      }
      fn(u, x + ox, z + oz);
      i++;
    }
  }

  onKey(e) {
    if (!this.running) return;
    const k = e.code;
    if (k === 'Escape') {
      if (this.siege.placing) this.siege.cancelPlacement();
      else if (this.pending) { this.pending = null; this.ui.setPending(null); }
      else if (this.ui.closeTop()) { /* fermé */ }
      else this.selection.clear();
    } else if (k === 'Space') { e.preventDefault(); this.setPaused(!this.paused); }
    else if (k === 'KeyB') this.ui.toggleUnderground();
    else if (k === 'Digit1') this.setSpeed(1);
    else if (k === 'Digit2') this.setSpeed(2);
    else if (k === 'Digit3') this.setSpeed(3);
    else if (k === 'KeyG') this.ui.openFormations();
    else if (k === 'KeyX') this.formations.dissolveUnits(this.selection.units);
    else if (k === 'KeyH') this.cam.focus(0, 10);
    else if (this.view === 'city') { /* touches de jeu inactives dans la ville */ }
    else if (k === 'KeyM') { this.pending = 'move'; this.ui.setPending('move'); }
    else if (k === 'KeyT') { this.pending = 'attack'; this.ui.setPending('attack'); }
    else if (k === 'KeyN') this.cam.resetView();
    else if (k === 'KeyA' && e.ctrlKey) { e.preventDefault(); this.selection.set(this.units.filter(u => u.alive && u.type !== 'cultivator')); }
  }

  // Bascule entre la carte principale et la carte « Ville » (le jeu continue de tourner)
  setView(v) {
    if (v === this.view || !this.running) return;
    this.siege.cancelPlacement();
    this.pending = null;
    this.ui.setPending?.(null);
    this.view = v;
    this.sm.active = v;
    this.cam = v === 'city' ? this.cityCam : this.mapCam;
    this.input.cam = this.cam;
    this.input.reset?.();
    if (v === 'city') this.cityCam.fitDefault();
    this.ui.onView(v);
  }

  // zones du royaume : combat (carte), armée et village (ville). Une seule simulation, seul l'affichage change.
  setZone(z) {
    if (!this.running) return;
    this.zone = z;
    this.setView(z === 'combat' ? 'map' : 'city');
    if (z !== 'combat') this.city.setZone(z);
    this.ui.onZone(z);
  }

  setPaused(p, auto = false) {
    if (this.over) return;
    this.paused = p;
    this.ui.onPause(p, auto);
  }
  setSpeed(s) { this.speed = s; this.ui.onSpeed(s); }

  gameOver() {
    if (this.over) return;
    this.over = true;
    this.save.clear();
    this.fx.smoke(this.castle.x, 10, this.castle.z, 30);
    this.ui.gameOver(this.waves.wave, this.stats);
  }
}

const _v1 = new THREE.Vector3();
