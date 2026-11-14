import { VERSION, MAP } from '../data/Config.js';

const KEY = 'castle-invasion-save-v2';

// Sauvegarde locale : automatique toutes les 30 s et à chaque fin de vague
export class SaveManager {
  constructor(game) { this.game = game; }

  has() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
  peek() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

  serialize() {
    const g = this.game;
    return {
      v: VERSION,
      orient: MAP.orient,
      date: Date.now(),
      time: g.time,
      res: g.resources.stock,
      production: g.production.serialize(),
      waves: g.waves.serialize(),
      // si on sauvegarde pendant une vague, elle sera rejouée après 15 s
      midWave: g.waves.state === 'active',
      prepTimer: g.waves.timer,
      castleHp: g.castle.hp,
      wall: g.wall.segments.map(s => [Math.round(s.hp), s.broken ? 1 : 0]),
      nodes: g.resources.nodes.map(n => Math.round(n.amount * 10) / 10),
      centers: g.resources.centers.filter(c => c.alive).map(c => [c.x, c.z, Math.round(c.hp)]),
      units: g.units.filter(u => u.alive).map(u => ({
        t: u.type, x: +u.x.toFixed(1), z: +u.z.toFixed(1), hp: Math.round(u.hp), gt: u.gatherType || null,
        wall: u.onWall ? 1 : 0,
      })),
      siege: g.siege.weapons.filter(w => w.alive).map(w => ({ t: w.type, x: w.x, z: w.z, hp: Math.round(w.hp), ammo: w.ammoMode })),
      stats: g.stats,
      cam: { x: g.mapCam.goal.x, z: g.mapCam.goal.z, yaw: g.mapCam.goal.yaw, dist: g.mapCam.goal.dist },
    };
  }

  save(reason = 'auto') {
    if (this.game.over) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.serialize()));
      if (reason !== 'auto') this.game.ui.toast('💾 Partie sauvegardée', 'info', 'save');
      this.game.ui.saveBlink?.();
    } catch (e) { console.warn('Sauvegarde impossible', e); }
  }

  apply(d) {
    const g = this.game;
    Object.assign(g.resources.stock, d.res);
    g.time = d.time || 0;
    g.production.load(d.production || {});
    if (g.production.level('defenses')) g.castle.applyDefenses(g.production.level('defenses'));
    g.wall.applyTechs();
    g.castle.hp = Math.min(g.castle.maxHp, d.castleHp ?? g.castle.maxHp);
    (d.wall || []).forEach(([hp, broken], i) => {
      const s = g.wall.segments[i];
      if (!s) return;
      if (broken) { s.hp = 1; g.wall.breakSeg(s); g.ui.clearToasts?.(); }
      else { s.hp = Math.min(s.maxHp, hp); g.wall.updateVisual(s); }
    });
    (d.nodes || []).forEach((a, i) => {
      const n = g.resources.nodes[i];
      if (!n) return;
      if (a <= 0) n.deplete();
      else { n.amount = Math.min(n.max, a); n.updateScale(); }
    });
    g.ui.clearToasts?.();
    for (const [x, z, hp] of d.centers || []) g.resources.buildCenter(x, z, hp);
    for (const u of d.units || []) {
      const unit = g.spawnUnit(u.t, u.x, u.z);
      if (!unit) continue;
      unit.hp = Math.min(unit.maxHp, u.hp);
      if (u.gt) unit.gatherType = u.gt;
      if (unit.anchor) unit.anchor = { x: u.x, z: u.z };
      if (u.wall) unit.orderMove(u.x, 0);
    }
    for (const w of d.siege || []) g.siege.deployDirect(w.t, w.x, w.z, w.hp, w.ammo);
    const ws = d.waves || {};
    (ws.nests || []).forEach((n, i) => {
      const nest = g.waves.nests[i];
      if (!nest) return;
      if (!n.alive) { nest.destroy(true); nest.regrow = n.regrow; }
      else nest.hp = n.hp;
    });
    g.ui.clearToasts?.();
    g.waves.startPrep(ws.wave || 1, d.midWave ? 15 : Math.max(10, d.prepTimer || 30));
    Object.assign(g.stats, d.stats || {});
    if (d.cam) Object.assign(g.mapCam.goal, d.cam);
    g.camShake = 0;
  }
}
