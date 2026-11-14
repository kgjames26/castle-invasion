import * as THREE from 'three';
import { ballistic, GRAVITY } from '../utils/MathUtils.js';
import { MAP } from '../data/Config.js';

const _near = [];
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3(0, 0, 1);

// Ciblage, dégâts (avec bonus de formation), projectiles et dégâts de zone
export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.pool = [];
    const sm = game.sm;
    this.render = {};
    for (const [k, geo] of Object.entries(sm.projGeo)) this.render[k] = sm.instanced(geo, k === 'arrow' ? 260 : 80, { shadow: k !== 'arrow' });
    this.trapTimer = 0;
  }

  // a-t-on la muraille entre deux points (sans brèche) ?
  wallBetween(a, b) {
    const W = MAP.WALL_HALF_THICK + 0.6;
    if (a.y > 1 || b.y > 1) return false;
    if ((a.z < -W && b.z > W) || (a.z > W && b.z < -W)) {
      const t = (0 - a.z) / (b.z - a.z);
      const x = a.x + (b.x - a.x) * t;
      const seg = this.game.wall.segments[this.game.wall.segAt(x)];
      return !seg.broken && !(seg.gate && a.team === 'player');
    }
    return false;
  }

  findEnemyFor(u, radius) {
    const g = this.game;
    g.enemyHash.query(u.x, u.z, radius + 1, _near);
    let best = null, bd = Infinity;
    for (const e of _near) {
      if (!e.alive) continue;
      if (!u.def.ranged && this.wallBetween(u, e)) continue;
      if (!u.def.ranged && e.y > 2) continue;
      let d = Math.hypot(e.x - u.x, e.z - u.z) - e.radius;
      if (e.type === 'golem_ram' || e.type === 'thrower') d -= 3; // priorité aux menaces de siège
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  findAllyFor(e, radius) {
    const g = this.game;
    g.allyHash.query(e.x, e.z, radius + 3, _near);
    let best = null, bd = Infinity;
    for (const a of _near) {
      if (!a.alive) continue;
      if (a.y > 2 && !e.def.ranged) continue; // archers sur la muraille : hors d'atteinte au corps à corps
      if (!e.def.ranged && this.wallBetween(e, a)) continue;
      let d = Math.hypot(a.x - e.x, a.z - e.z) - (a.radius || 0.5);
      if (d > radius) continue;
      if (e.type === 'dog' && a.isUnit) d -= 4;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  nearestEnemy(x, z, r, includeAll = true) {
    this.game.enemyHash.query(x, z, r, _near);
    let best = null, bd = Infinity;
    for (const e of _near) {
      if (!e.alive) continue;
      if (!includeAll && this.wallBetween({ x, z, y: 0 }, e)) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Dégâts avec modificateurs (formations, technologies)
  applyDamage(t, amount, o = {}) {
    if (!t || !t.alive) return;
    let dmg = amount;
    if (t.team === 'player' && t.isUnit && t.formation) {
      const b = t.formation.def.bonus;
      if (b.frontDef && o.source) {
        const fx = Math.sin(t.formation.rot), fz = Math.cos(t.formation.rot);
        const ax = o.source.x - t.x, az = o.source.z - t.z, d = Math.hypot(ax, az) || 1;
        if ((fx * ax + fz * az) / d > 0.3) dmg *= 1 - b.frontDef;
      }
      if (o.aoe && b.aoeRes) dmg *= 1 - b.aoeRes;
      if (o.siege && b.siegeRes) dmg *= 1 - b.siegeRes;
    }
    if (t.isStructure || t.isSiege) { t.takeDamage(dmg); return; }
    t.takeDamage(dmg, o.source);
    if (t.team === 'enemy') this.game.stats.damage += dmg;
    if (o.melee) this.game.fx.burst(t.x, 1.1 + (t.y || 0), t.z, 3, t.team === 'enemy' ? 0x4a6a2a : 0x8a1a1a, 2.5, 0.45, 0.55);
  }

  playerDmgMul() {
    const p = this.game.production;
    return (1 + 0.08 * Math.max(0, p.level('barracks') - 1) + 0.05 * p.level('forge')) * (p.hasTech('blessing') ? 1.25 : 1);
  }

  melee(u, t, mul = 1) {
    const dmg = u.def.dmg * this.playerDmgMul() * mul;
    if (t.isNest) { t.takeDamage(dmg * 0.5); return; }
    this.applyDamage(t, dmg, { source: u, melee: true });
    this.game.audio?.hit();
  }

  hitStructure(e, s, dmg) {
    if (s.isSiege) this.applyDamage(s, dmg, { source: e });
    else s.takeDamage(dmg);
    this.game.fx.burst(e.x + Math.sin(e.rot) * 1.2, 1.2, e.z + Math.cos(e.rot) * 1.2, 3, 0x9a8a7a, 3, 0.5, 0.6);
  }

  // ---------- projectiles ----------
  spawn(kind, x, y, z, tx, ty, tz, T, data) {
    const p = this.pool.pop() || {};
    const v = ballistic(tx - x, ty - y, tz - z, T, data.gravity ?? GRAVITY);
    Object.assign(p, { kind, x, y, z, vx: v.vx, vy: v.vy, vz: v.vz, t: 0, T, g: data.gravity ?? GRAVITY, tx, ty, tz, spin: Math.random() * 6 }, data);
    p.inst = this.render[kind].alloc();
    if (p.inst < 0) { this.pool.push(p); return null; }
    this.projectiles.push(p);
    return p;
  }

  fireArrow(u, t) {
    const dd = Math.hypot(t.x - u.x, t.z - u.z) || 1;
    const sx = u.x + (t.x - u.x) / dd * 1.1, sy = (u.y || 0) + 1.7, sz = u.z + (t.z - u.z) / dd * 1.1;
    const d = Math.hypot(t.x - sx, t.z - sz);
    const T = 0.25 + d / 32;
    const tx = t.x + (t.vx || 0) * T, tz = t.z + (t.vz || 0) * T;
    this.spawn('arrow', sx, sy, sz, tx, (t.y || 0) + 1, tz, T, {
      dmg: u.def.dmg * this.playerDmgMul(), target: t, source: u, team: 'player', aoe: 0, gravity: 12,
    });
  }

  throwRock(e, tx, ty, tz, extra) {
    const d = Math.hypot(tx - e.x, tz - e.z);
    const T = 0.8 + d / 18;
    this.spawn('rock', e.x, 2.6, e.z, tx, ty, tz, T, {
      dmg: e.dmg, target: extra.target || null, seg: extra.seg ?? -1, source: e, team: 'enemy', aoe: e.def.aoe || 2.5, siege: true,
    });
  }

  update(dt) {
    const g = this.game;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
      p.vy -= p.g * dt;
      if (p.t >= p.T || p.y < -0.5) {
        this.impact(p);
        this.render[p.kind].release(p.inst);
        this.projectiles.splice(i, 1);
        p.target = null; p.source = null;
        this.pool.push(p);
      }
    }
    // pièges des défenses souterraines (zone tampon)
    const lvl = g.production.level('defenses');
    if (lvl > 0) {
      this.trapTimer -= dt;
      if (this.trapTimer <= 0) {
        this.trapTimer = 1;
        for (const e of g.enemies) {
          if (e.alive && g.castle.distTo(e.x, e.z) < 7) {
            this.applyDamage(e, 7 * lvl, {});
            g.fx.burst(e.x, 0.2, e.z, 3, 0x9098a0, 3, 0.4, 0.5);
          }
        }
      }
    }
  }

  impact(p) {
    const g = this.game;
    if (p.kind === 'arrow' || p.kind === 'bolt') {
      const t = p.target;
      if (t && t.alive && Math.hypot(t.x - p.x, t.z - p.z) < (t.radius || 0.5) + (p.kind === 'bolt' ? 1.6 : 1.1)) {
        this.applyDamage(t, p.dmg, { source: p.source, ranged: true });
        if (p.kind === 'bolt') g.fx.burst(p.x, p.y + 0.5, p.z, 6, 0x4a6a2a, 4, 0.5, 0.6);
      } else if (p.kind === 'bolt' && p.pierce) {
        // le carreau perce : touche l'ennemi le plus proche du point d'impact
        const e = this.nearestEnemy(p.x, p.z, 1.6);
        if (e) this.applyDamage(e, p.dmg * 0.7, { source: p.source });
      }
      return;
    }
    // projectiles lourds : dégâts de zone
    const x = p.x, z = p.z;
    const r = p.aoe || 2;
    g.fx.explosion(x, Math.max(0.1, p.y), z, r, p.kind === 'rock' ? 0x7a6a58 : 0xa09a90);
    if (p.team === 'player') {
      g.camShake = Math.max(g.camShake, p.kind === 'boulder' || p.kind === 'metalball' ? 0.18 : 0.1);
      g.enemyHash.query(x, z, r + 1.5, _near);
      for (const e of _near) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - x, e.z - z) - e.radius;
        if (d > r) continue;
        const f = 1 - Math.max(0, d) / r * 0.6;
        this.applyDamage(e, p.dmg * f, { source: p.source, aoe: true });
      }
      // dégâts aux nids
      for (const n of g.waves.nests) if (n.alive && Math.hypot(n.x - x, n.z - z) < n.radius + r) n.takeDamage(p.dmg * 0.6);
    } else {
      if (p.seg >= 0 && Math.abs(z - MAP.WALL_Z) < 3.5) g.wall.damage(p.seg, p.dmg * 2);
      g.allyHash.query(x, z, r + 2.5, _near);
      for (const a of _near) {
        if (!a.alive) continue;
        const d = Math.hypot(a.x - x, a.z - z) - (a.radius || 0.5);
        if (d > r) continue;
        if (Math.abs((a.y || 0) - p.y) > 4) continue;
        this.applyDamage(a, p.dmg * (1 - Math.max(0, d) / r * 0.5), { source: p.source, aoe: true, siege: true });
      }
      for (const c of g.resources.centers) if (c.alive && Math.hypot(c.x - x, c.z - z) < c.radius + r) c.takeDamage(p.dmg);
    }
  }

  draw(alpha) {
    for (const p of this.projectiles) {
      const r = this.render[p.kind];
      if (p.kind === 'boulder' || p.kind === 'rock' || p.kind === 'metalball') {
        r.set(p.inst, p.x, p.y, p.z, p.t * 6 + p.spin, 1, p.t * 4);
      } else {
        _v.set(p.vx, p.vy, p.vz).normalize();
        _q.setFromUnitVectors(_fwd, _v);
        r.setQuat(p.inst, p.x, p.y, p.z, _q);
      }
    }
    for (const k in this.render) this.render[k].commit();
  }
}
