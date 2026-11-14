import * as THREE from 'three';
import { SIEGE, CENTER, MAP } from '../data/Config.js';
import { SiegeWeapon } from '../entities/SiegeWeapon.js';
import { buildSiege } from '../world/Models.js';
import { arcPoints } from '../utils/MathUtils.js';

const _near = [];

// Armes de siège : réserve, placement (fantôme + portée + trajectoire), ciblage et tirs
export class SiegeSystem {
  constructor(game) {
    this.game = game;
    this.weapons = [];
    this.placing = null; // { kind: 'siege'|'center', type, ghost, valid, x, z }
    const sm = game.sm;
    const lm = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false });
    this.rangeRing = new THREE.LineLoop(this.circle(1, 64), lm(0xffd27a, 0.85));
    this.minRing = new THREE.LineLoop(this.circle(1, 48), lm(0xff6a4a, 0.6));
    this.arc = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(33 * 3), 3)), lm(0xffffff, 0.9));
    for (const o of [this.rangeRing, this.minRing, this.arc]) { o.visible = false; o.renderOrder = 20; o.frustumCulled = false; sm.scene.add(o); }
  }

  circle(r, n) {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = 0.25; p[i * 3 + 2] = Math.sin(a) * r; }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3));
  }

  maxDeployed() { return this.game.production.level('workshop') * 2 + this.game.production.level('depot'); }
  deployedCount() { return this.weapons.filter(w => w.alive).length; }

  // ---------- placement ----------
  startPlacement(kind, type, reserveIndex = -1) {
    this.cancelPlacement();
    const g = this.game, sm = g.sm;
    let ghost;
    if (kind === 'siege') {
      if (this.deployedCount() >= this.maxDeployed()) { g.ui.toast(`Maximum ${this.maxDeployed()} armes déployées (améliore l'atelier)`, 'warn'); return false; }
      ghost = buildSiege(type, sm.mat.ghostOk);
    } else {
      ghost = new THREE.Mesh(sm.models.house5, sm.mat.ghostOk);
      ghost.scale.setScalar(0.75);
    }
    ghost.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 15; } });
    sm.scene.add(ghost);
    ghost.visible = false;
    this.placing = { kind, type, ghost, valid: false, x: 0, z: 0, reserveIndex };
    g.input.dragGhost = true;
    g.ui.placementBanner(kind === 'siege' ? `Placer : ${SIEGE[type].name} — ${SIEGE[type].zone === 'back' ? 'derrière la muraille' : 'devant la muraille'}` : `Placer : ${CENTER.name}`);
    return true;
  }

  cancelPlacement() {
    if (!this.placing) return;
    this.game.sm.scene.remove(this.placing.ghost);
    this.placing = null;
    this.rangeRing.visible = this.minRing.visible = this.arc.visible = false;
    this.game.input.dragGhost = false;
    this.game.ui.placementBanner(null);
  }

  validSpot(kind, type, x, z) {
    const g = this.game, gr = g.grid;
    if (kind === 'siege') {
      if (!g.map.inZone(SIEGE[type].zone, x, z)) return false;
      if (g.castle.distTo(x, z) < 3) return false;
      for (const w of this.weapons) if (w.alive && Math.hypot(w.x - x, w.z - z) < w.radius + 2.6) return false;
      let ok = true;
      gr.markCircle(x, z, SIEGE[type].zone === 'back' && type === 'trebuchet' ? 2.2 : 1.4, k => { if (!gr.passable(k, 'player') || gr.wallSeg[k] >= 0) ok = false; });
      return ok;
    }
    // centre de récolte : derrière la muraille, ou sur un ancien gisement épuisé
    const onSite = g.resources.sites.some(s => Math.hypot(s.x - x, s.z - z) < 2.5);
    if (!onSite && !g.map.inZone('back', x, z)) return false;
    if (g.castle.distTo(x, z) < 5) return false;
    if (g.resources.centers.some(c => Math.hypot(c.x - x, c.z - z) < 10)) return false;
    let ok = true;
    gr.markCircle(x, z, 2.4, k => { if (gr.blocked[k] || gr.wallSeg[k] >= 0 || gr.building[k] >= 0) ok = false; });
    for (const n of g.resources.nodes) if (n.alive && Math.hypot(n.x - x, n.z - z) < 3.5) ok = false;
    return ok;
  }

  updateGhost(x, z) {
    const p = this.placing;
    if (!p) return;
    if (p.kind === 'center') {
      const s = this.game.resources.sites.find(s => Math.hypot(s.x - x, s.z - z) < 3);
      if (s) { x = s.x; z = s.z; }
    }
    p.x = x; p.z = z;
    p.valid = this.validSpot(p.kind, p.type, x, z);
    p.ghost.visible = true;
    p.ghost.position.set(x, 0, z);
    p.ghost.rotation.y = Math.PI;
    const mat = p.valid ? this.game.sm.mat.ghostOk : this.game.sm.mat.ghostBad;
    p.ghost.traverse(o => { if (o.isMesh) o.material = mat; });
    if (p.kind === 'siege') {
      const d = SIEGE[p.type];
      this.rangeRing.visible = true;
      this.rangeRing.position.set(x, 0, z);
      this.rangeRing.scale.setScalar(Math.max(d.range, 3));
      this.minRing.visible = d.minRange > 3;
      this.minRing.position.set(x, 0, z);
      this.minRing.scale.setScalar(d.minRange);
      this.showArc(p.type, x, z);
    }
  }

  // Prédiction de trajectoire : vers l'ennemi le plus proche à portée, sinon vers le nord à 75 % de portée
  showArc(type, x, z) {
    const d = SIEGE[type];
    if (!d.proj) { this.arc.visible = false; return; }
    let tx = x, tz = z - d.range * 0.75;
    const e = this.game.combat.nearestEnemy(x, z, d.range);
    if (e && Math.hypot(e.x - x, e.z - z) > d.minRange) { tx = e.x; tz = e.z; }
    const dist = Math.hypot(tx - x, tz - z);
    const T = this.flightTime(type, dist);
    const pts = arcPoints(x, this.launchHeight(type), z, tx, 0, tz, T, 32, d.proj === 'bolt' ? 2 : 20);
    const a = this.arc.geometry.attributes.position;
    a.array.set(pts);
    a.needsUpdate = true;
    this.arc.visible = true;
  }

  launchHeight(type) { return type === 'trebuchet' ? 8 : type === 'catapult' ? 3 : 1.7; }
  flightTime(type, dist) {
    const d = SIEGE[type];
    if (d.proj === 'bolt') return Math.max(0.15, dist / d.speed);
    return Math.max(1.1, dist / d.speed + 0.6);
  }

  confirmPlacement() {
    const p = this.placing, g = this.game;
    if (!p || !p.valid) { g.ui.toast('Emplacement invalide', 'warn'); return false; }
    if (p.kind === 'siege') {
      const w = new SiegeWeapon(g, p.type, p.x, p.z);
      this.weapons.push(w);
      g.production.reserve.splice(p.reserveIndex >= 0 ? p.reserveIndex : g.production.reserve.indexOf(p.type), 1);
      g.fx.burst(p.x, 0.5, p.z, 12, 0xc8b89a, 3, 0.7, 0.9);
      g.ui.toast(`${SIEGE[p.type].name} déployé${p.type === 'catapult' || p.type === 'ballista' ? 'e' : ''}`, 'ok');
    } else {
      if (!g.resources.canAfford(CENTER.cost)) { g.ui.toast('Ressources insuffisantes', 'warn'); return false; }
      g.resources.spend(CENTER.cost);
      g.resources.buildCenter(p.x, p.z);
      g.ui.toast('Centre de récolte construit', 'ok');
    }
    this.cancelPlacement();
    return true;
  }

  deployDirect(type, x, z, hp, ammo) {
    const w = new SiegeWeapon(this.game, type, x, z, hp);
    if (ammo) w.ammoMode = ammo;
    this.weapons.push(w);
    return w;
  }

  // Retirer une arme du terrain et la renvoyer en réserve
  undeploy(w) {
    const g = this.game;
    if (!w.alive) return;
    if (w.hp < w.maxHp * 0.99) { g.ui.toast('Arme endommagée : impossible de la démonter', 'warn'); return; }
    w.alive = false;
    g.sm.scene.remove(w.group);
    this.weapons = this.weapons.filter(x => x !== w);
    g.production.reserve.push(w.type);
    g.selection.clear();
  }

  // ---------- ciblage & tir ----------
  chooseTarget(w) {
    const g = this.game, d = w.def;
    g.enemyHash.query(w.x, w.z, d.range, _near);
    let best = null, bs = -Infinity;
    for (const e of _near) {
      if (!e.alive || e.y > 2) continue;
      const dist = Math.hypot(e.x - w.x, e.z - w.z);
      if (dist < d.minRange || dist > d.range) continue;
      let s;
      if (d.aoe > 0) {
        // densité autour de la cible
        let c = 0;
        for (const o of _near) if (o.alive && Math.hypot(o.x - e.x, o.z - e.z) < d.aoe) c++;
        s = c * 10 + (e.def.siege ? 15 : 0) - dist * 0.1;
      } else {
        s = e.maxHp * 0.05 + (e.type === 'golem' || e.type === 'golem_ram' ? 40 : 0) + (e.def.siege ? 20 : 0) - dist * 0.3;
      }
      if (s > bs) { bs = s; best = e; }
    }
    if (!best && d.aoe > 0) {
      // aucun ennemi : viser un nid à portée
      for (const n of g.waves.nests) if (n.alive) { const dist = Math.hypot(n.x - w.x, n.z - w.z); if (dist <= d.range && dist >= d.minRange) return n; }
    }
    return best;
  }

  fire(w, t, metal) {
    const g = this.game, d = w.def;
    const h = this.launchHeight(w.type);
    const sx = w.x + Math.sin(w.rot) * 1.2, sz = w.z + Math.cos(w.rot) * 1.2;
    const dist = Math.hypot(t.x - sx, t.z - sz);
    const T = this.flightTime(w.type, dist);
    const tx = t.x + (t.vx || 0) * T * 0.9, tz = t.z + (t.vz || 0) * T * 0.9;
    const dmg = d.dmg * (metal ? 1.3 : 1);
    if (d.proj === 'bolt') {
      g.combat.spawn('bolt', sx, h, sz, tx, 1, tz, T, { dmg, target: t, source: w, team: 'player', aoe: 0, gravity: 2, pierce: true });
    } else {
      g.combat.spawn(metal ? 'metalball' : 'boulder', sx, h, sz, tx, 0, tz, T, { dmg, target: null, source: w, team: 'player', aoe: d.aoe });
    }
    g.fx.burst(sx, h, sz, 4, 0xc8b89a, 2, 0.4, 0.6);
    g.audio?.thump();
  }

  update(dt) {
    for (const w of this.weapons) if (w.alive) w.update(dt);
    if (this.weapons.some(w => !w.alive)) this.weapons = this.weapons.filter(w => w.alive);
  }

  draw(alpha) { for (const w of this.weapons) w.draw(alpha); }
}
export { MAP };
